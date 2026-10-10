import { useEffect, useMemo, useState } from 'react';
import type { FloorMap, Room } from '../types';
import { ROOMS } from '../data/rooms';
import { FLOOR_MAPS } from '../data/maps';
import { supabase } from './supabase';
import { store } from './storage';

/**
 * Seed-first, Supabase-refresh.
 *
 * Tier 0 is the snapshot compiled into the bundle -- it paints synchronously on
 * first render, so the app is fully usable with zero successful API calls. That
 * matters more than freshness here: the failure mode on campus is not "wifi is
 * down" (browsers fail that fast) but wifi that associates and then stalls,
 * which would leave a Supabase-first app showing a spinner to someone standing
 * in a corridor already late.
 *
 * Tier 1 is a localStorage copy from a previous visit, used only when it is
 * newer than the running bundle. Tier 2 is the live fetch, with a hard timeout.
 */

const CACHE_KEY = 'escp.roomdata.v1';
const FETCH_TIMEOUT_MS = 4000;
const REVALIDATE_AFTER_MS = 10 * 60 * 1000;
const STALE_NOTICE_AFTER_MS = 24 * 60 * 60 * 1000;

/** Injected at build time; identifies the bundled snapshot. */
const BUILD_STAMP = __BUILD_STAMP__;

interface Cached {
  fetchedAt: number;
  buildStamp: string;
  rooms: Room[];
  maps: FloorMap[];
}

export interface RoomData {
  rooms: Room[];
  maps: FloorMap[];
  /** True when showing data older than a day with no successful refresh. */
  stale: boolean;
  source: 'bundle' | 'cache' | 'live';
}

function readCache(): Cached | null {
  try {
    const raw = store.get(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached;
    // A cache written before a correcting deploy must never outrank the
    // snapshot that deploy shipped.
    if (c.buildStamp !== BUILD_STAMP) return null;
    if (!Array.isArray(c.rooms) || !c.rooms.length) return null;
    return c;
  } catch {
    return null;
  }
}

export function useRoomData(): RoomData {
  const initial = useMemo<RoomData>(() => {
    const cached = readCache();
    if (cached) {
      return {
        rooms: cached.rooms,
        maps: cached.maps,
        stale: Date.now() - cached.fetchedAt > STALE_NOTICE_AFTER_MS,
        source: 'cache',
      };
    }
    return { rooms: ROOMS, maps: FLOOR_MAPS, stale: false, source: 'bundle' };
  }, []);

  const [data, setData] = useState<RoomData>(initial);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let cancelled = false;

    const refresh = async () => {
      const cached = readCache();
      if (cached && Date.now() - cached.fetchedAt < REVALIDATE_AFTER_MS) return;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const [roomsRes, mapsRes] = await Promise.all([
          client.from('rooms').select('*').abortSignal(controller.signal),
          client.from('floor_maps').select('*').abortSignal(controller.signal),
        ]);
        clearTimeout(timer);
        if (cancelled || roomsRes.error || mapsRes.error) return;
        if (!roomsRes.data?.length) return;

        const rooms = roomsRes.data.map(fromRow);
        const maps = (mapsRes.data ?? []).map(fromMapRow);
        setData({ rooms, maps, stale: false, source: 'live' });
        store.set(
          CACHE_KEY,
          JSON.stringify({ fetchedAt: Date.now(), buildStamp: BUILD_STAMP, rooms, maps }),
        );
      } catch {
        clearTimeout(timer);
        // Silent by design -- the bundled snapshot is already on screen.
      }
    };

    void refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return data;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function fromRow(r: any): Room {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    building: r.building,
    level: r.level,
    category: r.category,
    aliases: r.aliases ?? [],
    note: r.note ?? null,
    accessNode: r.access_node,
    localHint: r.local_hint ?? null,
    mapSlug: r.map_slug ?? null,
    pin: r.pin_x != null && r.pin_y != null ? { x: r.pin_x, y: r.pin_y } : null,
    shape: r.shape ?? null,
    geometryVersion: r.geometry_version ?? 1,
    isActive: r.is_active ?? true,
  };
}

function fromMapRow(m: any): FloorMap {
  return {
    slug: m.slug,
    label: m.label,
    buildings: m.buildings,
    level: m.level,
    fallbackPath: m.fallback_path,
    storagePath: m.storage_path ?? null,
    width: m.width ?? 2000,
    height: m.height ?? 1120,
    planRect: m.plan_rect,
    imageVersion: m.image_version ?? 1,
    sortOrder: m.sort_order ?? 100,
  };
}
