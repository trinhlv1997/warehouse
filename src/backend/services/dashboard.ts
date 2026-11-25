import { EXPIRY_STATUSES, type CapacityStatus, type ExpiryStatus } from "../../shared/constants";
import type { DashboardDto, ReportColumn, ReportDto } from "../../shared/types";
import { addDays, businessDate } from "../domain/dates";
import { AppError } from "../domain/errors";
import { classifyExpiry } from "../domain/expiry";
import { capacityStatus, utilization } from "../domain/location";
import type { Repositories } from "../repositories";
import type { ReportFilter } from "../repositories/reports";
import { toPositionDto, type Actor } from "./context";
import type { SettingsService } from "./settings";

export const REPORT_TYPES = ["inventory", "product", "lot", "location", "receipts", "issues", "expiring", "expired", "transfers", "stocktaking"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

const col = (key: string, type: ReportColumn["type"] = "text"): ReportColumn => ({ key, label: key, type });

const REPORT_COLUMNS: Record<ReportType, ReportColumn[]> = {
  inventory: [col("sku"), col("productName"), col("categoryName"), col("unit"), col("lotNumber"), col("manufacturingDate", "date"), col("expirationDate", "date"), col("lotStatus", "status"), col("locationCode"), col("zoneName"), col("quantity", "number")],
  expiring: [col("sku"), col("productName"), col("lotNumber"), col("expirationDate", "date"), col("daysToExpiry", "number"), col("expiryStatus", "status"), col("locationCode"), col("quantity", "number")],
  expired: [col("sku"), col("productName"), col("lotNumber"), col("expirationDate", "date"), col("daysToExpiry", "number"), col("lotStatus", "status"), col("locationCode"), col("quantity", "number")],
  product: [col("sku"), col("productName"), col("categoryName"), col("unit"), col("quantity", "number"), col("minStock", "number"), col("maxStock", "number"), col("lotCount", "number"), col("locationCount", "number"), col("nearestExpiry", "date")],
  lot: [col("lotNumber"), col("sku"), col("productName"), col("supplierName"), col("manufacturingDate", "date"), col("expirationDate", "date"), col("receivedDate", "date"), col("lotStatus", "status"), col("quantity", "number")],
  location: [col("locationCode"), col("zoneName"), col("status", "status"), col("capacity", "number"), col("quantity", "number"), col("utilization", "number"), col("lotCount", "number")],
  receipts: [col("documentNumber"), col("documentDate", "date"), col("supplierName"), col("sku"), col("productName"), col("lotNumber"), col("expirationDate", "date"), col("locationCode"), col("quantity", "number"), col("userName")],
  issues: [col("documentNumber"), col("documentDate", "date"), col("recipient"), col("reason", "status"), col("sku"), col("productName"), col("lotNumber"), col("expirationDate", "date"), col("locationCode"), col("quantity", "number"), col("userName")],
  transfers: [col("documentNumber"), col("documentDate", "date"), col("sku"), col("productName"), col("lotNumber"), col("fromLocation"), col("toLocation"), col("quantity", "number"), col("reason"), col("userName")],
  stocktaking: [col("documentNumber"), col("documentDate", "date"), col("status", "status"), col("sku"), col("productName"), col("lotNumber"), col("locationCode"), col("systemQuantity", "number"), col("countedQuantity", "number"), col("difference", "number")],
};

/** Dashboard KPIs/charts and tabular reports, all computed from the database at request time. */
export class DashboardService {
  constructor(
    private readonly repos: Repositories,
    private readonly settings: SettingsService,
    private readonly timezone: string,
  ) {}

  async dashboard(actor: Actor): Promise<DashboardDto> {
    const today = businessDate(new Date(), this.timezone);
    const t = actor.tenantId;
    const near = (await this.settings.get(t)).nearCapacityPercent / 100;
    const [totals, byCategory, byZone, movements, expiryDates, bins, lowStock, alerts, recent] = await Promise.all([
      this.repos.reports.dashboardTotals(t, addDays(today, 1), addDays(today, 30), today),
      this.repos.reports.quantityByCategory(t),
      this.repos.reports.quantityByZone(t),
      this.repos.reports.dailyMovements(t, addDays(today, -29)),
      this.repos.reports.expiryDates(t),
      this.repos.reports.binUsage(t),
      this.repos.reports.lowStock(t, 8),
      this.repos.inventory.listPositions(t, { page: 1, pageSize: 8, expTo: addDays(today, 7) }),
      this.repos.inventory.listTransactions(t, { page: 1, pageSize: 8 }),
    ]);

    const expiry = new Map<ExpiryStatus, { quantity: number; lots: number }>(EXPIRY_STATUSES.map((s) => [s, { quantity: 0, lots: 0 }]));
    for (const row of expiryDates) {
      const bucket = expiry.get(classifyExpiry(row.expirationDate, today))!;
      bucket.quantity += row.quantity;
      bucket.lots += row.lots;
    }
    const binCounts = new Map<CapacityStatus, number>([["AVAILABLE", 0], ["NEAR_CAPACITY", 0], ["FULL", 0], ["INACTIVE", 0]]);
    for (const b of bins) {
      const s = capacityStatus(b.used, b.capacity, b.status === "ACTIVE", near);
      binCounts.set(s, (binCounts.get(s) ?? 0) + 1);
    }
    // fill every day of the last 30 so the chart has a continuous axis
    const byDate = new Map(movements.map((m) => [m.date, m]));
    const series = Array.from({ length: 30 }, (_, i) => {
      const date = addDays(today, i - 29);
      return { date, inbound: byDate.get(date)?.inbound ?? 0, outbound: byDate.get(date)?.outbound ?? 0 };
    });

    return {
      businessDate: today,
      totals: {
        quantity: totals.quantity ?? 0,
        skuCount: totals.skuCount ?? 0,
        categoryCount: totals.categoryCount ?? 0,
        lotCount: totals.lotCount ?? 0,
        binCount: totals.binCount ?? 0,
        utilization: utilization(totals.quantity ?? 0, totals.capacity ?? 0),
        expiringSoonQuantity: totals.expiringSoonQuantity ?? 0,
        expiringSoonLots: totals.expiringSoonLots ?? 0,
        expiredQuantity: totals.expiredQuantity ?? 0,
        expiredLots: totals.expiredLots ?? 0,
        lowStockProducts: totals.lowStockProducts ?? 0,
      },
      byCategory,
      byZone: byZone.map((z) => ({ ...z, utilization: utilization(z.quantity, z.capacity) })),
      movements: series,
      expiryBreakdown: [...expiry.entries()].map(([status, v]) => ({ status, ...v })),
      binUtilization: [...binCounts.entries()].map(([status, count]) => ({ status, count })),
      alerts: alerts.items.map((p) => toPositionDto(p, today)),
      lowStock,
      recentTransactions: recent.items,
    };
  }

  async report(actor: Actor, type: string, filter: ReportFilter): Promise<ReportDto> {
    if (!(REPORT_TYPES as readonly string[]).includes(type)) throw new AppError("NOT_FOUND", "Unknown report");
    const reportType = type as ReportType;
    const today = businessDate(new Date(), this.timezone);
    const f: ReportFilter = { ...filter };
    if (reportType === "expiring") {
      f.expFrom = filter.expFrom && filter.expFrom > today ? filter.expFrom : addDays(today, 1);
      f.expTo = filter.expTo ?? addDays(today, 60);
    }
    if (reportType === "expired") {
      f.expFrom = undefined;
      f.expTo = today;
    }
    let rows = await this.repos.reports.run(actor.tenantId, reportType, f);
    if (reportType === "expiring" || reportType === "expired") {
      rows = rows.map((r) => {
        const exp = r.expirationDate as string | null;
        const status = classifyExpiry(exp, today);
        const days = exp ? Math.round((Date.parse(exp) - Date.parse(today)) / 86_400_000) : null;
        return { ...r, daysToExpiry: days, expiryStatus: status };
      });
    }
    if (reportType === "location") {
      rows = rows.map((r) => ({ ...r, utilization: utilization(Number(r.quantity), Number(r.capacity)) }));
    }
    const summary: Record<string, number> = { rows: rows.length };
    if (rows.length && "quantity" in rows[0]) summary.quantity = rows.reduce((s, r) => s + Number(r.quantity ?? 0), 0);
    return { type: reportType, columns: REPORT_COLUMNS[reportType], rows, summary };
  }
}

/** RFC 4180 CSV with a UTF-8 BOM so Excel opens Vietnamese text correctly. */
export function toCsv(columns: { key: string; label: string }[], rows: Record<string, unknown>[]): string {
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    // neutralise spreadsheet formula injection
    const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [columns.map((c) => escape(c.label)).join(","), ...rows.map((r) => columns.map((c) => escape(r[c.key])).join(","))];
  return "﻿" + lines.join("\r\n");
}
