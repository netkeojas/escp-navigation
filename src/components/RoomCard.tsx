import React, { useEffect, useMemo, useState } from 'react';
import type { Room } from '../types/room';

interface RoomCardProps {
  room: Room;
  isExact?: boolean;
  highlightQuery?: string;
}

const RoomCard: React.FC<RoomCardProps> = ({ room, isExact, highlightQuery }) => {
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [dirOpen, setDirOpen] = useState(false); // Directions collapsed by default
  const [userToggledDirs, setUserToggledDirs] = useState(false); // track manual toggle
  const [toast, setToast] = useState<{ visible: boolean; message: string }>(() => ({ visible: false, message: '' }));
  const floorLabel = room.floor === '0' ? 'Ground' : `Floor ${room.floor}`;

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const highlight = useMemo(() => {
    const q = (highlightQuery || '').trim();
    if (!q) return (text: string) => text;
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
    return (text: string) => {
      if (!text) return text;
      const parts = text.split(regex);
      return (
        <>
          {parts.map((part, idx) =>
            regex.test(part) ? (
              <mark key={idx} style={{ background: 'rgba(255,193,7,0.35)', padding: '0 2px', borderRadius: 3 }}>{part}</mark>
            ) : (
              <span key={idx}>{part}</span>
            )
          )}
        </>
      );
    };
  }, [highlightQuery]);

  // Parse description into options and steps
  const directions = useMemo(() => {
    const desc = room.description || '';
    if (!desc.trim()) return [] as string[][];
    const PLACEHOLDER = '§§STEPSEP§§';
    const normalized = desc.replace(/\s*\|\|\s*/g, PLACEHOLDER);
    const optionStrings = normalized
      .split(/\s*\|\s*/)
      .map((s) => s.replace(new RegExp(PLACEHOLDER, 'g'), PLACEHOLDER))
      .map((s) => s.trim())
      .filter(Boolean);
    const optionsWithSteps: string[][] = optionStrings.map((opt) =>
      opt
        .split(PLACEHOLDER)
        .map((st) => st.trim())
        .filter(Boolean)
    );
    return optionsWithSteps.filter((arr) => arr.length > 0);
  }, [room.description]);

  // Directions remain collapsed by default; user controls expansion.

  const showToast = (message: string) => {
    setToast({ visible: true, message });
    window.setTimeout(() => setToast({ visible: false, message: '' }), 1500);
  };

  const copyAll = async () => {
    try {
      const text = directions
        .map((steps, i) => `Option ${i + 1}:\n${steps.join('\n')}`)
        .join('\n\n');
      if (!text) return;
      await navigator.clipboard.writeText(text);
      showToast('Copied all steps');
    } catch {}
  };

  const copyOption = async (idx: number) => {
    try {
      const steps = directions[idx] || [];
      const text = steps.join('\n');
      if (!text) return;
      await navigator.clipboard.writeText(text);
      showToast(`Copied option ${idx + 1}`);
    } catch {}
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: '1px solid #e0e0e0',
        borderRadius: '10px',
        padding: '16px',
        margin: '10px auto',
        boxShadow: hovered ? '0 10px 24px rgba(0,0,0,0.10)' : '0 2px 6px rgba(0,0,0,0.06)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'opacity 220ms ease, transform 160ms ease, box-shadow 200ms ease, border-color 160ms ease',
        opacity: visible ? 1 : 0,
        maxWidth: '700px',
        background: '#fff'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: '0 0 8px 0', color: '#1a73e8' }}>{highlight(String(room.room_id))}</h3>
        {isExact && (
          <span style={{
            fontSize: 12,
            padding: '4px 8px',
            borderRadius: 999,
            background: 'rgba(255, 193, 7, 0.18)',
            color: '#7a5a00',
            border: '1px solid rgba(255, 193, 7, 0.34)'
          }}>
            Exact match
          </span>
        )}
      </div>
      {room.type && (
        <p style={{ margin: '4px 0', color: '#5f6368' }}>
          <strong>Room Type:</strong> {highlight(room.type)}
        </p>
      )}
      {room.person && room.person.trim() && (
        <p style={{ margin: '4px 0', color: '#5f6368' }}>
          <strong>People:</strong> {room.person
            .split('|')
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p, idx, arr) => (
              <React.Fragment key={idx}>
                {highlight(p)}{idx < arr.length - 1 ? ', ' : ''}
              </React.Fragment>
            ))}
        </p>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '6px 0 8px 0' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', fontSize: 12, padding: '6px 10px',
          borderRadius: 999, border: '1px solid rgba(26,115,232,0.25)',
          background: 'rgba(26,115,232,0.10)', color: '#0b56c3'
        }}>
          Building: {room.building}
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', fontSize: 12, padding: '6px 10px',
          borderRadius: 999, border: '1px solid rgba(255,193,7,0.34)',
          background: 'rgba(255,193,7,0.14)', color: '#7a5a00'
        }}>
          {floorLabel}
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', fontSize: 12, padding: '6px 10px',
          borderRadius: 999, border: '1px solid #e0e0e0', background: '#f9fbff', color: '#2c3a4b'
        }}>
          {room.category}
        </span>
      </div>
      {directions.length > 0 && (
        <div style={{ margin: '10px 0 0 0', paddingTop: '10px', borderTop: '1px solid #eee' }}>
          <button
            type="button"
            onClick={() => { setDirOpen((v) => !v); setUserToggledDirs(true); }}
            aria-expanded={dirOpen}
            aria-controls={`dir-${room.id}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'transparent', border: 'none', padding: 0,
              cursor: 'pointer', color: '#3c4043', fontWeight: 600
            }}
          >
            <span style={{
              display: 'inline-block', transition: 'transform 160ms ease',
              transform: dirOpen ? 'rotate(90deg)' : 'rotate(0deg)'
            }}>▶</span>
            Directions
          </button>

          {dirOpen && (
            <div id={`dir-${room.id}`}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
                <button
                  type="button"
                  onClick={copyAll}
                  style={{
                    padding: '6px 10px', borderRadius: 8, border: '1px solid #e0e0e0',
                    background: '#f9fbff', color: '#2c3a4b', cursor: 'pointer'
                  }}
                  aria-label="Copy all directions"
                >
                  Copy all steps
                </button>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#5f6368' }}>
                {directions.map((steps, idx) => (
                  <li key={idx} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: steps.length ? 4 : 0 }}>
                      <div style={{ fontWeight: 600 }}>Option {idx + 1}:</div>
                      <button
                        type="button"
                        onClick={() => copyOption(idx)}
                        style={{
                          padding: '4px 8px', borderRadius: 8, border: '1px solid #e0e0e0',
                          background: 'white', color: '#3c4043', cursor: 'pointer', fontSize: 12
                        }}
                        aria-label={`Copy steps for option ${idx + 1}`}
                      >
                        Copy option
                      </button>
                    </div>
                    {steps.length > 0 && (
                      <ul style={{ margin: '4px 0 8px 18px', paddingLeft: 0, color: '#3c4043', listStyleType: 'disc' }}>
                        {steps.map((st, sIdx) => (
                          <li key={sIdx} style={{ lineHeight: 1.5, margin: '2px 0' }}>
                            {st}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast.visible && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)',
            background: 'rgba(32,33,36,0.9)', color: 'white',
            padding: '8px 12px', borderRadius: 8, fontSize: 13,
            boxShadow: '0 6px 16px rgba(0,0,0,0.25)', zIndex: 2000
          }}
        >
          {toast.message || 'Copied!'}
        </div>
      )}
    </div>
  );
};

export default RoomCard;
