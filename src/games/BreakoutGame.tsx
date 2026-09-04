import React, { useEffect, useRef } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { haptics } from '../lib/haptics';
import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';
import { clamp, rescalePoint, rescaleTrail, rescaleVelocity } from '../lib/gameCoordinates';
import { ARCADE_FIXED_STEP_SEC, getArcadeStepBatch, getFrameScale } from '../lib/frameRateRuntime';
import {
  advanceBreakoutContractProgress,
  getBreakoutContract,
  getBreakoutContractReward,
  isBreakoutContractComplete,
  type BreakoutContractEvent,
} from '../lib/breakoutMastery';
import { isArcadeReducedMotion } from '../lib/motionPreferences';

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  glowColor: string;
  alive: boolean;
  hp: number;
  maxHp: number;
  special?: 'multiball' | 'laser' | 'wide' | 'fireball' | 'points';
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  fireball: boolean;
  trail: { x: number; y: number; alpha: number }[];
}

interface PowerUp {
  x: number;
  y: number;
  vy: number;
  type: 'multiball' | 'laser' | 'wide' | 'fireball' | 'points';
  color: string;
  label: string;
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

interface LaserShot {
  x: number;
  y: number;
  vy: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export const BreakoutGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const gameStateRef = useRef({
    paddleX: 0,
    paddleW: 90,
    paddleTargetW: 90,
    paddleH: 14,
    targetPaddleX: 0,
    balls: [] as Ball[],
    bricks: [] as Brick[],
    particles: [] as Particle[],
    powerUps: [] as PowerUp[],
    lasers: [] as LaserShot[],
    floatingTexts: [] as FloatingText[],
    laserTimeRemaining: 0,
    laserCooldown: 0,
    wideTimeRemaining: 0,
    fireballTimeRemaining: 0,
    shake: 0,
    score: 0,
    combo: 0,
    isAlive: true,
    round: 1,
    contract: getBreakoutContract(1),
    contractProgress: 0,
    contractComplete: false,
    contractStreak: 0,
    keys: { left: false, right: false, space: false },
    lastLaserFire: 0,
    viewportWidth: 400,
    viewportHeight: 600,
    physicsAccumulator: 0,
  });

