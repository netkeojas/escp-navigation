import { EDGES, NODES, type EdgeKind, type GraphEdge, type GraphNode } from '../data/graph';
import type { Room } from '../types';
import { levelLabel } from '../types';

/* ------------------------------------------------------------------ *
 * Graph assembly
 * ------------------------------------------------------------------ */

export interface Link {
  edge: GraphEdge;
  to: string;
  /** Static weight; see WEIGHTS below. */
  cost: number;
}

/** Reluctance weights, in "metres of unwillingness". */
const PER_LEG = 1;
const STAIR_PER_FLIGHT = 4;
const LIFT_WAIT = 25;
const BUILDING_CHANGE = 15;
const OUTDOOR = 20;

function isStepFree(e: GraphEdge): boolean {
  return e.stepFree ?? e.kind !== 'stairs';
}

export interface Graph {
  nodes: Map<string, GraphNode>;
  adj: Map<string, Link[]>;
}

function weight(e: GraphEdge, from: GraphNode, to: GraphNode): number {
  let c = e.distance + PER_LEG;
  if (e.kind === 'stairs') c += STAIR_PER_FLIGHT * (e.flights ?? 1);
  // The lift wait is charged on ENTRY to a shaft, not per hop, so a three-level
  // ride does not pay it three times. Keying on (from.kind, to.kind) keeps this
  // a static edge weight, so Dijkstra stays exactly correct.
  if (to.kind === 'lift' && from.kind !== 'lift') c += LIFT_WAIT;
  if (from.building !== to.building && from.building !== 'OUT' && to.building !== 'OUT') {
    c += BUILDING_CHANGE;
  }
  if (from.kind === 'outdoor' || to.kind === 'outdoor') c += OUTDOOR;
  return c;
}

/** Builds the static graph plus one degree-1 leaf per room. */
export function buildGraph(rooms: Room[]): Graph {
  const nodes = new Map<string, GraphNode>();
  for (const n of NODES) nodes.set(n.id, n);

  for (const r of rooms) {
    if (!r.isActive) continue;
    const access = nodes.get(r.accessNode);
    if (!access) continue; // validated separately; never silently route wrong
    nodes.set(roomNodeId(r.code), {
      id: roomNodeId(r.code),
      kind: 'corridor',
      building: r.building,
      level: r.level,
      label: r.name,
      at: access.at,
    });
  }

  const adj = new Map<string, Link[]>();
  const push = (e: GraphEdge) => {
    const from = nodes.get(e.from);
    const to = nodes.get(e.to);
    if (!from || !to) return;
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push({ edge: e, to: e.to, cost: weight(e, from, to) });
  };

  for (const e of EDGES) {
    push(e);
    push({ ...e, from: e.to, to: e.from });
  }

  for (const r of rooms) {
    if (!r.isActive || !nodes.has(r.accessNode)) continue;
    const doorEdge: GraphEdge = {
      from: r.accessNode,
      to: roomNodeId(r.code),
      kind: 'door',
      distance: 4,
      stepFree: true,
    };
    push(doorEdge);
    push({ ...doorEdge, from: doorEdge.to, to: doorEdge.from });
  }

  return { nodes, adj };
}

export const roomNodeId = (code: string) => `room:${code}`;

/* ------------------------------------------------------------------ *
 * Dijkstra
 * ------------------------------------------------------------------ */

export interface PathLeg {
  from: GraphNode;
  to: GraphNode;
  edge: GraphEdge;
}

/** Lexicographic on (cost, hops): among equal-cost routes, fewest legs wins. */
export function shortestPath(
  graph: Graph,
  startId: string,
  goalId: string,
  opts: { stepFree?: boolean } = {},
): PathLeg[] | null {
  if (!graph.nodes.has(startId) || !graph.nodes.has(goalId)) return null;
  if (startId === goalId) return [];

  const dist = new Map<string, number>([[startId, 0]]);
  const hops = new Map<string, number>([[startId, 0]]);
  const prev = new Map<string, { id: string; edge: GraphEdge }>();
  const done = new Set<string>();
  // A linear scan is ample for a graph this size and keeps the code honest.
  const queue = new Set<string>([startId]);

  while (queue.size) {
    let cur: string | null = null;
    for (const id of queue) {
      if (
        cur === null ||
        dist.get(id)! < dist.get(cur)! ||
        (dist.get(id)! === dist.get(cur)! && hops.get(id)! < hops.get(cur)!)
      ) {
        cur = id;
      }
    }
    if (cur === null) break;
    queue.delete(cur);
    done.add(cur);
    if (cur === goalId) break;

    for (const link of graph.adj.get(cur) ?? []) {
      if (done.has(link.to)) continue;
      if (opts.stepFree && !isStepFree(link.edge)) continue;
      const nd = dist.get(cur)! + link.cost;
      const nh = hops.get(cur)! + 1;
      const od = dist.get(link.to);
      if (od === undefined || nd < od || (nd === od && nh < hops.get(link.to)!)) {
        dist.set(link.to, nd);
        hops.set(link.to, nh);
        prev.set(link.to, { id: cur, edge: link.edge });
        queue.add(link.to);
      }
    }
  }

  if (!prev.has(goalId)) return null;
  const legs: PathLeg[] = [];
  let at = goalId;
  while (at !== startId) {
    const p = prev.get(at)!;
    legs.unshift({ from: graph.nodes.get(p.id)!, to: graph.nodes.get(at)!, edge: p.edge });
    at = p.id;
  }
  return legs;
}

/** Every node reachable without stairs, for the unreachable-set precompute. */
export function stepFreeReachable(graph: Graph, startId: string): Set<string> {
  const seen = new Set<string>([startId]);
  const stack = [startId];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const link of graph.adj.get(cur) ?? []) {
      if (seen.has(link.to) || !isStepFree(link.edge)) continue;
      seen.add(link.to);
      stack.push(link.to);
    }
  }
  return seen;
}
