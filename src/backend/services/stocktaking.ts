import type { StocktakingDto } from "../../shared/types";
import type { SqlStatement } from "../adapters/db/types";
import { businessDate } from "../domain/dates";
import { AppError } from "../domain/errors";
import { documentNumber, newId } from "../domain/ids";
import type { Repositories } from "../repositories";
import { NOW_SQL, placeholders } from "../repositories/base";
import { ledger, type DocumentFilter } from "../repositories/operations";
import type { Actor } from "./context";
import { runAtomic } from "./tx";

/**
 * Physical counting: snapshot system quantities -> record counts -> submit -> approve.
 * Approval posts ADJUSTMENT movements for each discrepancy (counted - system snapshot).
 */
export class StocktakingService {
  constructor(
    private readonly repos: Repositories,
    private readonly timezone: string,
  ) {}

  list(actor: Actor, filter: DocumentFilter) {
    return this.repos.operations.listStocktaking(actor.tenantId, filter);
  }

  async get(actor: Actor, id: string): Promise<StocktakingDto> {
    const session = await this.repos.operations.getStocktaking(actor.tenantId, id);
    if (!session) throw new AppError("NOT_FOUND", "Stocktaking session not found");
    return { ...session, items: await this.repos.operations.getStocktakingItems(actor.tenantId, id) };
  }

