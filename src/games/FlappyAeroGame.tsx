import React, { useEffect, useRef, useCallback } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { Shield } from 'lucide-react';
import { useGameLoop, useSafeTimeout, useRenderPublishedState } from '../hooks/useGameLoop';
import {
  AERO_FLOW_DURATION_SEC,
  AERO_FLOW_MAX_CHARGES,
  AERO_FLOW_SPEED_MULTIPLIER,
  AERO_FLOW_START_CHARGES,
  canTriggerAeroFlow,
  getAeroFlowScore,
  shouldEarnAeroFlow,
} from '../lib/aeroMastery';
import {
  classifyAeroFlightTrace,
  getAeroFlightLine,
  getAeroFlightLineBonus,
  getAeroFlightLineGatePlan,
  isAeroFlightTraceHit,
  type AeroFlightTrace,
} from '../lib/aeroFlightLines';

interface Gate {
  id: number;
  x: number;
  gapY: number;
  gapHeight: number;
  width: number;
  passed: boolean;
  grazed: boolean;
  type: 'standard' | 'moving';
  speedY?: number;
  hasShield?: boolean;
  lineIndex: number;
  lineStep: number;
  lineLabel: string;
  traceY: Record<AeroFlightTrace, number>;
}

interface StarToken {
  id: number;
  x: number;
  y: number;
  collected: boolean;
}

