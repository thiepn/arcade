import { readFileSync } from 'node:fs';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

const shell = readFileSync('src/components/GameShell.tsx', 'utf8');
const rhythm = readFileSync('src/games/RhythmGame.tsx', 'utf8');

assert(
  !/e\.key\s*===\s*['"]f['"]/i.test(shell),
  'GameShell still reserves plain F through KeyboardEvent.key',
);
assert(
  !/e\.code\s*===\s*['"]KeyF['"]/.test(shell),
  'GameShell still reserves plain F through KeyboardEvent.code',
);
assert(!shell.includes('F: Fullscreen'), 'footer still advertises plain F for fullscreen');
assert(!shell.includes('Fullscreen Immersive (F)'), 'fullscreen button still advertises plain F');
assert(!shell.includes('Exit Fullscreen (F)'), 'fullscreen exit button still advertises plain F');

assert(
  shell.includes("e.altKey &&") && shell.includes("e.code === 'Enter'"),
  'fullscreen keyboard access was not moved to Alt+Enter',
);
assert(
  shell.includes('Alt+Enter: Fullscreen'),
  'game-shell footer does not document the replacement fullscreen shortcut',
);
assert(
  shell.includes('Fullscreen Immersive (Alt+Enter)') &&
    shell.includes('Exit Fullscreen (Alt+Enter)'),
  'fullscreen button titles do not document Alt+Enter',
);

for (const key of ['KeyD', 'KeyF', 'KeyJ', 'KeyK']) {
  assert(rhythm.includes(`'${key}'`), `Neon Rhythm Tapper is missing lane binding ${key}`);
}

const keyboardHandler = rhythm.match(
  /const handleKeyDown = \(e: KeyboardEvent\) => \{[\s\S]*?window\.addEventListener\('keydown'/,
)?.[0] ?? '';
assert(
  keyboardHandler.includes('e.preventDefault()'),
  'Neon Rhythm Tapper does not suppress browser behavior for active lane keys',
);

if (errors.length) {
  console.error('Rhythm shortcut audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  'Rhythm shortcut audit passed: D/F/J/K remain game-owned and fullscreen uses Alt+Enter or the toolbar button.',
);
