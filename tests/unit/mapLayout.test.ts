import { describe, expect, it } from "vitest";
import { MAP_GAP, findFreeSlot, findOverlap, mapHeight, rectsOverlap } from "@/shared/mapLayout";

const r = (mapX: number, mapY: number, mapWidth: number, mapHeight: number) => ({ mapX, mapY, mapWidth, mapHeight });
// the demo floor plan: three zones on top, two below, filling the 100 x 60 area
const demo = [r(2, 2, 30, 26), r(35, 2, 30, 26), r(68, 2, 30, 26), r(2, 32, 46, 26), r(52, 32, 46, 26)];

describe("warehouse map layout", () => {
  it("detects overlaps (touching edges are allowed, aisles optional)", () => {
    expect(rectsOverlap(r(0, 0, 10, 10), r(5, 5, 10, 10))).toBe(true);
    expect(rectsOverlap(r(0, 0, 10, 10), r(10, 0, 10, 10))).toBe(false);
    expect(rectsOverlap(r(0, 0, 10, 10), r(11, 0, 10, 10), MAP_GAP)).toBe(true);
    expect(findOverlap(r(5, 1, 50, 20), demo)).toBe(demo[0]); // the "Khu VIP" case
  });

  it("places a new zone below a full floor plan and grows the map", () => {
    const slot = findFreeSlot(demo, 30, 20);
    expect(slot).toEqual({ mapX: 2, mapY: 60 });
    const placed = { ...slot, mapWidth: 30, mapHeight: 20 };
    expect(findOverlap(placed, demo)).toBeUndefined();
    expect(mapHeight([...demo, placed])).toBe(82);
    expect(mapHeight(demo)).toBe(60);
  });

  it("fills gaps before growing", () => {
    const slot = findFreeSlot([r(2, 2, 30, 26)], 30, 20);
    expect(slot).toEqual({ mapX: 34, mapY: 2 });
    expect(findFreeSlot([], 30, 20)).toEqual({ mapX: 2, mapY: 2 });
  });
});
