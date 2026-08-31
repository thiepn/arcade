import { readFileSync } from 'node:fs';
import {
  GRAVITY_FLIGHT_CONTRACTS,
  getGravityFlightContract,
  getGravityFlightContractBonus,
  isGravityFlightContractComplete,
} from '../src/lib/gravityFlightContracts';
import {
  CHRONO_FOCUS_MAX_CHARGES,
  CHRONO_FOCUS_PASS_INTERVAL,
  CHRONO_FOCUS_PRECISION_FRACTION,
  getChronoFocusBonus,
  getChronoFocusCharges,
  isChronoFocusHit,
} from '../src/lib/chronoFocusMastery';
import { CHRONO_SIDES, getChronoGapCenterAngle, isAngleInChronoGap } from '../src/lib/chronoWavePlanner';
import {
  DRIFT_STYLE_MAX_CHAIN,
  DRIFT_STYLE_ROUTES,
  advanceDriftStyleRoute,
  getDriftStyleBonus,
} from '../src/lib/driftStyleRoutes';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

// Gravity — five authored sector contracts, optional and score-only.
assert(GRAVITY_FLIGHT_CONTRACTS.length === 5, 'Gravity must retain one authored Flight Contract per sector');
assert(new Set(GRAVITY_FLIGHT_CONTRACTS.map((contract) => contract.id)).size === 5, 'Gravity Flight Contract IDs must be unique');
for (let level = 1; level <= 5; level++) {
  const contract = getGravityFlightContract(level);
  assert(contract.minStars >= 2 && contract.minStars <= 3, `Gravity sector ${level} has unreasonable star requirement`);
}
assert(
  isGravityFlightContractComplete(getGravityFlightContract(1), { stars: 3, boostsUsed: 4, flipsUsed: 0, recallsUsed: 2 }),
  'Gravity Star Sweep should care only about its stated three-star objective',
);
assert(
  !isGravityFlightContractComplete(getGravityFlightContract(2), { stars: 3, boostsUsed: 2, flipsUsed: 0, recallsUsed: 0 }),
  'Gravity Thrift Vector must reject excess boosts',
);
assert(
  isGravityFlightContractComplete(getGravityFlightContract(3), { stars: 2, boostsUsed: 4, flipsUsed: 1, recallsUsed: 2 }),
  'Gravity Polarity Run should accept a valid flip-and-stars route',
);
assert(getGravityFlightContractBonus(5, 5) > getGravityFlightContractBonus(1, 1), 'Gravity contract rewards must escalate');

// Chrono — Focus never changes safe-gap geometry or planner timing.
assert(CHRONO_FOCUS_MAX_CHARGES === 2, 'Chrono Focus charge cap changed');
assert(CHRONO_FOCUS_PASS_INTERVAL === 4, 'Chrono Focus earn cadence changed');
assert(CHRONO_FOCUS_PRECISION_FRACTION > 0 && CHRONO_FOCUS_PRECISION_FRACTION < 0.5, 'Chrono Focus precision window is not meaningfully tighter than the safe gap');
assert(getChronoFocusCharges(3, 0) === 0, 'Chrono Focus charged too early');
assert(getChronoFocusCharges(4, 0) === 1, 'Chrono Focus did not charge after four clean passes');
assert(getChronoFocusCharges(8, 2) === 2, 'Chrono Focus exceeded its charge cap');
const focusCenter = getChronoGapCenterAngle(0, 2, CHRONO_SIDES);
const sectorAngle = (Math.PI * 2) / CHRONO_SIDES;
const safeButOffCenter = focusCenter + sectorAngle * 0.75;
assert(isChronoFocusHit(focusCenter, 0, 2, CHRONO_SIDES), 'Chrono exact gap center must satisfy Focus');
assert(isAngleInChronoGap(safeButOffCenter, 0, 2, CHRONO_SIDES), 'Chrono off-center test point must remain a normal safe pass');
assert(!isChronoFocusHit(safeButOffCenter, 0, 2, CHRONO_SIDES), 'Chrono Focus must be narrower than the ordinary safe gap');
assert(getChronoFocusBonus(5) > getChronoFocusBonus(1), 'Chrono Focus streak reward does not escalate');

// Drift — each route is a full permutation; ordinary positive events remain independently valid.
assert(DRIFT_STYLE_ROUTES.length === 3, 'Cyber Drift must expose exactly three Style Routes');
assert(new Set(DRIFT_STYLE_ROUTES.map((route) => route.id)).size === 3, 'Cyber Drift Style Route IDs must be unique');
for (const route of DRIFT_STYLE_ROUTES) {
  assert(route.events.length === 3, `${route.label} is not a three-event route`);
  assert(new Set(route.events).size === 3, `${route.label} repeats an event instead of using Apex/Rival/Nitro once each`);
}
let progress = advanceDriftStyleRoute(0, 0, 'apex');
assert(progress.progress === 1 && !progress.completed, 'Cyber Drift route did not advance on its first expected event');
progress = advanceDriftStyleRoute(progress.routeIndex, progress.progress, 'rival');
assert(progress.progress === 2 && !progress.completed, 'Cyber Drift route did not advance on its second expected event');
progress = advanceDriftStyleRoute(progress.routeIndex, progress.progress, 'nitro');
assert(progress.completed && progress.routeIndex === 1 && progress.progress === 0, 'Cyber Drift route did not complete/rotate correctly');
const reset = advanceDriftStyleRoute(1, 1, 'rival');
assert(reset.progress === 0 && !reset.completed, 'Cyber Drift wrong event should reset only the optional route');
assert(DRIFT_STYLE_MAX_CHAIN === 5, 'Cyber Drift Style chain cap changed');
assert(getDriftStyleBonus(5) > getDriftStyleBonus(1), 'Cyber Drift Style reward does not escalate');

const gravitySource = readFileSync('src/games/GravityGame.tsx', 'utf8');
const chronoSource = readFileSync('src/games/ChronoGame.tsx', 'utf8');
const driftSource = readFileSync('src/games/DriftGame.tsx', 'utf8');
const registry = readFileSync('src/data/games.ts', 'utf8');

for (const token of ['getGravityFlightContract', 'contractStreak', 'boostsUsed', 'flipsUsed', 'recallsUsed', 'FLIGHT CONTRACT']) {
  assert(gravitySource.includes(token), `Gravity P13 integration is missing: ${token}`);
}
for (const token of ['isChronoFocusHit', 'focusCharges', 'focusArmed', 'focusStreak', 'FOCUS WAGER']) {
  assert(chronoSource.includes(token), `Chrono P13 integration is missing: ${token}`);
}
for (const token of ['advanceDriftStyleRoute', 'styleRouteIndex', 'styleRouteProgress', 'styleChain', 'STYLE ROUTE']) {
  assert(driftSource.includes(token), `Cyber Drift P13 integration is missing: ${token}`);
}
for (const phrase of ['Flight Contracts', 'Focus Wager', 'Style Routes']) {
  assert(registry.includes(phrase), `game registry does not teach P13 mechanic: ${phrase}`);
}

if (errors.length) {
  console.error('P13 FLIGHT / FOCUS / STYLE AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P13 FLIGHT / FOCUS / STYLE AUDIT — PASS');
console.log('Gravity Flight Contracts, Chrono Focus Wagers, and Cyber Drift Style Routes are bounded, optional, and preserve deterministic base gameplay.');
