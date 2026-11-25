// 2D warehouse map geometry, shared by the API (validation, auto-placement) and the SPA (rendering, preview).
// Coordinates are grid units: the map is MAP_WIDTH units wide and grows downwards as zones are added.

export const MAP_WIDTH = 100;
export const MIN_MAP_HEIGHT = 60;
/** Minimum free space kept between two zones (aisles). */
export const MAP_GAP = 2;
export const DEFAULT_ZONE_SIZE = { width: 30, height: 20 } as const;

export interface MapRect {
  mapX: number;
  mapY: number;
  mapWidth: number;
  mapHeight: number;
}

/** True when the rectangles overlap or are closer than `gap` units. */
export function rectsOverlap(a: MapRect, b: MapRect, gap = 0): boolean {
  return a.mapX < b.mapX + b.mapWidth + gap && b.mapX < a.mapX + a.mapWidth + gap && a.mapY < b.mapY + b.mapHeight + gap && b.mapY < a.mapY + a.mapHeight + gap;
}

export function findOverlap<T extends MapRect>(rect: MapRect, others: T[]): T | undefined {
  return others.find((o) => rectsOverlap(rect, o));
}

/** Map height needed to show every zone (never smaller than the classic 100 x 60 floor plan). */
export function mapHeight(zones: MapRect[]): number {
  const bottom = zones.reduce((max, z) => Math.max(max, z.mapY + z.mapHeight), 0);
  return Math.max(MIN_MAP_HEIGHT, bottom + MAP_GAP);
}

/**
 * First free position (top-to-bottom, left-to-right) for a zone of the given size, keeping
 * MAP_GAP units of aisle around existing zones. Falls back to a new row below everything.
 */
export function findFreeSlot(others: MapRect[], width: number = DEFAULT_ZONE_SIZE.width, height: number = DEFAULT_ZONE_SIZE.height): { mapX: number; mapY: number } {
  const w = Math.min(width, MAP_WIDTH - 2 * MAP_GAP);
  const bottom = others.reduce((max, z) => Math.max(max, z.mapY + z.mapHeight), 0);
  for (let y = MAP_GAP; y <= bottom + MAP_GAP; y++) {
    for (let x = MAP_GAP; x + w <= MAP_WIDTH - MAP_GAP; x++) {
      const candidate = { mapX: x, mapY: y, mapWidth: w, mapHeight: height };
      if (!others.some((o) => rectsOverlap(candidate, o, MAP_GAP))) return { mapX: x, mapY: y };
    }
  }
  return { mapX: MAP_GAP, mapY: bottom + MAP_GAP };
}
