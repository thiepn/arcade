import { readFileSync } from 'node:fs';
import {
  BLOCK_DROP_DESKTOP_CELL_MAX,
  getBlockDropLayout,
  resolveBlockDropHold,
} from '../src/lib/blockDropSupport';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

for (const [width, height] of [
  [320, 480],
  [360, 640],
  [390, 844],
  [768, 660],
  [900, 660],
  [1440, 900],
] as const) {
  const layout = getBlockDropLayout(width, height);
  assert(layout.boardX >= 0, `${width}x${height}: board escapes left edge`);
  assert(layout.boardY >= 0, `${width}x${height}: board escapes top edge`);
  assert(layout.boardX + layout.boardW <= width, `${width}x${height}: board escapes right edge`);
  assert(layout.boardY + layout.boardH <= height, `${width}x${height}: board escapes bottom edge`);
  assert(layout.holdX >= 0, `${width}x${height}: hold preview escapes left edge`);
  assert(layout.nextX + layout.previewSize <= width, `${width}x${height}: next preview escapes right edge`);
  assert(layout.cellSize >= 16, `${width}x${height}: cells became unreadably small`);
}

const desktop = getBlockDropLayout(900, 660);
assert(desktop.cellSize >= 28, '900x660 desktop board is not materially larger than the old 22px cells');
assert(desktop.cellSize <= BLOCK_DROP_DESKTOP_CELL_MAX, 'desktop cell cap is ignored');
assert(desktop.boardW >= 280 && desktop.boardH >= 560, 'desktop board is still prototype-sized');

let draws = 0;
const firstHold = resolveBlockDropHold(
  { current: 'T', next: 'I', hold: null, canHold: true },
  () => {
    draws++;
    return 'O';
  },
);
assert(firstHold.changed, 'first hold should change state');
assert(firstHold.current === 'I', 'first hold should promote the next piece');
assert(firstHold.next === 'O', 'first hold should draw a replacement next piece');
assert(firstHold.hold === 'T', 'first hold should store the outgoing piece');
assert(!firstHold.canHold, 'hold must lock until the current piece is placed');
assert(draws === 1, 'first hold should consume exactly one next-piece draw');

const blockedHold = resolveBlockDropHold(firstHold, () => 'Z');
assert(!blockedHold.changed, 'second hold before lock must be rejected');
assert(blockedHold.current === 'I' && blockedHold.hold === 'T', 'blocked hold mutated pieces');

const swapHold = resolveBlockDropHold(
  { current: 'L', next: 'S', hold: 'J', canHold: true },
  () => 'Z',
);
assert(swapHold.changed, 'swap hold should change state');
assert(swapHold.current === 'J', 'swap hold should restore the held piece');
assert(swapHold.hold === 'L', 'swap hold should store the outgoing active piece');
assert(swapHold.next === 'S', 'swap hold must not consume the next queue');
assert(!swapHold.canHold, 'swap hold must lock until placement');

const source = readFileSync('src/games/BlockDropGame.tsx', 'utf8');
for (const token of [
  'getBlockDropLayout',
  'resolveBlockDropHold',
  'holdPieceType',
  'canHold',
  'const holdPiece = () =>',
  "e.code === 'KeyC'",
  "e.code === 'ShiftLeft'",
  "e.code === 'ShiftRight'",
  "        'HOLD',",
  "        'NEXT',",
  'aria-label="Hold or swap piece"',
  'C / SHIFT',
]) {
  assert(source.includes(token), `BlockDropGame is missing hold/layout token: ${token}`);
}

assert(!source.includes('const BLOCK_SIZE = 22'), 'fixed 22px board size returned');
assert(source.includes('state.canHold = true'), 'hold availability is not restored after placement');
assert(source.includes('min-h-0'), 'Block Drop root is not shrink-safe');

const registry = readFileSync('src/data/games.ts', 'utf8');
assert(registry.includes('C/Shift to Hold'), 'registry instructions omit hold controls');
assert(registry.includes('C / Shift: Hold'), 'registry control hint omits hold binding');

if (errors.length) {
  console.error('Cyber Block Drop audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  'Cyber Block Drop audit passed: responsive large desktop layout, side-by-side Hold/Next previews, one-hold-per-piece semantics, swap behavior, and keyboard/mobile hold controls are certified.',
);
