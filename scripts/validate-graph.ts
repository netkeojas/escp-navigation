/**
 * Graph validation + golden step tests.
 *
 * There is no admin UI for the route graph, so this is the only thing standing
 * between a typo'd edge endpoint and a route that silently sends someone to the
 * wrong building. Run via `npm run validate`.
 */
import { NODES, EDGES } from '../src/data/graph';
import { ROOMS, ROOMS_BY_CODE } from '../src/data/rooms';
import { MAPS_BY_SLUG } from '../src/data/maps';
import { buildGraph, roomNodeId, shortestPath, stepFreeReachable } from '../src/lib/directions';
import { computeRoute, computeStepFreeUnreachable, DEFAULT_ORIGIN } from '../src/lib/route';

let failures = 0;
const fail = (m: string) => { console.error(`  FAIL  ${m}`); failures++; };
const pass = (m: string) => console.log(`  ok    ${m}`);

const nodeIds = new Set(NODES.map((n) => n.id));
const graph = buildGraph(ROOMS);

console.log('\n— Structural checks —');

// 1. Every edge endpoint exists.
let dangling = 0;
for (const e of EDGES) {
  if (!nodeIds.has(e.from)) { fail(`edge from unknown node '${e.from}'`); dangling++; }
  if (!nodeIds.has(e.to)) { fail(`edge to unknown node '${e.to}'`); dangling++; }
}
if (!dangling) pass(`${EDGES.length} edges, all endpoints resolve`);

// 2. Every room's access node exists.
const badAccess = ROOMS.filter((r) => !nodeIds.has(r.accessNode));
if (badAccess.length) badAccess.forEach((r) => fail(`${r.code}: unknown accessNode '${r.accessNode}'`));
else pass(`${ROOMS.length} rooms, all accessNodes resolve`);

// 3. Every room's map slug exists (or is deliberately null).
const badMap = ROOMS.filter((r) => r.mapSlug !== null && !MAPS_BY_SLUG.has(r.mapSlug));
if (badMap.length) badMap.forEach((r) => fail(`${r.code}: unknown mapSlug '${r.mapSlug}'`));
else pass('all mapSlugs resolve');

// 4. A mapped room must have a pin; an unmapped room must not.
for (const r of ROOMS) {
  if (r.mapSlug && !r.pin) fail(`${r.code}: mapped but has no pin`);
  if (!r.mapSlug && r.pin) fail(`${r.code}: has a pin but no map`);
}
pass('pin/map invariant holds');

// 5. Codes are unique and canonical.
const seen = new Set<string>();
for (const r of ROOMS) {
  if (seen.has(r.code)) fail(`duplicate code '${r.code}'`);
  if (!/^[A-Z0-9][A-Z0-9-]*[a-z]?$/.test(r.code)) fail(`non-canonical code '${r.code}'`);
  seen.add(r.code);
}
pass(`${seen.size} unique canonical codes`);

// 6. Vertical edges never skip a level, and shafts are contiguous.
const byId = new Map(NODES.map((n) => [n.id, n]));
for (const e of EDGES) {
  if (e.kind !== 'stairs' && e.kind !== 'lift') continue;
  const a = byId.get(e.from)!, b = byId.get(e.to)!;
  if (!a || !b) continue;
  if (Math.abs(a.level - b.level) !== 1) fail(`${e.from}->${e.to} skips a level`);
  if (a.shaft !== b.shaft) fail(`${e.from}->${e.to} crosses shafts (${a.shaft} vs ${b.shaft})`);
}
pass('vertical edges are level-adjacent and shaft-consistent');

console.log('\n— Reachability —');

// 7. Every room reachable from the main entrance.
const unreachable = ROOMS.filter(
  (r) => !shortestPath(graph, DEFAULT_ORIGIN, roomNodeId(r.code)),
);
if (unreachable.length) unreachable.forEach((r) => fail(`${r.code} unreachable from main entrance`));
else pass(`all ${ROOMS.length} rooms reachable from the main entrance`);

// 8. The step-free-unreachable set must be exactly Building D level 2.
const noStepFree = computeStepFreeUnreachable(graph, ROOMS);
const expected = new Set(
  ROOMS.filter((r) => r.building === 'D' && r.level === 2).map((r) => r.code),
);
const extra = [...noStepFree].filter((c) => !expected.has(c));
const missing = [...expected].filter((c) => !noStepFree.has(c));
if (extra.length) fail(`unexpectedly step-free-unreachable: ${extra.join(', ')}`);
if (missing.length) fail(`expected step-free-unreachable but reachable: ${missing.join(', ')}`);
if (!extra.length && !missing.length) {
  pass(`step-free-unreachable set is exactly D level 2 (${noStepFree.size} rooms)`);
}

console.log('\n— Golden routes —');

function show(code: string, stepFree: boolean) {
  const room = ROOMS_BY_CODE.get(code)!;
  const res = computeRoute(graph, room, DEFAULT_ORIGIN, stepFree);
  const tag = stepFree ? 'step-free' : 'default  ';
  if (!res.ok) { fail(`${code} (${tag}): ${res.reason}`); return; }
  const warn = 'stepFreeUnavailable' in res ? '  [no step-free route]' : '';
  console.log(`\n  ${code} (${tag}) — ~${res.route.minutes} min, ${res.route.flights} flights${warn}`);
  res.route.steps.forEach((s) => {
    console.log(`    ${s.index}. ${s.text}${s.detail ? `\n         — ${s.detail}` : ''}`);
  });
  if ('stepFreeUnavailable' in res) {
    console.log(`    ! ${res.stepFreeUnavailable.reason}`);
    console.log(`    ! step-free as far as: ${res.stepFreeUnavailable.furthestLabel ?? 'unknown'}`);
  }
  if (!res.route.steps.length) fail(`${code}: produced no steps`);
}

for (const code of ['D-275', 'K-18', 'B-023', 'C-107', 'D-169', 'B-221']) {
  show(code, false);
}
show('D-275', true);
show('K-18', true);

console.log(
  failures
    ? `\n${failures} failure(s)\n`
    : `\nAll checks passed — ${NODES.length} nodes, ${EDGES.length} edges, ${ROOMS.length} rooms.\n`,
);
process.exit(failures ? 1 : 0);
