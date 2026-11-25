import { z } from "zod";
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "../constants";

/** Business date, always 'YYYY-MM-DD'. */
export const dateString = z.iso.date();

export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const requiredText = (max = 200) => z.string().trim().min(1).max(max);

export const code = (max = 30) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/^[A-Za-z0-9_.-]+$/, "INVALID_CODE")
    .transform((v) => v.toUpperCase());

export const idString = z.string().trim().min(1).max(64);

export const positiveInt = z.coerce.number().int().positive().max(1_000_000_000);
export const nonNegativeInt = z.coerce.number().int().min(0).max(1_000_000_000);

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
  search: z.string().trim().max(100).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;
