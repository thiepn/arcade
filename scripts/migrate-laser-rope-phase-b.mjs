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
  "} from '../lib/laserRopePresentation';",
  `} from '../lib/laserRopePresentation';
import {
  drawLaserRopeFeedbackBanner,
  drawLaserRopeFeedbackBursts,
  drawLaserRopeScreenFlash,
  drawLaserRopeSpawnTelegraph,
  drawLaserRopeSweepTelegraph,
  getLaserRopeApproachIntensity,
  isLaserRopeNearMiss,
  type LaserRopeFeedbackBanner,
  type LaserRopeFeedbackBurst,
} from '../lib/laserRopeFeedback';`,
  'Phase B feedback imports',
);

replaceOnce(
  path,
  `    popups: [] as { id: number; x: number; y: number; text: string; color: string; life: number }[],
    nextId: 1,
  });`,
  `    popups: [] as { id: number; x: number; y: number; text: string; color: string; life: number }[],
    feedbackBursts: [] as LaserRopeFeedbackBurst[],
    feedbackBanner: null as LaserRopeFeedbackBanner | null,
    screenShake: 0,
    screenFlashAlpha: 0,
    screenFlashColor: '#FFFFFF',
    pendingLaserMode: null as null | 'LOW' | 'HIGH' | 'DUAL',
    pendingBeamsCount: 1,
    telegraphTimer: 0,
    telegraphDuration: 0.9,
    deathPresentationTimer: 0,
    nextId: 1,
  });`,
  'Phase B feedback state',
);

replaceOnce(
  path,
  /        \/\/ Mode change \(Low jump vs High slide vs Dual\)[\s\S]*?\n        const effectiveSpeed =/,
  `        // Mode changes are announced before activation so every new beam pattern is readable.
        if (state.pendingLaserMode) {
          state.telegraphTimer -= dt;
          if (state.telegraphTimer <= 0) {
            state.laserMode = state.pendingLaserMode;
            state.beamsCount = state.pendingBeamsCount;
            state.feedbackBanner = {
              title: state.laserMode === 'HIGH' ? 'HIGH BEAM ACTIVE' : state.laserMode === 'DUAL' ? 'DUAL SWEEP ACTIVE' : 'LOW SWEEP ACTIVE',
              detail: state.laserMode === 'HIGH' ? 'SLIDE / DUCK' : 'JUMP THE SWEEP',
              color: state.laserMode === 'HIGH' ? '#C084FC' : '#F43F5E',
              life: 0.52,
              maxLife: 0.52,
            };
            state.pendingLaserMode = null;
            state.telegraphTimer = 0;
          }
        } else {
          state.modeChangeTimer -= dt;
          if (state.modeChangeTimer <= 0) {
            state.modeChangeTimer = Math.random() * 4.5 + 4.0;
            let nextMode: 'LOW' | 'HIGH' | 'DUAL' = 'LOW';
            let nextBeamsCount = 1;
            if (state.jumpStreak > 6 && Math.random() < 0.4) {
              nextMode = 'HIGH';
            } else if (state.jumpStreak >= 12 && Math.random() < 0.35) {
              nextMode = 'DUAL';
              nextBeamsCount = 2;
            }

            state.pendingLaserMode = nextMode;
            state.pendingBeamsCount = nextBeamsCount;
            state.telegraphTimer = state.telegraphDuration;
            state.feedbackBanner = {
              title: nextMode === 'HIGH' ? 'INCOMING HIGH BEAM' : nextMode === 'DUAL' ? 'INCOMING DUAL SWEEP' : 'INCOMING LOW SWEEP',
              detail: nextMode === 'HIGH' ? 'PREPARE TO SLIDE' : 'PREPARE TO JUMP',
              color: nextMode === 'HIGH' ? '#C084FC' : '#FB7185',
              life: state.telegraphDuration,
              maxLife: state.telegraphDuration,
            };
          }
        }

        const effectiveSpeed =`,
  'staged laser mode telegraph',
);

replaceOnce(
  path,
  `            if (evaded) {
              // Successfully cleared laser!
              state.jumpStreak++;`,
  `            if (evaded) {
              const nearMiss = isLaserRopeNearMiss(
                state.laserMode,
                state.playerY,
                state.isSliding,
                state.slideTimer,
              );
              const previousMultiplier = state.multiplier;

              // Successfully cleared laser!
              state.jumpStreak++;`,
  'near-miss classification',
);

