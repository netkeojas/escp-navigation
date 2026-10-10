import type { Room } from '../types';
import { levelLabel } from '../types';
import {
  buildGraph, roomNodeId, shortestPath, stepFreeReachable,
  type Graph, type PathLeg,
} from './directions';
import { estimateMinutes, renderSteps, type DirectionStep } from './steps';

export interface Origin {
  id: string;
  label: string;
}

/** Offered in the "From" chip. Main entrance is the default. */
export const ORIGINS: Origin[] = [
  { id: 'entrance.main', label: 'Main entrance' },
  { id: 'entrance.side', label: 'Side entrance (courtyard)' },
  { id: 'c.0.reception', label: 'Reception' },
  { id: 'c.0.corr', label: "I'm in Building C" },
  { id: 'b.0.corr', label: "I'm in Building B" },
  { id: 'd.0.corr-south', label: "I'm in Building D" },
  { id: 'c.-1.corr', label: "I'm in the basement" },
];

export const DEFAULT_ORIGIN = ORIGINS[0].id;

export interface Route {
  steps: DirectionStep[];
  minutes: number;
  flights: number;
  stepFree: boolean;
}

export type RouteResult =
  | { ok: true; route: Route }
  | {
      ok: true;
      route: Route;
      /** Asked for step-free, but the building makes it impossible. */
      stepFreeUnavailable: {
        /** How far a step-free route does get. */
        furthestLabel: string | null;
        reason: string;
      };
    }
  | { ok: false; reason: 'no-route' | 'unknown-room' | 'no-map' };

function toRoute(legs: PathLeg[], graph: Graph, room: Room, stepFree: boolean): Route {
  return {
    steps: renderSteps(legs, { graph, room, stepFree }),
    minutes: estimateMinutes(legs),
    flights: legs
      .filter((l) => l.edge.kind === 'stairs')
      .reduce((n, l) => n + (l.edge.flights ?? 1), 0),
    stepFree,
  };
}

export function computeRoute(
  graph: Graph,
  room: Room,
  originId: string,
  stepFree: boolean,
): RouteResult {
  const goal = roomNodeId(room.code);
  if (!graph.nodes.has(goal)) return { ok: false, reason: 'unknown-room' };

  if (stepFree) {
    const legs = shortestPath(graph, originId, goal, { stepFree: true });
    if (legs) return { ok: true, route: toRoute(legs, graph, room, true) };

    // No step-free path exists. Offer the stair route and say how far we CAN get,
    // rather than silently handing back a route with stairs in it.
    const fallback = shortestPath(graph, originId, goal);
    if (!fallback) return { ok: false, reason: 'no-route' };
    const reachable = stepFreeReachable(graph, originId);
    const access = graph.nodes.get(room.accessNode);
    let furthestLabel: string | null = null;
    for (const id of reachable) {
      const n = graph.nodes.get(id);
      if (!n || n.kind !== 'corridor' || !access) continue;
      if (n.building === access.building && n.level === access.level - 1) {
        furthestLabel = `Building ${n.building}, ${levelLabel(n.level).toLowerCase()}`;
      }
    }
    return {
      ok: true,
      route: toRoute(fallback, graph, room, false),
      stepFreeUnavailable: {
        furthestLabel,
        reason:
          room.building === 'D' && room.level === 2
            ? "Building D's second floor has no lift — the only way up is the staircase from the first floor."
            : 'This room can only be reached by stairs.',
      },
    };
  }

  const legs = shortestPath(graph, originId, goal);
  if (!legs) return { ok: false, reason: 'no-route' };
  return { ok: true, route: toRoute(legs, graph, room, false) };
}

/** Codes that cannot be reached without stairs, for badging search results. */
export function computeStepFreeUnreachable(graph: Graph, rooms: Room[]): Set<string> {
  const reachable = stepFreeReachable(graph, DEFAULT_ORIGIN);
  const out = new Set<string>();
  for (const r of rooms) {
    if (r.isActive && !reachable.has(roomNodeId(r.code))) out.add(r.code);
  }
  return out;
}

export { buildGraph };
export type { Graph };
