import { z } from "zod";
import { ISSUE_REASONS } from "../constants";
import { dateString, idString, nonNegativeInt, optionalText, positiveInt, requiredText } from "./common";

const nullableDate = z
  .union([dateString, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

export const receiptItemSchema = z
  .object({
    productId: idString,
    lotNumber: requiredText(60).transform((v) => v.toUpperCase()),
    manufacturingDate: nullableDate,
    expirationDate: nullableDate,
    binId: idString,
    quantity: positiveInt,
  })
  .refine((v) => !v.manufacturingDate || !v.expirationDate || v.expirationDate >= v.manufacturingDate, {
    path: ["expirationDate"],
    message: "EXPIRY_BEFORE_MANUFACTURING",
  });

export const receiptInputSchema = z.object({
  supplierId: idString.nullable().optional().transform((v) => v || null),
  receiptDate: dateString,
  referenceNo: optionalText(60),
  notes: optionalText(1000),
  items: z.array(receiptItemSchema).min(1).max(200),
});
export type ReceiptInput = z.input<typeof receiptInputSchema>;
export type ReceiptInputParsed = z.output<typeof receiptInputSchema>;

export const issueLineSchema = z.object({
  productId: idString,
  quantity: positiveInt,
});

export const fefoPreviewSchema = z.object({
  lines: z.array(issueLineSchema).min(1).max(100),
});
export type FefoPreviewInput = z.input<typeof fefoPreviewSchema>;

export const issueConfirmSchema = z.object({
  /** Client-generated idempotency key; re-submitting the same key never deducts twice. */
  requestKey: z.string().trim().min(8).max(64),
  issueDate: dateString,
  recipient: optionalText(200),
  reason: z.enum(ISSUE_REASONS).default("SALE"),
  notes: optionalText(1000),
  lines: z.array(issueLineSchema).min(1).max(100),
  /** Fingerprint returned by fefo-preview; confirmation fails with STOCK_CHANGED if stock moved since. */
  previewFingerprint: z.string().max(200).optional(),
});
export type IssueConfirmInput = z.input<typeof issueConfirmSchema>;

export const transferItemSchema = z
  .object({
    lotId: idString,
    fromBinId: idString,
    toBinId: idString,
    quantity: positiveInt,
  })
  .refine((v) => v.fromBinId !== v.toBinId, { path: ["toBinId"], message: "SAME_BIN" });

export const transferInputSchema = z.object({
  transferDate: dateString,
  reason: optionalText(200),
  notes: optionalText(1000),
  items: z.array(transferItemSchema).min(1).max(100),
});
export type TransferInput = z.input<typeof transferInputSchema>;

export const stocktakingCreateSchema = z
  .object({
    scopeType: z.enum(["ALL", "ZONE", "RACK"]),
    scopeIds: z.array(idString).max(50).default([]),
    notes: optionalText(1000),
  })
  .refine((v) => v.scopeType === "ALL" || v.scopeIds.length > 0, { path: ["scopeIds"], message: "SCOPE_REQUIRED" });
export type StocktakingCreateInput = z.input<typeof stocktakingCreateSchema>;

export const stocktakingCountSchema = z.object({
  counts: z
    .array(
      z.object({
        itemId: idString,
        countedQuantity: nonNegativeInt.nullable(),
        notes: optionalText(300),
      }),
    )
    .min(1)
    .max(1000),
});
export type StocktakingCountInput = z.input<typeof stocktakingCountSchema>;

export const documentListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.string().max(20).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
});
