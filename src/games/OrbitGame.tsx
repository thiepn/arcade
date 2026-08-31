import React, { useEffect, useRef, useCallback } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';
import { getFrameInvariantBlend, getFrameInvariantDecay, getFrameScale } from '../lib/frameRateRuntime';
import { getOrbitRouteLane, getOrbitRouteName, getOrbitRouteMultiplier, isOrbitNearMiss } from '../lib/orbitMastery';
import {
  ORBIT_FORMATION_COOLDOWN_SEC,
  ORBIT_FORMATION_GRACE_SEC,
  ORBIT_FORMATION_RESOLVE_SEC,
  ORBIT_FORMATION_WARNING_SEC,
  getOrbitFormationBonus,
  getOrbitLaneName,
  getOrbitThreatFormation,
  type OrbitThreatFormation,
  type OrbitThreatTarget,
} from '../lib/orbitThreatMastery';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface CometHazard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  trail: { x: number; y: number; alpha: number }[];
  nearMissAwarded: boolean;
}

interface EnergyCrystal {
  angle: number;
  lane: number;
  radius: number;
  pulse: number;
  color: string;
  spin: number;
  routeIndex: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

interface StarBg {
  x: number;
  y: number;
  size: number;
  alpha: number;
  twinkleSpeed: number;
}

export const OrbitGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const gameStateRef = useRef({
    playerAngle: 0,
    currentRadius: 100,
    targetRadius: 100,
    currentLane: 1, // 0: inner, 1: mid, 2: outer
    orbitSpeed: 0.045,
    direction: 1, // 1: clockwise, -1: counter
    hazards: [] as CometHazard[],
    crystals: [] as EnergyCrystal[],
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    shipTrail: [] as { x: number; y: number; alpha: number; angle: number }[],
    starBg: [] as StarBg[],
    score: 0,
    combo: 1,
    routeIndex: 0,
    lastRouteIndex: -1,
    routeChain: 0,
    nearMissChain: 0,
    lastNearMissAt: -99,
    formationIndex: 0,
    pendingFormation: null as OrbitThreatFormation | null,
    formationWarningTimer: 0,
    formationResolveTimer: 0,
    formationGraceTimer: 0,
    formationCooldownTimer: 4.5,
    formationSafeLane: 1 as 0 | 1 | 2,
    formationChain: 0,
    isAlive: true,
    hazardSpawnElapsedMs: 0,
    crystalSpawnElapsedMs: 0,
    gameTime: 0,
    shake: 0,
    corePulse: 0,
    warpEffect: 0,
    baseRadii: [65, 110, 160],
  });

