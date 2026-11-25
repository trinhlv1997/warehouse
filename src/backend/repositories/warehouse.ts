import type { ActiveStatus, ZoneType } from "../../shared/constants";
import type { PageMeta, WarehouseDto } from "../../shared/types";
import type { SqlDatabase, SqlStatement } from "../adapters/db/types";
import { newId } from "../domain/ids";
import { binCode, buildLocationCode, levelCode } from "../domain/location";
import { NOW_SQL, Where, likePattern, paginate, type PageRequest } from "./base";

export interface CapacityRow {
  capacity: number;
  used: number;
}

export interface ZoneRow extends CapacityRow {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  zoneType: ZoneType;
  description: string | null;
  status: ActiveStatus;
  mapX: number;
  mapY: number;
  mapWidth: number;
  mapHeight: number;
  rackCount: number;
  binCount: number;
}

export interface RackRow extends CapacityRow {
  id: string;
  zoneId: string;
  zoneCode: string;
  code: string;
  name: string;
  status: ActiveStatus;
  levelCount: number;
  binCount: number;
}

export interface LevelRow extends CapacityRow {
  id: string;
  rackId: string;
  code: string;
  levelNumber: number;
  status: ActiveStatus;
}

export interface BinRow extends CapacityRow {
  id: string;
  zoneId: string;
  rackId: string;
  levelId: string;
  code: string;
  locationCode: string;
  status: ActiveStatus;
  lotCount: number;
  productCount: number;
  zoneCode: string;
  zoneName: string;
  rackCode: string;
  levelCode: string;
}

export interface ZoneInputData {
  warehouseId: string;
  code: string;
  name: string;
  zoneType: ZoneType;
  description: string | null;
  status: ActiveStatus;
  mapX: number;
  mapY: number;
  mapWidth: number;
  mapHeight: number;
}

/** Zone input as received from the API: map position/size may be omitted (auto-placed). */
export type ZoneInputRequest = Omit<ZoneInputData, "mapX" | "mapY" | "mapWidth" | "mapHeight"> & Partial<Pick<ZoneInputData, "mapX" | "mapY" | "mapWidth" | "mapHeight">>;

export interface BinFilter extends PageRequest {
  search?: string;
  zoneId?: string;
  rackId?: string;
  status?: ActiveStatus;
  occupancy?: "EMPTY" | "OCCUPIED" | "NEAR_CAPACITY" | "FULL";
  nearThreshold: number;
}

/** Warehouse > Zone > Rack > Level > Bin persistence. */
export interface WarehouseRepository {
  listWarehouses(tenantId: string): Promise<WarehouseDto[]>;
  getDefaultWarehouse(tenantId: string): Promise<WarehouseDto | null>;
  /** Renaming the code rewrites every bin location code of the warehouse in the same atomic batch. */
  updateWarehouse(tenantId: string, id: string, input: { code: string; name: string; address: string | null }): Promise<void>;
  listZones(tenantId: string): Promise<ZoneRow[]>;
  getZone(tenantId: string, id: string): Promise<ZoneRow | null>;
  createZone(tenantId: string, input: ZoneInputData): Promise<string>;
  updateZone(tenantId: string, id: string, input: ZoneInputData): Promise<void>;
  zoneHasRacks(tenantId: string, id: string): Promise<boolean>;
  deleteZone(tenantId: string, id: string): Promise<void>;
  listRacks(tenantId: string, zoneId?: string): Promise<RackRow[]>;
  getRack(tenantId: string, id: string): Promise<RackRow | null>;
  createRackWithBins(tenantId: string, input: { zoneId: string; code: string; name: string; levelCount: number; binsPerLevel: number; binCapacity: number }): Promise<string>;
  updateRack(tenantId: string, id: string, name: string, status: ActiveStatus): Promise<void>;
  rackHasHistory(tenantId: string, id: string): Promise<boolean>;
  deleteRack(tenantId: string, id: string): Promise<void>;
  listLevels(tenantId: string, rackId: string): Promise<LevelRow[]>;
  listBinsByRack(tenantId: string, rackId: string): Promise<BinRow[]>;
  listBins(tenantId: string, filter: BinFilter): Promise<{ items: BinRow[]; meta: PageMeta }>;
  listBinOptions(tenantId: string, search?: string): Promise<{ id: string; locationCode: string; capacity: number; used: number; status: ActiveStatus }[]>;
  getBin(tenantId: string, id: string): Promise<BinRow | null>;
  updateBin(tenantId: string, id: string, capacity: number, status: ActiveStatus): Promise<void>;
}

