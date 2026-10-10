import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FloorMap, Room } from '../../types';
import s from './FloorMapViewer.module.css';

const W = 2000;
const H = 1120;
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

interface Props {
  map: FloorMap;
  /** Rooms drawn on this sheet. */
  rooms: Room[];
  /** The room to spotlight, if any. */
  target?: Room | null;
  /** Frame the drawing area rather than the whole sheet (used on narrow screens). */
  framePlan?: boolean;
}

interface View { z: number; x: number; y: number }

export function FloorMapViewer({ map, rooms, target = null, framePlan = false }: Props) {
  const navigate = useNavigate();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ z: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  // Rooms whose coordinates predate the current map image are hidden rather
  // than drawn in the wrong place -- a confidently misplaced pin is worse than
  // no pin at all.
  const drawable = useMemo(
    () => rooms.filter((r) => r.pin && r.geometryVersion >= map.imageVersion),
    [rooms, map.imageVersion],
  );
  const staleCount = rooms.length - drawable.length;

  const clamp = useCallback((v: View): View => {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.z));
    const el = viewportRef.current;
    if (!el) return { ...v, z };
    const w = el.clientWidth;
    const h = el.clientHeight;
    const maxX = 0;
    const minX = w - w * z;
    const maxY = 0;
    const minY = h - h * z;
    return { z, x: Math.min(maxX, Math.max(minX, v.x)), y: Math.min(maxY, Math.max(minY, v.y)) };
  }, []);

  /** Centre the view on a normalized point at the given zoom. */
  const focusOn = useCallback(
    (nx: number, ny: number, z: number) => {
      const el = viewportRef.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      setView(clamp({ z, x: w / 2 - nx * w * z, y: h / 2 - ny * h * z }));
    },
    [clamp],
  );

  // Frame the plan area (skipping the printed legend) on narrow screens, or
  // zoom to the target room when there is one.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    if (target?.pin) {
      focusOn(target.pin.x, target.pin.y, window.innerWidth < 720 ? 2.6 : 1.9);
    } else if (framePlan) {
      const r = map.planRect;
      const z = Math.min(MAX_ZOOM, Math.max(1, 1 / Math.max(r.w, r.h)));
      focusOn(r.x + r.w / 2, r.y + r.h / 2, z);
    } else {
      setView({ z: 1, x: 0, y: 0 });
    }
  }, [target, map.slug, framePlan, focusOn, map.planRect]);

  const zoomBy = (factor: number) => {
    const el = viewportRef.current;
    if (!el) return;
    setView((v) => {
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.z * factor));
      const w = el.clientWidth;
      const h = el.clientHeight;
      // Keep the centre of the viewport fixed while zooming.
      const cx = (w / 2 - v.x) / (w * v.z);
      const cy = (h / 2 - v.y) / (h * v.z);
      return clamp({ z, x: w / 2 - cx * w * z, y: h / 2 - cy * h * z });
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('a')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setView((v) => clamp({ ...v, x: d.vx + (e.clientX - d.x), y: d.vy + (e.clientY - d.y) }));
  };
  const onPointerUp = () => { drag.current = null; };

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && Math.abs(e.deltaY) < 2) return;
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = 60;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0], ArrowRight: [-step, 0],
      ArrowUp: [0, step], ArrowDown: [0, -step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      setView((v) => clamp({ ...v, x: v.x + dx, y: v.y + dy }));
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault(); zoomBy(1.25);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault(); zoomBy(1 / 1.25);
    } else if (e.key === '0') {
      e.preventDefault(); setView({ z: 1, x: 0, y: 0 });
    }
  };

  const src = map.storagePath ?? map.fallbackPath;
  const maskId = `spot-${map.slug}`;
  const hasSpot = Boolean(target?.pin);

  return (
    <div className={s.wrap}>
      <div
        ref={viewportRef}
        className={s.viewport}
        role="application"
        aria-label={`Floor plan: ${map.label}. Drag to pan, arrow keys to move, plus and minus to zoom.`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
      >
        <div
          className={s.stage}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}
        >
          <img className={s.image} src={src} alt={`Floor plan of ${map.label}`} draggable={false} />
          <svg className={s.svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            {hasSpot && (
              <>
                <defs>
                  <mask id={maskId}>
                    <rect x="0" y="0" width={W} height={H} fill="white" />
                    {target!.shape ? (
                      <polygon
                        points={target!.shape.map((p) => `${p.x * W},${p.y * H}`).join(' ')}
                        fill="black"
                      />
                    ) : (
                      <circle cx={target!.pin!.x * W} cy={target!.pin!.y * H} r={70} fill="black" />
                    )}
                  </mask>
                </defs>
                <rect
                  x="0" y="0" width={W} height={H}
                  fill="#0d0b28" opacity="0.55" mask={`url(#${maskId})`}
                  pointerEvents="none"
                />
              </>
            )}

            {drawable.map((room) => {
              const isTarget = room.code === target?.code;
              const pts = room.shape?.map((p) => `${p.x * W},${p.y * H}`).join(' ');
              return (
                <a
                  key={room.code}
                  className={s.room}
                  href={`#/room/${room.code}`}
                  aria-label={`${room.name}, ${room.code}`}
                  onClick={(e) => { e.preventDefault(); navigate(`/room/${room.code}`); }}
                >
                  {pts ? (
                    <polygon points={pts} className={isTarget ? s.targetShape : s.roomShape} />
                  ) : (
                    <circle
                      cx={room.pin!.x * W}
                      cy={room.pin!.y * H}
                      r={26}
                      className={s.roomShape}
                    />
                  )}
                  {isTarget && !room.shape && (
                    <>
                      <circle cx={room.pin!.x * W} cy={room.pin!.y * H} r={34} className={s.pinHalo} />
                      <circle cx={room.pin!.x * W} cy={room.pin!.y * H} r={16} className={s.pinDot} />
                    </>
                  )}
                </a>
              );
            })}
          </svg>
        </div>

        <div className={s.controls}>
          <button type="button" className={s.ctl} onClick={() => zoomBy(1.25)} aria-label="Zoom in">+</button>
          <button type="button" className={s.ctl} onClick={() => zoomBy(1 / 1.25)} aria-label="Zoom out">−</button>
          <button
            type="button" className={s.ctl}
            onClick={() => setView({ z: 1, x: 0, y: 0 })}
            aria-label="Reset zoom"
          >
            ⤢
          </button>
        </div>
      </div>

      <p className={s.caption}>
        <span>{map.label}</span>
        {staleCount > 0 && (
          <span role="status">
            {staleCount} room{staleCount === 1 ? '' : 's'} hidden — pin positions need review
            after a map update.
          </span>
        )}
      </p>
    </div>
  );
}

export function NoMapPlaceholder({ room }: { room: Room }) {
  return (
    <div className={s.noMap}>
      <strong>No floor plan available yet</strong>
      <p>
        ESCP has not published a plan for Building {room.building},{' '}
        {room.level === 2 ? '2nd floor' : 'this floor'}. The written directions below still apply.
      </p>
    </div>
  );
}
