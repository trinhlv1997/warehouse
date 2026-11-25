import type { ExpiryStatus, LotStatus } from "../../shared/constants";
import type { LotDto } from "../../shared/types";
import { addDays, businessDate } from "../domain/dates";
import { AppError } from "../domain/errors";
import { expiryDateRange } from "../domain/expiry";
import type { Repositories } from "../repositories";
import type { LotFilter, PositionFilter, TransactionFilter } from "../repositories/inventory";
import { toLotDto, toPositionDto, type Actor } from "./context";
import type { SettingsService } from "./settings";

export type AlertType = "expired" | "expiring" | "slow-moving";

/** Lots, inventory positions, ledger history and expiry/slow-moving alerts (computed at query time). */
export class InventoryService {
  constructor(
    private readonly repos: Repositories,
    private readonly settings: SettingsService,
    private readonly timezone: string,
  ) {}

  today() {
    return businessDate(new Date(), this.timezone);
  }

  async listLots(actor: Actor, filter: Omit<LotFilter, "expiry"> & { expiryStatus?: ExpiryStatus }) {
    const today = this.today();
    const res = await this.repos.inventory.listLots(actor.tenantId, {
      ...filter,
      expiry: filter.expiryStatus ? expiryDateRange(filter.expiryStatus, today) : undefined,
    });
    return { items: res.items.map((r) => toLotDto(r, today)), meta: res.meta };
  }

  async getLot(actor: Actor, id: string): Promise<LotDto> {
    const row = await this.repos.inventory.getLot(actor.tenantId, id);
    if (!row) throw new AppError("NOT_FOUND", "Lot not found");
    return toLotDto(row, this.today());
  }

  async updateLotStatus(actor: Actor, id: string, status: LotStatus, notes: string | null) {
    const lot = await this.getLot(actor, id);
    await this.repos.inventory.updateLotStatus(actor.tenantId, id, status, notes);
    await this.repos.identity.insertAudit({
      tenantId: actor.tenantId, userId: actor.userId, action: "lot.status_changed", entityType: "inventory_lot", entityId: id,
      details: { from: lot.status, to: status, notes }, ipAddress: actor.ipAddress,
    });
    return this.getLot(actor, id);
  }

  async listPositions(actor: Actor, filter: Omit<PositionFilter, "expiry"> & { expiryStatus?: ExpiryStatus }) {
    const today = this.today();
    const res = await this.repos.inventory.listPositions(actor.tenantId, {
      ...filter,
      expiry: filter.expiryStatus ? expiryDateRange(filter.expiryStatus, today) : undefined,
    });
    return { items: res.items.map((r) => toPositionDto(r, today)), meta: res.meta };
  }

  /**
   * expired: expiry <= today; expiring: within 60 days (filter further with expiryStatus);
   * slow-moving: received and not issued for N days (tenant setting).
   */
  async alerts(actor: Actor, type: AlertType, filter: Omit<PositionFilter, "expiry"> & { expiryStatus?: ExpiryStatus }) {
    const today = this.today();
    if (type === "expired") return this.listPositions(actor, { ...filter, expiryStatus: "EXPIRED" });
    if (type === "expiring") {
      if (filter.expiryStatus && ["CRITICAL", "WARNING", "NOTICE"].includes(filter.expiryStatus)) return this.listPositions(actor, filter);
      const minFrom = addDays(today, 1);
      return this.listPositions(actor, {
        ...filter,
        expiryStatus: undefined,
        expFrom: filter.expFrom && filter.expFrom > minFrom ? filter.expFrom : minFrom,
        expTo: filter.expTo ?? addDays(today, 60),
      });
    }
    const { slowMovingDays } = await this.settings.get(actor.tenantId);
    const cutoff = addDays(today, -slowMovingDays);
    return this.listPositions(actor, { ...filter, receivedBefore: cutoff, lastIssueBefore: cutoff, orderBy: filter.orderBy ?? "product" });
  }

  listTransactions(actor: Actor, filter: TransactionFilter) {
    return this.repos.inventory.listTransactions(actor.tenantId, filter);
  }

  /** "Where is product X?" — positions matching a product/lot/location search, for the map. */
  async searchLocations(actor: Actor, search: string) {
    const res = await this.repos.inventory.listPositions(actor.tenantId, { search, page: 1, pageSize: 200, orderBy: "location" });
    const bins = await Promise.all([...new Set(res.items.map((p) => p.binId))].map((id) => this.repos.warehouse.getBin(actor.tenantId, id)));
    const binMap = new Map(bins.filter((b) => b !== null).map((b) => [b!.id, b!]));
    return res.items.map((p) => ({
      binId: p.binId,
      locationCode: p.locationCode,
      zoneId: p.zoneId,
      rackId: binMap.get(p.binId)?.rackId ?? "",
      levelId: binMap.get(p.binId)?.levelId ?? "",
      productSku: p.productSku,
      productName: p.productName,
      lotNumber: p.lotNumber,
      quantity: p.quantity,
    }));
  }
}
