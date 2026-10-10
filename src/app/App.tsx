import { useMemo } from 'react';
import { HashRouter, Link, Route, Routes } from 'react-router-dom';
import { inject } from '@vercel/analytics';
import { useRoomData } from '../lib/useRoomData';
import { buildGraph, computeStepFreeUnreachable } from '../lib/route';
import { Home } from '../features/search/Home';
import { RoomPage } from '../features/room/RoomPage';
import { FloorBrowser } from '../features/map/FloorBrowser';
import { Admin } from '../features/admin/Admin';
import s from './App.module.css';

inject();

export function App() {
  const { rooms, maps, stale } = useRoomData();
  const active = useMemo(() => rooms.filter((r) => r.isActive), [rooms]);
  const graph = useMemo(() => buildGraph(active), [active]);
  const noStepFree = useMemo(() => computeStepFreeUnreachable(graph, active), [graph, active]);

  return (
    <HashRouter>
      <div className={s.shell}>
        <a className="skip-link" href="#main">Skip to content</a>

        <header className={s.header}>
          <Link className={s.brand} to="/">
            ESCP <span className={s.brandMark}>Room Finder</span>
          </Link>
          <nav className={s.nav} aria-label="Main">
            <Link className={s.navLink} to="/">Search</Link>
            <Link className={s.navLink} to="/map">Floor plans</Link>
            <Link className={s.navLink} to="/admin">Admin</Link>
          </nav>
        </header>

        {stale && (
          <p className={s.staleNotice} role="status">
            Showing saved data — we haven’t been able to check for updates recently.
          </p>
        )}

        <main className={s.main} id="main">
          <Routes>
            <Route path="/" element={<Home rooms={active} noStepFree={noStepFree} />} />
            <Route
              path="/room/:code"
              element={<RoomPage rooms={active} maps={maps} graph={graph} />}
            />
            <Route path="/map" element={<FloorBrowser rooms={active} maps={maps} />} />
            <Route path="/map/:slug" element={<FloorBrowser rooms={active} maps={maps} />} />
            <Route path="/admin" element={<Admin />} />
            <Route
              path="*"
              element={
                <>
                  <h1 className={s.h1}>Page not found</h1>
                  <Link className={s.back} to="/">← Back to search</Link>
                </>
              }
            />
          </Routes>
        </main>

        <footer className={s.footer}>
          ESCP Business School Berlin · Buildings B, C and D
        </footer>
      </div>
    </HashRouter>
  );
}
