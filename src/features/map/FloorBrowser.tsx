import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { FloorMap, Room } from '../../types';
import { FloorMapViewer } from './FloorMapViewer';
import s from '../../app/App.module.css';

interface Props {
  rooms: Room[];
  maps: FloorMap[];
}

export function FloorBrowser({ rooms, maps }: Props) {
  const { slug } = useParams();
  const ordered = useMemo(
    () => [...maps].sort((a, b) => a.level - b.level || a.sortOrder - b.sortOrder),
    [maps],
  );
  const map = ordered.find((m) => m.slug === slug) ?? ordered[0];
  const sheetRooms = useMemo(
    () => rooms.filter((r) => r.mapSlug === map?.slug && r.isActive),
    [rooms, map],
  );

  if (!map) return <p className={s.empty}>No floor plans available.</p>;

  return (
    <>
      <Link className={s.back} to="/">← Back to search</Link>
      <h1 className={s.h1}>Floor plans</h1>
      <nav className={s.floorTabs} aria-label="Choose a floor plan">
        {ordered.map((m) => (
          <Link
            key={m.slug}
            to={`/map/${m.slug}`}
            className={`${s.quickChip} ${m.slug === map.slug ? s.quickChipOn : ''}`}
            aria-current={m.slug === map.slug ? 'page' : undefined}
          >
            {m.label}
          </Link>
        ))}
      </nav>
      <FloorMapViewer map={map} rooms={sheetRooms} framePlan />
      <p className={s.groupTitle}>{sheetRooms.length} rooms on this plan — tap one to open it</p>
    </>
  );
}
