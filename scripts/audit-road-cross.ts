import { readFileSync } from 'node:fs';
import {
  ROAD_CROSS_HORIZONTAL_PADDING,
  ROAD_CROSS_WORLD_WIDTH,
  canAcceptRoadCrossMove,
  getRoadCrossBoardMetrics,
} from '../src/lib/roadCrossSupport';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

for (const width of [280, 320, 360, 390, 414, 430, 768, 1440]) {
  const metrics = getRoadCrossBoardMetrics(width);
  assert(metrics.scale > 0 && metrics.scale <= 1, `${width}px: invalid board scale ${metrics.scale}`);
  assert(metrics.offsetX >= 0, `${width}px: board begins off-screen`);
  assert(
    metrics.offsetX + metrics.renderedWidth <= width + 0.001,
    `${width}px: board overflows viewport`,
  );
  if (width >= ROAD_CROSS_HORIZONTAL_PADDING * 2 + 1) {
    assert(
      metrics.offsetX >= ROAD_CROSS_HORIZONTAL_PADDING - 0.001 || metrics.scale === 1,
      `${width}px: expected horizontal safety padding`,
    );
  }
}

const desktop = getRoadCrossBoardMetrics(1440);
assert(desktop.scale === 1, 'desktop board should retain the original 414px world width');
assert(desktop.renderedWidth === ROAD_CROSS_WORLD_WIDTH, 'desktop board width changed');

assert(!canAcceptRoadCrossMove(0), 'movement must be locked at hop start');
assert(!canAcceptRoadCrossMove(0.5), 'movement must be locked mid-hop');
assert(!canAcceptRoadCrossMove(0.998), 'movement must remain locked until landing');
assert(canAcceptRoadCrossMove(0.999), 'movement should unlock at landing threshold');
assert(canAcceptRoadCrossMove(1), 'movement should be available when fully landed');

const source = readFileSync('src/games/RoadCrossGame.tsx', 'utf8');
for (const token of [
  'getRoadCrossBoardMetrics',
  'canAcceptRoadCrossMove',
  'if (!canAcceptRoadCrossMove(state.jumpProgress)) return',
  'if (targetCol === state.col && targetRow === state.row) return',
  'const boardMetrics = getRoadCrossBoardMetrics(w)',
  'const boardScale = boardMetrics.scale',
  'const renderOffsetX = boardMetrics.offsetX',
  'ctx.translate(renderOffsetX, 0)',
  'ctx.scale(boardScale, 1)',
  'const tapMetrics = getRoadCrossBoardMetrics(rect.width)',
  'tapMetrics.offsetX +',
  '* tapMetrics.scale',
  'state.jumpProgress > 0.8',
  'state.jumpProgress > 0.6',
  'state.jumpProgress >= 0.95',
  'min-h-0',
]) {
  assert(source.includes(token), `Cyber Crosser source is missing certified token: ${token}`);
}

assert(!source.includes('const offsetX = (w - boardWidth) / 2'), 'fixed-width render centering returned');
assert(!source.includes('min-h-[440px]'), 'fixed minimum-height layout returned');

if (errors.length) {
  console.error('Cyber Crosser responsive/fairness audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  'Cyber Crosser audit passed: the 9-column world fits narrow viewports, movement cannot be spammed during a hop or at blocked edges to reset collision immunity, and road/train/river landing checks remain active.',
);