replaceOnce(
  path,
  `              state.score += earnedPts;
              onScoreUpdate(state.score);
              if (soundEnabled) sounds.playScore();

              state.popups.push({`,
  `              state.score += earnedPts;
              onScoreUpdate(state.score);
              if (soundEnabled) sounds.playScore();

              const comboAdvanced = state.multiplier > previousMultiplier;
              const successColor = nearMiss ? '#67E8F9' : '#34D399';
              state.feedbackBursts.push({
                id: state.nextId++,
                x: 0,
                y: -state.playerY + 10,
                color: successColor,
                life: nearMiss ? 0.46 : 0.34,
                maxLife: nearMiss ? 0.46 : 0.34,
                strength: nearMiss ? 1.05 : 0.78,
                kind: nearMiss ? 'near-miss' : 'success',
              });
              state.screenShake = Math.max(state.screenShake, nearMiss ? 4.2 : 2.3);

              if (nearMiss) {
                state.feedbackBanner = {
                  title: 'NEAR MISS',
                  detail: '+' + earnedPts + '  •  STREAK ' + state.jumpStreak,
                  color: '#67E8F9',
                  life: 0.68,
                  maxLife: 0.68,
                };
                if (soundEnabled) sounds.playWhoosh();
              } else if (comboAdvanced) {
                state.feedbackBanner = {
                  title: 'COMBO x' + state.multiplier,
                  detail: 'STREAK ' + state.jumpStreak + '  •  +' + earnedPts,
                  color: '#FACC15',
                  life: 0.82,
                  maxLife: 0.82,
                };
                state.screenFlashColor = '#FACC15';
                state.screenFlashAlpha = Math.max(state.screenFlashAlpha, 0.09);
              } else {
                state.feedbackBanner = {
                  title: evasionText,
                  detail: '+' + earnedPts + '  •  STREAK ' + state.jumpStreak,
                  color: '#34D399',
                  life: 0.48,
                  maxLife: 0.48,
                };
              }

              state.popups.push({`,
  'score and combo feedback',
);

replaceOnce(
  path,
  `              if (state.hasShield) {
                state.hasShield = false;
                if (soundEnabled) sounds.playShockwave();
                state.popups.push({`,
  `              if (state.hasShield) {
                state.hasShield = false;
                state.screenShake = Math.max(state.screenShake, 8);
                state.screenFlashColor = '#A855F7';
                state.screenFlashAlpha = Math.max(state.screenFlashAlpha, 0.17);
                state.feedbackBursts.push({
                  id: state.nextId++,
                  x: 0,
                  y: -state.playerY + 10,
                  color: '#C084FC',
                  life: 0.52,
                  maxLife: 0.52,
                  strength: 1.2,
                  kind: 'shield',
                });
                state.feedbackBanner = {
                  title: 'SHIELD DEFLECT',
                  detail: 'IMPACT ABSORBED',
                  color: '#C084FC',
                  life: 0.78,
                  maxLife: 0.78,
                };
                if (soundEnabled) sounds.playShockwave();
                state.popups.push({`,
  'shield collision feedback',
);

replaceOnce(
  path,
  `              } else {
                state.isAlive = false;
                if (soundEnabled) sounds.playExplosion();`,
  `              } else {
                state.isAlive = false;
                state.deathPresentationTimer = 0.45;
                state.screenShake = Math.max(state.screenShake, 18);
                state.screenFlashColor = '#EF4444';
                state.screenFlashAlpha = Math.max(state.screenFlashAlpha, 0.38);
                state.feedbackBursts.push({
                  id: state.nextId++,
                  x: 0,
                  y: -state.playerY + 10,
                  color: '#EF4444',
                  life: 0.52,
                  maxLife: 0.52,
                  strength: 1.65,
                  kind: 'collision',
                });
                state.feedbackBanner = {
                  title: 'LASER HIT',
                  detail: 'RUN ENDED',
                  color: '#FB7185',
                  life: 0.62,
                  maxLife: 0.62,
                };
                if (soundEnabled) sounds.playExplosion();`,
  'fatal collision feedback',
);

