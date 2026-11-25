import { CAPACITY_THRESHOLDS, type CapacityStatus } from "../../shared/constants";

/** WH001-A-A01-L02-B03 */
export function buildLocationCode(parts: { warehouseCode: string; zoneCode: string; rackCode: string; levelCode: string; binCode: string }): string {
  return [parts.warehouseCode, parts.zoneCode, parts.rackCode, parts.levelCode, parts.binCode].join("-");
}

export function levelCode(levelNumber: number): string {
  return `L${String(levelNumber).padStart(2, "0")}`;
}

export function binCode(binNumber: number): string {
  return `B${String(binNumber).padStart(2, "0")}`;
}

export function capacityStatus(used: number, capacity: number, active: boolean, nearThreshold: number = CAPACITY_THRESHOLDS.near): CapacityStatus {
  if (!active) return "INACTIVE";
  if (capacity <= 0) return used > 0 ? "FULL" : "INACTIVE";
  const ratio = used / capacity;
  if (ratio >= CAPACITY_THRESHOLDS.full) return "FULL";
  if (ratio >= nearThreshold) return "NEAR_CAPACITY";
  return "AVAILABLE";
}

export function utilization(used: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.round((used / capacity) * 1000) / 10;
}
