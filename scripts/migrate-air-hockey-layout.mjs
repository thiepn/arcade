import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/games/AirHockeyGame.tsx';
let source = readFileSync(path, 'utf8');

const replaceOnce = (search, replacement, label) => {
  const count = typeof search === 'string'
    ? source.split(search).length - 1
    : [...source.matchAll(new RegExp(search.source, search.flags.includes('g') ? search.flags : `${search.flags}g`))].length;
  if (count !== 1) throw new Error(`Expected one ${label} match, found ${count}`);
  source = source.replace(search, replacement);
};

replaceOnce(
  "import { clamp, rescalePoint, rescaleTrail, rescaleVelocity } from '../lib/gameCoordinates';",
  `import { clamp } from '../lib/gameCoordinates';
import { getAirHockeyTableLayout } from '../lib/airHockeyLayout';`,
  'layout import',
);

replaceOnce(
  `  const handlePointerMove = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    gameStateRef.current.targetPlayerX = mx;
    gameStateRef.current.targetPlayerY = my;
  };`,
  `  const updatePointerTarget = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    gameStateRef.current.targetPlayerX = e.clientX - rect.left;
    gameStateRef.current.targetPlayerY = e.clientY - rect.top;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    updatePointerTarget(e);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updatePointerTarget(e);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
  };`,
  'pointer controls',
);

replaceOnce(
  `      const state = gameStateRef.current;
      const speed = 25 * clamp(state.viewportWidth / 400, 0.85, 1.8);
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') state.targetPlayerX -= speed;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') state.targetPlayerX += speed;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') state.targetPlayerY -= speed;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') state.targetPlayerY += speed;`,
  `      const state = gameStateRef.current;
      const speed = 25 * getAirHockeyTableLayout(
        state.viewportWidth,
        state.viewportHeight,
      ).motionScale;
      if (
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'KeyA' ||
        e.code === 'KeyD' ||
        e.code === 'KeyW' ||
        e.code === 'KeyS'
      ) {
        e.preventDefault();
      }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') state.targetPlayerX -= speed;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') state.targetPlayerX += speed;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') state.targetPlayerY -= speed;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') state.targetPlayerY += speed;`,
  'keyboard scaling',
);

replaceOnce(
  /    onResize: \(w, h\) => \{[\s\S]*?      state\.targetPlayerY = clamp\(state\.targetPlayerY, h \/ 2 \+ state\.playerMallet\.radius, h - state\.playerMallet\.radius - 16\);\n    \},/,
  `    onResize: (w, h) => {
      const state = gameStateRef.current;
      const oldTable = getAirHockeyTableLayout(
        state.viewportWidth,
        state.viewportHeight,
      );
      const newTable = getAirHockeyTableLayout(w, h);
      const scaleX = newTable.width / Math.max(1, oldTable.width);
      const scaleY = newTable.height / Math.max(1, oldTable.height);
      const uniformScale = Math.min(scaleX, scaleY);

      const remapPoint = (point: { x: number; y: number }) => {
        point.x = newTable.left + (point.x - oldTable.left) * scaleX;
        point.y = newTable.top + (point.y - oldTable.top) * scaleY;
      };
      const remapVelocity = (velocity: { vx: number; vy: number }) => {
        velocity.vx *= scaleX;
        velocity.vy *= scaleY;
      };

      remapPoint(state.puck);
      remapVelocity(state.puck);
      state.puck.radius = clamp(state.puck.radius * uniformScale, 10, 18);

      for (const mallet of [state.playerMallet, state.aiMallet]) {
        remapPoint(mallet);
        remapVelocity(mallet);
        mallet.radius = clamp(mallet.radius * uniformScale, 20, 32);
      }

      const target = { x: state.targetPlayerX, y: state.targetPlayerY };
      remapPoint(target);
      state.targetPlayerX = target.x;
      state.targetPlayerY = target.y;

      for (const trail of state.puckTrail) remapPoint(trail);
      for (const particle of state.particles) {
        remapPoint(particle);
        remapVelocity(particle);
        particle.size *= uniformScale;
      }
      for (const popup of state.popups) remapPoint(popup);

      state.goalWidth = newTable.goalWidth;
      state.viewportWidth = w;
      state.viewportHeight = h;

      state.puck.x = clamp(
        state.puck.x,
        newTable.left + state.puck.radius,
        newTable.right - state.puck.radius,
      );
      state.puck.y = clamp(
        state.puck.y,
        newTable.top + state.puck.radius,
        newTable.bottom - state.puck.radius,
      );
      state.playerMallet.x = clamp(
        state.playerMallet.x,
        newTable.left + state.playerMallet.radius,
        newTable.right - state.playerMallet.radius,
      );
      state.playerMallet.y = clamp(
        state.playerMallet.y,
        newTable.centerY + state.playerMallet.radius + 4,
        newTable.bottom - state.playerMallet.radius,
      );
      state.aiMallet.x = clamp(
        state.aiMallet.x,
        newTable.left + state.aiMallet.radius,
        newTable.right - state.aiMallet.radius,
      );
      state.aiMallet.y = clamp(
        state.aiMallet.y,
        newTable.top + state.aiMallet.radius,
        newTable.centerY - state.aiMallet.radius - 4,
      );
      state.targetPlayerX = clamp(
        state.targetPlayerX,
        newTable.left + state.playerMallet.radius,
        newTable.right - state.playerMallet.radius,
      );
      state.targetPlayerY = clamp(
        state.targetPlayerY,
        newTable.centerY + state.playerMallet.radius + 4,
        newTable.bottom - state.playerMallet.radius,
      );
    },`,
  'responsive table resize',
);

