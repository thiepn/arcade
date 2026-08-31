import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { RotateCcw, Award, Compass, Shuffle, Sparkles } from 'lucide-react';
import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';
import {
  getOneLineInkBudget,
  getOneLinePhysicsStepBatch,
  remapOneLinePoint,
} from '../lib/oneLineRuntime';

interface Point {
  x: number;
  y: number;
}

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'wall' | 'bouncer';
}

interface StarItem {
  x: number;
  y: number;
  radius: number;
  collected: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export const OneLineGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const isDrawingRef = useRef(false);

  const [level, setLevel] = useState(1);
  const [starsCount, setStarsCount] = useState(0);
  const [physicsRunning, setPhysicsRunning] = useState(false);
  const [inkPercent, setInkPercent] = useState(100);


  const gameStateRef = useRef({
    ball: { x: 50, y: 50, vx: 0, vy: 0, radius: 9 },
    startPos: { x: 50, y: 50 },
    target: { x: 280, y: 280, radius: 24 },
    linePoints: [] as Point[],
    obstacles: [] as Obstacle[],
    stars: [] as StarItem[],
    particles: [] as Particle[],
    physicsRunning: false,
    level: 1,
    score: 0,
    attempts: 0,
    shake: 0,
    lastHitSoundTime: 0,
    lastBounceSoundTime: 0,
    stuckTimer: 0,
    lastPos: { x: 0, y: 0 },
    physicsAccumulator: 0,
    viewportWidth: 0,
    viewportHeight: 0,
  });

