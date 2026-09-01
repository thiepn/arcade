import React, { useEffect, useRef, useState } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { useGameLoop, useSafeTimeout, useRenderPublishedState } from '../hooks/useGameLoop';
import {
  LASER_ROPE_REDLINE_DURATION_SEC,
  canActivateLaserRopeRedline,
  getLaserRopeRedlineCharges,
  getLaserRopeRedlineReward,
  getLaserRopeRedlineSpeed,
} from '../lib/laserRopeRedline';
import { canApplyLaserRopeModeChange } from '../lib/laserRopeBalance';

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

  const [hudState, setHudState] = useRenderPublishedState({
    score: 0,
    jumpStreak: 0,
    rpm: 24,
    multiplier: 1,
    feverPercent: 0,
    hasShield: false,
    laserMode: 'LOW' as 'LOW' | 'HIGH' | 'DUAL',
    redlineCharges: 1,
    redlineActive: false,
    redlinePercent: 0,
  }, 80);

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

    // P12 Redline mastery: voluntarily trade speed for a larger payout.
    redlineCharges: 1,
    redlineActive: false,
    redlineTimer: 0,

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

  const triggerRedline = () => {
    const state = gameStateRef.current;
    if (isPausedRef.current || !canActivateLaserRopeRedline(state.redlineCharges, state.redlineActive, state.isAlive)) return;
    state.redlineCharges--;
    state.redlineActive = true;
    state.redlineTimer = LASER_ROPE_REDLINE_DURATION_SEC;
    if (soundEnabled) sounds.playFeverMode();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        triggerJump();
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        triggerSlide();
      } else if (e.code === 'KeyF' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        e.preventDefault();
        triggerRedline();
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
      // Preserve the original compact arena style, but shrink it when needed so
      // the floor and beam emitters never clip on narrow phone canvases.
      const arenaRadiusX = Math.min(165, Math.max(80, w / 2 - 16));
      const arenaRadiusY = Math.max(28, arenaRadiusX * (58 / 165));
      const beamRadius = Math.max(70, arenaRadiusX - 10);

      if (!isPausedRef.current && state.isAlive) {
        // Fever state
        if (state.isFeverActive) {
          state.feverDuration -= dt;
          if (state.feverDuration <= 0) {
            state.isFeverActive = false;
            state.feverCharge = 0;
          }
        }

        if (state.redlineActive) {
          state.redlineTimer -= dt;
          if (state.redlineTimer <= 0) {
            state.redlineTimer = 0;
            state.redlineActive = false;
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

        // Mode change (Low jump vs High slide vs Dual). P16 keeps the existing
        // difficulty curve, but does not allow a newly announced mode to become
        // relevant immediately before its next bottom crossing.
        state.modeChangeTimer -= dt;
        if (state.modeChangeTimer <= 0) {
          let nextMode: 'LOW' | 'HIGH' | 'DUAL' = 'LOW';
          if (state.jumpStreak > 6 && Math.random() < 0.4) {
            nextMode = 'HIGH';
          } else if (state.jumpStreak >= 12 && Math.random() < 0.35) {
            nextMode = 'DUAL';
          }

          const candidateBeamsCount = nextMode === 'DUAL' ? 2 : 1;
          const transitionBaseSpeed = state.isFeverActive ? state.sweepSpeed * 0.75 : state.sweepSpeed;
          const transitionSpeed = getLaserRopeRedlineSpeed(
            transitionBaseSpeed,
            state.redlineActive,
          );

          if (canApplyLaserRopeModeChange(
            state.sweepAngle,
            state.direction,
            transitionSpeed,
            candidateBeamsCount,
          )) {
            state.modeChangeTimer = Math.random() * 4.5 + 4.0;

            if (nextMode === 'HIGH') {
              state.laserMode = 'HIGH';
              // Preserve the certified feedback contract: HIGH always collapses
              // a previous DUAL pattern back to exactly one beam.
              state.beamsCount = 1;
              state.popups.push({
                id: state.nextId++,
                x: centerX,
                y: groundY - 150,
                text: '⚠️ HIGH BEAM - SLIDE / DUCK!',
                color: '#A855F7',
                life: 1.2,
              });
            } else if (nextMode === 'DUAL') {
              state.laserMode = 'DUAL';
              state.beamsCount = 2;
              state.popups.push({
                id: state.nextId++,
                x: centerX,
                y: groundY - 150,
                text: '⚠️ DUAL BEAM - JUMP!',
                color: '#F43F5E',
                life: 1.0,
              });
            } else {
              state.laserMode = 'LOW';
              state.beamsCount = 1;
            }
          } else {
            // Retry soon without lowering sweep speed or granting invulnerability.
            state.modeChangeTimer = 0.08;
          }
        }

        const effectiveSpeed = state.isFeverActive ? state.sweepSpeed * 0.75 : state.sweepSpeed;
        const sweepSmoothing = 1 - Math.pow(0.92, dt * 60);
        state.sweepSpeed += (state.speedTarget - state.sweepSpeed) * sweepSmoothing;

        const prevAngle = state.sweepAngle;
        if (state.redlineActive) {
          const redlineExtraSpeed = getLaserRopeRedlineSpeed(effectiveSpeed, true) - effectiveSpeed;
          state.sweepAngle += redlineExtraSpeed * state.direction * dt;
        }
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
              state.redlineCharges = getLaserRopeRedlineCharges(state.jumpStreak, state.redlineCharges);
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
              const earnedPts = getLaserRopeRedlineReward(
                basePts,
                state.multiplier,
                feverMult,
                state.redlineActive,
              );
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
      // LIGHTWEIGHT HIGH-FPS RENDER
      // ==========================================
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, w, h);

      // Arena Floor
      ctx.save();
      ctx.translate(centerX, groundY);

      // Floor Oval
      ctx.fillStyle = '#0F172A';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, arenaRadiusX, arenaRadiusY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Floor Ring
      ctx.strokeStyle = state.isFeverActive ? 'rgba(250, 204, 21, 0.6)' : 'rgba(6, 182, 212, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, arenaRadiusX * 0.52, arenaRadiusY * 0.52, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Jump Target Ring
      ctx.strokeStyle = state.laserMode === 'HIGH' ? 'rgba(168, 85, 247, 0.5)' : 'rgba(244, 63, 94, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(
        0,
        arenaRadiusY * 0.55,
        Math.max(22, arenaRadiusX * 0.17),
        Math.max(8, arenaRadiusY * 0.17),
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();

      // Render Collectible Orbs
      for (const orb of state.orbs) {
        const floatY = -orb.y + Math.sin(orb.pulse) * 4;
        let col = '#FACC15';
        if (orb.type === 'gem') col = '#38BDF8';
        if (orb.type === 'shield') col = '#A855F7';

        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(orb.x, floatY, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(orb.x, floatY, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Render Rotating Lasers
      const activeBeams =
        state.beamsCount === 1
          ? [state.sweepAngle]
          : [state.sweepAngle, state.sweepAngle + Math.PI];

      const laserHeightOffset = state.laserMode === 'HIGH' ? -28 : 0;

      for (const bAngle of activeBeams) {
        const lx = Math.cos(bAngle) * beamRadius;
        const ly = Math.sin(bAngle) * (beamRadius * 0.35) + laserHeightOffset;

        // Laser line
        const beamColor = state.isFeverActive
          ? '#FACC15'
          : state.laserMode === 'HIGH'
          ? '#A855F7'
          : '#EF4444';
        ctx.strokeStyle = beamColor;
        ctx.shadowColor = beamColor;
        ctx.shadowBlur = 10;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(0, -8 + laserHeightOffset);
        ctx.quadraticCurveTo(lx * 0.5, ly * 0.5 + 6, lx, ly);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Inner Core
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -8 + laserHeightOffset);
        ctx.quadraticCurveTo(lx * 0.5, ly * 0.5 + 6, lx, ly);
        ctx.stroke();

        // Emitter tip
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(lx, ly, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Center Hub
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-10, -36, 20, 36);
      ctx.fillStyle = state.isFeverActive ? '#FACC15' : '#EF4444';
      ctx.beginPath();
      ctx.arc(0, -36, 8, 0, Math.PI * 2);
      ctx.fill();

      // Player Shadow
      const shadowScale = Math.max(0.3, 1 - state.playerY / 140);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.ellipse(0, 28, (state.isSliding ? 26 : 18) * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Runner Avatar
      if (state.isAlive) {
        const py = -state.playerY + 28;
        ctx.save();
        ctx.translate(0, py - (state.isSliding ? 8 : 18));

        // Shield aura
        if (state.hasShield) {
          ctx.strokeStyle = '#A855F7';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 22, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (state.isSliding) {
          // Sliding / Ducking pose
          ctx.fillStyle = state.isFeverActive ? '#FACC15' : '#34D399';
          ctx.fillRect(-18, -6, 36, 12);
          ctx.strokeStyle = '#059669';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-18, -6, 36, 12);

          // Visor
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(4, -4, 10, 5);
        } else {
          // Standing / Jumping runner
          ctx.fillStyle = state.isFeverActive ? '#FACC15' : '#38BDF8';
          ctx.fillRect(-10, -16, 20, 24);
          ctx.strokeStyle = '#0284C7';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-10, -16, 20, 24);

          // Visor
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(-7, -12, 14, 6);

          // Legs
          ctx.fillStyle = '#0369A1';
          ctx.fillRect(-8, 8, 5, 10);
          ctx.fillRect(3, 8, 5, 10);

          // Shoes
          ctx.fillStyle = '#38BDF8';
          ctx.fillRect(-9, 17, 7, 3);
          ctx.fillRect(2, 17, 7, 3);

          // Thruster sparks when jumping
          if (!state.isGrounded) {
            ctx.fillStyle = state.jumpCount === 2 ? '#F43F5E' : '#FACC15';
            ctx.beginPath();
            ctx.moveTo(-7, 20);
            ctx.lineTo(-5, 28);
            ctx.lineTo(-3, 20);
            ctx.moveTo(3, 20);
            ctx.lineTo(5, 28);
            ctx.lineTo(7, 20);
            ctx.fill();
          }
        }

        ctx.restore();
      }

      // Particles
      for (const p of state.particles) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Popups
      for (const pop of state.popups) {
        ctx.fillStyle = pop.color;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pop.text, pop.x, pop.y);
      }

      // Sync HUD
      setHudState((prev) => {
        const rpm = Math.round((Math.abs(state.sweepSpeed) / (Math.PI * 2)) * 60);
        const feverPercent = state.isFeverActive
          ? Math.round((state.feverDuration / 6.0) * 100)
          : Math.round(state.feverCharge);
        const redlinePercent = state.redlineActive
          ? Math.round((state.redlineTimer / LASER_ROPE_REDLINE_DURATION_SEC) * 100)
          : 0;

        if (
          prev.score === state.score &&
          prev.jumpStreak === state.jumpStreak &&
          prev.rpm === rpm &&
          prev.multiplier === state.multiplier &&
          prev.feverPercent === feverPercent &&
          prev.hasShield === state.hasShield &&
          prev.laserMode === state.laserMode &&
          prev.redlineCharges === state.redlineCharges &&
          prev.redlineActive === state.redlineActive &&
          prev.redlinePercent === redlinePercent
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
          redlineCharges: state.redlineCharges,
          redlineActive: state.redlineActive,
          redlinePercent,
        };
      });

      return state.isAlive;
    },
  });

  return (
    <div
      ref={containerRef}
      id="laser-rope-container"
      className="relative w-full h-full min-h-0 flex flex-col items-center justify-center bg-[#050508] select-none overflow-hidden touch-none"
    >
      {/* Top HUD */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-pink-400 font-mono text-xs font-black backdrop-blur-md">
            STREAK: {hudState.jumpStreak}
          </div>

          <div className="px-2 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-zinc-400 font-mono text-[10px] sm:text-xs font-black backdrop-blur-md">
            MODE:{' '}
            <span
              className={
                hudState.laserMode === 'HIGH'
                  ? 'text-purple-300'
                  : hudState.laserMode === 'DUAL'
                    ? 'text-pink-400'
                    : 'text-cyan-300'
              }
            >
              {hudState.laserMode}
            </span>
          </div>

          {hudState.multiplier > 1 && (
            <div className="px-2 py-1 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-xs font-black">
              {hudState.multiplier}x
            </div>
          )}

          {hudState.hasShield && (
            <div className="px-2 py-1 rounded-xl bg-purple-500/20 border border-purple-500/50 text-purple-300 font-mono text-xs font-black">
              🛡️ SHIELD
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-zinc-400 font-mono text-xs font-bold backdrop-blur-md">
            SPEED: <span className="text-white">{hudState.rpm} RPM</span>
          </div>

          <div className="w-20 bg-zinc-800 rounded-full h-2.5 overflow-hidden border border-zinc-700">
            <div
              className="bg-amber-400 h-full transition-all duration-150"
              style={{ width: `${hudState.feverPercent}%` }}
            />
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="w-full h-full min-h-0 block" />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          triggerRedline();
        }}
        disabled={hudState.redlineCharges <= 0 || hudState.redlineActive}
        className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-400/60 text-rose-200 font-mono text-[10px] font-black disabled:opacity-45 pointer-events-auto"
        aria-label="Activate Redline"
      >
        {hudState.redlineActive ? `REDLINE ${hudState.redlinePercent}%` : `REDLINE (${hudState.redlineCharges}) · F/SHIFT`}
      </button>

      {/* On-screen Jump & Slide Controls */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:bottom-3 sm:left-4 sm:right-4 flex items-center justify-between gap-2 pointer-events-auto z-10">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerSlide();
          }}
          className="h-12 min-w-0 flex-1 sm:flex-none sm:px-6 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-purple-500/50 text-purple-300 font-black flex items-center justify-center gap-1.5 active:scale-95 shadow-lg cursor-pointer"
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
          className="h-12 min-w-0 flex-1 sm:flex-none sm:px-7 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-black flex items-center justify-center gap-1.5 active:scale-95 shadow-lg shadow-pink-500/30 cursor-pointer"
          aria-label="Jump / Double Jump"
        >
          <ArrowUp className="w-5 h-5" />
          <span className="font-mono text-xs font-black">JUMP</span>
        </button>
      </div>
    </div>
  );
};
