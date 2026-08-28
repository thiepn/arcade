import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/games/AirHockeyGame.tsx';
let source = readFileSync(path, 'utf8');

const replaceOnce = (search, replacement, label) => {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`Expected one ${label} match, found ${count}`);
  source = source.replace(search, replacement);
};

replaceOnce(
  `        const aiHomeY = tableTop + 55;`,
  `        const aiHomeY = tableTop + 55 * table.motionScale;`,
  'AI home depth scaling',
);

replaceOnce(
  `            aiTargetX = state.puck.x > tableCenterX ? aiMinX + 25 : aiMaxX - 25;
            aiTargetY = Math.max(aiMinY, state.puck.y - 10);`,
  `            aiTargetX = state.puck.x > tableCenterX
              ? aiMinX + 25 * table.motionScale
              : aiMaxX - 25 * table.motionScale;
            aiTargetY = Math.max(aiMinY, state.puck.y - 10 * table.motionScale);`,
  'AI challenge offsets',
);

replaceOnce(
  `          aiTargetX = tableCenterX + guardFactor * 50;`,
  `          aiTargetX = tableCenterX + guardFactor * 50 * table.motionScale;`,
  'AI guard scaling',
);

replaceOnce(
  `      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1 bg-zinc-900/90 border border-zinc-800 rounded-2xl backdrop-blur-md z-20 pointer-events-auto shadow-2xl">`,
  `      <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 flex max-w-[calc(100%-12px)] items-center gap-1 sm:gap-1.5 p-1 bg-zinc-900/90 border border-zinc-800 rounded-2xl backdrop-blur-md z-20 pointer-events-auto shadow-2xl">`,
  'difficulty deck width',
);

replaceOnce(
  `              className={\`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer \${`,
  `              className={\`min-w-0 px-2 sm:px-3 py-1.5 rounded-xl font-mono text-[10px] sm:text-xs font-bold transition-all cursor-pointer \${`,
  'difficulty button compact sizing',
);

replaceOnce(
  `              <span className="ml-1 text-[10px] opacity-75">{cfg.multiplierBadge}</span>`,
  `              <span className="ml-1 hidden text-[10px] opacity-75 sm:inline">{cfg.multiplierBadge}</span>`,
  'mobile multiplier badge visibility',
);

writeFileSync(path, source);
console.log('Applied final Neon Puck Smash AI scaling and compact mobile difficulty controls.');
