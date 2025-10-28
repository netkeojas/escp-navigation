import { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import type { IFuseOptions } from 'fuse.js';
import Papa from 'papaparse';
import SearchBar from './components/SearchBar';
import ResultsList from './components/ResultsList';
import type { Room } from './types/room';
import { inject } from '@vercel/analytics';
import About from './pages/About';
import Header from './components/Header';
import Footer from './components/Footer';

// Toggle this flag to switch data source in the future.
const LOAD_JSON_INSTEAD_OF_CSV = false;

// Initialize Vercel Web Analytics
inject();

function App() {
  const [route, setRoute] = useState<string>(typeof window !== 'undefined' ? (window.location.hash || '#/') : '#/');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [searchResults, setSearchResults] = useState<Room[]>([]);
  const [fuse, setFuse] = useState<Fuse<Room> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [exactIds, setExactIds] = useState<Set<string> | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [floorMaps, setFloorMaps] = useState<{ building: string; floor: number; images: string[] }[]>([]);
  const [floorImgIndex, setFloorImgIndex] = useState(0);
  const [floorImgModalSrc, setFloorImgModalSrc] = useState<string | null>(null);

  // Listen to hash changes for simple routing
  useEffect(() => {
    const onHashChange = () => {
      setRoute(window.location.hash || '#/');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

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

  // Load floor maps configuration
  useEffect(() => {
    const loadFloorMaps = async () => {
      try {
        const res = await fetch('/floor-maps/floormaps.json');
        if (!res.ok) return;
        const data = await res.json();
        const arr = Array.isArray(data?.floormaps) ? data.floormaps : [];
        setFloorMaps(arr);
      } catch (e) {
        // fail silently; floor maps are optional
      }
    };
    loadFloorMaps();
  }, []);

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

  // Reset floor image index when the result set changes materially
  useEffect(() => {
    setFloorImgIndex(0);
  }, [searchResults, exactIds]);

  const handleSubmitSearch = () => {
    setHasSearched(true);
    setSearchQuery(inputValue);
  };

  // Route: About page (render within shared layout)
  if (route.startsWith('#/about')) {
    return (
      <>
        <Header onHome={() => {
          setHasSearched(false);
          setInputValue('');
          setSearchQuery('');
          setSelectedCategory('');
          setExactIds(null);
          setFloorImgIndex(0);
          setFloorImgModalSrc(null);
          setIsMapOpen(false);
          setRoute('#/');
        }} />
        <About />
        <Footer />
      </>
    );
  }

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
    <>
      <Header onHome={() => {
        setHasSearched(false);
        setInputValue('');
        setSearchQuery('');
        setSelectedCategory('');
        setExactIds(null);
        setFloorImgIndex(0);
        setFloorImgModalSrc(null);
        setIsMapOpen(false);
        setRoute('#/');
      }} />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 20, fontFamily: 'Arial, sans-serif' }}>
        <h1 style={{ textAlign: 'center', color: '#1a73e8', marginBottom: 8 }}>ESCP Room Finder</h1>
        <p style={{ textAlign: 'center', color: '#5f6368', marginTop: 0, marginBottom: 24 }}>
          Search for rooms by ID, people, Room Type, building, floor, or category
        </p>

      {/* Campus map image: show only if we haven't selected a floor map to display */}
      {!hasSearched && (
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
      )}

      {/* Fullscreen Map Modal */}
      {isMapOpen && !hasSearched && (
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
          <SearchBar
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmitSearch}
          />
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

      {/* Floor map(s) corresponding to matched criteria */}
      {hasSearched && (() => {
        const normalize = (s: string) => (s || '').trim().toUpperCase();
        const getImagesFor = (b: string, fStr: string) => {
          const f = parseInt((fStr || '').trim(), 10);
          if (Number.isNaN(f)) return [] as string[];
          const entry = floorMaps.find((m) => normalize(m.building) === normalize(b) && m.floor === f);
          if (!entry) return [] as string[];
          return (entry.images || []).map((p) => `/floor-maps/${p.replace(/^\\.\//, '')}`);
        };

        let images: string[] = [];
        let primary: Room | undefined;
        if (exactIds && exactIds.size > 0) {
          primary = searchResults.find((r) => exactIds.has(r.id));
        }
        if (!primary && searchResults.length > 0) {
          // If all results share the same building+floor, use that; otherwise use the first
          const pairs = new Set(searchResults.map((r) => `${normalize(r.building)}|${(r.floor || '').trim()}`));
          primary = pairs.size === 1 ? searchResults[0] : searchResults[0];
        }
        if (primary) images = getImagesFor(primary.building, primary.floor);

        if (images.length === 0) return null;

        const current = images[Math.min(floorImgIndex, images.length - 1)];

        const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          const x = e.clientX - rect.left;
          const third = rect.width / 3;
          if (x < third) {
            // left
            setFloorImgIndex((idx) => (images.length > 0 ? (idx - 1 + images.length) % images.length : 0));
          } else if (x > 2 * third) {
            // right
            setFloorImgIndex((idx) => (images.length > 0 ? (idx + 1) % images.length : 0));
          } else {
            // center -> open modal
            setFloorImgModalSrc(current);
          }
        };

        return (
          <div style={{ margin: '8px auto 18px auto' }}>
            <div
              onClick={handleClick}
              style={{ cursor: 'pointer', position: 'relative', display: 'inline-block' }}
              aria-label="Floor map image; click left/right to switch, center to view full size"
              title={images.length > 1 ? 'Click left/right to switch, center to view full size' : 'Click to view full size'}
            >
              <img
                src={current}
                alt={`Floor map`}
                style={{
                  width: '100%',
                  maxWidth: 900,
                  height: 'auto',
                  objectFit: 'contain',
                  borderRadius: 12,
                  border: '1px solid #e0e0e0',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
                }}
              />
              {images.length > 1 && (
                <>
                  <div
                    style={{
                      position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'rgba(0,0,0,0.35)', color: 'white', borderRadius: 999,
                      padding: '6px 10px', fontSize: 18, lineHeight: 1, pointerEvents: 'none'
                    }}
                    aria-hidden
                  >
                    ‹
                  </div>
                  <div
                    style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'rgba(0,0,0,0.35)', color: 'white', borderRadius: 999,
                      padding: '6px 10px', fontSize: 18, lineHeight: 1, pointerEvents: 'none'
                    }}
                    aria-hidden
                  >
                    ›
                  </div>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div style={{ textAlign: 'center', color: '#5f6368', fontSize: 12, marginTop: 6 }}>
                Image {Math.min(floorImgIndex, images.length - 1) + 1} of {images.length}
              </div>
            )}
            <div style={{ textAlign: 'center', color: '#5f6368', fontSize: 13, marginTop: 6 }}>
              Showing floor map for Building {primary?.building}, Floor {(primary?.floor === '0') ? 'Ground' : primary?.floor}
            </div>
          </div>
        );
      })()}

      {/* Fullscreen Floor Map Modal */}
      {floorImgModalSrc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Fullscreen floor map"
          onClick={() => setFloorImgModalSrc(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setFloorImgModalSrc(null); }}
          tabIndex={-1}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <img
            src={floorImgModalSrc}
            alt="Fullscreen floor map"
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
            onClick={(e) => { e.stopPropagation(); setFloorImgModalSrc(null); }}
          />
        </div>
      )}

        {hasSearched && (
          <ResultsList
            results={searchResults}
            exactIds={exactIds ? Array.from(exactIds) : undefined}
            highlightQuery={searchQuery.trim() || undefined}
          />
        )}
      </div>
      <Footer />
    </>
  );
}

export default App;