  // Procedural dynamic level generation that produces endless, varied puzzles
  const generateLevel = useCallback((lvl: number, w: number, h: number) => {
    const state = gameStateRef.current;
    state.linePoints = [];
    state.particles = [];
    state.physicsRunning = false;
    state.physicsAccumulator = 0;
    state.viewportWidth = w;
    state.viewportHeight = h;
    state.stuckTimer = 0;
    isDrawingRef.current = false;
    setPhysicsRunning(false);
    setStarsCount(0);
    setInkPercent(100);
    setLevel(lvl);

    const obs: Obstacle[] = [];
    const stars: StarItem[] = [];

    // Choose from 10 procedural level archetypes
    const archetype = (lvl + Math.floor(Math.random() * 10)) % 10;

    const startXRatio = 0.12 + Math.random() * 0.1;
    const startYRatio = 0.14 + Math.random() * 0.1;
    const targetXRatio = 0.78 + Math.random() * 0.1;
    const targetYRatio = 0.74 + Math.random() * 0.12;

    state.startPos = { x: w * startXRatio, y: h * startYRatio };
    state.ball = { x: state.startPos.x, y: state.startPos.y, vx: 0, vy: 0, radius: 9 };
    state.lastPos = { x: state.startPos.x, y: state.startPos.y };
    state.target = { x: w * targetXRatio, y: h * targetYRatio, radius: 25 };

    if (archetype === 0) {
      // Staggered Pillars Slalom
      obs.push(
        { x: w * 0.38, y: h * 0.12, w: 22, h: h * 0.45, type: 'wall' },
        { x: w * 0.62, y: h * 0.45, w: 22, h: h * 0.45, type: 'wall' }
      );
      stars.push(
        { x: w * 0.38, y: h * 0.72, radius: 8, collected: false },
        { x: w * 0.5, y: h * 0.45, radius: 8, collected: false },
        { x: w * 0.62, y: h * 0.28, radius: 8, collected: false }
      );
    } else if (archetype === 1) {
      // Pinball Bouncer Canyon
      obs.push(
        { x: w * 0.32, y: h * 0.48, w: 24, h: h * 0.3, type: 'bouncer' },
        { x: w * 0.65, y: h * 0.24, w: 24, h: h * 0.3, type: 'bouncer' }
      );
      stars.push(
        { x: w * 0.48, y: h * 0.35, radius: 8, collected: false },
        { x: w * 0.28, y: h * 0.72, radius: 8, collected: false },
        { x: w * 0.72, y: h * 0.62, radius: 8, collected: false }
      );
    } else if (archetype === 2) {
      // Central Barrier with Funnel Gap
      obs.push(
        { x: w * 0.2, y: h * 0.46, w: w * 0.24, h: 18, type: 'wall' },
        { x: w * 0.56, y: h * 0.46, w: w * 0.24, h: 18, type: 'bouncer' }
      );
      stars.push(
        { x: w * 0.48, y: h * 0.46, radius: 8, collected: false },
        { x: w * 0.32, y: h * 0.26, radius: 8, collected: false },
        { x: w * 0.72, y: h * 0.32, radius: 8, collected: false }
      );
    } else if (archetype === 3) {
      // The Ski Jump / Void Chasm
      obs.push(
        { x: w * 0.42, y: h * 0.35, w: 22, h: h * 0.48, type: 'wall' },
        { x: w * 0.7, y: h * 0.62, w: 24, h: h * 0.22, type: 'bouncer' }
      );
      stars.push(
        { x: w * 0.28, y: h * 0.42, radius: 8, collected: false },
        { x: w * 0.42, y: h * 0.2, radius: 8, collected: false },
        { x: w * 0.58, y: h * 0.55, radius: 8, collected: false }
      );
    } else if (archetype === 4) {
      // The Pachinko Bounce Field
      obs.push(
        { x: w * 0.3, y: h * 0.32, w: 24, h: 24, type: 'bouncer' },
        { x: w * 0.52, y: h * 0.5, w: 24, h: 24, type: 'bouncer' },
        { x: w * 0.72, y: h * 0.32, w: 24, h: 24, type: 'bouncer' }
      );
      stars.push(
        { x: w * 0.42, y: h * 0.35, radius: 8, collected: false },
        { x: w * 0.62, y: h * 0.52, radius: 8, collected: false },
        { x: w * 0.52, y: h * 0.74, radius: 8, collected: false }
      );
    } else if (archetype === 5) {
      // Double Shelf Maze
      obs.push(
        { x: w * 0.18, y: h * 0.36, w: w * 0.34, h: 18, type: 'wall' },
        { x: w * 0.48, y: h * 0.6, w: w * 0.34, h: 18, type: 'wall' }
      );
      stars.push(
        { x: w * 0.42, y: h * 0.25, radius: 8, collected: false },
        { x: w * 0.32, y: h * 0.52, radius: 8, collected: false },
        { x: w * 0.65, y: h * 0.52, radius: 8, collected: false }
      );
    } else if (archetype === 6) {
      // High-Altitude Drop & Bounce Ramp
      obs.push(
        { x: w * 0.25, y: h * 0.56, w: w * 0.25, h: 20, type: 'bouncer' },
        { x: w * 0.6, y: h * 0.35, w: 22, h: h * 0.4, type: 'wall' }
      );
      stars.push(
        { x: w * 0.35, y: h * 0.38, radius: 8, collected: false },
        { x: w * 0.5, y: h * 0.22, radius: 8, collected: false },
        { x: w * 0.72, y: h * 0.55, radius: 8, collected: false }
      );
    } else {
      // Diagonal Stairway
      obs.push(
        { x: w * 0.25, y: h * 0.32, w: 24, h: 24, type: 'bouncer' },
        { x: w * 0.45, y: h * 0.48, w: 24, h: 24, type: 'wall' },
        { x: w * 0.65, y: h * 0.64, w: 24, h: 24, type: 'bouncer' }
      );
      stars.push(
        { x: w * 0.35, y: h * 0.22, radius: 8, collected: false },
        { x: w * 0.55, y: h * 0.38, radius: 8, collected: false },
        { x: w * 0.75, y: h * 0.52, radius: 8, collected: false }
      );
    }

    state.obstacles = obs;
    state.stars = stars;
  }, []);

  const resetCurrentAttempt = useCallback(() => {
    const state = gameStateRef.current;
    state.linePoints = [];
    state.particles = [];
    state.physicsRunning = false;
    state.physicsAccumulator = 0;
    state.stuckTimer = 0;
    state.ball = { x: state.startPos.x, y: state.startPos.y, vx: 0, vy: 0, radius: 9 };
    state.lastPos = { x: state.startPos.x, y: state.startPos.y };
    state.stars.forEach((star) => {
      star.collected = false;
    });
    isDrawingRef.current = false;
    setPhysicsRunning(false);
    setStarsCount(0);
    setInkPercent(100);
  }, []);

