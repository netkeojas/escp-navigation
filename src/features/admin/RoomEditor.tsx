import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Category, Room } from '../../types';
import { CATEGORY_LABELS } from '../../types';
import { NODES } from '../../data/graph';
import { FLOOR_MAPS } from '../../data/maps';
import { normalize } from '../../lib/search';
import s from './Admin.module.css';
import app from '../../app/App.module.css';

const BLANK: Room = {
  id: '', code: '', name: '', building: 'C', level: 0, category: 'office',
  aliases: [], note: null, accessNode: 'c.0.corr', localHint: null,
  mapSlug: null, pin: null, shape: null, geometryVersion: 1, isActive: true,
};

export function RoomEditor() {
  const [rows, setRows] = useState<Room[] | null>(null);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<Room | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [publishing, setPublishing] = useState(false);

  const load = async () => {
    const { data, error } = await supabase!.from('rooms').select('*').order('code');
    if (error) { setMessage({ kind: 'error', text: error.message }); return; }
    setRows((data ?? []).map(fromRow));
  };

  useEffect(() => { void load(); }, []);

  const shown = useMemo(() => {
    if (!rows) return [];
    const q = normalize(filter);
    if (!q) return rows.slice(0, 200);
    return rows.filter((r) => normalize(`${r.code} ${r.name}`).includes(q)).slice(0, 200);
  }, [rows, filter]);

  const save = async (room: Room) => {
    const payload = toRow(room);
    const { error } = room.id
      ? await supabase!.from('rooms').update(payload).eq('id', room.id)
      : await supabase!.from('rooms').insert(payload);
    if (error) { setMessage({ kind: 'error', text: error.message }); return; }
    setMessage({ kind: 'ok', text: `Saved ${room.code}.` });
    setEditing(null);
    void load();
  };

  const remove = async (room: Room) => {
    if (!window.confirm(`Delete ${room.code}? This cannot be undone from here.`)) return;
    const { error } = await supabase!.from('rooms').delete().eq('id', room.id);
    if (error) { setMessage({ kind: 'error', text: error.message }); return; }
    setMessage({ kind: 'ok', text: `Deleted ${room.code}.` });
    void load();
  };

  /**
   * Edits are live for anyone who refetches, but visitors paint from the
   * snapshot compiled into the bundle. Publishing rebuilds that snapshot so the
   * change reaches people who never complete a network request. Deliberately a
   * manual button: a per-row webhook would fire twenty deploys during one
   * afternoon of tidying.
   */
  const publish = async () => {
    const hook = import.meta.env.VITE_DEPLOY_HOOK_URL;
    if (!hook) {
      setMessage({ kind: 'error', text: 'No deploy hook configured (VITE_DEPLOY_HOOK_URL).' });
      return;
    }
    setPublishing(true);
    try {
      await fetch(hook, { method: 'POST' });
      setMessage({ kind: 'ok', text: 'Publish triggered — live in a minute or two.' });
    } catch {
      setMessage({ kind: 'error', text: 'Could not reach the deploy hook.' });
    }
    setPublishing(false);
  };

  if (!rows) return <p className={app.empty}>Loading rooms…</p>;

  return (
    <section className={s.card}>
      <div className={s.row} style={{ marginBottom: 14 }}>
        <input
          className={s.input}
          type="search"
          placeholder="Filter rooms…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter rooms"
        />
        <button className={s.btn} type="button" onClick={() => setEditing({ ...BLANK })}>
          Add room
        </button>
        <button
          className={`${s.btn} ${s.btnGhost}`}
          type="button"
          onClick={publish}
          disabled={publishing}
          style={{ marginLeft: 'auto' }}
        >
          {publishing ? 'Publishing…' : 'Publish to everyone'}
        </button>
      </div>

      {message && (
        <p className={message.kind === 'ok' ? s.ok : s.error} role="status">{message.text}</p>
      )}

      {editing && (
        <RoomForm
          room={editing}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}

      <div className={s.tableWrap}>
        <table className={s.table}>
          <caption className="visually-hidden">All rooms</caption>
          <thead>
            <tr>
              <th scope="col">Code</th><th scope="col">Name</th>
              <th scope="col">Where</th><th scope="col">Pin</th><th scope="col" />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id || r.code}>
                <td><strong>{r.code}</strong></td>
                <td>{r.name}</td>
                <td>{r.building} · L{r.level}</td>
                <td>{r.pin ? `${r.pin.x.toFixed(3)}, ${r.pin.y.toFixed(3)}` : '—'}</td>
                <td>
                  <div className={s.row}>
                    <button className={`${s.btn} ${s.btnGhost}`} type="button" onClick={() => setEditing(r)}>
                      Edit
                    </button>
                    <button className={`${s.btn} ${s.btnDanger}`} type="button" onClick={() => remove(r)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={app.groupTitle}>{rows.length} rooms</p>
    </section>
  );
}

function RoomForm({
  room, onSave, onCancel,
}: { room: Room; onSave: (r: Room) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Room>(room);
  const set = <K extends keyof Room>(k: K, v: Room[K]) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <form
      className={s.card}
      style={{ marginBottom: 18 }}
      onSubmit={(e) => { e.preventDefault(); onSave(draft); }}
    >
      <h3 className={app.groupTitle}>{room.id ? `Edit ${room.code}` : 'New room'}</h3>
      <div className={s.grid}>
        <label className={s.label}>Code
          <input className={s.input} required value={draft.code}
            onChange={(e) => set('code', e.target.value.toUpperCase())} />
        </label>
        <label className={s.label}>Name
          <input className={s.input} required value={draft.name}
            onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className={s.label}>Building
          <select className={s.select} value={draft.building}
            onChange={(e) => set('building', e.target.value as Room['building'])}>
            {['B', 'C', 'D'].map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label className={s.label}>Floor
          <select className={s.select} value={draft.level}
            onChange={(e) => set('level', Number(e.target.value) as Room['level'])}>
            <option value={-1}>Basement</option>
            <option value={0}>Ground</option>
            <option value={1}>1st</option>
            <option value={2}>2nd</option>
          </select>
        </label>
        <label className={s.label}>Category
          <select className={s.select} value={draft.category}
            onChange={(e) => set('category', e.target.value as Category)}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className={s.label}>Floor plan
          <select className={s.select} value={draft.mapSlug ?? ''}
            onChange={(e) => set('mapSlug', e.target.value || null)}>
            <option value="">No plan available</option>
            {FLOOR_MAPS.map((m) => <option key={m.slug} value={m.slug}>{m.label}</option>)}
          </select>
        </label>
        <label className={s.label}>Reached from
          <select className={s.select} value={draft.accessNode}
            onChange={(e) => set('accessNode', e.target.value)}>
            {NODES.filter((n) => n.kind === 'corridor' || n.kind === 'lobby').map((n) => (
              <option key={n.id} value={n.id}>{n.id}</option>
            ))}
          </select>
        </label>
        <label className={s.label}>Pin X (0–1)
          <input className={s.input} type="number" step="0.001" min={0} max={1}
            value={draft.pin?.x ?? ''}
            onChange={(e) => set('pin', e.target.value === '' ? null
              : { x: Number(e.target.value), y: draft.pin?.y ?? 0.5 })} />
        </label>
        <label className={s.label}>Pin Y (0–1)
          <input className={s.input} type="number" step="0.001" min={0} max={1}
            value={draft.pin?.y ?? ''}
            onChange={(e) => set('pin', e.target.value === '' ? null
              : { x: draft.pin?.x ?? 0.5, y: Number(e.target.value) })} />
        </label>
      </div>

      <label className={s.label} style={{ marginTop: 12 }}>Also known as (comma separated)
        <input className={s.input} value={draft.aliases.join(', ')}
          onChange={(e) => set('aliases', e.target.value.split(',').map((a) => a.trim()).filter(Boolean))} />
      </label>
      <label className={s.label} style={{ marginTop: 12 }}>Arrival hint
        <input className={s.input} value={draft.localHint ?? ''}
          placeholder="third door on the left"
          onChange={(e) => set('localHint', e.target.value || null)} />
      </label>
      <label className={s.label} style={{ marginTop: 12 }}>Note
        <input className={s.input} value={draft.note ?? ''}
          placeholder="By appointment only"
          onChange={(e) => set('note', e.target.value || null)} />
      </label>

      <div className={s.row} style={{ marginTop: 16 }}>
        <button className={s.btn} type="submit">Save</button>
        <button className={`${s.btn} ${s.btnGhost}`} type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function fromRow(r: any): Room {
  return {
    id: r.id, code: r.code, name: r.name, building: r.building, level: r.level,
    category: r.category, aliases: r.aliases ?? [], note: r.note ?? null,
    accessNode: r.access_node, localHint: r.local_hint ?? null,
    mapSlug: r.map_slug ?? null,
    pin: r.pin_x != null && r.pin_y != null ? { x: r.pin_x, y: r.pin_y } : null,
    shape: r.shape ?? null, geometryVersion: r.geometry_version ?? 1,
    isActive: r.is_active ?? true,
  };
}

function toRow(r: Room) {
  return {
    code: r.code, name: r.name, building: r.building, level: r.level,
    category: r.category, aliases: r.aliases, note: r.note,
    access_node: r.accessNode, local_hint: r.localHint, map_slug: r.mapSlug,
    pin_x: r.pin?.x ?? null, pin_y: r.pin?.y ?? null, shape: r.shape,
    geometry_version: r.geometryVersion, is_active: r.isActive,
  };
}
