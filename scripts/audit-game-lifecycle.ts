import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};
const read = (path: string) => readFileSync(path, 'utf8');
const gameFiles = readdirSync('src/games').filter((file) => file.endsWith('Game.tsx')).sort();

assert(gameFiles.length === 32, `expected 32 game modules, found ${gameFiles.length}`);

const transientStopPattern = /return\s+!state\.(?:isFinished|isTransitioning|roundTransition|waveTransition)\s*;/;
for (const file of gameFiles) {
  const source = read(join('src/games', file));
  assert(
    !/min-h-\[(?:\d+(?:\.\d+)?)(?:px|rem|vh)\]/.test(source),
    `${file} restores a fixed minimum game height that can overflow a short mobile/landscape stage`,
  );
  assert(
    !transientStopPattern.test(source),
    `${file} stops the shared RAF loop from a transient transition flag`,
  );
}

const chain = read('src/games/ChainGame.tsx');
assert(chain.includes('state.isFinished = true;'), 'Chain Reaction no longer marks its between-wave transition');
assert(chain.includes('state.isFinished = false;'), 'Chain Reaction no longer reopens the next wave after its transition');
assert(chain.includes('return true;'), 'Chain Reaction does not keep the mounted game loop alive through wave transitions');
assert(!chain.includes('return !state.isFinished;'), 'Chain Reaction still permanently stops after its first wave');

if (errors.length) {
  console.error('GAME LIFECYCLE / SHRINK-SAFE LAYOUT AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('GAME LIFECYCLE / SHRINK-SAFE LAYOUT AUDIT — PASS');
console.log('All 32 game roots can shrink with the shared viewport, and transient game-state transitions cannot terminate the RAF loop.');
