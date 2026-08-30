import React, { useEffect, useRef, useState } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { useGameLoop, useSafeTimeout, useRenderPublishedCallback } from '../hooks/useGameLoop';
import { clamp, rescalePoint, rescaleTrail, rescaleVelocity } from '../lib/gameCoordinates';
import { ARCADE_FIXED_STEP_SEC, getArcadeStepBatch, getFrameInvariantDecay, getFrameScale } from '../lib/frameRateRuntime';

interface Hazard {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  rot: number;
  rotSpeed: number;
  color: string;
  type: 'meteor' | 'laser_warning' | 'laser_active' | 'homing' | 'shuriken';
  laserTimer?: number;
}

interface Collectible {
  id: number;
  x: number;
  y: number;
  radius: number;
  vy: number;
  type: 'shard' | 'shield' | 'emp' | 'slowmo';
  color: string;
  pulse: number;
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

interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
  alpha: number;
}

export const DodgeGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const publishScore = useRenderPublishedCallback(onScoreUpdate, 100);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const [dashAvailable, setDashAvailable] = useState(2);

  const gameStateRef = useRef({
    playerX: 0,
    playerY: 0,
    targetPlayerX: 0,
    playerRadius: 14,
    hasShield: false,
    dashCharges: 2,
    dashRecharge: 0,
    isDashing: false,
    dashTimer: 0,
    ghostTrail: [] as { x: number; y: number; alpha: number }[],
    slowMoTimer: 0,
    shake: 0,
    hazards: [] as Hazard[],
    collectibles: [] as Collectible[],
    particles: [] as Particle[],
    stars: [] as Star[],
    score: 0,
    isAlive: true,
    spawnElapsedMs: 0,
    gameTime: 0,
    combo: 1,
    keys: { left: false, right: false, up: false, down: false },
    nextHazardId: 1,
    viewportWidth: 400,
    viewportHeight: 600,
    physicsAccumulator: 0,
  });

  const triggerDash = () => {
    const state = gameStateRef.current;
    if (!state.isAlive || state.dashCharges <= 0 || state.isDashing || isPausedRef.current) return;

    state.dashCharges--;
    setDashAvailable(state.dashCharges);
    state.isDashing = true;
    state.dashTimer = 260; // 260ms i-frames
    if (soundEnabled) sounds.playWarp();

    // Dash particle burst
    for (let i = 0; i < 16; i++) {
      const ang = Math.random() * Math.PI * 2;
      state.particles.push({
        x: state.playerX,
        y: state.playerY,
        vx: Math.cos(ang) * (3 + Math.random() * 4),
        vy: Math.sin(ang) * (3 + Math.random() * 4),
        color: '#38BDF8',
        size: 3,
        life: 0,
        maxLife: 20,
      });
    }
  };

  const setSafeTimeout = useSafeTimeout();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const state = gameStateRef.current;
    state.isAlive = true;
    state.score = 0;
    state.hazards = [];
    state.collectibles = [];
    state.particles = [];
    state.ghostTrail = [];
    state.gameTime = 0;
    state.hasShield = false;
    state.dashCharges = 2;
    state.dashRecharge = 0;
    state.slowMoTimer = 0;
    state.spawnElapsedMs = 0;
    state.physicsAccumulator = 0;

    // Generate parallax starfield
    state.stars = Array.from({ length: 50 }, () => ({
      x: Math.random() * 400,
      y: Math.random() * 600,
      speed: 1 + Math.random() * 3,
      size: 1 + Math.random() * 2,
      alpha: 0.2 + Math.random() * 0.7,
    }));

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (isPausedRef.current || !state.isAlive) return;
      if ('touches' in e) e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      state.targetPlayerX = Math.max(20, Math.min(rect.width - 20, clientX - rect.left));
      state.playerY = Math.max(30, Math.min(rect.height - 30, clientY - rect.top));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPausedRef.current || !state.isAlive) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') state.keys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') state.keys.right = true;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') state.keys.up = true;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') state.keys.down = true;
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        triggerDash();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') state.keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') state.keys.right = false;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') state.keys.up = false;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') state.keys.down = false;
    };

    canvas.addEventListener('mousedown', handlePointerMove);
    window.addEventListener('mousemove', handlePointerMove);
    canvas.addEventListener('touchstart', handlePointerMove, { passive: false });
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      canvas.removeEventListener('mousedown', handlePointerMove);
      window.removeEventListener('mousemove', handlePointerMove);
      canvas.removeEventListener('touchstart', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useGameLoop({
    canvasRef,
    isPaused,
    onResize: (w, h) => {
      const state = gameStateRef.current;
      const scaleX = w / Math.max(1, state.viewportWidth);
      const scaleY = h / Math.max(1, state.viewportHeight);
      const uniformScale = Math.min(scaleX, scaleY);
      const needsInitialPlacement =
        state.playerX === 0 && state.playerY === 0 && state.targetPlayerX === 0;

      if (!needsInitialPlacement) {
        state.playerX *= scaleX;
        state.playerY *= scaleY;
        state.targetPlayerX *= scaleX;
      }
      state.playerRadius = clamp(state.playerRadius * uniformScale, 11, 21);
      rescaleTrail(state.ghostTrail, scaleX, scaleY);

      for (const hazard of state.hazards) {
        rescalePoint(hazard, scaleX, scaleY);
        rescaleVelocity(hazard, scaleX, scaleY);
        hazard.width *= scaleX;
        hazard.height *= scaleY;
      }
      for (const collectible of state.collectibles) {
        rescalePoint(collectible, scaleX, scaleY);
        collectible.vy *= scaleY;
        collectible.radius *= uniformScale;
      }
      for (const particle of state.particles) {
        rescalePoint(particle, scaleX, scaleY);
        rescaleVelocity(particle, scaleX, scaleY);
        particle.size *= uniformScale;
      }
      for (const star of state.stars) {
        rescalePoint(star, scaleX, scaleY);
        star.speed *= scaleY;
        star.size *= uniformScale;
      }

      state.viewportWidth = w;
      state.viewportHeight = h;
      state.physicsAccumulator = 0;
      if (needsInitialPlacement) {
        state.playerX = w / 2;
        state.targetPlayerX = w / 2;
        state.playerY = h * 0.82;
      } else {
        state.playerX = clamp(state.playerX, state.playerRadius, w - state.playerRadius);
        state.targetPlayerX = clamp(state.targetPlayerX, state.playerRadius, w - state.playerRadius);
        state.playerY = clamp(state.playerY, state.playerRadius, h - state.playerRadius);
      }
    },
    onUpdate: (ctx, deltaSec, curW, curH) => {
      const state = gameStateRef.current;
      const batch = !isPausedRef.current && state.isAlive
        ? getArcadeStepBatch(state.physicsAccumulator, deltaSec)
        : { steps: 0, remainderSec: 0 };
      state.physicsAccumulator = batch.remainderSec;
      const effectFrameScale = !isPausedRef.current ? getFrameScale(deltaSec) : 0;

      ctx.save();

      // Camera shake
      if (state.shake > 0) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
        state.shake *= getFrameInvariantDecay(0.88, effectFrameScale);
        if (state.shake < 0.2) state.shake = 0;
      }

      ctx.clearRect(-20, -20, curW + 40, curH + 40);

      // Parallax Stars
      state.stars.forEach((star) => {
        star.y += star.speed * (state.slowMoTimer > 0 ? 0.4 : 1) * effectFrameScale;
        if (star.y > curH) {
          star.y = 0;
          star.x = Math.random() * curW;
        }
        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      if (!isPausedRef.current && state.isAlive) {
        for (let simStep = 0; simStep < batch.steps && state.isAlive; simStep++) {
        const dt = ARCADE_FIXED_STEP_SEC * 1000;
        state.gameTime += ARCADE_FIXED_STEP_SEC;
        const timeScale = state.slowMoTimer > 0 ? 0.45 : 1;

        if (state.slowMoTimer > 0) {
          state.slowMoTimer -= dt;
        }

        state.score += Math.round(dt * 0.1 * state.combo);
        publishScore(state.score);

        // Recharge Dash
        if (state.dashCharges < 2) {
          state.dashRecharge += dt;
          if (state.dashRecharge >= 4000) {
            state.dashCharges++;
            setDashAvailable(state.dashCharges);
            state.dashRecharge = 0;
          }
        }

        // Dash Timer & Ghost Trail
        if (state.isDashing) {
          state.dashTimer -= dt;
          state.ghostTrail.unshift({ x: state.playerX, y: state.playerY, alpha: 0.8 });
          if (state.ghostTrail.length > 8) state.ghostTrail.pop();
          if (state.dashTimer <= 0) {
            state.isDashing = false;
          }
        }
        state.ghostTrail.forEach((t) => (t.alpha *= 0.8));

        // Keyboard Movement
        const horizontalSpeed = 7 * clamp(curW / 400, 0.85, 1.8);
        const verticalSpeed = 7 * clamp(curH / 600, 0.85, 1.35);
        if (state.keys.left) state.targetPlayerX -= horizontalSpeed;
        if (state.keys.right) state.targetPlayerX += horizontalSpeed;
        if (state.keys.up) state.playerY = Math.max(30, state.playerY - verticalSpeed);
        if (state.keys.down) state.playerY = Math.min(curH - 30, state.playerY + verticalSpeed);

        state.targetPlayerX = Math.max(20, Math.min(curW - 20, state.targetPlayerX));
        state.playerX += (state.targetPlayerX - state.playerX) * 0.25;

        // Hazard Spawner
        const spawnDelay = Math.max(380, 1100 - state.gameTime * 25);
        state.spawnElapsedMs += dt;
        if (state.spawnElapsedMs > spawnDelay) {
          state.spawnElapsedMs = 0;
          const rand = Math.random();

          if (rand < 0.15 && state.gameTime > 10) {
            // Laser Warning Beam
            const laserX = 30 + Math.random() * (curW - 60);
            state.hazards.push({
              id: state.nextHazardId++,
              x: laserX,
              y: 0,
              width: 18,
              height: curH,
              vx: 0,
              vy: 0,
              rot: 0,
              rotSpeed: 0,
              color: '#EF4444',
              type: 'laser_warning',
              laserTimer: 1200,
            });
            if (soundEnabled) sounds.playTick();
          } else if (rand < 0.4) {
            // Spinning Shuriken
            state.hazards.push({
              id: state.nextHazardId++,
              x: 20 + Math.random() * (curW - 40),
              y: -25,
              width: 28,
              height: 28,
              vx: (Math.random() - 0.5) * 1.5,
              vy: (3.5 + Math.random() * 2) * timeScale,
              rot: 0,
              rotSpeed: 0.12,
              color: '#F43F5E',
              type: 'shuriken',
            });
          } else if (rand < 0.65) {
            // Homing Drone
            state.hazards.push({
              id: state.nextHazardId++,
              x: 20 + Math.random() * (curW - 40),
              y: -20,
              width: 20,
              height: 20,
              vx: 0,
              vy: (2.8 + Math.random() * 1.5) * timeScale,
              rot: 0,
              rotSpeed: 0.04,
              color: '#FB923C',
              type: 'homing',
            });
          } else {
            // Angular Meteor
            const size = 18 + Math.random() * 16;
            state.hazards.push({
              id: state.nextHazardId++,
              x: 20 + Math.random() * (curW - 40),
              y: -30,
              width: size,
              height: size,
              vx: (Math.random() - 0.5) * 2,
              vy: (3.2 + Math.random() * 2.5) * timeScale,
              rot: 0,
              rotSpeed: (Math.random() - 0.5) * 0.08,
              color: '#A855F7',
              type: 'meteor',
            });
          }

          // Random Collectible
          if (Math.random() < 0.28) {
            const types: ('shard' | 'shield' | 'emp' | 'slowmo')[] = [
              'shard',
              'shard',
              'shield',
              'emp',
              'slowmo',
            ];
            const pType = types[Math.floor(Math.random() * types.length)];
            state.collectibles.push({
              id: state.nextHazardId++,
              x: 20 + Math.random() * (curW - 40),
              y: -20,
              radius: 12,
              vy: 2.2 * timeScale,
              type: pType,
              color:
                pType === 'shard'
                  ? '#38BDF8'
                  : pType === 'shield'
                  ? '#34D399'
                  : pType === 'emp'
                  ? '#FACC15'
                  : '#C084FC',
              pulse: 0,
            });
          }
        }

        // Update Collectibles
        for (let i = state.collectibles.length - 1; i >= 0; i--) {
          const c = state.collectibles[i];
          c.y += c.vy;
          c.pulse += 0.08;

          const dist = Math.hypot(c.x - state.playerX, c.y - state.playerY);
          if (dist < state.playerRadius + c.radius) {
            if (c.type === 'shard') {
              state.score += 250;
              if (soundEnabled) sounds.playScore();
            } else if (c.type === 'shield') {
              state.hasShield = true;
              if (soundEnabled) sounds.playSuccess();
            } else if (c.type === 'emp') {
              // EMP Clears Screen
              state.hazards = [];
              state.shake = 12;
              if (soundEnabled) sounds.playExplosion();
            } else if (c.type === 'slowmo') {
              state.slowMoTimer = 3500;
              if (soundEnabled) sounds.playChime(700);
            }

            for (let k = 0; k < 14; k++) {
              const ang = Math.random() * Math.PI * 2;
              state.particles.push({
                x: c.x,
                y: c.y,
                vx: Math.cos(ang) * (2 + Math.random() * 3),
                vy: Math.sin(ang) * (2 + Math.random() * 3),
                color: c.color,
                size: 2.5,
                life: 0,
                maxLife: 20,
              });
            }

            state.collectibles.splice(i, 1);
            continue;
          }

          if (c.y > curH + 30) {
            state.collectibles.splice(i, 1);
          }
        }

        // Update Hazards & Collision
        for (let i = state.hazards.length - 1; i >= 0; i--) {
          const h = state.hazards[i];

          if (h.type === 'laser_warning') {
            h.laserTimer = (h.laserTimer || 1200) - dt;
            if (h.laserTimer <= 0) {
              h.type = 'laser_active';
              h.laserTimer = 500; // Fire for 500ms
              if (soundEnabled) sounds.playLaser();
            }
          } else if (h.type === 'laser_active') {
            h.laserTimer = (h.laserTimer || 500) - dt;
            // Check collision with player
            if (!state.isDashing && Math.abs(state.playerX - h.x) < h.width / 2 + state.playerRadius - 2) {
              if (state.hasShield) {
                state.hasShield = false;
                state.isDashing = true;
                state.dashTimer = 200;
                if (soundEnabled) sounds.playPop();
              } else {
                state.isAlive = false;
                if (soundEnabled) sounds.playGameOver();
                setSafeTimeout(() => {
                  onGameOver(state.score);
                }, 700);
                break;
              }
            }

            if (h.laserTimer <= 0) {
              state.hazards.splice(i, 1);
              continue;
            }
          } else {
            // Movement for other hazards
            h.x += h.vx;
            h.y += h.vy;
            h.rot += h.rotSpeed;

            if (h.type === 'homing') {
              h.vx += (state.playerX - h.x) * 0.002;
              h.vx = Math.max(-2.5, Math.min(2.5, h.vx));
            }

            // Hit test
            const hDist = Math.hypot(
              h.x + h.width / 2 - state.playerX,
              h.y + h.height / 2 - state.playerY
            );

            if (!state.isDashing && hDist < h.width / 2 + state.playerRadius - 3) {
              if (state.hasShield) {
                state.hasShield = false;
                state.isDashing = true;
                state.dashTimer = 200;
                state.hazards.splice(i, 1);
                if (soundEnabled) sounds.playPop();
                continue;
              }

              state.isAlive = false;
              if (soundEnabled) sounds.playGameOver();
              state.shake = 16;

              for (let k = 0; k < 30; k++) {
                const ang = Math.random() * Math.PI * 2;
                state.particles.push({
                  x: state.playerX,
                  y: state.playerY,
                  vx: Math.cos(ang) * (3 + Math.random() * 6),
                  vy: Math.sin(ang) * (3 + Math.random() * 6),
                  color: '#F43F5E',
                  size: 3.5,
                  life: 0,
                  maxLife: 35,
                });
              }

              setSafeTimeout(() => {
                onGameOver(state.score);
              }, 700);
              break;
            }
          }

          if (h.y > curH + 40) {
            state.hazards.splice(i, 1);
          }
        }
        }
      }

      // --- RENDERING ---

      // Laser Beams
      state.hazards.forEach((h) => {
        if (h.type === 'laser_warning') {
          ctx.save();
          ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
          ctx.fillRect(h.x - h.width / 2, 0, h.width, curH);
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(h.x, 0);
          ctx.lineTo(h.x, curH);
          ctx.stroke();
          ctx.restore();
        } else if (h.type === 'laser_active') {
          ctx.save();
          ctx.shadowColor = '#EF4444';
          ctx.shadowBlur = 18;
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(h.x - h.width / 2, 0, h.width, curH);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(h.x - h.width / 4, 0, h.width / 2, curH);
          ctx.restore();
        }
      });

      // Draw Collectibles
      state.collectibles.forEach((c) => {
        ctx.save();
        ctx.shadowColor = c.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = c.color;
        ctx.beginPath();
        const r = c.radius + Math.sin(c.pulse) * 2;
        ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label =
          c.type === 'shard' ? '★' : c.type === 'shield' ? '🛡' : c.type === 'emp' ? '⚡' : '⏱';
        ctx.fillText(label, c.x, c.y);
        ctx.restore();
      });

      // Draw Meteors & Shurikens
      state.hazards.forEach((h) => {
        if (h.type === 'laser_warning' || h.type === 'laser_active') return;

        ctx.save();
        ctx.translate(h.x + h.width / 2, h.y + h.height / 2);
        ctx.rotate(h.rot);

        ctx.shadowColor = h.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = h.color;

        if (h.type === 'shuriken') {
          // 4-pointed glowing plasma shuriken
          ctx.beginPath();
          for (let p = 0; p < 4; p++) {
            const ang = (p * Math.PI) / 2;
            ctx.lineTo(Math.cos(ang) * (h.width / 2), Math.sin(ang) * (h.height / 2));
            ctx.lineTo(
              Math.cos(ang + Math.PI / 4) * (h.width / 5),
              Math.sin(ang + Math.PI / 4) * (h.height / 5)
            );
          }
          ctx.closePath();
          ctx.fill();
        } else if (h.type === 'homing') {
          // Homing diamond
          ctx.beginPath();
          ctx.moveTo(0, -h.height / 2);
          ctx.lineTo(h.width / 2, 0);
          ctx.lineTo(0, h.height / 2);
          ctx.lineTo(-h.width / 2, 0);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Angular meteor
          ctx.beginPath();
          ctx.roundRect(-h.width / 2, -h.height / 2, h.width, h.height, 6);
          ctx.fill();

          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.restore();
      });

      // Draw Player Ghost Trail
      state.ghostTrail.forEach((t) => {
        ctx.save();
        ctx.globalAlpha = t.alpha * 0.4;
        ctx.fillStyle = state.isDashing ? '#38BDF8' : '#F43F5E';
        ctx.beginPath();
        ctx.arc(t.x, t.y, state.playerRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Draw Player Ship
      if (state.isAlive) {
        ctx.save();
        ctx.translate(state.playerX, state.playerY);

        // Shield Ring
        if (state.hasShield) {
          ctx.save();
          ctx.shadowColor = '#38BDF8';
          ctx.shadowBlur = 14;
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, state.playerRadius + 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Ship Body
        ctx.shadowColor = state.isDashing ? '#38BDF8' : '#F43F5E';
        ctx.shadowBlur = 14;

        ctx.fillStyle = state.isDashing ? '#38BDF8' : '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(0, -state.playerRadius - 4);
        ctx.lineTo(state.playerRadius, state.playerRadius);
        ctx.lineTo(0, state.playerRadius - 5);
        ctx.lineTo(-state.playerRadius, state.playerRadius);
        ctx.closePath();
        ctx.fill();

        // Cockpit neon core
        ctx.fillStyle = state.isDashing ? '#FFFFFF' : '#F43F5E';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // Draw Particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx * effectFrameScale;
        p.y += p.vy * effectFrameScale;
        p.life += effectFrameScale;
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
      return state.isAlive;
    },
  });

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none game-canvas-container touch-none">
      <canvas ref={canvasRef} className="w-full h-full block cursor-none touch-none" />

      {/* Dash Charges UI HUD */}
      <button
        type="button"
        onClick={() => triggerDash()}
        className="absolute top-4 right-4 flex items-center gap-2 bg-[#18181B]/90 hover:bg-[#27272A] border border-[#27272A] px-3.5 py-1.5 rounded-xl font-mono-arcade text-xs cursor-pointer transition-colors"
      >
        <span className="text-[#71717A] text-[10px]">WARP DASH</span>
        <div className="flex items-center gap-1">
          {[1, 2].map((i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full border transition-all ${
                dashAvailable >= i
                  ? 'bg-[#38BDF8] border-[#38BDF8] shadow-[0_0_8px_rgba(56,189,248,0.8)]'
                  : 'bg-transparent border-[#3F3F46]'
              }`}
            />
          ))}
        </div>
      </button>
    </div>
  );
};
