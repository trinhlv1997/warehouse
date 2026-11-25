import type { TransactionType } from "../../shared/constants";
import type {
  IssueDto,
  IssueItemDto,
  PageMeta,
  ReceiptDto,
  ReceiptItemDto,
  StocktakingDto,
  StocktakingItemDto,
  TransferDto,
  TransferItemDto,
} from "../../shared/types";
import type { SqlDatabase, SqlStatement } from "../adapters/db/types";
import { newId } from "../domain/ids";
import { NOW_SQL, Where, likePattern, paginate, type PageRequest } from "./base";

export interface DocumentFilter extends PageRequest {
  search?: string;
  status?: string;
  from?: string;
  to?: string;
}

/**
 * Ledger + balance statement builders. Callers combine them into one atomic batch:
 * the CHECK (quantity >= 0) constraint and the capacity triggers abort the whole batch on violation.
 */
export const ledger = {
  /** Add stock to a lot/bin position, creating the balance row if needed. */
  increase(tenantId: string, productId: string, lotId: string, binId: string, quantity: number): SqlStatement {
    return {
      sql: `INSERT INTO inventory_balances (id, tenant_id, product_id, lot_id, bin_id, quantity) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(lot_id, bin_id) DO UPDATE SET quantity = quantity + excluded.quantity, updated_at = ${NOW_SQL}`,
      params: [newId(), tenantId, productId, lotId, binId, quantity],
    };
  },
  /** Remove stock; a shortfall violates CHECK (quantity >= 0) and rolls back the batch. */
  decrease(tenantId: string, lotId: string, binId: string, quantity: number): SqlStatement {
    return {
      sql: `UPDATE inventory_balances SET quantity = quantity - ?, updated_at = ${NOW_SQL} WHERE tenant_id = ? AND lot_id = ? AND bin_id = ?`,
      params: [quantity, tenantId, lotId, binId],
    };
  },
  /** Fails the batch when the expected balance row does not exist (UPDATE of 0 rows is otherwise silent). */
  assertPositionExists(tenantId: string, lotId: string, binId: string, minQuantity: number): SqlStatement {
    return {
      sql: `INSERT INTO inventory_balances (id, tenant_id, product_id, lot_id, bin_id, quantity)
            SELECT 'guard', ?, 'guard', 'guard', 'guard', -1
             WHERE NOT EXISTS (SELECT 1 FROM inventory_balances WHERE tenant_id = ? AND lot_id = ? AND bin_id = ? AND quantity >= ?)`,
      params: [tenantId, tenantId, lotId, binId, minQuantity],
    };
  },
  /** Fails the batch if the lot became quarantined/blocked/expired after the FEFO plan was computed. */
  assertLotIssuable(tenantId: string, lotId: string, today: string): SqlStatement {
    return {
      sql: `INSERT INTO inventory_balances (id, tenant_id, product_id, lot_id, bin_id, quantity)
            SELECT 'guard', ?, 'guard', 'guard', 'guard', -1
             WHERE EXISTS (SELECT 1 FROM inventory_lots WHERE tenant_id = ? AND id = ?
                             AND (status <> 'AVAILABLE' OR (expiration_date IS NOT NULL AND expiration_date <= ?)))`,
      params: [tenantId, tenantId, lotId, today],
    };
  },
  transaction(input: {
    tenantId: string;
    type: TransactionType;
    productId: string;
    lotId: string;
    binId: string;
    quantityChange: number;
    referenceType: "STOCK_RECEIPT" | "STOCK_ISSUE" | "STOCK_TRANSFER" | "STOCKTAKING";
    referenceId: string;
    referenceItemId: string;
    transactionDate: string;
    userId: string | null;
  }): SqlStatement {
    return {
      sql: `INSERT INTO inventory_transactions (id, tenant_id, transaction_type, product_id, lot_id, bin_id, quantity_change, balance_after,
              reference_type, reference_id, reference_item_id, transaction_date, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT quantity FROM inventory_balances WHERE lot_id = ? AND bin_id = ?), ?, ?, ?, ?, ?)`,
      params: [
        newId(), input.tenantId, input.type, input.productId, input.lotId, input.binId, input.quantityChange, input.lotId, input.binId,
        input.referenceType, input.referenceId, input.referenceItemId, input.transactionDate, input.userId,
      ],
    };
  },
};

