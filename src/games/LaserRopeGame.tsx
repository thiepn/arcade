import React, { useEffect, useRef, useState } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';
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
} from '../lib/laserRopePresentation';

interface OrbItem {
  id: number;
  x: number;
  y: number; // height above ground
  type: 'coin' | 'gem' | 'shield';
  collected: boolean;
  pulse: number;
}

export const LaserRopeGame: React.FC<GameComponentProps> = ({
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
    jumpStreak: 0,
    rpm: 24,
    multiplier: 1,
    feverPercent: 0,
    hasShield: false,
    laserMode: 'LOW' as 'LOW' | 'HIGH' | 'DUAL',
    isFeverActive: false,
  });

  const gameStateRef = useRef({
    score: 0,
    jumpStreak: 0,
    multiplier: 1,
    isAlive: true,
    hasShield: false,

    // Player Jump & Slide State
    playerY: 0,
    playerVY: 0,
    isGrounded: true,
    jumpCount: 0,
    isSliding: false,
    slideTimer: 0,

    // Sweeping Lasers
    sweepAngle: -Math.PI / 2, // Start at top
    sweepSpeed: 2.2, // rads/s
    speedTarget: 2.2,
    speedChangeTimer: 4.0,
    direction: 1, // 1 or -1
    beamsCount: 1,
    laserMode: 'LOW' as 'LOW' | 'HIGH' | 'DUAL', // LOW = jump, HIGH = slide
    modeChangeTimer: 5.0,

    feverCharge: 0,
    isFeverActive: false,
    feverDuration: 0,

    // Collectibles
    orbs: [] as OrbItem[],
    nextOrbTimer: 2.0,

    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }[],
    popups: [] as { id: number; x: number; y: number; text: string; color: string; life: number }[],
    nextId: 1,
  });

  const triggerJump = () => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current) return;

    if (state.jumpCount < 2) {
      state.isSliding = false;
      state.playerVY = state.jumpCount === 0 ? 560 : 480;
      state.jumpCount++;
      state.isGrounded = false;
      if (soundEnabled) sounds.playJump();

      for (let i = 0; i < 8; i++) {
        state.particles.push({
          x: (Math.random() - 0.5) * 30,
          y: 0,
          vx: (Math.random() - 0.5) * 90,
          vy: -Math.random() * 50 - 15,
          life: 0.3,
          maxLife: 0.3,
          color: state.jumpCount === 1 ? '#38BDF8' : '#F43F5E',
          size: 3,
        });
      }
    }
  };

  const triggerSlide = () => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current) return;

    if (state.isGrounded) {
      state.isSliding = true;
      state.slideTimer = 0.65;
      if (soundEnabled) sounds.playDriftSkid();

      for (let i = 0; i < 6; i++) {
        state.particles.push({
          x: (Math.random() - 0.5) * 25,
          y: 0,
          vx: (Math.random() - 0.5) * 120,
          vy: -Math.random() * 20,
          life: 0.3,
          maxLife: 0.3,
          color: '#34D399',
          size: 2.5,
        });
      }
    } else {
      // Fast drop down from mid-air
      state.playerVY = -750;
      state.isSliding = true;
      state.slideTimer = 0.5;
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        triggerJump();
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        triggerSlide();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const setSafeTimeout = useSafeTimeout();

  useGameLoop({
    canvasRef,
    isPaused,
    onUpdate: (ctx, deltaSec, w, h) => {
      const dt = Math.min(deltaSec, 0.05);
      const state = gameStateRef.current;

      ctx.clearRect(0, 0, w, h);

      const centerX = w / 2;
      const groundY = h * 0.72;

      if (!isPausedRef.current && state.isAlive) {
        // Fever state
        if (state.isFeverActive) {
          state.feverDuration -= dt;
          if (state.feverDuration <= 0) {
            state.isFeverActive = false;
            state.feverCharge = 0;
          }
        }

        // Jump & Slide physics
        const gravity = 1450;
        state.playerVY -= gravity * dt;
        state.playerY += state.playerVY * dt;

        if (state.playerY <= 0) {
          state.playerY = 0;
          state.playerVY = 0;
          state.isGrounded = true;
          state.jumpCount = 0;
        }

        if (state.isSliding) {
          state.slideTimer -= dt;
          if (state.slideTimer <= 0) {
            state.isSliding = false;
          }
        }

        // Speed ramp up and dynamic reverses
        state.speedChangeTimer -= dt;
        if (state.speedChangeTimer <= 0) {
          state.speedChangeTimer = Math.random() * 3.5 + 3.0;
          if (Math.random() < 0.4 && state.jumpStreak > 4) {
            state.direction *= -1; // Reverse rotation cleanly
            state.popups.push({
              id: state.nextId++,
              x: centerX,
              y: groundY - 140,
              text: '⚡ DIRECTION REVERSED!',
              color: '#F43F5E',
              life: 1.0,
            });
          }
          state.speedTarget = Math.min(5.4, 2.2 + state.jumpStreak * 0.1);
        }

        // Mode change (Low jump vs High slide vs Dual)
        state.modeChangeTimer -= dt;
        if (state.modeChangeTimer <= 0) {
          state.modeChangeTimer = Math.random() * 4.5 + 4.0;
          if (state.jumpStreak > 6 && Math.random() < 0.4) {
            state.laserMode = 'HIGH';
            state.popups.push({
              id: state.nextId++,
              x: centerX,
              y: groundY - 150,
              text: '⚠️ HIGH BEAM - SLIDE / DUCK!',
              color: '#A855F7',
              life: 1.2,
            });
          } else if (state.jumpStreak >= 12 && Math.random() < 0.35) {
            state.laserMode = 'DUAL';
            state.beamsCount = 2;
          } else {
            state.laserMode = 'LOW';
            state.beamsCount = 1;
          }
        }

        const effectiveSpeed = state.isFeverActive ? state.sweepSpeed * 0.75 : state.sweepSpeed;
        state.sweepSpeed += (state.speedTarget - state.sweepSpeed) * 0.08;

        const prevAngle = state.sweepAngle;
        state.sweepAngle += effectiveSpeed * state.direction * dt;

        // Spawn bonus orbs
        state.nextOrbTimer -= dt;
        if (state.nextOrbTimer <= 0 && state.orbs.length < 3) {
          state.nextOrbTimer = Math.random() * 3.0 + 2.5;
          const types: ('coin' | 'gem' | 'shield')[] = ['coin', 'gem'];
          if (!state.hasShield && Math.random() < 0.25) types.push('shield');
          const chosenType = types[Math.floor(Math.random() * types.length)];
          state.orbs.push({
            id: state.nextId++,
            x: (Math.random() - 0.5) * 60,
            y: Math.random() * 50 + 35,
            type: chosenType,
            collected: false,
            pulse: 0,
          });
        }

        // Collect orbs
        for (const orb of state.orbs) {
          if (!orb.collected) {
            orb.pulse += dt * 4;
            const distY = Math.abs(state.playerY - orb.y);
            if (distY < 26) {
              orb.collected = true;
              let orbPts = 100;
              let text = '+100';
              let col = '#FACC15';

              if (orb.type === 'gem') {
                orbPts = 250;
                text = '💎 +250';
                col = '#38BDF8';
              } else if (orb.type === 'shield') {
                state.hasShield = true;
                orbPts = 150;
                text = '🛡️ SHIELD READY';
                col = '#A855F7';
              }

              const finalPts = orbPts * (state.isFeverActive ? 2 : 1) * state.multiplier;
              state.score += finalPts;
              onScoreUpdate(state.score);
              if (soundEnabled) sounds.playScore();

              state.popups.push({
                id: state.nextId++,
                x: centerX + orb.x,
                y: groundY - orb.y - 20,
                text,
                color: col,
                life: 0.8,
              });

              for (let i = 0; i < 8; i++) {
                state.particles.push({
                  x: orb.x,
                  y: -orb.y,
                  vx: (Math.random() - 0.5) * 100,
                  vy: (Math.random() - 0.5) * 100,
                  life: 0.35,
                  maxLife: 0.35,
                  color: col,
                  size: 3,
                });
              }
            }
          }
        }
        state.orbs = state.orbs.filter((o) => !o.collected);

        // Flawless Bidirectional Bottom Crossing Check
        const targetRad = Math.PI / 2; // Bottom apex where runner stands
        const beamAngles =
          state.beamsCount === 1
            ? [state.sweepAngle]
            : [state.sweepAngle, state.sweepAngle + Math.PI];

        for (let b = 0; b < beamAngles.length; b++) {
          const currAngle = beamAngles[b];
          const prevB =
            state.beamsCount === 1
              ? prevAngle
              : b === 0
              ? prevAngle
              : prevAngle + Math.PI;

          // Compute angle relative to bottom apex in [-PI, PI]
          const relPrev = Math.atan2(Math.sin(prevB - targetRad), Math.cos(prevB - targetRad));
          const relCurr = Math.atan2(Math.sin(currAngle - targetRad), Math.cos(currAngle - targetRad));

          let crossed = false;
          if (state.direction > 0) {
            // Clockwise: crossing zero from negative to positive
            crossed = relPrev < 0 && relCurr >= 0 && Math.abs(relCurr - relPrev) < Math.PI;
          } else {
            // Counter-Clockwise: crossing zero from positive to negative
            crossed = relPrev > 0 && relCurr <= 0 && Math.abs(relCurr - relPrev) < Math.PI;
          }

          if (crossed) {
            // Evaluate evasion based on laser mode:
            let evaded = false;
            let evasionText = 'PERFECT JUMP!';

            if (state.laserMode === 'HIGH') {
              // High beam: player must be sliding/ducking (or under 18px height)
              if (state.isSliding || (state.isGrounded && state.playerY <= 0)) {
                evaded = state.isSliding;
                evasionText = 'PERFECT SLIDE!';
              }
            } else {
              // Standard low beam: player must have jumped (height > 24px)
              if (state.playerY > 24) {
                evaded = true;
                evasionText = state.playerY < 55 ? 'PERFECT JUMP!' : 'GOOD JUMP!';
              }
            }

            if (evaded) {
              // Successfully cleared laser!
              state.jumpStreak++;
              state.feverCharge = Math.min(100, state.feverCharge + 15);
              if (state.feverCharge >= 100 && !state.isFeverActive) {
                state.isFeverActive = true;
                state.feverDuration = 6.0;
                state.popups.push({
                  id: state.nextId++,
                  x: centerX,
                  y: groundY - 170,
                  text: '⚡ OVERDRIVE ACTIVE (2X PTS)!',
                  color: '#FACC15',
                  life: 1.2,
                });
              }

              if (state.jumpStreak >= 20) state.multiplier = 4;
              else if (state.jumpStreak >= 10) state.multiplier = 3;
              else if (state.jumpStreak >= 4) state.multiplier = 2;
              else state.multiplier = 1;

              const basePts = 150;
              const feverMult = state.isFeverActive ? 2 : 1;
              const earnedPts = basePts * state.multiplier * feverMult;
              state.score += earnedPts;
              onScoreUpdate(state.score);
              if (soundEnabled) sounds.playScore();

              state.popups.push({
                id: state.nextId++,
                x: centerX,
                y: groundY - state.playerY - 25,
                text: `${evasionText} +${earnedPts}`,
                color: '#34D399',
                life: 0.8,
              });

              for (let i = 0; i < 10; i++) {
                state.particles.push({
                  x: (Math.random() - 0.5) * 40,
                  y: -state.playerY,
                  vx: (Math.random() - 0.5) * 140,
                  vy: (Math.random() - 0.5) * 140,
                  life: 0.4,
                  maxLife: 0.4,
                  color: '#34D399',
                  size: 3,
                });
              }
            } else {
              // Hit laser!
              if (state.hasShield) {
                state.hasShield = false;
                if (soundEnabled) sounds.playShockwave();
                state.popups.push({
                  id: state.nextId++,
                  x: centerX,
                  y: groundY - state.playerY - 30,
                  text: 'SHIELD DEFLECTED!',
                  color: '#A855F7',
                  life: 1.0,
                });
              } else {
                state.isAlive = false;
                if (soundEnabled) sounds.playExplosion();

                for (let i = 0; i < 20; i++) {
                  state.particles.push({
                    x: (Math.random() - 0.5) * 20,
                    y: -state.playerY,
                    vx: (Math.random() - 0.5) * 200,
                    vy: (Math.random() - 0.5) * 200,
                    life: 0.6,
                    maxLife: 0.6,
                    color: '#EF4444',
                    size: 4,
                  });
                }

                setSafeTimeout(() => onGameOver(state.score), 400);
              }
            }
          }
        }

        // Update particles & popups
        for (let i = state.particles.length - 1; i >= 0; i--) {
          const p = state.particles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
          if (p.life <= 0) state.particles.splice(i, 1);
        }

        for (let i = state.popups.length - 1; i >= 0; i--) {
          const pop = state.popups[i];
          pop.y -= 30 * dt;
          pop.life -= dt;
          if (pop.life <= 0) state.popups.splice(i, 1);
        }
      }

      // ==========================================
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

      // Sync HUD
      setHudState((prev) => {
        const rpm = Math.round((Math.abs(state.sweepSpeed) / (Math.PI * 2)) * 60);
        const feverPercent = state.isFeverActive
          ? Math.round((state.feverDuration / 6.0) * 100)
          : Math.round(state.feverCharge);

        if (
          prev.score === state.score &&
          prev.jumpStreak === state.jumpStreak &&
          prev.rpm === rpm &&
          prev.multiplier === state.multiplier &&
          prev.feverPercent === feverPercent &&
          prev.hasShield === state.hasShield &&
          prev.laserMode === state.laserMode &&
          prev.isFeverActive === state.isFeverActive
        ) {
          return prev;
        }
        return {
          score: state.score,
          jumpStreak: state.jumpStreak,
          rpm,
          multiplier: state.multiplier,
          feverPercent,
          hasShield: state.hasShield,
          laserMode: state.laserMode,
          isFeverActive: state.isFeverActive,
        };
      });

      return state.isAlive;
    },
  });

  return (
    <div
      ref={containerRef}
      id="laser-rope-container"
      className="relative w-full h-full min-h-0 flex flex-col items-center justify-center bg-[#030712] select-none overflow-hidden touch-none"
    >
      {/* Phase A HUD */}
      <LaserRopeHud state={hudState} />

      <canvas ref={canvasRef} className="w-full h-full min-h-0 block touch-none" />

      {/* On-screen Jump & Slide Controls */}
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between pointer-events-auto z-10">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerSlide();
          }}
          className="px-6 h-12 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-purple-500/50 text-purple-300 font-black flex items-center justify-center gap-1.5 active:scale-95 shadow-lg cursor-pointer"
          aria-label="Slide / Duck"
        >
          <ArrowDown className="w-5 h-5" />
          <span className="font-mono text-xs font-black">SLIDE / DUCK</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerJump();
          }}
          className="px-7 h-12 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-black flex items-center justify-center gap-1.5 active:scale-95 shadow-lg shadow-pink-500/30 cursor-pointer"
          aria-label="Jump / Double Jump"
        >
          <ArrowUp className="w-5 h-5" />
          <span className="font-mono text-xs font-black">JUMP</span>
        </button>
      </div>
    </div>
  );
};
