import type { TransferDto } from "../../shared/types";
import type { SqlStatement } from "../adapters/db/types";
import { businessDate } from "../domain/dates";
import { AppError } from "../domain/errors";
import { documentNumber, newId } from "../domain/ids";
import type { Repositories } from "../repositories";
import { NOW_SQL } from "../repositories/base";
import { ledger, type DocumentFilter } from "../repositories/operations";
import type { Actor } from "./context";
import { runAtomic } from "./tx";

export interface TransferData {
  transferDate: string;
  reason: string | null;
  notes: string | null;
  items: { lotId: string; fromBinId: string; toBinId: string; quantity: number }[];
}

/** Bin-to-bin moves that keep exact lot identity. Draft -> confirm (manager) -> balances + ledger. */
export class TransferService {
  constructor(
    private readonly repos: Repositories,
    private readonly timezone: string,
  ) {}

  list(actor: Actor, filter: DocumentFilter) {
    return this.repos.operations.listTransfers(actor.tenantId, filter);
  }

  async get(actor: Actor, id: string): Promise<TransferDto> {
    const transfer = await this.repos.operations.getTransfer(actor.tenantId, id);
    if (!transfer) throw new AppError("NOT_FOUND", "Transfer not found");
    return { ...transfer, items: await this.repos.operations.getTransferItems(actor.tenantId, id) };
  }

  /** Pre-validates source stock and destination capacity so users get clear errors before confirming. */
  private async validate(actor: Actor, input: TransferData) {
    const outgoing = new Map<string, number>();
    const incoming = new Map<string, number>();
    for (const [index, item] of input.items.entries()) {
      const position = await this.repos.inventory.getPosition(actor.tenantId, item.lotId, item.fromBinId);
      const key = `${item.lotId}|${item.fromBinId}`;
      const need = (outgoing.get(key) ?? 0) + item.quantity;
      if (!position || position.quantity < need) {
        throw new AppError("INSUFFICIENT_STOCK", "Not enough stock at source location", { field: `items.${index}.quantity`, available: position?.quantity ?? 0 });
      }
      outgoing.set(key, need);
      const to = await this.repos.warehouse.getBin(actor.tenantId, item.toBinId);
      if (!to) throw new AppError("VALIDATION_ERROR", "Destination bin not found", { field: `items.${index}.toBinId` });
      if (to.status !== "ACTIVE") throw new AppError("BIN_INACTIVE", "Destination bin is inactive", { locationCode: to.locationCode });
      const incomingTotal = (incoming.get(to.id) ?? 0) + item.quantity;
      if (to.used + incomingTotal > to.capacity) {
        throw new AppError("BIN_CAPACITY_EXCEEDED", "Destination bin capacity exceeded", { locationCode: to.locationCode, free: Math.max(0, to.capacity - to.used) });
      }
      incoming.set(to.id, incomingTotal);
    }
  }

  async create(actor: Actor, input: TransferData): Promise<TransferDto> {
    await this.validate(actor, input);
    const warehouse = await this.repos.warehouse.getDefaultWarehouse(actor.tenantId);
    if (!warehouse) throw new AppError("NOT_FOUND", "Warehouse not configured");
    const id = newId();
    const number = documentNumber("DC", businessDate(new Date(), this.timezone));
    const statements: SqlStatement[] = [
      {
        sql: `INSERT INTO stock_transfers (id, tenant_id, warehouse_id, transfer_number, transfer_date, reason, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [id, actor.tenantId, warehouse.id, number, input.transferDate, input.reason, input.notes, actor.userId],
      },
    ];
    for (const item of input.items) {
      statements.push({
        sql: `INSERT INTO stock_transfer_items (id, tenant_id, transfer_id, product_id, lot_id, from_bin_id, to_bin_id, quantity)
              SELECT ?, ?, ?, l.product_id, l.id, ?, ?, ? FROM inventory_lots l WHERE l.id = ? AND l.tenant_id = ?`,
        params: [newId(), actor.tenantId, id, item.fromBinId, item.toBinId, item.quantity, item.lotId, actor.tenantId],
      });
    }
    statements.push(this.repos.identity.auditStatement({ tenantId: actor.tenantId, userId: actor.userId, action: "transfer.created", entityType: "stock_transfer", entityId: id, details: { number }, ipAddress: actor.ipAddress }));
    await runAtomic(this.repos, statements);
    return this.get(actor, id);
  }

  async confirm(actor: Actor, id: string): Promise<TransferDto> {
    const transfer = await this.get(actor, id);
    if (transfer.status !== "DRAFT") throw new AppError("INVALID_STATUS_TRANSITION", "Transfer already processed");
    const items = transfer.items ?? [];
    const statements: SqlStatement[] = [
      {
        sql: `UPDATE stock_transfers SET status = 'CONFIRMED', confirmed_by = ?, confirmed_at = ${NOW_SQL}, updated_at = ${NOW_SQL} WHERE id = ? AND tenant_id = ?`,
        params: [actor.userId, id, actor.tenantId],
      },
    ];
    for (const item of items) {
      const common = { tenantId: actor.tenantId, productId: item.productId, lotId: item.lotId, referenceType: "STOCK_TRANSFER" as const, referenceId: id, referenceItemId: item.id, transactionDate: transfer.transferDate, userId: actor.userId };
      statements.push(
        ledger.assertPositionExists(actor.tenantId, item.lotId, item.fromBinId, item.quantity),
        ledger.decrease(actor.tenantId, item.lotId, item.fromBinId, item.quantity),
        ledger.transaction({ ...common, type: "TRANSFER_OUT", binId: item.fromBinId, quantityChange: -item.quantity }),
        ledger.increase(actor.tenantId, item.productId, item.lotId, item.toBinId, item.quantity),
        ledger.transaction({ ...common, type: "TRANSFER_IN", binId: item.toBinId, quantityChange: item.quantity }),
      );
    }
    statements.push(this.repos.identity.auditStatement({ tenantId: actor.tenantId, userId: actor.userId, action: "transfer.confirmed", entityType: "stock_transfer", entityId: id, details: { number: transfer.transferNumber }, ipAddress: actor.ipAddress }));
    await runAtomic(this.repos, statements);
    return this.get(actor, id);
  }

  async cancel(actor: Actor, id: string): Promise<TransferDto> {
    const transfer = await this.get(actor, id);
    if (transfer.status !== "DRAFT") throw new AppError("INVALID_STATUS_TRANSITION", "Only draft transfers can be cancelled");
    await runAtomic(this.repos, [
      { sql: `UPDATE stock_transfers SET status = 'CANCELLED', updated_at = ${NOW_SQL} WHERE id = ? AND tenant_id = ?`, params: [id, actor.tenantId] },
      this.repos.identity.auditStatement({ tenantId: actor.tenantId, userId: actor.userId, action: "transfer.cancelled", entityType: "stock_transfer", entityId: id, ipAddress: actor.ipAddress }),
    ]);
    return this.get(actor, id);
  }
}
