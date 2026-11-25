import type { ActiveStatus } from "../../shared/constants";
import type { BinDetailDto, BinDto, LevelDto, RackDto, ZoneDto } from "../../shared/types";
import { businessDate } from "../domain/dates";
import { AppError } from "../domain/errors";
import type { Repositories } from "../repositories";
import type { BinFilter, BinRow, ZoneInputData } from "../repositories/warehouse";
import { toPositionDto, withCapacity, type Actor } from "./context";
import { guarded } from "./tx";
import type { SettingsService } from "./settings";

function toBinDto(row: BinRow, near: number): BinDto {
  const { zoneCode: _z, zoneName: _zn, rackCode: _r, levelCode: _l, ...rest } = row;
  return withCapacity(rest, near);
}

/** Warehouse structure, 2D map data and capacity utilisation. */
export class WarehouseService {
  constructor(
    private readonly repos: Repositories,
    private readonly settings: SettingsService,
    private readonly timezone: string,
  ) {}

  private async near(actor: Actor) {
    return (await this.settings.get(actor.tenantId)).nearCapacityPercent / 100;
  }

  private audit(actor: Actor, action: string, entityType: string, entityId: string | null, details?: unknown) {
    return this.repos.identity.insertAudit({ tenantId: actor.tenantId, userId: actor.userId, action, entityType, entityId, details, ipAddress: actor.ipAddress });
  }

  listWarehouses(actor: Actor) {
    return this.repos.warehouse.listWarehouses(actor.tenantId);
  }

  async updateWarehouse(actor: Actor, id: string, name: string, address: string | null) {
    await this.repos.warehouse.updateWarehouse(actor.tenantId, id, name, address);
    await this.audit(actor, "warehouse.updated", "warehouse", id);
  }

  async listZones(actor: Actor): Promise<ZoneDto[]> {
    const near = await this.near(actor);
    return (await this.repos.warehouse.listZones(actor.tenantId)).map((z) => withCapacity(z, near));
  }

  /** Zones with their racks: everything the top level of the 2D map needs in one call. */
  async map(actor: Actor): Promise<{ zones: (ZoneDto & { racks: RackDto[] })[] }> {
    const near = await this.near(actor);
    const [zones, racks] = await Promise.all([this.repos.warehouse.listZones(actor.tenantId), this.repos.warehouse.listRacks(actor.tenantId)]);
    return {
      zones: zones.map((z) => ({ ...withCapacity(z, near), racks: racks.filter((r) => r.zoneId === z.id).map((r) => withCapacity(r, near)) })),
    };
  }

  async createZone(actor: Actor, input: ZoneInputData) {
    const id = await guarded(() => this.repos.warehouse.createZone(actor.tenantId, input));
    await this.audit(actor, "zone.created", "warehouse_zone", id, { code: input.code });
    return this.getZone(actor, id);
  }

  async getZone(actor: Actor, id: string): Promise<ZoneDto> {
    const zone = await this.repos.warehouse.getZone(actor.tenantId, id);
    if (!zone) throw new AppError("NOT_FOUND", "Zone not found");
    return withCapacity(zone, await this.near(actor));
  }

  async updateZone(actor: Actor, id: string, input: ZoneInputData) {
    await this.getZone(actor, id);
    await guarded(() => this.repos.warehouse.updateZone(actor.tenantId, id, input));
    await this.audit(actor, "zone.updated", "warehouse_zone", id);
    return this.getZone(actor, id);
  }

  async deleteZone(actor: Actor, id: string) {
    await this.getZone(actor, id);
    if (await this.repos.warehouse.zoneHasRacks(actor.tenantId, id)) throw new AppError("IN_USE", "Zone still has racks");
    await this.repos.warehouse.deleteZone(actor.tenantId, id);
    await this.audit(actor, "zone.deleted", "warehouse_zone", id);
  }

  async listRacks(actor: Actor, zoneId?: string): Promise<RackDto[]> {
    const near = await this.near(actor);
    return (await this.repos.warehouse.listRacks(actor.tenantId, zoneId)).map((r) => withCapacity(r, near));
  }

