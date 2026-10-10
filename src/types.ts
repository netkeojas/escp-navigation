/** Core domain types for the ESCP room finder. */

export type Building = 'B' | 'C' | 'D';

/** -1 = basement (K rooms), 0 = ground. */
export type Level = -1 | 0 | 1 | 2;

export type Category =
  | 'seminar'
  | 'office'
  | 'service'
  | 'study'
  | 'library'
  | 'facility'
  | 'toilet'
  | 'social'
  | 'outdoor';

/** Normalized 0..1 coordinates against a sheet's 2000x1120 frame. */
export type Point = { x: number; y: number };

export interface FloorMap {
  slug: string;
  label: string;
  /** A single sheet can cover several buildings (e.g. the BCD overview). */
  buildings: Building[];
  level: Level;
  /** Committed baseline under /maps — always available, never null. */
  fallbackPath: string;
  /** Supabase Storage object path; null until an admin uploads a replacement. */
  storagePath: string | null;
  width: number;
  height: number;
  /** Normalized crop of the drawing area, excluding the printed legend. */
  planRect: { x: number; y: number; w: number; h: number };
  /** Bumped whenever the image is replaced; compared against Room.geometryVersion. */
  imageVersion: number;
  /** Lowest wins when several sheets match a (building, level). */
  sortOrder: number;
}

export interface Room {
  id: string;
  /** Canonical, unique, uppercase. 'D-275', 'K-18', 'LIBRARY'. */
  code: string;
  name: string;
  building: Building;
  level: Level;
  category: Category;
  aliases: string[];
  note: string | null;
  /** Graph node this room is entered from. */
  accessNode: string;
  localHint: string | null;
  /** null => no floor plan exists for this room (B/C second floor). */
  mapSlug: string | null;
  /** Every mapped room has a pin; null only when mapSlug is null. */
  pin: Point | null;
  /** Optional polygon highlight, authored for the most-searched rooms. */
  shape: Point[] | null;
  geometryVersion: number;
  isActive: boolean;
}

export const LEVEL_LABELS: Record<Level, string> = {
  [-1]: 'Basement',
  0: 'Ground floor',
  1: '1st floor',
  2: '2nd floor',
};

export const CATEGORY_LABELS: Record<Category, string> = {
  seminar: 'Seminar room',
  office: 'Office',
  service: 'Student service',
  study: 'Study space',
  library: 'Library',
  facility: 'Facility',
  toilet: 'Toilet',
  social: 'Social space',
  outdoor: 'Outdoor',
};

export function levelLabel(level: Level): string {
  return LEVEL_LABELS[level];
}

/** 'Building D · 2nd floor' */
export function placeLabel(room: Pick<Room, 'building' | 'level'>): string {
  return `Building ${room.building} · ${levelLabel(room.level)}`;
}