  const jumpNextLane = () => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current) return;

    state.currentLane = (state.currentLane + 1) % 3;
    state.targetRadius = state.baseRadii[state.currentLane];
    state.warpEffect = 1;
    if (soundEnabled) sounds.playWarp();
  };

  const jumpPrevLane = () => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current) return;

    state.currentLane = (state.currentLane - 1 + 3) % 3;
    state.targetRadius = state.baseRadii[state.currentLane];
    state.warpEffect = 1;
    if (soundEnabled) sounds.playWarp();
  };

  const reverseDirection = () => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current) return;

    state.direction *= -1;
    if (soundEnabled) sounds.playPop();
  };

  const pulseOrbit = () => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current) return;

    state.currentLane = (state.currentLane + 1) % 3;
    state.targetRadius = state.baseRadii[state.currentLane];
    state.direction *= -1;
    state.warpEffect = 1;
    if (soundEnabled) sounds.playWarp();
  };

  const setSafeTimeout = useSafeTimeout();

  const spawnHazard = useCallback((w: number, h: number, cx: number, cy: number) => {
    const state = gameStateRef.current;
    const angle = Math.random() * Math.PI * 2;
    const spawnDist = Math.max(w, h) * 0.65;
    const sx = cx + Math.cos(angle) * spawnDist;
    const sy = cy + Math.sin(angle) * spawnDist;

    // Target with slight random offset
    const targetAngle = angle + Math.PI + (Math.random() - 0.5) * 0.5;
    const speed = 2.0 + Math.min(3.2, state.gameTime * 0.04);

    state.hazards.push({
      x: sx,
      y: sy,
      vx: Math.cos(targetAngle) * speed,
      vy: Math.sin(targetAngle) * speed,
      radius: 8 + Math.random() * 3,
      color: '#F43F5E',
      trail: [],
      nearMissAwarded: false,
    });
  }, []);

  const spawnFormationHazard = useCallback((
    target: OrbitThreatTarget,
    w: number,
    h: number,
    cx: number,
    cy: number,
  ) => {
    const state = gameStateRef.current;
    const targetAngle = state.playerAngle + target.leadRadians * state.direction;
    const laneRadius = state.baseRadii[target.lane];
    const targetX = cx + Math.cos(targetAngle) * laneRadius;
    const targetY = cy + Math.sin(targetAngle) * laneRadius;
    const spawnDist = Math.max(w, h) * 0.72;
    const spawnX = cx + Math.cos(targetAngle) * spawnDist;
    const spawnY = cy + Math.sin(targetAngle) * spawnDist;
    const dx = targetX - spawnX;
    const dy = targetY - spawnY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const speed = 3.3 + Math.min(1.5, state.gameTime * 0.025);

    state.hazards.push({
      x: spawnX,
      y: spawnY,
      vx: (dx / distance) * speed,
      vy: (dy / distance) * speed,
      radius: 9,
      color: '#FB7185',
      trail: [],
      nearMissAwarded: false,
    });
  }, []);

  const spawnCrystal = useCallback(() => {
    const state = gameStateRef.current;
    const routeIndex = state.routeIndex++;
    const lane = getOrbitRouteLane(routeIndex);
    const forwardArc = state.direction > 0 ? 0.8 : -0.8;
    state.crystals.push({
      angle: state.playerAngle + forwardArc + (Math.random() - 0.5) * 0.25,
      lane,
      radius: state.baseRadii[lane],
      pulse: Math.random() * Math.PI * 2,
      spin: 0,
      routeIndex,
      color: lane === 0 ? '#FB923C' : lane === 1 ? '#38BDF8' : '#34D399',
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handlePointerDown = (e: PointerEvent) => {
      e.preventDefault();
      pulseOrbit();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        pulseOrbit();
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        jumpPrevLane();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        jumpNextLane();
      } else if (
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'a' ||
        e.key === 'd' ||
        e.key === 'A' ||
        e.key === 'D'
      ) {
        reverseDirection();
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useGameLoop({
    canvasRef,
    isPaused,
    onResize: (w, h) => {
      // Dynamically scale orbital lanes to fit screen
      const minDim = Math.min(w, h);
      const state = gameStateRef.current;
      state.baseRadii = [minDim * 0.18, minDim * 0.3, minDim * 0.42];
      state.targetRadius = state.baseRadii[state.currentLane];
      if (state.currentRadius === 100) {
        state.currentRadius = state.targetRadius;
      }

      // Generate background starfield if empty
      if (state.starBg.length === 0) {
        state.starBg = Array.from({ length: 40 }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          size: 0.8 + Math.random() * 1.5,
          alpha: 0.2 + Math.random() * 0.6,
          twinkleSpeed: 0.02 + Math.random() * 0.04,
        }));
      }
    },
    onUpdate: (ctx, deltaSec, curW, curH) => {
      const dt = Math.min(32, deltaSec * 1000);
      const deltaRatio = getFrameScale(deltaSec);
      const state = gameStateRef.current;
      const activeFrameScale = !isPausedRef.current && state.isAlive ? deltaRatio : 0;
      const currentTime = state.gameTime * 1000;

      const cx = curW / 2;
      const cy = curH / 2;

      ctx.save();

      // Camera shake
      if (state.shake > 0) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
        state.shake *= getFrameInvariantDecay(0.88, activeFrameScale);
        if (state.shake < 0.2) state.shake = 0;
      }

      ctx.clearRect(-20, -20, curW + 40, curH + 40);

      // Starfield background
      state.starBg.forEach((star) => {
        star.alpha += Math.sin(currentTime * star.twinkleSpeed * 0.05) * 0.01 * activeFrameScale;
        const boundedAlpha = Math.max(0.1, Math.min(0.8, star.alpha));
        ctx.fillStyle = `rgba(255, 255, 255, ${boundedAlpha})`;
        ctx.fillRect(star.x, star.y, star.size, star.size);
      });

      if (!isPausedRef.current && state.isAlive) {
        state.gameTime += dt / 1000;
        const frameSeconds = dt / 1000;
        state.corePulse += 0.05 * deltaRatio;

        if (state.formationCooldownTimer > 0) {
          state.formationCooldownTimer = Math.max(0, state.formationCooldownTimer - frameSeconds);
        }
        if (state.formationGraceTimer > 0) {
          state.formationGraceTimer = Math.max(0, state.formationGraceTimer - frameSeconds);
        }
        if (state.formationWarningTimer > 0) {
          state.formationWarningTimer = Math.max(0, state.formationWarningTimer - frameSeconds);
          if (state.formationWarningTimer === 0 && state.pendingFormation) {
            const formation = state.pendingFormation;
            formation.targets.forEach((target) => {
              spawnFormationHazard(target, curW, curH, cx, cy);
            });
            state.formationSafeLane = formation.safeLane;
            state.formationResolveTimer = ORBIT_FORMATION_RESOLVE_SEC;
            state.pendingFormation = null;
          }
        }
        if (state.formationResolveTimer > 0) {
          state.formationResolveTimer = Math.max(0, state.formationResolveTimer - frameSeconds);
          if (state.formationResolveTimer === 0) {
            if (state.currentLane === state.formationSafeLane) {
              state.formationChain++;
              const bonus = getOrbitFormationBonus(state.formationChain);
              state.score += bonus;
              onScoreUpdate(state.score);
              state.floatingTexts.push({
                x: cx,
                y: cy - state.baseRadii[state.currentLane] - 20,
                text: `FORMATION x${Math.min(5, state.formationChain)} +${bonus}`,
                color: '#34D399',
                life: 0,
                maxLife: 36,
              });
              if (soundEnabled) sounds.playSuccess();
            } else {
              state.formationChain = 0;
            }
          }
        }
        if (
          state.gameTime >= 4 &&
          state.formationCooldownTimer <= 0 &&
          state.formationWarningTimer <= 0 &&
          state.formationResolveTimer <= 0 &&
          !state.pendingFormation
        ) {
          state.pendingFormation = getOrbitThreatFormation(state.formationIndex++);
          state.formationWarningTimer = ORBIT_FORMATION_WARNING_SEC;
          state.formationGraceTimer = ORBIT_FORMATION_WARNING_SEC + ORBIT_FORMATION_GRACE_SEC;
          state.formationCooldownTimer = ORBIT_FORMATION_COOLDOWN_SEC;
          if (soundEnabled) sounds.playTick();
        }

        // Smooth radius transition between lanes
        state.currentRadius += (state.targetRadius - state.currentRadius) * getFrameInvariantBlend(0.18, deltaRatio);

        // Orbit update
        state.playerAngle += state.orbitSpeed * state.direction * deltaRatio;

        // Ship trail
        const playerX = cx + Math.cos(state.playerAngle) * state.currentRadius;
        const playerY = cy + Math.sin(state.playerAngle) * state.currentRadius;

        state.shipTrail.unshift({
          x: playerX,
          y: playerY,
          alpha: 0.8,
          angle: state.playerAngle,
        });
        if (state.shipTrail.length > 10) state.shipTrail.pop();

        state.shipTrail.forEach((t) => {
          t.alpha *= getFrameInvariantDecay(0.82, deltaRatio);
        });

        // Spawn Spawners
        const hazardInterval = Math.max(700, 1800 - state.gameTime * 30);
        state.hazardSpawnElapsedMs += dt;
        state.crystalSpawnElapsedMs += dt;
        if (state.hazardSpawnElapsedMs > hazardInterval && state.formationGraceTimer <= 0) {
          spawnHazard(curW, curH, cx, cy);
          state.hazardSpawnElapsedMs = 0;
        }

        if (state.crystalSpawnElapsedMs > 1600 && state.crystals.length < 5) {
          spawnCrystal();
          state.crystalSpawnElapsedMs = 0;
        }

        // Update Energy Crystals
        for (let i = state.crystals.length - 1; i >= 0; i--) {
          const c = state.crystals[i];
          c.pulse += 0.06 * deltaRatio;
          c.spin += 0.03 * deltaRatio;
          c.radius = state.baseRadii[c.lane];

          const crX = cx + Math.cos(c.angle) * c.radius;
          const crY = cy + Math.sin(c.angle) * c.radius;

          const dist = Math.hypot(playerX - crX, playerY - crY);
          if (dist < 18) {
            // Route chains reward collecting authored lane targets in sequence.
            state.routeChain = c.routeIndex === state.lastRouteIndex + 1 ? state.routeChain + 1 : 1;
            state.lastRouteIndex = c.routeIndex;
            const routeMultiplier = getOrbitRouteMultiplier(state.routeChain);
            const routePoints = 150 * routeMultiplier;
            state.score += routePoints;
            state.combo = Math.min(8, state.combo + 1);
            onScoreUpdate(state.score);
            if (soundEnabled) sounds.playScore();

            state.floatingTexts.push({
              x: crX,
              y: crY,
              text: `ROUTE x${routeMultiplier} +${routePoints}`,
              color: c.color,
              life: 0,
              maxLife: 35,
            });

            // Particles
            for (let k = 0; k < 12; k++) {
              const ang = Math.random() * Math.PI * 2;
              state.particles.push({
                x: crX,
                y: crY,
                vx: Math.cos(ang) * (2 + Math.random() * 3),
                vy: Math.sin(ang) * (2 + Math.random() * 3),
                color: c.color,
                size: 2.5,
                life: 0,
                maxLife: 20,
              });
            }

            state.crystals.splice(i, 1);
          }
        }

        // Update Hazards
        for (let i = state.hazards.length - 1; i >= 0; i--) {
          const h = state.hazards[i];
          h.x += h.vx * deltaRatio;
          h.y += h.vy * deltaRatio;

          // Trail
          h.trail.unshift({ x: h.x, y: h.y, alpha: 0.6 });
          if (h.trail.length > 8) h.trail.pop();
          h.trail.forEach((tr) => (tr.alpha *= getFrameInvariantDecay(0.85, deltaRatio)));

          // Collision / graze mastery. A graze only scores once the comet is moving away.
          const dxShip = h.x - playerX;
          const dyShip = h.y - playerY;
          const distToShip = Math.hypot(dxShip, dyShip);
          const collisionRadius = h.radius + 7;
          const relativeDot = dxShip * h.vx + dyShip * h.vy;
          if (!h.nearMissAwarded && isOrbitNearMiss(distToShip, collisionRadius, relativeDot)) {
            h.nearMissAwarded = true;
            state.nearMissChain = state.gameTime - state.lastNearMissAt <= 6 ? state.nearMissChain + 1 : 1;
            state.lastNearMissAt = state.gameTime;
            const grazePoints = 100 * Math.min(5, state.nearMissChain);
            state.score += grazePoints;
            onScoreUpdate(state.score);
            state.floatingTexts.push({
              x: playerX,
              y: playerY - 18,
              text: `GRAZE x${state.nearMissChain} +${grazePoints}`,
              color: '#FACC15',
              life: 0,
              maxLife: 30,
            });
            if (soundEnabled) sounds.playChime(820);
          }
          if (distToShip < collisionRadius) {
            state.isAlive = false;
            state.shake = 16;
            if (soundEnabled) sounds.playGameOver();

            for (let k = 0; k < 25; k++) {
              const ang = Math.random() * Math.PI * 2;
              state.particles.push({
                x: playerX,
                y: playerY,
                vx: Math.cos(ang) * (3 + Math.random() * 5),
                vy: Math.sin(ang) * (3 + Math.random() * 5),
                color: '#38BDF8',
                size: 3.5,
                life: 0,
                maxLife: 30,
              });
            }

            setSafeTimeout(() => {
              onGameOver(state.score);
            }, 700);
            break;
          }

          // Despawn if far out
          const distToCenter = Math.hypot(h.x - cx, h.y - cy);
          if (distToCenter > Math.max(curW, curH) * 0.9) {
            state.hazards.splice(i, 1);
          }
        }
      }

      // --- RENDERING ---

      // Orbital Tracks
      state.baseRadii.forEach((radius, idx) => {
        const isCurrent = idx === state.currentLane;
        ctx.strokeStyle = isCurrent ? 'rgba(56, 189, 248, 0.5)' : 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = isCurrent ? 2 : 1;
        ctx.setLineDash(isCurrent ? [6, 4] : []);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Route / graze / formation mastery HUD is rendered on-canvas so it stays frame-local.
      const masteryHudWidth = Math.max(220, Math.min(356, curW - 20));
      ctx.fillStyle = 'rgba(24, 24, 27, 0.88)';
      ctx.fillRect(cx - masteryHudWidth / 2, 12, masteryHudWidth, 28);
      ctx.strokeStyle = 'rgba(63, 63, 70, 0.9)';
      ctx.strokeRect(cx - masteryHudWidth / 2, 12, masteryHudWidth, 28);
      ctx.fillStyle = state.pendingFormation ? '#FB7185' : '#38BDF8';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const threatLabel = state.pendingFormation
        ? `${state.pendingFormation.name} • SAFE ${getOrbitLaneName(state.pendingFormation.safeLane)}`
        : state.formationResolveTimer > 0
          ? `FORMATION • SAFE ${getOrbitLaneName(state.formationSafeLane)}`
          : 'THREAT SCAN';
      ctx.fillText(
        `${threatLabel} • ${getOrbitRouteName(state.routeIndex)} • FORMATION x${Math.max(1, state.formationChain)} • ROUTE x${getOrbitRouteMultiplier(state.routeChain)} • GRAZE x${Math.max(1, state.nearMissChain)}`,
        cx,
        26,
      );

      // Blazing Stellar Center Star Core
      const coreR = 24 + Math.sin(state.corePulse) * 2;
      const starGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, coreR);
      starGrad.addColorStop(0, '#FFFFFF');
      starGrad.addColorStop(0.3, '#FDE047');
      starGrad.addColorStop(0.7, '#FB923C');
      starGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');

      ctx.fillStyle = starGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Energy Crystals
      state.crystals.forEach((c) => {
        const crX = cx + Math.cos(c.angle) * c.radius;
        const crY = cy + Math.sin(c.angle) * c.radius;
        const cSize = 7 + Math.sin(c.pulse) * 1.5;

        ctx.save();
        ctx.translate(crX, crY);
        ctx.rotate(c.spin);

        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.moveTo(0, -cSize);
        ctx.lineTo(cSize * 0.8, 0);
        ctx.lineTo(0, cSize);
        ctx.lineTo(-cSize * 0.8, 0);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
      });

      // Hazard Comets
      state.hazards.forEach((h) => {
        // Trail
        h.trail.forEach((tr, tIdx) => {
          ctx.fillStyle = `rgba(244, 63, 94, ${tr.alpha * (1 - tIdx / h.trail.length)})`;
          ctx.beginPath();
          ctx.arc(tr.x, tr.y, h.radius * (1 - tIdx / h.trail.length), 0, Math.PI * 2);
          ctx.fill();
        });

        // Core
        ctx.fillStyle = h.color;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Player Ship Trail
      state.shipTrail.forEach((t) => {
        ctx.fillStyle = `rgba(56, 189, 248, ${t.alpha * 0.4})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Player Ship
      if (state.isAlive) {
        const playerX = cx + Math.cos(state.playerAngle) * state.currentRadius;
        const playerY = cy + Math.sin(state.playerAngle) * state.currentRadius;

        // Tangent heading angle
        const heading = state.playerAngle + (state.direction > 0 ? Math.PI / 2 : -Math.PI / 2);

        ctx.save();
        ctx.translate(playerX, playerY);
        ctx.rotate(heading);

        // Warp expansion ripple
        if (state.warpEffect > 0) {
          ctx.strokeStyle = `rgba(56, 189, 248, ${state.warpEffect})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 14 * (2 - state.warpEffect), 0, Math.PI * 2);
          ctx.stroke();
          state.warpEffect -= 0.08 * activeFrameScale;
        }

        // Sleek Arrow Ship Geometry
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-7, -7);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-7, 7);
        ctx.closePath();
        ctx.fill();

        // Ship cockpit glow
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(1, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // Particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx * activeFrameScale;
        p.y += p.vy * activeFrameScale;
        p.life += activeFrameScale;
        const alpha = Math.max(0, 1 - p.life / p.maxLife);

        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        if (p.life >= p.maxLife) {
          state.particles.splice(i, 1);
        }
      }

      // Floating score texts
      for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
        const ft = state.floatingTexts[i];
        ft.y -= 0.6 * activeFrameScale;
        ft.life += activeFrameScale;
        const alpha = Math.max(0, 1 - ft.life / ft.maxLife);

        ctx.globalAlpha = alpha;
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1;

        if (ft.life >= ft.maxLife) {
          state.floatingTexts.splice(i, 1);
        }
      }

      ctx.restore();
      return state.isAlive;
    },
  });

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none game-canvas-container">
      <canvas ref={canvasRef} className="w-full h-full block cursor-pointer" />

      {/* Control Instruction Bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-[calc(100%-1.5rem)] flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-[#18181B]/90 border border-[#27272A] px-3 py-2 rounded-2xl font-mono-arcade text-[10px] sm:text-xs text-[#A1A1AA] pointer-events-none text-center">
        <span className="text-[#38BDF8] font-bold">TAP / SPACE:</span>
        <span>PULSE = LANE + REVERSE</span>
        <span className="text-[#71717A]">|</span>
        <span className="text-[#FACC15] font-bold">↑ / ↓:</span>
        <span>LANE</span>
        <span className="text-[#71717A]">|</span>
        <span className="text-[#34D399] font-bold">A/D / ← / →:</span>
        <span>REVERSE</span>
      </div>
    </div>
  );
};
