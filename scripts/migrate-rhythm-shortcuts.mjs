import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, search, replacement, label) {
  const source = readFileSync(path, 'utf8');
  const count = source.split(search).length - 1;
  if (count !== 1) {
    throw new Error(`${path}: expected one ${label} match, found ${count}`);
  }
  writeFileSync(path, source.replace(search, replacement));
}

replaceOnce(
  'src/components/GameShell.tsx',
  `      } else if (e.key === 'f' || e.key === 'F') {
        if (e.target instanceof HTMLInputElement) return;
        e.preventDefault();
        toggleFullscreen();
      }`,
  `      } else if (
        e.altKey &&
        e.code === 'Enter' &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          (e.target instanceof HTMLElement && e.target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        toggleFullscreen();
      }`,
  'plain-F fullscreen shortcut',
);

replaceOnce(
  'src/components/GameShell.tsx',
  `            title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen Immersive (F)'}`,
  `            title={isFullscreen ? 'Exit Fullscreen (Alt+Enter)' : 'Fullscreen Immersive (Alt+Enter)'}`,
  'fullscreen button title',
);

replaceOnce(
  'src/components/GameShell.tsx',
  `          <span className="hidden sm:inline">F: Fullscreen • Esc: Pause • R: Restart</span>`,
  `          <span className="hidden sm:inline">Alt+Enter: Fullscreen • Esc: Pause • R: Restart</span>`,
  'fullscreen footer hint',
);

replaceOnce(
  'src/games/RhythmGame.tsx',
  `    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      for (let i = 0; i < 4; i++) {
        if (LANE_KEYS[i].includes(e.code)) {
          setActiveLanes((prev) => {`,
  `    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      for (let i = 0; i < 4; i++) {
        if (LANE_KEYS[i].includes(e.code)) {
          e.preventDefault();
          setActiveLanes((prev) => {`,
  'rhythm keydown browser suppression',
);

replaceOnce(
  'src/games/RhythmGame.tsx',
  `    const handleKeyUp = (e: KeyboardEvent) => {
      for (let i = 0; i < 4; i++) {
        if (LANE_KEYS[i].includes(e.code)) {
          setActiveLanes((prev) => {`,
  `    const handleKeyUp = (e: KeyboardEvent) => {
      for (let i = 0; i < 4; i++) {
        if (LANE_KEYS[i].includes(e.code)) {
          e.preventDefault();
          setActiveLanes((prev) => {`,
  'rhythm keyup browser suppression',
);

console.log('Removed plain-F fullscreen handling and restored dedicated D/F/J/K rhythm input.');
