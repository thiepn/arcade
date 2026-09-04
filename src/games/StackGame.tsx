import React, { useEffect, useRef, useState } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { haptics } from '../lib/haptics';
import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';
import { clamp } from '../lib/gameCoordinates';
import { getArcadeStepBatch, getFrameInvariantBlend, getFrameInvariantDecay, getFrameScale } from '../lib/frameRateRuntime';
import {
  STACK_FOCUS_MAX_CHARGES,
  STACK_FOCUS_START_CHARGES,
  canArmStackFocus,
  getStackFocusReward,
  getStackPerfectWindow,
  shouldEarnStackFocus,
} from '../lib/stackMastery';
import { isArcadeReducedMotion } from '../lib/motionPreferences';

interface Block {
  x: number;
  y: number;
  width: number;
  height: number;
  hue: number;
}

interface SlicedDebris {
  x: number;
  y: number;
  width: number;
  height: number;
  hue: number;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
}

interface ShockwaveRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  hue: number;
  alpha: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export const StackGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const setSafeTimeout = useSafeTimeout();
  const [focusHud, setFocusHud] = useState({
    charges: STACK_FOCUS_START_CHARGES,
    armed: false,
    chain: 0,
  });

  const gameStateRef = useRef({
    blocks: [] as Block[],
    debris: [] as SlicedDebris[],
    rings: [] as ShockwaveRing[],
    floatingTexts: [] as FloatingText[],
    currentX: 0,
    currentWidth: 200,
    currentHeight: 26,
    speed: 3.5,
    direction: 1,
    score: 0,
    perfectStreak: 0,
    focusCharges: STACK_FOCUS_START_CHARGES,
    focusArmed: false,
    focusChain: 0,
    isAlive: true,
    cameraY: 0,
    targetCameraY: 0,
    shake: 0,
    initialized: false,
    viewportWidth: 500,
    physicsAccumulator: 0,
  });

  const publishFocusHud = () => {
    const state = gameStateRef.current;
    setFocusHud({
      charges: state.focusCharges,
      armed: state.focusArmed,
      chain: state.focusChain,
    });
  };

  const armFocus = () => {
    const state = gameStateRef.current;
    if (!canArmStackFocus(state.focusCharges, state.focusArmed, state.isAlive) || isPausedRef.current) return;
    state.focusCharges--;
    state.focusArmed = true;
    publishFocusHud();
    if (soundEnabled) sounds.playPowerUp();
  };

  const getHue = (index: number) => {
    return (index * 24 + 190) % 360;
  };

  const placeBlock = () => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current) return;

    const prevBlock = state.blocks[state.blocks.length - 1];
    if (!prevBlock) return;
    const diff = state.currentX - prevBlock.x;
    const absDiff = Math.abs(diff);
    const focusAttempt = state.focusArmed;
    const perfectWindow = getStackPerfectWindow(focusAttempt);
    if (focusAttempt) {
      state.focusArmed = false;
    }

    // Focus deliberately tightens only the perfect snap window; an overlapping
    // miss still resolves as an ordinary sliced placement instead of ending the run.
    if (absDiff <= perfectWindow) {
      state.perfectStreak++;
      state.currentX = prevBlock.x; // Snap perfectly

      // Bonus width reward on high streak
      const rewardWidthCap = Math.min(320, Math.max(220, state.viewportWidth * 0.45));
      if (state.perfectStreak >= 5 && state.currentWidth < rewardWidthCap) {
        state.currentWidth = Math.min(rewardWidthCap, state.currentWidth + 12);
        state.currentX -= 6;
      }

      state.score += 1;
      if (focusAttempt) {
        state.focusChain++;
        const reward = getStackFocusReward(state.blocks.length + 1, state.focusChain);
        state.score += reward;
        state.floatingTexts.push({
          x: state.currentX + state.currentWidth / 2,
          y: state.blocks.length * state.currentHeight + 38,
          text: `FOCUS x${state.focusChain} +${reward}`,
          color: '#FACC15',
          life: 0,
          maxLife: 44,
        });
      }
      if (shouldEarnStackFocus(state.perfectStreak)) {
        state.focusCharges = Math.min(STACK_FOCUS_MAX_CHARGES, state.focusCharges + 1);
      }
      publishFocusHud();
      onScoreUpdate(state.score);

      // Trigger Shockwave Ring
      state.rings.push({
        x: state.currentX + state.currentWidth / 2,
        y: state.blocks.length * state.currentHeight,
        radius: 10,
        maxRadius: 75,
        hue: getHue(state.blocks.length),
        alpha: 1,
      });

      // Floating Perfect Text
      state.floatingTexts.push({
        x: state.currentX + state.currentWidth / 2,
        y: state.blocks.length * state.currentHeight + 20,
        text: state.perfectStreak >= 3 ? `PERFECT x${state.perfectStreak}!` : 'PERFECT!',
        color: '#38BDF8',
        life: 0,
        maxLife: 35,
      });

      if (state.perfectStreak >= 3) {
        haptics.combo();
      } else {
        haptics.score();
      }
      if (soundEnabled) sounds.playScore();

      state.blocks.push({
        x: state.currentX,
        y: state.blocks.length * state.currentHeight,
        width: state.currentWidth,
        height: state.currentHeight,
        hue: getHue(state.blocks.length),
      });

      // Spawn next hovering block
      state.direction *= -1;
      state.currentX = state.direction === 1 ? -state.currentWidth : state.viewportWidth + state.currentWidth * 0.15;
      state.speed = 3.5 * clamp(state.viewportWidth / 500, 0.85, 1.7) + Math.min(4.5, Math.max(0, state.blocks.length - 1) * 0.08);

      if (state.blocks.length > 5) {
        state.targetCameraY = (state.blocks.length - 5) * state.currentHeight;
      }
      return;
    }

    if (focusAttempt) {
      state.focusChain = 0;
      publishFocusHud();
      state.floatingTexts.push({
        x: state.currentX + state.currentWidth / 2,
        y: state.blocks.length * state.currentHeight + 22,
        text: 'FOCUS MISSED — STACK CONTINUES',
        color: '#FB923C',
        life: 0,
        maxLife: 36,
      });
    }
    state.perfectStreak = 0;

    // Check complete miss
    if (absDiff >= state.currentWidth) {
      state.isAlive = false;
      state.shake = 14;
      haptics.gameOver();

      // Entire block falls as debris
      state.debris.push({
        x: state.currentX,
        y: state.blocks.length * state.currentHeight,
        width: state.currentWidth,
        height: state.currentHeight,
        hue: getHue(state.blocks.length),
        vx: state.direction * 2,
        vy: 0,
        rotation: 0,
        vRot: (Math.random() - 0.5) * 0.15,
      });

      if (soundEnabled) sounds.playGameOver();
      setSafeTimeout(() => {
        onGameOver(state.score);
      }, 700);
      return;
    }

    // Slicing block calculation
    const newWidth = state.currentWidth - absDiff;
    const newX = diff > 0 ? state.currentX : prevBlock.x;
    const debrisX = diff > 0 ? prevBlock.x + state.currentWidth : state.currentX;
    const debrisW = absDiff;

    state.debris.push({
      x: debrisX,
      y: state.blocks.length * state.currentHeight,
      width: debrisW,
      height: state.currentHeight,
      hue: getHue(state.blocks.length),
      vx: (diff > 0 ? 1 : -1) * (2 + Math.random() * 2),
      vy: 0,
      rotation: 0,
      vRot: (diff > 0 ? 1 : -1) * 0.1,
    });

    state.currentWidth = newWidth;
    state.currentX = newX;
    state.score += 1;
    onScoreUpdate(state.score);

    haptics.light();
    if (soundEnabled) sounds.playPop();

    state.blocks.push({
      x: state.currentX,
      y: state.blocks.length * state.currentHeight,
      width: state.currentWidth,
      height: state.currentHeight,
      hue: getHue(state.blocks.length),
    });

    // Spawn next hovering block
    state.direction *= -1;
    state.currentX = state.direction === 1 ? -state.currentWidth : state.viewportWidth + state.currentWidth * 0.15;
    state.speed = 3.5 * clamp(state.viewportWidth / 500, 0.85, 1.7) + Math.min(4.5, Math.max(0, state.blocks.length - 1) * 0.08);

    if (state.blocks.length > 5) {
      state.targetCameraY = (state.blocks.length - 5) * state.currentHeight;
    }
  };

  const initGame = (w: number) => {
    const baseWidth = clamp(w * 0.5, 150, 260);
    const startX = (w - baseWidth) / 2;

    const state = gameStateRef.current;
    state.isAlive = true;
    state.score = 0;
    state.perfectStreak = 0;
    state.focusCharges = STACK_FOCUS_START_CHARGES;
    state.focusArmed = false;
    state.focusChain = 0;
    setFocusHud({ charges: STACK_FOCUS_START_CHARGES, armed: false, chain: 0 });
    state.cameraY = 0;
    state.targetCameraY = 0;
    state.shake = 0;
    state.viewportWidth = w;
    state.physicsAccumulator = 0;
    state.currentWidth = baseWidth;
    state.currentHeight = 26;
    state.currentX = -baseWidth;
    state.speed = 3.5 * clamp(w / 500, 0.85, 1.7);
    state.direction = 1;
    state.debris = [];
    state.rings = [];
    state.floatingTexts = [];
    state.blocks = [
      {
        x: startX,
        y: 0,
        width: baseWidth,
        height: 26,
        hue: getHue(0),
      },
    ];
    state.initialized = true;
  };

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      placeBlock();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyF') {
        e.preventDefault();
        armFocus();
        return;
      }
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
        e.preventDefault();
        placeBlock();
      }
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('mousedown', handlePointerDown);
      canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
    }
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (canvas) {
        canvas.removeEventListener('mousedown', handlePointerDown);
        canvas.removeEventListener('touchstart', handlePointerDown);
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useGameLoop({
    canvasRef,
    isPaused,
    onResize: (w) => {
      const state = gameStateRef.current;
      if (!state.initialized) {
        initGame(w);
        return;
      }

      const scaleX = w / Math.max(1, state.viewportWidth);
      state.currentX *= scaleX;
      state.currentWidth *= scaleX;
      state.speed *= scaleX;
      for (const block of state.blocks) {
        block.x *= scaleX;
        block.width *= scaleX;
      }
      for (const debris of state.debris) {
        debris.x *= scaleX;
        debris.width *= scaleX;
        debris.vx *= scaleX;
      }
      for (const ring of state.rings) {
        ring.x *= scaleX;
        ring.radius *= scaleX;
        ring.maxRadius *= scaleX;
      }
      for (const text of state.floatingTexts) text.x *= scaleX;
      state.viewportWidth = w;
      state.physicsAccumulator = 0;
    },
    onUpdate: (ctx, deltaSec, curW, curH) => {
      const state = gameStateRef.current;
      const batch = !isPausedRef.current
        ? getArcadeStepBatch(state.physicsAccumulator, deltaSec)
        : { steps: 0, remainderSec: 0 };
      state.physicsAccumulator = batch.remainderSec;
      const effectFrameScale = !isPausedRef.current ? getFrameScale(deltaSec) : 0;
      if (!state.initialized) {
        initGame(curW);
      }

      const groundY = curH - 90;
      const startX = state.blocks[0] ? state.blocks[0].x : 0;
      const baseWidth = state.blocks[0] ? state.blocks[0].width : 200;

      // Camera shake
      if (state.shake > 0) {
                if (!isArcadeReducedMotion()) {
          ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
        }
        state.shake *= getFrameInvariantDecay(0.88, effectFrameScale);
        if (state.shake < 0.2) state.shake = 0;
      }

      // Smooth camera interpolation
      state.cameraY += (state.targetCameraY - state.cameraY) * getFrameInvariantBlend(0.1, effectFrameScale);

      // Dynamic Sky Gradient based on altitude
      const altitudeProgress = Math.min(1, state.score / 50);
      const skyGrad = ctx.createLinearGradient(0, 0, 0, curH);
      if (altitudeProgress < 0.5) {
        skyGrad.addColorStop(0, '#0F172A');
        skyGrad.addColorStop(1, '#0A0A0B');
      } else {
        skyGrad.addColorStop(0, '#1E1B4B');
        skyGrad.addColorStop(0.6, '#0F172A');
        skyGrad.addColorStop(1, '#0A0A0B');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(-20, -20, curW + 40, curH + 40);

      if (!isPausedRef.current) {
        for (let simStep = 0; simStep < batch.steps; simStep++) {
        // Move current block
        if (state.isAlive) {
          state.currentX += state.speed * state.direction;
          if (state.direction === 1 && state.currentX > curW - state.currentWidth * 0.3) {
            state.direction = -1;
          } else if (state.direction === -1 && state.currentX < -state.currentWidth * 0.7) {
            state.direction = 1;
          }
        }

        // Update Debris Physics
        for (let i = state.debris.length - 1; i >= 0; i--) {
          const d = state.debris[i];
          d.x += d.vx;
          d.vy += 0.45; // Gravity
          d.y -= d.vy;
          d.rotation += d.vRot;

          // Remove off-screen debris
          const debrisRenderY = groundY - d.y + state.cameraY;
          if (debrisRenderY > curH + 100) {
            state.debris.splice(i, 1);
          }
        }

        // Update Shockwave Rings
        for (let i = state.rings.length - 1; i >= 0; i--) {
          const r = state.rings[i];
          r.radius += 3.5;
          r.alpha = Math.max(0, 1 - r.radius / r.maxRadius);
          if (r.alpha <= 0) {
            state.rings.splice(i, 1);
          }
        }
        }
      }

      // --- RENDERING ---

      // Background Altitude Grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let y = 0; y < curH; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(curW, y);
        ctx.stroke();
      }

      // Futuristic Neon Launch Pedestal at Base
      const basePlatformY = groundY + state.currentHeight + state.cameraY;
      if (basePlatformY < curH + 100) {
        ctx.save();
        ctx.fillStyle = '#18181B';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
        ctx.lineWidth = 2;
        ctx.fillRect(startX - 20, basePlatformY, baseWidth + 40, 20);
        ctx.strokeRect(startX - 20, basePlatformY, baseWidth + 40, 20);

        // Neon runway center line
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(startX, basePlatformY + 10);
        ctx.lineTo(startX + baseWidth, basePlatformY + 10);
        ctx.stroke();
        ctx.restore();
      }

      // Height Altitude Indicator on top right
      ctx.fillStyle = '#A1A1AA';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.max(0, state.blocks.length - 1) * 10}m ALTITUDE`, curW - 20, 36);

      // Stacked Blocks (Rendered in pseudo-3D isometric layers)
      state.blocks.forEach((block, idx) => {
        const renderY = groundY - block.y + state.cameraY;
        if (renderY < -60 || renderY > curH + 60) return;

        draw3DBlock(
          ctx,
          block.x,
          renderY,
          block.width,
          block.height,
          block.hue,
          idx === state.blocks.length - 1
        );
      });

      // Draw Shockwave Rings
      state.rings.forEach((r) => {
        const ringY = groundY - r.y + state.cameraY;
        ctx.save();
        ctx.strokeStyle = `hsla(${r.hue}, 90%, 65%, ${r.alpha})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = `hsl(${r.hue}, 90%, 65%)`;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.ellipse(r.x, ringY, r.radius * 1.5, r.radius * 0.75, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });

      // Current Hovering Block
      if (state.isAlive) {
        const currentY = groundY - state.blocks.length * state.currentHeight + state.cameraY;
        const curHue = getHue(state.blocks.length);
        draw3DBlock(
          ctx,
          state.currentX,
          currentY,
          state.currentWidth,
          state.currentHeight,
          curHue,
          true
        );

        // Vertical Alignment Laser Guide Line
        ctx.save();
        ctx.strokeStyle = `hsla(${curHue}, 80%, 60%, 0.25)`;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(state.currentX, 0);
        ctx.lineTo(state.currentX, currentY);
        ctx.moveTo(state.currentX + state.currentWidth, 0);
        ctx.lineTo(state.currentX + state.currentWidth, currentY);
        ctx.stroke();
        ctx.restore();

        // Drop shadow guideline on top block
        ctx.save();
        ctx.fillStyle = `hsla(${curHue}, 80%, 60%, 0.15)`;
        const topBlock = state.blocks[state.blocks.length - 1];
        if (topBlock) {
          const topBlockY = groundY - topBlock.y + state.cameraY;
          ctx.fillRect(state.currentX, topBlockY, state.currentWidth, 4);
        }
        ctx.restore();
      }

      // Sliced Falling Debris
      state.debris.forEach((d) => {
        const dY = groundY - d.y + state.cameraY;
        ctx.save();
        ctx.translate(d.x + d.width / 2, dY + d.height / 2);
        ctx.rotate(d.rotation);
        draw3DBlock(ctx, -d.width / 2, -d.height / 2, d.width, d.height, d.hue, false);
        ctx.restore();
      });

      // Floating Texts
      for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
        const ft = state.floatingTexts[i];
        ft.y += 0.8 * effectFrameScale;
        ft.life += effectFrameScale;
        const alpha = Math.max(0, 1 - ft.life / ft.maxLife);
        const ftY = groundY - ft.y + state.cameraY - 20;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = ft.color;
        ctx.shadowBlur = 10;
        ctx.fillText(ft.text, ft.x, ftY);
        ctx.restore();

        if (ft.life >= ft.maxLife) {
          state.floatingTexts.splice(i, 1);
        }
      }

      return state.isAlive;
    },
  });

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none game-canvas-container touch-none">
      <canvas ref={canvasRef} className="w-full h-full block cursor-pointer touch-none" />

      <div className="absolute top-3 left-3 z-10 pointer-events-none rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-1.5 font-mono text-[10px] font-black text-zinc-200 backdrop-blur-md">
        FOCUS {focusHud.charges}/{STACK_FOCUS_MAX_CHARGES}
        {focusHud.chain > 0 ? ` • CHAIN x${focusHud.chain}` : ''}
      </div>

      <button
        type="button"
        onClick={armFocus}
        disabled={focusHud.charges <= 0 || focusHud.armed}
        className={`absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-xl border px-4 py-2 font-mono text-[10px] font-black transition-all ${
          focusHud.armed
            ? 'border-amber-300 bg-amber-400/25 text-amber-200'
            : focusHud.charges > 0
            ? 'border-cyan-400/50 bg-zinc-950/85 text-cyan-200 hover:bg-cyan-500/15'
            : 'cursor-not-allowed border-zinc-800 bg-zinc-950/70 text-zinc-600'
        }`}
      >
        {focusHud.armed ? 'FOCUS ARMED • 2PX WINDOW' : `ARM FOCUS [F/SHIFT] • ${focusHud.charges} CHARGE${focusHud.charges === 1 ? '' : 'S'}`}
      </button>
    </div>
  );
};

function draw3DBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  hue: number,
  isGlowing: boolean
) {
  const depth = 10;

  ctx.save();
  if (isGlowing) {
    ctx.shadowColor = `hsl(${hue}, 85%, 60%)`;
    ctx.shadowBlur = 16;
  }

  // 1. Right side face (darker shaded)
  ctx.fillStyle = `hsl(${hue}, 80%, 32%)`;
  ctx.beginPath();
  ctx.moveTo(x + w, y);
  ctx.lineTo(x + w + depth, y - depth);
  ctx.lineTo(x + w + depth, y + h - depth);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();

  // 2. Top face (lighter specular)
  ctx.fillStyle = `hsl(${hue}, 90%, 75%)`;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + depth, y - depth);
  ctx.lineTo(x + w + depth, y - depth);
  ctx.lineTo(x + w, y);
  ctx.closePath();
  ctx.fill();

  // 3. Front face (primary gradient)
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, `hsl(${hue}, 85%, 60%)`);
  grad.addColorStop(1, `hsl(${hue}, 85%, 45%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // Front face top border highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillRect(x, y, w, 2);

  ctx.restore();
}
