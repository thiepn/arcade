import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { useGameLoop, useSafeTimeout, useRenderPublishedState } from '../hooks/useGameLoop';
import {
  getKnifeFlightPoint,
  getKnifeLocalImpactAngle,
  getKnifePointerAimAngle,
  getKnifePolarPoint,
  isKnifeAngleWithinArc,
  normalizeKnifeAngle,
  shortestKnifeAngleDistance,
} from '../lib/knifeTargetAim';
import { getKnifeStageConfig, getKnifeStageRotationSpeed } from '../lib/knifeStageProgression';
import {
  findKnifeRazorTarget,
  getKnifeRazorBonus,
  getKnifeRazorTolerance,
  isKnifeRazorHit,
  isKnifeRazorRush,
} from '../lib/knifeMastery';

interface EmbeddedBlade {
  angle: number;
}

interface CoreApple {
  angle: number;
  sliced: boolean;
}

interface DeflectorShield {
  startAngle: number;
  spanAngle: number;
}

export const KnifeTargetGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const [hudState, setHudState] = useRenderPublishedState({
    score: 0,
    stage: 1,
    knivesLeft: 8,
    combo: 0,
    multiplier: 1,
    stageLabel: 'STEADY CORE',
    precisionChain: 0,
  });

  const gameStateRef = useRef({
    score: 0,
    stage: 1,
    knivesRemaining: 8,
    totalKnivesForStage: 8,
    isAlive: true,
    combo: 0,
    multiplier: 1,

    // Target Core
    coreAngle: 0,
    coreSpeed: 2.2,
    coreDirection: 1 as -1 | 1,
    coreRadius: 65,
    stageElapsed: 0,
    reverseTimer: 0,
    stageLabel: 'STEADY CORE',

    // Blades / mounted target objects use standard local polar angles.
    embeddedBlades: [] as EmbeddedBlade[],
    apples: [] as CoreApple[],
    shields: [] as DeflectorShield[],

    // Player aim and flying blade. World aim is captured at throw time so pointer
    // movement after release cannot redirect a knife already in flight.
    aimWorldAngle: Math.PI / 2,
    flyingAimWorldAngle: Math.PI / 2,
    flyingBladeProgress: 0,
    isThrowing: false,

    // Particles & Popups
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }[],
    popups: [] as { id: number; x: number; y: number; text: string; color: string; life: number }[],
    nextId: 1,
    precisionTargetAngle: 0,
    precisionTargetIndex: 0,
    precisionChain: 0,
  });

  const setSafeTimeout = useSafeTimeout();

  const throwKnife = (aimWorldAngle?: number) => {
    const state = gameStateRef.current;
    if (
      state.isThrowing ||
      !state.isAlive ||
      isPausedRef.current ||
      state.knivesRemaining <= 0
    ) {
      return;
    }

    state.flyingAimWorldAngle = normalizeKnifeAngle(
      aimWorldAngle ?? state.aimWorldAngle,
    );
    state.flyingBladeProgress = 0;
    state.isThrowing = true;
    state.knivesRemaining--;
    if (soundEnabled) sounds.playKnifeThrow();
  };

  const updateAimFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return gameStateRef.current.aimWorldAngle;

    const rect = container.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const coreX = rect.width / 2;
    const coreY = rect.height * 0.36;
    const state = gameStateRef.current;
    const angle = getKnifePointerAimAngle(
      pointerX,
      pointerY,
      coreX,
      coreY,
      state.aimWorldAngle,
    );
    state.aimWorldAngle = angle;
    return angle;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isPausedRef.current || !gameStateRef.current.isAlive) return;
    if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
      updateAimFromPointer(event);
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isPausedRef.current) return;
    event.preventDefault();
    const angle = updateAimFromPointer(event);
    throwKnife(angle);
  };

  // Keyboard throws use the most recent pointer aim. If the pointer has never
  // aimed the target, the deterministic default is the bottom-center impact.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' ||
        e.code === 'ArrowUp' ||
        e.code === 'KeyW' ||
        e.code === 'Enter'
      ) {
        e.preventDefault();
        throwKnife();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const initStage = useCallback((stageNum: number) => {
    const state = gameStateRef.current;
    const config = getKnifeStageConfig(stageNum);
    state.stage = stageNum;
    state.stageLabel = config.label;
    state.coreAngle = 0;
    state.stageElapsed = 0;
    state.coreDirection = Math.random() < 0.5 ? 1 : -1;
    state.reverseTimer = config.reverseInterval;
    state.coreSpeed = getKnifeStageRotationSpeed(config, 0, state.coreDirection);

    state.totalKnivesForStage = config.knifeCount;
    state.knivesRemaining = config.knifeCount;
    state.isThrowing = false;
    state.flyingBladeProgress = 0;
    state.aimWorldAngle = Math.PI / 2;
    state.flyingAimWorldAngle = Math.PI / 2;
    state.embeddedBlades = [];
    state.apples = [];
    state.shields = [];
    state.precisionTargetIndex = 0;
    state.precisionChain = 0;

    for (let i = 0; i < config.preBladeCount; i++) {
      state.embeddedBlades.push({
        angle: normalizeKnifeAngle(
          (i / Math.max(1, config.preBladeCount)) * Math.PI * 2 + Math.random() * 0.22,
        ),
      });
    }

    const appleOffset = Math.random() * Math.PI * 2;
    for (let i = 0; i < config.appleCount; i++) {
      state.apples.push({
        angle: normalizeKnifeAngle(appleOffset + (i / config.appleCount) * Math.PI * 2),
        sliced: false,
      });
    }

    for (let i = 0; i < config.shieldCount; i++) {
      state.shields.push({
        startAngle: normalizeKnifeAngle(0.25 + (i / config.shieldCount) * Math.PI * 2),
        spanAngle: config.shieldSpan,
      });
    }

    state.precisionTargetAngle = findKnifeRazorTarget(
      stageNum,
      state.precisionTargetIndex,
      state.embeddedBlades.map((blade) => blade.angle),
      state.shields,
    );
  }, []);

  useEffect(() => {
    initStage(1);
  }, [initStage]);

  useGameLoop({
    canvasRef,
    isPaused,
    onUpdate: (ctx, deltaSec, w, h) => {
      const dt = Math.min(deltaSec, 0.08);
      const state = gameStateRef.current;

      ctx.clearRect(0, 0, w, h);

      const coreX = w / 2;
      const coreY = h * 0.36;
      const bottomKnifeY = h - 65;
      const throwOrigin = { x: coreX, y: bottomKnifeY };

      if (!isPausedRef.current && state.isAlive) {
        const stageConfig = getKnifeStageConfig(state.stage);
        state.stageElapsed += dt;
        if (stageConfig.reverseInterval > 0) {
          state.reverseTimer -= dt;
          if (state.reverseTimer <= 0) {
            state.coreDirection *= -1;
            state.reverseTimer += stageConfig.reverseInterval;
            if (soundEnabled) sounds.playWhoosh();
          }
        }
        state.coreSpeed = getKnifeStageRotationSpeed(
          stageConfig,
          state.stageElapsed,
          state.coreDirection,
        );
        state.coreAngle += state.coreSpeed * dt;

        if (state.isThrowing) {
          const throwSpeed = 1800;
          const impactPoint = getKnifePolarPoint(
            coreX,
            coreY,
            state.coreRadius,
            state.flyingAimWorldAngle,
          );
          const pathLength = Math.max(
            1,
            Math.hypot(
              impactPoint.x - throwOrigin.x,
              impactPoint.y - throwOrigin.y,
            ),
          );
          state.flyingBladeProgress += (throwSpeed * dt) / pathLength;

          if (state.flyingBladeProgress >= 1) {
            state.flyingBladeProgress = 1;
            state.isThrowing = false;

            // Convert the exact world-space pointer aim into the core's current
            // local angle at impact. This keeps collision, rendering, apples,
            // shields, and embedded knives on one consistent angular system.
            const hitAngle = getKnifeLocalImpactAngle(
              state.flyingAimWorldAngle,
              state.coreAngle,
            );

            let collidedWithBlade = false;
            for (const blade of state.embeddedBlades) {
              if (shortestKnifeAngleDistance(hitAngle, blade.angle) < 0.22) {
                collidedWithBlade = true;
                break;
              }
            }

            let collidedWithShield = false;
            for (const shield of state.shields) {
              if (
                isKnifeAngleWithinArc(
                  hitAngle,
                  shield.startAngle,
                  shield.spanAngle,
                )
              ) {
                collidedWithShield = true;
                break;
              }
            }

            if (collidedWithBlade || collidedWithShield) {
              state.isAlive = false;
              if (soundEnabled) sounds.playExplosion();

              for (let i = 0; i < 20; i++) {
                state.particles.push({
                  x: impactPoint.x,
                  y: impactPoint.y,
                  vx: (Math.random() - 0.5) * 200,
                  vy: (Math.random() - 0.5) * 200,
                  life: 0.6,
                  color: '#EF4444',
                  size: 3.5,
                });
              }

              setSafeTimeout(() => onGameOver(state.score), 400);
            } else {
              const razorHit = isKnifeRazorHit(
                hitAngle,
                state.precisionTargetAngle,
                state.stage,
              );
              state.embeddedBlades.push({ angle: hitAngle });
              state.combo++;
              if (state.combo >= 15) state.multiplier = 4;
              else if (state.combo >= 8) state.multiplier = 3;
              else if (state.combo >= 3) state.multiplier = 2;
              else state.multiplier = 1;

              const bladePts = 100 * state.multiplier;
              state.score += bladePts;
              onScoreUpdate(state.score);
              if (soundEnabled) sounds.playKnifeStick();

              if (razorHit) {
                state.precisionChain++;
                const razorPts = getKnifeRazorBonus(state.precisionChain, state.stage);
                state.score += razorPts;
                onScoreUpdate(state.score);
                state.popups.push({
                  id: state.nextId++,
                  x: impactPoint.x,
                  y: impactPoint.y - 22,
                  text: isKnifeRazorRush(state.precisionChain)
                    ? `RAZOR RUSH x${state.precisionChain} +${razorPts}`
                    : `RAZOR MARK +${razorPts}`,
                  color: '#FACC15',
                  life: 1.1,
                });
                if (soundEnabled) sounds.playCombo(Math.min(18, state.precisionChain));
              } else {
                state.precisionChain = 0;
              }

              state.precisionTargetIndex++;
              state.precisionTargetAngle = findKnifeRazorTarget(
                state.stage,
                state.precisionTargetIndex,
                state.embeddedBlades.map((blade) => blade.angle),
                state.shields,
              );

              for (const apple of state.apples) {
                if (
                  !apple.sliced &&
                  shortestKnifeAngleDistance(hitAngle, apple.angle) < 0.28
                ) {
                  apple.sliced = true;
                  const applePts = 500 * state.multiplier;
                  state.score += applePts;
                  onScoreUpdate(state.score);
                  if (soundEnabled) sounds.playFeverMode();
                  state.popups.push({
                    id: state.nextId++,
                    x: impactPoint.x,
                    y: impactPoint.y + 20,
                    text: `CYBER CRYSTAL +${applePts}!`,
                    color: '#34D399',
                    life: 1.2,
                  });
                }
              }

              for (let i = 0; i < 10; i++) {
                state.particles.push({
                  x: impactPoint.x,
                  y: impactPoint.y,
                  vx: (Math.random() - 0.5) * 120,
                  vy: (Math.random() - 0.5) * 120,
                  life: 0.35,
                  color: '#FACC15',
                  size: 2.5,
                });
              }

              if (state.knivesRemaining <= 0) {
                const stageClearPts = 1000 * state.stage;
                state.score += stageClearPts;
                onScoreUpdate(state.score);
                if (soundEnabled) sounds.playSuccess();

                state.popups.push({
                  id: state.nextId++,
                  x: coreX,
                  y: coreY - 40,
                  text: `STAGE ${state.stage} SHATTERED! +${stageClearPts}`,
                  color: '#F43F5E',
                  life: 1.5,
                });

                for (let i = 0; i < 30; i++) {
                  const a = Math.random() * Math.PI * 2;
                  const spd = Math.random() * 200 + 50;
                  state.particles.push({
                    x: coreX,
                    y: coreY,
                    vx: Math.cos(a) * spd,
                    vy: Math.sin(a) * spd,
                    life: 0.8,
                    color: '#38BDF8',
                    size: Math.random() * 5 + 2,
                  });
                }

                setSafeTimeout(() => {
                  initStage(state.stage + 1);
                }, 600);
              }
            }
          }
        }

        for (let i = state.particles.length - 1; i >= 0; i--) {
          const particle = state.particles[i];
          particle.x += particle.vx * dt;
          particle.y += particle.vy * dt;
          particle.life -= dt;
          if (particle.life <= 0) state.particles.splice(i, 1);
        }

        for (let i = state.popups.length - 1; i >= 0; i--) {
          const popup = state.popups[i];
          popup.y -= 25 * dt;
          popup.life -= dt;
          if (popup.life <= 0) state.popups.splice(i, 1);
        }
      }

      // ==========================================
      // RENDER CYBER TARGET CORE
      // ==========================================
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, w, h);

      // Aim guide: the reticle is the exact world-space point the next knife
      // will strike. While a blade is airborne, the guide stays locked to the
      // captured throw angle so the visual prediction cannot drift.
      const guideAngle = state.isThrowing
        ? state.flyingAimWorldAngle
        : state.aimWorldAngle;
      const guideImpact = getKnifePolarPoint(
        coreX,
        coreY,
        state.coreRadius,
        guideAngle,
      );
      ctx.save();
      ctx.strokeStyle = state.isThrowing
        ? 'rgba(56,189,248,0.24)'
        : 'rgba(56,189,248,0.48)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 7]);
      ctx.beginPath();
      ctx.moveTo(throwOrigin.x, throwOrigin.y - 24);
      ctx.lineTo(guideImpact.x, guideImpact.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = '#FACC15';
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(guideImpact.x, guideImpact.y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(guideImpact.x - 12, guideImpact.y);
      ctx.lineTo(guideImpact.x + 12, guideImpact.y);
      ctx.moveTo(guideImpact.x, guideImpact.y - 12);
      ctx.lineTo(guideImpact.x, guideImpact.y + 12);
      ctx.stroke();
      ctx.restore();

      // Central Rotating Target Core
      ctx.save();
      ctx.translate(coreX, coreY);
      ctx.rotate(state.coreAngle);

      ctx.fillStyle = '#18181B';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, state.coreRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, state.coreRadius * 0.6, 0, Math.PI * 2);
      ctx.stroke();

      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(
          Math.cos(ang) * (state.coreRadius - 6),
          Math.sin(ang) * (state.coreRadius - 6),
        );
        ctx.stroke();
      }

      // The gold Razor Mark is always generated away from existing blades and shields.
      const razorTolerance = getKnifeRazorTolerance(state.stage);
      ctx.save();
      ctx.strokeStyle = '#FACC15';
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(
        0,
        0,
        state.coreRadius + 12,
        state.precisionTargetAngle - razorTolerance,
        state.precisionTargetAngle + razorTolerance,
      );
      ctx.stroke();
      ctx.restore();

      // Embedded knives and crystals now use the same standard polar-angle
      // convention as collision detection and deflector arcs.
      for (const blade of state.embeddedBlades) {
        ctx.save();
        ctx.rotate(blade.angle - Math.PI / 2);
        ctx.translate(0, state.coreRadius);
        ctx.fillStyle = '#38BDF8';
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-4, 25);
        ctx.lineTo(4, 25);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-2, 25, 4, 12);
        ctx.restore();
      }

      for (const apple of state.apples) {
        if (apple.sliced) continue;
        ctx.save();
        ctx.rotate(apple.angle - Math.PI / 2);
        ctx.translate(0, state.coreRadius + 10);
        ctx.fillStyle = '#34D399';
        ctx.shadowColor = '#34D399';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (const shield of state.shields) {
        ctx.save();
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 8;
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(
          0,
          0,
          state.coreRadius + 6,
          shield.startAngle,
          shield.startAngle + shield.spanAngle,
        );
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();

      if (state.isThrowing) {
        const impactPoint = getKnifePolarPoint(
          coreX,
          coreY,
          state.coreRadius,
          state.flyingAimWorldAngle,
        );
        const flightPoint = getKnifeFlightPoint(
          throwOrigin,
          impactPoint,
          state.flyingBladeProgress,
        );
        const flightAngle = Math.atan2(
          impactPoint.y - throwOrigin.y,
          impactPoint.x - throwOrigin.x,
        );

        ctx.save();
        ctx.translate(flightPoint.x, flightPoint.y);
        ctx.rotate(flightAngle + Math.PI / 2);
        ctx.fillStyle = '#38BDF8';
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(0, -25);
        ctx.lineTo(-5, 0);
        ctx.lineTo(5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-2, 0, 4, 15);
        ctx.restore();
      }

      if (!state.isThrowing && state.knivesRemaining > 0 && state.isAlive) {
        const readyImpact = getKnifePolarPoint(
          coreX,
          coreY,
          state.coreRadius,
          state.aimWorldAngle,
        );
        const readyAngle = Math.atan2(
          readyImpact.y - bottomKnifeY,
          readyImpact.x - coreX,
        );
        ctx.save();
        ctx.translate(coreX, bottomKnifeY);
        ctx.rotate(readyAngle + Math.PI / 2);
        ctx.fillStyle = '#38BDF8';
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(0, -25);
        ctx.lineTo(-5, 0);
        ctx.lineTo(5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-2, 0, 4, 15);
        ctx.restore();
      }

      const stackStartX = 20;
      for (let i = 0; i < state.totalKnivesForStage; i++) {
        const isAvailable = i < state.knivesRemaining;
        ctx.fillStyle = isAvailable ? '#38BDF8' : '#27272A';
        ctx.fillRect(stackStartX + i * 14, h - 22, 9, 12);
      }

      for (const particle of state.particles) {
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const popup of state.popups) {
        ctx.save();
        ctx.globalAlpha = popup.life;
        ctx.fillStyle = popup.color;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = popup.color;
        ctx.shadowBlur = 8;
        ctx.fillText(popup.text, popup.x, popup.y);
        ctx.restore();
      }

      setHudState({
        score: state.score,
        stage: state.stage,
        knivesLeft: state.knivesRemaining,
        combo: state.combo,
        multiplier: state.multiplier,
        stageLabel: state.stageLabel,
        precisionChain: state.precisionChain,
      });

      return state.isAlive;
    },
  });

  return (
    <div
      ref={containerRef}
      id="knife-target-container"
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      className="relative w-full h-full min-h-0 flex flex-col items-center justify-center bg-[#050508] select-none overflow-hidden touch-none cursor-crosshair"
    >
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-sky-400 font-mono text-xs font-black backdrop-blur-md">
            STAGE {hudState.stage}
          </div>
          <div className="px-2 py-1 rounded-xl bg-[#18181B]/85 border border-sky-500/20 text-sky-200 font-mono text-[10px] font-bold backdrop-blur-md">
            {hudState.stageLabel}
          </div>

          {hudState.precisionChain > 0 && (
            <div className="px-2 py-1 rounded-xl bg-yellow-500/15 border border-yellow-400/40 text-yellow-300 font-mono text-[10px] font-black">
              RAZOR x{hudState.precisionChain}
            </div>
          )}

          {hudState.multiplier > 1 && (
            <div className="px-2 py-1 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-xs font-black">
              {hudState.multiplier}x MULTIPLIER
            </div>
          )}
        </div>

        <div className="px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-zinc-300 font-mono text-xs font-bold backdrop-blur-md">
          BLADES:{' '}
          <span className="text-sky-400 font-black">{hudState.knivesLeft}</span>
        </div>
      </div>

      <canvas ref={canvasRef} className="w-full h-full min-h-0 block" />

      <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none z-10 px-2">
        <div className="px-3 py-1 rounded-full bg-[#121215]/85 border border-[#27272A] text-[9px] sm:text-[10px] text-[#A1A1AA] font-mono backdrop-blur-md text-center">
          <span>
            Aim around the core • Hit the gold Razor Mark to build a precision chain • Tap / Click to throw • Space / Enter uses current aim
          </span>
        </div>
      </div>
    </div>
  );
};