replaceOnce(
  path,
  `        for (let i = state.popups.length - 1; i >= 0; i--) {
          const pop = state.popups[i];
          pop.y -= 30 * dt;
          pop.life -= dt;
          if (pop.life <= 0) state.popups.splice(i, 1);
        }
      }

      // ==========================================`,
  `        for (let i = state.popups.length - 1; i >= 0; i--) {
          const pop = state.popups[i];
          pop.y -= 30 * dt;
          pop.life -= dt;
          if (pop.life <= 0) state.popups.splice(i, 1);
        }
      }

      // Presentation feedback continues briefly after a fatal collision so the hit reads visually.
      if (!isPausedRef.current) {
        state.screenShake = Math.max(0, state.screenShake - 34 * dt);
        state.screenFlashAlpha = Math.max(0, state.screenFlashAlpha - 1.7 * dt);
        if (state.feedbackBanner) {
          state.feedbackBanner.life -= dt;
          if (state.feedbackBanner.life <= 0) state.feedbackBanner = null;
        }
        for (let index = state.feedbackBursts.length - 1; index >= 0; index--) {
          state.feedbackBursts[index].life -= dt;
          if (state.feedbackBursts[index].life <= 0) state.feedbackBursts.splice(index, 1);
        }
        if (!state.isAlive && state.deathPresentationTimer > 0) {
          state.deathPresentationTimer = Math.max(0, state.deathPresentationTimer - dt);
        }
      }

      // ==========================================`,
  'Phase B feedback lifecycle',
);

replaceOnce(
  path,
  `      ctx.save();
      ctx.translate(arenaMetrics.centerX, arenaMetrics.groundY);`,
  `      ctx.save();
      const shakeX = state.screenShake > 0 ? (Math.random() - 0.5) * state.screenShake : 0;
      const shakeY = state.screenShake > 0 ? (Math.random() - 0.5) * state.screenShake * 0.65 : 0;
      ctx.translate(arenaMetrics.centerX + shakeX, arenaMetrics.groundY + shakeY);`,
  'screen-shake arena transform',
);

replaceOnce(
  path,
  `      const activeBeams =
        state.beamsCount === 1
          ? [state.sweepAngle]
          : [state.sweepAngle, state.sweepAngle + Math.PI];
      const laserHeightOffset =`,
  `      const activeBeams =
        state.beamsCount === 1
          ? [state.sweepAngle]
          : [state.sweepAngle, state.sweepAngle + Math.PI];
      const approachIntensity = getLaserRopeApproachIntensity(activeBeams);
      drawLaserRopeSweepTelegraph(
        ctx,
        arenaMetrics,
        state.laserMode,
        approachIntensity,
        presentationTime,
      );
      if (state.pendingLaserMode && state.telegraphTimer > 0) {
        const telegraphProgress = 1 - state.telegraphTimer / state.telegraphDuration;
        drawLaserRopeSpawnTelegraph(
          ctx,
          arenaMetrics,
          state.pendingLaserMode,
          telegraphProgress,
          presentationTime,
        );
      }

      const laserHeightOffset =`,
  'laser approach and spawn telegraphs',
);

replaceOnce(
  path,
  `      if (state.isAlive) {
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

      for (const particle of state.particles) {`,
  `      if (state.isAlive) {
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

      drawLaserRopeFeedbackBursts(ctx, state.feedbackBursts, presentationTime);

      for (const particle of state.particles) {`,
  'feedback burst rendering',
);

replaceOnce(
  path,
  `      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Sync HUD`,
  `      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      drawLaserRopeFeedbackBanner(ctx, w, h, state.feedbackBanner);
      drawLaserRopeScreenFlash(
        ctx,
        w,
        h,
        state.screenFlashColor,
        state.screenFlashAlpha,
      );

      // Sync HUD`,
  'feedback banner and screen flash rendering',
);

replaceOnce(
  path,
  '      return state.isAlive;',
  '      return state.isAlive || state.deathPresentationTimer > 0;',
  'death feedback loop continuation',
);

console.log(
  'Applied Laser Rope Reflex Phase B: staged beam telegraphs, near-miss feedback, combo feedback, collision bursts, screen shake, screen flash, and readable fatal-hit presentation.',
);
