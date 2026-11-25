import ExcelJS from "exceljs";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { permissionsForRoles } from "@/shared/constants";
import vi from "@/locales/vi/translation.json";
import { businessDate } from "@/backend/domain/dates";
import { DEMO_TENANT_ID } from "@/backend/seed/demoData";
import { buildReportWorkbook, reportFileName, sheetName, type Translate } from "@/frontend/utils/excel/reportExcel";
import { createSeededContainer } from "../helpers/sqlite";

const t: Translate = (key, options = {}) => {
  const value = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], vi);
  if (typeof value !== "string") return key;
  return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name] ?? ""));
};

const ctx = { companyName: "Công ty TNHH Nhựa Kỹ thuật Minh Phát (Demo)", scope: "Khu vực: Toàn kho", exportedBy: "Trần Thị Bình", exportedAt: new Date("2026-11-24T08:00:00Z") };
const actor = { userId: "usr_manager", tenantId: DEMO_TENANT_ID, permissions: permissionsForRoles(["WAREHOUSE_MANAGER"]), ipAddress: null };

async function roundTrip(wb: ExcelJS.Workbook) {
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(buffer as unknown as ArrayBuffer);
  return { buffer, ws: loaded.worksheets[0] };
}

describe("report Excel export", () => {
  it("writes a formatted .xlsx for every report type from live data", async () => {
    const { container } = await createSeededContainer(businessDate());
    for (const type of ["inventory", "product", "lot", "location", "receipts", "issues", "expiring", "expired", "transfers", "stocktaking"]) {
      const report = await container.dashboard.report(actor, type, {});
      const title = t(`reports.types.${type}`);
      const { buffer, ws } = await roundTrip(buildReportWorkbook(ExcelJS, report, title, ctx, t));
      expect(buffer.subarray(0, 2).toString()).toBe("PK"); // zip container
      expect(ws.getCell("A2").value).toBe(title.toUpperCase());
      expect(ws.getRow(6).getCell(1).value).toBe(t(`reports.columns.${report.columns[0].label}`));
      expect(ws.rowCount).toBeGreaterThanOrEqual(6 + report.rows.length);
      if (process.env.XLSX_PREVIEW_DIR && type === "expiring") {
        mkdirSync(process.env.XLSX_PREVIEW_DIR, { recursive: true });
        writeFileSync(join(process.env.XLSX_PREVIEW_DIR, reportFileName(title, "2026-11-24")), buffer);
      }
    }
  });

  it("uses real Excel types, status colours, totals formula, frozen header and filter", async () => {
    const { container } = await createSeededContainer(businessDate());
    const report = await container.dashboard.report(actor, "expiring", {});
    const { ws } = await roundTrip(buildReportWorkbook(ExcelJS, report, t("reports.types.expiring"), ctx, t));
    const headers = (ws.getRow(6).values as unknown[]).slice(1);
    const col = (label: string) => headers.indexOf(t(`reports.columns.${label}`)) + 1;

    const dateCell = ws.getRow(7).getCell(col("expirationDate"));
    expect(dateCell.value).toBeInstanceOf(Date);
    expect(dateCell.numFmt).toBe("dd/mm/yyyy");

    const qtyCell = ws.getRow(7).getCell(col("quantity"));
    expect(typeof qtyCell.value).toBe("number");
    expect(qtyCell.numFmt).toBe("#,##0");

    const statusCell = ws.getRow(7).getCell(col("expiryStatus"));
    expect(String(statusCell.value)).toMatch(/Hết hạn trong/);
    expect((statusCell.fill as { fgColor?: { argb?: string } }).fgColor?.argb).toBeTruthy();

    const totalRow = ws.getRow(7 + report.rows.length);
    expect(totalRow.getCell(1).value).toBe("TỔNG CỘNG");
    const total = totalRow.getCell(col("quantity")).value as { formula: string; result: number };
    expect(total.formula).toMatch(/^SUM\(/);
    expect(total.result).toBe(report.summary?.quantity);

    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 6 });
    expect(ws.autoFilter).toBeTruthy();
  });

  it("sanitises sheet and file names", () => {
    expect(sheetName("Báo cáo [tồn]: kho/lô?")).toBe("Báo cáo  tồn   kho lô");
    expect(sheetName("x".repeat(40))).toHaveLength(31);
    expect(reportFileName("Báo cáo tồn kho", "2026-11-24")).toBe("Báo cáo tồn kho 2026-11-24.xlsx");
  });
});
