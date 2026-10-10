import type { GraphNode } from '../data/graph';
import type { Graph, PathLeg } from './directions';
import type { Room } from '../types';
import { levelLabel } from '../types';

export type StepIcon =
  | 'enter' | 'walk' | 'stairs-up' | 'stairs-down' | 'lift'
  | 'passage' | 'ramp' | 'outdoor' | 'arrive';

export interface DirectionStep {
  index: number;
  icon: StepIcon;
  text: string;
  detail?: string;
}

type SegKind = 'entrance' | 'walk' | 'vertical' | 'passage' | 'arrive';

interface Segment {
  kind: SegKind;
  legs: PathLeg[];
  from: GraphNode;
  to: GraphNode;
}

/** Pass 2: collapse runs of like legs into segments. */
function merge(legs: PathLeg[]): Segment[] {
  const segs: Segment[] = [];
  for (const leg of legs) {
    const k = leg.edge.kind;
    const kind: SegKind =
      k === 'entrance' ? 'entrance'
      : k === 'door' ? 'arrive'
      : k === 'stairs' || k === 'lift' ? 'vertical'
      : k === 'passage' || k === 'ramp' ? 'passage'
      : 'walk';

    const last = segs[segs.length - 1];
    const sameShaft =
      last && kind === 'vertical' && last.kind === 'vertical' &&
      last.to.shaft && leg.from.shaft && last.to.shaft === leg.from.shaft;
    const sameFloorWalk =
      last && kind === 'walk' && last.kind === 'walk' &&
      last.to.building === leg.from.building && last.to.level === leg.from.level;

    if (sameShaft || sameFloorWalk) {
      last.legs.push(leg);
      last.to = leg.to;
    } else {
      segs.push({ kind, legs: [leg], from: leg.from, to: leg.to });
    }
  }
  return segs;
}

/** Signed turn at a junction, in screen coords (y down). */
function turnAt(a: GraphNode, b: GraphNode, c: GraphNode): 'left' | 'right' | null {
  const v1 = { x: b.at.x - a.at.x, y: b.at.y - a.at.y };
  const v2 = { x: c.at.x - b.at.x, y: c.at.y - b.at.y };
  const m1 = Math.hypot(v1.x, v1.y);
  const m2 = Math.hypot(v2.x, v2.y);
  if (m1 < 1 || m2 < 1) return null;
  const cross = (v1.x * v2.y - v1.y * v2.x) / (m1 * m2);
  const dot = (v1.x * v2.x + v1.y * v2.y) / (m1 * m2);
  // Under 30 degrees reads as "carry on"; a near-reversal means the node
  // placement is off, so say nothing rather than something wrong.
  if (dot > Math.cos((30 * Math.PI) / 180)) return null;
  if (dot < Math.cos((135 * Math.PI) / 180)) return null;
  return cross > 0 ? 'right' : 'left';
}

function distanceOf(seg: Segment): number {
  return seg.legs.reduce((n, l) => n + l.edge.distance, 0);
}

function flightsOf(seg: Segment): number {
  return seg.legs.reduce((n, l) => n + (l.edge.flights ?? 1), 0);
}

/** Is there a lift serving the same building and level as this stair landing? */
function liftBeside(graph: Graph, node: GraphNode): GraphNode | null {
  for (const n of graph.nodes.values()) {
    if (n.kind === 'lift' && n.building === node.building && n.level === node.level) return n;
  }
  return null;
}

export interface RenderContext {
  graph: Graph;
  room: Room;
  stepFree: boolean;
  /** True when the room cannot be reached step-free at all. */
  noStepFreeRoute?: boolean;
}

