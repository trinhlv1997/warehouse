import { BUSINESS_TIMEZONE } from "../../shared/constants";

const DAY_MS = 86_400_000;

/** Today's calendar date ('YYYY-MM-DD') in the business timezone (Asia/Ho_Chi_Minh by default). */
export function businessDate(now: Date = new Date(), timeZone: string = BUSINESS_TIMEZONE): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function toUtcDay(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from `from` to `to` (date-only, timezone-independent). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcDay(to) - toUtcDay(from)) / DAY_MS);
}

export function addDays(date: string, days: number): string {
  return new Date(toUtcDay(date) + days * DAY_MS).toISOString().slice(0, 10);
}

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(toUtcDay(value)).toISOString().slice(0, 10) === value;
}

export function nowIso(now: Date = new Date()): string {
  return now.toISOString();
}
