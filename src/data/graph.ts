import type { Building, Level } from '../types';

/**
 * Campus route graph.
 *
 * Granularity rule: a node exists only where a walker must make a choice or
 * identify a physical object -- entrances, one landing per staircase per level,
 * one stop per lift per level, and one or two corridor anchors per
 * building-floor. Passages and ramps are EDGES between corridor anchors, not
 * nodes. Rooms are not in this file at all: each room names an `accessNode` and
 * is attached as a degree-1 leaf at load time (see lib/graph.ts).
 *
 * `at` is a point in a single shared campus frame, taken from the BCD overview
 * plan (x right, y down, arbitrary units). It is used only to derive left/right
 * turns from bearings -- never for rendering.
 */

export type NodeKind = 'entrance' | 'lobby' | 'corridor' | 'stair' | 'lift' | 'outdoor';

export interface GraphNode {
  id: string;
  kind: NodeKind;
  building: Building | 'OUT';
  level: Level;
  /** Used inside generated step text. */
  label: string;
  at: { x: number; y: number };
  /** Stair and lift landings in the same shaft share this. */
  shaft?: string;
  /** One sentence per corridor, reused as the arrival hint for rooms with none. */
  numbering?: string;
}

export type EdgeKind = 'walk' | 'stairs' | 'lift' | 'passage' | 'ramp' | 'door' | 'entrance';

export interface GraphEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  /** Rough metres. Defaulted per kind; tuned only where obviously wrong. */
  distance: number;
  /** Defaults to kind !== 'stairs'. */
  stepFree?: boolean;
  /** Overrides generated prose for this leg. Used sparingly. */
  hint?: string;
  flights?: number;
}

const C = { corr: { x: 1050, y: 880 }, stair: { x: 925, y: 790 }, lift: { x: 760, y: 790 } };
const B = { corr: { x: 800, y: 420 }, stair: { x: 545, y: 420 }, lift: { x: 683, y: 390 } };
const D = {
  north: { x: 1500, y: 380 },
  south: { x: 1500, y: 840 },
  stairN: { x: 1490, y: 500 },
  stairS: { x: 1490, y: 780 },
};

