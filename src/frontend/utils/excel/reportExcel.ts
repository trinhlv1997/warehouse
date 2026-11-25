import type * as ExcelJSNamespace from "exceljs";
import type { ReportDto } from "@/shared/types";
import { formatDateTime } from "../format";

type ExcelJS = typeof ExcelJSNamespace;
type Workbook = ExcelJSNamespace.Workbook;
type Fill = ExcelJSNamespace.Fill;

/** Translation function (i18next `t` or a compatible stub in tests). */
export type Translate = (key: string, options?: Record<string, unknown>) => string;

export interface ReportExcelContext {
  companyName: string;
  /** e.g. "Kỳ báo cáo: 01/11/2026 – 24/11/2026" or "Khu vực: Toàn kho" */
  scope: string;
  exportedBy: string;
  exportedAt: Date;
}

const NAVY = "FF0B1A33";
const BLUE = "FF1D4ED8";
const BORDER = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
const ZEBRA: Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
const solid = (argb: string): Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

/** Status colours shared with the UI badges. */
const STATUS_STYLE: Record<string, { fill: string; font: string }> = {
  EXPIRED: { fill: "FFFEE2E2", font: "FF991B1B" },
  CRITICAL: { fill: "FFFEE2E2", font: "FFB91C1C" },
  WARNING: { fill: "FFFFEDD5", font: "FF9A3412" },
  NOTICE: { fill: "FFFEF9C3", font: "FF854D0E" },
  SAFE: { fill: "FFDCFCE7", font: "FF166534" },
  QUARANTINE: { fill: "FFFFEDD5", font: "FF9A3412" },
  BLOCKED: { fill: "FFFEE2E2", font: "FF991B1B" },
  INACTIVE: { fill: "FFF1F5F9", font: "FF64748B" },
  CANCELLED: { fill: "FFFEE2E2", font: "FF991B1B" },
};

/** Columns summed in the totals row. */
const SUM_COLUMNS = new Set(["quantity", "systemQuantity", "countedQuantity", "difference"]);

function toExcelDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function columnLetter(index: number): string {
  let n = index;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function statusLabel(key: string, value: string, t: Translate): string {
  if (key === "expiryStatus") return t(`expiry.${value}`);
  if (key === "reason") return t(`issueReason.${value}`);
  return t(`status.${value}`);
}

/** Excel sheet names: max 31 chars, no []:*?/\ */
export function sheetName(title: string): string {
  return title.replace(/[[\]:*?/\\]/g, " ").slice(0, 31).trim() || "Report";
}

/**
 * Builds a formatted workbook for a report: title block, styled header, typed cells
 * (real dates and numbers), status colours, totals row with SUM formulas, frozen header,
 * auto-filter and print setup. Pure apart from ExcelJS, so it is unit-tested in Node.
 */
export function buildReportWorkbook(Excel: ExcelJS, report: ReportDto, title: string, ctx: ReportExcelContext, t: Translate): Workbook {
  const wb = new Excel.Workbook();
  wb.creator = "WMS Pro";
  wb.company = ctx.companyName;
  wb.title = title;
  wb.created = ctx.exportedAt;

  const columns = report.columns;
  const lastCol = columnLetter(columns.length);
  const ws = wb.addWorksheet(sheetName(title), {
    views: [{ state: "frozen", ySplit: 6, showGridLines: false }],
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
    headerFooter: { oddFooter: `&L${title}&R&P / &N` },
  });

  // ---- title block (rows 1–4)
  const titleRow = (rowNumber: number, text: string, font: Partial<ExcelJSNamespace.Font>) => {
    ws.mergeCells(`A${rowNumber}:${lastCol}${rowNumber}`);
    const cell = ws.getCell(`A${rowNumber}`);
    cell.value = text;
    cell.font = { name: "Arial", ...font };
    cell.alignment = { vertical: "middle" };
  };
  titleRow(1, ctx.companyName.toUpperCase(), { size: 11, bold: true, color: { argb: NAVY } });
  titleRow(2, title.toUpperCase(), { size: 16, bold: true, color: { argb: BLUE } });
  titleRow(3, ctx.scope, { size: 10, italic: true, color: { argb: "FF475569" } });
  titleRow(4, t("reports.excel.exportedAt", { time: formatDateTime(ctx.exportedAt.toISOString()), user: ctx.exportedBy, count: report.rows.length }), {
    size: 9,
    color: { argb: "FF64748B" },
  });
  ws.getRow(2).height = 24;

  // ---- header (row 6)
  const headerRowNumber = 6;
  const header = ws.getRow(headerRowNumber);
  columns.forEach((col, i) => {
    const cell = header.getCell(i + 1);
    cell.value = t(`reports.columns.${col.label}`);
    cell.font = { name: "Arial", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = solid(NAVY);
    cell.alignment = { vertical: "middle", horizontal: col.type === "number" ? "right" : col.type === "date" ? "center" : "left", wrapText: true };
    cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
  });
  header.height = 30;

  // ---- data rows
  const widths = columns.map((col) => Math.max(10, t(`reports.columns.${col.label}`).length + 2));
  report.rows.forEach((row, r) => {
    const excelRow = ws.getRow(headerRowNumber + 1 + r);
    columns.forEach((col, i) => {
      const cell = excelRow.getCell(i + 1);
      const raw = row[col.key];
      let display = "";
      if (raw === null || raw === undefined || raw === "") {
        cell.value = null;
      } else if (col.type === "date") {
        cell.value = toExcelDate(String(raw));
        cell.numFmt = "dd/mm/yyyy";
        cell.alignment = { horizontal: "center" };
        display = "00/00/0000";
      } else if (col.type === "number") {
        const n = Number(raw);
        cell.value = n;
        cell.numFmt = Number.isInteger(n) ? "#,##0" : "#,##0.0";
        display = String(raw);
        if (col.key === "difference" && n !== 0) cell.font = { name: "Arial", size: 10, bold: true, color: { argb: n > 0 ? "FF15803D" : "FFB91C1C" } };
        if (col.key === "daysToExpiry" && n <= 7) cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFB91C1C" } };
      } else if (col.type === "status") {
        const value = String(raw);
        display = statusLabel(col.key, value, t);
        cell.value = display;
        const style = STATUS_STYLE[value];
        if (style) {
          cell.fill = solid(style.fill);
          cell.font = { name: "Arial", size: 10, bold: true, color: { argb: style.font } };
        }
      } else {
        display = String(raw);
        cell.value = display;
      }
      if (!cell.font?.bold) cell.font = { name: "Arial", size: 10, ...(["sku", "lotNumber", "locationCode", "documentNumber", "fromLocation", "toLocation"].includes(col.key) ? { color: { argb: "FF0F172A" } } : {}) };
      if (!cell.fill && r % 2 === 1) cell.fill = ZEBRA;
      cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
      if (col.type !== "date" && col.type !== "number") cell.alignment = { vertical: "top", wrapText: display.length > 45 };
      widths[i] = Math.max(widths[i], Math.min(48, display.length + 2));
    });
  });

  // ---- totals row with live formulas
  const firstDataRow = headerRowNumber + 1;
  const lastDataRow = headerRowNumber + report.rows.length;
  if (report.rows.length > 0 && columns.some((c) => SUM_COLUMNS.has(c.key))) {
    const totals = ws.getRow(lastDataRow + 1);
    columns.forEach((col, i) => {
      const cell = totals.getCell(i + 1);
      if (i === 0) cell.value = t("reports.excel.total");
      if (SUM_COLUMNS.has(col.key)) {
        const letter = columnLetter(i + 1);
        const result = report.rows.reduce((sum, row) => sum + Number(row[col.key] ?? 0), 0);
        cell.value = { formula: `SUM(${letter}${firstDataRow}:${letter}${lastDataRow})`, result };
        cell.numFmt = "#,##0";
      }
      cell.font = { name: "Arial", size: 10, bold: true };
      cell.fill = solid("FFE2E8F0");
      cell.border = { top: { style: "medium", color: { argb: NAVY } }, left: BORDER, bottom: BORDER, right: BORDER };
    });
  }

  ws.columns.forEach((column, i) => {
    column.width = widths[i] ?? 12;
  });
  if (report.rows.length > 0) ws.autoFilter = { from: { row: headerRowNumber, column: 1 }, to: { row: lastDataRow, column: columns.length } };
  ws.pageSetup.printTitlesRow = `${headerRowNumber}:${headerRowNumber}`;
  return wb;
}

export function reportFileName(title: string, date: string): string {
  return `${title.replace(/[\\/:*?"<>|]/g, "-")} ${date}.xlsx`;
}

/** Lazily loads ExcelJS (~300 kB gzip) only when the user exports. */
export async function downloadReportExcel(report: ReportDto, title: string, ctx: ReportExcelContext, t: Translate, fileName: string): Promise<void> {
  const mod = (await import("exceljs")) as unknown as ExcelJS & { default?: ExcelJS };
  const Excel = mod.default ?? mod;
  const buffer = await buildReportWorkbook(Excel, report, title, ctx, t).xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
