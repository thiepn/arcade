import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Zap } from 'lucide-react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';
import {
  NEON_RAIL_PHASE_COOLDOWN,
  NEON_RAIL_PLAYER_Y,
  clampNeonRailLane,
  createNeonRailPattern,
  getNeonRailLaneX,
  getNeonRailSpawnInterval,
  getNeonRailSpeed,
  type NeonRailLane,
} from '../lib/neonRailShift';
import {
  createNeonRailChallengePattern,
  createNeonRailPhrase,
  type NeonRailPhraseName,
} from '../lib/neonRailDepth';
import {
  NEON_RAIL_MAX_SURGE_CHARGES,
  NEON_RAIL_SURGE_DURATION,
  getNeonRailMasteryReward,
  getNeonRailSurgeScoreMultiplier,
  getNeonRailSurgeSpeedMultiplier,
  isNeonRailMasteryMilestone,
} from '../lib/neonRailMastery';

type RailObjectKind = 'barrier' | 'core';

interface RailObject {
  id: number;
  kind: RailObjectKind;
  lane: NeonRailLane;
  y: number;
  previousY: number;
  phaseCore?: boolean;
}

interface RailParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface RailPopup {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

export const NeonRailShiftGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const setSafeTimeout = useSafeTimeout();

  const [hudState, setHudState] = useState({
    score: 0,
    combo: 0,
    speed: 1,
    phaseCooldown: 0,
    phraseName: 'SWITCHBACK' as NeonRailPhraseName,
    surgeCharges: 0,
    surgeTimer: 0,
  });

  const gameStateRef = useRef({
    isAlive: true,
    elapsed: 0,
    score: 0,
    survivalScore: 0,
    bonusScore: 0,
    combo: 0,
    playerLane: 1 as NeonRailLane,
    visualLane: 1,
    lastSafeLane: 1 as NeonRailLane,
    rowIndex: 0,
    phraseLanes: [1] as NeonRailLane[],
    phraseStep: 0,
    phraseName: 'SWITCHBACK' as NeonRailPhraseName,
    spawnTimer: 0.75,
    phaseCooldown: 0,
    phaseTimer: 0,
    surgeCharges: 0,
    surgeTimer: 0,
    screenShake: 0,
    objects: [] as RailObject[],
    particles: [] as RailParticle[],
    popups: [] as RailPopup[],
    nextId: 1,
    lastHudSync: 0,
  });

