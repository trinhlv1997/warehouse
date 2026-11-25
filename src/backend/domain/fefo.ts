import type { LotStatus } from "../../shared/constants";
import { classifyExpiry, daysToExpiry } from "./expiry";

/** One stock position that could be picked: product + lot + bin. */
export interface FefoCandidate {
  balanceId: string;
  lotId: string;
  lotNumber: string;
  lotStatus: LotStatus;
  binId: string;
  locationCode: string;
  binActive: boolean;
  expirationDate: string | null;
  receivedDate: string;
  quantity: number;
}

export interface FefoAllocation extends FefoCandidate {
  allocatedQuantity: number;
  daysToExpiry: number | null;
}

export interface FefoResult {
  requestedQuantity: number;
  allocatedQuantity: number;
  shortageQuantity: number;
  allocations: FefoAllocation[];
  excluded: { expired: number; quarantine: number; blocked: number };
}

/**
 * FEFO ordering: earliest expiration first; lots without an expiry date go last.
 * Ties fall back to FIFO (received date), then lot number and location for determinism.
 */
export function compareFefo(a: FefoCandidate, b: FefoCandidate): number {
  if (a.expirationDate !== b.expirationDate) {
    if (a.expirationDate === null) return 1;
    if (b.expirationDate === null) return -1;
    return a.expirationDate < b.expirationDate ? -1 : 1;
  }
  if (a.receivedDate !== b.receivedDate) return a.receivedDate < b.receivedDate ? -1 : 1;
  if (a.lotNumber !== b.lotNumber) return a.lotNumber < b.lotNumber ? -1 : 1;
  return a.locationCode < b.locationCode ? -1 : a.locationCode > b.locationCode ? 1 : 0;
}

/**
 * First Expired – First Out allocation.
 * Excludes expired, quarantined and blocked stock, then consumes eligible positions in FEFO order
 * until the requested quantity is covered. Pure function: the caller persists the result atomically.
 */
export function calculateFefoAllocation(candidates: FefoCandidate[], requestedQuantity: number, today: string): FefoResult {
  if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
    throw new RangeError("requestedQuantity must be a positive integer");
  }
  const excluded = { expired: 0, quarantine: 0, blocked: 0 };
  const eligible: FefoCandidate[] = [];

  for (const c of candidates) {
    if (c.quantity <= 0 || !c.binActive) continue;
    if (c.lotStatus === "QUARANTINE") excluded.quarantine += c.quantity;
    else if (c.lotStatus === "BLOCKED") excluded.blocked += c.quantity;
    else if (classifyExpiry(c.expirationDate, today) === "EXPIRED") excluded.expired += c.quantity;
    else eligible.push(c);
  }

  eligible.sort(compareFefo);

  const allocations: FefoAllocation[] = [];
  let remaining = requestedQuantity;
  for (const c of eligible) {
    if (remaining === 0) break;
    const take = Math.min(remaining, c.quantity);
    allocations.push({ ...c, allocatedQuantity: take, daysToExpiry: daysToExpiry(c.expirationDate, today) });
    remaining -= take;
  }

  return {
    requestedQuantity,
    allocatedQuantity: requestedQuantity - remaining,
    shortageQuantity: remaining,
    allocations,
    excluded,
  };
}

/** Stable fingerprint of an allocation plan; used to detect stock changes between preview and confirm. */
export function allocationFingerprint(plans: { productId: string; result: FefoResult }[]): string {
  return plans
    .map((p) => `${p.productId}:` + p.result.allocations.map((a) => `${a.balanceId}=${a.allocatedQuantity}/${a.quantity}`).join(","))
    .join("|");
}
