import { D1SqlDatabase } from "./adapters/db/d1";
import type { SqlDatabase } from "./adapters/db/types";
import { NoStorageProvider } from "./adapters/storage/none";
import { R2StorageProvider } from "./adapters/storage/r2";
import type { StorageProvider } from "./adapters/storage/types";
import { loadConfig, type AppConfig, type RuntimeEnv } from "./config";
import { createSqlRepositories, type Repositories } from "./repositories";
import { AuthService } from "./services/auth";
import { CatalogService } from "./services/catalog";
import { DashboardService } from "./services/dashboard";
import { DemoService } from "./services/demo";
import { InventoryService } from "./services/inventory";
import { IssueService } from "./services/issues";
import { ReceiptService } from "./services/receipts";
import { SettingsService } from "./services/settings";
import { StocktakingService } from "./services/stocktaking";
import { TransferService } from "./services/transfers";
import { UserService } from "./services/users";
import { WarehouseService } from "./services/warehouse";

export interface Container {
  config: AppConfig;
  repos: Repositories;
  storage: StorageProvider;
  auth: AuthService;
  settings: SettingsService;
  warehouse: WarehouseService;
  catalog: CatalogService;
  inventory: InventoryService;
  receipts: ReceiptService;
  issues: IssueService;
  transfers: TransferService;
  stocktaking: StocktakingService;
  dashboard: DashboardService;
  users: UserService;
  demo: DemoService;
}

/** Infrastructure selection lives here only; services never know which provider they run on. */
function createDatabase(config: AppConfig, env: RuntimeEnv): SqlDatabase {
  switch (config.databaseProvider) {
    case "d1":
      if (!env.DB) throw new Error("DATABASE_PROVIDER=d1 but the DB binding is missing (wrangler.jsonc d1_databases)");
      return new D1SqlDatabase(env.DB);
    default:
      // e.g. "postgres": implement SqlDatabase in adapters/db/postgres.ts (see docs/DOMAIN_MIGRATION.md)
      throw new Error(`Unsupported DATABASE_PROVIDER: ${config.databaseProvider}`);
  }
}

function createStorage(config: AppConfig, env: RuntimeEnv): StorageProvider {
  if (config.storageProvider === "r2" && env.STORAGE) return new R2StorageProvider(env.STORAGE);
  // "s3": implement StorageProvider in adapters/storage/s3.ts
  return new NoStorageProvider();
}

export function buildContainer(config: AppConfig, db: SqlDatabase, storage: StorageProvider): Container {
  const repos = createSqlRepositories(db);
  const tz = config.timezone;
  const settings = new SettingsService(repos, config, storage);
  return {
    config,
    repos,
    storage,
    settings,
    auth: new AuthService(repos.identity, config),
    warehouse: new WarehouseService(repos, settings, tz),
    catalog: new CatalogService(repos, storage),
    inventory: new InventoryService(repos, settings, tz),
    receipts: new ReceiptService(repos, tz),
    issues: new IssueService(repos, tz),
    transfers: new TransferService(repos, tz),
    stocktaking: new StocktakingService(repos, tz),
    dashboard: new DashboardService(repos, settings, tz),
    users: new UserService(repos, config.passwordIterations),
    demo: new DemoService(repos, config),
  };
}

export function createContainer(env: RuntimeEnv): Container {
  const config = loadConfig(env);
  return buildContainer(config, createDatabase(config, env), createStorage(config, env));
}
