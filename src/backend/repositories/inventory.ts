import type { LotStatus, TransactionType } from "../../shared/constants";
import type { InventoryTransactionDto, PageMeta } from "../../shared/types";
import type { SqlDatabase } from "../adapters/db/types";
import type { FefoCandidate } from "../domain/fefo";
import { NOW_SQL, Where, likePattern, paginate, type PageRequest } from "./base";

export interface ExpiryRange {
  from: string | null;
  to: string | null;
  noExpiry?: boolean;
}

export interface LotRow {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  unit: string;
  supplierId: string | null;
  supplierName: string | null;
  lotNumber: string;
  manufacturingDate: string | null;
  expirationDate: string | null;
  receivedDate: string;
  status: LotStatus;
  notes: string | null;
  quantity: number;
  locationCount: number;
  locations: string | null;
}

export interface PositionRow {
  balanceId: string;
  productId: string;
  productSku: string;
  productName: string;
  unit: string;
  categoryName: string | null;
  lotId: string;
  lotNumber: string;
  lotStatus: LotStatus;
  manufacturingDate: string | null;
  expirationDate: string | null;
  receivedDate: string;
  binId: string;
  locationCode: string;
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  rackCode: string;
  quantity: number;
}

export interface LotFilter extends PageRequest {
  search?: string;
  productId?: string;
  status?: LotStatus;
  expiry?: ExpiryRange;
  hasStock?: boolean;
}

export interface PositionFilter extends PageRequest {
  search?: string;
  productId?: string;
  lotId?: string;
  zoneId?: string;
  rackId?: string;
  binId?: string;
  lotStatus?: LotStatus;
  expiry?: ExpiryRange;
  expFrom?: string;
  expTo?: string;
  receivedBefore?: string;
  lastIssueBefore?: string;
  orderBy?: "expiry" | "location" | "product";
}

export interface TransactionFilter extends PageRequest {
  productId?: string;
  lotId?: string;
  binId?: string;
  type?: TransactionType;
  from?: string;
  to?: string;
}

/** Lots, balances (product + lot + bin) and the inventory ledger. */
export interface InventoryRepository {
  listLots(tenantId: string, filter: LotFilter): Promise<{ items: LotRow[]; meta: PageMeta }>;
  getLot(tenantId: string, id: string): Promise<LotRow | null>;
  findLot(tenantId: string, productId: string, lotNumber: string): Promise<{ id: string; manufacturingDate: string | null; expirationDate: string | null; status: LotStatus } | null>;
  updateLotStatus(tenantId: string, id: string, status: LotStatus, notes: string | null): Promise<void>;
  listPositions(tenantId: string, filter: PositionFilter): Promise<{ items: PositionRow[]; meta: PageMeta }>;
  getPosition(tenantId: string, lotId: string, binId: string): Promise<PositionRow | null>;
  fefoCandidates(tenantId: string, productId: string): Promise<FefoCandidate[]>;
  listTransactions(tenantId: string, filter: TransactionFilter): Promise<{ items: InventoryTransactionDto[]; meta: PageMeta }>;
}

const POSITION_SELECT = `ib.id AS balanceId, p.id AS productId, p.sku AS productSku, p.name AS productName, p.unit, c.name AS categoryName,
  l.id AS lotId, l.lot_number AS lotNumber, l.status AS lotStatus, l.manufacturing_date AS manufacturingDate, l.expiration_date AS expirationDate,
  l.received_date AS receivedDate, b.id AS binId, b.location_code AS locationCode, z.id AS zoneId, z.code AS zoneCode, z.name AS zoneName,
  r.code AS rackCode, ib.quantity`;

const POSITION_FROM = `FROM inventory_balances ib
  JOIN products p ON p.id = ib.product_id
  LEFT JOIN product_categories c ON c.id = p.category_id
  JOIN inventory_lots l ON l.id = ib.lot_id
  JOIN warehouse_bins b ON b.id = ib.bin_id
  JOIN warehouse_zones z ON z.id = b.zone_id
  JOIN warehouse_racks r ON r.id = b.rack_id`;

function applyExpiry(where: Where, column: string, range?: ExpiryRange) {
  if (!range) return;
  if (range.noExpiry) {
    where.add(`${column} IS NULL`);
    return;
  }
  where.add(`${column} IS NOT NULL`);
  if (range.from) where.add(`${column} >= ?`, range.from);
  if (range.to) where.add(`${column} <= ?`, range.to);
}

