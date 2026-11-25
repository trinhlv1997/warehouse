import { z } from "zod";
import { ACTIVE_STATUSES, EXPIRY_STATUSES, LOT_STATUSES, TRANSACTION_TYPES } from "../../shared/constants";
import { dateString, paginationQuery } from "../../shared/schemas";

const optionalId = z.string().trim().max(64).optional();

export const positionsQuery = paginationQuery.extend({
  productId: optionalId,
  lotId: optionalId,
  zoneId: optionalId,
  rackId: optionalId,
  binId: optionalId,
  lotStatus: z.enum(LOT_STATUSES).optional(),
  expiryStatus: z.enum(EXPIRY_STATUSES).optional(),
  expFrom: dateString.optional(),
  expTo: dateString.optional(),
  orderBy: z.enum(["expiry", "location", "product"]).optional(),
});

export const transactionsQuery = paginationQuery.extend({
  productId: optionalId,
  lotId: optionalId,
  binId: optionalId,
  type: z.enum(TRANSACTION_TYPES).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
});

export const binsQuery = paginationQuery.extend({
  zoneId: optionalId,
  rackId: optionalId,
  status: z.enum(ACTIVE_STATUSES).optional(),
  occupancy: z.enum(["EMPTY", "OCCUPIED", "NEAR_CAPACITY", "FULL"]).optional(),
});

export const reportQuery = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
  productId: optionalId,
  zoneId: optionalId,
  categoryId: optionalId,
  expFrom: dateString.optional(),
  expTo: dateString.optional(),
  format: z.enum(["json", "csv"]).default("json"),
});

export const auditQuery = paginationQuery.extend({ entityType: z.string().max(60).optional() });

export const searchQuery = z.object({ search: z.string().trim().max(100).optional() });
export const locationSearchQuery = z.object({ search: z.string().trim().min(1).max(100) });
