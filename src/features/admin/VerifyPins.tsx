import { useState } from 'react';
import type { FloorMap, Room } from '../../types';
import s from './Admin.module.css';
import app from '../../app/App.module.css';

/**
 * Read-only pin check.
 *
 * Replacing a floor plan image can silently invalidate every normalized
 * coordinate on that sheet, and there is no visual pin editor to fix it with.
 * This view exists so drift is caught at upload time rather than reported weeks
 * later by a student who ended up at the wrong door.
 */
export function VerifyPins({ rooms, maps }: { rooms: Room[]; maps: FloorMap[] }) {
  const ordered = [...maps].sort((a, b) => a.level - b.level || a.sortOrder - b.sortOrder);
  const [slug, setSlug] = useState(ordered[0]?.slug ?? '');
  const map = ordered.find((m) => m.slug === slug);
  const onSheet = rooms.filter((r) => r.mapSlug === slug && r.pin);
  const stale = onSheet.filter((r) => r.geometryVersion < (map?.imageVersion ?? 1));

  if (!map) return null;

  return (
    <section className={s.card}>
      <h2 className={app.groupTitle}>Verify pin positions</h2>
      <p style={{ marginBottom: 12 }}>
        Every pin on the selected plan, drawn where the app will place it. This view is
        read-only — use the room editor to correct a position.
      </p>

      <label className={s.label} htmlFor="sheet" style={{ maxWidth: 340, marginBottom: 14 }}>
        Floor plan
        <select
          id="sheet"
          className={s.select}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        >
          {ordered.map((m) => (
            <option key={m.slug} value={m.slug}>{m.label}</option>
          ))}
        </select>
      </label>

      {stale.length > 0 && (
        <p className={s.notice} style={{ marginBottom: 14 }}>
          {stale.length} room{stale.length === 1 ? '' : 's'} on this plan{' '}
          {stale.length === 1 ? 'has' : 'have'} coordinates authored against an older image
          version. They are hidden in the public app until re-checked.
        </p>
      )}

      <div style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <img
          src={map.storagePath ?? map.fallbackPath}
          alt={`${map.label} with all pin positions marked`}
          style={{ display: 'block', width: '100%' }}
        />
        <svg
          viewBox="0 0 2000 1120"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          {onSheet.map((r) => (
            <g key={r.code}>
              {r.shape && (
                <polygon
                  points={r.shape.map((p) => `${p.x * 2000},${p.y * 1120}`).join(' ')}
                  fill="rgba(252,198,63,0.30)"
                  stroke="#fcc63f"
                  strokeWidth={3}
                />
              )}
              <circle cx={r.pin!.x * 2000} cy={r.pin!.y * 1120} r={9} fill="#ff3b6b" stroke="#fff" strokeWidth={2} />
              <text
                x={r.pin!.x * 2000 + 13}
                y={r.pin!.y * 1120 + 5}
                fontSize={17}
                fill="#fff"
                stroke="#000"
                strokeWidth={4}
                paintOrder="stroke"
              >
                {r.code}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <p className={app.groupTitle}>{onSheet.length} pins on this plan</p>
    </section>
  );
}
