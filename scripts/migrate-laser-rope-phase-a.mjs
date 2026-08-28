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
import { LaserRopeHud } from '../components/LaserRopeHud';
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
  'Phase A presentation imports',
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
  `      {/* Phase A HUD */}
      <LaserRopeHud state={hudState} />

      <canvas ref={canvasRef} className="w-full h-full min-h-0 block touch-none" />`,
  'Phase A HUD component',
);

console.log(
  'Applied Laser Rope Reflex Phase A: layered background, framed responsive arena, multi-layer beams, energy-node player, glowing collectibles, and command-deck HUD.',
);
