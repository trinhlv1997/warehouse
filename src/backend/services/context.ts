import type { Permission } from "../../shared/constants";
import type { CapacityInfo, InventoryPositionDto, LotDto } from "../../shared/types";
import { classifyExpiry, daysToExpiry, shelfLifePercent } from "../domain/expiry";
import { capacityStatus, utilization } from "../domain/location";
import type { LotRow, PositionRow } from "../repositories/inventory";

/** Who is acting. Every service call is scoped to actor.tenantId (tenant isolation). */
export interface Actor {
  userId: string;
  tenantId: string;
  permissions: readonly Permission[];
  ipAddress: string | null;
}

export interface TenantSettings {
  companyName: string;
  slowMovingDays: number;
  nearCapacityPercent: number;
}

export const DEFAULT_SETTINGS: Omit<TenantSettings, "companyName"> = { slowMovingDays: 90, nearCapacityPercent: 80 };

export function withCapacity<T extends { capacity: number; used: number; status?: string }>(row: T, nearThreshold: number): T & CapacityInfo {
  const active = row.status === undefined || row.status === "ACTIVE";
  return {
    ...row,
    utilization: utilization(row.used, row.capacity),
    capacityStatus: capacityStatus(row.used, row.capacity, active, nearThreshold),
  };
}

export function toPositionDto(row: PositionRow, today: string): InventoryPositionDto {
  return { ...row, daysToExpiry: daysToExpiry(row.expirationDate, today), expiryStatus: classifyExpiry(row.expirationDate, today) };
}

export function toLotDto(row: LotRow, today: string): LotDto {
  return {
    ...row,
    locations: row.locations ? row.locations.split(",").sort() : [],
    daysToExpiry: daysToExpiry(row.expirationDate, today),
    expiryStatus: classifyExpiry(row.expirationDate, today),
    shelfLifePercent: shelfLifePercent(row.manufacturingDate, row.expirationDate, today),
  };
}