export class SqlInventoryRepository implements InventoryRepository {
  constructor(private readonly db: SqlDatabase) {}

  private lotSelect = `l.id, l.product_id AS productId, p.sku AS productSku, p.name AS productName, p.unit, l.supplier_id AS supplierId,
    s.name AS supplierName, l.lot_number AS lotNumber, l.manufacturing_date AS manufacturingDate, l.expiration_date AS expirationDate,
    l.received_date AS receivedDate, l.status, l.notes,
    COALESCE((SELECT SUM(ib.quantity) FROM inventory_balances ib WHERE ib.lot_id = l.id), 0) AS quantity,
    (SELECT COUNT(*) FROM inventory_balances ib WHERE ib.lot_id = l.id AND ib.quantity > 0) AS locationCount,
    (SELECT GROUP_CONCAT(b.location_code) FROM inventory_balances ib JOIN warehouse_bins b ON b.id = ib.bin_id WHERE ib.lot_id = l.id AND ib.quantity > 0) AS locations`;

  private lotFrom = `FROM inventory_lots l JOIN products p ON p.id = l.product_id LEFT JOIN suppliers s ON s.id = l.supplier_id`;

  listLots(tenantId: string, f: LotFilter) {
    const where = new Where()
      .add("l.tenant_id = ?", tenantId)
      .addIf(f.productId, "l.product_id = ?", f.productId ?? null)
      .addIf(f.status, "l.status = ?", f.status ?? null);
    if (f.search) {
      const like = likePattern(f.search);
      where.add("(l.lot_number LIKE ? ESCAPE '\\' OR p.sku LIKE ? ESCAPE '\\' OR p.name LIKE ? ESCAPE '\\')", like, like, like);
    }
    applyExpiry(where, "l.expiration_date", f.expiry);
    if (f.hasStock) where.add("EXISTS (SELECT 1 FROM inventory_balances ib WHERE ib.lot_id = l.id AND ib.quantity > 0)");
    return paginate<LotRow>(this.db, this.lotSelect, `${this.lotFrom} ${where.toSql()}`, where.params, "l.expiration_date IS NULL, l.expiration_date, p.sku, l.lot_number", f);
  }

  getLot(tenantId: string, id: string) {
    return this.db.first<LotRow>(`SELECT ${this.lotSelect} ${this.lotFrom} WHERE l.tenant_id = ? AND l.id = ?`, [tenantId, id]);
  }

  findLot(tenantId: string, productId: string, lotNumber: string) {
    return this.db.first<{ id: string; manufacturingDate: string | null; expirationDate: string | null; status: LotStatus }>(
      `SELECT id, manufacturing_date AS manufacturingDate, expiration_date AS expirationDate, status
         FROM inventory_lots WHERE tenant_id = ? AND product_id = ? AND lot_number = ?`,
      [tenantId, productId, lotNumber],
    );
  }

  async updateLotStatus(tenantId: string, id: string, status: LotStatus, notes: string | null) {
    await this.db.run(`UPDATE inventory_lots SET status = ?, notes = COALESCE(?, notes), updated_at = ${NOW_SQL} WHERE id = ? AND tenant_id = ?`, [status, notes, id, tenantId]);
  }

  listPositions(tenantId: string, f: PositionFilter) {
    const where = new Where()
      .add("ib.tenant_id = ?", tenantId)
      .add("ib.quantity > 0")
      .addIf(f.productId, "ib.product_id = ?", f.productId ?? null)
      .addIf(f.lotId, "ib.lot_id = ?", f.lotId ?? null)
      .addIf(f.binId, "ib.bin_id = ?", f.binId ?? null)
      .addIf(f.zoneId, "b.zone_id = ?", f.zoneId ?? null)
      .addIf(f.rackId, "b.rack_id = ?", f.rackId ?? null)
      .addIf(f.lotStatus, "l.status = ?", f.lotStatus ?? null)
      .addIf(f.expFrom, "l.expiration_date >= ?", f.expFrom ?? null)
      .addIf(f.expTo, "l.expiration_date <= ?", f.expTo ?? null)
      .addIf(f.receivedBefore, "l.received_date <= ?", f.receivedBefore ?? null);
    if (f.lastIssueBefore) {
      where.add(
        `COALESCE((SELECT MAX(t.transaction_date) FROM inventory_transactions t WHERE t.lot_id = l.id AND t.transaction_type = 'ISSUE'), '0000-00-00') <= ?`,
        f.lastIssueBefore,
      );
    }
    if (f.search) {
      const like = likePattern(f.search);
      where.add(
        "(p.sku LIKE ? ESCAPE '\\' OR p.name LIKE ? ESCAPE '\\' OR p.barcode = ? OR l.lot_number LIKE ? ESCAPE '\\' OR b.location_code LIKE ? ESCAPE '\\')",
        like, like, f.search, like, likePattern(f.search.toUpperCase()),
      );
    }
    applyExpiry(where, "l.expiration_date", f.expiry);
    const order =
      f.orderBy === "location" ? "b.location_code, p.sku" : f.orderBy === "product" ? "p.sku, l.expiration_date, b.location_code" : "l.expiration_date IS NULL, l.expiration_date, p.sku, b.location_code";
    return paginate<PositionRow>(this.db, POSITION_SELECT, `${POSITION_FROM} ${where.toSql()}`, where.params, order, f);
  }

