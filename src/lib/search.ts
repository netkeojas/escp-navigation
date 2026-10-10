import Fuse, { type IFuseOptions } from 'fuse.js';
import type { Category, Room } from '../types';

/**
 * Two-tier search, ported from the previous app (src/App.tsx exact/fuzzy pass).
 * The structure was sound: try a diacritic-insensitive exact match first so
 * typing "D-275" can never be outranked by a fuzzy hit, and only fall back to
 * Fuse when nothing matches exactly.
 *
 * Changed from the original: the person branch is gone (staff data was dropped),
 * aliases are a real array rather than a pipe-delimited string, and the category
 * intersection now actually works -- it was a no-op before because the CSV
 * column was `Id` while the code read `id`, so every id was undefined.
 */

export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** 'D275' and 'd 275' should both find 'D-275'. */
function squash(s: string): string {
  return normalize(s).replace(/[^\p{L}\p{N}]+/gu, '');
}

const FUSE_OPTIONS: IFuseOptions<Room> = {
  keys: [
    { name: 'code', weight: 0.45 },
    { name: 'name', weight: 0.25 },
    { name: 'aliases', weight: 0.2 },
    { name: 'category', weight: 0.05 },
    { name: 'note', weight: 0.05 },
  ],
  threshold: 0.34,
  ignoreLocation: true,
  minMatchCharLength: 2,
};

export function createIndex(rooms: Room[]): Fuse<Room> {
  return new Fuse(rooms, FUSE_OPTIONS);
}

export interface SearchOptions {
  category?: Category | null;
  limit?: number;
}

export interface SearchResult {
  rooms: Room[];
  /** Codes that matched exactly, for the "exact match" affordance. */
  exact: Set<string>;
}

export function searchRooms(
  rooms: Room[],
  index: Fuse<Room>,
  rawQuery: string,
  opts: SearchOptions = {},
): SearchResult {
  const base = opts.category ? rooms.filter((r) => r.category === opts.category) : rooms;
  const query = rawQuery.trim();
  const limit = opts.limit ?? 60;

  if (!query) return { rooms: base.slice(0, limit), exact: new Set() };

  const q = normalize(query);
  const qs = squash(query);

  const exactHits = base.filter((room) => {
    if (normalize(room.code) === q || squash(room.code) === qs) return true;
    if (normalize(room.name) === q) return true;
    return room.aliases.some((a) => normalize(a) === q || squash(a) === qs);
  });

  if (exactHits.length) {
    return { rooms: exactHits, exact: new Set(exactHits.map((r) => r.code)) };
  }

  // Substring pass sits between exact and fuzzy: "post study" should find
  // "Post-Study Affairs" without Fuse's edit distance getting a say.
  const substring = base.filter(
    (room) =>
      normalize(room.code).includes(q) ||
      normalize(room.name).includes(q) ||
      room.aliases.some((a) => normalize(a).includes(q)),
  );

  const allowed = new Set(base.map((r) => r.code));
  const fuzzy = index
    .search(query)
    .map((r) => r.item)
    .filter((r) => allowed.has(r.code));

  const merged: Room[] = [];
  const seen = new Set<string>();
  for (const r of [...substring, ...fuzzy]) {
    if (seen.has(r.code)) continue;
    seen.add(r.code);
    merged.push(r);
  }

  return { rooms: merged.slice(0, limit), exact: new Set() };
}