  async create(actor: Actor, input: { scopeType: "ALL" | "ZONE" | "RACK"; scopeIds: string[]; notes: string | null }): Promise<StocktakingDto> {
    const warehouse = await this.repos.warehouse.getDefaultWarehouse(actor.tenantId);
    if (!warehouse) throw new AppError("NOT_FOUND", "Warehouse not configured");
    const scopeIds = input.scopeType === "ALL" ? [] : [...new Set(input.scopeIds)];
    // verify scope belongs to the tenant
    for (const scopeId of scopeIds) {
      const found = input.scopeType === "ZONE" ? await this.repos.warehouse.getZone(actor.tenantId, scopeId) : await this.repos.warehouse.getRack(actor.tenantId, scopeId);
      if (!found) throw new AppError("VALIDATION_ERROR", "Scope not found", { field: "scopeIds" });
    }
    const id = newId();
    const number = documentNumber("KK", businessDate(new Date(), this.timezone));
    const scopeFilter =
      input.scopeType === "ZONE" ? `AND b.zone_id IN (${placeholders(scopeIds.length)})` : input.scopeType === "RACK" ? `AND b.rack_id IN (${placeholders(scopeIds.length)})` : "";

    await runAtomic(this.repos, [
      {
        sql: `INSERT INTO stocktaking_sessions (id, tenant_id, warehouse_id, session_number, scope_type, scope_ids, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [id, actor.tenantId, warehouse.id, number, input.scopeType, JSON.stringify(scopeIds), input.notes, actor.userId],
      },
      // Snapshot every non-empty position in scope in a single statement.
      {
        sql: `INSERT INTO stocktaking_items (id, tenant_id, session_id, product_id, lot_id, bin_id, system_quantity)
              SELECT lower(hex(randomblob(16))), ib.tenant_id, ?, ib.product_id, ib.lot_id, ib.bin_id, ib.quantity
                FROM inventory_balances ib JOIN warehouse_bins b ON b.id = ib.bin_id
               WHERE ib.tenant_id = ? AND ib.quantity > 0 ${scopeFilter}`,
        params: [id, actor.tenantId, ...scopeIds],
      },
      this.repos.identity.auditStatement({ tenantId: actor.tenantId, userId: actor.userId, action: "stocktaking.created", entityType: "stocktaking_session", entityId: id, details: { number, scopeType: input.scopeType }, ipAddress: actor.ipAddress }),
    ]);
    return this.get(actor, id);
  }

  async recordCounts(actor: Actor, id: string, counts: { itemId: string; countedQuantity: number | null; notes: string | null }[]): Promise<StocktakingDto> {
    const session = await this.repos.operations.getStocktaking(actor.tenantId, id);
    if (!session) throw new AppError("NOT_FOUND", "Stocktaking session not found");
    if (session.status !== "COUNTING") throw new AppError("INVALID_STATUS_TRANSITION", "Session is not open for counting");
    await runAtomic(
      this.repos,
      counts.map((c) => ({
        sql: `UPDATE stocktaking_items SET counted_quantity = ?, notes = ?, counted_by = CASE WHEN ? IS NULL THEN NULL ELSE ? END,
                     counted_at = CASE WHEN ? IS NULL THEN NULL ELSE ${NOW_SQL} END
               WHERE id = ? AND session_id = ? AND tenant_id = ?`,
        params: [c.countedQuantity, c.notes, c.countedQuantity, actor.userId, c.countedQuantity, c.itemId, id, actor.tenantId],
      })),
    );
    return this.get(actor, id);
  }

  private async transition(actor: Actor, id: string, from: string[], to: string, action: string, markSubmitted = false) {
    const session = await this.repos.operations.getStocktaking(actor.tenantId, id);
    if (!session) throw new AppError("NOT_FOUND", "Stocktaking session not found");
    if (!from.includes(session.status)) throw new AppError("INVALID_STATUS_TRANSITION", `Cannot move from ${session.status} to ${to}`);
    const submittedSql = markSubmitted ? `submitted_by = ?, submitted_at = ${NOW_SQL},` : "";
    await runAtomic(this.repos, [
      {
        sql: `UPDATE stocktaking_sessions SET status = ?, ${submittedSql} updated_at = ${NOW_SQL} WHERE id = ? AND tenant_id = ? AND status = ?`,
        params: [to, ...(markSubmitted ? [actor.userId] : []), id, actor.tenantId, session.status],
      },
      this.repos.identity.auditStatement({ tenantId: actor.tenantId, userId: actor.userId, action, entityType: "stocktaking_session", entityId: id, ipAddress: actor.ipAddress }),
    ]);
    return this.get(actor, id);
  }

  async submit(actor: Actor, id: string) {
    const session = await this.get(actor, id);
    if (session.countedCount === 0) throw new AppError("VALIDATION_ERROR", "Nothing has been counted yet");
    return this.transition(actor, id, ["COUNTING"], "SUBMITTED", "stocktaking.submitted", true);
  }

  reopen(actor: Actor, id: string) {
    return this.transition(actor, id, ["SUBMITTED"], "COUNTING", "stocktaking.reopened");
  }

  cancel(actor: Actor, id: string) {
    return this.transition(actor, id, ["COUNTING", "SUBMITTED"], "CANCELLED", "stocktaking.cancelled");
  }

  async approve(actor: Actor, id: string): Promise<StocktakingDto> {
    const session = await this.get(actor, id);
    if (session.status !== "SUBMITTED") throw new AppError("INVALID_STATUS_TRANSITION", "Only submitted sessions can be approved");
    const today = businessDate(new Date(), this.timezone);
    const statements: SqlStatement[] = [
      // trigger: APPROVED only from SUBMITTED, never twice
      {
        sql: `UPDATE stocktaking_sessions SET status = 'APPROVED', approved_by = ?, approved_at = ${NOW_SQL}, updated_at = ${NOW_SQL} WHERE id = ? AND tenant_id = ?`,
        params: [actor.userId, id, actor.tenantId],
      },
    ];
    const adjustments: { location: string; sku: string; lot: string; delta: number }[] = [];
    for (const item of session.items ?? []) {
      if (item.countedQuantity === null) continue;
      const delta = item.countedQuantity - item.systemQuantity;
      if (delta === 0) continue;
      adjustments.push({ location: item.locationCode, sku: item.productSku, lot: item.lotNumber, delta });
      statements.push(
        delta > 0 ? ledger.increase(actor.tenantId, item.productId, item.lotId, item.binId, delta) : ledger.decrease(actor.tenantId, item.lotId, item.binId, -delta),
        ledger.transaction({
          tenantId: actor.tenantId, type: "ADJUSTMENT", productId: item.productId, lotId: item.lotId, binId: item.binId, quantityChange: delta,
          referenceType: "STOCKTAKING", referenceId: id, referenceItemId: item.id, transactionDate: today, userId: actor.userId,
        }),
      );
    }
    statements.push(
      this.repos.identity.auditStatement({
        tenantId: actor.tenantId, userId: actor.userId, action: "stocktaking.approved", entityType: "stocktaking_session", entityId: id,
        details: { number: session.sessionNumber, adjustments }, ipAddress: actor.ipAddress,
      }),
    );
    await runAtomic(this.repos, statements);
    return this.get(actor, id);
  }
}
