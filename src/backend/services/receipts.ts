import type { ReceiptInputParsed } from "../../shared/schemas";
import type { ReceiptDto } from "../../shared/types";
import type { SqlStatement } from "../adapters/db/types";
import { AppError } from "../domain/errors";
import { documentNumber, newId } from "../domain/ids";
import { NOW_SQL } from "../repositories/base";
import type { Repositories } from "../repositories";
import { ledger, type DocumentFilter } from "../repositories/operations";
import type { Actor } from "./context";
import { businessDate } from "../domain/dates";
import { runAtomic } from "./tx";

/** Inbound workflow: draft receipt -> confirm (creates lots, balances, ledger rows atomically). */
export class ReceiptService {
  constructor(
    private readonly repos: Repositories,
    private readonly timezone: string,
  ) {}

  list(actor: Actor, filter: DocumentFilter) {
    return this.repos.operations.listReceipts(actor.tenantId, filter);
  }

  async get(actor: Actor, id: string): Promise<ReceiptDto> {
    const receipt = await this.repos.operations.getReceipt(actor.tenantId, id);
    if (!receipt) throw new AppError("NOT_FOUND", "Receipt not found");
    return { ...receipt, items: await this.repos.operations.getReceiptItems(actor.tenantId, id) };
  }

  /** Validates references (tenant-scoped) and lot consistency. */
  private async validate(actor: Actor, input: ReceiptInputParsed) {
    if (input.supplierId && !(await this.repos.catalog.getSupplier(actor.tenantId, input.supplierId))) {
      throw new AppError("VALIDATION_ERROR", "Supplier not found", { field: "supplierId" });
    }
    const seenLots = new Map<string, string | null>();
    for (const [index, item] of input.items.entries()) {
      const product = await this.repos.catalog.getProduct(actor.tenantId, item.productId);
      if (!product || product.status !== "ACTIVE") throw new AppError("VALIDATION_ERROR", "Product not found or inactive", { field: `items.${index}.productId` });
      const bin = await this.repos.warehouse.getBin(actor.tenantId, item.binId);
      if (!bin) throw new AppError("VALIDATION_ERROR", "Bin not found", { field: `items.${index}.binId` });
      if (bin.status !== "ACTIVE") throw new AppError("BIN_INACTIVE", "Bin is inactive", { locationCode: bin.locationCode });

      const key = `${item.productId}|${item.lotNumber}`;
      const existing = await this.repos.inventory.findLot(actor.tenantId, item.productId, item.lotNumber);
      const expected = existing ? existing.expirationDate : seenLots.has(key) ? seenLots.get(key)! : undefined;
      if (expected !== undefined && expected !== item.expirationDate) {
        throw new AppError("LOT_MISMATCH", "Lot already exists with a different expiration date", { lotNumber: item.lotNumber, expirationDate: expected });
      }
      seenLots.set(key, item.expirationDate);
    }
  }

