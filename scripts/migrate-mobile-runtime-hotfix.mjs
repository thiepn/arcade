import { readFileSync, writeFileSync } from 'node:fs';

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

const shellPath = 'src/components/GameShell.tsx';
replaceOnce(
  shellPath,
  'className={`relative flex-1 w-full flex items-center justify-center overflow-hidden transition-all duration-150 ${',
  'className={`relative flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden transition-all duration-150 ${',
  'shrinkable game stage',
);
replaceOnce(
  shellPath,
  'className={`relative w-full h-full bg-[#0A0A0B] overflow-hidden flex items-center justify-center transition-all ${',
  'className={`relative w-full h-full min-h-0 bg-[#0A0A0B] overflow-hidden flex items-center justify-center transition-all ${',
  'shrinkable game viewport',
);

const driftPath = 'src/games/DriftGame.tsx';
replaceOnce(
  driftPath,
  '  const ROAD_WIDTH = 300;',
  `  const getDriftRoadWidth = (width: number) =>
    Math.max(160, Math.min(360, width - 24));`,
  'responsive road-width helper',
);
replaceOnce(
  driftPath,
  '    spawnTimer: 0,\n  });',
  '    spawnTimer: 0,\n    viewportWidth: 0,\n    viewportHeight: 0,\n  });',
  'Drift viewport state',
);
replaceOnce(
  driftPath,
  /    onResize: \(w, h\) => \{[\s\S]*?\n    \},\n    onUpdate:/,
  `    onResize: (w, h, resize) => {
      const state = gameStateRef.current;
      const roadWidth = getDriftRoadWidth(w);
      const isInitial =
        resize.isInitial || state.viewportWidth <= 0 || state.viewportHeight <= 0;

      if (isInitial) {
        state.carX = w / 2;
        state.carY = h * 0.76;
      } else {
        const scaleX = w / state.viewportWidth;
        const scaleY = h / state.viewportHeight;
        state.carX *= scaleX;
        state.carY = h * 0.76;
        state.carVx *= scaleX;

        for (const segment of state.segments) {
          segment.y *= scaleY;
          if (segment.hazardX !== undefined) segment.hazardX *= scaleX;
          if (segment.nitroX !== undefined) segment.nitroX *= scaleX;
          if (segment.rivalX !== undefined) segment.rivalX *= scaleX;
        }
        for (const light of state.streetlights) light.y *= scaleY;
        for (const mark of state.skidmarks) {
          mark.x1 *= scaleX;
          mark.x2 *= scaleX;
          mark.y1 *= scaleY;
          mark.y2 *= scaleY;
        }
        for (const particle of state.particles) {
          particle.x *= scaleX;
          particle.y *= scaleY;
          particle.vx *= scaleX;
          particle.vy *= scaleY;
        }
        for (const line of state.speedlines) {
          line.x *= scaleX;
          line.y *= scaleY;
          line.len *= scaleY;
          line.speed *= scaleY;
        }
        for (const popup of state.popups) {
          popup.x *= scaleX;
          popup.y *= scaleY;
        }
      }

      state.viewportWidth = w;
      state.viewportHeight = h;
      const minX = w / 2 - roadWidth / 2 + 20;
      const maxX = w / 2 + roadWidth / 2 - 20;
      state.carX = Math.max(minX, Math.min(maxX, state.carX));

      if (
        state.streetlights.length === 0 ||
        Math.abs(resize.scaleY - 1) > 0.3
      ) {
        state.streetlights = [];
        for (let y = -200; y < h + 400; y += 120) {
          state.streetlights.push({ y, side: -1 });
          state.streetlights.push({ y: y + 60, side: 1 });
        }
      }
      if (
        state.speedlines.length === 0 ||
        Math.abs(resize.scaleX - 1) > 0.3 ||
        Math.abs(resize.scaleY - 1) > 0.3
      ) {
        state.speedlines = [];
        for (let i = 0; i < 25; i++) {
          state.speedlines.push({
            x: Math.random() * w,
            y: Math.random() * h,
            len: 20 + Math.random() * 40,
            speed: 8 + Math.random() * 8,
            alpha: 0.2 + Math.random() * 0.4,
          });
        }
      }
    },
    onUpdate:`,
  'responsive Drift resize handler',
);
replaceOnce(
  driftPath,
  '      const roadCenterX = w / 2;',
  '      const roadCenterX = w / 2;\n      const roadWidth = getDriftRoadWidth(w);',
  'per-frame responsive road width',
);

{
  const source = readFileSync(driftPath, 'utf8');
  const remaining = source.split('ROAD_WIDTH').length - 1;
  if (remaining < 1) {
    throw new Error(`${driftPath}: expected road-width usages after helper migration`);
  }
  writeFileSync(driftPath, source.replaceAll('ROAD_WIDTH', 'roadWidth'));
}

