import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { IssueDto } from "@/shared/types";
import vi from "@/locales/vi/translation.json";
import { buildIssuePdf, issuePdfFileName, type Translate } from "@/frontend/utils/pdf/issuePdf";

const require = createRequire(import.meta.url);

/** Minimal i18next-compatible translator over the Vietnamese locale. */
const t: Translate = (key, options = {}) => {
  const value = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], vi);
  if (typeof value !== "string") return key;
  return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name] ?? ""));
};

const issue: IssueDto = {
  id: "iss_1",
  issueNumber: "PX-261124-0047",
  issueDate: "2026-11-24",
  recipient: "Xưởng ép nhựa - Line 1 (máy 180T)",
  reason: "INTERNAL_USE",
  status: "CONFIRMED",
  notes: "Cấp nguyên liệu cho sản xuất theo kế hoạch ca",
  totalQuantity: 150,
  itemCount: 2,
  createdByName: "Lê Văn Cường",
  confirmedAt: "2026-11-24T07:15:00.000Z",
  createdAt: "2026-11-24T07:15:00.000Z",
  items: [
    { id: "a", productId: "prd_SP001", productSku: "SP001", productName: "Hạt nhựa PC chống cháy UL94 V-0 (bao 25kg)", unit: "Bao", lotId: "l1", lotNumber: "LOT001", binId: "b1", locationCode: "WH001-A-A01-L01-B03", expirationDate: "2026-12-01", quantity: 100 },
    { id: "b", productId: "prd_SP001", productSku: "SP001", productName: "Hạt nhựa PC chống cháy UL94 V-0 (bao 25kg)", unit: "Bao", lotId: "l2", lotNumber: "LOT002", binId: "b2", locationCode: "WH001-A-A02-L01-B01", expirationDate: "2026-12-15", quantity: 50 },
  ],
};

const ctx = {
  companyName: "Công ty TNHH Nhựa Kỹ thuật Minh Phát (Demo)",
  warehouseCode: "WH001",
  warehouseName: "Kho nhựa kỹ thuật Mỹ Phước",
  warehouseAddress: "Lô C5, KCN Mỹ Phước 3, Bến Cát, Bình Dương",
  printedBy: "Trần Thị Bình",
  printedAt: new Date("2026-11-24T08:00:00Z"),
};

describe("issue PDF", () => {
  it("builds a Vietnamese issue note with FEFO pick lines, totals and signatures", () => {
    const doc = buildIssuePdf(issue, ctx, t);
    const text = JSON.stringify(doc.content);
    expect(text).toContain("PHIẾU XUẤT KHO");
    expect(text).toContain("Số: PX-261124-0047");
    expect(text).toContain("Ngày 24 tháng 11 năm 2026");
    expect(text).toContain("WH001-A-A01-L01-B03");
    expect(text).toContain("LOT002");
    expect(text).toContain("Sử dụng nội bộ");
    expect(text).toContain("Thủ kho");
    expect(text).toContain('"text":"150"'); // total row
    expect(text).not.toMatch(/"pdf\.[a-z]/); // every key translated
    expect(issuePdfFileName(issue)).toBe("PhieuXuatKho_PX-261124-0047.pdf");
  });

  it("marks cancelled issues with a watermark", () => {
    expect(buildIssuePdf({ ...issue, status: "CANCELLED" }, ctx, t).watermark).toBeTruthy();
    expect(buildIssuePdf(issue, ctx, t).watermark).toBeUndefined();
  });

  it("renders a valid PDF with pdfmake", async () => {
    const pdfmake = require("pdfmake");
    const fonts = join(process.cwd(), "node_modules/pdfmake/build/fonts/Roboto");
    pdfmake.setFonts({
      Roboto: { normal: join(fonts, "Roboto-Regular.ttf"), bold: join(fonts, "Roboto-Medium.ttf"), italics: join(fonts, "Roboto-Italic.ttf"), bolditalics: join(fonts, "Roboto-MediumItalic.ttf") },
    });
    pdfmake.setUrlAccessPolicy?.(() => false);
    pdfmake.setLocalAccessPolicy?.((path: string) => path.startsWith(fonts));
    const buffer: Buffer = await pdfmake.createPdf(buildIssuePdf(issue, ctx, t)).getBuffer();
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(5_000);
    if (process.env.PDF_PREVIEW_DIR) {
      mkdirSync(process.env.PDF_PREVIEW_DIR, { recursive: true });
      writeFileSync(join(process.env.PDF_PREVIEW_DIR, issuePdfFileName(issue)), buffer);
    }
  });
});
