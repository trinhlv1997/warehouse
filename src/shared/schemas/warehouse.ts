import { z } from "zod";
import { ACTIVE_STATUSES, ZONE_TYPES } from "../constants";
import { code, idString, nonNegativeInt, optionalText, requiredText } from "./common";

export const zoneInputSchema = z.object({
  warehouseId: idString,
  code: code(10),
  name: requiredText(120),
  zoneType: z.enum(ZONE_TYPES).default("GENERAL"),
  description: optionalText(500),
  status: z.enum(ACTIVE_STATUSES).default("ACTIVE"),
  mapX: z.coerce.number().int().min(0).max(100).default(0),
  mapY: z.coerce.number().int().min(0).max(100).default(0),
  mapWidth: z.coerce.number().int().min(4).max(100).default(20),
  mapHeight: z.coerce.number().int().min(4).max(100).default(20),
});
export type ZoneInput = z.input<typeof zoneInputSchema>;

/** Creating a rack also generates its levels and bins. */
export const rackCreateSchema = z.object({
  zoneId: idString,
  code: code(10),
  name: requiredText(120),
  levelCount: z.coerce.number().int().min(1).max(20),
  binsPerLevel: z.coerce.number().int().min(1).max(50),
  binCapacity: z.coerce.number().int().min(1).max(1_000_000),
});
export type RackCreateInput = z.input<typeof rackCreateSchema>;

export const rackUpdateSchema = z.object({
  name: requiredText(120),
  status: z.enum(ACTIVE_STATUSES),
});

export const binUpdateSchema = z.object({
  capacity: nonNegativeInt,
  status: z.enum(ACTIVE_STATUSES),
});
export type BinUpdateInput = z.input<typeof binUpdateSchema>;

export const warehouseUpdateSchema = z.object({
  name: requiredText(200),
  address: optionalText(300),
});