export const FlappyAeroGame: React.FC<GameComponentProps> = ({
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
    gatesCleared: 0,
    hasShield: false,
    grazeCombo: 0,
    multiplier: 1,
    flowCharges: AERO_FLOW_START_CHARGES,
    flowActive: false,
    flightLineLabel: 'RISE LINE',
    flightLineStep: 1,
    flightTrace: null as AeroFlightTrace | null,
    flightLineCompletions: 0,
  });

  const gameStateRef = useRef({
    x: 80,
    y: 200,
    vy: 0,
    angle: 0,
    radius: 12,
    isAlive: true,
    hasShield: false,
    invulnerableTimer: 0,
    grazeCombo: 0,
    multiplier: 1,
    score: 0,
    gatesCleared: 0,
    flowCharges: AERO_FLOW_START_CHARGES,
    flowTimer: 0,
    scrollSpeed: 170,
    distance: 0,
    gates: [] as Gate[],
    stars: [] as StarToken[],
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }[],
    popups: [] as { id: number; x: number; y: number; text: string; color: string; life: number }[],
    nextId: 1,
    width: 420,
    height: 500,
    generatedGateCount: 0,
    flightLineRoute: null as AeroFlightTrace | null,
    flightLineProgress: 0,
    flightLineCompletions: 0,
  });

  const triggerFlap = () => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current) return;
    state.vy = -320;
    state.angle = -0.4;
    if (soundEnabled) sounds.playFlap();
    for (let i = 0; i < 5; i++) {
      state.particles.push({
        x: state.x - 10,
        y: state.y + (Math.random() * 4 - 2),
        vx: -Math.random() * 90 - 40,
        vy: (Math.random() - 0.5) * 40,
        life: 0.25,
        color: '#38BDF8',
        size: Math.random() * 3 + 1.5,
      });
    }
  };

  const triggerFlowBoost = () => {
    const state = gameStateRef.current;
    if (!canTriggerAeroFlow(state.flowCharges, state.flowTimer, state.isAlive) || isPausedRef.current) return;
    state.flowCharges--;
    state.flowTimer = AERO_FLOW_DURATION_SEC;
    if (soundEnabled) sounds.playWarp();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyF' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        event.preventDefault();
        triggerFlowBoost();
      } else if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
        event.preventDefault();
        triggerFlap();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const setSafeTimeout = useSafeTimeout();

  const ensureUpcomingGates = useCallback((w: number, h: number) => {
    const state = gameStateRef.current;
    const bufferTarget = w + 600;
    let rightmost = state.gates.length > 0 ? Math.max(...state.gates.map((gate) => gate.x)) : 260;

    while (rightmost < bufferTarget) {
      const gapSpacing = Math.random() * 40 + 200;
      const nextX = rightmost + gapSpacing;
      const gapHeight = Math.max(90, 130 - state.gatesCleared * 0.8);
      const ordinal = state.generatedGateCount++;
      const lineIndex = Math.floor(ordinal / 3);
      const lineStep = ordinal % 3;
      const plan = getAeroFlightLineGatePlan(lineIndex, lineStep, h, gapHeight);
      const isMoving = Math.random() < 0.3 && state.gatesCleared > 3;
      const hasShield = Math.random() < 0.12 && !state.hasShield;

      state.gates.push({
        id: state.nextId++,
        x: nextX,
        gapY: plan.gapY,
        gapHeight,
        width: 44,
        passed: false,
        grazed: false,
        type: isMoving ? 'moving' : 'standard',
        speedY: isMoving ? (Math.random() * 50 + 35) * (Math.random() < 0.5 ? 1 : -1) : 0,
        hasShield,
        lineIndex,
        lineStep,
        lineLabel: plan.label,
        traceY: { ...plan.traceY },
      });

      if (Math.random() < 0.6) {
        state.stars.push({
          id: state.nextId++,
          x: nextX + 22,
          y: plan.gapY + gapHeight / 2,
          collected: false,
        });
      }
      rightmost = nextX;
    }
  }, []);

  useGameLoop({
    canvasRef,
    isPaused,
    onResize: (w, h) => {
      const state = gameStateRef.current;
      state.width = w;
      state.height = h;
    },
    onUpdate: (ctx, deltaSec, w, h) => {
      const dt = Math.min(deltaSec, 0.05);
      const state = gameStateRef.current;
      state.width = w;
      state.height = h;
      ctx.clearRect(0, 0, w, h);

      if (!isPausedRef.current && state.isAlive) {
        if (state.flowTimer > 0) state.flowTimer = Math.max(0, state.flowTimer - dt);

        const gravity = 820;
        state.vy += gravity * dt;
        state.y += state.vy * dt;
        state.angle = Math.max(-0.55, Math.min(1.0, state.vy / 380));

        const baseScrollSpeed = Math.min(280, 175 + state.gatesCleared * 3.0);
        state.scrollSpeed = baseScrollSpeed * (state.flowTimer > 0 ? AERO_FLOW_SPEED_MULTIPLIER : 1);
        state.distance += state.scrollSpeed * dt;

        if (Math.random() < 0.4) {
          state.particles.push({
            x: state.x - 10,
            y: state.y,
            vx: -state.scrollSpeed * 0.6 + (Math.random() * 16 - 8),
            vy: (Math.random() - 0.5) * 20,
            life: 0.3,
            color: '#38BDF8',
            size: Math.random() * 2.5 + 1,
          });
        }

        ensureUpcomingGates(w, h);

        for (const gate of state.gates) {
          gate.x -= state.scrollSpeed * dt;

          if (gate.type === 'moving' && gate.speedY) {
            const previousGapY = gate.gapY;
            gate.gapY += gate.speedY * dt;
            if (gate.gapY < 45 || gate.gapY + gate.gapHeight > h - 45) {
              gate.speedY *= -1;
              gate.gapY = Math.max(45, Math.min(h - 45 - gate.gapHeight, gate.gapY));
            }
            const deltaY = gate.gapY - previousGapY;
            gate.traceY.HIGH += deltaY;
            gate.traceY.CENTER += deltaY;
            gate.traceY.LOW += deltaY;
          }

          if (!gate.passed && gate.x + gate.width < state.x) {
            gate.passed = true;
            state.gatesCleared++;
            if (!gate.grazed) state.grazeCombo = 0;
            let gatePoints = getAeroFlowScore(100 * state.multiplier, state.flowTimer > 0);

            const candidateTrace = classifyAeroFlightTrace(state.y, gate.traceY);
            const traceHit = isAeroFlightTraceHit(state.y, gate.traceY, candidateTrace, gate.gapHeight);
            if (gate.lineStep === 0) {
              state.flightLineRoute = traceHit ? candidateTrace : null;
              state.flightLineProgress = traceHit ? 1 : 0;
            } else if (
              state.flightLineRoute &&
              traceHit &&
              candidateTrace === state.flightLineRoute &&
              gate.lineStep === state.flightLineProgress
            ) {
              state.flightLineProgress++;
            } else {
              state.flightLineRoute = null;
              state.flightLineProgress = 0;
            }

            if (gate.lineStep === 2) {
              if (state.flightLineRoute && state.flightLineProgress === 3) {
                const lineBonus = getAeroFlightLineBonus(gate.lineIndex, state.flowTimer > 0, state.grazeCombo);
                gatePoints += lineBonus;
                state.flightLineCompletions++;
                state.popups.push({
                  id: state.nextId++,
                  x: state.x + 42,
                  y: state.y - 28,
                  text: `${gate.lineLabel} +${lineBonus}`,
                  color: '#67E8F9',
                  life: 1.0,
                });
                if (soundEnabled) sounds.playSuccess();
              }
              state.flightLineRoute = null;
              state.flightLineProgress = 0;
            }

            state.score += gatePoints;
            onScoreUpdate(state.score);
            if (soundEnabled) sounds.playScore();

            if (state.gatesCleared >= 25) state.multiplier = 4;
            else if (state.gatesCleared >= 15) state.multiplier = 3;
            else if (state.gatesCleared >= 6) state.multiplier = 2;
          }

          const inX = state.x + state.radius > gate.x && state.x - state.radius < gate.x + gate.width;
          if (inX && !gate.grazed) {
            const distTop = Math.abs(state.y - state.radius - gate.gapY);
            const distBottom = Math.abs(state.y + state.radius - (gate.gapY + gate.gapHeight));
            if (distTop < 9 || distBottom < 9) {
              gate.grazed = true;
              state.grazeCombo++;
              if (shouldEarnAeroFlow(state.grazeCombo)) {
                state.flowCharges = Math.min(AERO_FLOW_MAX_CHARGES, state.flowCharges + 1);
              }
              const grazePoints = getAeroFlowScore(50 * state.multiplier, state.flowTimer > 0);
              state.score += grazePoints;
              onScoreUpdate(state.score);
              if (soundEnabled) sounds.playWarp();
              state.popups.push({ id: state.nextId++, x: state.x, y: state.y - 18, text: `GRAZE +${grazePoints}!`, color: '#FACC15', life: 0.7 });
            }
          }

          if (inX && state.invulnerableTimer <= 0) {
            const hitTop = state.y - state.radius < gate.gapY;
            const hitBottom = state.y + state.radius > gate.gapY + gate.gapHeight;
            if (hitTop || hitBottom) {
              if (state.hasShield) {
                state.hasShield = false;
                state.invulnerableTimer = 1.2;
                gate.passed = true;
                state.y = gate.gapY + gate.gapHeight / 2;
                state.vy = 0;
                if (soundEnabled) sounds.playShockwave();
                for (let p = 0; p < 12; p++) {
                  state.particles.push({ x: state.x, y: state.y, vx: (Math.random() - 0.5) * 180, vy: (Math.random() - 0.5) * 180, life: 0.5, color: '#34D399', size: Math.random() * 4 + 2 });
                }
                state.popups.push({ id: state.nextId++, x: state.x, y: state.y - 20, text: 'SHIELD DEFLECT!', color: '#34D399', life: 1.0 });
              } else {
                state.isAlive = false;
                if (soundEnabled) sounds.playExplosion();
                setSafeTimeout(() => onGameOver(state.score), 400);
              }
            }
          }

          if (gate.hasShield) {
            const shieldX = gate.x + gate.width / 2;
            const shieldY = gate.gapY + gate.gapHeight / 2;
            if (Math.hypot(state.x - shieldX, state.y - shieldY) < state.radius + 15) {
              gate.hasShield = false;
              state.hasShield = true;
              if (soundEnabled) sounds.playPowerUp();
              state.popups.push({ id: state.nextId++, x: state.x, y: state.y - 20, text: 'SHIELD ONLINE!', color: '#34D399', life: 0.9 });
            }
          }
        }

        for (const star of state.stars) {
          star.x -= state.scrollSpeed * dt;
          if (!star.collected && Math.hypot(state.x - star.x, state.y - star.y) < state.radius + 12) {
            star.collected = true;
            const starPts = getAeroFlowScore(200 * state.multiplier, state.flowTimer > 0);
            state.score += starPts;
            onScoreUpdate(state.score);
            if (soundEnabled) sounds.playScore();
            for (let i = 0; i < 6; i++) {
              state.particles.push({ x: star.x, y: star.y, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80, life: 0.25, color: '#FACC15', size: 2 });
            }
          }
        }

        if (state.invulnerableTimer > 0) state.invulnerableTimer -= dt;

        if (state.y - state.radius < 0) {
          state.y = state.radius;
          state.vy = 0;
        } else if (state.y + state.radius > h) {
          if (state.hasShield) {
            state.hasShield = false;
            state.invulnerableTimer = 1.2;
            state.vy = -340;
            state.y = h - state.radius - 10;
            if (soundEnabled) sounds.playShockwave();
            state.popups.push({ id: state.nextId++, x: state.x, y: state.y - 20, text: 'SHIELD BOUNCE!', color: '#34D399', life: 0.9 });
          } else if (state.invulnerableTimer > 0) {
            state.y = h - state.radius - 5;
            state.vy = -200;
          } else {
            state.isAlive = false;
            if (soundEnabled) sounds.playExplosion();
            setSafeTimeout(() => onGameOver(state.score), 400);
          }
        }

        state.gates = state.gates.filter((gate) => gate.x > -100);
        state.stars = state.stars.filter((star) => star.x > -50 && !star.collected);

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

      ctx.fillStyle = '#050B14';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
      ctx.lineWidth = 1;
      const gridOffset = -(state.distance * 0.3) % 40;
      for (let x = gridOffset; x < w; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }

      for (const gate of state.gates) {
        const topH = gate.gapY;
        const bottomY = gate.gapY + gate.gapHeight;
        const bottomH = h - bottomY;
        ctx.fillStyle = '#0284C7';
        ctx.fillRect(gate.x, 0, gate.width, topH);
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(gate.x + gate.width - 4, 0, 4, topH);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(gate.x - 2, topH - 8, gate.width + 4, 8);
        ctx.fillStyle = '#0284C7';
        ctx.fillRect(gate.x, bottomY, gate.width, bottomH);
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(gate.x + gate.width - 4, bottomY, 4, bottomH);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(gate.x - 2, bottomY, gate.width + 4, 8);

        const traces: [AeroFlightTrace, string][] = [['HIGH', '#A78BFA'], ['CENTER', '#67E8F9'], ['LOW', '#FACC15']];
        for (const [trace, color] of traces) {
          ctx.strokeStyle = state.flightLineRoute === trace ? color : `${color}88`;
          ctx.lineWidth = state.flightLineRoute === trace ? 3 : 1.5;
          ctx.beginPath();
          ctx.moveTo(gate.x - 18, gate.traceY[trace]);
          ctx.lineTo(gate.x + gate.width + 18, gate.traceY[trace]);
          ctx.stroke();
        }

        if (gate.hasShield) {
          const sx = gate.x + gate.width / 2;
          const sy = gate.gapY + gate.gapHeight / 2;
          ctx.strokeStyle = '#34D399';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(sx, sy, 11, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = 'rgba(52, 211, 153, 0.3)'; ctx.fill();
        }
      }

      for (const star of state.stars) {
        if (star.collected) continue;
        ctx.fillStyle = '#FACC15';
        ctx.beginPath(); ctx.arc(star.x, star.y, 5, 0, Math.PI * 2); ctx.fill();
      }
      for (const particle of state.particles) {
        ctx.fillStyle = particle.color;
        ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); ctx.fill();
      }

      if (state.isAlive) {
        ctx.save();
        ctx.translate(state.x, state.y);
        ctx.rotate(state.angle);
        if (state.invulnerableTimer > 0) ctx.globalAlpha = Math.sin(performance.now() * 0.04) > 0 ? 0.4 : 0.9;
        if (state.hasShield) {
          ctx.strokeStyle = '#34D399'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, state.radius + 6, 0, Math.PI * 2); ctx.stroke();
        } else if (state.invulnerableTimer > 0) {
          ctx.strokeStyle = '#FACC15'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, state.radius + 5, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, -8); ctx.lineTo(-5, 0); ctx.lineTo(-10, 8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.ellipse(2, 0, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#F43F5E'; ctx.beginPath(); ctx.moveTo(-5, -2.5); ctx.lineTo(-14 - Math.random() * 4, 0); ctx.lineTo(-5, 2.5); ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      for (const popup of state.popups) {
        ctx.fillStyle = popup.color; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.fillText(popup.text, popup.x, popup.y);
      }

      const nextGate = state.gates.find((gate) => !gate.passed);
      const nextLine = nextGate ? getAeroFlightLine(nextGate.lineIndex) : getAeroFlightLine(0);
      setHudState((previous) => {
        const next = {
          score: state.score,
          gatesCleared: state.gatesCleared,
          hasShield: state.hasShield,
          grazeCombo: state.grazeCombo,
          multiplier: state.multiplier,
          flowCharges: state.flowCharges,
          flowActive: state.flowTimer > 0,
          flightLineLabel: nextLine.label,
          flightLineStep: nextGate ? nextGate.lineStep + 1 : 1,
          flightTrace: state.flightLineRoute,
          flightLineCompletions: state.flightLineCompletions,
        };
        if (Object.entries(next).every(([key, value]) => previous[key as keyof typeof previous] === value)) return previous;
        return next;
      });

      return state.isAlive;
    },
  });

  return (
    <div
      ref={containerRef}
      id="flappy-aero-container"
      onPointerDown={triggerFlap}
      className="relative w-full h-full min-h-0 flex flex-col items-center justify-center bg-[#050B14] select-none overflow-hidden touch-none cursor-pointer"
    >
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between z-10 pointer-events-none gap-2 flex-wrap">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-sky-400 font-mono text-xs font-black backdrop-blur-md">GATES: {hudState.gatesCleared}</div>
            {hudState.multiplier > 1 && <div className="px-2 py-1 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-xs font-black">{hudState.multiplier}x MULTIPLIER</div>}
            {hudState.hasShield && <div className="px-2 py-1 rounded-xl bg-emerald-500/25 border border-emerald-500 text-emerald-300 font-mono text-xs font-bold flex items-center gap-1"><Shield className="w-3.5 h-3.5" /><span>SHIELD</span></div>}
          </div>
          <div data-p23-transform="FLIGHT LINE" className="px-2.5 py-1 rounded-xl bg-cyan-500/10 border border-cyan-400/25 text-cyan-200 font-mono text-[10px] font-black w-fit">
            FLIGHT LINE — {hudState.flightLineLabel} • {hudState.flightLineStep}/3{hudState.flightTrace ? ` • ${hudState.flightTrace}` : ''}
          </div>
        </div>

        {hudState.grazeCombo > 0 && <div className="px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-xs font-bold">GRAZE: {hudState.grazeCombo}</div>}
      </div>

      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={triggerFlowBoost}
        disabled={hudState.flowCharges <= 0 || hudState.flowActive}
        className="absolute bottom-3 right-3 z-20 pointer-events-auto rounded-xl border border-sky-400/40 bg-[#18181B]/90 px-3 py-2 font-mono text-[10px] font-black text-sky-300 disabled:opacity-40"
      >
        {hudState.flowActive ? 'FLOW BOOST ACTIVE' : `FLOW BOOST ${hudState.flowCharges}/2`}
      </button>

      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