  const initBricks = (w: number, round: number) => {
    const rows = Math.min(6, 4 + Math.floor((round - 1) / 2));
    const cols = 7;
    const padding = 6;
    const topOffset = 50;
    const brickW = (w - (cols + 1) * padding) / cols;
    const brickH = 22;

    const brickThemes = [
      { color: '#F43F5E', glow: 'rgba(244, 63, 94, 0.7)', hp: 2 },
      { color: '#FB923C', glow: 'rgba(251, 146, 60, 0.7)', hp: 1 },
      { color: '#FACC15', glow: 'rgba(250, 204, 21, 0.7)', hp: 1 },
      { color: '#38BDF8', glow: 'rgba(56, 189, 248, 0.7)', hp: 1 },
      { color: '#A855F7', glow: 'rgba(168, 85, 247, 0.7)', hp: 2 },
      { color: '#34D399', glow: 'rgba(52, 211, 153, 0.7)', hp: 1 },
    ];

    const bricks: Brick[] = [];
    const specials: ('multiball' | 'laser' | 'wide' | 'fireball' | 'points')[] = [
      'multiball',
      'laser',
      'wide',
      'fireball',
      'points',
    ];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const theme = brickThemes[r % brickThemes.length];
        const isSpecial = Math.random() < 0.22;
        const specialType = isSpecial ? specials[Math.floor(Math.random() * specials.length)] : undefined;
        const hp = theme.hp + (round > 2 && r === 0 ? 1 : 0);

        bricks.push({
          x: padding + c * (brickW + padding),
          y: topOffset + r * (brickH + padding),
          w: brickW,
          h: brickH,
          color: theme.color,
          glowColor: theme.glow,
          alive: true,
          hp,
          maxHp: hp,
          special: specialType,
        });
      }
    }
    return bricks;
  };

  const setSafeTimeout = useSafeTimeout();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const state = gameStateRef.current;
    state.isAlive = true;
    state.score = 0;
    state.combo = 0;
    state.round = 1;
    state.contract = getBreakoutContract(1);
    state.contractProgress = 0;
    state.contractComplete = false;
    state.contractStreak = 0;
    state.shake = 0;
    state.paddleW = 96;
    state.paddleTargetW = 96;
    state.lasers = [];
    state.powerUps = [];
    state.floatingTexts = [];
    state.laserTimeRemaining = 0;
    state.laserCooldown = 0;
    state.wideTimeRemaining = 0;
    state.fireballTimeRemaining = 0;
    state.physicsAccumulator = 0;
    state.balls = [
      {
        x: 200,
        y: 350,
        vx: (Math.random() > 0.5 ? 4 : -4),
        vy: -6,
        radius: 6,
        fireball: false,
        trail: [],
      },
    ];
    state.bricks = initBricks(400, 1);
    state.particles = [];

    const handlePointer = (e: MouseEvent | TouchEvent) => {
      if (!canvas || !state.isAlive || isPausedRef.current) return;
      if ('touches' in e) e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      state.targetPaddleX = clientX - rect.left;
      if (state.laserTimeRemaining > 0) {
        state.keys.space = true;
      }
    };

    const handlePointerUp = () => {
      state.keys.space = false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') state.keys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') state.keys.right = true;
      if (e.key === ' ' || e.key === 'Spacebar') {
        state.keys.space = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') state.keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') state.keys.right = false;
      if (e.key === ' ' || e.key === 'Spacebar') {
        state.keys.space = false;
      }
    };

    canvas.addEventListener('mousedown', handlePointer);
    window.addEventListener('mousemove', handlePointer);
    window.addEventListener('mouseup', handlePointerUp);
    canvas.addEventListener('touchstart', handlePointer, { passive: false });
    window.addEventListener('touchmove', handlePointer, { passive: false });
    window.addEventListener('touchend', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      canvas.removeEventListener('mousedown', handlePointer);
      window.removeEventListener('mousemove', handlePointer);
      window.removeEventListener('mouseup', handlePointerUp);
      canvas.removeEventListener('touchstart', handlePointer);
      window.removeEventListener('touchmove', handlePointer);
      window.removeEventListener('touchend', handlePointerUp);
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

      state.paddleX = state.paddleX > 0 ? state.paddleX * scaleX : w / 2;
      state.targetPaddleX = state.targetPaddleX > 0 ? state.targetPaddleX * scaleX : w / 2;
      state.paddleW = clamp(state.paddleW * scaleX, 72, Math.min(180, w * 0.32));
      state.paddleTargetW = clamp(state.paddleTargetW * scaleX, 72, Math.min(180, w * 0.32));
      state.paddleH = clamp(state.paddleH * uniformScale, 12, 22);

      for (const brick of state.bricks) {
        brick.x *= scaleX;
        brick.y *= scaleY;
        brick.w *= scaleX;
        brick.h *= scaleY;
      }
      for (const ball of state.balls) {
        rescalePoint(ball, scaleX, scaleY);
        rescaleVelocity(ball, scaleX, scaleY);
        rescaleTrail(ball.trail, scaleX, scaleY);
        ball.radius = clamp(ball.radius * uniformScale, 5, 10);
        ball.x = clamp(ball.x, ball.radius, w - ball.radius);
        ball.y = clamp(ball.y, ball.radius, h + ball.radius);
      }
      for (const particle of state.particles) {
        rescalePoint(particle, scaleX, scaleY);
        rescaleVelocity(particle, scaleX, scaleY);
        particle.size *= uniformScale;
      }
      for (const powerUp of state.powerUps) {
        rescalePoint(powerUp, scaleX, scaleY);
        powerUp.vy *= scaleY;
      }
      for (const laser of state.lasers) {
        rescalePoint(laser, scaleX, scaleY);
        laser.vy *= scaleY;
      }
      for (const text of state.floatingTexts) rescalePoint(text, scaleX, scaleY);

      state.viewportWidth = w;
      state.viewportHeight = h;
      state.physicsAccumulator = 0;
      state.paddleX = clamp(state.paddleX, state.paddleW / 2, w - state.paddleW / 2);
      state.targetPaddleX = clamp(state.targetPaddleX, state.paddleW / 2, w - state.paddleW / 2);

      if (state.bricks.length === 0) state.bricks = initBricks(w, state.round);
    },
    onUpdate: (ctx, deltaSec, curW, curH) => {
      const state = gameStateRef.current;
      const batch = !isPausedRef.current && state.isAlive
        ? getArcadeStepBatch(state.physicsAccumulator, deltaSec)
        : { steps: 0, remainderSec: 0 };
      state.physicsAccumulator = batch.remainderSec;
      const effectFrameScale = !isPausedRef.current ? getFrameScale(deltaSec) : 0;

      const registerContractEvent = (event: BreakoutContractEvent, value = 1) => {
        if (state.contractComplete) return;
        const nextProgress = advanceBreakoutContractProgress(
          state.contract,
          state.contractProgress,
          event,
          value,
        );
        if (nextProgress === state.contractProgress) return;
        state.contractProgress = nextProgress;

        if (isBreakoutContractComplete(state.contract, nextProgress)) {
          state.contractComplete = true;
          state.contractStreak++;
          const reward = getBreakoutContractReward(state.round, state.contractStreak);
          state.score += reward;
          onScoreUpdate(state.score);
          state.floatingTexts.push({
            x: curW / 2,
            y: Math.min(220, curH * 0.34),
            text: `CONTRACT CLEAR x${state.contractStreak} +${reward}`,
            color: '#FACC15',
            life: 0,
            maxLife: 72,
          });
          if (soundEnabled) sounds.playVictory();
        }
      };

      const spawnWallSparks = (x: number, y: number, color: string, st: typeof state) => {
        for (let i = 0; i < 6; i++) {
          st.particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 0,
            maxLife: 15,
            color,
            size: 2,
          });
        }
      };

      ctx.save();

      // Camera shake
      if (state.shake > 0) {
        const sx = (Math.random() - 0.5) * state.shake;
        const sy = (Math.random() - 0.5) * state.shake;
        if (!isArcadeReducedMotion()) {
          ctx.translate(sx, sy);
        }
      }

      ctx.clearRect(-20, -20, curW + 40, curH + 40);

      if (!isPausedRef.current && state.isAlive) {
        for (let simStep = 0; simStep < batch.steps && state.isAlive; simStep++) {
          const delta = ARCADE_FIXED_STEP_SEC * 1000;
          if (state.shake > 0) {
            state.shake *= 0.88;
            if (state.shake < 0.2) state.shake = 0;
          }
        // Paddle movement
        if (state.keys.left) state.targetPaddleX -= 10;
        if (state.keys.right) state.targetPaddleX += 10;
        state.targetPaddleX = Math.max(
          state.paddleW / 2,
          Math.min(curW - state.paddleW / 2, state.targetPaddleX)
        );

        state.paddleX += (state.targetPaddleX - state.paddleX) * 0.35;
        state.paddleW += (state.paddleTargetW - state.paddleW) * 0.1;

        // Powerup duration timers
        if (state.wideTimeRemaining > 0) {
          state.wideTimeRemaining -= delta;
          if (state.wideTimeRemaining <= 0) {
            state.paddleTargetW = clamp(state.viewportWidth * 0.22, 72, Math.min(180, state.viewportWidth * 0.32));
          }
        }
        if (state.fireballTimeRemaining > 0) {
          state.fireballTimeRemaining -= delta;
          if (state.fireballTimeRemaining <= 0) {
            state.balls.forEach((b: Ball) => (b.fireball = false));
          }
        }

        // Laser countdown & firing
        if (state.laserTimeRemaining > 0) {
          state.laserTimeRemaining -= delta;
          state.laserCooldown = (state.laserCooldown || 0) + delta;
          if (state.laserCooldown > 180) {
            state.laserCooldown = 0;
            const paddleY = curH - 50;
            const laserSpeed = -12 * clamp(curH / 600, 0.85, 1.35);
            state.lasers.push({ x: state.paddleX - state.paddleW / 2 + 10, y: paddleY, vy: laserSpeed });
            state.lasers.push({ x: state.paddleX + state.paddleW / 2 - 10, y: paddleY, vy: laserSpeed });
            if (soundEnabled) sounds.playLaser();
          }
        }

        // Update Lasers
        for (let l = state.lasers.length - 1; l >= 0; l--) {
          const laser = state.lasers[l];
          laser.y += laser.vy;

          let hit = false;
          for (let b = 0; b < state.bricks.length; b++) {
            const brick = state.bricks[b];
            if (!brick.alive) continue;
            if (
              laser.x >= brick.x &&
              laser.x <= brick.x + brick.w &&
              laser.y >= brick.y &&
              laser.y <= brick.y + brick.h
            ) {
              hit = true;
              brick.hp--;
              if (brick.hp <= 0) {
                brick.alive = false;
                state.score += 50;
                onScoreUpdate(state.score);
                triggerBrickBreak(brick, state, curW, curH, soundEnabled);
                if (brick.maxHp > 1) registerContractEvent('ARMORED');
                if (brick.special) registerContractEvent('SPECIAL');
              } else {
                if (soundEnabled) sounds.playTone(600, 0.04, 'square');
              }
              break;
            }
          }

          if (hit || laser.y < -10) {
            state.lasers.splice(l, 1);
          }
        }

        // Update Powerups
        for (let p = state.powerUps.length - 1; p >= 0; p--) {
          const pUp = state.powerUps[p];
          pUp.y += pUp.vy;

          const paddleY = curH - 50;
          // Catch powerup
          if (
            pUp.y >= paddleY - 10 &&
            pUp.y <= paddleY + state.paddleH + 10 &&
            pUp.x >= state.paddleX - state.paddleW / 2 - 12 &&
            pUp.x <= state.paddleX + state.paddleW / 2 + 12
          ) {
            haptics.score();
            applyPowerUp(pUp.type, state, curW, curH, soundEnabled);
            registerContractEvent('POWER');
            state.powerUps.splice(p, 1);
            continue;
          }

          if (pUp.y > curH + 20) {
            state.powerUps.splice(p, 1);
          }
        }

        // Update Balls
        for (let bi = state.balls.length - 1; bi >= 0; bi--) {
          const ball = state.balls[bi];

          // Record trail
          ball.trail.unshift({ x: ball.x, y: ball.y, alpha: 0.8 });
          if (ball.trail.length > 8) ball.trail.pop();
          ball.trail.forEach((t) => (t.alpha *= 0.8));

          ball.x += ball.vx;
          ball.y += ball.vy;

          // Wall bounces
          if (ball.x - ball.radius < 0) {
            ball.x = ball.radius;
            ball.vx = Math.abs(ball.vx);
            if (soundEnabled) sounds.playBounce();
            spawnWallSparks(ball.x, ball.y, '#38BDF8', state);
          } else if (ball.x + ball.radius > curW) {
            ball.x = curW - ball.radius;
            ball.vx = -Math.abs(ball.vx);
            if (soundEnabled) sounds.playBounce();
            spawnWallSparks(ball.x, ball.y, '#38BDF8', state);
          }

          if (ball.y - ball.radius < 0) {
            ball.y = ball.radius;
            ball.vy = Math.abs(ball.vy);
            if (soundEnabled) sounds.playBounce();
            spawnWallSparks(ball.x, ball.y, '#38BDF8', state);
          }

          // Paddle collision
          const paddleY = curH - 50;
          if (
            ball.y + ball.radius >= paddleY &&
            ball.y - ball.radius <= paddleY + state.paddleH &&
            ball.x >= state.paddleX - state.paddleW / 2 - 4 &&
            ball.x <= state.paddleX + state.paddleW / 2 + 4 &&
            ball.vy > 0
          ) {
            ball.vy = -Math.abs(ball.vy);
            const hitNorm = (ball.x - state.paddleX) / (state.paddleW / 2);
            const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            ball.vx = hitNorm * (speed * 0.85);
            // Limit horizontal vs vertical
            ball.vy = -Math.sqrt(Math.max(16, speed * speed - ball.vx * ball.vx));

            state.combo = 0;
            haptics.light();
            if (soundEnabled) sounds.playPop();

            // Paddle impact sparks
            for (let i = 0; i < 8; i++) {
              state.particles.push({
                x: ball.x,
                y: paddleY,
                vx: (Math.random() - 0.5) * 6,
                vy: -Math.random() * 4 - 1,
                color: '#38BDF8',
                size: 2.5,
                life: 1,
                maxLife: 15,
              });
            }
          }

          // Brick collision
          let hitBrick = false;
          for (let b = 0; b < state.bricks.length; b++) {
            const brick = state.bricks[b];
            if (!brick.alive) continue;

            if (
              ball.x + ball.radius > brick.x &&
              ball.x - ball.radius < brick.x + brick.w &&
              ball.y + ball.radius > brick.y &&
              ball.y - ball.radius < brick.y + brick.h
            ) {
              hitBrick = true;
              brick.hp--;

              if (!ball.fireball) {
                // Determine collision side
                const overlapLeft = ball.x + ball.radius - brick.x;
                const overlapRight = brick.x + brick.w - (ball.x - ball.radius);
                const overlapTop = ball.y + ball.radius - brick.y;
                const overlapBottom = brick.y + brick.h - (ball.y - ball.radius);
                const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

                if (minOverlap === overlapLeft || minOverlap === overlapRight) {
                  ball.vx *= -1;
                } else {
                  ball.vy *= -1;
                }
              }

              state.combo++;
              registerContractEvent('COMBO', state.combo);
              const pts = 50 * Math.min(6, state.combo);
              state.score += pts;
              onScoreUpdate(state.score);

              state.shake = Math.min(8, state.shake + 2.5);

              if (brick.hp <= 0) {
                brick.alive = false;
                haptics.score();
                triggerBrickBreak(brick, state, curW, curH, soundEnabled);
                if (brick.maxHp > 1) registerContractEvent('ARMORED');
                if (brick.special) registerContractEvent('SPECIAL');
              } else {
                haptics.light();
                if (soundEnabled) sounds.playTone(550, 0.05, 'triangle');
              }

              if (soundEnabled) sounds.playCombo(state.combo);

              if (state.combo > 1) {
                state.floatingTexts.push({
                  x: brick.x + brick.w / 2,
                  y: brick.y,
                  text: `+${pts} (${state.combo}x)`,
                  color: state.combo >= 4 ? '#F43F5E' : '#FACC15',
                  life: 0,
                  maxLife: 30,
                });
              }

              break;
            }
          }

          // Ball fell below screen
          if (ball.y > curH + 20) {
            state.balls.splice(bi, 1);
          }
        }

        // Check if all balls lost
        if (state.balls.length === 0) {
          state.isAlive = false;
          haptics.gameOver();
          if (soundEnabled) sounds.playGameOver();
          setSafeTimeout(() => {
            onGameOver(state.score);
          }, 600);
        }

        // Check wave clear
        const remaining = state.bricks.filter((b) => b.alive).length;
        if (remaining === 0) {
          if (!state.contractComplete) state.contractStreak = 0;
          state.round++;
          state.contract = getBreakoutContract(state.round);
          state.contractProgress = 0;
          state.contractComplete = false;
          state.score += 1000 * state.round;
          onScoreUpdate(state.score);
          haptics.combo();
          if (soundEnabled) sounds.playSuccess();
          state.bricks = initBricks(curW, state.round);
          state.floatingTexts.push({
            x: curW / 2,
            y: curH / 2,
            text: `ROUND ${state.round} CLEAR!`,
            color: '#34D399',
            life: 0,
            maxLife: 60,
          });
          // Reset ball
          state.balls = [
            {
              x: curW / 2,
              y: curH - 100,
              vx: 4 * clamp(curW / 400, 0.85, 1.8),
              vy: -6 * clamp(curH / 600, 0.85, 1.35),
              radius: clamp(6 * Math.min(curW / 400, curH / 600), 5, 10),
              fireball: false,
              trail: [],
            },
          ];
        }
        }
      }

      // --- RENDERING ---

      // Background ambient cyber grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      const gridSpacing = 32;
      for (let x = 0; x < curW; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, curH);
        ctx.stroke();
      }
      for (let y = 0; y < curH; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(curW, y);
        ctx.stroke();
      }

      // Round contract HUD: optional mastery objective layered over the base brick-breaker loop.
      ctx.save();
      const contractWidth = Math.min(340, Math.max(210, curW - 24));
      ctx.fillStyle = 'rgba(9, 9, 11, 0.86)';
      ctx.beginPath();
      ctx.roundRect(12, 12, contractWidth, 46, 10);
      ctx.fill();
      ctx.strokeStyle = state.contractComplete ? '#34D399' : '#FACC15';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = state.contractComplete ? '#6EE7B7' : '#FDE047';
      ctx.font = '900 10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`R${state.round} • CONTRACT ${state.contract.label}`, 20, 28);
      ctx.fillStyle = '#D4D4D8';
      ctx.font = '700 9px ui-monospace, monospace';
      ctx.fillText(
        `${Math.min(state.contractProgress, state.contract.target)}/${state.contract.target}${state.contractComplete ? ' CLEAR' : ''} • CONTRACT CHAIN x${state.contractStreak}`,
        20,
        44,
      );
      ctx.restore();

      // Draw Bricks
      state.bricks.forEach((brick) => {
        if (!brick.alive) return;

        ctx.save();
        // Glow effect
        ctx.shadowColor = brick.glowColor;
        ctx.shadowBlur = brick.special ? 12 : 6;

        // Brick Body Gradient
        const grad = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.h);
        grad.addColorStop(0, brick.color);
        grad.addColorStop(1, '#0A0A0B');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(brick.x, brick.y, brick.w, brick.h, 4);
        ctx.fill();

        // Top specular highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(brick.x + 2, brick.y + 2, brick.w - 4, 2);

        // Border
        ctx.strokeStyle = brick.color;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Multi-hit crack/indicator
        if (brick.hp > 1) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`•`, brick.x + brick.w / 2, brick.y + brick.h / 2);
        }

        // Special Icon Badge
        if (brick.special) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const icon =
            brick.special === 'multiball'
              ? '✦3'
              : brick.special === 'laser'
              ? '⚡'
              : brick.special === 'wide'
              ? '⬌'
              : brick.special === 'fireball'
              ? '🔥'
              : '★';
          ctx.fillText(icon, brick.x + brick.w / 2, brick.y + brick.h / 2);
        }

        ctx.restore();
      });

      // Draw PowerUps
      state.powerUps.forEach((pUp) => {
        ctx.save();
        ctx.shadowColor = pUp.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = pUp.color;
        ctx.beginPath();
        ctx.roundRect(pUp.x - 14, pUp.y - 8, 28, 16, 8);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pUp.label, pUp.x, pUp.y);
        ctx.restore();
      });

      // Draw Lasers
      state.lasers.forEach((laser) => {
        ctx.save();
        ctx.shadowColor = '#F43F5E';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#F43F5E';
        ctx.fillRect(laser.x - 1.5, laser.y, 3, 14);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(laser.x - 0.5, laser.y + 2, 1, 10);
        ctx.restore();
      });

      // Draw Paddle
      const paddleY = curH - 50;
      ctx.save();
      ctx.shadowColor = state.laserTimeRemaining > 0 ? '#F43F5E' : '#38BDF8';
      ctx.shadowBlur = 14;

      // Paddle base
      const padGrad = ctx.createLinearGradient(
        state.paddleX - state.paddleW / 2,
        paddleY,
        state.paddleX - state.paddleW / 2,
        paddleY + state.paddleH
      );
      padGrad.addColorStop(0, '#FFFFFF');
      padGrad.addColorStop(0.3, state.laserTimeRemaining > 0 ? '#F43F5E' : '#38BDF8');
      padGrad.addColorStop(1, '#0F172A');

      ctx.fillStyle = padGrad;
      ctx.beginPath();
      ctx.roundRect(
        state.paddleX - state.paddleW / 2,
        paddleY,
        state.paddleW,
        state.paddleH,
        6
      );
      ctx.fill();

      // Paddle neon top stripe
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(state.paddleX - state.paddleW / 2 + 4, paddleY + 2, state.paddleW - 8, 2);

      // Laser cannons
      if (state.laserTimeRemaining > 0) {
        ctx.fillStyle = '#F43F5E';
        ctx.fillRect(state.paddleX - state.paddleW / 2 + 6, paddleY - 4, 4, 4);
        ctx.fillRect(state.paddleX + state.paddleW / 2 - 10, paddleY - 4, 4, 4);
      }
      ctx.restore();

      // Draw Balls & Trails
      state.balls.forEach((ball) => {
        // Draw Trail
        ball.trail.forEach((t) => {
          ctx.beginPath();
          ctx.arc(t.x, t.y, ball.radius * 0.75, 0, Math.PI * 2);
          ctx.fillStyle = ball.fireball
            ? `rgba(244, 63, 94, ${t.alpha})`
            : `rgba(56, 189, 248, ${t.alpha * 0.6})`;
          ctx.fill();
        });

        // Ball Body
        ctx.save();
        ctx.shadowColor = ball.fireball ? '#F43F5E' : '#FFFFFF';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = ball.fireball ? '#FB7185' : '#FFFFFF';
        ctx.fill();
        ctx.restore();
      });

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

      // Draw Floating Texts
      for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
        const ft = state.floatingTexts[i];
        ft.y -= 0.8 * effectFrameScale;
        ft.life += effectFrameScale;
        const alpha = Math.max(0, 1 - ft.life / ft.maxLife);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();

        if (ft.life >= ft.maxLife) {
          state.floatingTexts.splice(i, 1);
        }
      }

      ctx.restore();
      return state.isAlive;
    },
  });

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none game-canvas-container touch-none">
      <canvas ref={canvasRef} className="w-full h-full block cursor-none touch-none" />
    </div>
  );
};