  getPosition(tenantId: string, lotId: string, binId: string) {
    return this.db.first<PositionRow>(`SELECT ${POSITION_SELECT} ${POSITION_FROM} WHERE ib.tenant_id = ? AND ib.lot_id = ? AND ib.bin_id = ?`, [tenantId, lotId, binId]);
  }

  async fefoCandidates(tenantId: string, productId: string): Promise<FefoCandidate[]> {
    const rows = await this.db.all<Omit<FefoCandidate, "binActive"> & { binStatus: string }>(
      `SELECT ib.id AS balanceId, l.id AS lotId, l.lot_number AS lotNumber, l.status AS lotStatus, b.id AS binId, b.location_code AS locationCode,
              b.status AS binStatus, l.expiration_date AS expirationDate, l.received_date AS receivedDate, ib.quantity
         FROM inventory_balances ib
         JOIN inventory_lots l ON l.id = ib.lot_id
         JOIN warehouse_bins b ON b.id = ib.bin_id
        WHERE ib.tenant_id = ? AND ib.product_id = ? AND ib.quantity > 0`,
      [tenantId, productId],
    );
    return rows.map(({ binStatus, ...r }) => ({ ...r, binActive: binStatus === "ACTIVE" }));
  }

  listTransactions(tenantId: string, f: TransactionFilter) {
    const where = new Where()
      .add("t.tenant_id = ?", tenantId)
      .addIf(f.productId, "t.product_id = ?", f.productId ?? null)
      .addIf(f.lotId, "t.lot_id = ?", f.lotId ?? null)
      .addIf(f.binId, "t.bin_id = ?", f.binId ?? null)
      .addIf(f.type, "t.transaction_type = ?", f.type ?? null)
      .addIf(f.from, "t.transaction_date >= ?", f.from ?? null)
      .addIf(f.to, "t.transaction_date <= ?", f.to ?? null);
    return paginate<InventoryTransactionDto>(
      this.db,
      `t.id, t.transaction_type AS transactionType, t.product_id AS productId, p.sku AS productSku, p.name AS productName,
       l.lot_number AS lotNumber, b.location_code AS locationCode, t.quantity_change AS quantityChange, t.balance_after AS balanceAfter,
       t.reference_type AS referenceType, t.reference_id AS referenceId,
       COALESCE(sr.receipt_number, si.issue_number, st.transfer_number, ss.session_number) AS referenceNumber,
       t.transaction_date AS transactionDate, u.full_name AS createdByName, t.created_at AS createdAt`,
      `FROM inventory_transactions t
         JOIN products p ON p.id = t.product_id
         JOIN inventory_lots l ON l.id = t.lot_id
         JOIN warehouse_bins b ON b.id = t.bin_id
         LEFT JOIN users u ON u.id = t.created_by
         LEFT JOIN stock_receipts sr ON t.reference_type = 'STOCK_RECEIPT' AND sr.id = t.reference_id
         LEFT JOIN stock_issues si ON t.reference_type = 'STOCK_ISSUE' AND si.id = t.reference_id
         LEFT JOIN stock_transfers st ON t.reference_type = 'STOCK_TRANSFER' AND st.id = t.reference_id
         LEFT JOIN stocktaking_sessions ss ON t.reference_type = 'STOCKTAKING' AND ss.id = t.reference_id
       ${where.toSql()}`,
      where.params,
      "t.created_at DESC, t.id",
      f,
    );
  }
}
