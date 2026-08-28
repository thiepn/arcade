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

const path = 'src/games/LaserRopeGame.tsx';

replaceOnce(
  path,
  "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';",
  `import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';
import {
  drawLaserRopeArenaFrame,
  drawLaserRopeBackground,
  drawLaserRopeBeam,
  drawLaserRopeHub,
  drawLaserRopeOrb,
  drawLaserRopePlayerNode,
  getLaserRopeArenaMetrics,
  getLaserRopeBeamColor,
} from '../lib/laserRopePresentation';`,
  'Phase A presentation import',
);

replaceOnce(
  path,
  `    feverPercent: 0,
    hasShield: false,
  });`,
  `    feverPercent: 0,
    hasShield: false,
    laserMode: 'LOW' as 'LOW' | 'HIGH' | 'DUAL',
    isFeverActive: false,
  });`,
  'Phase A HUD state',
);

replaceOnce(
  path,
  /      \/\/ ==========================================\n      \/\/ LIGHTWEIGHT HIGH-FPS RENDER[\s\S]*?\n      \/\/ Sync HUD/,
  `      // ==========================================
      // PHASE A — NEON ARENA PRESENTATION
      // ==========================================
      const presentationTime = performance.now() / 1000;
      const arenaMetrics = getLaserRopeArenaMetrics(w, h);
      const beamColor = getLaserRopeBeamColor(
        state.laserMode,
        state.isFeverActive,
      );

      drawLaserRopeBackground(
        ctx,
        w,
        h,
        presentationTime,
        state.isFeverActive,
      );

      ctx.save();
      ctx.translate(arenaMetrics.centerX, arenaMetrics.groundY);
      drawLaserRopeArenaFrame(
        ctx,
        arenaMetrics,
        presentationTime,
        state.isFeverActive,
        state.laserMode,
      );

      // Collectibles now read as illuminated arena objects instead of flat dots.
      for (const orb of state.orbs) {
        const floatY = -orb.y + Math.sin(orb.pulse) * 4;
        let color = '#FACC15';
        if (orb.type === 'gem') color = '#38BDF8';
        if (orb.type === 'shield') color = '#A855F7';
        drawLaserRopeOrb(ctx, orb.x, floatY, color, orb.pulse);
      }

      const activeBeams =
        state.beamsCount === 1
          ? [state.sweepAngle]
          : [state.sweepAngle, state.sweepAngle + Math.PI];
      const laserHeightOffset =
        state.laserMode === 'HIGH'
          ? -Math.max(24, arenaMetrics.radiusY * 0.5)
          : 0;

      for (const beamAngle of activeBeams) {
        const endX = Math.cos(beamAngle) * arenaMetrics.beamRadius;
        const endY =
          Math.sin(beamAngle) * arenaMetrics.radiusY * 0.94 +
          laserHeightOffset;
        drawLaserRopeBeam(
          ctx,
          endX,
          endY,
          laserHeightOffset,
          beamColor,
          presentationTime,
          state.isFeverActive ? 1.12 : 1,
        );
      }

      drawLaserRopeHub(
        ctx,
        presentationTime,
        beamColor,
        state.isFeverActive,
      );

      if (state.isAlive) {
        drawLaserRopePlayerNode(ctx, {
          playerY: state.playerY,
          isSliding: state.isSliding,
          isGrounded: state.isGrounded,
          jumpCount: state.jumpCount,
          hasShield: state.hasShield,
          isFeverActive: state.isFeverActive,
          time: presentationTime,
        });
      }

      for (const particle of state.particles) {
        const alpha = Math.max(0, Math.min(1, particle.life / particle.maxLife));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.restore();

      // Existing gameplay messaging remains above the upgraded arena.
      for (const pop of state.popups) {
        const popupAlpha = Math.max(0, Math.min(1, pop.life * 1.4));
        ctx.globalAlpha = popupAlpha;
        ctx.fillStyle = pop.color;
        ctx.shadowColor = pop.color;
        ctx.shadowBlur = 8;
        ctx.font = 'bold 13px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pop.text, pop.x, pop.y);
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Sync HUD`,
  'Phase A render block',
);

replaceOnce(
  path,
  `          prev.feverPercent === feverPercent &&
          prev.hasShield === state.hasShield
        ) {`,
  `          prev.feverPercent === feverPercent &&
          prev.hasShield === state.hasShield &&
          prev.laserMode === state.laserMode &&
          prev.isFeverActive === state.isFeverActive
        ) {`,
  'Phase A HUD comparison',
);

