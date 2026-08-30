import React, { useEffect, useRef, useState } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';

const COLORS = ['#38BDF8', '#EC4899', '#10B981', '#FACC15', '#A855F7'];
const BUBBLE_RADIUS = 16;
const GRID_COLS = 11;
const GRID_ROWS = 13;

interface Bubble {
  color: string;
  isBomb?: boolean;
}

interface FlyingBubble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  isBomb?: boolean;
}

interface FallingBubble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
}

export const BubbleBusterGame: React.FC<GameComponentProps> = ({
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
    shotsUntilDrop: 5,
    combo: 0,
    multiplier: 1,
    nextColor: COLORS[1],
    currentBubbleColor: COLORS[0],
  });

  const gameStateRef = useRef({
    score: 0,
    shotsCount: 0,
    shotsUntilDrop: 5,
    isAlive: true,
    combo: 0,
    multiplier: 1,

    // Cannon
    cannonAngle: -Math.PI / 2,
    currentBubbleColor: COLORS[0],
    nextBubbleColor: COLORS[1],
    flyingBubble: null as FlyingBubble | null,

    // Grid (null = empty)
    grid: Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null)) as (Bubble | null)[][],

    fallingBubbles: [] as FallingBubble[],
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }[],
    popups: [] as { id: number; x: number; y: number; text: string; color: string; life: number }[],
    nextId: 1,
    width: 420,
    height: 500,
  });

  // Calculate hex position
  const getBubbleCenter = (r: number, c: number, boardOffsetX: number, boardOffsetY: number) => {
    const isOddRow = r % 2 === 1;
    const x = boardOffsetX + c * (BUBBLE_RADIUS * 2) + (isOddRow ? BUBBLE_RADIUS : 0) + BUBBLE_RADIUS;
    const y = boardOffsetY + r * (BUBBLE_RADIUS * 1.732) + BUBBLE_RADIUS;
    return { x, y };
  };

  // Shoot Action toward specified angle or current cannon angle
  const shootBubble = (targetAngle?: number) => {
    const state = gameStateRef.current;
    if (state.flyingBubble || !state.isAlive || isPausedRef.current) return;

    const angle = targetAngle !== undefined ? targetAngle : state.cannonAngle;
    state.cannonAngle = angle;

    const speed = 760;
    const cannonX = state.width / 2;
    const cannonY = state.height - 35;

    state.flyingBubble = {
      x: cannonX,
      y: cannonY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: state.currentBubbleColor,
      isBomb: Math.random() < 0.08,
    };

    state.currentBubbleColor = state.nextBubbleColor;
    state.nextBubbleColor = COLORS[Math.floor(Math.random() * COLORS.length)];

    if (soundEnabled) sounds.playBubbleShoot();
  };

  // Aim helper from viewport coordinates
  const updateAimAngle = (clientX: number, clientY: number): number | null => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height - 35;
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    let angle = Math.atan2(my - cy, mx - cx);
    // Clamp to valid upward shooting arc
    if (angle > -0.15) angle = -0.15;
    if (angle < -Math.PI + 0.15) angle = -Math.PI + 0.15;

    gameStateRef.current.cannonAngle = angle;
    return angle;
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = gameStateRef.current;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        state.cannonAngle = Math.max(-Math.PI + 0.2, state.cannonAngle - 0.1);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        state.cannonAngle = Math.min(-0.2, state.cannonAngle + 0.1);
      } else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        shootBubble();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    const angle = updateAimAngle(e.clientX, e.clientY);
    if (angle !== null) {
      shootBubble(angle);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    updateAimAngle(e.clientX, e.clientY);
  };

  const setSafeTimeout = useSafeTimeout();

  // Initialization
  useEffect(() => {
    const state = gameStateRef.current;
    state.score = 0;
    state.shotsCount = 0;
    state.shotsUntilDrop = 5;
    state.combo = 0;
    state.multiplier = 1;
    state.isAlive = true;
    state.flyingBubble = null;
    state.fallingBubbles = [];
    state.particles = [];
    state.popups = [];
    state.currentBubbleColor = COLORS[0];
    state.nextBubbleColor = COLORS[1];

    // Seed initial 5 rows of bubbles
    state.grid = Array.from({ length: GRID_ROWS }, (_, r) =>
      Array.from({ length: GRID_COLS }, () => {
        if (r < 5) {
          return { color: COLORS[Math.floor(Math.random() * COLORS.length)] };
        }
        return null;
      })
    );
  }, []);

  useGameLoop({
    canvasRef,
    isPaused,
    onResize: (w, h) => {
      gameStateRef.current.width = w;
      gameStateRef.current.height = h;
    },
    onUpdate: (ctx, dt, w, h) => {
      const state = gameStateRef.current;
      state.width = w;
      state.height = h;

      ctx.clearRect(0, 0, w, h);

      const boardWidth = GRID_COLS * (BUBBLE_RADIUS * 2);
      const boardOffsetX = (w - boardWidth) / 2;
      const boardOffsetY = 40;
      const cannonX = w / 2;
      const cannonY = h - 35;

      if (!isPausedRef.current && state.isAlive) {
        // Update Flying Bubble
        if (state.flyingBubble) {
          const fb = state.flyingBubble;

          fb.x += fb.vx * dt;
          fb.y += fb.vy * dt;

          // Wall bounce
          if (fb.x - BUBBLE_RADIUS < boardOffsetX) {
            fb.x = boardOffsetX + BUBBLE_RADIUS;
            fb.vx = Math.abs(fb.vx);
            if (soundEnabled) sounds.playBounce();
          } else if (fb.x + BUBBLE_RADIUS > boardOffsetX + boardWidth) {
            fb.x = boardOffsetX + boardWidth - BUBBLE_RADIUS;
            fb.vx = -Math.abs(fb.vx);
            if (soundEnabled) sounds.playBounce();
          }

          // Check snap to grid or ceiling hit
          let snapped = false;
          let snapR = 0;
          let snapC = 0;

          // Ceiling hit
          if (fb.y - BUBBLE_RADIUS <= boardOffsetY) {
            snapR = 0;
            snapC = Math.max(0, Math.min(GRID_COLS - 1, Math.floor((fb.x - boardOffsetX) / (BUBBLE_RADIUS * 2))));
            snapped = true;
          } else {
            // Check collision with existing bubbles
            for (let r = 0; r < GRID_ROWS; r++) {
              for (let c = 0; c < GRID_COLS; c++) {
                if (state.grid[r][c]) {
                  const bc = getBubbleCenter(r, c, boardOffsetX, boardOffsetY);
                  const dist = Math.hypot(fb.x - bc.x, fb.y - bc.y);
                  if (dist < BUBBLE_RADIUS * 1.85) {
                    let closestDist = Infinity;
                    const isOdd = r % 2 === 1;
                    const neighbors = [
                      [r, c - 1],
                      [r, c + 1],
                      [r - 1, isOdd ? c : c - 1],
                      [r - 1, isOdd ? c + 1 : c],
                      [r + 1, isOdd ? c : c - 1],
                      [r + 1, isOdd ? c + 1 : c],
                    ];

                    for (const [nr, nc] of neighbors) {
                      if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS && !state.grid[nr][nc]) {
                        const nbc = getBubbleCenter(nr, nc, boardOffsetX, boardOffsetY);
                        const nd = Math.hypot(fb.x - nbc.x, fb.y - nbc.y);
                        if (nd < closestDist) {
                          closestDist = nd;
                          snapR = nr;
                          snapC = nc;
                          snapped = true;
                        }
                      }
                    }
                  }
                }
              }
            }
          }

          if (snapped && snapR < GRID_ROWS) {
            state.grid[snapR][snapC] = { color: fb.color, isBomb: fb.isBomb };
            const isBomb = fb.isBomb;
            state.flyingBubble = null;
            state.shotsCount++;
            state.shotsUntilDrop--;

            if (isBomb) {
              let poppedCount = 0;
              for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                  const tr = snapR + dr;
                  const tc = snapC + dc;
                  if (tr >= 0 && tr < GRID_ROWS && tc >= 0 && tc < GRID_COLS && state.grid[tr][tc]) {
                    state.grid[tr][tc] = null;
                    poppedCount++;
                  }
                }
              }
              if (soundEnabled) sounds.playExplosion();
              const bombPts = poppedCount * 150;
              state.score += bombPts;
              onScoreUpdate(state.score);
            } else {
              // Match 3 check
              const matched: [number, number][] = [];
              const visited: boolean[][] = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(false));
              const matchColor = fb.color;

              const flood = (r: number, c: number) => {
                if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) return;
                if (visited[r][c] || !state.grid[r][c] || state.grid[r][c]?.color !== matchColor) return;
                visited[r][c] = true;
                matched.push([r, c]);

                const isOdd = r % 2 === 1;
                const adj = [
                  [r, c - 1],
                  [r, c + 1],
                  [r - 1, isOdd ? c : c - 1],
                  [r - 1, isOdd ? c + 1 : c],
                  [r + 1, isOdd ? c : c - 1],
                  [r + 1, isOdd ? c + 1 : c],
                ];

                for (const [ar, ac] of adj) flood(ar, ac);
              };

              flood(snapR, snapC);

              if (matched.length >= 3) {
                matched.forEach(([r, c]) => {
                  state.grid[r][c] = null;
                  const bc = getBubbleCenter(r, c, boardOffsetX, boardOffsetY);
                  for (let i = 0; i < 6; i++) {
                    state.particles.push({
                      x: bc.x,
                      y: bc.y,
                      vx: (Math.random() - 0.5) * 120,
                      vy: (Math.random() - 0.5) * 120,
                      life: 0.3,
                      color: matchColor,
                      size: 3,
                    });
                  }
                });

                state.combo++;
                if (state.combo >= 6) state.multiplier = 3;
                else if (state.combo >= 3) state.multiplier = 2;
                else state.multiplier = 1;

                const pts = matched.length * 100 * state.multiplier;
                state.score += pts;
                onScoreUpdate(state.score);
                if (soundEnabled) sounds.playBubblePop();

                // Drop Floating unanchored bubbles
                const anchored: boolean[][] = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(false));
                const anchorFlood = (r: number, c: number) => {
                  if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) return;
                  if (anchored[r][c] || !state.grid[r][c]) return;
                  anchored[r][c] = true;
                  const isOdd = r % 2 === 1;
                  const adj = [
                    [r, c - 1],
                    [r, c + 1],
                    [r - 1, isOdd ? c : c - 1],
                    [r - 1, isOdd ? c + 1 : c],
                    [r + 1, isOdd ? c : c - 1],
                    [r + 1, isOdd ? c + 1 : c],
                  ];
                  for (const [ar, ac] of adj) anchorFlood(ar, ac);
                };

                for (let c = 0; c < GRID_COLS; c++) {
                  if (state.grid[0][c]) anchorFlood(0, c);
                }

                let dropCount = 0;
                for (let r = 1; r < GRID_ROWS; r++) {
                  for (let c = 0; c < GRID_COLS; c++) {
                    if (state.grid[r][c] && !anchored[r][c]) {
                      const bc = getBubbleCenter(r, c, boardOffsetX, boardOffsetY);
                      state.fallingBubbles.push({
                        x: bc.x,
                        y: bc.y,
                        vx: (Math.random() - 0.5) * 80,
                        vy: Math.random() * 80 + 40,
                        color: state.grid[r][c]!.color,
                        alpha: 1,
                      });
                      state.grid[r][c] = null;
                      dropCount++;
                    }
                  }
                }

                if (dropCount > 0) {
                  const dropPts = dropCount * 250 * state.multiplier;
                  state.score += dropPts;
                  onScoreUpdate(state.score);
                  state.popups.push({
                    id: state.nextId++,
                    x: fb.x,
                    y: fb.y - 15,
                    text: `CASCADE +${dropPts}!`,
                    color: '#FACC15',
                    life: 1.0,
                  });
                }
              } else {
                state.combo = 0;
                state.multiplier = 1;
                if (soundEnabled) sounds.playPop();
              }
            }

            // Ceiling drop check
            if (state.shotsUntilDrop <= 0) {
              state.shotsUntilDrop = 5;
              const newRow = Array.from({ length: GRID_COLS }, () => ({
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
              }));
              state.grid.unshift(newRow);
              state.grid.pop();
            }

            // Game Over Check
            for (let c = 0; c < GRID_COLS; c++) {
              if (state.grid[GRID_ROWS - 2][c]) {
                state.isAlive = false;
                if (soundEnabled) sounds.playExplosion();
                setSafeTimeout(() => onGameOver(state.score), 400);
              }
            }
          }
        }

        // Update Falling Bubbles
        for (let i = state.fallingBubbles.length - 1; i >= 0; i--) {
          const fb = state.fallingBubbles[i];
          fb.vy += 600 * dt;
          fb.x += fb.vx * dt;
          fb.y += fb.vy * dt;
          fb.alpha -= dt * 0.8;
          if (fb.y > h || fb.alpha <= 0) state.fallingBubbles.splice(i, 1);
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
      // LIGHTWEIGHT HIGH-FPS RENDER
      // ==========================================
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, w, h);

      // Trajectory Aiming Laser Line
      if (!state.flyingBubble && state.isAlive) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(cannonX, cannonY);
        ctx.lineTo(cannonX + Math.cos(state.cannonAngle) * 240, cannonY + Math.sin(state.cannonAngle) * 240);
        ctx.stroke();
        ctx.restore();
      }

      // Render Bubble Grid
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const b = state.grid[r][c];
          if (!b) continue;
          const bc = getBubbleCenter(r, c, boardOffsetX, boardOffsetY);

          ctx.fillStyle = b.color;
          ctx.beginPath();
          ctx.arc(bc.x, bc.y, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
          ctx.fill();

          // Highlight shine
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.beginPath();
          ctx.arc(bc.x - 4, bc.y - 4, 3, 0, Math.PI * 2);
          ctx.fill();

          if (b.isBomb) {
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('💣', bc.x, bc.y + 4);
          }
        }
      }

      // Render Flying Bubble
      if (state.flyingBubble) {
        const fb = state.flyingBubble;
        ctx.fillStyle = fb.color;
        ctx.beginPath();
        ctx.arc(fb.x, fb.y, BUBBLE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }

      // Render Falling Bubbles
      for (const fb of state.fallingBubbles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, fb.alpha);
        ctx.fillStyle = fb.color;
        ctx.beginPath();
        ctx.arc(fb.x, fb.y, BUBBLE_RADIUS - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Render Particles
      for (const p of state.particles) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Render Cannon Barrel
      ctx.save();
      ctx.translate(cannonX, cannonY);
      ctx.rotate(state.cannonAngle + Math.PI / 2);
      ctx.fillStyle = '#27272A';
      ctx.strokeStyle = '#52525B';
      ctx.lineWidth = 2;
      ctx.fillRect(-10, -32, 20, 32);
      ctx.strokeRect(-10, -32, 20, 32);
      ctx.restore();

      // Current Loaded Bubble
      ctx.fillStyle = state.currentBubbleColor;
      ctx.beginPath();
      ctx.arc(cannonX, cannonY, BUBBLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Next Bubble indicator on bottom left
      ctx.fillStyle = state.nextBubbleColor;
      ctx.beginPath();
      ctx.arc(cannonX - 45, cannonY + 5, BUBBLE_RADIUS * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#A1A1AA';
      ctx.font = '9px monospace';
      ctx.fillText('NEXT', cannonX - 58, cannonY + 22);

      // Danger Line at bottom
      const dangerY = boardOffsetY + (GRID_ROWS - 2) * (BUBBLE_RADIUS * 1.732);
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(boardOffsetX, dangerY);
      ctx.lineTo(boardOffsetX + boardWidth, dangerY);
      ctx.stroke();

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
          prev.shotsUntilDrop === state.shotsUntilDrop &&
          prev.combo === state.combo &&
          prev.multiplier === state.multiplier &&
          prev.nextColor === state.nextBubbleColor &&
          prev.currentBubbleColor === state.currentBubbleColor
        ) {
          return prev;
        }
        return {
          score: state.score,
          shotsUntilDrop: state.shotsUntilDrop,
          combo: state.combo,
          multiplier: state.multiplier,
          nextColor: state.nextBubbleColor,
          currentBubbleColor: state.currentBubbleColor,
        };
      });

      return state.isAlive;
    },
  });

  return (
    <div
      ref={containerRef}
      id="bubble-buster-container"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      className="relative w-full h-full min-h-0 flex flex-col items-center justify-center bg-[#050508] select-none overflow-hidden touch-none cursor-crosshair"
    >
      {/* Top HUD */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-pink-400 font-mono text-xs font-black backdrop-blur-md">
            DROP IN: {hudState.shotsUntilDrop}
          </div>

          {hudState.multiplier > 1 && (
            <div className="px-2 py-1 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-xs font-black">
              {hudState.multiplier}x MULTIPLIER
            </div>
          )}
        </div>

        {/* Next Orb Indicator */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] backdrop-blur-md">
          <span className="text-[11px] font-mono text-zinc-400 font-bold">NEXT ORB:</span>
          <div
            className="w-4.5 h-4.5 rounded-full border-2 border-white/80 shadow-md"
            style={{
              backgroundColor: hudState.nextColor,
            }}
          />
        </div>
      </div>

      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