  async getRack(actor: Actor, id: string): Promise<RackDto> {
    const rack = await this.repos.warehouse.getRack(actor.tenantId, id);
    if (!rack) throw new AppError("NOT_FOUND", "Rack not found");
    return withCapacity(rack, await this.near(actor));
  }

  async createRack(actor: Actor, input: { zoneId: string; code: string; name: string; levelCount: number; binsPerLevel: number; binCapacity: number }) {
    await this.getZone(actor, input.zoneId);
    const id = await guarded(() => this.repos.warehouse.createRackWithBins(actor.tenantId, input));
    await this.audit(actor, "rack.created", "warehouse_rack", id, input);
    return this.getRack(actor, id);
  }

  async updateRack(actor: Actor, id: string, name: string, status: ActiveStatus) {
    await this.getRack(actor, id);
    await this.repos.warehouse.updateRack(actor.tenantId, id, name, status);
    await this.audit(actor, "rack.updated", "warehouse_rack", id, { status });
    return this.getRack(actor, id);
  }

  async deleteRack(actor: Actor, id: string) {
    await this.getRack(actor, id);
    if (await this.repos.warehouse.rackHasHistory(actor.tenantId, id)) throw new AppError("IN_USE", "Rack has stock or history; deactivate it instead");
    await guarded(() => this.repos.warehouse.deleteRack(actor.tenantId, id));
    await this.audit(actor, "rack.deleted", "warehouse_rack", id);
  }

  /** Levels (top to bottom) with their bins, for the rack drill-down view. */
  async rackLayout(actor: Actor, rackId: string): Promise<{ rack: RackDto; levels: LevelDto[] }> {
    const rack = await this.getRack(actor, rackId);
    const near = await this.near(actor);
    const [levels, bins] = await Promise.all([this.repos.warehouse.listLevels(actor.tenantId, rackId), this.repos.warehouse.listBinsByRack(actor.tenantId, rackId)]);
    return {
      rack,
      levels: levels.map((l) => ({ ...withCapacity(l, near), bins: bins.filter((b) => b.levelId === l.id).map((b) => toBinDto(b, near)) })),
    };
  }

  async listBins(actor: Actor, filter: Omit<BinFilter, "nearThreshold">) {
    const near = await this.near(actor);
    const res = await this.repos.warehouse.listBins(actor.tenantId, { ...filter, nearThreshold: near });
    return { items: res.items.map((b) => ({ ...toBinDto(b, near), zoneCode: b.zoneCode, rackCode: b.rackCode, levelCode: b.levelCode })), meta: res.meta };
  }

  binOptions(actor: Actor, search?: string) {
    return this.repos.warehouse.listBinOptions(actor.tenantId, search);
  }

  async binDetail(actor: Actor, id: string): Promise<BinDetailDto> {
    const bin = await this.repos.warehouse.getBin(actor.tenantId, id);
    if (!bin) throw new AppError("NOT_FOUND", "Bin not found");
    const near = await this.near(actor);
    const today = businessDate(new Date(), this.timezone);
    const positions = await this.repos.inventory.listPositions(actor.tenantId, { binId: id, page: 1, pageSize: 200 });
    return { ...withCapacity(bin, near), positions: positions.items.map((p) => toPositionDto(p, today)) };
  }

  async updateBin(actor: Actor, id: string, capacity: number, status: ActiveStatus) {
    const bin = await this.repos.warehouse.getBin(actor.tenantId, id);
    if (!bin) throw new AppError("NOT_FOUND", "Bin not found");
    if (capacity < bin.used) throw new AppError("BIN_CAPACITY_EXCEEDED", "Capacity lower than current stock", { used: bin.used });
    await this.repos.warehouse.updateBin(actor.tenantId, id, capacity, status);
    await this.audit(actor, "bin.updated", "warehouse_bin", id, { capacity, status });
    return this.binDetail(actor, id);
  }
}