/** Passes 3 and 4: annotate and render. */
export function renderSteps(legs: PathLeg[], ctx: RenderContext): DirectionStep[] {
  if (!legs.length) return [];
  const segs = merge(legs);
  const out: DirectionStep[] = [];
  let pendingWalk: Segment | null = null;

  const place = (n: GraphNode) =>
    n.building === 'OUT' ? 'outside' : `Building ${n.building}, ${levelLabel(n.level).toLowerCase()}`;

  segs.forEach((seg, i) => {
    const prev = segs[i - 1];
    const turn =
      prev && seg.kind === 'walk'
        ? turnAt(prev.from, seg.from, seg.to)
        : null;

    const emit = (icon: StepIcon, text: string, detail?: string) =>
      out.push({ index: out.length + 1, icon, text, detail });

    switch (seg.kind) {
      case 'entrance': {
        emit('enter', `Go in through ${seg.from.label}.`, seg.legs[0].edge.hint);
        break;
      }

      case 'walk': {
        // Hold it back: a walk that leads into stairs, a passage or a door
        // reads far better folded into that next instruction.
        const next = segs[i + 1];
        if (next && next.kind !== 'walk') {
          pendingWalk = seg;
          return;
        }
        const d = Math.round(distanceOf(seg) / 5) * 5;
        const lead = turn ? `Turn ${turn} and follow` : 'Follow';
        emit('walk', `${lead} the corridor.`, d >= 10 ? `about ${d} m` : undefined);
        break;
      }

      case 'vertical': {
        const viaLift = seg.legs[0].edge.kind === 'lift';
        const up = seg.to.level > seg.from.level;
        const n = flightsOf(seg);
        const target = seg.to.level === -1 ? 'the basement' : place(seg.to);
        const walkIn = pendingWalk;
        pendingWalk = null;

        if (viaLift) {
          const lead = walkIn ? `Carry on to ${seg.from.label} and take it` : `Take ${seg.from.label}`;
          const btn = seg.to.level === -1 ? '−1' : String(seg.to.level);
          emit('lift', `${lead} to ${target}.`, `Press ${btn}.`);
        } else {
          const lead = walkIn
            ? `Carry on to ${seg.from.label} and take it`
            : `Take ${seg.from.label}`;
          const dir = up ? 'up' : 'down';
          const floors = n === 1 ? 'one floor' : `${n} floors`;
          let detail: string | undefined;
          const lift = liftBeside(ctx.graph, seg.from);
          if (lift && !ctx.stepFree) {
            const btn = seg.to.level === -1 ? '−1' : String(seg.to.level);
            detail = `${capitalise(lift.label)} is right here too — press ${btn}.`;
          }
          if (seg.to.building === 'D' && seg.to.level === 2) {
            detail = 'No lift reaches this floor.';
          }
          emit(up ? 'stairs-up' : 'stairs-down', `${lead} ${dir} ${floors}, to ${target}.`, detail);
        }
        break;
      }

      case 'passage': {
        const ramp = seg.legs[0].edge.kind === 'ramp';
        const walkIn = pendingWalk;
        pendingWalk = null;
        const lead = walkIn ? 'Follow the corridor' : 'Head';
        emit(
          ramp ? 'ramp' : 'passage',
          `${lead} across into Building ${seg.to.building}.`,
          seg.legs[0].edge.hint ??
            `You're now in ${place(seg.to)}.`,
        );
        break;
      }

      case 'arrive': {
        const walkIn = pendingWalk;
        pendingWalk = null;
        const lead = turnLead(prev, seg, walkIn);
        const name = ctx.room.code;
        if (ctx.room.localHint) {
          emit('arrive', `${lead}${name} is ${ctx.room.localHint}.`);
        } else {
          // The corridor's `numbering` is a standalone sentence, so it goes in
          // the detail line rather than being spliced into "X is ...".
          emit('arrive', `${lead}${name} is along this corridor.`, seg.from.numbering);
        }
        break;
      }
    }
  });

  return out;
}

function turnLead(prev: Segment | undefined, seg: Segment, walkIn: Segment | null): string {
  if (walkIn) return 'Follow the corridor. ';
  if (prev?.kind === 'vertical') return 'Come out of the stairwell. ';
  return '';
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Rough walking time, for the header chip. */
export function estimateMinutes(legs: PathLeg[]): number {
  const metres = legs.reduce((n, l) => n + l.edge.distance, 0);
  const flights = legs
    .filter((l) => l.edge.kind === 'stairs')
    .reduce((n, l) => n + (l.edge.flights ?? 1), 0);
  const lifts = legs.filter((l) => l.edge.kind === 'lift').length ? 45 : 0;
  const seconds = metres / 1.3 + flights * 20 + lifts;
  return Math.max(1, Math.round(seconds / 60));
}