  const shiftToLane = (lane: number) => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current) return;
    const nextLane = clampNeonRailLane(lane);
    if (nextLane === state.playerLane) return;
    state.playerLane = nextLane;
    if (soundEnabled) sounds.playWhoosh();
  };

  const shiftLane = (direction: -1 | 1) => {
    shiftToLane(gameStateRef.current.playerLane + direction);
  };

  const triggerPhase = () => {
    const state = gameStateRef.current;
    if (
      !state.isAlive ||
      isPausedRef.current ||
      state.phaseCooldown > 0 ||
      state.phaseTimer > 0
    ) {
      return;
    }
    state.phaseTimer = 0.5;
    state.phaseCooldown = NEON_RAIL_PHASE_COOLDOWN;
    state.screenShake = Math.max(state.screenShake, 3.5);
    if (soundEnabled) sounds.playShockwave();
  };

  const triggerSurge = () => {
    const state = gameStateRef.current;
    if (
      !state.isAlive ||
      isPausedRef.current ||
      state.surgeCharges <= 0 ||
      state.surgeTimer > 0
    ) {
      return;
    }
    state.surgeCharges--;
    state.surgeTimer = NEON_RAIL_SURGE_DURATION;
    state.screenShake = Math.max(state.screenShake, 4);
    if (soundEnabled) sounds.playFeverMode();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.code === 'ArrowLeft' ||
        event.code === 'ArrowRight' ||
        event.code === 'KeyA' ||
        event.code === 'KeyD' ||
        event.code === 'Space' ||
        event.code === 'ShiftLeft' ||
        event.code === 'ShiftRight'
      ) {
        event.preventDefault();
      }
      if (event.repeat && event.code === 'Space') return;
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') shiftLane(-1);
      if (event.code === 'ArrowRight' || event.code === 'KeyD') shiftLane(1);
      if (event.code === 'Space') triggerPhase();
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') triggerSurge();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    if (!containerRef.current || isPausedRef.current) return;
    event.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const normalized = localX / Math.max(1, rect.width);
    const lane = normalized < 1 / 3 ? 0 : normalized > 2 / 3 ? 2 : 1;
    shiftToLane(lane);
  };

  const finishGame = (impactX: number, impactY: number) => {
    const state = gameStateRef.current;
    if (!state.isAlive) return;
    state.isAlive = false;
    state.screenShake = 14;
    if (soundEnabled) sounds.playExplosion();

    for (let index = 0; index < 26; index++) {
      const angle = (Math.PI * 2 * index) / 26 + Math.random() * 0.2;
      const speed = 65 + Math.random() * 170;
      state.particles.push({
        x: impactX,
        y: impactY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.65,
        maxLife: 0.65,
        color: index % 3 === 0 ? '#FFFFFF' : '#F43F5E',
        size: 2 + Math.random() * 4,
      });
    }

    setSafeTimeout(() => onGameOver(state.score), 420);
  };

  useEffect(() => {
    const state = gameStateRef.current;
    state.isAlive = true;
    state.elapsed = 0;
    state.score = 0;
    state.survivalScore = 0;
    state.bonusScore = 0;
    state.combo = 0;
    state.playerLane = 1;
    state.visualLane = 1;
    state.lastSafeLane = 1;
    state.rowIndex = 0;
    state.phraseLanes = [1];
    state.phraseStep = 0;
    state.phraseName = 'SWITCHBACK';
    state.spawnTimer = 0.75;
    state.phaseCooldown = 0;
    state.phaseTimer = 0;
    state.surgeCharges = 0;
    state.surgeTimer = 0;
    state.screenShake = 0;
    state.objects = [];
    state.particles = [];
    state.popups = [];
  }, []);

  useGameLoop({
    canvasRef,
    isPaused,
    onUpdate: (ctx, deltaSec, width, height) => {
      const dt = Math.min(deltaSec, 0.08);
      const state = gameStateRef.current;
      const now = performance.now();
      const horizonY = height * 0.14;
      const floorY = height * 0.96;
      const trackHeight = floorY - horizonY;
      const playerScreenY = horizonY + trackHeight * NEON_RAIL_PLAYER_Y;
      const surgeActive = state.surgeTimer > 0;
      const surgeScoreMultiplier = getNeonRailSurgeScoreMultiplier(surgeActive);
      const currentSpeed =
        getNeonRailSpeed(state.elapsed) * getNeonRailSurgeSpeedMultiplier(surgeActive);

      if (!isPausedRef.current && state.isAlive) {
        state.elapsed += dt;
        state.phaseCooldown = Math.max(0, state.phaseCooldown - dt);
        state.phaseTimer = Math.max(0, state.phaseTimer - dt);
        state.surgeTimer = Math.max(0, state.surgeTimer - dt);
        state.screenShake = Math.max(0, state.screenShake - 20 * dt);
        state.visualLane += (state.playerLane - state.visualLane) * Math.min(1, dt * 12);

        state.survivalScore += dt * (55 + currentSpeed * 70) * surgeScoreMultiplier;
        state.score = Math.floor(state.survivalScore + state.bonusScore);

        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          if (state.phraseStep >= state.phraseLanes.length) {
            const phrase = createNeonRailPhrase(state.lastSafeLane, Math.random());
            state.phraseLanes = phrase.lanes;
            state.phraseStep = 0;
            state.phraseName = phrase.name;
          }
          const safeLane = state.phraseLanes[state.phraseStep++];
          const pattern = createNeonRailChallengePattern(
            safeLane,
            state.rowIndex,
            Math.random(),
          );
          state.lastSafeLane = pattern.safeLane;
          state.rowIndex++;

          for (const lane of pattern.blockedLanes) {
            state.objects.push({
              id: state.nextId++,
              kind: 'barrier',
              lane,
              y: -0.04,
              previousY: -0.04,
            });
          }
          state.objects.push({
            id: state.nextId++,
            kind: 'core',
            lane: pattern.coreLane,
            y: pattern.phaseOpportunity ? -0.18 : -0.1,
            previousY: pattern.phaseOpportunity ? -0.18 : -0.1,
            phaseCore: pattern.phaseOpportunity,
          });
          state.spawnTimer += getNeonRailSpawnInterval(state.elapsed);
        }

        for (let index = state.objects.length - 1; index >= 0; index--) {
          const object = state.objects[index];
          object.previousY = object.y;
          object.y += currentSpeed * dt;

          const crossedPlayer =
            object.previousY < NEON_RAIL_PLAYER_Y &&
            object.y >= NEON_RAIL_PLAYER_Y;

          if (crossedPlayer) {
            if (object.kind === 'barrier' && object.lane === state.playerLane) {
              const impactX = getNeonRailLaneX(
                object.lane,
                NEON_RAIL_PLAYER_Y,
                width,
              );
              if (state.phaseTimer > 0) {
                const phaseBreakPoints = 180 * surgeScoreMultiplier;
                state.bonusScore += phaseBreakPoints;
                state.score = Math.floor(state.survivalScore + state.bonusScore);
                state.screenShake = Math.max(state.screenShake, 5);
                state.popups.push({
                  id: state.nextId++,
                  x: impactX,
                  y: playerScreenY - 18,
                  text: `PHASE BREAK +${phaseBreakPoints}`,
                  color: '#A78BFA',
                  life: 0.75,
                });
                for (let burst = 0; burst < 12; burst++) {
                  const angle = (Math.PI * 2 * burst) / 12;
                  state.particles.push({
                    x: impactX,
                    y: playerScreenY,
                    vx: Math.cos(angle) * (55 + Math.random() * 65),
                    vy: Math.sin(angle) * (55 + Math.random() * 65),
                    life: 0.42,
                    maxLife: 0.42,
                    color: '#A78BFA',
                    size: 2.5,
                  });
                }
                state.objects.splice(index, 1);
                if (soundEnabled) sounds.playPowerUp();
                continue;
              }

              finishGame(impactX, playerScreenY);
            }

            if (object.kind === 'core') {
              if (object.lane === state.playerLane) {
                state.combo++;
                const multiplier = Math.min(5, 1 + Math.floor(state.combo / 4));
                const phaseRouteMultiplier = object.phaseCore ? 3 : 1;
                const points = 120 * multiplier * phaseRouteMultiplier * surgeScoreMultiplier;
                state.bonusScore += points;

                if (isNeonRailMasteryMilestone(state.combo)) {
                  const masteryReward = getNeonRailMasteryReward(state.combo);
                  const gainedCharge = state.surgeCharges < NEON_RAIL_MAX_SURGE_CHARGES;
                  state.surgeCharges = Math.min(
                    NEON_RAIL_MAX_SURGE_CHARGES,
                    state.surgeCharges + 1,
                  );
                  state.bonusScore += masteryReward;
                  state.popups.push({
                    id: state.nextId++,
                    x: width / 2,
                    y: playerScreenY - 48,
                    text: gainedCharge
                      ? `ROUTE MASTERED +${masteryReward} • SURGE +1`
                      : `ROUTE MASTERED +${masteryReward} • SURGE FULL`,
                    color: '#FB923C',
                    life: 1.15,
                  });
                  if (soundEnabled) sounds.playPowerUp();
                }

                state.score = Math.floor(state.survivalScore + state.bonusScore);
                state.popups.push({
                  id: state.nextId++,
                  x: getNeonRailLaneX(object.lane, NEON_RAIL_PLAYER_Y, width),
                  y: playerScreenY - 20,
                  text: object.phaseCore
                    ? `PHASE ROUTE x3 +${points}`
                    : state.combo >= 4
                    ? `CHAIN x${multiplier} +${points}`
                    : `CORE +${points}`,
                  color: object.phaseCore || multiplier > 1 ? '#FACC15' : '#34D399',
                  life: 0.8,
                });
                if (soundEnabled) sounds.playCombo(Math.min(18, state.combo));
              } else {
                state.combo = 0;
              }
              state.objects.splice(index, 1);
              continue;
            }
          }

          if (object.y > 1.08) state.objects.splice(index, 1);
        }

        for (let index = state.particles.length - 1; index >= 0; index--) {
          const particle = state.particles[index];
          particle.x += particle.vx * dt;
          particle.y += particle.vy * dt;
          particle.vx *= Math.pow(0.94, dt * 60);
          particle.vy *= Math.pow(0.94, dt * 60);
          particle.life -= dt;
          if (particle.life <= 0) state.particles.splice(index, 1);
        }

        for (let index = state.popups.length - 1; index >= 0; index--) {
          const popup = state.popups[index];
          popup.y -= 24 * dt;
          popup.life -= dt;
          if (popup.life <= 0) state.popups.splice(index, 1);
        }

        if (now - state.lastHudSync > 120) {
          state.lastHudSync = now;
          onScoreUpdate(state.score);
          setHudState({
            score: state.score,
            combo: state.combo,
            speed: currentSpeed / 0.34,
            phaseCooldown: state.phaseCooldown,
            phraseName: state.phraseName,
            surgeCharges: state.surgeCharges,
            surgeTimer: state.surgeTimer,
          });
        }
      }

      const shakeX = state.screenShake > 0 ? (Math.random() - 0.5) * state.screenShake : 0;
      const shakeY = state.screenShake > 0 ? (Math.random() - 0.5) * state.screenShake * 0.45 : 0;

      ctx.save();
      ctx.translate(shakeX, shakeY);

      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, '#030712');
      bg.addColorStop(0.52, '#07101D');
      bg.addColorStop(1, '#050508');
      ctx.fillStyle = bg;
      ctx.fillRect(-20, -20, width + 40, height + 40);

      const horizonGlow = ctx.createRadialGradient(
        width / 2,
        horizonY,
        0,
        width / 2,
        horizonY,
        Math.max(width, height) * 0.55,
      );
      horizonGlow.addColorStop(0, 'rgba(56,189,248,0.2)');
      horizonGlow.addColorStop(0.35, 'rgba(139,92,246,0.08)');
      horizonGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = horizonGlow;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(56,189,248,0.14)';
      ctx.lineWidth = 1;
      for (let index = 0; index < 11; index++) {
        const progress = ((index / 11 + state.elapsed * currentSpeed * 0.34) % 1);
        const eased = progress * progress;
        const y = horizonY + trackHeight * eased;
        const left = getNeonRailLaneX(0, eased, width) - 54 * eased;
        const right = getNeonRailLaneX(2, eased, width) + 54 * eased;
        ctx.globalAlpha = 0.22 + eased * 0.5;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      for (const lane of [0, 1, 2] as NeonRailLane[]) {
        const topX = getNeonRailLaneX(lane, 0, width);
        const bottomX = getNeonRailLaneX(lane, 1, width);
        ctx.strokeStyle = lane === state.playerLane
          ? 'rgba(34,211,238,0.52)'
          : 'rgba(71,85,105,0.38)';
        ctx.shadowColor = lane === state.playerLane ? '#22D3EE' : 'transparent';
        ctx.shadowBlur = lane === state.playerLane ? 10 : 0;
        ctx.lineWidth = lane === state.playerLane ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(topX, horizonY);
        ctx.lineTo(bottomX, floorY);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      ctx.strokeStyle = 'rgba(244,63,94,0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(getNeonRailLaneX(0, 1, width) - 62, floorY);
      ctx.lineTo(width / 2 - 42, horizonY);
      ctx.moveTo(getNeonRailLaneX(2, 1, width) + 62, floorY);
      ctx.lineTo(width / 2 + 42, horizonY);
      ctx.stroke();

      for (const object of state.objects) {
        const progress = Math.max(0, Math.min(1, object.y));
        const x = getNeonRailLaneX(object.lane, progress, width);
        const y = horizonY + trackHeight * progress;
        const scale = 0.38 + progress * 1.05;

        if (object.kind === 'barrier') {
          const barrierWidth = 46 * scale;
          const barrierHeight = 18 * scale;
          ctx.save();
          ctx.translate(x, y);
          ctx.fillStyle = 'rgba(244,63,94,0.18)';
          ctx.strokeStyle = '#F43F5E';
          ctx.shadowColor = '#F43F5E';
          ctx.shadowBlur = 14 * scale;
          ctx.lineWidth = Math.max(1.2, 2.3 * scale);
          ctx.beginPath();
          ctx.roundRect(-barrierWidth / 2, -barrierHeight / 2, barrierWidth, barrierHeight, 5 * scale);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#FFFFFF';
          ctx.globalAlpha = 0.72;
          ctx.fillRect(-barrierWidth * 0.28, -1 * scale, barrierWidth * 0.56, 2 * scale);
          ctx.restore();
        } else {
          const size = 9 * scale;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(state.elapsed * 2.8 + object.id);
          ctx.fillStyle = object.phaseCore ? '#FACC15' : '#34D399';
          ctx.strokeStyle = object.phaseCore ? '#FEF08A' : '#A7F3D0';
          ctx.shadowColor = object.phaseCore ? '#FACC15' : '#34D399';
          ctx.shadowBlur = 16 * scale;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, -size);
          ctx.lineTo(size, 0);
          ctx.lineTo(0, size);
          ctx.lineTo(-size, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      const playerDepth = NEON_RAIL_PLAYER_Y;
      const playerSpread = Math.min(width * 0.29, 210) * playerDepth +
        Math.min(width * 0.29, 210) * 0.28 * (1 - playerDepth);
      const playerX = width / 2 + (state.visualLane - 1) * playerSpread;
      const playerY = playerScreenY;

      ctx.save();
      ctx.translate(playerX, playerY);
      if (state.surgeTimer > 0) {
        const surgePulse = 31 + Math.sin(state.elapsed * 26) * 4;
        ctx.strokeStyle = '#FB923C';
        ctx.shadowColor = '#FB923C';
        ctx.shadowBlur = 20;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.78;
        ctx.beginPath();
        ctx.arc(0, 0, surgePulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (state.phaseTimer > 0) {
        const pulse = 26 + Math.sin(state.elapsed * 22) * 5;
        ctx.strokeStyle = '#A78BFA';
        ctx.shadowColor = '#A78BFA';
        ctx.shadowBlur = 18;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.arc(0, 0, pulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.shadowColor = '#22D3EE';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#22D3EE';
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(15, 13);
      ctx.lineTo(0, 8);
      ctx.lineTo(-15, 13);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(5, 6);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      for (const particle of state.particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
        ctx.fillStyle = particle.color;
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (const popup of state.popups) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, popup.life * 2);
        ctx.fillStyle = popup.color;
        ctx.shadowColor = popup.color;
        ctx.shadowBlur = 8;
        ctx.font = '900 12px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(popup.text, popup.x, popup.y);
        ctx.restore();
      }

      ctx.restore();

      return state.isAlive;
    },
  });

  return (
    <div
      ref={containerRef}
      id="neon-rail-shift-container"
      onPointerDown={handlePointerDown}
      className="relative h-full min-h-0 w-full overflow-hidden bg-[#030712] select-none touch-none"
    >
      <div className="pointer-events-none absolute left-2.5 right-2.5 top-2.5 z-10 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="rounded-xl border border-cyan-400/25 bg-slate-950/80 px-2.5 py-1 font-mono text-xs font-black text-cyan-300 backdrop-blur-md">
            SCORE {hudState.score.toLocaleString()}
          </div>
          <div className="rounded-xl border border-slate-600/40 bg-slate-950/75 px-2 py-1 font-mono text-[9px] font-black text-slate-300">
            {hudState.phraseName.replace('_', ' ')}
          </div>
          {hudState.combo > 1 && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-2 py-1 font-mono text-[10px] font-black text-amber-300">
              CORE STREAK {hudState.combo}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="rounded-xl border border-violet-400/25 bg-slate-950/80 px-2.5 py-1 font-mono text-[10px] font-black text-violet-300 backdrop-blur-md">
            {hudState.phaseCooldown <= 0 ? 'PHASE READY' : `PHASE ${hudState.phaseCooldown.toFixed(1)}s`}
          </div>
          <div className={`rounded-lg border px-2 py-0.5 font-mono text-[9px] font-black ${
            hudState.surgeTimer > 0
              ? 'border-orange-400/45 bg-orange-500/20 text-orange-200'
              : hudState.surgeCharges > 0
                ? 'border-orange-400/30 bg-slate-950/80 text-orange-300'
                : 'border-slate-700/50 bg-slate-950/70 text-slate-500'
          }`}>
            {hudState.surgeTimer > 0
              ? `SURGE ${hudState.surgeTimer.toFixed(1)}s • 2x SCORE`
              : `SURGE ${hudState.surgeCharges}/${NEON_RAIL_MAX_SURGE_CHARGES} • SHIFT`}
          </div>
          <div className="font-mono text-[9px] font-bold text-slate-500">
            {hudState.speed.toFixed(2)}x RAIL SPEED
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="block h-full w-full" />

      <div className="absolute bottom-2 left-2 right-2 z-20 grid grid-cols-4 gap-2 sm:hidden">
        <button
          type="button"
          onClick={() => shiftLane(-1)}
          className="flex h-11 items-center justify-center rounded-xl border border-cyan-400/25 bg-slate-950/88 text-cyan-200 active:scale-95"
          aria-label="Shift one rail left"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={triggerPhase}
          disabled={hudState.phaseCooldown > 0}
          className="flex h-11 flex-col items-center justify-center rounded-xl border border-violet-400/35 bg-violet-500/15 text-violet-200 active:scale-95 disabled:opacity-35 disabled:active:scale-100"
          aria-label="Activate phase shield"
        >
          <Zap className="h-4 w-4" />
          <span className="mt-0.5 font-mono text-[7px] font-black">PHASE</span>
        </button>
        <button
          type="button"
          onClick={triggerSurge}
          disabled={hudState.surgeCharges <= 0 || hudState.surgeTimer > 0}
          className="flex h-11 flex-col items-center justify-center rounded-xl border border-orange-400/35 bg-orange-500/15 text-orange-200 active:scale-95 disabled:opacity-35 disabled:active:scale-100"
          aria-label="Activate score surge"
        >
          <Zap className="h-4 w-4" />
          <span className="mt-0.5 font-mono text-[7px] font-black">SURGE</span>
        </button>
        <button
          type="button"
          onClick={() => shiftLane(1)}
          className="flex h-11 items-center justify-center rounded-xl border border-cyan-400/25 bg-slate-950/88 text-cyan-200 active:scale-95"
          aria-label="Shift one rail right"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 rounded-full border border-slate-700/60 bg-slate-950/75 px-3 py-1 font-mono text-[9px] font-bold text-slate-400 backdrop-blur sm:block">
        A / D or ← / →: Shift rail · Space: Phase
      </div>
    </div>
  );
};