/** Stock documents: receipts, issues, transfers and stocktaking sessions. */
export interface OperationsRepository {
  listReceipts(tenantId: string, filter: DocumentFilter): Promise<{ items: ReceiptDto[]; meta: PageMeta }>;
  getReceipt(tenantId: string, id: string): Promise<ReceiptDto | null>;
  getReceiptItems(tenantId: string, receiptId: string): Promise<ReceiptItemDto[]>;
  listIssues(tenantId: string, filter: DocumentFilter): Promise<{ items: IssueDto[]; meta: PageMeta }>;
  getIssue(tenantId: string, id: string): Promise<IssueDto | null>;
  findIssueByRequestKey(tenantId: string, requestKey: string): Promise<{ id: string } | null>;
  getIssueItems(tenantId: string, issueId: string): Promise<IssueItemDto[]>;
  listTransfers(tenantId: string, filter: DocumentFilter): Promise<{ items: TransferDto[]; meta: PageMeta }>;
  getTransfer(tenantId: string, id: string): Promise<TransferDto | null>;
  getTransferItems(tenantId: string, transferId: string): Promise<TransferItemDto[]>;
  listStocktaking(tenantId: string, filter: DocumentFilter): Promise<{ items: StocktakingDto[]; meta: PageMeta }>;
  getStocktaking(tenantId: string, id: string): Promise<StocktakingDto | null>;
  getStocktakingItems(tenantId: string, sessionId: string, onlyDiscrepancies?: boolean): Promise<StocktakingItemDto[]>;
  execute(statements: SqlStatement[]): Promise<void>;
}

function docWhere(alias: string, tenantId: string, f: DocumentFilter, numberColumn: string, dateColumn: string, extraSearch: string[] = []) {
  const where = new Where()
    .add(`${alias}.tenant_id = ?`, tenantId)
    .addIf(f.status, `${alias}.status = ?`, f.status ?? null)
    .addIf(f.from, `${alias}.${dateColumn} >= ?`, f.from ?? null)
    .addIf(f.to, `${alias}.${dateColumn} <= ?`, f.to ?? null);
  if (f.search) {
    const cols = [`${alias}.${numberColumn}`, ...extraSearch];
    where.add(`(${cols.map((c) => `${c} LIKE ? ESCAPE '\\'`).join(" OR ")})`, ...cols.map(() => likePattern(f.search!)));
  }
  return where;
}

const RECEIPT_SELECT = `r.id, r.receipt_number AS receiptNumber, r.supplier_id AS supplierId, s.name AS supplierName, r.receipt_date AS receiptDate,
  r.reference_no AS referenceNo, r.status, r.notes, r.confirmed_at AS confirmedAt, r.created_at AS createdAt,
  cu.full_name AS createdByName, fu.full_name AS confirmedByName,
  COALESCE((SELECT SUM(i.quantity) FROM stock_receipt_items i WHERE i.receipt_id = r.id), 0) AS totalQuantity,
  (SELECT COUNT(*) FROM stock_receipt_items i WHERE i.receipt_id = r.id) AS itemCount`;
const RECEIPT_FROM = `FROM stock_receipts r LEFT JOIN suppliers s ON s.id = r.supplier_id
  LEFT JOIN users cu ON cu.id = r.created_by LEFT JOIN users fu ON fu.id = r.confirmed_by`;

const ISSUE_SELECT = `i.id, i.issue_number AS issueNumber, i.issue_date AS issueDate, i.recipient, i.reason, i.status, i.notes,
  i.confirmed_at AS confirmedAt, i.created_at AS createdAt, cu.full_name AS createdByName,
  COALESCE((SELECT SUM(x.quantity) FROM stock_issue_items x WHERE x.issue_id = i.id), 0) AS totalQuantity,
  (SELECT COUNT(*) FROM stock_issue_items x WHERE x.issue_id = i.id) AS itemCount`;
const ISSUE_FROM = `FROM stock_issues i LEFT JOIN users cu ON cu.id = i.created_by`;

const TRANSFER_SELECT = `t.id, t.transfer_number AS transferNumber, t.transfer_date AS transferDate, t.status, t.reason, t.notes,
  t.confirmed_at AS confirmedAt, t.created_at AS createdAt, cu.full_name AS createdByName, fu.full_name AS confirmedByName,
  COALESCE((SELECT SUM(x.quantity) FROM stock_transfer_items x WHERE x.transfer_id = t.id), 0) AS totalQuantity,
  (SELECT COUNT(*) FROM stock_transfer_items x WHERE x.transfer_id = t.id) AS itemCount`;