const BIN_SELECT = `b.id, b.zone_id AS zoneId, b.rack_id AS rackId, b.level_id AS levelId, b.code, b.location_code AS locationCode,
  b.capacity, b.status, z.code AS zoneCode, z.name AS zoneName, r.code AS rackCode, l.code AS levelCode,
  COALESCE((SELECT SUM(ib.quantity) FROM inventory_balances ib WHERE ib.bin_id = b.id), 0) AS used,
  (SELECT COUNT(*) FROM inventory_balances ib WHERE ib.bin_id = b.id AND ib.quantity > 0) AS lotCount,
  (SELECT COUNT(DISTINCT ib.product_id) FROM inventory_balances ib WHERE ib.bin_id = b.id AND ib.quantity > 0) AS productCount`;

const BIN_FROM = `FROM warehouse_bins b
  JOIN warehouse_zones z ON z.id = b.zone_id
  JOIN warehouse_racks r ON r.id = b.rack_id
  JOIN warehouse_levels l ON l.id = b.level_id`;

export class SqlWarehouseRepository implements WarehouseRepository {
  constructor(private readonly db: SqlDatabase) {}

  listWarehouses(tenantId: string) {
    return this.db.all<WarehouseDto>(
      "SELECT id, code, name, address, status FROM warehouses WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY code",
      [tenantId],
    );
  }

  getDefaultWarehouse(tenantId: string) {
    return this.db.first<WarehouseDto>(
      "SELECT id, code, name, address, status FROM warehouses WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY created_at, code LIMIT 1",
      [tenantId],
    );
  }

  async updateWarehouse(tenantId: string, id: string, input: { code: string; name: string; address: string | null }) {
    await this.db.batch([
      // bins first, while the old code is still readable from the warehouse row
      {
        sql: `UPDATE warehouse_bins
                 SET location_code = ? || substr(location_code, length((SELECT code FROM warehouses WHERE id = ? AND tenant_id = ?)) + 1),
                     updated_at = ${NOW_SQL}
               WHERE warehouse_id = ? AND tenant_id = ?
                 AND ? <> (SELECT code FROM warehouses WHERE id = ? AND tenant_id = ?)`,
        params: [input.code, id, tenantId, id, tenantId, input.code, id, tenantId],
      },
      {
        sql: `UPDATE warehouses SET code = ?, name = ?, address = ?, updated_at = ${NOW_SQL} WHERE id = ? AND tenant_id = ?`,
        params: [input.code, input.name, input.address, id, tenantId],
      },
    ]);
  }

  private zoneSelect = `z.id, z.warehouse_id AS warehouseId, z.code, z.name, z.zone_type AS zoneType, z.description, z.status,
    z.map_x AS mapX, z.map_y AS mapY, z.map_width AS mapWidth, z.map_height AS mapHeight,
    (SELECT COUNT(*) FROM warehouse_racks r WHERE r.zone_id = z.id AND r.deleted_at IS NULL) AS rackCount,
    (SELECT COUNT(*) FROM warehouse_bins b WHERE b.zone_id = z.id) AS binCount,
    COALESCE((SELECT SUM(b.capacity) FROM warehouse_bins b WHERE b.zone_id = z.id AND b.status = 'ACTIVE'), 0) AS capacity,
    COALESCE((SELECT SUM(ib.quantity) FROM inventory_balances ib JOIN warehouse_bins b ON b.id = ib.bin_id WHERE b.zone_id = z.id), 0) AS used`;