  const handleResetLevel = () => {
    if (soundEnabled) sounds.playClick();
    resetCurrentAttempt();
  };

  const handleRandomNewLevel = () => {
    const state = gameStateRef.current;
    const w = state.viewportWidth;
    const h = state.viewportHeight;
    if (w <= 0 || h <= 0) return;
    if (soundEnabled) sounds.playClick();
    generateLevel(state.level, w, h);
  };

  const launchBall = () => {
    const state = gameStateRef.current;
    if (state.physicsRunning || state.linePoints.length < 2) return;
    state.physicsRunning = true;
    setPhysicsRunning(true);
    if (soundEnabled) sounds.playPop();
  };

  const calculateTotalLength = (pts: Point[]): number => {
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    return len;
  };

  const setSafeTimeout = useSafeTimeout();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getPos = (e: MouseEvent | TouchEvent): Point => {
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (gameStateRef.current.physicsRunning || isPausedRef.current) return;
      if ('touches' in e) e.preventDefault();
      isDrawingRef.current = true;
      const pt = getPos(e);
      gameStateRef.current.linePoints = [pt];
      setInkPercent(100);
      if (soundEnabled) sounds.playTone(520, 0.03, 'sine');
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDrawingRef.current || gameStateRef.current.physicsRunning) return;
      if ('touches' in e) e.preventDefault();
      const pt = getPos(e);
      const pts = gameStateRef.current.linePoints;
      const last = pts[pts.length - 1];