export const NODES: GraphNode[] = [
  // ---- Entrances & outdoor ----
  { id: 'entrance.main', kind: 'entrance', building: 'C', level: 0,
    label: 'the main entrance of Building C', at: { x: 806, y: 1005 } },
  { id: 'entrance.side', kind: 'entrance', building: 'D', level: 0,
    label: 'the side entrance by the courtyard', at: { x: 1330, y: 900 } },
  { id: 'out.courtyard', kind: 'outdoor', building: 'OUT', level: 0,
    label: 'the courtyard', at: { x: 1250, y: 640 } },

  // ---- Building C ----
  { id: 'c.0.reception', kind: 'lobby', building: 'C', level: 0,
    label: 'Reception', at: { x: 876, y: 900 } },
  { id: 'c.0.corr', kind: 'corridor', building: 'C', level: 0, at: C.corr,
    label: 'the ground-floor corridor in Building C',
    numbering: 'room numbers rise as you walk away from Reception' },
  { id: 'c.0.stair', kind: 'stair', building: 'C', level: 0, at: C.stair, shaft: 'c.main',
    label: 'the main staircase in Building C' },
  { id: 'c.0.lift', kind: 'lift', building: 'C', level: 0, at: C.lift, shaft: 'c.lift',
    label: 'the lift in Building C' },

  { id: 'c.-1.corr', kind: 'corridor', building: 'C', level: -1, at: { x: 950, y: 900 },
    label: 'the basement corridor under Building C',
    numbering: 'the student lounge and showers are at the far end' },
  { id: 'c.-1.stair', kind: 'stair', building: 'C', level: -1, at: C.stair, shaft: 'c.main',
    label: 'the main staircase in Building C' },
  { id: 'c.-1.lift', kind: 'lift', building: 'C', level: -1, at: C.lift, shaft: 'c.lift',
    label: 'the lift in Building C' },

  { id: 'c.1.corr', kind: 'corridor', building: 'C', level: 1, at: C.corr,
    label: 'the first-floor corridor in Building C',
    numbering: 'room numbers rise as you walk along the corridor' },
  { id: 'c.1.stair', kind: 'stair', building: 'C', level: 1, at: C.stair, shaft: 'c.main',
    label: 'the main staircase in Building C' },
  { id: 'c.1.lift', kind: 'lift', building: 'C', level: 1, at: C.lift, shaft: 'c.lift',
    label: 'the lift in Building C' },

  { id: 'c.2.corr', kind: 'corridor', building: 'C', level: 2, at: C.corr,
    label: 'the second-floor corridor in Building C',
    numbering: "the professors' offices run along this corridor" },
  { id: 'c.2.stair', kind: 'stair', building: 'C', level: 2, at: C.stair, shaft: 'c.main',
    label: 'the main staircase in Building C' },
  { id: 'c.2.lift', kind: 'lift', building: 'C', level: 2, at: C.lift, shaft: 'c.lift',
    label: 'the lift in Building C' },

  // ---- Building B ----
  { id: 'b.0.corr', kind: 'corridor', building: 'B', level: 0, at: B.corr,
    label: 'the ground-floor corridor in Building B',
    numbering: 'the seminar rooms are at the far end, past the student workroom' },
  { id: 'b.0.stair', kind: 'stair', building: 'B', level: 0, at: B.stair, shaft: 'b.main',
    label: 'the staircase in Building B' },
  { id: 'b.0.lift', kind: 'lift', building: 'B', level: 0, at: B.lift, shaft: 'b.lift',
    label: 'the lift in Building B' },

  { id: 'b.-1.corr', kind: 'corridor', building: 'B', level: -1, at: B.corr,
    label: 'the basement corridor under Building B',
    numbering: 'K-18 is the large room straight ahead' },
  { id: 'b.-1.stair', kind: 'stair', building: 'B', level: -1, at: B.stair, shaft: 'b.main',
    label: 'the staircase in Building B' },
  { id: 'b.-1.lift', kind: 'lift', building: 'B', level: -1, at: B.lift, shaft: 'b.lift',
    label: 'the lift in Building B' },

  { id: 'b.1.corr', kind: 'corridor', building: 'B', level: 1, at: B.corr,
    label: 'the first-floor corridor in Building B',
    numbering: 'room numbers rise as you walk away from the stairs' },
  { id: 'b.1.stair', kind: 'stair', building: 'B', level: 1, at: B.stair, shaft: 'b.main',
    label: 'the staircase in Building B' },
  { id: 'b.1.lift', kind: 'lift', building: 'B', level: 1, at: B.lift, shaft: 'b.lift',
    label: 'the lift in Building B' },

  { id: 'b.2.corr', kind: 'corridor', building: 'B', level: 2, at: B.corr,
    label: 'the second-floor corridor in Building B',
    numbering: 'B-221 and the IT office are along this corridor' },
  { id: 'b.2.stair', kind: 'stair', building: 'B', level: 2, at: B.stair, shaft: 'b.main',
    label: 'the staircase in Building B' },
  { id: 'b.2.lift', kind: 'lift', building: 'B', level: 2, at: B.lift, shaft: 'b.lift',
    label: 'the lift in Building B' },

  // ---- Building D (no lift anywhere in the building) ----
  { id: 'd.0.corr-north', kind: 'corridor', building: 'D', level: 0, at: D.north,
    label: 'the north end of the ground-floor corridor in Building D',
    numbering: 'this is the Blue Factory end of the building' },
  { id: 'd.0.corr-south', kind: 'corridor', building: 'D', level: 0, at: D.south,
    label: 'the south end of the ground-floor corridor in Building D',
    numbering: 'the student service desks are along the inner wall' },
  { id: 'd.0.stair-north', kind: 'stair', building: 'D', level: 0, at: D.stairN, shaft: 'd.north',
    label: 'the north staircase in Building D' },
  { id: 'd.0.stair-south', kind: 'stair', building: 'D', level: 0, at: D.stairS, shaft: 'd.south',
    label: 'the south staircase in Building D' },

  { id: 'd.1.corr-north', kind: 'corridor', building: 'D', level: 1, at: D.north,
    label: 'the north end of the first-floor corridor in Building D',
    numbering: 'room numbers fall as you walk towards the Career Centre' },
  { id: 'd.1.corr-south', kind: 'corridor', building: 'D', level: 1, at: D.south,
    label: 'the south end of the first-floor corridor in Building D',
    numbering: 'room numbers rise towards the far end' },
  { id: 'd.1.stair-north', kind: 'stair', building: 'D', level: 1, at: D.stairN, shaft: 'd.north',
    label: 'the north staircase in Building D' },
  { id: 'd.1.stair-south', kind: 'stair', building: 'D', level: 1, at: D.stairS, shaft: 'd.south',
    label: 'the south staircase in Building D' },

  { id: 'd.2.corr-north', kind: 'corridor', building: 'D', level: 2, at: D.north,
    label: 'the north end of the second-floor corridor in Building D',
    numbering: 'room numbers fall towards the far end' },
  { id: 'd.2.corr-south', kind: 'corridor', building: 'D', level: 2, at: D.south,
    label: 'the south end of the second-floor corridor in Building D',
    numbering: 'room numbers rise towards the far end' },
  { id: 'd.2.stair-north', kind: 'stair', building: 'D', level: 2, at: D.stairN, shaft: 'd.north',
    label: 'the north staircase in Building D' },
  { id: 'd.2.stair-south', kind: 'stair', building: 'D', level: 2, at: D.stairS, shaft: 'd.south',
    label: 'the south staircase in Building D' },
];