  listZones(tenantId: string) {
    return this.db.all<ZoneRow>(`SELECT ${this.zoneSelect} FROM warehouse_zones z WHERE z.tenant_id = ? AND z.deleted_at IS NULL ORDER BY z.code`, [tenantId]);
  }

  getZone(tenantId: string, id: string) {
    return this.db.first<ZoneRow>(`SELECT ${this.zoneSelect} FROM warehouse_zones z WHERE z.tenant_id = ? AND z.id = ? AND z.deleted_at IS NULL`, [tenantId, id]);
  }

  async createZone(tenantId: string, i: ZoneInputData) {
    const id = newId();
    await this.db.run(
      `INSERT INTO warehouse_zones (id, tenant_id, warehouse_id, code, name, zone_type, description, status, map_x, map_y, map_width, map_height)
       SELECT ?, ?, w.id, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM warehouses w WHERE w.id = ? AND w.tenant_id = ?`,
      [id, tenantId, i.code, i.name, i.zoneType, i.description, i.status, i.mapX, i.mapY, i.mapWidth, i.mapHeight, i.warehouseId, tenantId],
    );
    return id;
  }

  async updateZone(tenantId: string, id: string, i: ZoneInputData) {
    await this.db.run(
      `UPDATE warehouse_zones SET name = ?, zone_type = ?, description = ?, status = ?, map_x = ?, map_y = ?, map_width = ?, map_height = ?, updated_at = ${NOW_SQL}
        WHERE id = ? AND tenant_id = ?`,
      [i.name, i.zoneType, i.description, i.status, i.mapX, i.mapY, i.mapWidth, i.mapHeight, id, tenantId],
    );
  }

  async zoneHasRacks(tenantId: string, id: string) {
    const row = await this.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM warehouse_racks WHERE tenant_id = ? AND zone_id = ? AND deleted_at IS NULL", [tenantId, id]);
    return (row?.n ?? 0) > 0;
  }

