import { readFileSync, writeFileSync } from 'node:fs';

// One-shot branch migration; removed after the generated game patch is committed.
function replaceOnce(path, search, replacement, label) {
  const source = readFileSync(path, 'utf8');
  let count = 0;
  if (typeof search === 'string') {
    count = source.split(search).length - 1;
  } else {
    const flags = search.flags.includes('g') ? search.flags : `${search.flags}g`;
    count = [...source.matchAll(new RegExp(search.source, flags))].length;
  }
  if (count !== 1) {
    throw new Error(`${path}: expected one ${label} match, found ${count}`);
  }
  writeFileSync(path, source.replace(search, replacement));
}

const path = 'src/games/PacMazeGame.tsx';

replaceOnce(
  path,
  "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';",
  `import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';
import {
  advancePacMover,
  getPacDirectionForCode,
  queuePacDirection,
  shouldCapturePacKey,
} from '../lib/pacMazeControls';`,
  'Pac control helper import',
);

replaceOnce(
  path,
  /  \/\/ Keyboard controls\n  useEffect\(\(\) => \{[\s\S]*?\n  \}, \[\]\);\n\n  \/\/ Swipe \/ Touch Controls/,
  `  // Capture desktop controls before browser scrolling or shell-level handlers.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const direction = getPacDirectionForCode(event.code);
      if (!direction || !shouldCapturePacKey(event)) return;

      event.preventDefault();
      const state = gameStateRef.current;
      if (!state.isAlive || isPausedRef.current) return;
      queuePacDirection(state, direction.x, direction.y);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Swipe / Touch Controls`,
  'captured desktop keyboard controls',
);

replaceOnce(
  path,
  `      const state = gameStateRef.current;
      if (Math.abs(dx) > Math.abs(dy)) {
        state.nextDirX = dx > 0 ? 1 : -1;
        state.nextDirY = 0;
      } else {
        state.nextDirX = 0;
        state.nextDirY = dy > 0 ? 1 : -1;
      }
      touchStartRef.current = { x: e.clientX, y: e.clientY };`,
  `      const state = gameStateRef.current;
      if (Math.abs(dx) > Math.abs(dy)) {
        queuePacDirection(state, dx > 0 ? 1 : -1, 0);
      } else {
        queuePacDirection(state, 0, dy > 0 ? 1 : -1);
      }
      touchStartRef.current = { x: e.clientX, y: e.clientY };`,
  'shared swipe direction queue',
);

replaceOnce(
  path,
  /        \/\/ Speed calculation\n[\s\S]*?\n        \/\/ Eat dots & power pellets/,
  `        // Movement is tile-center based rather than threshold based. Inputs are
        // buffered until the next valid intersection, while opposite directions
        // reverse immediately even between tile centers.
        const playerSpeedTilesPerSecond = state.frightenedTimer > 0 ? 5.6 : 5.0;
        advancePacMover(
          state,
          playerSpeedTilesPerSecond * dt,
          isWall,
          COLS,
        );

        // Eat dots & power pellets`,
  'deterministic buffered movement block',
);

console.log(
  'Applied captured desktop input, immediate reversals, and deterministic buffered intersection turns to Cyber Pac-Runner.',
);
