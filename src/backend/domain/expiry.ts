import { EXPIRY_THRESHOLDS, type ExpiryStatus } from "../../shared/constants";
import { addDays, daysBetween } from "./dates";

/**
 * Days left until expiry (expirationDate - today). Negative or zero means expired:
 * goods whose expiry date is today are no longer shippable.
 */
export function daysToExpiry(expirationDate: string | null, today: string): number | null {
  return expirationDate ? daysBetween(today, expirationDate) : null;
}

export function classifyExpiry(expirationDate: string | null, today: string): ExpiryStatus {
  const days = daysToExpiry(expirationDate, today);
  if (days === null) return "NO_EXPIRY";
  if (days <= 0) return "EXPIRED";
  if (days <= EXPIRY_THRESHOLDS.critical) return "CRITICAL";
  if (days <= EXPIRY_THRESHOLDS.warning) return "WARNING";
  if (days <= EXPIRY_THRESHOLDS.notice) return "NOTICE";
  return "SAFE";
}

export function isExpired(expirationDate: string | null, today: string): boolean {
  return classifyExpiry(expirationDate, today) === "EXPIRED";
}

/** Remaining shelf life as a percentage of total shelf life (manufacturing → expiry). */
export function shelfLifePercent(manufacturingDate: string | null, expirationDate: string | null, today: string): number | null {
  if (!manufacturingDate || !expirationDate) return null;
  const total = daysBetween(manufacturingDate, expirationDate);
  if (total <= 0) return 0;
  const left = daysBetween(today, expirationDate);
  return Math.max(0, Math.min(100, Math.round((left / total) * 100)));
}

/**
 * Inclusive expiration-date range for a bucket, so SQL can filter with plain string comparison:
 * `expiration_date >= from AND expiration_date <= to` (either bound may be null = open).
 */
export function expiryDateRange(status: ExpiryStatus, today: string): { from: string | null; to: string | null; noExpiry?: boolean } {
  switch (status) {
    case "EXPIRED":
      return { from: null, to: today };
    case "CRITICAL":
      return { from: addDays(today, 1), to: addDays(today, EXPIRY_THRESHOLDS.critical) };
    case "WARNING":
      return { from: addDays(today, EXPIRY_THRESHOLDS.critical + 1), to: addDays(today, EXPIRY_THRESHOLDS.warning) };
    case "NOTICE":
      return { from: addDays(today, EXPIRY_THRESHOLDS.warning + 1), to: addDays(today, EXPIRY_THRESHOLDS.notice) };
    case "SAFE":
      return { from: addDays(today, EXPIRY_THRESHOLDS.notice + 1), to: null };
    case "NO_EXPIRY":
      return { from: null, to: null, noExpiry: true };
  }
}