  private itemStatements(actor: Actor, receiptId: string, input: ReceiptInputParsed): SqlStatement[] {
    return input.items.map((i) => ({
      sql: `INSERT INTO stock_receipt_items (id, tenant_id, receipt_id, product_id, lot_number, manufacturing_date, expiration_date, bin_id, quantity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [newId(), actor.tenantId, receiptId, i.productId, i.lotNumber, i.manufacturingDate, i.expirationDate, i.binId, i.quantity],
    }));
  }

  async create(actor: Actor, input: ReceiptInputParsed): Promise<ReceiptDto> {
    await this.validate(actor, input);
    const warehouse = await this.repos.warehouse.getDefaultWarehouse(actor.tenantId);
    if (!warehouse) throw new AppError("NOT_FOUND", "Warehouse not configured");
    const id = newId();
    const number = documentNumber("PN", businessDate(new Date(), this.timezone));
    await runAtomic(this.repos, [
      {
        sql: `INSERT INTO stock_receipts (id, tenant_id, warehouse_id, receipt_number, supplier_id, receipt_date, reference_no, notes, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [id, actor.tenantId, warehouse.id, number, input.supplierId, input.receiptDate, input.referenceNo, input.notes, actor.userId],
      },
      ...this.itemStatements(actor, id, input),
      this.repos.identity.auditStatement({ tenantId: actor.tenantId, userId: actor.userId, action: "receipt.created", entityType: "stock_receipt", entityId: id, details: { number }, ipAddress: actor.ipAddress }),
    ]);
    return this.get(actor, id);
  }

  async update(actor: Actor, id: string, input: ReceiptInputParsed): Promise<ReceiptDto> {
    const receipt = await this.get(actor, id);
    if (receipt.status !== "DRAFT") throw new AppError("INVALID_STATUS_TRANSITION", "Only draft receipts can be edited");
    await this.validate(actor, input);
    await runAtomic(this.repos, [
      {
        sql: `UPDATE stock_receipts SET supplier_id = ?, receipt_date = ?, reference_no = ?, notes = ?, updated_at = ${NOW_SQL}
               WHERE id = ? AND tenant_id = ? AND status = 'DRAFT'`,
        params: [input.supplierId, input.receiptDate, input.referenceNo, input.notes, id, actor.tenantId],
      },
      { sql: "DELETE FROM stock_receipt_items WHERE receipt_id = ? AND tenant_id = ?", params: [id, actor.tenantId] },
      ...this.itemStatements(actor, id, input),
    ]);
    return this.get(actor, id);
  }

  async confirm(actor: Actor, id: string): Promise<ReceiptDto> {
    const receipt = await this.get(actor, id);
    if (receipt.status !== "DRAFT") throw new AppError("INVALID_STATUS_TRANSITION", "Receipt already processed");
    const items = receipt.items ?? [];
    if (items.length === 0) throw new AppError("VALIDATION_ERROR", "Receipt has no items");

    const statements: SqlStatement[] = [
      // The status trigger aborts the whole batch if another request confirmed it first.
      {
        sql: `UPDATE stock_receipts SET status = 'CONFIRMED', confirmed_by = ?, confirmed_at = ${NOW_SQL}, updated_at = ${NOW_SQL} WHERE id = ? AND tenant_id = ?`,
        params: [actor.userId, id, actor.tenantId],
      },
    ];
    const lotIds = new Map<string, string>();
    for (const item of items) {
      const key = `${item.productId}|${item.lotNumber}`;
      let lotId = lotIds.get(key);
      if (!lotId) {
        const existing = await this.repos.inventory.findLot(actor.tenantId, item.productId, item.lotNumber);
        if (existing && existing.expirationDate !== item.expirationDate) {
          throw new AppError("LOT_MISMATCH", "Lot already exists with a different expiration date", { lotNumber: item.lotNumber, expirationDate: existing.expirationDate });
        }
        lotId = existing?.id ?? newId();
        if (!existing) {
          statements.push({
            sql: `INSERT INTO inventory_lots (id, tenant_id, product_id, supplier_id, lot_number, manufacturing_date, expiration_date, received_date)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            params: [lotId, actor.tenantId, item.productId, receipt.supplierId, item.lotNumber, item.manufacturingDate, item.expirationDate, receipt.receiptDate],
          });
        }
        lotIds.set(key, lotId);
      }
      statements.push(
        { sql: "UPDATE stock_receipt_items SET lot_id = ? WHERE id = ? AND tenant_id = ?", params: [lotId, item.id, actor.tenantId] },
        ledger.increase(actor.tenantId, item.productId, lotId, item.binId, item.quantity),
        ledger.transaction({
          tenantId: actor.tenantId, type: "RECEIPT", productId: item.productId, lotId, binId: item.binId, quantityChange: item.quantity,
          referenceType: "STOCK_RECEIPT", referenceId: id, referenceItemId: item.id, transactionDate: receipt.receiptDate, userId: actor.userId,
        }),
      );
    }
    statements.push(
      this.repos.identity.auditStatement({
        tenantId: actor.tenantId, userId: actor.userId, action: "receipt.confirmed", entityType: "stock_receipt", entityId: id,
        details: { number: receipt.receiptNumber, totalQuantity: receipt.totalQuantity }, ipAddress: actor.ipAddress,
      }),
    );
    await runAtomic(this.repos, statements);
    return this.get(actor, id);
  }

  async cancel(actor: Actor, id: string): Promise<ReceiptDto> {
    const receipt = await this.get(actor, id);
    if (receipt.status !== "DRAFT") throw new AppError("INVALID_STATUS_TRANSITION", "Only draft receipts can be cancelled");
    await runAtomic(this.repos, [
      { sql: `UPDATE stock_receipts SET status = 'CANCELLED', updated_at = ${NOW_SQL} WHERE id = ? AND tenant_id = ?`, params: [id, actor.tenantId] },
      this.repos.identity.auditStatement({ tenantId: actor.tenantId, userId: actor.userId, action: "receipt.cancelled", entityType: "stock_receipt", entityId: id, ipAddress: actor.ipAddress }),
    ]);
    return this.get(actor, id);
  }
}
