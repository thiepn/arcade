import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { Target, Zap, Shield, Sparkles, Trophy } from 'lucide-react';
import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';

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

  const [hudState, setHudState] = useState({
    score: 0,
    stage: 1,
    knivesLeft: 8,
    combo: 0,
    multiplier: 1,
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
    coreSpeed: 2.2, // radians per sec
    coreRadius: 65,
    speedChangeTimer: 2.5,

    // Blades
    embeddedBlades: [] as EmbeddedBlade[],
    apples: [] as CoreApple[],
    shields: [] as DeflectorShield[],

    // Flying Blade
    flyingBladeY: 0,
    isThrowing: false,

    // Particles & Popups
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }[],
    popups: [] as { id: number; x: number; y: number; text: string; color: string; life: number }[],
    nextId: 1,
  });

  // Throw blade trigger
  const throwKnife = () => {
    const state = gameStateRef.current;
    if (state.isThrowing || !state.isAlive || isPausedRef.current || state.knivesRemaining <= 0) return;

    state.isThrowing = true;
    state.flyingBladeY = 0; // starts at bottom
    state.knivesRemaining--;
    if (soundEnabled) sounds.playKnifeThrow();
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Enter') {
        e.preventDefault();
        throwKnife();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const setSafeTimeout = useSafeTimeout();

  const initStage = useCallback((stageNum: number) => {
    const state = gameStateRef.current;
    state.stage = stageNum;
    state.coreAngle = 0;
    state.coreSpeed = (1.8 + stageNum * 0.3) * (Math.random() < 0.5 ? 1 : -1);
    state.speedChangeTimer = Math.random() * 2 + 1.5;

    const knifeCount = Math.min(14, 7 + stageNum);
    state.totalKnivesForStage = knifeCount;
    state.knivesRemaining = knifeCount;
    state.isThrowing = false;
    state.embeddedBlades = [];
    state.apples = [];
    state.shields = [];

    // Pre-embed some blades or shields on higher stages
    if (stageNum > 1) {
      const preBladeCount = Math.min(4, Math.floor(stageNum / 2));
      for (let i = 0; i < preBladeCount; i++) {
        state.embeddedBlades.push({
          angle: (i / preBladeCount) * Math.PI * 2 + Math.random() * 0.4,
        });
      }
    }

    // Add cyber apples
    const appleCount = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < appleCount; i++) {
      state.apples.push({
        angle: Math.random() * Math.PI * 2,
        sliced: false,
      });
    }

    // Add rotating deflector shield on boss stages (every 4 stages)
    if (stageNum % 4 === 0) {
      state.shields.push({
        startAngle: 0,
        spanAngle: 0.8,
      });
    }
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

      if (!isPausedRef.current && state.isAlive) {
        // Rotate Core with dynamic speed shifts
        state.speedChangeTimer -= dt;
        if (state.speedChangeTimer <= 0) {
          state.speedChangeTimer = Math.random() * 2.5 + 1.2;
          const targetDir = Math.random() < 0.5 ? 1 : -1;
          state.coreSpeed = (2.0 + state.stage * 0.35 + Math.random() * 1.5) * targetDir;
        }

        state.coreAngle += state.coreSpeed * dt;

        // Update Flying Knife
        if (state.isThrowing) {
          const throwSpeed = 1800; // px per sec
          state.flyingBladeY += throwSpeed * dt;

          const currentBladeY = bottomKnifeY - state.flyingBladeY;

          // Check hit target core
          if (currentBladeY <= coreY + state.coreRadius) {
            state.isThrowing = false;

            // Hit angle relative to core's current rotation
            // Bottom of core is angle = Math.PI / 2
            const hitAngle = Math.PI / 2 - state.coreAngle;

            // Check collision with embedded blades (within 0.22 radians ~ 12 deg)
            let collidedWithBlade = false;
            for (const b of state.embeddedBlades) {
              const diff = Math.abs((((hitAngle - b.angle) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
              if (diff < 0.22) {
                collidedWithBlade = true;
                break;
              }
            }

            // Check collision with deflector shields
            let collidedWithShield = false;
            for (const s of state.shields) {
              const normHit = (((hitAngle - s.startAngle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
              if (normHit < s.spanAngle) {
                collidedWithShield = true;
                break;
              }
            }

            if (collidedWithBlade || collidedWithShield) {
              // Game Over! Deflected
              state.isAlive = false;
              if (soundEnabled) sounds.playExplosion();

              for (let i = 0; i < 20; i++) {
                state.particles.push({
                  x: coreX,
                  y: coreY + state.coreRadius,
                  vx: (Math.random() - 0.5) * 200,
                  vy: Math.random() * 150 + 50,
                  life: 0.6,
                  color: '#EF4444',
                  size: 3.5,
                });
              }

              setSafeTimeout(() => onGameOver(state.score), 400);
            } else {
              // Success! Blade sticks in core
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

              // Check apple slice
              for (const apple of state.apples) {
                if (!apple.sliced) {
                  const diff = Math.abs((((hitAngle - apple.angle) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
                  if (diff < 0.28) {
                    apple.sliced = true;
                    const applePts = 500 * state.multiplier;
                    state.score += applePts;
                    onScoreUpdate(state.score);
                    if (soundEnabled) sounds.playFeverMode();
                    state.popups.push({
                      id: state.nextId++,
                      x: coreX,
                      y: coreY + state.coreRadius + 20,
                      text: `CYBER CRYSTAL +${applePts}!`,
                      color: '#34D399',
                      life: 1.2,
                    });
                  }
                }
              }

              // Spark particles
              for (let i = 0; i < 10; i++) {
                state.particles.push({
                  x: coreX,
                  y: coreY + state.coreRadius,
                  vx: (Math.random() - 0.5) * 120,
                  vy: (Math.random() - 0.5) * 120,
                  life: 0.35,
                  color: '#FACC15',
                  size: 2.5,
                });
              }

              // Check Stage Clear (all knives thrown)
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

                // Core shatter explosion particles
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

                // Next Stage transition
                setSafeTimeout(() => {
                  initStage(state.stage + 1);
                }, 600);
              }
            }
          }
        }

        // Update Particles & Popups
        for (let i = state.particles.length - 1; i >= 0; i--) {
          const p = state.particles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
          if (p.life <= 0) state.particles.splice(i, 1);
        }

        for (let i = state.popups.length - 1; i >= 0; i--) {
          const pop = state.popups[i];
          pop.y -= 25 * dt;
          pop.life -= dt;
          if (pop.life <= 0) state.popups.splice(i, 1);
        }
      }

      // ==========================================
      // RENDER CYBER TARGET CORE
      // ==========================================
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, w, h);

      // Central Rotating Target Core
      ctx.save();
      ctx.translate(coreX, coreY);
      ctx.rotate(state.coreAngle);

      // Target core outer glow ring
      ctx.fillStyle = '#18181B';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, state.coreRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner Core Matrix Pattern
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, state.coreRadius * 0.6, 0, Math.PI * 2);
      ctx.stroke();

      // Rotating Spoke Runes
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang) * (state.coreRadius - 6), Math.sin(ang) * (state.coreRadius - 6));
        ctx.stroke();
      }

      // Render Embedded Blades sticking out of core
      for (const blade of state.embeddedBlades) {
        ctx.save();
        ctx.rotate(blade.angle);
        ctx.translate(0, state.coreRadius);

        // Blade handle & laser edge
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

      // Render Apples / Crystals
      for (const apple of state.apples) {
        if (apple.sliced) continue;
        ctx.save();
        ctx.rotate(apple.angle);
        ctx.translate(0, state.coreRadius + 10);
        ctx.fillStyle = '#34D399';
        ctx.shadowColor = '#34D399';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Render Deflector Shields
      for (const s of state.shields) {
        ctx.save();
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 8;
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, state.coreRadius + 6, s.startAngle, s.startAngle + s.spanAngle);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();

      // Render Flying Blade
      if (state.isThrowing) {
        const flyY = bottomKnifeY - state.flyingBladeY;
        ctx.save();
        ctx.translate(coreX, flyY);
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

      // Render Ready Blade at bottom
      if (!state.isThrowing && state.knivesRemaining > 0 && state.isAlive) {
        ctx.save();
        ctx.translate(coreX, bottomKnifeY);
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

      // Render Remaining Knives Stack indicator on left
      const stackStartX = 20;
      for (let i = 0; i < state.totalKnivesForStage; i++) {
        const isAvailable = i < state.knivesRemaining;
        ctx.fillStyle = isAvailable ? '#38BDF8' : '#27272A';
        ctx.fillRect(stackStartX + i * 14, h - 22, 9, 12);
      }

      // Render Particles
      for (const p of state.particles) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Render Popups
      for (const pop of state.popups) {
        ctx.save();
        ctx.globalAlpha = pop.life;
        ctx.fillStyle = pop.color;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = pop.color;
        ctx.shadowBlur = 8;
        ctx.fillText(pop.text, pop.x, pop.y);
        ctx.restore();
      }

      // Sync HUD
      setHudState({
        score: state.score,
        stage: state.stage,
        knivesLeft: state.knivesRemaining,
        combo: state.combo,
        multiplier: state.multiplier,
      });

      return state.isAlive;
    },
  });

  return (
    <div
      ref={containerRef}
      id="knife-target-container"
      onPointerDown={throwKnife}
      className="relative w-full h-full min-h-[440px] flex flex-col items-center justify-center bg-[#050508] select-none overflow-hidden touch-none cursor-pointer"
    >
      {/* Top HUD */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-sky-400 font-mono text-xs font-black backdrop-blur-md">
            STAGE {hudState.stage}
          </div>

          {hudState.multiplier > 1 && (
            <div className="px-2 py-1 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-xs font-black">
              {hudState.multiplier}x MULTIPLIER
            </div>
          )}
        </div>

        <div className="px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-zinc-300 font-mono text-xs font-bold backdrop-blur-md">
          BLADES: <span className="text-sky-400 font-black">{hudState.knivesLeft}</span>
        </div>
      </div>

      <canvas ref={canvasRef} className="w-full h-full block" />

      <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none z-10">
        <div className="px-3 py-1 rounded-full bg-[#121215]/85 border border-[#27272A] text-[10px] text-[#A1A1AA] font-mono backdrop-blur-md">
          <span>Tap / Click / Space to Throw Laser Blade • Avoid already embedded blades</span>
        </div>
      </div>
    </div>
  );
};
