import type { FloorMap } from '../types';

/**
 * The seven official ESCP Berlin plans, all exported at 2000x1120.
 *
 * `planRect` frames just the architectural drawing so narrow screens can skip
 * the printed legend on the left of each sheet -- that legend is reproduced as
 * real UI by the floor switcher instead.
 *
 * Note `d-second` is sourced from a file the school named "Building B Second
 * Floor.png", which actually depicts Building D's second floor (D-255..D-276).
 * There is consequently no plan for Building B or C level 2.
 */
export const FLOOR_MAPS: FloorMap[] = [
  {
    slug: 'bcd-ground',
    label: 'Campus overview — Buildings B, C & D',
    buildings: ['B', 'C', 'D'],
    level: 0,
    fallbackPath: '/maps/bcd-ground.png',
    storagePath: null,
    width: 2000,
    height: 1120,
    planRect: { x: 0.24, y: 0.02, w: 0.75, h: 0.96 },
    imageVersion: 1,
    // Higher than the per-building sheets: useful for orientation, but a
    // specific room should resolve to its own building's plan.
    sortOrder: 50,
  },
  {
    slug: 'bc-basement',
    label: 'Buildings B & C — Basement',
    buildings: ['B', 'C'],
    level: -1,
    fallbackPath: '/maps/bc-basement.png',
    storagePath: null,
    width: 2000,
    height: 1120,
    planRect: { x: 0.38, y: 0.12, w: 0.45, h: 0.83 },
    imageVersion: 1,
    sortOrder: 10,
  },
  {
    slug: 'bc-ground',
    label: 'Buildings B & C — Ground floor',
    buildings: ['B', 'C'],
    level: 0,
    fallbackPath: '/maps/bc-ground.png',
    storagePath: null,
    width: 2000,
    height: 1120,
    planRect: { x: 0.38, y: 0.04, w: 0.45, h: 0.93 },
    imageVersion: 1,
    sortOrder: 10,
  },
  {
    slug: 'bc-first',
    label: 'Buildings B & C — 1st floor',
    buildings: ['B', 'C'],
    level: 1,
    fallbackPath: '/maps/bc-first.png',
    storagePath: null,
    width: 2000,
    height: 1120,
    planRect: { x: 0.34, y: 0.07, w: 0.52, h: 0.88 },
    imageVersion: 1,
    sortOrder: 10,
  },
  {
    slug: 'd-ground',
    label: 'Building D — Ground floor',
    buildings: ['D'],
    level: 0,
    fallbackPath: '/maps/d-ground.png',
    storagePath: null,
    width: 2000,
    height: 1120,
    planRect: { x: 0.24, y: 0.13, w: 0.71, h: 0.75 },
    imageVersion: 1,
    sortOrder: 10,
  },
  {
    slug: 'd-first',
    label: 'Building D — 1st floor',
    buildings: ['D'],
    level: 1,
    fallbackPath: '/maps/d-first.png',
    storagePath: null,
    width: 2000,
    height: 1120,
    planRect: { x: 0.24, y: 0.28, w: 0.71, h: 0.52 },
    imageVersion: 1,
    sortOrder: 10,
  },
  {
    slug: 'd-second',
    label: 'Building D — 2nd floor',
    buildings: ['D'],
    level: 2,
    fallbackPath: '/maps/d-second.png',
    storagePath: null,
    width: 2000,
    height: 1120,
    planRect: { x: 0.24, y: 0.30, w: 0.71, h: 0.51 },
    imageVersion: 1,
    sortOrder: 10,
  },
];

export const MAPS_BY_SLUG: ReadonlyMap<string, FloorMap> = new Map(
  FLOOR_MAPS.map((m) => [m.slug, m]),
);

/** The sheet a room on this building+level should be shown on. */
export function defaultSheet(building: string, level: number): FloorMap | undefined {
  return FLOOR_MAPS.filter(
    (m) => m.level === level && m.buildings.includes(building as never),
  ).sort((a, b) => a.sortOrder - b.sortOrder)[0];
}
