import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { FloorMap } from '../../types';
import s from './Admin.module.css';
import app from '../../app/App.module.css';

const BUCKET = 'floor-maps';
/** Aspect ratios closer than this are treated as the same framing. */
const ASPECT_TOLERANCE = 0.01;

export function MapUploader() {
  const [maps, setMaps] = useState<FloorMap[] | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase!.from('floor_maps').select('*').order('level');
    if (error) { setMessage({ kind: 'error', text: error.message }); return; }
    setMaps((data ?? []).map(fromRow));
  };
  useEffect(() => { void load(); }, []);

  const upload = async (map: FloorMap, file: File) => {
    setBusy(map.slug);
    setMessage(null);
    try {
      const dims = await readDimensions(file);
      const oldAspect = map.width / map.height;
      const newAspect = dims.w / dims.h;
      const drift = Math.abs(newAspect - oldAspect) / oldAspect;

      // A re-cropped plan silently invalidates every pin on the sheet, and there
      // is no visual pin editor to repair them with -- so make the consequence
      // explicit before accepting the file.
      let bumpVersion = false;
      if (drift > ASPECT_TOLERANCE) {
        const ok = window.confirm(
          `This image has a different shape to the current one ` +
          `(${dims.w}×${dims.h} vs ${map.width}×${map.height}).\n\n` +
          `Every pin on "${map.label}" was positioned against the old image and will ` +
          `no longer line up. If you continue, those rooms are hidden from the public ` +
          `app until their coordinates are re-checked in the room editor.\n\n` +
          `Continue?`,
        );
        if (!ok) { setBusy(null); return; }
        bumpVersion = true;
      }

      const version = map.imageVersion + (bumpVersion ? 1 : 0);
      const path = `${map.slug}.v${version}.png`;
      const { error: upErr } = await supabase!.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw new Error(upErr.message);

      const { data: pub } = supabase!.storage.from(BUCKET).getPublicUrl(path);
      const { error: rowErr } = await supabase!
        .from('floor_maps')
        .update({
          storage_path: pub.publicUrl,
          width: dims.w,
          height: dims.h,
          image_version: version,
        })
        .eq('slug', map.slug);
      if (rowErr) throw new Error(rowErr.message);

      setMessage({
        kind: 'ok',
        text: bumpVersion
          ? `Uploaded. Pins on ${map.label} are now hidden pending review.`
          : `Uploaded ${map.label}.`,
      });
      void load();
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Upload failed.' });
    }
    setBusy(null);
  };

  if (!maps) return <p className={app.empty}>Loading floor plans…</p>;

  return (
    <section className={s.card}>
      <h2 className={app.groupTitle}>Floor plan images</h2>
      <p style={{ marginBottom: 14 }}>
        Replacing an image takes effect immediately. Keep the same dimensions
        (2000×1120) wherever possible — a differently cropped plan invalidates every pin
        on that sheet.
      </p>
      {message && (
        <p className={message.kind === 'ok' ? s.ok : s.error} role="status">{message.text}</p>
      )}

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th scope="col">Plan</th><th scope="col">Size</th>
              <th scope="col">Version</th><th scope="col">Replace</th>
            </tr>
          </thead>
          <tbody>
            {maps.map((m) => (
              <tr key={m.slug}>
                <td><strong>{m.label}</strong></td>
                <td>{m.width}×{m.height}</td>
                <td>v{m.imageVersion}</td>
                <td>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    aria-label={`Replace the image for ${m.label}`}
                    disabled={busy === m.slug}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void upload(m, f);
                      e.target.value = '';
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function readDimensions(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function fromRow(m: any): FloorMap {
  return {
    slug: m.slug, label: m.label, buildings: m.buildings, level: m.level,
    fallbackPath: m.fallback_path, storagePath: m.storage_path ?? null,
    width: m.width ?? 2000, height: m.height ?? 1120, planRect: m.plan_rect,
    imageVersion: m.image_version ?? 1, sortOrder: m.sort_order ?? 100,
  };
}