replaceOnce(
  driftPath,
  '  const handleSteerStart = (dir: -1 | 1) => {',
  `  const handleSteerStart = (
    event: React.PointerEvent<HTMLButtonElement>,
    dir: -1 | 1,
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);`,
  'pointer-captured steer start',
);
replaceOnce(
  driftPath,
  `  const handleSteerEnd = () => {
    gameStateRef.current.steerInput = 0;`,
  `  const handleSteerEnd = (event?: React.PointerEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    if (
      event &&
      event.currentTarget.hasPointerCapture?.(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    gameStateRef.current.steerInput = 0;`,
  'pointer-safe steer end',
);
replaceOnce(
  driftPath,
  '    <div className="relative w-full h-full min-h-[420px] flex flex-col bg-[#09090B] overflow-hidden select-none">',
  '    <div className="relative w-full h-full min-h-0 flex flex-col bg-[#09090B] overflow-hidden select-none touch-none">',
  'mobile-safe Drift root',
);
replaceOnce(
  driftPath,
  '<div className="absolute top-3 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">',
  '<div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 z-10 pointer-events-none">',
  'compact mobile HUD',
);
replaceOnce(
  driftPath,
  '<canvas ref={canvasRef} className="w-full h-full block" />',
  '<canvas ref={canvasRef} className="w-full h-full min-h-0 block touch-none" />',
  'mobile-safe Drift canvas',
);
replaceOnce(
  driftPath,
  '<div className="absolute bottom-3 left-4 right-4 flex items-center justify-between z-10 pointer-events-auto">',
  '<div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2 z-10 pointer-events-auto">',
  'compact mobile controls',
);
replaceOnce(
  driftPath,
  '            onPointerDown={() => handleSteerStart(-1)}\n            onPointerUp={handleSteerEnd}',
  '            onPointerDown={(event) => handleSteerStart(event, -1)}\n            onPointerUp={handleSteerEnd}\n            onPointerCancel={handleSteerEnd}',
  'left pointer capture',
);
replaceOnce(
  driftPath,
  '            onPointerDown={() => handleSteerStart(1)}\n            onPointerUp={handleSteerEnd}',
  '            onPointerDown={(event) => handleSteerStart(event, 1)}\n            onPointerUp={handleSteerEnd}\n            onPointerCancel={handleSteerEnd}',
  'right pointer capture',
);

{
  const source = readFileSync(driftPath, 'utf8');
  const steerButtonClass = 'w-16 h-14 rounded-xl border font-mono-arcade text-base';
  const count = source.split(steerButtonClass).length - 1;
  if (count !== 2) {
    throw new Error(`${driftPath}: expected two steer button class matches, found ${count}`);
  }
  writeFileSync(
    driftPath,
    source.replaceAll(
      steerButtonClass,
      'w-14 sm:w-16 h-12 sm:h-14 rounded-xl border font-mono-arcade text-[10px] sm:text-base',
    ),
  );
}
replaceOnce(
  driftPath,
  'className={`px-6 py-4 rounded-xl font-mono-arcade text-xs font-bold border transition-all',
  'className={`px-3 sm:px-6 py-3 sm:py-4 rounded-xl font-mono-arcade text-[10px] sm:text-xs font-bold border transition-all',
  'compact mobile Nitro button',
);

const cssPath = 'src/index.css';
{
  const source = readFileSync(cssPath, 'utf8');
  const marker = '/* MOBILE-RUNTIME-HOTFIX */';
  if (source.includes(marker)) {
    throw new Error(`${cssPath}: mobile runtime hotfix already exists`);
  }
  writeFileSync(
    cssPath,
    `${source.trimEnd()}\n\n${marker}\nhtml, body, #root {\n  height: 100%;\n}\n\n.game-shell {\n  height: var(--arcade-viewport-height, 100vh);\n  max-height: var(--arcade-viewport-height, 100vh);\n}\n\n.game-shell main,\n.game-shell main > div {\n  min-height: 0;\n}\n\n.game-shell main > div > .game-canvas-container,\n.game-shell main > div > [class*="min-h-["] {\n  min-height: 0 !important;\n}\n\n.game-shell canvas {\n  display: block;\n  min-width: 0;\n  min-height: 0;\n  max-width: 100%;\n  max-height: 100%;\n  touch-action: none;\n  -webkit-touch-callout: none;\n  -webkit-tap-highlight-color: transparent;\n}\n\n@media (max-width: 639px) {\n  .game-shell header,\n  .game-shell footer {\n    flex-shrink: 0;\n  }\n}\n`,
  );
}

console.log(
  'Applied the shared mobile viewport/canvas hotfix and repaired Cyber Drift layout, road sizing, resizing, and pointer controls.',
);
