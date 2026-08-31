import { readFileSync } from 'node:fs';
import { getSnakeFirewallCells, getSnakeFirewallStage } from '../src/games/snakeExperience';

const read = (path: string) => readFileSync(path, 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

const snake = read('src/games/SnakeGame.tsx');
const orbit = read('src/games/OrbitGame.tsx');
const chain = read('src/games/ChainGame.tsx');
const oneline = read('src/games/OneLineGame.tsx');
const registry = read('src/data/games.ts');

const expectedStages = new Map<number, number>([
  [4, 0], [7, 0], [8, 1], [12, 2], [16, 3], [20, 4], [99, 4],
]);
for (const [length, stage] of expectedStages) {
  assert(getSnakeFirewallStage(length) === stage, `snake length ${length} should map to firewall stage ${stage}`);
}

const allCells = getSnakeFirewallCells(4);
assert(allCells.length === 14, `expected 14 total firewall cells, found ${allCells.length}`);
assert(new Set(allCells.map((cell) => `${cell.x},${cell.y}`)).size === allCells.length, 'firewall patterns contain duplicate cells');
assert(allCells.every((cell) => cell.x > 0 && cell.x < 21 && cell.y > 0 && cell.y < 21), 'firewalls must stay inside the 22x22 grid interior');
const blocked = new Set(['6,5', '15,14']);
const filtered = getSnakeFirewallCells(4, blocked);
assert(filtered.length === 12, 'blocked snake/food cells must be removed from firewall rebuilds');
assert(filtered.every((cell) => !blocked.has(`${cell.x},${cell.y}`)), 'firewall rebuild placed a cell on blocked occupancy');
assert(snake.includes('firewallCollision && !isGhost'), 'Cyber Serpent does not make Ghost Phase bypass firewalls');
assert(snake.includes('getSnakeFirewallStage(state.snake.length)'), 'Cyber Serpent firewall progression is not tied to growth');
assert(snake.includes('FW L{firewallStage}'), 'Cyber Serpent does not surface firewall progression in the HUD');

assert(orbit.includes('PULSE = LANE + REVERSE'), 'Orbit always-visible control help does not explain Pulse semantics');
assert(orbit.includes('↑ / ↓:'), 'Orbit help does not distinguish lane-only controls');

assert(chain.includes('PLASMA — BREAK SHIELDS / NULLIFIERS'), 'Chain lacks visible Plasma purpose teaching');
assert(chain.includes('TESLA — BRIDGE DISTANT ORBS'), 'Chain lacks visible Tesla purpose teaching');
assert(chain.includes('CRYO — PULL ORBS INTO A CLUSTER'), 'Chain lacks visible Cryo purpose teaching');
assert(registry.includes('Spend three tactical detonations to engineer the biggest cascade.'), 'Chain registry still undersells the three-charge tactical loop');
assert(!registry.includes('Tap anywhere once to spawn the initial detonation.'), 'stale one-tap Chain instruction remains');

for (const term of ['Multiball', 'Laser', 'Wide Paddle', 'Fireball']) {
  assert(registry.includes(term), `Breakout first-run copy does not expose ${term}`);
}
assert(registry.includes('limited ink budget'), 'One Line copy does not explain its ink constraint');
assert(registry.includes('stars are optional bonus targets'), 'One Line copy does not explain optional star mastery');
assert(oneline.includes('RELEASE TO RUN PHYSICS'), 'One Line in-game hint does not explain the draw/release state transition');

assert(registry.includes('firewall phrases appear every four growth steps'), 'Cyber Serpent registry does not explain firewall progression');
assert(!registry.includes('dodge the lethal laser perimeter'), 'Cyber Serpent still advertises a nonexistent lethal perimeter');

if (errors.length) {
  console.error('P4 EXPERIENTIAL GAMEPLAY QUALITY AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P4 EXPERIENTIAL GAMEPLAY QUALITY AUDIT — PASS');
console.log('Snake firewall mastery, Orbit control teaching, Chain tactical teaching, Breakout powerup clarity, and One Line draw/physics clarity are certified.');
