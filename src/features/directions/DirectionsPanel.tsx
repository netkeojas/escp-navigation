import { useEffect, useMemo, useState } from 'react';
import type { Room } from '../../types';
import { computeRoute, ORIGINS, DEFAULT_ORIGIN, type Graph } from '../../lib/route';
import { store } from '../../lib/storage';
import s from './DirectionsPanel.module.css';

const ORIGIN_KEY = 'escp.origin';

interface Props {
  graph: Graph;
  room: Room;
}

export function DirectionsPanel({ graph, room }: Props) {
  // Session-scoped on purpose: a "from: Library" that survives across days is a
  // bug generator, not a convenience.
  const [origin, setOrigin] = useState<string>(
    () => store.session.get(ORIGIN_KEY) ?? DEFAULT_ORIGIN,
  );
  const [stepFree, setStepFree] = useState(false);
  const [showStairsAnyway, setShowStairsAnyway] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { store.session.set(ORIGIN_KEY, origin); }, [origin]);
  useEffect(() => { setShowStairsAnyway(false); }, [room.code, stepFree]);

  const result = useMemo(
    () => computeRoute(graph, room, origin, stepFree),
    [graph, room, origin, stepFree],
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  if (!result.ok) {
    return (
      <section className={s.panel} aria-labelledby="dir-h">
        <h2 id="dir-h" className={s.title}>Directions</h2>
        <p className={s.detail}>
          No route could be found to this room. Please ask at Reception in Building C.
        </p>
      </section>
    );
  }

  const blocked = 'stepFreeUnavailable' in result ? result.stepFreeUnavailable : null;
  const showSteps = !blocked || showStairsAnyway;

  const copy = async () => {
    const text = result.route.steps
      .map((st) => `${st.index}. ${st.text}${st.detail ? ` (${st.detail})` : ''}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(`Directions to ${room.name}\n\n${text}`);
      setToast('Directions copied');
    } catch {
      setToast('Could not copy');
    }
  };

  return (
    <section className={s.panel} aria-labelledby="dir-h">
      <div className={s.head}>
        <h2 id="dir-h" className={s.title}>How to get there</h2>
        <button type="button" className={s.btn} onClick={copy}>Copy steps</button>
      </div>

      <div className={s.controls}>
        <label className={s.field} htmlFor="origin">
          From
          <select
            id="origin"
            className={s.select}
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
          >
            {ORIGINS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className={`${s.toggle} ${stepFree ? s.toggleOn : ''}`}
          aria-pressed={stepFree}
          onClick={() => setStepFree((v) => !v)}
        >
          ♿ Step-free route
        </button>
      </div>

      <div className={s.chips}>
        <span className={s.chip}>~{result.route.minutes} min</span>
        {result.route.flights > 0 && (
          <span className={s.chip}>
            {result.route.flights} flight{result.route.flights === 1 ? '' : 's'} of stairs
          </span>
        )}
        {result.route.flights === 0 && <span className={s.chip}>No stairs</span>}
      </div>

      {blocked && (
        <div className={s.warn} role="alert">
          <span className={s.warnTitle}>No step-free route to {room.code}</span>
          <p>{blocked.reason}</p>
          {blocked.furthestLabel && (
            <p>We can get you step-free as far as {blocked.furthestLabel}.</p>
          )}
          <p>
            Reception (C-003, Building C ground floor) can arrange a different room or
            someone to meet you.
          </p>
          <div className={s.warnActions}>
            {!showStairsAnyway && (
              <button type="button" className={s.btn} onClick={() => setShowStairsAnyway(true)}>
                Show the route with stairs anyway
              </button>
            )}
          </div>
        </div>
      )}

      {showSteps && (
        <ol className={s.steps}>
          {result.route.steps.map((st) => (
            <li key={st.index} className={s.step}>
              <span
                className={`${s.num} ${st.icon === 'arrive' ? s.numArrive : ''}`}
                aria-hidden="true"
              >
                {st.index}
              </span>
              <span>
                <span className={s.text}>{st.text}</span>
                {st.detail && <span className={s.detail}>{st.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}

      {toast && <div className={s.toast} role="status" aria-live="polite">{toast}</div>}
    </section>
  );
}
