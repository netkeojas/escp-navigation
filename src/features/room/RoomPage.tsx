import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { FloorMap, Room } from '../../types';
import { CATEGORY_LABELS, placeLabel } from '../../types';
import { FloorMapViewer, NoMapPlaceholder } from '../map/FloorMapViewer';
import { DirectionsPanel } from '../directions/DirectionsPanel';
import type { Graph } from '../../lib/route';
import s from '../../app/App.module.css';

interface Props {
  rooms: Room[];
  maps: FloorMap[];
  graph: Graph;
}

export function RoomPage({ rooms, maps, graph }: Props) {
  const { code = '' } = useParams();
  const room = useMemo(
    () => rooms.find((r) => r.code.toLowerCase() === code.toLowerCase()),
    [rooms, code],
  );

  const map = useMemo(
    () => (room?.mapSlug ? maps.find((m) => m.slug === room.mapSlug) ?? null : null),
    [maps, room],
  );

  const sheetRooms = useMemo(
    () => (map ? rooms.filter((r) => r.mapSlug === map.slug && r.isActive) : []),
    [rooms, map],
  );

  if (!room) {
    return (
      <>
        <Link className={s.back} to="/">← Back to search</Link>
        <h1 className={s.h1}>Room not found</h1>
        <p className={s.lede}>No room matches “{code}”.</p>
      </>
    );
  }

  return (
    <>
      <div className={s.roomHead}>
        <Link className={s.back} to="/">← Back to search</Link>
        <h1 className={s.roomCode}>{room.code}</h1>
        {room.name !== room.code && <p className={s.roomName}>{room.name}</p>}
        <p>
          <span className={s.roomPlace}>{placeLabel(room)}</span>{' '}
          <span className={s.roomPlace}>{CATEGORY_LABELS[room.category]}</span>
        </p>
        {room.note && <p className={s.note}>{room.note}</p>}
      </div>

      <div className={s.roomBody}>
        {map ? (
          <FloorMapViewer map={map} rooms={sheetRooms} target={room} />
        ) : (
          <NoMapPlaceholder room={room} />
        )}
        <DirectionsPanel graph={graph} room={room} />
      </div>
    </>
  );
}
