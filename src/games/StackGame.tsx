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
import {
  advanceStackBlueprint,
  classifyStackPlacement,
  createStackBlueprintState,
  getStackBlueprintExpectedPlacement,
  getStackBlueprintLabel,
  type StackBlueprintState,
} from '../lib/stackBlueprints';
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

const getBlueprintHud = (state: StackBlueprintState) => ({
  label: getStackBlueprintLabel(state),
  expected: getStackBlueprintExpectedPlacement(state),
  completions: state.completions,
});

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
  const [focusHud, setFocusHud] = useState({ charges: STACK_FOCUS_START_CHARGES, armed: false, chain: 0 });
  const [blueprintHud, setBlueprintHud] = useState(() => getBlueprintHud(createStackBlueprintState()));

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
    blueprintState: createStackBlueprintState(),
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
    setFocusHud({ charges: state.focusCharges, armed: state.focusArmed, chain: state.focusChain });
  };

  const publishBlueprintHud = () => setBlueprintHud(getBlueprintHud(gameStateRef.current.blueprintState));

  const armFocus = () => {
    const state = gameStateRef.current;
    if (!canArmStackFocus(state.focusCharges, state.focusArmed, state.isAlive) || isPausedRef.current) return;
    state.focusCharges--;
    state.focusArmed = true;
    publishFocusHud();
    if (soundEnabled) sounds.playPowerUp();
  };

  const getHue = (index: number) => (index * 24 + 190) % 360;

  const applyBlueprintPlacement = (
    diff: number,
    overlapWidth: number,
    perfect: boolean,
    focusAttempt: boolean,
  ) => {
    const state = gameStateRef.current;
    const placement = classifyStackPlacement(diff, state.currentWidth, overlapWidth, perfect, focusAttempt);
    const result = advanceStackBlueprint(state.blueprintState, placement, state.blocks.length + 1);
    state.blueprintState = result.state;
    publishBlueprintHud();

    if (result.completed) {
      state.score += result.bonus;
      state.rings.push({
        x: state.currentX + overlapWidth / 2,
        y: state.blocks.length * state.currentHeight,
        radius: 8,
        maxRadius: 110,
        hue: 185,
        alpha: 1,
      });
      state.floatingTexts.push({
        x: state.currentX + overlapWidth / 2,
        y: state.blocks.length * state.currentHeight + 54,
        text: `BLUEPRINT COMPLETE +${result.bonus}`,
        color: '#67E8F9',
        life: 0,
        maxLife: 58,
      });
      haptics.combo();
      if (soundEnabled) sounds.playSuccess();
    } else if (result.progressed) {
      state.floatingTexts.push({
        x: state.currentX + overlapWidth / 2,
        y: state.blocks.length * state.currentHeight + 42,
        text: `BLUEPRINT ${placement}`,
        color: '#A5F3FC',
        life: 0,
        maxLife: 32,
      });
    }
  };

  const spawnNextBlock = () => {
    const state = gameStateRef.current;
    state.direction *= -1;
    state.currentX = state.direction === 1 ? -state.currentWidth : state.viewportWidth + state.currentWidth * 0.15;
    state.speed = 3.5 * clamp(state.viewportWidth / 500, 0.85, 1.7)
      + Math.min(4.5, Math.max(0, state.blocks.length - 1) * 0.08);
    if (state.blocks.length > 5) state.targetCameraY = (state.blocks.length - 5) * state.currentHeight;
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
    if (focusAttempt) state.focusArmed = false;

    if (absDiff <= perfectWindow) {
      state.perfectStreak++;
      state.currentX = prevBlock.x;
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
      applyBlueprintPlacement(diff, state.currentWidth, true, focusAttempt);
      publishFocusHud();
      onScoreUpdate(state.score);

      state.rings.push({
        x: state.currentX + state.currentWidth / 2,
        y: state.blocks.length * state.currentHeight,
        radius: 10,
        maxRadius: 75,
        hue: getHue(state.blocks.length),
        alpha: 1,
      });
      state.floatingTexts.push({
        x: state.currentX + state.currentWidth / 2,
        y: state.blocks.length * state.currentHeight + 20,
        text: state.perfectStreak >= 3 ? `PERFECT x${state.perfectStreak}!` : 'PERFECT!',
        color: '#38BDF8',
        life: 0,
        maxLife: 35,
      });

      if (state.perfectStreak >= 3) haptics.combo(); else haptics.score();
      if (soundEnabled) sounds.playScore();

      state.blocks.push({
        x: state.currentX,
        y: state.blocks.length * state.currentHeight,
        width: state.currentWidth,
        height: state.currentHeight,
        hue: getHue(state.blocks.length),
      });
      spawnNextBlock();
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

    if (absDiff >= state.currentWidth) {
      state.isAlive = false;
      state.shake = 14;
      haptics.gameOver();
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
      setSafeTimeout(() => onGameOver(state.score), 700);
      return;
    }

    const originalWidth = state.currentWidth;
    const newWidth = originalWidth - absDiff;
    const newX = diff > 0 ? state.currentX : prevBlock.x;
    const debrisX = diff > 0 ? prevBlock.x + originalWidth : state.currentX;
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

    applyBlueprintPlacement(diff, newWidth, false, focusAttempt);
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
    spawnNextBlock();
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
    state.blueprintState = createStackBlueprintState();
    setFocusHud({ charges: STACK_FOCUS_START_CHARGES, armed: false, chain: 0 });
    setBlueprintHud(getBlueprintHud(state.blueprintState));
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
    state.blocks = [{ x: startX, y: 0, width: baseWidth, height: 26, hue: getHue(0) }];
    state.initialized = true;
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      event.preventDefault();
      placeBlock();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight' || event.code === 'KeyF') {
        event.preventDefault();
        armFocus();
        return;
      }
      if (event.key === ' ' || event.key === 'Spacebar' || event.key === 'Enter') {
        event.preventDefault();
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
      const batch = !isPausedRef.current ? getArcadeStepBatch(state.physicsAccumulator, deltaSec) : { steps: 0, remainderSec: 0 };
      state.physicsAccumulator = batch.remainderSec;
      const effectFrameScale = !isPausedRef.current ? getFrameScale(deltaSec) : 0;
      if (!state.initialized) initGame(curW);

      const groundY = curH - 90;
      const startX = state.blocks[0] ? state.blocks[0].x : 0;
      const baseWidth = state.blocks[0] ? state.blocks[0].width : 200;

      if (state.shake > 0) {
        if (!isArcadeReducedMotion()) ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
        state.shake *= getFrameInvariantDecay(0.88, effectFrameScale);
        if (state.shake < 0.2) state.shake = 0;
      }
      state.cameraY += (state.targetCameraY - state.cameraY) * getFrameInvariantBlend(0.1, effectFrameScale);

      const altitudeProgress = Math.min(1, state.score / 50);
      const skyGradient = ctx.createLinearGradient(0, 0, 0, curH);
      if (altitudeProgress < 0.5) {
        skyGradient.addColorStop(0, '#0F172A');
        skyGradient.addColorStop(1, '#0A0A0B');
      } else {
        skyGradient.addColorStop(0, '#1E1B4B');
        skyGradient.addColorStop(0.6, '#0F172A');
        skyGradient.addColorStop(1, '#0A0A0B');
      }
      ctx.fillStyle = skyGradient;
      ctx.fillRect(-20, -20, curW + 40, curH + 40);

      if (!isPausedRef.current) {
        for (let simStep = 0; simStep < batch.steps; simStep++) {
          if (state.isAlive) {
            state.currentX += state.speed * state.direction;
            if (state.direction === 1 && state.currentX > curW - state.currentWidth * 0.3) state.direction = -1;
            else if (state.direction === -1 && state.currentX < -state.currentWidth * 0.7) state.direction = 1;
          }
          for (let i = state.debris.length - 1; i >= 0; i--) {
            const debris = state.debris[i];
            debris.x += debris.vx;
            debris.vy += 0.45;
            debris.y -= debris.vy;
            debris.rotation += debris.vRot;
            if (groundY - debris.y + state.cameraY > curH + 100) state.debris.splice(i, 1);
          }
          for (let i = state.rings.length - 1; i >= 0; i--) {
            const ring = state.rings[i];
            ring.radius += 3.5;
            ring.alpha = Math.max(0, 1 - ring.radius / ring.maxRadius);
            if (ring.alpha <= 0) state.rings.splice(i, 1);
          }
        }
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let y = 0; y < curH; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(curW, y); ctx.stroke();
      }

      const basePlatformY = groundY + state.currentHeight + state.cameraY;
      if (basePlatformY < curH + 100) {
        ctx.save();
        ctx.fillStyle = '#18181B'; ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)'; ctx.lineWidth = 2;
        ctx.fillRect(startX - 20, basePlatformY, baseWidth + 40, 20); ctx.strokeRect(startX - 20, basePlatformY, baseWidth + 40, 20);
        ctx.strokeStyle = '#38BDF8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(startX, basePlatformY + 10); ctx.lineTo(startX + baseWidth, basePlatformY + 10); ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = '#A1A1AA'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'right';
      ctx.fillText(`${Math.max(0, state.blocks.length - 1) * 10}m ALTITUDE`, curW - 20, 36);

      state.blocks.forEach((block, index) => {
        const renderY = groundY - block.y + state.cameraY;
        if (renderY < -60 || renderY > curH + 60) return;
        draw3DBlock(ctx, block.x, renderY, block.width, block.height, block.hue, index === state.blocks.length - 1);
      });

      state.rings.forEach((ring) => {
        const ringY = groundY - ring.y + state.cameraY;
        ctx.save(); ctx.strokeStyle = `hsla(${ring.hue}, 90%, 65%, ${ring.alpha})`; ctx.lineWidth = 3; ctx.shadowColor = `hsl(${ring.hue}, 90%, 65%)`; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.ellipse(ring.x, ringY, ring.radius * 1.5, ring.radius * 0.75, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      });

      if (state.isAlive) {
        const currentY = groundY - state.blocks.length * state.currentHeight + state.cameraY;
        const currentHue = getHue(state.blocks.length);
        draw3DBlock(ctx, state.currentX, currentY, state.currentWidth, state.currentHeight, currentHue, true);
        ctx.save();
        ctx.strokeStyle = `hsla(${currentHue}, 80%, 60%, 0.25)`; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(state.currentX, 0); ctx.lineTo(state.currentX, currentY); ctx.moveTo(state.currentX + state.currentWidth, 0); ctx.lineTo(state.currentX + state.currentWidth, currentY); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.fillStyle = `hsla(${currentHue}, 80%, 60%, 0.15)`;
        const topBlock = state.blocks[state.blocks.length - 1];
        if (topBlock) ctx.fillRect(state.currentX, groundY - topBlock.y + state.cameraY, state.currentWidth, 4);
        ctx.restore();
      }

      state.debris.forEach((debris) => {
        const debrisY = groundY - debris.y + state.cameraY;
        ctx.save(); ctx.translate(debris.x + debris.width / 2, debrisY + debris.height / 2); ctx.rotate(debris.rotation);
        draw3DBlock(ctx, -debris.width / 2, -debris.height / 2, debris.width, debris.height, debris.hue, false); ctx.restore();
      });

      for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
        const text = state.floatingTexts[i];
        text.y += 0.8 * effectFrameScale;
        text.life += effectFrameScale;
        const alpha = Math.max(0, 1 - text.life / text.maxLife);
        const renderY = groundY - text.y + state.cameraY - 20;
        ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = text.color; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.shadowColor = text.color; ctx.shadowBlur = 10; ctx.fillText(text.text, text.x, renderY); ctx.restore();
        if (text.life >= text.maxLife) state.floatingTexts.splice(i, 1);
      }

      return state.isAlive;
    },
  });

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none game-canvas-container touch-none">
      <canvas ref={canvasRef} className="w-full h-full block cursor-pointer touch-none" />

      <div className="absolute top-3 left-3 z-10 pointer-events-none flex flex-col gap-1.5">
        <div className="rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-1.5 font-mono text-[10px] font-black text-zinc-200 backdrop-blur-md">
          FOCUS {focusHud.charges}/{STACK_FOCUS_MAX_CHARGES}{focusHud.chain > 0 ? ` • CHAIN x${focusHud.chain}` : ''}
        </div>
        <div data-p23-transform="TOWER BLUEPRINT" className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 font-mono text-[9px] font-black text-cyan-200 backdrop-blur-md max-w-60">
          <div>TOWER BLUEPRINT — {blueprintHud.label}</div>
          <div className="text-cyan-100/65 mt-0.5">NEXT: {blueprintHud.expected.replace('_', ' ')}</div>
        </div>
      </div>

      <button
        type="button"
        onClick={armFocus}
        disabled={focusHud.charges <= 0 || focusHud.armed}
        className={`absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-xl border px-4 py-2 font-mono text-[10px] font-black transition-all ${focusHud.armed ? 'border-amber-300 bg-amber-400/25 text-amber-200' : focusHud.charges > 0 ? 'border-cyan-400/50 bg-zinc-950/85 text-cyan-200 hover:bg-cyan-500/15' : 'cursor-not-allowed border-zinc-800 bg-zinc-950/70 text-zinc-600'}`}
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
  width: number,
  height: number,
  hue: number,
  isGlowing: boolean,
) {
  const depth = 10;
  ctx.save();
  if (isGlowing) {
    ctx.shadowColor = `hsl(${hue}, 85%, 60%)`;
    ctx.shadowBlur = 16;
  }
  ctx.fillStyle = `hsl(${hue}, 80%, 32%)`;
  ctx.beginPath(); ctx.moveTo(x + width, y); ctx.lineTo(x + width + depth, y - depth); ctx.lineTo(x + width + depth, y + height - depth); ctx.lineTo(x + width, y + height); ctx.closePath(); ctx.fill();
  ctx.fillStyle = `hsl(${hue}, 90%, 75%)`;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + depth, y - depth); ctx.lineTo(x + width + depth, y - depth); ctx.lineTo(x + width, y); ctx.closePath(); ctx.fill();
  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, `hsl(${hue}, 85%, 60%)`);
  gradient.addColorStop(1, `hsl(${hue}, 85%, 45%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillRect(x, y, width, 2);
  ctx.restore();
}
