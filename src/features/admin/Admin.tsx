import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '../../lib/supabase';
import { FLOOR_MAPS } from '../../data/maps';
import { ROOMS } from '../../data/rooms';
import type { FloorMap, Room } from '../../types';
import { VerifyPins } from './VerifyPins';
import { RoomEditor } from './RoomEditor';
import { MapUploader } from './MapUploader';
import s from './Admin.module.css';
import app from '../../app/App.module.css';

type Tab = 'rooms' | 'maps' | 'pins';

export function Admin() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>('rooms');

  useEffect(() => {
    if (!supabase) { setChecking(false); return; }
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!supabaseConfigured) return <NotConfigured />;
  if (checking) return <p className={app.empty}>Checking sign-in…</p>;
  if (!session) return <SignIn />;

  return (
    <div className={s.wrap}>
      <div className={s.row}>
        <h1 className={app.h1}>Admin</h1>
        <span style={{ marginLeft: 'auto' }} className={app.resultPlace}>
          {session.user.email}
        </span>
        <button
          type="button"
          className={`${s.btn} ${s.btnGhost}`}
          onClick={() => supabase!.auth.signOut()}
        >
          Sign out
        </button>
      </div>

      <nav className={app.floorTabs} aria-label="Admin sections">
        {(['rooms', 'maps', 'pins'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`${app.quickChip} ${tab === t ? app.quickChipOn : ''}`}
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t === 'rooms' ? 'Rooms' : t === 'maps' ? 'Floor plans' : 'Verify pins'}
          </button>
        ))}
      </nav>

      {tab === 'rooms' && <RoomEditor />}
      {tab === 'maps' && <MapUploader />}
      {tab === 'pins' && <VerifyPins rooms={ROOMS} maps={FLOOR_MAPS} />}
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase!.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
    setBusy(false);
    if (err) setError(err.message);
    else setSent(true);
  };

  return (
    <div className={s.wrap}>
      <h1 className={app.h1}>Admin sign-in</h1>
      {sent ? (
        <p className={s.ok}>Check your inbox for a sign-in link.</p>
      ) : (
        <form className={s.form} onSubmit={submit}>
          <label className={s.label} htmlFor="email">
            Email address
            <input
              id="email"
              className={s.input}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button className={s.btn} type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send sign-in link'}
          </button>
          {error && <p className={s.error}>{error}</p>}
        </form>
      )}
      <p className={app.resultPlace}>
        Sign-in is by invitation only — public sign-up is disabled, and editing also
        requires an entry in the admins table.
      </p>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className={s.wrap}>
      <h1 className={app.h1}>Admin</h1>
      <div className={s.notice}>
        <p><strong>Supabase is not configured yet.</strong></p>
        <p style={{ marginTop: 8 }}>
          The public app works entirely from its bundled data, so nothing is broken — but
          editing needs a Supabase project. Set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>, then run <code>supabase/schema.sql</code>{' '}
          against the project and add yourself to the <code>admins</code> table.
        </p>
        <p style={{ marginTop: 8 }}>
          <strong>Important:</strong> turn off public sign-up in Authentication → Providers.
          The anon key is readable in the shipped bundle by design, so row-level security is
          the only thing preventing a stranger from writing to the campus data.
        </p>
      </div>
      <VerifyPins rooms={ROOMS} maps={FLOOR_MAPS} />
    </div>
  );
}

export type { FloorMap, Room };