const TRANSFER_FROM = `FROM stock_transfers t LEFT JOIN users cu ON cu.id = t.created_by LEFT JOIN users fu ON fu.id = t.confirmed_by`;

const STOCKTAKING_SELECT = `s.id, s.session_number AS sessionNumber, s.scope_type AS scopeType, s.scope_ids AS scopeIds, s.status, s.notes,
  s.approved_at AS approvedAt, s.created_at AS createdAt, cu.full_name AS createdByName, au.full_name AS approvedByName,
  (SELECT COUNT(*) FROM stocktaking_items x WHERE x.session_id = s.id) AS itemCount,
  (SELECT COUNT(*) FROM stocktaking_items x WHERE x.session_id = s.id AND x.counted_quantity IS NOT NULL) AS countedCount,
  (SELECT COUNT(*) FROM stocktaking_items x WHERE x.session_id = s.id AND x.counted_quantity IS NOT NULL AND x.counted_quantity <> x.system_quantity) AS discrepancyCount,
  CASE s.scope_type
    WHEN 'ALL' THEN ''
    WHEN 'ZONE' THEN (SELECT GROUP_CONCAT(z.code) FROM warehouse_zones z WHERE s.scope_ids LIKE '%"' || z.id || '"%')
    ELSE (SELECT GROUP_CONCAT(z.code || '-' || r.code) FROM warehouse_racks r JOIN warehouse_zones z ON z.id = r.zone_id WHERE s.scope_ids LIKE '%"' || r.id || '"%')
  END AS scopeLabel`;
const STOCKTAKING_FROM = `FROM stocktaking_sessions s LEFT JOIN users cu ON cu.id = s.created_by LEFT JOIN users au ON au.id = s.approved_by`;

type StocktakingRaw = Omit<StocktakingDto, "scopeIds"> & { scopeIds: string };
const mapStocktaking = (r: StocktakingRaw): StocktakingDto => ({ ...r, scopeIds: JSON.parse(r.scopeIds || "[]"), scopeLabel: r.scopeLabel ?? "" });

export class SqlOperationsRepository implements OperationsRepository {
  constructor(private readonly db: SqlDatabase) {}

  listReceipts(tenantId: string, f: DocumentFilter) {
    const where = docWhere("r", tenantId, f, "receipt_number", "receipt_date", ["s.name", "r.reference_no"]);
    return paginate<ReceiptDto>(this.db, RECEIPT_SELECT, `${RECEIPT_FROM} ${where.toSql()}`, where.params, "r.created_at DESC", f);
  }

  getReceipt(tenantId: string, id: string) {
    return this.db.first<ReceiptDto>(`SELECT ${RECEIPT_SELECT} ${RECEIPT_FROM} WHERE r.tenant_id = ? AND r.id = ?`, [tenantId, id]);
  }

  getReceiptItems(tenantId: string, receiptId: string) {
    return this.db.all<ReceiptItemDto>(
      `SELECT i.id, i.product_id AS productId, p.sku AS productSku, p.name AS productName, p.unit, i.lot_id AS lotId, i.lot_number AS lotNumber,
              i.manufacturing_date AS manufacturingDate, i.expiration_date AS expirationDate, i.bin_id AS binId, b.location_code AS locationCode, i.quantity
         FROM stock_receipt_items i JOIN products p ON p.id = i.product_id JOIN warehouse_bins b ON b.id = i.bin_id
        WHERE i.tenant_id = ? AND i.receipt_id = ? ORDER BY i.created_at, i.id`,
      [tenantId, receiptId],
    );
  }

  listIssues(tenantId: string, f: DocumentFilter) {
    const where = docWhere("i", tenantId, f, "issue_number", "issue_date", ["i.recipient"]);
    return paginate<IssueDto>(this.db, ISSUE_SELECT, `${ISSUE_FROM} ${where.toSql()}`, where.params, "i.created_at DESC", f);
  }

  getIssue(tenantId: string, id: string) {
    return this.db.first<IssueDto>(`SELECT ${ISSUE_SELECT} ${ISSUE_FROM} WHERE i.tenant_id = ? AND i.id = ?`, [tenantId, id]);
  }

  findIssueByRequestKey(tenantId: string, requestKey: string) {
    return this.db.first<{ id: string }>("SELECT id FROM stock_issues WHERE tenant_id = ? AND request_key = ?", [tenantId, requestKey]);
  }