  async deleteZone(tenantId: string, id: string) {
    await this.db.run(`UPDATE warehouse_zones SET deleted_at = ${NOW_SQL}, code = code || '#' || substr(id, 1, 8), status = 'INACTIVE' WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
  }

  private rackSelect = `r.id, r.zone_id AS zoneId, z.code AS zoneCode, r.code, r.name, r.status,
    (SELECT COUNT(*) FROM warehouse_levels l WHERE l.rack_id = r.id) AS levelCount,
    (SELECT COUNT(*) FROM warehouse_bins b WHERE b.rack_id = r.id) AS binCount,
    COALESCE((SELECT SUM(b.capacity) FROM warehouse_bins b WHERE b.rack_id = r.id AND b.status = 'ACTIVE'), 0) AS capacity,
    COALESCE((SELECT SUM(ib.quantity) FROM inventory_balances ib JOIN warehouse_bins b ON b.id = ib.bin_id WHERE b.rack_id = r.id), 0) AS used`;

  listRacks(tenantId: string, zoneId?: string) {
    const where = new Where().add("r.tenant_id = ?", tenantId).add("r.deleted_at IS NULL").addIf(zoneId, "r.zone_id = ?", zoneId ?? null);
    return this.db.all<RackRow>(`SELECT ${this.rackSelect} FROM warehouse_racks r JOIN warehouse_zones z ON z.id = r.zone_id ${where.toSql()} ORDER BY z.code, r.code`, where.params);
  }

  getRack(tenantId: string, id: string) {
    return this.db.first<RackRow>(
      `SELECT ${this.rackSelect} FROM warehouse_racks r JOIN warehouse_zones z ON z.id = r.zone_id WHERE r.tenant_id = ? AND r.id = ? AND r.deleted_at IS NULL`,
      [tenantId, id],
    );
  }

  async createRackWithBins(tenantId: string, input: { zoneId: string; code: string; name: string; levelCount: number; binsPerLevel: number; binCapacity: number }) {
    const zone = await this.db.first<{ id: string; code: string; warehouseId: string; warehouseCode: string }>(
      `SELECT z.id, z.code, z.warehouse_id AS warehouseId, w.code AS warehouseCode
         FROM warehouse_zones z JOIN warehouses w ON w.id = z.warehouse_id
        WHERE z.id = ? AND z.tenant_id = ? AND z.deleted_at IS NULL`,
      [input.zoneId, tenantId],
    );
    if (!zone) throw new Error("ZONE_NOT_FOUND");
    const rackId = newId();
    const statements: SqlStatement[] = [
      { sql: "INSERT INTO warehouse_racks (id, tenant_id, zone_id, code, name) VALUES (?, ?, ?, ?, ?)", params: [rackId, tenantId, zone.id, input.code, input.name] },
    ];
    for (let lv = 1; lv <= input.levelCount; lv++) {
      const levelId = newId();
      const lc = levelCode(lv);
      statements.push({ sql: "INSERT INTO warehouse_levels (id, tenant_id, rack_id, code, level_number) VALUES (?, ?, ?, ?, ?)", params: [levelId, tenantId, rackId, lc, lv] });
      for (let bn = 1; bn <= input.binsPerLevel; bn++) {
        const bc = binCode(bn);
        statements.push({
          sql: `INSERT INTO warehouse_bins (id, tenant_id, warehouse_id, zone_id, rack_id, level_id, code, location_code, capacity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [newId(), tenantId, zone.warehouseId, zone.id, rackId, levelId, bc, buildLocationCode({ warehouseCode: zone.warehouseCode, zoneCode: zone.code, rackCode: input.code, levelCode: lc, binCode: bc }), input.binCapacity],
        });
      }
    }
    await this.db.batch(statements);
    return rackId;
  }

  async updateRack(tenantId: string, id: string, name: string, status: ActiveStatus) {
    await this.db.batch([
      { sql: `UPDATE warehouse_racks SET name = ?, status = ?, updated_at = ${NOW_SQL} WHERE id = ? AND tenant_id = ?`, params: [name, status, id, tenantId] },
      { sql: `UPDATE warehouse_levels SET status = ?, updated_at = ${NOW_SQL} WHERE rack_id = ? AND tenant_id = ?`, params: [status, id, tenantId] },
      { sql: `UPDATE warehouse_bins SET status = ?, updated_at = ${NOW_SQL} WHERE rack_id = ? AND tenant_id = ?`, params: [status, id, tenantId] },
    ]);
  }

  async rackHasHistory(tenantId: string, id: string) {
    const row = await this.db.first<{ n: number }>(
      `SELECT (SELECT COUNT(*) FROM inventory_balances ib JOIN warehouse_bins b ON b.id = ib.bin_id WHERE b.rack_id = ? AND b.tenant_id = ?)
            + (SELECT COUNT(*) FROM inventory_transactions t JOIN warehouse_bins b ON b.id = t.bin_id WHERE b.rack_id = ? AND b.tenant_id = ?)
            + (SELECT COUNT(*) FROM stock_receipt_items i JOIN warehouse_bins b ON b.id = i.bin_id WHERE b.rack_id = ? AND b.tenant_id = ?) AS n`,
      [id, tenantId, id, tenantId, id, tenantId],
    );
    return (row?.n ?? 0) > 0;
  }

  async deleteRack(tenantId: string, id: string) {
    await this.db.batch([
      { sql: "DELETE FROM warehouse_bins WHERE rack_id = ? AND tenant_id = ?", params: [id, tenantId] },
      { sql: "DELETE FROM warehouse_levels WHERE rack_id = ? AND tenant_id = ?", params: [id, tenantId] },
      { sql: "DELETE FROM warehouse_racks WHERE id = ? AND tenant_id = ?", params: [id, tenantId] },
    ]);
  }

  listLevels(tenantId: string, rackId: string) {
    return this.db.all<LevelRow>(
      `SELECT l.id, l.rack_id AS rackId, l.code, l.level_number AS levelNumber, l.status,
              COALESCE((SELECT SUM(b.capacity) FROM warehouse_bins b WHERE b.level_id = l.id AND b.status = 'ACTIVE'), 0) AS capacity,
              COALESCE((SELECT SUM(ib.quantity) FROM inventory_balances ib JOIN warehouse_bins b ON b.id = ib.bin_id WHERE b.level_id = l.id), 0) AS used
         FROM warehouse_levels l WHERE l.tenant_id = ? AND l.rack_id = ? ORDER BY l.level_number DESC`,
      [tenantId, rackId],
    );
  }

  listBinsByRack(tenantId: string, rackId: string) {
    return this.db.all<BinRow>(`SELECT ${BIN_SELECT} ${BIN_FROM} WHERE b.tenant_id = ? AND b.rack_id = ? ORDER BY l.level_number DESC, b.code`, [tenantId, rackId]);
  }

  listBins(tenantId: string, f: BinFilter) {
    const where = new Where()
      .add("b.tenant_id = ?", tenantId)
      .add("r.deleted_at IS NULL")
      .addIf(f.zoneId, "b.zone_id = ?", f.zoneId ?? null)
      .addIf(f.rackId, "b.rack_id = ?", f.rackId ?? null)
      .addIf(f.status, "b.status = ?", f.status ?? null);
    if (f.search) where.add("b.location_code LIKE ? ESCAPE '\\'", likePattern(f.search.toUpperCase()));
    const usedExpr = "COALESCE((SELECT SUM(ib.quantity) FROM inventory_balances ib WHERE ib.bin_id = b.id), 0)";
    if (f.occupancy === "EMPTY") where.add(`${usedExpr} = 0`);
    if (f.occupancy === "OCCUPIED") where.add(`${usedExpr} > 0`);
    if (f.occupancy === "FULL") where.add(`b.capacity > 0 AND ${usedExpr} >= b.capacity`);
    if (f.occupancy === "NEAR_CAPACITY") where.add(`b.capacity > 0 AND ${usedExpr} >= b.capacity * ? AND ${usedExpr} < b.capacity`, f.nearThreshold);
    return paginate<BinRow>(this.db, BIN_SELECT, `${BIN_FROM} ${where.toSql()}`, where.params, "b.location_code", f);
  }

  listBinOptions(tenantId: string, search?: string) {
    const where = new Where().add("b.tenant_id = ?", tenantId).add("b.status = 'ACTIVE'");
    if (search) where.add("b.location_code LIKE ? ESCAPE '\\'", likePattern(search.toUpperCase()));
    return this.db.all<{ id: string; locationCode: string; capacity: number; used: number; status: ActiveStatus }>(
      `SELECT b.id, b.location_code AS locationCode, b.capacity, b.status,
              COALESCE((SELECT SUM(ib.quantity) FROM inventory_balances ib WHERE ib.bin_id = b.id), 0) AS used
         FROM warehouse_bins b ${where.toSql()} ORDER BY b.location_code LIMIT 50`,
      where.params,
    );
  }

  getBin(tenantId: string, id: string) {
    return this.db.first<BinRow>(`SELECT ${BIN_SELECT} ${BIN_FROM} WHERE b.tenant_id = ? AND b.id = ?`, [tenantId, id]);
  }

  async updateBin(tenantId: string, id: string, capacity: number, status: ActiveStatus) {
    await this.db.run(`UPDATE warehouse_bins SET capacity = ?, status = ?, updated_at = ${NOW_SQL} WHERE id = ? AND tenant_id = ?`, [capacity, status, id, tenantId]);
  }
}