replaceOnce(
  path,
  `          feverPercent,
          hasShield: state.hasShield,
        };`,
  `          feverPercent,
          hasShield: state.hasShield,
          laserMode: state.laserMode,
          isFeverActive: state.isFeverActive,
        };`,
  'Phase A HUD synchronization',
);

replaceOnce(
  path,
  'className="relative w-full h-full min-h-[440px] flex flex-col items-center justify-center bg-[#050508] select-none overflow-hidden touch-none"',
  'className="relative w-full h-full min-h-0 flex flex-col items-center justify-center bg-[#030712] select-none overflow-hidden touch-none"',
  'mobile-safe Phase A root',
);

replaceOnce(
  path,
  /      \{\/\* Top HUD \*\/\}[\s\S]*?\n      <canvas ref=\{canvasRef\} className="w-full h-full block" \/>/,
  `      {/* Phase A HUD — compact command-deck treatment */}
      <div className="absolute top-2 left-2 right-2 z-10 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-1.5 pointer-events-none font-mono-arcade">
        <div className="min-w-0 rounded-xl border border-cyan-400/25 bg-[#07101E]/90 px-2 py-1.5 shadow-lg shadow-cyan-950/30 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[7px] sm:text-[8px] font-black tracking-[0.16em] text-cyan-300/60">SCORE</div>
              <div className="truncate text-sm sm:text-base font-black leading-none text-white tabular-nums">
                {hudState.score.toLocaleString()}
              </div>
            </div>
            <div className="h-7 w-px bg-cyan-300/15" />
            <div className="shrink-0 text-right">
              <div className="text-[7px] sm:text-[8px] font-black tracking-[0.14em] text-rose-300/60">STREAK</div>
              <div className="text-sm sm:text-base font-black leading-none text-rose-300 tabular-nums">
                {hudState.jumpStreak}
              </div>
            </div>
          </div>
        </div>

        <div className={`rounded-xl border px-2 py-1.5 text-center shadow-lg backdrop-blur-md ${
          hudState.isFeverActive
            ? 'border-amber-300/60 bg-amber-400/15 shadow-amber-500/20'
            : hudState.laserMode === 'HIGH'
              ? 'border-purple-400/45 bg-purple-500/10 shadow-purple-500/10'
              : 'border-rose-400/35 bg-[#100B18]/90 shadow-rose-500/10'
        }`}>
          <div className="text-[6px] sm:text-[7px] font-black tracking-[0.16em] text-zinc-400">LASER MODE</div>
          <div className={`text-[10px] sm:text-xs font-black tracking-wide ${
            hudState.isFeverActive
              ? 'text-amber-300'
              : hudState.laserMode === 'HIGH'
                ? 'text-purple-300'
                : 'text-rose-300'
          }`}>
            {hudState.isFeverActive ? 'OVERDRIVE' : hudState.laserMode}
          </div>
          <div className="mt-0.5 flex items-center justify-center gap-1">
            {hudState.multiplier > 1 && (
              <span className="rounded bg-amber-400/15 px-1 text-[7px] font-black text-amber-300">
                {hudState.multiplier}X
              </span>
            )}
            {hudState.hasShield && (
              <span className="rounded bg-purple-400/15 px-1 text-[7px] font-black text-purple-300">
                SHIELD
              </span>
            )}
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-cyan-400/25 bg-[#07101E]/90 px-2 py-1.5 shadow-lg shadow-cyan-950/30 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[7px] sm:text-[8px] font-black tracking-[0.14em] text-zinc-400">SPEED</span>
            <span className="text-[9px] sm:text-[10px] font-black text-cyan-200 tabular-nums">{hudState.rpm} RPM</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="shrink-0 text-[6px] sm:text-[7px] font-black tracking-[0.12em] text-amber-300/70">FEVER</span>
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full border border-zinc-700/80 bg-zinc-900/90">
              <div
                className={`h-full rounded-full transition-[width] duration-150 ${
                  hudState.isFeverActive
                    ? 'bg-amber-300 shadow-[0_0_8px_rgba(250,204,21,0.8)]'
                    : 'bg-gradient-to-r from-cyan-400 via-purple-400 to-rose-400'
                }`}
                style={{ width: `${hudState.feverPercent}%` }}
              />
            </div>
            <span className="shrink-0 text-[7px] font-black text-zinc-300 tabular-nums">{hudState.feverPercent}%</span>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="w-full h-full min-h-0 block touch-none" />`,
  'Phase A HUD markup',
);

console.log(
  'Applied Laser Rope Reflex Phase A: layered background, framed responsive arena, multi-layer beams, energy-node player, glowing collectibles, and command-deck HUD.',
);
