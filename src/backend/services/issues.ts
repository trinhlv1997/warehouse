import type { IssueReason } from "../../shared/constants";
import type { FefoLinePreviewDto, FefoPreviewDto, IssueDto } from "../../shared/types";
import type { SqlStatement } from "../adapters/db/types";
import { businessDate } from "../domain/dates";
import { AppError } from "../domain/errors";
import { classifyExpiry } from "../domain/expiry";
import { allocationFingerprint, calculateFefoAllocation, type FefoResult } from "../domain/fefo";
import { documentNumber, newId } from "../domain/ids";
import type { Repositories } from "../repositories";
import { ledger, type DocumentFilter } from "../repositories/operations";
import type { Actor } from "./context";
import { runAtomic } from "./tx";

interface PlannedLine {
  product: { id: string; sku: string; name: string; unit: string };
  result: FefoResult;
}

export interface IssueConfirmData {
  requestKey: string;
  issueDate: string;
  recipient: string | null;
  reason: IssueReason;
  notes: string | null;
  lines: { productId: string; quantity: number }[];
  previewFingerprint?: string;
}

/** Outbound workflow with server-side FEFO allocation. */
export class IssueService {
  constructor(
    private readonly repos: Repositories,
    private readonly timezone: string,
  ) {}

  private today() {
    return businessDate(new Date(), this.timezone);
  }

  list(actor: Actor, filter: DocumentFilter) {
    return this.repos.operations.listIssues(actor.tenantId, filter);
  }

  async get(actor: Actor, id: string): Promise<IssueDto> {
    const issue = await this.repos.operations.getIssue(actor.tenantId, id);
    if (!issue) throw new AppError("NOT_FOUND", "Issue not found");
    return { ...issue, items: await this.repos.operations.getIssueItems(actor.tenantId, id) };
  }

  /** Merge duplicate product lines, then run FEFO for each product against live balances. */
  private async plan(actor: Actor, lines: { productId: string; quantity: number }[], today: string): Promise<PlannedLine[]> {
    const merged = new Map<string, number>();
    for (const l of lines) merged.set(l.productId, (merged.get(l.productId) ?? 0) + l.quantity);
    const planned: PlannedLine[] = [];
    for (const [productId, quantity] of merged) {
      const product = await this.repos.catalog.getProduct(actor.tenantId, productId);
      if (!product || product.status === "ARCHIVED") throw new AppError("VALIDATION_ERROR", "Product not found", { productId });
      const candidates = await this.repos.inventory.fefoCandidates(actor.tenantId, productId);
      planned.push({ product, result: calculateFefoAllocation(candidates, quantity, today) });
    }
    return planned;
  }

  private toPreview(planned: PlannedLine[], today: string): FefoPreviewDto {
    const lines: FefoLinePreviewDto[] = planned.map(({ product, result }) => ({
      productId: product.id,
      productSku: product.sku,
      productName: product.name,
      unit: product.unit,
      requestedQuantity: result.requestedQuantity,
      allocatedQuantity: result.allocatedQuantity,
      shortageQuantity: result.shortageQuantity,
      excluded: result.excluded,
      allocations: result.allocations.map((a) => ({
        balanceId: a.balanceId,
        lotId: a.lotId,
        lotNumber: a.lotNumber,
        binId: a.binId,
        locationCode: a.locationCode,
        expirationDate: a.expirationDate,
        daysToExpiry: a.daysToExpiry,
        expiryStatus: classifyExpiry(a.expirationDate, today),
        availableQuantity: a.quantity,
        allocatedQuantity: a.allocatedQuantity,
      })),
    }));
    return {
      lines,
      fulfillable: lines.every((l) => l.shortageQuantity === 0),
      fingerprint: allocationFingerprint(planned.map((p) => ({ productId: p.product.id, result: p.result }))),
      businessDate: today,
    };
  }

  async preview(actor: Actor, lines: { productId: string; quantity: number }[]): Promise<FefoPreviewDto> {
    const today = this.today();
    return this.toPreview(await this.plan(actor, lines, today), today);
  }

  async confirm(actor: Actor, input: IssueConfirmData): Promise<IssueDto> {
    // Idempotency: a retried/double-clicked confirmation returns the original issue.
    const existing = await this.repos.operations.findIssueByRequestKey(actor.tenantId, input.requestKey);
    if (existing) return this.get(actor, existing.id);

    const today = this.today();
    const planned = await this.plan(actor, input.lines, today);
    const preview = this.toPreview(planned, today);
    if (!preview.fulfillable) {
      throw new AppError("INSUFFICIENT_STOCK", "Not enough eligible stock", {
        lines: preview.lines.filter((l) => l.shortageQuantity > 0).map((l) => ({ productSku: l.productSku, requested: l.requestedQuantity, available: l.allocatedQuantity })),
      });
    }
    if (input.previewFingerprint && input.previewFingerprint !== preview.fingerprint) {
      throw new AppError("STOCK_CHANGED", "Stock changed since preview", { preview });
    }

    const warehouse = await this.repos.warehouse.getDefaultWarehouse(actor.tenantId);
    if (!warehouse) throw new AppError("NOT_FOUND", "Warehouse not configured");
    const id = newId();
    const number = documentNumber("PX", today);
    const statements: SqlStatement[] = [
      {
        sql: `INSERT INTO stock_issues (id, tenant_id, warehouse_id, issue_number, request_key, issue_date, recipient, reason, status, notes, created_by, confirmed_by, confirmed_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
        params: [id, actor.tenantId, warehouse.id, number, input.requestKey, input.issueDate, input.recipient, input.reason, input.notes, actor.userId, actor.userId],
      },
    ];
    const guardedLots = new Set<string>();
    for (const { product, result } of planned) {
      for (const a of result.allocations) {
        const itemId = newId();
        if (!guardedLots.has(a.lotId)) {
          statements.push(ledger.assertLotIssuable(actor.tenantId, a.lotId, today));
          guardedLots.add(a.lotId);
        }
        statements.push(
          {
            sql: `INSERT INTO stock_issue_items (id, tenant_id, issue_id, product_id, lot_id, bin_id, quantity, expiration_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            params: [itemId, actor.tenantId, id, product.id, a.lotId, a.binId, a.allocatedQuantity, a.expirationDate],
          },
          // CHECK (quantity >= 0) rolls back everything if a concurrent issue consumed this stock first.
          ledger.decrease(actor.tenantId, a.lotId, a.binId, a.allocatedQuantity),
          ledger.transaction({
            tenantId: actor.tenantId, type: "ISSUE", productId: product.id, lotId: a.lotId, binId: a.binId, quantityChange: -a.allocatedQuantity,
            referenceType: "STOCK_ISSUE", referenceId: id, referenceItemId: itemId, transactionDate: input.issueDate, userId: actor.userId,
          }),
        );
      }
    }
    statements.push(
      this.repos.identity.auditStatement({
        tenantId: actor.tenantId, userId: actor.userId, action: "issue.confirmed", entityType: "stock_issue", entityId: id,
        details: { number, lines: input.lines }, ipAddress: actor.ipAddress,
      }),
    );

    try {
      await runAtomic(this.repos, statements);
    } catch (error) {
      // Lost a race on the same idempotency key: return the winner.
      if (error instanceof AppError && error.code === "DUPLICATE") {
        const winner = await this.repos.operations.findIssueByRequestKey(actor.tenantId, input.requestKey);
        if (winner) return this.get(actor, winner.id);
      }
      throw error;
    }
    return this.get(actor, id);
  }
}
