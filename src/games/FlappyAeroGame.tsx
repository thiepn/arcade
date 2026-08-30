import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { Shield } from 'lucide-react';
import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';

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

  const [hudState, setHudState] = useState({
    score: 0,
    gatesCleared: 0,
    hasShield: false,
    grazeCombo: 0,
    multiplier: 1,
  });

  const gameStateRef = useRef({
    // Player Drone
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

    scrollSpeed: 170,
    distance: 0,

    gates: [] as Gate[],
    stars: [] as StarToken[],
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }[],
    popups: [] as { id: number; x: number; y: number; text: string; color: string; life: number }[],

    nextId: 1,
    width: 420,
    height: 500,
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
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
    let rightmost = state.gates.length > 0 
      ? Math.max(...state.gates.map((g) => g.x))
      : 260;

    while (rightmost < bufferTarget) {
      const gapSpacing = Math.random() * 40 + 200;
      const nextX = rightmost + gapSpacing;
      const gapHeight = Math.max(90, 130 - state.gatesCleared * 0.8);
      const margin = 60;
      const gapY = Math.random() * (h - gapHeight - margin * 2) + margin;

      const isMoving = Math.random() < 0.3 && state.gatesCleared > 3;
      const hasShield = Math.random() < 0.12 && !state.hasShield;

      state.gates.push({
        id: state.nextId++,
        x: nextX,
        gapY,
        gapHeight,
        width: 44,
        passed: false,
        grazed: false,
        type: isMoving ? 'moving' : 'standard',
        speedY: isMoving ? (Math.random() * 50 + 35) * (Math.random() < 0.5 ? 1 : -1) : 0,
        hasShield,
      });

      // Seed collectible star
      if (Math.random() < 0.6) {
        state.stars.push({
          id: state.nextId++,
          x: nextX + 22,
          y: gapY + gapHeight / 2,
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
        // Physics update
        const gravity = 820;
        state.vy += gravity * dt;
        state.y += state.vy * dt;

        // Angle tilt
        state.angle = Math.max(-0.55, Math.min(1.0, state.vy / 380));

        // Speed ramp
        state.scrollSpeed = Math.min(280, 175 + state.gatesCleared * 3.0);
        state.distance += state.scrollSpeed * dt;

        // Thruster particles
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

        // Infinite procedural generation
        ensureUpcomingGates(w, h);

        // Update & Check Gates
        for (const gate of state.gates) {
          gate.x -= state.scrollSpeed * dt;

          if (gate.type === 'moving' && gate.speedY) {
            gate.gapY += gate.speedY * dt;
            if (gate.gapY < 45 || gate.gapY + gate.gapHeight > h - 45) {
              gate.speedY *= -1;
            }
          }

          // Gate Cleared
          if (!gate.passed && gate.x + gate.width < state.x) {
            gate.passed = true;
            state.gatesCleared++;
            const gatePoints = 100 * state.multiplier;
            state.score += gatePoints;
            onScoreUpdate(state.score);
            if (soundEnabled) sounds.playScore();

            if (state.gatesCleared >= 25) state.multiplier = 4;
            else if (state.gatesCleared >= 15) state.multiplier = 3;
            else if (state.gatesCleared >= 6) state.multiplier = 2;
          }

          // Graze Check (close pass reward)
          const inX = state.x + state.radius > gate.x && state.x - state.radius < gate.x + gate.width;
          if (inX && !gate.grazed) {
            const distTop = Math.abs(state.y - state.radius - gate.gapY);
            const distBottom = Math.abs(state.y + state.radius - (gate.gapY + gate.gapHeight));

            if (distTop < 9 || distBottom < 9) {
              gate.grazed = true;
              state.grazeCombo++;
              const grazePoints = 50 * state.multiplier;
              state.score += grazePoints;
              onScoreUpdate(state.score);
              if (soundEnabled) sounds.playWarp();

              state.popups.push({
                id: state.nextId++,
                x: state.x,
                y: state.y - 18,
                text: `GRAZE +${grazePoints}!`,
                color: '#FACC15',
                life: 0.7,
              });
            }
          }

          // Collision Check
          if (inX && state.invulnerableTimer <= 0) {
            const hitTop = state.y - state.radius < gate.gapY;
            const hitBottom = state.y + state.radius > gate.gapY + gate.gapHeight;

            if (hitTop || hitBottom) {
              if (state.hasShield) {
                state.hasShield = false;
                state.invulnerableTimer = 1.2; // 1.2s invulnerability grace
                gate.passed = true;
                // Safely center craft into the gap
                state.y = gate.gapY + gate.gapHeight / 2;
                state.vy = 0;
                if (soundEnabled) sounds.playShockwave();

                // Shield burst particles
                for (let p = 0; p < 12; p++) {
                  state.particles.push({
                    x: state.x,
                    y: state.y,
                    vx: (Math.random() - 0.5) * 180,
                    vy: (Math.random() - 0.5) * 180,
                    life: 0.5,
                    color: '#34D399',
                    size: Math.random() * 4 + 2,
                  });
                }

                state.popups.push({
                  id: state.nextId++,
                  x: state.x,
                  y: state.y - 20,
                  text: 'SHIELD DEFLECT!',
                  color: '#34D399',
                  life: 1.0,
                });
              } else {
                state.isAlive = false;
                if (soundEnabled) sounds.playExplosion();
                setSafeTimeout(() => onGameOver(state.score), 400);
              }
            }
          }

          // Collect Shield
          if (gate.hasShield) {
            const shieldX = gate.x + gate.width / 2;
            const shieldY = gate.gapY + gate.gapHeight / 2;
            if (Math.hypot(state.x - shieldX, state.y - shieldY) < state.radius + 15) {
              gate.hasShield = false;
              state.hasShield = true;
              if (soundEnabled) sounds.playPowerUp();
              state.popups.push({
                id: state.nextId++,
                x: state.x,
                y: state.y - 20,
                text: 'SHIELD ONLINE!',
                color: '#34D399',
                life: 0.9,
              });
            }
          }
        }

        // Stars collection
        for (const star of state.stars) {
          star.x -= state.scrollSpeed * dt;
          if (!star.collected && Math.hypot(state.x - star.x, state.y - star.y) < state.radius + 12) {
            star.collected = true;
            const starPts = 200 * state.multiplier;
            state.score += starPts;
            onScoreUpdate(state.score);
            if (soundEnabled) sounds.playScore();

            for (let i = 0; i < 6; i++) {
              state.particles.push({
                x: star.x,
                y: star.y,
                vx: (Math.random() - 0.5) * 80,
                vy: (Math.random() - 0.5) * 80,
                life: 0.25,
                color: '#FACC15',
                size: 2,
              });
            }
          }
        }

        // Invulnerability decay
        if (state.invulnerableTimer > 0) {
          state.invulnerableTimer -= dt;
        }

        // Floor / ceiling bounds
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
            state.popups.push({
              id: state.nextId++,
              x: state.x,
              y: state.y - 20,
              text: 'SHIELD BOUNCE!',
              color: '#34D399',
              life: 0.9,
            });
          } else if (state.invulnerableTimer > 0) {
            state.y = h - state.radius - 5;
            state.vy = -200;
          } else {
            state.isAlive = false;
            if (soundEnabled) sounds.playExplosion();
            setSafeTimeout(() => onGameOver(state.score), 400);
          }
        }

        // Cleanup offscreen gates & stars
        state.gates = state.gates.filter((g) => g.x > -100);
        state.stars = state.stars.filter((s) => s.x > -50 && !s.collected);

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
          pop.y -= 25 * dt;
          pop.life -= dt;
          if (pop.life <= 0) state.popups.splice(i, 1);
        }
      }

      // ==========================================
      // LIGHTWEIGHT HIGH-FPS RENDER
      // ==========================================
      ctx.fillStyle = '#050B14';
      ctx.fillRect(0, 0, w, h);

      // Gridlines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
      ctx.lineWidth = 1;
      const gridOffset = -(state.distance * 0.3) % 40;
      for (let x = gridOffset; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Render Gates (Neon Laser Columns)
      for (const gate of state.gates) {
        const topH = gate.gapY;
        const bottomY = gate.gapY + gate.gapHeight;
        const bottomH = h - bottomY;

        // Top Column
        ctx.fillStyle = '#0284C7';
        ctx.fillRect(gate.x, 0, gate.width, topH);
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(gate.x + gate.width - 4, 0, 4, topH);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(gate.x - 2, topH - 8, gate.width + 4, 8);

        // Bottom Column
        ctx.fillStyle = '#0284C7';
        ctx.fillRect(gate.x, bottomY, gate.width, bottomH);
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(gate.x + gate.width - 4, bottomY, 4, bottomH);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(gate.x - 2, bottomY, gate.width + 4, 8);

        // Shield item
        if (gate.hasShield) {
          const sx = gate.x + gate.width / 2;
          const sy = gate.gapY + gate.gapHeight / 2;
          ctx.strokeStyle = '#34D399';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sx, sy, 11, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = 'rgba(52, 211, 153, 0.3)';
          ctx.fill();
        }
      }

      // Render Stars
      for (const star of state.stars) {
        if (star.collected) continue;
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(star.x, star.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Render Particles
      for (const p of state.particles) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Render Player Craft
      if (state.isAlive) {
        ctx.save();
        ctx.translate(state.x, state.y);
        ctx.rotate(state.angle);

        // Invulnerability flashing
        if (state.invulnerableTimer > 0) {
          const flash = Math.sin(performance.now() * 0.04) > 0;
          ctx.globalAlpha = flash ? 0.4 : 0.9;
        }

        // Shield Aura
        if (state.hasShield) {
          ctx.strokeStyle = '#34D399';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, state.radius + 6, 0, Math.PI * 2);
          ctx.stroke();
        } else if (state.invulnerableTimer > 0) {
          ctx.strokeStyle = '#FACC15';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, state.radius + 5, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Craft Body
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-10, -8);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-10, 8);
        ctx.closePath();
        ctx.fill();

        // Cockpit
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(2, 0, 4, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Flame
        ctx.fillStyle = '#F43F5E';
        ctx.beginPath();
        ctx.moveTo(-5, -2.5);
        ctx.lineTo(-14 - Math.random() * 4, 0);
        ctx.lineTo(-5, 2.5);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      // Render Popups
      for (const pop of state.popups) {
        ctx.fillStyle = pop.color;
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pop.text, pop.x, pop.y);
      }

      // Sync HUD
      setHudState((prev) => {
        if (
          prev.score === state.score &&
          prev.gatesCleared === state.gatesCleared &&
          prev.hasShield === state.hasShield &&
          prev.grazeCombo === state.grazeCombo &&
          prev.multiplier === state.multiplier
        ) {
          return prev;
        }
        return {
          score: state.score,
          gatesCleared: state.gatesCleared,
          hasShield: state.hasShield,
          grazeCombo: state.grazeCombo,
          multiplier: state.multiplier,
        };
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
      {/* HUD Bar */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-sky-400 font-mono text-xs font-black backdrop-blur-md">
            GATES: {hudState.gatesCleared}
          </div>

          {hudState.multiplier > 1 && (
            <div className="px-2 py-1 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-xs font-black">
              {hudState.multiplier}x MULTIPLIER
            </div>
          )}

          {hudState.hasShield && (
            <div className="px-2 py-1 rounded-xl bg-emerald-500/25 border border-emerald-500 text-emerald-300 font-mono text-xs font-bold flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" />
              <span>SHIELD</span>
            </div>
          )}
        </div>

        {hudState.grazeCombo > 0 && (
          <div className="px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-xs font-bold">
            GRAZE: {hudState.grazeCombo}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
