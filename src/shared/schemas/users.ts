import { z } from "zod";
import { ACTIVE_STATUSES, ROLES } from "../constants";
import { optionalText, requiredText } from "./common";

export const userCreateSchema = z.object({
  email: z.email().trim().toLowerCase(),
  fullName: requiredText(120),
  phone: optionalText(30),
  password: z.string().min(8).max(200),
  roles: z.array(z.enum(ROLES)).min(1),
  status: z.enum(ACTIVE_STATUSES).default("ACTIVE"),
});
export type UserCreateInput = z.input<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  fullName: requiredText(120),
  phone: optionalText(30),
  roles: z.array(z.enum(ROLES)).min(1),
  status: z.enum(ACTIVE_STATUSES),
  /** Optional password reset by an admin. */
  password: z
    .union([z.string().min(8).max(200), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
});
export type UserUpdateInput = z.input<typeof userUpdateSchema>;

export const tenantSettingsSchema = z.object({
  companyName: requiredText(200),
  slowMovingDays: z.coerce.number().int().min(7).max(720),
  nearCapacityPercent: z.coerce.number().int().min(50).max(99),
});
export type TenantSettingsInput = z.input<typeof tenantSettingsSchema>;
