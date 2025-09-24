import { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import type { IFuseOptions } from 'fuse.js';
import Papa from 'papaparse';
import SearchBar from './components/SearchBar';
import ResultsList from './components/ResultsList';
import type { Room } from './types/room';
import { inject } from '@vercel/analytics';

// Toggle this flag to switch data source in the future.
const LOAD_JSON_INSTEAD_OF_CSV = false;

// Initialize Vercel Web Analytics
inject();

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [searchResults, setSearchResults] = useState<Room[]>([]);
  const [fuse, setFuse] = useState<Fuse<Room> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [exactIds, setExactIds] = useState<Set<string> | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);

  const fuseOptions: IFuseOptions<Room> = useMemo(() => ({
    keys: [
      { name: 'room_id', weight: 0.4 },
      { name: 'aliases', weight: 0.3 },
      { name: 'building', weight: 0.15 },
      { name: 'floor', weight: 0.1 },
      { name: 'category', weight: 0.05 },
      { name: 'person', weight: 0.2 },
      { name: 'type', weight: 0.08 },
    ],
    includeScore: true,
    threshold: 0.4,
    ignoreLocation: true,
  }), []);

  // Unique, sorted list of categories for the dropdown
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rooms) {
      if (r.category && r.category.trim()) set.add(r.category.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rooms]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (LOAD_JSON_INSTEAD_OF_CSV) {
          const res = await fetch('/rooms.json');
          if (!res.ok) throw new Error('Unable to fetch rooms.json');
          const data: Room[] = await res.json();
          setRooms(data);
          setSearchResults(data);
          setFuse(new Fuse(data, fuseOptions));
          setLoading(false);
          return;
        }

        // Default: load CSV and parse with PapaParse
        const response = await fetch('/rooms.csv');
        if (!response.ok) throw new Error('Unable to fetch rooms.csv');
        const csvText = await response.text();

        Papa.parse<Room>(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const data = results.data as Room[];
            setRooms(data);
            setSearchResults(data);
            setFuse(new Fuse(data, fuseOptions));
            setLoading(false);
          },
          error: (err: unknown) => {
            console.error('Error parsing CSV:', err);
            setError('Failed to load room data.');
            setLoading(false);
          },
        });
      } catch (err: any) {
        console.error('Data load error:', err);
        setError(err?.message || 'Failed to load room data.');
        setLoading(false);
      }
    };

    fetchData();
  }, [fuseOptions]);

  useEffect(() => {
    if (!fuse) return;
    const query = searchQuery.trim();

    // Apply category filter first to form the base dataset
    const base = selectedCategory
      ? rooms.filter((r) => (r.category || '').trim() === selectedCategory)
      : rooms;

    if (query === '') {
      setSearchResults(base);
      setExactIds(null);
      return;
    }

    // 1) Try exact match on room_id or any alias (pipe-separated) case-insensitively
    const q = query.toLowerCase();
    const exactMatches = base.filter((room) => {
      const idMatch = (room.room_id || '').trim().toLowerCase() === q;
      const aliases = (room.aliases || '')
        .split('|')
        .map((a) => a.trim().toLowerCase())
        .filter(Boolean);
      const aliasMatch = aliases.includes(q);
      const people = (room.person || '')
        .split('|')
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean);
      const personMatch = people.includes(q);
      return idMatch || aliasMatch || personMatch;
    });

    if (exactMatches.length > 0) {
      setSearchResults(exactMatches);
      setExactIds(new Set(exactMatches.map((r) => r.id)));
      return;
    }

    // 2) Otherwise, fall back to fuzzy search (limited to the base set)
    const results = fuse.search(query);
    const fuzzyItems = results.map((r) => r.item);
    // Keep only items that are in the base set
    const baseIds = new Set(base.map((r) => r.id));
    const filteredFuzzy = fuzzyItems.filter((r) => baseIds.has(r.id));
    setSearchResults(filteredFuzzy);
    setExactIds(null);
  }, [searchQuery, fuse, rooms, selectedCategory]);

  const handleSearch = (query: string) => setSearchQuery(query);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: 18, color: '#555' }}>
        Loading room data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'red', padding: 20, textAlign: 'center' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#1a73e8', marginBottom: 8 }}>ESCP Room Finder</h1>
      <p style={{ textAlign: 'center', color: '#5f6368', marginTop: 0, marginBottom: 24 }}>
        Search for rooms by ID, people, Room Type, building, floor, or category
      </p>

      {/* Campus map image (JPEG). Scales to contain (no cropping). Click to view fullscreen. */}
      <div style={{ margin: '8px auto 18px auto' }}>
        <img
          src="/map.jpg"
          alt="ESCP campus buildings top view"
          style={{
            width: '100%',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: 12,
            border: '1px solid #e0e0e0',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            cursor: 'zoom-in'
          }}
          onClick={() => setIsMapOpen(true)}
          onError={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            img.style.display = 'none';
          }}
        />
        <div style={{ textAlign: 'center', color: '#5f6368', fontSize: 13, marginTop: 6 }}>
          Click the map to view full size.
        </div>
      </div>

      {/* Fullscreen Map Modal */}
      {isMapOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Fullscreen campus map"
          onClick={() => setIsMapOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setIsMapOpen(false); }}
          tabIndex={-1}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <img
            src="/map.jpg"
            alt="ESCP campus buildings full view"
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              borderRadius: 12,
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              cursor: 'zoom-out'
            }}
            onClick={(e) => { e.stopPropagation(); setIsMapOpen(false); }}
          />
        </div>
      )}

      <div className="toolbar" style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', margin: '20px 0' }}>
        <div style={{ flex: 1, maxWidth: 600 }}>
          <SearchBar onSearch={handleSearch} />
        </div>
        <div className="filter-controls">
          <label htmlFor="categoryFilter" style={{ fontSize: 14, color: '#5f6368', marginRight: 8 }}>Category:</label>
          <select
            id="categoryFilter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', minWidth: 180 }}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSelectedCategory('')}
            disabled={!selectedCategory}
            style={{
              marginLeft: 8,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #ccc',
              background: selectedCategory ? '#f1f3f4' : '#fafafa',
              color: '#3c4043',
              cursor: selectedCategory ? 'pointer' : 'not-allowed'
            }}
            aria-label="Clear category filter"
          >
            Clear
          </button>
        </div>
      </div>

      <ResultsList
        results={searchResults}
        exactIds={exactIds ? Array.from(exactIds) : undefined}
        highlightQuery={searchQuery.trim() || undefined}
      />
    </div>
  );
}

export default App;