/** Undirected unless noted; the loader mirrors every edge. */
export const EDGES: GraphEdge[] = [
  // Entrances
  { from: 'entrance.main', to: 'c.0.reception', kind: 'entrance', distance: 6,
    hint: 'Reception is straight ahead.' },
  { from: 'entrance.side', to: 'd.0.corr-south', kind: 'entrance', distance: 10 },
  { from: 'entrance.side', to: 'out.courtyard', kind: 'walk', distance: 20 },
  { from: 'out.courtyard', to: 'c.0.corr', kind: 'walk', distance: 35 },

  // Building C vertical + horizontal
  { from: 'c.0.reception', to: 'c.0.corr', kind: 'walk', distance: 14 },
  { from: 'c.0.reception', to: 'c.0.stair', kind: 'walk', distance: 12 },
  { from: 'c.0.reception', to: 'c.0.lift', kind: 'walk', distance: 14 },
  { from: 'c.0.corr', to: 'c.0.stair', kind: 'walk', distance: 16 },
  { from: 'c.-1.stair', to: 'c.-1.corr', kind: 'walk', distance: 15 },
  { from: 'c.-1.lift', to: 'c.-1.corr', kind: 'walk', distance: 18 },
  { from: 'c.1.stair', to: 'c.1.corr', kind: 'walk', distance: 16 },
  { from: 'c.1.lift', to: 'c.1.corr', kind: 'walk', distance: 18 },
  { from: 'c.2.stair', to: 'c.2.corr', kind: 'walk', distance: 16 },
  { from: 'c.2.lift', to: 'c.2.corr', kind: 'walk', distance: 18 },
  { from: 'c.-1.stair', to: 'c.0.stair', kind: 'stairs', distance: 12, flights: 1 },
  { from: 'c.0.stair', to: 'c.1.stair', kind: 'stairs', distance: 12, flights: 1 },
  { from: 'c.1.stair', to: 'c.2.stair', kind: 'stairs', distance: 12, flights: 1 },
  { from: 'c.-1.lift', to: 'c.0.lift', kind: 'lift', distance: 4 },
  { from: 'c.0.lift', to: 'c.1.lift', kind: 'lift', distance: 4 },
  { from: 'c.1.lift', to: 'c.2.lift', kind: 'lift', distance: 4 },

  // Building B vertical + horizontal
  { from: 'b.0.corr', to: 'b.0.stair', kind: 'walk', distance: 18 },
  { from: 'b.0.corr', to: 'b.0.lift', kind: 'walk', distance: 12 },
  { from: 'b.-1.corr', to: 'b.-1.stair', kind: 'walk', distance: 16 },
  { from: 'b.-1.corr', to: 'b.-1.lift', kind: 'walk', distance: 12 },
  { from: 'b.1.corr', to: 'b.1.stair', kind: 'walk', distance: 18 },
  { from: 'b.1.corr', to: 'b.1.lift', kind: 'walk', distance: 12 },
  { from: 'b.2.corr', to: 'b.2.stair', kind: 'walk', distance: 18 },
  { from: 'b.2.corr', to: 'b.2.lift', kind: 'walk', distance: 12 },
  { from: 'b.-1.stair', to: 'b.0.stair', kind: 'stairs', distance: 12, flights: 1 },
  { from: 'b.0.stair', to: 'b.1.stair', kind: 'stairs', distance: 12, flights: 1 },
  { from: 'b.1.stair', to: 'b.2.stair', kind: 'stairs', distance: 12, flights: 1 },
  { from: 'b.-1.lift', to: 'b.0.lift', kind: 'lift', distance: 4 },
  { from: 'b.0.lift', to: 'b.1.lift', kind: 'lift', distance: 4 },
  { from: 'b.1.lift', to: 'b.2.lift', kind: 'lift', distance: 4 },

  // Building D -- stairs only, no lift serves any floor
  { from: 'd.0.corr-north', to: 'd.0.corr-south', kind: 'walk', distance: 45 },
  { from: 'd.1.corr-north', to: 'd.1.corr-south', kind: 'walk', distance: 45 },
  { from: 'd.2.corr-north', to: 'd.2.corr-south', kind: 'walk', distance: 45 },
  { from: 'd.0.corr-north', to: 'd.0.stair-north', kind: 'walk', distance: 12 },
  { from: 'd.0.corr-south', to: 'd.0.stair-south', kind: 'walk', distance: 12 },
  { from: 'd.1.corr-north', to: 'd.1.stair-north', kind: 'walk', distance: 12 },
  { from: 'd.1.corr-south', to: 'd.1.stair-south', kind: 'walk', distance: 12 },
  { from: 'd.2.corr-north', to: 'd.2.stair-north', kind: 'walk', distance: 12 },
  { from: 'd.2.corr-south', to: 'd.2.stair-south', kind: 'walk', distance: 12 },
  { from: 'd.0.stair-north', to: 'd.1.stair-north', kind: 'stairs', distance: 12, flights: 1 },
  { from: 'd.1.stair-north', to: 'd.2.stair-north', kind: 'stairs', distance: 12, flights: 1 },
  { from: 'd.0.stair-south', to: 'd.1.stair-south', kind: 'stairs', distance: 12, flights: 1 },
  { from: 'd.1.stair-south', to: 'd.2.stair-south', kind: 'stairs', distance: 12, flights: 1 },

  // Inter-building passages
  { from: 'c.0.corr', to: 'b.0.corr', kind: 'passage', distance: 18 },
  { from: 'b.0.corr', to: 'd.0.corr-north', kind: 'ramp', distance: 22,
    hint: 'The link slopes gently -- there are no steps.' },
  { from: 'c.-1.corr', to: 'b.-1.corr', kind: 'passage', distance: 18 },
  { from: 'c.1.corr', to: 'b.1.corr', kind: 'passage', distance: 18 },
  { from: 'b.1.corr', to: 'd.1.corr-north', kind: 'passage', distance: 20 },
  { from: 'c.1.corr', to: 'd.1.corr-south', kind: 'passage', distance: 20 },
];
