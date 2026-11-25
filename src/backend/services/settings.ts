import type { TenantSettingsDto } from "../../shared/types";
import type { AppConfig } from "../config";
import { AppError } from "../domain/errors";
import type { Repositories } from "../repositories";
import type { StorageProvider } from "../adapters/storage/types";
import { DEFAULT_SETTINGS, type Actor, type TenantSettings } from "./context";

/** Per-tenant settings stored as JSON on the tenant row (cached per request). */
export class SettingsService {
  private cache = new Map<string, TenantSettings>();

  constructor(
    private readonly repos: Repositories,
    private readonly config: AppConfig,
    private readonly storage: StorageProvider,
  ) {}

  async get(tenantId: string): Promise<TenantSettings> {
    const cached = this.cache.get(tenantId);
    if (cached) return cached;
    const tenant = await this.repos.identity.getTenant(tenantId);
    if (!tenant) throw new AppError("NOT_FOUND", "Tenant not found");
    let parsed: Partial<TenantSettings>;
    try {
      parsed = JSON.parse(tenant.settings || "{}");
    } catch {
      parsed = {};
    }
    const settings = { ...DEFAULT_SETTINGS, ...parsed, companyName: tenant.name };
    this.cache.set(tenantId, settings);
    return settings;
  }

  async getDto(actor: Actor): Promise<TenantSettingsDto> {
    const s = await this.get(actor.tenantId);
    return {
      ...s,
      demoMode: this.config.demoMode,
      appEnv: this.config.appEnv,
      databaseProvider: this.config.databaseProvider,
      storageProvider: this.storage.provider,
      storageAvailable: this.storage.available,
    };
  }

  async update(actor: Actor, input: TenantSettings): Promise<TenantSettingsDto> {
    const { companyName, ...rest } = input;
    await this.repos.identity.updateTenant(actor.tenantId, companyName, JSON.stringify(rest));
    this.cache.delete(actor.tenantId);
    await this.repos.identity.insertAudit({ tenantId: actor.tenantId, userId: actor.userId, action: "settings.updated", entityType: "tenant", entityId: actor.tenantId, details: input, ipAddress: actor.ipAddress });
    return this.getDto(actor);
  }
}
