import type { SqlDatabase, SqlValue } from "../adapters/db/types";
import { Where } from "./base";

export interface ReportFilter {
  from?: string;
  to?: string;
  productId?: string;
  zoneId?: string;
  categoryId?: string;
  expFrom?: string;
  expTo?: string;
}

type Row = Record<string, string | number | null>;

/** Read-only aggregate queries for the dashboard and reports. */
export interface ReportRepository {
  dashboardTotals(tenantId: string, expiringFrom: string, expiringTo: string, today: string): Promise<Record<string, number>>;
  quantityByCategory(tenantId: string): Promise<{ name: string; quantity: number }[]>;
  quantityByZone(tenantId: string): Promise<{ code: string; name: string; quantity: number; capacity: number }[]>;
  dailyMovements(tenantId: string, from: string): Promise<{ date: string; inbound: number; outbound: number }[]>;
  expiryDates(tenantId: string): Promise<{ expirationDate: string | null; quantity: number; lots: number }[]>;
  binUsage(tenantId: string): Promise<{ capacity: number; used: number; status: string }[]>;
  lowStock(tenantId: string, limit: number): Promise<{ id: string; sku: string; name: string; unit: string; quantity: number; minStock: number }[]>;
  run(tenantId: string, type: string, filter: ReportFilter): Promise<Row[]>;
}

export class SqlReportRepository implements ReportRepository {
  constructor(private readonly db: SqlDatabase) {}

  async dashboardTotals(tenantId: string, expiringFrom: string, expiringTo: string, today: string) {
    const row = await this.db.first<Record<string, number>>(
      `SELECT
         COALESCE((SELECT SUM(quantity) FROM inventory_balances WHERE tenant_id = ?), 0) AS quantity,
         (SELECT COUNT(*) FROM products WHERE tenant_id = ? AND status <> 'ARCHIVED') AS skuCount,
         (SELECT COUNT(*) FROM product_categories WHERE tenant_id = ? AND deleted_at IS NULL) AS categoryCount,
         (SELECT COUNT(DISTINCT lot_id) FROM inventory_balances WHERE tenant_id = ? AND quantity > 0) AS lotCount,
         (SELECT COUNT(*) FROM warehouse_bins WHERE tenant_id = ? AND status = 'ACTIVE') AS binCount,
         COALESCE((SELECT SUM(capacity) FROM warehouse_bins WHERE tenant_id = ? AND status = 'ACTIVE'), 0) AS capacity,
         COALESCE((SELECT SUM(ib.quantity) FROM inventory_balances ib JOIN inventory_lots l ON l.id = ib.lot_id
                    WHERE ib.tenant_id = ? AND l.expiration_date >= ? AND l.expiration_date <= ?), 0) AS expiringSoonQuantity,
         (SELECT COUNT(DISTINCT ib.lot_id) FROM inventory_balances ib JOIN inventory_lots l ON l.id = ib.lot_id
                    WHERE ib.tenant_id = ? AND ib.quantity > 0 AND l.expiration_date >= ? AND l.expiration_date <= ?) AS expiringSoonLots,
         COALESCE((SELECT SUM(ib.quantity) FROM inventory_balances ib JOIN inventory_lots l ON l.id = ib.lot_id
                    WHERE ib.tenant_id = ? AND l.expiration_date <= ?), 0) AS expiredQuantity,
         (SELECT COUNT(DISTINCT ib.lot_id) FROM inventory_balances ib JOIN inventory_lots l ON l.id = ib.lot_id
                    WHERE ib.tenant_id = ? AND ib.quantity > 0 AND l.expiration_date <= ?) AS expiredLots,
         (SELECT COUNT(*) FROM products p WHERE p.tenant_id = ? AND p.status = 'ACTIVE' AND p.min_stock > 0
            AND COALESCE((SELECT SUM(quantity) FROM inventory_balances WHERE product_id = p.id), 0) < p.min_stock) AS lowStockProducts`,
      [tenantId, tenantId, tenantId, tenantId, tenantId, tenantId, tenantId, expiringFrom, expiringTo, tenantId, expiringFrom, expiringTo, tenantId, today, tenantId, today, tenantId],
    );
    return row ?? {};
  }