replaceOnce(
  `      const tableMarginX = 16;
      const tableMarginY = 16;
      const tableW = w - tableMarginX * 2;
      const tableH = h - tableMarginY * 2;
      const tableLeft = tableMarginX;
      const tableRight = tableLeft + tableW;
      const tableTop = tableMarginY;
      const tableBottom = tableTop + tableH;
      const centerY = tableTop + tableH / 2;
      const centerX = tableLeft + tableW / 2;`,
  `      const table = getAirHockeyTableLayout(w, h);
      const tableW = table.width;
      const tableH = table.height;
      const tableLeft = table.left;
      const tableRight = table.right;
      const tableTop = table.top;
      const tableBottom = table.bottom;
      const centerY = table.centerY;
      const centerX = table.centerX;
      state.goalWidth = table.goalWidth;`,
  'controlled table geometry',
);

replaceOnce(
  `        state.puck.y = toPlayer ? centerY + 60 : centerY - 60;
        state.puck.vx = (Math.random() - 0.5) * 60;
        state.puck.vy = toPlayer ? 80 : -80;`,
  `        state.puck.y = toPlayer
          ? centerY + 60 * table.motionScale
          : centerY - 60 * table.motionScale;
        state.puck.vx = (Math.random() - 0.5) * 60 * table.motionScale;
        state.puck.vy = (toPlayer ? 80 : -80) * table.motionScale;`,
  'scaled reset motion',
);

replaceOnce(
  `        const aiSpeed = diffConfig.aiSpeed;`,
  `        const aiSpeed = diffConfig.aiSpeed * table.motionScale;`,
  'scaled AI speed',
);

replaceOnce(
  `        puck.vx *= 0.993;
        puck.vy *= 0.993;`,
  `        const drag = Math.pow(0.993, dt * 60);
        puck.vx *= drag;
        puck.vy *= drag;`,
  'frame normalized drag',
);

replaceOnce(
  `        const maxSpeed = 680;`,
  `        const maxSpeed = 680 * table.motionScale;`,
  'scaled puck cap',
);

replaceOnce(
  `      onPointerMove={handlePointerMove}
      className="relative w-full h-full min-h-[440px] flex flex-col items-center justify-center bg-[#050508] select-none overflow-hidden touch-none"`,
  `      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerCancel={handlePointerCancel}
      className="relative w-full h-full min-h-0 flex flex-col items-center justify-center bg-[#050508] select-none overflow-hidden touch-none"`,
  'pointer capture and shrink-safe root',
);

writeFileSync(path, source);
console.log('Applied controlled Neon Puck Smash arena proportions, table-relative resizing, responsive motion, pointer capture, and refresh-rate-normalized puck drag.');
