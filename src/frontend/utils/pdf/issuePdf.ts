import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { IssueDto } from "@/shared/types";
import { formatDate, formatDateTime, formatNumber } from "../format";

/** Translation function (i18next `t` or any compatible stub in tests). */
export type Translate = (key: string, options?: Record<string, unknown>) => string;

export interface IssuePdfContext {
  companyName: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseAddress: string | null;
  printedBy: string;
  printedAt: Date;
}

const BRAND = "#1d4ed8";
const NAVY = "#0b1a33";
const MUTED = "#64748b";
const BORDER = "#cbd5e1";

function dateInWords(date: string, t: Translate): string {
  const [year, month, day] = date.split("-");
  return t("pdf.dateLine", { day, month, year });
}

/**
 * Builds the pdfmake document for a stock issue ("Phiếu xuất kho"): header, document info,
 * FEFO pick lines (product + lot + expiry + location), totals and signature blocks.
 * Pure function — no browser APIs — so it is unit-tested in Node.
 */
export function buildIssuePdf(issue: IssueDto, ctx: IssuePdfContext, t: Translate): TDocumentDefinitions {
  const items = issue.items ?? [];
  const total = items.reduce((sum, i) => sum + i.quantity, 0);

  const header = (text: string, align: "left" | "center" | "right" = "left"): TableCell => ({ text, style: "th", alignment: align });
  const rows: TableCell[][] = [
    [
      header(t("pdf.col.no"), "center"),
      header(t("pdf.col.sku")),
      header(t("pdf.col.name")),
      header(t("pdf.col.lot")),
      header(t("pdf.col.expiry"), "center"),
      header(t("pdf.col.location")),
      header(t("pdf.col.unit"), "center"),
      header(t("pdf.col.quantity"), "right"),
    ],
    ...items.map((item, index): TableCell[] => [
      { text: String(index + 1), alignment: "center" },
      { text: item.productSku, bold: true },
      { text: item.productName },
      { text: item.lotNumber },
      { text: formatDate(item.expirationDate), alignment: "center", noWrap: true },
      { text: item.locationCode, color: BRAND, bold: true, noWrap: true },
      { text: item.unit, alignment: "center" },
      { text: formatNumber(item.quantity), alignment: "right", bold: true },
    ]),
    [
      { text: t("pdf.total"), colSpan: 7, alignment: "right", bold: true },
      {},
      {},
      {},
      {},
      {},
      {},
      { text: formatNumber(total), alignment: "right", bold: true },
    ],
  ];

  const info = (label: string, value: string | null | undefined): Content => ({
    columns: [
      { text: `${label}:`, width: 130, color: MUTED },
      { text: value || "—", width: "*" },
    ],
    margin: [0, 1.5, 0, 1.5],
  });

  const signature = (title: string, name?: string | null): Content => ({
    stack: [
      { text: title, bold: true, alignment: "center" },
      { text: t("pdf.signHint"), italics: true, color: MUTED, fontSize: 8, alignment: "center", margin: [0, 2, 0, 0] },
      { text: name ?? " ", alignment: "center", margin: [0, 48, 0, 0] },
    ],
  });

  const cancelled = issue.status === "CANCELLED";

  return {
    pageSize: "A4",
    pageMargins: [36, 36, 36, 48],
    info: { title: `${t("pdf.title")} ${issue.issueNumber}`, author: ctx.companyName, subject: t("pdf.title"), creator: "WMS Pro" },
    defaultStyle: { font: "Roboto", fontSize: 9.5, lineHeight: 1.15, color: "#0f172a" },
    styles: {
      company: { fontSize: 12, bold: true, color: NAVY },
      title: { fontSize: 18, bold: true, color: NAVY, alignment: "center", characterSpacing: 1 },
      th: { bold: true, color: "#ffffff", fillColor: NAVY, fontSize: 8 },
      table: { fontSize: 8.5 },
    },
    watermark: cancelled ? { text: t("pdf.cancelled"), color: "#dc2626", opacity: 0.15, bold: true } : undefined,
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: t("pdf.printedAt", { time: formatDateTime(ctx.printedAt.toISOString()), user: ctx.printedBy }), color: MUTED, fontSize: 7.5 },
        { text: t("pdf.page", { current: currentPage, total: pageCount }), alignment: "right", color: MUTED, fontSize: 7.5 },
      ],
      margin: [36, 16, 36, 0],
    }),
    content: [
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: ctx.companyName.toUpperCase(), style: "company" },
              { text: `${t("pdf.warehouse")}: ${ctx.warehouseCode} - ${ctx.warehouseName}`, margin: [0, 3, 0, 0] },
              ctx.warehouseAddress ? { text: `${t("pdf.address")}: ${ctx.warehouseAddress}`, color: MUTED } : { text: "" },
            ],
          },
          {
            width: 170,
            table: {
              widths: ["*"],
              body: [
                [{ text: t("pdf.number", { number: issue.issueNumber }), bold: true, alignment: "center", color: BRAND }],
                [{ text: t(`status.${issue.status}`), alignment: "center", color: cancelled ? "#dc2626" : "#16a34a", bold: true }],
              ],
            },
            layout: { hLineColor: () => BORDER, vLineColor: () => BORDER },
          },
        ],
      },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 1.5, lineColor: BRAND }], margin: [0, 10, 0, 12] },
      { text: t("pdf.title"), style: "title" },
      { text: dateInWords(issue.issueDate, t), alignment: "center", italics: true, color: MUTED, margin: [0, 3, 0, 14] },

      info(t("pdf.recipient"), issue.recipient),
      info(t("pdf.reason"), t(`issueReason.${issue.reason}`)),
      info(t("pdf.issueWarehouse"), `${ctx.warehouseCode} - ${ctx.warehouseName}`),
      info(t("pdf.createdBy"), issue.createdByName),
      info(t("pdf.confirmedAt"), formatDateTime(issue.confirmedAt)),
      ...(issue.notes ? [info(t("pdf.notes"), issue.notes)] : []),

      {
        style: "table",
        table: { headerRows: 1, dontBreakRows: true, widths: [20, 38, "*", 60, 52, 106, 28, 42], body: rows },
        layout: {
          hLineColor: () => BORDER,
          vLineColor: () => BORDER,
          fillColor: (rowIndex: number) => (rowIndex > 0 && rowIndex < rows.length - 1 && rowIndex % 2 === 0 ? "#f1f5f9" : rowIndex === rows.length - 1 ? "#e2e8f0" : null),
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
        margin: [0, 12, 0, 6],
      },
      { text: t("pdf.fefoNote"), italics: true, color: MUTED, fontSize: 8 },
      { text: t("pdf.totalLine", { lines: items.length, quantity: formatNumber(total) }), margin: [0, 4, 0, 0] },

      { text: dateInWords(issue.issueDate, t), alignment: "right", italics: true, margin: [0, 18, 0, 6] },
      {
        columns: [signature(t("pdf.sign.preparedBy"), issue.createdByName), signature(t("pdf.sign.receiver")), signature(t("pdf.sign.storekeeper")), signature(t("pdf.sign.director"))],
        unbreakable: true,
      },
    ],
  };
}

export function issuePdfFileName(issue: Pick<IssueDto, "issueNumber">): string {
  return `PhieuXuatKho_${issue.issueNumber}.pdf`;
}

/** Lazily loads pdfmake (~1 MB incl. Vietnamese-capable Roboto) only when the user exports. */
export async function downloadIssuePdf(issue: IssueDto, ctx: IssuePdfContext, t: Translate): Promise<void> {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([import("pdfmake/build/pdfmake"), import("pdfmake/build/vfs_fonts")]);
  pdfMake.addVirtualFileSystem(vfs);
  pdfMake.setFonts({
    Roboto: { normal: "Roboto-Regular.ttf", bold: "Roboto-Medium.ttf", italics: "Roboto-Italic.ttf", bolditalics: "Roboto-MediumItalic.ttf" },
  });
  await pdfMake.createPdf(buildIssuePdf(issue, ctx, t)).download(issuePdfFileName(issue));
}