  quantityByCategory(tenantId: string) {
    return this.db.all<{ name: string; quantity: number }>(
      `SELECT COALESCE(c.name, '—') AS name, SUM(ib.quantity) AS quantity
         FROM inventory_balances ib JOIN products p ON p.id = ib.product_id LEFT JOIN product_categories c ON c.id = p.category_id
        WHERE ib.tenant_id = ? AND ib.quantity > 0 GROUP BY c.id, c.name ORDER BY quantity DESC`,
      [tenantId],
    );
  }

  quantityByZone(tenantId: string) {
    return this.db.all<{ code: string; name: string; quantity: number; capacity: number }>(
      `SELECT z.code, z.name,
              COALESCE((SELECT SUM(ib.quantity) FROM inventory_balances ib JOIN warehouse_bins b ON b.id = ib.bin_id WHERE b.zone_id = z.id), 0) AS quantity,
              COALESCE((SELECT SUM(b.capacity) FROM warehouse_bins b WHERE b.zone_id = z.id AND b.status = 'ACTIVE'), 0) AS capacity
         FROM warehouse_zones z WHERE z.tenant_id = ? AND z.deleted_at IS NULL ORDER BY z.code`,
      [tenantId],
    );
  }

  dailyMovements(tenantId: string, from: string) {
    return this.db.all<{ date: string; inbound: number; outbound: number }>(
      `SELECT transaction_date AS date,
              SUM(CASE WHEN transaction_type = 'RECEIPT' THEN quantity_change ELSE 0 END) AS inbound,
              SUM(CASE WHEN transaction_type = 'ISSUE' THEN -quantity_change ELSE 0 END) AS outbound
         FROM inventory_transactions WHERE tenant_id = ? AND transaction_date >= ? AND transaction_type IN ('RECEIPT', 'ISSUE')
        GROUP BY transaction_date ORDER BY transaction_date`,
      [tenantId, from],
    );
  }

  expiryDates(tenantId: string) {
    return this.db.all<{ expirationDate: string | null; quantity: number; lots: number }>(
      `SELECT l.expiration_date AS expirationDate, SUM(ib.quantity) AS quantity, COUNT(DISTINCT l.id) AS lots
         FROM inventory_balances ib JOIN inventory_lots l ON l.id = ib.lot_id
        WHERE ib.tenant_id = ? AND ib.quantity > 0 GROUP BY l.expiration_date`,
      [tenantId],
    );
  }

  binUsage(tenantId: string) {
    return this.db.all<{ capacity: number; used: number; status: string }>(
      `SELECT b.capacity, b.status, COALESCE((SELECT SUM(ib.quantity) FROM inventory_balances ib WHERE ib.bin_id = b.id), 0) AS used
         FROM warehouse_bins b WHERE b.tenant_id = ?`,
      [tenantId],
    );
  }

  lowStock(tenantId: string, limit: number) {
    return this.db.all<{ id: string; sku: string; name: string; unit: string; quantity: number; minStock: number }>(
      `SELECT * FROM (
         SELECT p.id, p.sku, p.name, p.unit, p.min_stock AS minStock,
                COALESCE((SELECT SUM(quantity) FROM inventory_balances WHERE product_id = p.id), 0) AS quantity
           FROM products p WHERE p.tenant_id = ? AND p.status = 'ACTIVE' AND p.min_stock > 0) t
        WHERE quantity < minStock ORDER BY CAST(quantity AS REAL) / minStock LIMIT ?`,
      [tenantId, limit],
    );
  }

