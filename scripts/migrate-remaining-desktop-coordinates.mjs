import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/games/StackGame.tsx';
const source = readFileSync(path, 'utf8');
const search = 'const rewardWidthCap = Math.min(320, state.viewportWidth * 0.45);';
const replacement = 'const rewardWidthCap = Math.min(320, Math.max(220, state.viewportWidth * 0.45));';

if (source.split(search).length - 1 !== 1) {
  throw new Error('StackGame.tsx: expected one responsive reward-width cap');
}

writeFileSync(path, source.replace(search, replacement));
console.log('Preserved the original Stack perfect-streak width reward on mobile.');
