import React, { useEffect, useRef } from 'react';
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
import {
  advanceLaserRopeChoreography,
  createLaserRopeChoreographyState,
  getLaserRopeChoreographyLabel,
  getLaserRopeDesiredMode,
  type LaserRopeMode,
} from '../lib/laserRopeChoreographies';

interface OrbItem {
  id: number;
  x: number;
  y: number;
  type: 'coin' | 'gem' | 'shield';
  collected: boolean;
  pulse: number;
}

const isChoreographyModeEligible = (mode: LaserRopeMode, jumpStreak: number): boolean => {
  if (mode === 'DUAL') return jumpStreak >= 12;
  if (mode === 'HIGH') return jumpStreak > 6;
  return true;
};

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
    laserMode: 'LOW' as LaserRopeMode,
    redlineCharges: 1,
    redlineActive: false,
    redlinePercent: 0,
    choreography: 'CROSS STEP • 1/4',
  }, 80);

  const gameStateRef = useRef({
    score: 0,
    jumpStreak: 0,
    multiplier: 1,
    isAlive: true,
    hasShield: false,
    playerY: 0,
    playerVY: 0,
    isGrounded: true,
    jumpCount: 0,
    isSliding: false,
    slideTimer: 0,
    sweepAngle: -Math.PI / 2,
    sweepSpeed: 2.2,
    speedTarget: 2.2,
    speedChangeTimer: 4.0,
    direction: 1,
    beamsCount: 1,
    laserMode: 'LOW' as LaserRopeMode,
    modeChangeTimer: 5.0,
    choreographyState: createLaserRopeChoreographyState(),
    feverCharge: 0,
    isFeverActive: false,
    feverDuration: 0,
    redlineCharges: 1,
    redlineActive: false,
    redlineTimer: 0,
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
      const arenaRadiusX = Math.min(165, Math.max(80, w / 2 - 16));
      const arenaRadiusY = Math.max(28, arenaRadiusX * (58 / 165));
      const beamRadius = Math.max(70, arenaRadiusX - 10);

      if (!isPausedRef.current && state.isAlive) {
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
          if (state.slideTimer <= 0) state.isSliding = false;
        }

        state.speedChangeTimer -= dt;
        if (state.speedChangeTimer <= 0) {
          state.speedChangeTimer = Math.random() * 3.5 + 3.0;
          if (Math.random() < 0.4 && state.jumpStreak > 4) {
            state.direction *= -1;
            state.popups.push({ id: state.nextId++, x: centerX, y: groundY - 140, text: '⚡ DIRECTION REVERSED!', color: '#F43F5E', life: 1.0 });
          }
          state.speedTarget = Math.min(5.4, 2.2 + state.jumpStreak * 0.1);
        }

        state.modeChangeTimer -= dt;
        if (state.modeChangeTimer <= 0) {
          const desiredMode = getLaserRopeDesiredMode(state.choreographyState);
          const eligible = isChoreographyModeEligible(desiredMode, state.jumpStreak);
          const nextMode: LaserRopeMode = eligible
            ? desiredMode
            : desiredMode === 'DUAL' && state.jumpStreak > 6
              ? 'HIGH'
              : 'LOW';
          const candidateBeamsCount = nextMode === 'DUAL' ? 2 : 1;
          const transitionBaseSpeed = state.isFeverActive ? state.sweepSpeed * 0.75 : state.sweepSpeed;
          const transitionSpeed = getLaserRopeRedlineSpeed(transitionBaseSpeed, state.redlineActive);

          if (canApplyLaserRopeModeChange(
            state.sweepAngle,
            state.direction,
            transitionSpeed,
            candidateBeamsCount,
          )) {
            state.modeChangeTimer = eligible ? Math.random() * 1.5 + 2.6 : 0.75;
            if (nextMode === 'HIGH') {
              state.laserMode = 'HIGH';
              state.beamsCount = 1;
              state.popups.push({ id: state.nextId++, x: centerX, y: groundY - 150, text: '⚠️ HIGH BEAM - SLIDE / DUCK!', color: '#A855F7', life: 1.2 });
            } else if (nextMode === 'DUAL') {
              state.laserMode = 'DUAL';
              state.beamsCount = 2;
              state.popups.push({ id: state.nextId++, x: centerX, y: groundY - 150, text: '⚠️ DUAL BEAM - JUMP!', color: '#F43F5E', life: 1.0 });
            } else {
              state.laserMode = 'LOW';
              state.beamsCount = 1;
            }
          } else {
            state.modeChangeTimer = 0.08;
          }
        }

        const effectiveSpeed = state.isFeverActive ? state.sweepSpeed * 0.75 : state.sweepSpeed;
        const sweepSmoothing = 1 - Math.pow(0.92, dt * 60);
        state.sweepSpeed += (state.speedTarget - state.sweepSpeed) * sweepSmoothing;
        const prevAngle = state.sweepAngle;
        if (state.redlineActive) {
          state.sweepAngle += (getLaserRopeRedlineSpeed(effectiveSpeed, true) - effectiveSpeed) * state.direction * dt;
        }
        state.sweepAngle += effectiveSpeed * state.direction * dt;

        state.nextOrbTimer -= dt;
        if (state.nextOrbTimer <= 0 && state.orbs.length < 3) {
          state.nextOrbTimer = Math.random() * 3.0 + 2.5;
          const types: ('coin' | 'gem' | 'shield')[] = ['coin', 'gem'];
          if (!state.hasShield && Math.random() < 0.25) types.push('shield');
          const chosenType = types[Math.floor(Math.random() * types.length)] ?? 'coin';
          state.orbs.push({ id: state.nextId++, x: (Math.random() - 0.5) * 60, y: Math.random() * 50 + 35, type: chosenType, collected: false, pulse: 0 });
        }

        for (const orb of state.orbs) {
          if (!orb.collected) {
            orb.pulse += dt * 4;
            if (Math.abs(state.playerY - orb.y) < 26) {
              orb.collected = true;
              let orbPts = 100;
              let text = '+100';
              let color = '#FACC15';
              if (orb.type === 'gem') {
                orbPts = 250;
                text = '💎 +250';
                color = '#38BDF8';
              } else if (orb.type === 'shield') {
                state.hasShield = true;
                orbPts = 150;
                text = '🛡️ SHIELD READY';
                color = '#A855F7';
              }
              const finalPts = orbPts * (state.isFeverActive ? 2 : 1) * state.multiplier;
              state.score += finalPts;
              onScoreUpdate(state.score);
              if (soundEnabled) sounds.playScore();
              state.popups.push({ id: state.nextId++, x: centerX + orb.x, y: groundY - orb.y - 20, text, color, life: 0.8 });
              for (let i = 0; i < 8; i++) {
                state.particles.push({ x: orb.x, y: -orb.y, vx: (Math.random() - 0.5) * 100, vy: (Math.random() - 0.5) * 100, life: 0.35, maxLife: 0.35, color, size: 3 });
              }
            }
          }
        }
        state.orbs = state.orbs.filter((orb) => !orb.collected);

        const targetRad = Math.PI / 2;
        const beamAngles = state.beamsCount === 1 ? [state.sweepAngle] : [state.sweepAngle, state.sweepAngle + Math.PI];
        for (let beamIndex = 0; beamIndex < beamAngles.length; beamIndex++) {
          const currentAngle = beamAngles[beamIndex];
          const previousBeamAngle = state.beamsCount === 1 ? prevAngle : beamIndex === 0 ? prevAngle : prevAngle + Math.PI;
          const relPrev = Math.atan2(Math.sin(previousBeamAngle - targetRad), Math.cos(previousBeamAngle - targetRad));
          const relCurr = Math.atan2(Math.sin(currentAngle - targetRad), Math.cos(currentAngle - targetRad));
          let crossed = false;
          if (state.direction > 0) {
            crossed = relPrev < 0 && relCurr >= 0 && Math.abs(relCurr - relPrev) < Math.PI;
          } else {
            crossed = relPrev > 0 && relCurr <= 0 && Math.abs(relCurr - relPrev) < Math.PI;
          }

          if (crossed) {
            let evaded = false;
            let evasionText = 'PERFECT JUMP!';
            if (state.laserMode === 'HIGH') {
              if (state.isSliding || (state.isGrounded && state.playerY <= 0)) {
                evaded = state.isSliding;
                evasionText = 'PERFECT SLIDE!';
              }
            } else if (state.playerY > 24) {
              evaded = true;
              evasionText = state.playerY < 55 ? 'PERFECT JUMP!' : 'GOOD JUMP!';
            }

            if (evaded) {
              state.jumpStreak++;
              state.redlineCharges = getLaserRopeRedlineCharges(state.jumpStreak, state.redlineCharges);
              state.feverCharge = Math.min(100, state.feverCharge + 15);
              if (state.feverCharge >= 100 && !state.isFeverActive) {
                state.isFeverActive = true;
                state.feverDuration = 6.0;
                state.popups.push({ id: state.nextId++, x: centerX, y: groundY - 170, text: '⚡ OVERDRIVE ACTIVE (2X PTS)!', color: '#FACC15', life: 1.2 });
              }
              if (state.jumpStreak >= 20) state.multiplier = 4;
              else if (state.jumpStreak >= 10) state.multiplier = 3;
              else if (state.jumpStreak >= 4) state.multiplier = 2;
              else state.multiplier = 1;

              let earnedPts = getLaserRopeRedlineReward(150, state.multiplier, state.isFeverActive ? 2 : 1, state.redlineActive);
              const expectedMode = getLaserRopeDesiredMode(state.choreographyState);
              if (state.laserMode === expectedMode && isChoreographyModeEligible(expectedMode, state.jumpStreak)) {
                const choreography = advanceLaserRopeChoreography(
                  state.choreographyState,
                  state.laserMode,
                  state.redlineActive,
                  state.jumpStreak,
                );
                state.choreographyState = choreography.state;
                earnedPts += choreography.bonus;
                if (choreography.progressed) state.modeChangeTimer = 0;
                if (choreography.completed) {
                  state.popups.push({ id: state.nextId++, x: centerX, y: groundY - 185, text: `CHOREOGRAPHY +${choreography.bonus}`, color: '#67E8F9', life: 1.2 });
                  if (soundEnabled) sounds.playSuccess();
                }
              }

              state.score += earnedPts;
              onScoreUpdate(state.score);
              if (soundEnabled) sounds.playScore();
              state.popups.push({ id: state.nextId++, x: centerX, y: groundY - state.playerY - 25, text: `${evasionText} +${earnedPts}`, color: '#34D399', life: 0.8 });
              for (let i = 0; i < 10; i++) {
                state.particles.push({ x: (Math.random() - 0.5) * 40, y: -state.playerY, vx: (Math.random() - 0.5) * 140, vy: (Math.random() - 0.5) * 140, life: 0.4, maxLife: 0.4, color: '#34D399', size: 3 });
              }
            } else if (state.hasShield) {
              state.hasShield = false;
              if (soundEnabled) sounds.playShockwave();
              state.popups.push({ id: state.nextId++, x: centerX, y: groundY - state.playerY - 30, text: 'SHIELD DEFLECTED!', color: '#A855F7', life: 1.0 });
            } else {
              state.isAlive = false;
              if (soundEnabled) sounds.playExplosion();
              for (let i = 0; i < 20; i++) {
                state.particles.push({ x: (Math.random() - 0.5) * 20, y: -state.playerY, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200, life: 0.6, maxLife: 0.6, color: '#EF4444', size: 4 });
              }
              setSafeTimeout(() => onGameOver(state.score), 400);
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
          popup.y -= 30 * dt;
          popup.life -= dt;
          if (popup.life <= 0) state.popups.splice(i, 1);
        }
      }

      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(centerX, groundY);
      ctx.fillStyle = '#0F172A';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, arenaRadiusX, arenaRadiusY, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = state.isFeverActive ? 'rgba(250, 204, 21, 0.6)' : 'rgba(6, 182, 212, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, arenaRadiusX * 0.52, arenaRadiusY * 0.52, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = state.laserMode === 'HIGH' ? 'rgba(168, 85, 247, 0.5)' : 'rgba(244, 63, 94, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, arenaRadiusY * 0.55, Math.max(22, arenaRadiusX * 0.17), Math.max(8, arenaRadiusY * 0.17), 0, 0, Math.PI * 2); ctx.stroke();

      for (const orb of state.orbs) {
        const floatY = -orb.y + Math.sin(orb.pulse) * 4;
        const color = orb.type === 'gem' ? '#38BDF8' : orb.type === 'shield' ? '#A855F7' : '#FACC15';
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(orb.x, floatY, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(orb.x, floatY, 3, 0, Math.PI * 2); ctx.fill();
      }

      const activeBeams = state.beamsCount === 1 ? [state.sweepAngle] : [state.sweepAngle, state.sweepAngle + Math.PI];
      const laserHeightOffset = state.laserMode === 'HIGH' ? -28 : 0;
      for (const beamAngle of activeBeams) {
        const lx = Math.cos(beamAngle) * beamRadius;
        const ly = Math.sin(beamAngle) * (beamRadius * 0.35) + laserHeightOffset;
        const beamColor = state.isFeverActive ? '#FACC15' : state.laserMode === 'HIGH' ? '#A855F7' : '#EF4444';
        ctx.strokeStyle = beamColor; ctx.shadowColor = beamColor; ctx.shadowBlur = 10; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(0, -8 + laserHeightOffset); ctx.quadraticCurveTo(lx * 0.5, ly * 0.5 + 6, lx, ly); ctx.stroke(); ctx.shadowBlur = 0;
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -8 + laserHeightOffset); ctx.quadraticCurveTo(lx * 0.5, ly * 0.5 + 6, lx, ly); ctx.stroke();
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(lx, ly, 5, 0, Math.PI * 2); ctx.fill();
      }

      ctx.fillStyle = '#1E293B'; ctx.fillRect(-10, -36, 20, 36);
      ctx.fillStyle = state.isFeverActive ? '#FACC15' : '#EF4444'; ctx.beginPath(); ctx.arc(0, -36, 8, 0, Math.PI * 2); ctx.fill();
      const shadowScale = Math.max(0.3, 1 - state.playerY / 140);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.beginPath(); ctx.ellipse(0, 28, (state.isSliding ? 26 : 18) * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2); ctx.fill();

      if (state.isAlive) {
        const playerRenderY = -state.playerY + 28;
        ctx.save();
        ctx.translate(0, playerRenderY - (state.isSliding ? 8 : 18));
        if (state.hasShield) {
          ctx.strokeStyle = '#A855F7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.stroke();
        }
        if (state.isSliding) {
          ctx.fillStyle = state.isFeverActive ? '#FACC15' : '#34D399'; ctx.fillRect(-18, -6, 36, 12);
          ctx.strokeStyle = '#059669'; ctx.lineWidth = 1.5; ctx.strokeRect(-18, -6, 36, 12);
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(4, -4, 10, 5);
        } else {
          ctx.fillStyle = state.isFeverActive ? '#FACC15' : '#38BDF8'; ctx.fillRect(-10, -16, 20, 24);
          ctx.strokeStyle = '#0284C7'; ctx.lineWidth = 1.5; ctx.strokeRect(-10, -16, 20, 24);
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(-7, -12, 14, 6);
          ctx.fillStyle = '#0369A1'; ctx.fillRect(-8, 8, 5, 10); ctx.fillRect(3, 8, 5, 10);
          ctx.fillStyle = '#38BDF8'; ctx.fillRect(-9, 17, 7, 3); ctx.fillRect(2, 17, 7, 3);
          if (!state.isGrounded) {
            ctx.fillStyle = state.jumpCount === 2 ? '#F43F5E' : '#FACC15';
            ctx.beginPath(); ctx.moveTo(-7, 20); ctx.lineTo(-5, 28); ctx.lineTo(-3, 20); ctx.moveTo(3, 20); ctx.lineTo(5, 28); ctx.lineTo(7, 20); ctx.fill();
          }
        }
        ctx.restore();
      }
      for (const particle of state.particles) {
        ctx.fillStyle = particle.color; ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      for (const popup of state.popups) {
        ctx.fillStyle = popup.color; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.fillText(popup.text, popup.x, popup.y);
      }

      setHudState((previous) => {
        const rpm = Math.round((Math.abs(state.sweepSpeed) / (Math.PI * 2)) * 60);
        const feverPercent = state.isFeverActive ? Math.round((state.feverDuration / 6.0) * 100) : Math.round(state.feverCharge);
        const redlinePercent = state.redlineActive ? Math.round((state.redlineTimer / LASER_ROPE_REDLINE_DURATION_SEC) * 100) : 0;
        const choreography = getLaserRopeChoreographyLabel(state.choreographyState);
        const next = {
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
          choreography,
        };
        if (Object.entries(next).every(([key, value]) => previous[key as keyof typeof previous] === value)) return previous;
        return next;
      });

      return state.isAlive;
    },
  });

  return (
    <div ref={containerRef} id="laser-rope-container" className="relative w-full h-full min-h-0 flex flex-col items-center justify-center bg-[#050508] select-none overflow-hidden touch-none">
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between z-10 pointer-events-none gap-2 flex-wrap">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-pink-400 font-mono text-xs font-black backdrop-blur-md">STREAK: {hudState.jumpStreak}</div>
            <div className="px-2 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-zinc-400 font-mono text-[10px] sm:text-xs font-black backdrop-blur-md">MODE:{' '}<span className={hudState.laserMode === 'HIGH' ? 'text-purple-300' : hudState.laserMode === 'DUAL' ? 'text-pink-400' : 'text-cyan-300'}>{hudState.laserMode}</span></div>
            {hudState.multiplier > 1 && <div className="px-2 py-1 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-xs font-black">{hudState.multiplier}x</div>}
            {hudState.hasShield && <div className="px-2 py-1 rounded-xl bg-purple-500/20 border border-purple-500/50 text-purple-300 font-mono text-xs font-black">🛡️ SHIELD</div>}
          </div>
          <div data-p23-transform="CHOREOGRAPHY" className="px-2.5 py-1 rounded-xl bg-cyan-500/10 border border-cyan-400/25 text-cyan-200 font-mono text-[10px] font-black w-fit">CHOREOGRAPHY — {hudState.choreography}</div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-zinc-400 font-mono text-xs font-bold backdrop-blur-md">SPEED: <span className="text-white">{hudState.rpm} RPM</span></div>
          <div className="w-20 bg-zinc-800 rounded-full h-2.5 overflow-hidden border border-zinc-700"><div className="bg-amber-400 h-full transition-all duration-150" style={{ width: `${hudState.feverPercent}%` }} /></div>
        </div>
      </div>

      <canvas ref={canvasRef} className="w-full h-full min-h-0 block" />

      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); triggerRedline(); }}
        disabled={hudState.redlineCharges <= 0 || hudState.redlineActive}
        className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-400/60 text-rose-200 font-mono text-[10px] font-black disabled:opacity-45 pointer-events-auto"
        aria-label="Activate Redline"
      >
        {hudState.redlineActive ? `REDLINE ${hudState.redlinePercent}%` : `REDLINE (${hudState.redlineCharges}) · F/SHIFT`}
      </button>

      <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:bottom-3 sm:left-4 sm:right-4 flex items-center justify-between gap-2 pointer-events-auto z-10">
        <button type="button" onClick={(event) => { event.stopPropagation(); triggerSlide(); }} className="h-12 min-w-0 flex-1 sm:flex-none sm:px-6 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-purple-500/50 text-purple-300 font-black flex items-center justify-center gap-1.5 active:scale-95 shadow-lg cursor-pointer" aria-label="Slide / Duck">
          <ArrowDown className="w-5 h-5" /><span className="font-mono text-xs font-black">SLIDE / DUCK</span>
        </button>
        <button type="button" onClick={(event) => { event.stopPropagation(); triggerJump(); }} className="h-12 min-w-0 flex-1 sm:flex-none sm:px-7 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-black flex items-center justify-center gap-1.5 active:scale-95 shadow-lg shadow-pink-500/30 cursor-pointer" aria-label="Jump / Double Jump">
          <ArrowUp className="w-5 h-5" /><span className="font-mono text-xs font-black">JUMP</span>
        </button>
      </div>
    </div>
  );
};