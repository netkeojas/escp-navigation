import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Category, Room } from '../../types';
import { placeLabel } from '../../types';
import { createIndex, searchRooms } from '../../lib/search';
import s from '../../app/App.module.css';

interface Props {
  rooms: Room[];
  /** Codes with no step-free access, badged when the filter is on. */
  noStepFree: Set<string>;
}

const QUICK: { label: string; category: Category }[] = [
  { label: 'Seminar rooms', category: 'seminar' },
  { label: 'Student services', category: 'service' },
  { label: 'Study spaces', category: 'study' },
  { label: 'Toilets', category: 'toilet' },
  { label: 'Offices', category: 'office' },
];

const BUILDING_ORDER = ['B', 'C', 'D'] as const;

export function Home({ rooms, noStepFree }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const deferred = useDeferredValue(query);

  const index = useMemo(() => createIndex(rooms), [rooms]);
  const { rooms: results, exact } = useMemo(
    () => searchRooms(rooms, index, deferred, { category }),
    [rooms, index, deferred, category],
  );

  const grouped = useMemo(() => {
    const by = new Map<string, Room[]>();
    for (const r of results) {
      const key = `Building ${r.building}`;
      if (!by.has(key)) by.set(key, []);
      by.get(key)!.push(r);
    }
    for (const list of by.values()) {
      list.sort((a, b) => a.level - b.level || a.code.localeCompare(b.code));
    }
    return [...by.entries()].sort(
      (a, b) =>
        BUILDING_ORDER.indexOf(a[0].slice(-1) as never) -
        BUILDING_ORDER.indexOf(b[0].slice(-1) as never),
    );
  }, [results]);

  return (
    <>
      <div className={s.hero}>
        <h1 className={s.h1}>Find your room</h1>
        <p className={s.lede}>
          Search any room, office or service across Buildings B, C and D — and get
          step-by-step directions from the main entrance.
        </p>
      </div>

      <div className={s.searchRow}>
        <input
          className={s.search}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try D-275, library, exam office…"
          aria-label="Search for a room, office or service"
          autoFocus
          autoComplete="off"
        />
      </div>

      <div className={s.quick}>
        {QUICK.map((q) => (
          <button
            key={q.category}
            type="button"
            className={`${s.quickChip} ${category === q.category ? s.quickChipOn : ''}`}
            aria-pressed={category === q.category}
            onClick={() => setCategory((c) => (c === q.category ? null : q.category))}
          >
            {q.label}
          </button>
        ))}
      </div>

      <p className="visually-hidden" role="status" aria-live="polite">
        {results.length} result{results.length === 1 ? '' : 's'}
      </p>

      {results.length === 0 ? (
        <p className={s.empty}>
          Nothing matched “{query}”. Try a room number like <strong>D-275</strong>, or a
          service such as <strong>Language Centre</strong>.
        </p>
      ) : (
        grouped.map(([label, list]) => (
          <section key={label}>
            <h2 className={s.groupTitle}>{label}</h2>
            <ul className={s.results}>
              {list.map((room) => (
                <li key={room.code}>
                  <Link className={s.result} to={`/room/${room.code}`}>
                    <span className={s.resultCode}>{room.code}</span>
                    {room.name !== room.code && <span className={s.resultName}>{room.name}</span>}
                    {exact.has(room.code) && <span className={s.badge}>Exact match</span>}
                    {noStepFree.has(room.code) && (
                      <span className={s.badgeStairs}>Stairs only</span>
                    )}
                    <span className={s.resultPlace}>{placeLabel(room)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