  async run(tenantId: string, type: string, f: ReportFilter): Promise<Row[]> {
    const where = new Where();
    const params: SqlValue[] = [];
    const q = (sql: string) => this.db.all<Row>(sql, [...params, ...where.params]);

    switch (type) {
      case "inventory":
      case "expiring":
      case "expired": {
        where.add("ib.tenant_id = ?", tenantId).add("ib.quantity > 0");
        where.addIf(f.productId, "ib.product_id = ?", f.productId ?? null).addIf(f.zoneId, "b.zone_id = ?", f.zoneId ?? null);
        where.addIf(f.categoryId, "p.category_id = ?", f.categoryId ?? null);
        where.addIf(f.expFrom, "l.expiration_date >= ?", f.expFrom ?? null).addIf(f.expTo, "l.expiration_date <= ?", f.expTo ?? null);
        return q(
          `SELECT p.sku, p.name AS productName, c.name AS categoryName, p.unit, l.lot_number AS lotNumber, l.manufacturing_date AS manufacturingDate,
                  l.expiration_date AS expirationDate, l.status AS lotStatus, b.location_code AS locationCode, z.name AS zoneName, ib.quantity
             FROM inventory_balances ib JOIN products p ON p.id = ib.product_id LEFT JOIN product_categories c ON c.id = p.category_id
             JOIN inventory_lots l ON l.id = ib.lot_id JOIN warehouse_bins b ON b.id = ib.bin_id JOIN warehouse_zones z ON z.id = b.zone_id
             ${where.toSql()} ORDER BY ${type === "inventory" ? "p.sku, l.expiration_date, b.location_code" : "l.expiration_date, p.sku"}`,
        );
      }
      case "product": {
        where.add("p.tenant_id = ?", tenantId).add("p.status <> 'ARCHIVED'");
        where.addIf(f.categoryId, "p.category_id = ?", f.categoryId ?? null).addIf(f.productId, "p.id = ?", f.productId ?? null);
        return q(
          `SELECT p.sku, p.name AS productName, c.name AS categoryName, p.unit, p.min_stock AS minStock, p.max_stock AS maxStock,
                  COALESCE((SELECT SUM(quantity) FROM inventory_balances WHERE product_id = p.id), 0) AS quantity,
                  (SELECT COUNT(DISTINCT lot_id) FROM inventory_balances WHERE product_id = p.id AND quantity > 0) AS lotCount,
                  (SELECT COUNT(DISTINCT bin_id) FROM inventory_balances WHERE product_id = p.id AND quantity > 0) AS locationCount,
                  (SELECT MIN(l.expiration_date) FROM inventory_lots l JOIN inventory_balances ib ON ib.lot_id = l.id WHERE l.product_id = p.id AND ib.quantity > 0) AS nearestExpiry
             FROM products p LEFT JOIN product_categories c ON c.id = p.category_id ${where.toSql()} ORDER BY p.sku`,
        );
      }
      case "lot": {
        where.add("l.tenant_id = ?", tenantId).addIf(f.productId, "l.product_id = ?", f.productId ?? null);
        where.addIf(f.expFrom, "l.expiration_date >= ?", f.expFrom ?? null).addIf(f.expTo, "l.expiration_date <= ?", f.expTo ?? null);
        return q(
          `SELECT l.lot_number AS lotNumber, p.sku, p.name AS productName, p.unit, s.name AS supplierName, l.manufacturing_date AS manufacturingDate,
                  l.expiration_date AS expirationDate, l.received_date AS receivedDate, l.status AS lotStatus,
                  COALESCE((SELECT SUM(quantity) FROM inventory_balances WHERE lot_id = l.id), 0) AS quantity
             FROM inventory_lots l JOIN products p ON p.id = l.product_id LEFT JOIN suppliers s ON s.id = l.supplier_id
             ${where.toSql()} ORDER BY l.expiration_date IS NULL, l.expiration_date, p.sku`,
        );
      }
      case "location": {
        where.add("b.tenant_id = ?", tenantId).addIf(f.zoneId, "b.zone_id = ?", f.zoneId ?? null);
        return q(
          `SELECT b.location_code AS locationCode, z.name AS zoneName, b.capacity, b.status,
                  COALESCE((SELECT SUM(quantity) FROM inventory_balances WHERE bin_id = b.id), 0) AS quantity,
                  (SELECT COUNT(*) FROM inventory_balances WHERE bin_id = b.id AND quantity > 0) AS lotCount
             FROM warehouse_bins b JOIN warehouse_zones z ON z.id = b.zone_id ${where.toSql()} ORDER BY b.location_code`,
        );
      }
      case "receipts": {
        where.add("r.tenant_id = ?", tenantId).add("r.status = 'CONFIRMED'");
        where.addIf(f.from, "r.receipt_date >= ?", f.from ?? null).addIf(f.to, "r.receipt_date <= ?", f.to ?? null);
        where.addIf(f.productId, "i.product_id = ?", f.productId ?? null);
        return q(
          `SELECT r.receipt_number AS documentNumber, r.receipt_date AS documentDate, s.name AS supplierName, p.sku, p.name AS productName, p.unit,
                  i.lot_number AS lotNumber, i.expiration_date AS expirationDate, b.location_code AS locationCode, i.quantity, u.full_name AS userName
             FROM stock_receipt_items i JOIN stock_receipts r ON r.id = i.receipt_id JOIN products p ON p.id = i.product_id
             JOIN warehouse_bins b ON b.id = i.bin_id LEFT JOIN suppliers s ON s.id = r.supplier_id LEFT JOIN users u ON u.id = r.confirmed_by
             ${where.toSql()} ORDER BY r.receipt_date DESC, r.receipt_number`,
        );
      }
      case "issues": {
        where.add("x.tenant_id = ?", tenantId).add("i.status = 'CONFIRMED'");
        where.addIf(f.from, "i.issue_date >= ?", f.from ?? null).addIf(f.to, "i.issue_date <= ?", f.to ?? null);
        where.addIf(f.productId, "x.product_id = ?", f.productId ?? null);
        return q(
          `SELECT i.issue_number AS documentNumber, i.issue_date AS documentDate, i.recipient, i.reason, p.sku, p.name AS productName, p.unit,
                  l.lot_number AS lotNumber, x.expiration_date AS expirationDate, b.location_code AS locationCode, x.quantity, u.full_name AS userName
             FROM stock_issue_items x JOIN stock_issues i ON i.id = x.issue_id JOIN products p ON p.id = x.product_id
             JOIN inventory_lots l ON l.id = x.lot_id JOIN warehouse_bins b ON b.id = x.bin_id LEFT JOIN users u ON u.id = i.created_by
             ${where.toSql()} ORDER BY i.issue_date DESC, i.issue_number`,
        );
      }
      case "transfers": {
        where.add("x.tenant_id = ?", tenantId).add("t.status = 'CONFIRMED'");
        where.addIf(f.from, "t.transfer_date >= ?", f.from ?? null).addIf(f.to, "t.transfer_date <= ?", f.to ?? null);
        return q(
          `SELECT t.transfer_number AS documentNumber, t.transfer_date AS documentDate, p.sku, p.name AS productName, l.lot_number AS lotNumber,
                  fb.location_code AS fromLocation, tb.location_code AS toLocation, x.quantity, t.reason, u.full_name AS userName
             FROM stock_transfer_items x JOIN stock_transfers t ON t.id = x.transfer_id JOIN products p ON p.id = x.product_id
             JOIN inventory_lots l ON l.id = x.lot_id JOIN warehouse_bins fb ON fb.id = x.from_bin_id JOIN warehouse_bins tb ON tb.id = x.to_bin_id
             LEFT JOIN users u ON u.id = t.confirmed_by
             ${where.toSql()} ORDER BY t.transfer_date DESC, t.transfer_number`,
        );
      }
      case "stocktaking": {
        where.add("x.tenant_id = ?", tenantId).add("x.counted_quantity IS NOT NULL");
        where.addIf(f.from, "substr(s.created_at, 1, 10) >= ?", f.from ?? null).addIf(f.to, "substr(s.created_at, 1, 10) <= ?", f.to ?? null);
        return q(
          `SELECT s.session_number AS documentNumber, substr(s.created_at, 1, 10) AS documentDate, s.status, p.sku, p.name AS productName,
                  l.lot_number AS lotNumber, b.location_code AS locationCode, x.system_quantity AS systemQuantity, x.counted_quantity AS countedQuantity,
                  x.counted_quantity - x.system_quantity AS difference
             FROM stocktaking_items x JOIN stocktaking_sessions s ON s.id = x.session_id JOIN products p ON p.id = x.product_id
             JOIN inventory_lots l ON l.id = x.lot_id JOIN warehouse_bins b ON b.id = x.bin_id
             ${where.toSql()} ORDER BY s.created_at DESC, b.location_code`,
        );
      }
      default:
        return [];
    }
  }
}
