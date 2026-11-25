import { z } from "zod";
import { ACTIVE_STATUSES, ZONE_TYPES } from "../constants";
import { MAP_WIDTH } from "../mapLayout";
import { code, idString, nonNegativeInt, optionalText, requiredText } from "./common";

/** Optional map coordinate: empty / missing = let the server pick a free spot. */
const mapNumber = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().int().min(min).max(max).optional());

export const zoneInputSchema = z
  .object({
    warehouseId: idString,
    code: code(10),
    name: requiredText(120),
    zoneType: z.enum(ZONE_TYPES).default("GENERAL"),
    description: optionalText(500),
    status: z.enum(ACTIVE_STATUSES).default("ACTIVE"),
    mapX: mapNumber(0, MAP_WIDTH - 4),
    mapY: mapNumber(0, 500),
    mapWidth: mapNumber(4, MAP_WIDTH),
    mapHeight: mapNumber(4, 100),
  })
  .refine((v) => v.mapX === undefined || v.mapWidth === undefined || v.mapX + v.mapWidth <= MAP_WIDTH, {
    path: ["mapWidth"],
    message: "MAP_OUT_OF_BOUNDS",
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
  /** Prefix of every location code (WH001-A-A01-L01-B01); letters and digits only. */
  code: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .regex(/^[A-Za-z0-9]+$/, "WAREHOUSE_CODE")
    .transform((v) => v.toUpperCase()),
  name: requiredText(200),
  address: optionalText(300),
});
