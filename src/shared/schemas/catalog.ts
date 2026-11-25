import { z } from "zod";
import { ACTIVE_STATUSES, LOT_STATUSES, PRODUCT_STATUSES } from "../constants";
import { code, idString, nonNegativeInt, optionalText, paginationQuery, requiredText } from "./common";

export const categoryInputSchema = z.object({
  code: code(),
  name: requiredText(120),
  description: optionalText(500),
  status: z.enum(ACTIVE_STATUSES).default("ACTIVE"),
});
export type CategoryInput = z.input<typeof categoryInputSchema>;

export const supplierInputSchema = z.object({
  code: code(),
  name: requiredText(200),
  contactName: optionalText(120),
  phone: optionalText(30),
  email: z.union([z.email(), z.literal(""), z.null()]).optional().transform((v) => (v ? v : null)),
  address: optionalText(300),
  status: z.enum(ACTIVE_STATUSES).default("ACTIVE"),
});
export type SupplierInput = z.input<typeof supplierInputSchema>;

export const productInputSchema = z
  .object({
    sku: code(40),
    name: requiredText(200),
    categoryId: idString.nullable().optional().transform((v) => v || null),
    barcode: optionalText(64),
    unit: requiredText(20),
    description: optionalText(2000),
    minStock: nonNegativeInt.default(0),
    maxStock: z
      .union([nonNegativeInt, z.literal(""), z.null()])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    status: z.enum(PRODUCT_STATUSES).default("ACTIVE"),
  })
  .refine((v) => v.maxStock === null || v.maxStock >= v.minStock, {
    path: ["maxStock"],
    message: "MAX_LESS_THAN_MIN",
  });
export type ProductInput = z.input<typeof productInputSchema>;

export const productListQuery = paginationQuery.extend({
  categoryId: z.string().optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  lowStock: z.enum(["1"]).optional(),
});

export const lotStatusUpdateSchema = z.object({
  status: z.enum(LOT_STATUSES),
  notes: optionalText(500),
});

export const lotListQuery = paginationQuery.extend({
  productId: z.string().optional(),
  status: z.enum(LOT_STATUSES).optional(),
  expiryStatus: z.enum(["EXPIRED", "CRITICAL", "WARNING", "NOTICE", "SAFE", "NO_EXPIRY"]).optional(),
  hasStock: z.enum(["1"]).optional(),
});
