/**
 * One-shot seed: pushes the bundled snapshot into a fresh Supabase project.
 *
 * Run with the SERVICE ROLE key, locally, never from the browser:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npm run seed
 */
import { createClient } from '@supabase/supabase-js';
import { ROOMS } from '../src/data/rooms';
import { FLOOR_MAPS } from '../src/data/maps';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const maps = FLOOR_MAPS.map((m) => ({
  slug: m.slug, label: m.label, buildings: m.buildings, level: m.level,
  fallback_path: m.fallbackPath, storage_path: m.storagePath,
  width: m.width, height: m.height, plan_rect: m.planRect,
  image_version: m.imageVersion, sort_order: m.sortOrder,
}));

const rooms = ROOMS.map((r) => ({
  code: r.code, name: r.name, building: r.building, level: r.level,
  category: r.category, aliases: r.aliases, note: r.note,
  access_node: r.accessNode, local_hint: r.localHint, map_slug: r.mapSlug,
  pin_x: r.pin?.x ?? null, pin_y: r.pin?.y ?? null, shape: r.shape,
  geometry_version: r.geometryVersion, is_active: r.isActive,
}));

const mapsRes = await db.from('floor_maps').upsert(maps, { onConflict: 'slug' });
if (mapsRes.error) { console.error('floor_maps:', mapsRes.error.message); process.exit(1); }
console.log(`floor_maps: ${maps.length} rows`);

const roomsRes = await db.from('rooms').upsert(rooms, { onConflict: 'code' });
if (roomsRes.error) { console.error('rooms:', roomsRes.error.message); process.exit(1); }
console.log(`rooms: ${rooms.length} rows`);
console.log('\nDone. Upload the PNGs in public/maps/ to the floor-maps bucket if you want');
console.log('admin image replacement to work; the committed copies serve as the fallback.');
