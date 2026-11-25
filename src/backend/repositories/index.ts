import type { SqlDatabase } from "../adapters/db/types";
import { SqlCatalogRepository, type CatalogRepository } from "./catalog";
import { SqlIdentityRepository, type IdentityRepository } from "./identity";
import { SqlInventoryRepository, type InventoryRepository } from "./inventory";
import { SqlOperationsRepository, type OperationsRepository } from "./operations";
import { SqlReportRepository, type ReportRepository } from "./reports";
import { SqlWarehouseRepository, type WarehouseRepository } from "./warehouse";

/** Services depend on these interfaces only, never on a concrete database. */
export interface Repositories {
  db: SqlDatabase;
  identity: IdentityRepository;
  warehouse: WarehouseRepository;
  catalog: CatalogRepository;
  inventory: InventoryRepository;
  operations: OperationsRepository;
  reports: ReportRepository;
}

/** SQL (SQLite dialect) implementations. Works with any SqlDatabase adapter speaking SQLite (D1, better-sqlite3). */
export function createSqlRepositories(db: SqlDatabase): Repositories {
  return {
    db,
    identity: new SqlIdentityRepository(db),
    warehouse: new SqlWarehouseRepository(db),
    catalog: new SqlCatalogRepository(db),
    inventory: new SqlInventoryRepository(db),
    operations: new SqlOperationsRepository(db),
    reports: new SqlReportRepository(db),
  };
}
