import { readFileSync } from 'node:fs';
import {
  TYPE_RUSH_WORD_RENDER_HZ,
  TYPE_RUSH_WORD_RENDER_INTERVAL_MS,
  TYPE_RUSH_WPM_RENDER_INTERVAL_MS,
  shouldSyncTypeRushUi,
} from '../src/lib/typeRushRuntime';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

const source = readFileSync('src/games/TypeRushGame.tsx', 'utf8');

assert(!source.includes('handleKeyInput(w.word[w.typedIndex])'), 'clicking a falling word can still auto-enter its next correct character');
assert(source.includes('pointer-events-none') && source.includes('cursor-default'), 'falling word cards are still interactive click targets');
assert(source.includes('onClick={focusDeviceKeyboard}'), 'arena click no longer focuses the device keyboard');
assert(source.includes('handleKeyInput(char);'), 'native/mobile input no longer routes through the typing validator');
assert(source.includes("window.addEventListener('keydown', handleWindowKeyDown)"), 'physical keyboard listener is missing');
assert(source.includes('TYPE_RUSH_WORD_RENDER_INTERVAL_MS'), 'bounded falling-word render cadence is not wired into Type Rush');
assert(source.includes('TYPE_RUSH_WPM_RENDER_INTERVAL_MS'), 'bounded WPM render cadence is not wired into Type Rush');
assert(source.includes('lastWordRenderSync = currentTime'), 'falling-word render sync timestamp is not advanced');
assert(source.includes('lastWpmRenderSync = currentTime'), 'WPM render sync timestamp is not advanced');
assert(TYPE_RUSH_WORD_RENDER_HZ === 30, `expected 30 Hz word rendering, found ${TYPE_RUSH_WORD_RENDER_HZ}`);
assert(TYPE_RUSH_WPM_RENDER_INTERVAL_MS === 250, 'WPM display should update at 4 Hz');

const countSyncs = (fps: number, intervalMs: number, seconds = 10) => {
  const frameMs = 1000 / fps;
  let last = 0;
  let count = 0;
  for (let now = frameMs; now <= seconds * 1000 + 0.001; now += frameMs) {
    if (shouldSyncTypeRushUi(now, last, intervalMs)) {
      count++;
      last = now;
    }
  }
  return count;
};

for (const fps of [30, 60, 120, 144, 240]) {
  const wordSyncs = countSyncs(fps, TYPE_RUSH_WORD_RENDER_INTERVAL_MS);
  const wordHz = wordSyncs / 10;
  assert(wordHz <= 30.1, `${fps} FPS causes ${wordHz.toFixed(1)} React word renders/sec`);
  assert(wordHz >= 24, `${fps} FPS starves falling-word rendering at ${wordHz.toFixed(1)} renders/sec`);

  const wpmSyncs = countSyncs(fps, TYPE_RUSH_WPM_RENDER_INTERVAL_MS);
  assert(wpmSyncs <= 40, `${fps} FPS causes more than 4 WPM renders/sec`);
}

const renderSetWordsOccurrences = source.match(/setWords\(\[\.\.\.state\.words\]\)/g)?.length ?? 0;
assert(renderSetWordsOccurrences <= 2, `unexpected high-frequency setWords call sites: ${renderSetWordsOccurrences}`);

if (errors.length) {
  console.error('TYPE RUSH INPUT / PERFORMANCE AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('TYPE RUSH INPUT / PERFORMANCE AUDIT — PASS');
console.log('Word cards cannot auto-type, physical/mobile typing remains active, and React animation sync is refresh-rate bounded.');