      // Smooth 10px decimation prevents hundreds of redundant vertices, giving 60fps locked performance
      if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= 10) {
        const curLen = calculateTotalLength(pts);
        const rect = canvas.getBoundingClientRect();
        const maxInkLength = getOneLineInkBudget(rect.width, rect.height);
        if (curLen < maxInkLength) {
          const segmentLength = last ? Math.hypot(pt.x - last.x, pt.y - last.y) : 0;
          if (curLen + segmentLength <= maxInkLength) {
            pts.push(pt);
          }
          const usedLength = Math.min(maxInkLength, curLen + segmentLength);
          const remaining = Math.max(0, Math.round(((maxInkLength - usedLength) / maxInkLength) * 100));
          setInkPercent(remaining);
        }
      }
    };

    const handlePointerUp = () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      const pts = gameStateRef.current.linePoints;
      if (pts.length >= 2) {
        launchBall();
      }
    };

    canvas.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      canvas.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      canvas.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [soundEnabled]);

  useGameLoop({
    canvasRef,
    isPaused,
    onResize: (w, h) => {
      const state = gameStateRef.current;
      const oldW = state.viewportWidth;
      const oldH = state.viewportHeight;
      if (oldW <= 0 || oldH <= 0 || state.obstacles.length === 0) {
        generateLevel(state.level, w, h);
        return;
      }
      if (Math.abs(oldW - w) < 0.5 && Math.abs(oldH - h) < 0.5) return;

      const sx = w / oldW;
      const sy = h / oldH;
      state.startPos = remapOneLinePoint(state.startPos, oldW, oldH, w, h);
      state.target = {
        ...remapOneLinePoint(state.target, oldW, oldH, w, h),
        radius: state.target.radius,
      };
      state.ball.x *= sx;
      state.ball.y *= sy;
      state.ball.vx *= sx;
      state.ball.vy *= sy;
      state.lastPos = remapOneLinePoint(state.lastPos, oldW, oldH, w, h);
      state.linePoints = state.linePoints.map((point) => remapOneLinePoint(point, oldW, oldH, w, h));
      state.obstacles = state.obstacles.map((obstacle) => ({
        ...obstacle,
        x: obstacle.x * sx,
        y: obstacle.y * sy,
        w: obstacle.w * sx,
        h: obstacle.h * sy,
      }));
      state.stars = state.stars.map((star) => ({
        ...star,
        x: star.x * sx,
        y: star.y * sy,
      }));
      state.particles.forEach((particle) => {
        particle.x *= sx;
        particle.y *= sy;
        particle.vx *= sx;
        particle.vy *= sy;
      });
      state.viewportWidth = w;
      state.viewportHeight = h;

      const maxInkLength = getOneLineInkBudget(w, h);
      const usedInk = calculateTotalLength(state.linePoints);
      setInkPercent(Math.max(0, Math.round(((maxInkLength - usedInk) / maxInkLength) * 100)));
    },
    onUpdate: (ctx, dt, curW, curH) => {
      const state = gameStateRef.current;
      const now = performance.now();

      ctx.save();

      if (state.shake > 0) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
        state.shake *= Math.pow(0.88, Math.max(0.001, Math.min(dt, 0.05) * 60));
        if (state.shake < 0.2) state.shake = 0;
      }

      ctx.clearRect(-20, -20, curW + 40, curH + 40);

      if (!isPausedRef.current && state.physicsRunning) {
        const batch = getOneLinePhysicsStepBatch(state.physicsAccumulator, dt);
        state.physicsAccumulator = batch.remainderSec;
        const ballR = state.ball.radius;
        const minAllowedDist = ballR + 2.5;

        for (let step = 0; step < batch.steps; step++) {
          // 240 Hz fixed step = the original four 60 Hz substeps, independent of display refresh rate.
          state.ball.vy += 0.28 / 4;
          state.ball.vx *= 0.9985;
          state.ball.vy *= 0.9985;

          state.ball.x += state.ball.vx / 4;
          state.ball.y += state.ball.vy / 4;

          // Highly optimized line collision with broadphase AABB culling
          const pts = state.linePoints;
          const bx = state.ball.x;
          const by = state.ball.y;

          for (let i = 0; i < pts.length - 1; i++) {
            const p1 = pts[i];
            const p2 = pts[i + 1];

            // Fast bounding box check (skips distant segments without Math.hypot)
            const minX = Math.min(p1.x, p2.x) - 20;
            const maxX = Math.max(p1.x, p2.x) + 20;
            if (bx < minX || bx > maxX) continue;

            const minY = Math.min(p1.y, p2.y) - 20;
            const maxY = Math.max(p1.y, p2.y) + 20;
            if (by < minY || by > maxY) continue;

            const lineDx = p2.x - p1.x;
            const lineDy = p2.y - p1.y;
            const lineLenSq = lineDx * lineDx + lineDy * lineDy;
            if (lineLenSq < 1) continue;

            const t = Math.max(0, Math.min(1, ((bx - p1.x) * lineDx + (by - p1.y) * lineDy) / lineLenSq));
            const closeX = p1.x + t * lineDx;
            const closeY = p1.y + t * lineDy;

            const distDx = bx - closeX;
            const distDy = by - closeY;
            const distSq = distDx * distDx + distDy * distDy;

            if (distSq < minAllowedDist * minAllowedDist) {
              const dist = Math.sqrt(distSq) || 0.001;
              const nx = distDx / dist;
              const ny = distDy / dist;

              state.ball.x = closeX + nx * (minAllowedDist + 0.1);
              state.ball.y = closeY + ny * (minAllowedDist + 0.1);

              const dot = state.ball.vx * nx + state.ball.vy * ny;
              if (dot < 0) {
                const rest = 0.58;
                state.ball.vx = (state.ball.vx - (1 + rest) * dot * nx) * 0.98;
                state.ball.vy = (state.ball.vy - (1 + rest) * dot * ny) * 0.98;

                if (now - state.lastHitSoundTime > 120) {
                  state.lastHitSoundTime = now;
                  if (soundEnabled) sounds.playTone(380, 0.02, 'sine');
                }
              }
            }
          }

          // Obstacle collisions
          state.obstacles.forEach((obs) => {
            const closeX = Math.max(obs.x, Math.min(state.ball.x, obs.x + obs.w));
            const closeY = Math.max(obs.y, Math.min(state.ball.y, obs.y + obs.h));
            const cdx = state.ball.x - closeX;
            const cdy = state.ball.y - closeY;
            const cdistSq = cdx * cdx + cdy * cdy;

            if (cdistSq < ballR * ballR && cdistSq > 0.0001) {
              const cdist = Math.sqrt(cdistSq);
              const nx = cdx / cdist;
              const ny = cdy / cdist;
              state.ball.x = closeX + nx * (ballR + 0.1);
              state.ball.y = closeY + ny * (ballR + 0.1);

              const dot = state.ball.vx * nx + state.ball.vy * ny;
              if (dot < 0) {
                const isBouncer = obs.type === 'bouncer';
                const rest = isBouncer ? 1.45 : 0.65;
                state.ball.vx -= (1 + rest) * dot * nx;
                state.ball.vy -= (1 + rest) * dot * ny;

                if (isBouncer) {
                  state.shake = 5;
                  if (now - state.lastBounceSoundTime > 100) {
                    state.lastBounceSoundTime = now;
                    if (soundEnabled) sounds.playTone(850, 0.05, 'triangle');
                  }
                } else if (now - state.lastHitSoundTime > 100) {
                  state.lastHitSoundTime = now;
                  if (soundEnabled) sounds.playTone(280, 0.03, 'square');
                }
              }
            }
          });
        }

        // Stuck detection
        const travelDist = Math.hypot(
          state.ball.x - state.lastPos.x,
          state.ball.y - state.lastPos.y
        );
        state.lastPos = { x: state.ball.x, y: state.ball.y };

        const frameScale = Math.max(0.001, Math.min(dt, 0.05) * 60);
        if (travelDist / frameScale < 0.6) {
          state.stuckTimer += Math.min(dt, 0.05);
          if (state.stuckTimer > 2) {
            state.physicsRunning = false;
            setPhysicsRunning(false);
            setSafeTimeout(resetCurrentAttempt, 300);
          }
        } else {
          state.stuckTimer = 0;
        }

        // Star pickups
        state.stars.forEach((s) => {
          if (!s.collected) {
            const dist = Math.hypot(s.x - state.ball.x, s.y - state.ball.y);
            if (dist < s.radius + state.ball.radius) {
              s.collected = true;
              state.score += 300;
              onScoreUpdate(state.score);
              setStarsCount((prev) => prev + 1);
              if (soundEnabled) sounds.playScore();

              for (let k = 0; k < 8; k++) {
                state.particles.push({
                  x: s.x,
                  y: s.y,
                  vx: (Math.random() - 0.5) * 4,
                  vy: (Math.random() - 0.5) * 4,
                  color: '#FACC15',
                  size: 3,
                  life: 0,
                  maxLife: 18,
                });
              }
            }
          }
        });

        // Target detection (Goal)
        const targetDist = Math.hypot(
          state.target.x - state.ball.x,
          state.target.y - state.ball.y
        );

        if (targetDist < state.target.radius + 2) {
          state.physicsRunning = false;
          setPhysicsRunning(false);

          const starsEarned = state.stars.filter((s) => s.collected).length;
          const stageBonus = 1000 + starsEarned * 500;
          state.score += stageBonus;
          onScoreUpdate(state.score);

          if (soundEnabled) sounds.playSuccess();

          for (let k = 0; k < 20; k++) {
            state.particles.push({
              x: state.target.x,
              y: state.target.y,
              vx: (Math.random() - 0.5) * 6,
              vy: (Math.random() - 0.5) * 6,
              color: '#34D399',
              size: 4,
              life: 0,
              maxLife: 24,
            });
          }

          state.level++;
          setSafeTimeout(() => {
            generateLevel(state.level, curW, curH);
          }, 700);
        }

        // Out of bounds
        if (state.ball.y > curH + 40 || state.ball.x < -40 || state.ball.x > curW + 40) {
          state.physicsRunning = false;
          setPhysicsRunning(false);
          state.attempts++;
          if (soundEnabled) sounds.playBuzz();
          
          if (state.attempts >= 3) {
            setSafeTimeout(() => {
              if (!gameStateRef.current) return;
              onGameOver(state.score);
            }, 400);
          } else {
            setSafeTimeout(resetCurrentAttempt, 400);
          }
        }
      }

      // --- HARDWARE ACCELERATED RENDERING (Zero costly shadowBlurs) ---

      // Background subtle grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < curW; x += 36) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, curH);
        ctx.stroke();
      }

      // Obstacles
      state.obstacles.forEach((obs) => {
        if (obs.type === 'bouncer') {
          ctx.fillStyle = '#EC4899';
        } else {
          ctx.fillStyle = '#3F3F46';
        }
        ctx.beginPath();
        ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 6);
        ctx.fill();

        if (obs.type === 'bouncer') {
          ctx.strokeStyle = 'rgba(236, 72, 153, 0.5)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });

      // Stars
      state.stars.forEach((s) => {
        if (!s.collected) {
          ctx.fillStyle = '#FACC15';
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('★', s.x, s.y);
        }
      });

      // Target Goal Cup
      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(state.target.x, state.target.y, state.target.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(52, 211, 153, 0.15)';
      ctx.beginPath();
      ctx.arc(state.target.x, state.target.y, state.target.radius, 0, Math.PI * 2);
      ctx.fill();

      // Drawn Ink Path (Two clean hardware-accelerated passes instead of CPU shadowBlur)
      if (state.linePoints.length > 1) {
        // Outer ambient glow pass
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(state.linePoints[0].x, state.linePoints[0].y);
        for (let i = 1; i < state.linePoints.length; i++) {
          ctx.lineTo(state.linePoints[i].x, state.linePoints[i].y);
        }
        ctx.stroke();

        // Main crisp ink line
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(state.linePoints[0].x, state.linePoints[0].y);
        for (let i = 1; i < state.linePoints.length; i++) {
          ctx.lineTo(state.linePoints[i].x, state.linePoints[i].y);
        }
        ctx.stroke();
      }

      // Ball
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(state.ball.x, state.ball.y, state.ball.radius, 0, Math.PI * 2);
      ctx.fill();

      // Particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        const particleFrameScale = Math.max(0.001, Math.min(dt, 0.05) * 60);
        p.x += p.vx * particleFrameScale;
        p.y += p.vy * particleFrameScale;
        p.life += particleFrameScale;
        const alpha = Math.max(0, 1 - p.life / p.maxLife);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fill();
        ctx.globalAlpha = 1;

        if (p.life >= p.maxLife) {
          state.particles.splice(i, 1);
        }
      }

      ctx.restore();
      return true;
    },
  });

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between select-none game-canvas-container touch-none bg-[#090D16] overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair touch-none" />

      {/* Top HUD */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-3 bg-[#18181B]/90 border border-[#27272A] px-3.5 py-1.5 rounded-xl font-mono-arcade text-xs backdrop-blur-md">
          <span className="text-white font-bold">STAGE {level}</span>
          <div className="flex items-center gap-1.5 text-amber-400">
            <Award className="w-3.5 h-3.5" />
            <span>{starsCount} / 3 STARS</span>
          </div>
          <span className="text-[#71717A]">|</span>
          <span className="text-[#38BDF8] font-bold">INK: {inkPercent}%</span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={handleRandomNewLevel}
            title="Generate New Random Layout"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#18181B] hover:bg-[#27272A] active:bg-[#3F3F46] text-[#A1A1AA] hover:text-white border border-[#27272A] font-mono-arcade text-xs transition-colors cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5" /> RANDOM
          </button>

          <button
            type="button"
            onClick={handleResetLevel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#18181B] hover:bg-[#27272A] active:bg-[#3F3F46] text-[#A1A1AA] hover:text-white border border-[#27272A] font-mono-arcade text-xs transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> CLEAR
          </button>
        </div>
      </div>

      {/* Bottom Hint */}
      {!physicsRunning && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#18181B]/90 border border-[#27272A] px-4 py-1.5 rounded-full font-mono-arcade text-xs text-[#A1A1AA] pointer-events-none backdrop-blur-md">
          <Compass className="w-3.5 h-3.5 text-[#38BDF8] animate-spin" />
          <span>DRAW ONE RAMP • RELEASE TO RUN PHYSICS • STARS ARE OPTIONAL</span>
        </div>
      )}
    </div>
  );
};