function triggerBrickBreak(
  brick: Brick,
  state: any,
  curW: number,
  curH: number,
  soundEnabled: boolean
) {
  // Spawn particles
  for (let i = 0; i < 14; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 1.5 + Math.random() * 4;
    state.particles.push({
      x: brick.x + brick.w / 2,
      y: brick.y + brick.h / 2,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      color: brick.color,
      size: 3 + Math.random() * 2,
      life: 1,
      maxLife: 24,
    });
  }

  // Spawn powerup if special
  if (brick.special) {
    const labels: Record<string, string> = {
      multiball: '+3',
      laser: 'GUN',
      wide: 'WIDE',
      fireball: 'FIRE',
      points: '500',
    };
    state.powerUps.push({
      x: brick.x + brick.w / 2,
      y: brick.y + brick.h / 2,
      vy: 2.2,
      type: brick.special,
      color: brick.color,
      label: labels[brick.special] || '★',
    });
  }
}

function applyPowerUp(
  type: string,
  state: any,
  curW: number,
  curH: number,
  soundEnabled: boolean
) {
  if (soundEnabled) sounds.playPowerUp();

  if (type === 'multiball') {
    const orig = state.balls[0] || { x: curW / 2, y: curH - 100, vx: 4, vy: -5 };
    state.balls.push(
      {
        x: orig.x,
        y: orig.y,
        vx: orig.vx * 0.8 + 2,
        vy: orig.vy - 1,
        radius: 6,
        fireball: false,
        trail: [],
      },
      {
        x: orig.x,
        y: orig.y,
        vx: orig.vx * 0.8 - 2,
        vy: orig.vy - 1,
        radius: 6,
        fireball: false,
        trail: [],
      }
    );
  } else if (type === 'laser') {
    state.laserTimeRemaining = 7000;
  } else if (type === 'wide') {
    state.paddleTargetW = clamp(curW * 0.3, 140, Math.min(240, curW * 0.38));
    state.wideTimeRemaining = 8000;
  } else if (type === 'fireball') {
    state.balls.forEach((b: Ball) => (b.fireball = true));
    state.fireballTimeRemaining = 6000;
  } else if (type === 'points') {
    state.score += 500;
  }
}