  getIssueItems(tenantId: string, issueId: string) {
    return this.db.all<IssueItemDto>(
      `SELECT x.id, x.product_id AS productId, p.sku AS productSku, p.name AS productName, p.unit, x.lot_id AS lotId, l.lot_number AS lotNumber,
              x.bin_id AS binId, b.location_code AS locationCode, x.expiration_date AS expirationDate, x.quantity
         FROM stock_issue_items x JOIN products p ON p.id = x.product_id JOIN inventory_lots l ON l.id = x.lot_id JOIN warehouse_bins b ON b.id = x.bin_id
        WHERE x.tenant_id = ? AND x.issue_id = ? ORDER BY p.sku, x.expiration_date, b.location_code`,
      [tenantId, issueId],
    );
  }

  listTransfers(tenantId: string, f: DocumentFilter) {
    const where = docWhere("t", tenantId, f, "transfer_number", "transfer_date", ["t.reason"]);
    return paginate<TransferDto>(this.db, TRANSFER_SELECT, `${TRANSFER_FROM} ${where.toSql()}`, where.params, "t.created_at DESC", f);
  }

  getTransfer(tenantId: string, id: string) {
    return this.db.first<TransferDto>(`SELECT ${TRANSFER_SELECT} ${TRANSFER_FROM} WHERE t.tenant_id = ? AND t.id = ?`, [tenantId, id]);
  }

  getTransferItems(tenantId: string, transferId: string) {
    return this.db.all<TransferItemDto>(
      `SELECT x.id, x.product_id AS productId, p.sku AS productSku, p.name AS productName, p.unit, x.lot_id AS lotId, l.lot_number AS lotNumber,
              x.from_bin_id AS fromBinId, fb.location_code AS fromLocationCode, x.to_bin_id AS toBinId, tb.location_code AS toLocationCode, x.quantity
         FROM stock_transfer_items x JOIN products p ON p.id = x.product_id JOIN inventory_lots l ON l.id = x.lot_id
         JOIN warehouse_bins fb ON fb.id = x.from_bin_id JOIN warehouse_bins tb ON tb.id = x.to_bin_id
        WHERE x.tenant_id = ? AND x.transfer_id = ? ORDER BY x.created_at, x.id`,
      [tenantId, transferId],
    );
  }

  async listStocktaking(tenantId: string, f: DocumentFilter) {
    const where = docWhere("s", tenantId, f, "session_number", "created_at");
    const res = await paginate<StocktakingRaw>(this.db, STOCKTAKING_SELECT, `${STOCKTAKING_FROM} ${where.toSql()}`, where.params, "s.created_at DESC", f);
    return { items: res.items.map(mapStocktaking), meta: res.meta };
  }

  async getStocktaking(tenantId: string, id: string) {
    const row = await this.db.first<StocktakingRaw>(`SELECT ${STOCKTAKING_SELECT} ${STOCKTAKING_FROM} WHERE s.tenant_id = ? AND s.id = ?`, [tenantId, id]);
    return row ? mapStocktaking(row) : null;
  }

  getStocktakingItems(tenantId: string, sessionId: string, onlyDiscrepancies = false) {
    return this.db.all<StocktakingItemDto>(
      `SELECT x.id, x.product_id AS productId, p.sku AS productSku, p.name AS productName, p.unit, x.lot_id AS lotId, l.lot_number AS lotNumber,
              l.expiration_date AS expirationDate, x.bin_id AS binId, b.location_code AS locationCode, x.system_quantity AS systemQuantity,
              x.counted_quantity AS countedQuantity,
              CASE WHEN x.counted_quantity IS NULL THEN NULL ELSE x.counted_quantity - x.system_quantity END AS difference,
              u.full_name AS countedByName, x.counted_at AS countedAt, x.notes
         FROM stocktaking_items x JOIN products p ON p.id = x.product_id JOIN inventory_lots l ON l.id = x.lot_id
         JOIN warehouse_bins b ON b.id = x.bin_id LEFT JOIN users u ON u.id = x.counted_by
        WHERE x.tenant_id = ? AND x.session_id = ? ${onlyDiscrepancies ? "AND x.counted_quantity IS NOT NULL AND x.counted_quantity <> x.system_quantity" : ""}
        ORDER BY b.location_code, p.sku, l.lot_number`,
      [tenantId, sessionId],
    );
  }

  async execute(statements: SqlStatement[]) {
    await this.db.batch(statements);
  }
}
