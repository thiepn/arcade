import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { Heart, Zap, Sparkles, Flame, Radio } from 'lucide-react';
import { useGameLoop } from '../hooks/useGameLoop';
import {
  CHRONO_MAX_ACTIVE_WALLS,
  CHRONO_SIDES,
  CHRONO_TRANSITION_GRACE_FRAMES,
  getChronoDesiredWallSpeed,
  getChronoOpenSideForAngle,
  getChronoSpawnInterval,
  getChronoStageForScore,
  getChronoWallColor,
  isAngleInChronoGap,
  planChronoWall,
  selectNextChronoWall,
} from '../lib/chronoWavePlanner';
import {
  getChronoFocusBonus,
  getChronoFocusCharges,
  isChronoFocusHit,
} from '../lib/chronoFocusMastery';
import { isArcadeReducedMotion } from '../lib/motionPreferences';

interface WallPattern {
  radius: number;
  sides: number;
  openSide: number; // Primary open escape slot index (0 to sides-1)
  openSpan: number; // Number of contiguous open slots (e.g. 2 for stage 1, 1 for higher)
  speed: number;
  color: string;
  cleared: boolean;
  impactFrame: number;
  stage: number;
}

interface Shard {
  angle: number;
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

interface FloatingScore {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export const ChronoGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const [lives, setLives] = useState(3);
  const [stage, setStage] = useState(1);
  const [empReady, setEmpReady] = useState(false);
  const [shardsCount, setShardsCount] = useState(0);
  const [leftActive, setLeftActive] = useState(false);
  const [rightActive, setRightActive] = useState(false);
  const [focusCharges, setFocusCharges] = useState(1);
  const [focusArmed, setFocusArmed] = useState(false);
  const [focusStreak, setFocusStreak] = useState(0);

  const gameStateRef = useRef({
    playerAngle: 0,
    targetAngle: null as number | null,
    playerRadius: 58,
    playerTurnDir: 0, // -1 (left), 1 (right), 0 (none)
    isDirectAiming: false,
    invulnerableTime: 0,
    lastOpenSide: getChronoOpenSideForAngle(0),
    consecutiveSameGap: 0,
    lastPlannedImpactFrame: 0,
    forcedNextOpenSide: getChronoOpenSideForAngle(0) as number | null,
    transitionGraceFrames: 0,
    gameTimeFrames: 0,
    walls: [] as WallPattern[],
    shards: [] as Shard[],
    particles: [] as Particle[],
    floatingScores: [] as FloatingScore[],
    score: 0,
    lives: 3,
    stage: 1,
    shardsCollected: 0,
    empCharges: 0,
    isAlive: true,
    shake: 0,
    corePulse: 0,
    spawnTimer: 0,
    spawnInterval: getChronoSpawnInterval(1),
    rotationSpeed: 0.17, // Agile turning
    speedMultiplier: 1.0,
    focusCharges: 1,
    focusArmed: false,
    focusStreak: 0,
    cleanPasses: 0,
  });

  const addScorePopup = (text: string, x: number, y: number, color = '#FFFFFF') => {
    gameStateRef.current.floatingScores.push({
      x,
      y,
      text,
      color,
      life: 0,
      maxLife: 30,
    });
  };

  // P13 Focus Wager: spend a charge to demand a center-line pass on the next wall.
  const triggerFocus = useCallback(() => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current || state.focusArmed || state.focusCharges <= 0) return;
    state.focusCharges--;
    state.focusArmed = true;
    setFocusCharges(state.focusCharges);
    setFocusArmed(true);
    if (soundEnabled) sounds.playChime(920);
  }, [soundEnabled]);

  // Trigger EMP Blast
  const triggerEmp = useCallback(() => {
    const state = gameStateRef.current;
    if (!state.isAlive || state.empCharges <= 0 || isPausedRef.current) return;

    state.empCharges--;
    setEmpReady(false);
    if (state.focusArmed) {
      state.focusArmed = false;
      state.focusStreak = 0;
      setFocusArmed(false);
      setFocusStreak(0);
    }
    state.shake = 12;

    if (soundEnabled) sounds.playShockwave();

    // Clear all walls and restart the planner from the player's current lane.
    const wallCount = state.walls.length;
    state.walls = [];
    state.shards = [];
    state.lastPlannedImpactFrame = state.gameTimeFrames;
    state.lastOpenSide = getChronoOpenSideForAngle(state.playerAngle);
    state.forcedNextOpenSide = state.lastOpenSide;
    state.consecutiveSameGap = 0;
    state.transitionGraceFrames = Math.max(state.transitionGraceFrames, 30);
    state.spawnTimer = 0;
    const bonus = 1500 + wallCount * 500;
    state.score += bonus;
    onScoreUpdate(state.score);

    // Blast ring particles
    for (let k = 0; k < 36; k++) {
      const ang = (k / 36) * Math.PI * 2;
      state.particles.push({
        x: Math.cos(ang) * state.playerRadius,
        y: Math.sin(ang) * state.playerRadius,
        vx: Math.cos(ang) * 6,
        vy: Math.sin(ang) * 6,
        color: '#A855F7',
        size: 4,
        life: 0,
        maxLife: 25,
      });
    }
  }, [onScoreUpdate, soundEnabled]);

  const spawnWall = useCallback((maxRadius: number) => {
    const state = gameStateRef.current;
    const plan = planChronoWall({
      currentFrame: state.gameTimeFrames,
      spawnRadius: maxRadius,
      playerRadius: state.playerRadius,
      desiredSpeed: getChronoDesiredWallSpeed(state.stage, state.speedMultiplier),
      rotationSpeed: state.rotationSpeed,
      lastImpactFrame: state.lastPlannedImpactFrame,
      lastOpenSide: state.lastOpenSide,
      consecutiveSameGap: state.consecutiveSameGap,
      forcedOpenSide: state.forcedNextOpenSide,
    });

    state.lastPlannedImpactFrame = plan.impactFrame;
    state.lastOpenSide = plan.openSide;
    state.consecutiveSameGap = plan.consecutiveSameGap;
    state.forcedNextOpenSide = null;

    const color = getChronoWallColor(state.stage);
    state.walls.push({
      radius: maxRadius,
      sides: CHRONO_SIDES,
      openSide: plan.openSide,
      openSpan: plan.openSpan,
      speed: plan.speed,
      color,
      cleared: false,
      impactFrame: plan.impactFrame,
      stage: state.stage,
    });

    if (Math.random() < 0.45) {
      state.shards.push({
        angle: ((plan.openSide + plan.openSpan * 0.5) / CHRONO_SIDES) * Math.PI * 2,
        radius: state.playerRadius,
        collected: false,
      });
    }
  }, []);

  const beginStageTransition = (nextStage: number, cx: number, cy: number) => {
    const state = gameStateRef.current;
    if (nextStage <= state.stage) return;

    state.stage = nextStage;
    state.spawnInterval = getChronoSpawnInterval(nextStage);
    state.walls = [];
    state.shards = [];
    state.spawnTimer = 0;
    state.transitionGraceFrames = CHRONO_TRANSITION_GRACE_FRAMES;
    state.invulnerableTime = Math.max(
      state.invulnerableTime,
      CHRONO_TRANSITION_GRACE_FRAMES,
    );
    state.lastPlannedImpactFrame = state.gameTimeFrames;
    state.lastOpenSide = getChronoOpenSideForAngle(state.playerAngle);
    state.forcedNextOpenSide = state.lastOpenSide;
    state.consecutiveSameGap = 0;
    setStage(nextStage);

    const messages = [
      '',
      '',
      'STAGE 2: ACCELERATING',
      'STAGE 3: QUANTUM DENSITY',
      'STAGE 4: HYPER DRIVE',
    ];
    addScorePopup(
      messages[nextStage] ?? ('STAGE ' + nextStage),
      cx,
      cy - 40,
      getChronoWallColor(nextStage),
    );
    if (soundEnabled) sounds.playVictory();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Calculate angle from center of canvas to client coordinates
    const getPointerAngle = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const cx = rect.width * 0.5;
      const cy = rect.height * 0.5;
      let angle = Math.atan2(y - cy, x - cx);
      if (angle < 0) angle += Math.PI * 2;
      return angle;
    };

    // Keyboard handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = gameStateRef.current;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
      }
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        state.playerTurnDir = -1;
        state.isDirectAiming = false;
        setLeftActive(true);
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        state.playerTurnDir = 1;
        state.isDirectAiming = false;
        setRightActive(true);
      } else if (e.key === ' ' || e.key === 'e' || e.key === 'E') {
        triggerEmp();
      } else if (e.key === 'f' || e.key === 'F' || e.key === 'Shift') {
        e.preventDefault();
        triggerFocus();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const state = gameStateRef.current;
      if (
        (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') &&
        state.playerTurnDir === -1
      ) {
        state.playerTurnDir = 0;
        setLeftActive(false);
      } else if (
        (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') &&
        state.playerTurnDir === 1
      ) {
        state.playerTurnDir = 0;
        setRightActive(false);
      }
    };

    // Touch & Pointer handlers:
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const rect = canvas.getBoundingClientRect();
      const relY = clientY - rect.top;

      if (relY > rect.height * 0.82) {
        const relX = clientX - rect.left;
        if (relX < rect.width * 0.5) {
          gameStateRef.current.playerTurnDir = -1;
          gameStateRef.current.isDirectAiming = false;
          setLeftActive(true);
        } else {
          gameStateRef.current.playerTurnDir = 1;
          gameStateRef.current.isDirectAiming = false;
          setRightActive(true);
        }
      } else {
        const targetAngle = getPointerAngle(clientX, clientY);
        gameStateRef.current.targetAngle = targetAngle;
        gameStateRef.current.isDirectAiming = true;
      }
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!gameStateRef.current.isDirectAiming) return;
      const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const targetAngle = getPointerAngle(clientX, clientY);
      gameStateRef.current.targetAngle = targetAngle;
    };

    const handlePointerUp = () => {
      gameStateRef.current.playerTurnDir = 0;
      gameStateRef.current.isDirectAiming = false;
      gameStateRef.current.targetAngle = null;
      setLeftActive(false);
      setRightActive(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      canvas.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [triggerEmp, triggerFocus]);

  useGameLoop({
    canvasRef,
    isPaused,
    onUpdate: (ctx, dt, curW, curH) => {
      const state = gameStateRef.current;
      const frameScale = Math.min(dt * 60, 2);

      const cx = curW * 0.5;
      const cy = curH * 0.5;
      const maxSpawnRadius = Math.hypot(cx, cy) * 0.95;

      ctx.save();

      if (state.shake > 0) {
        if (!isArcadeReducedMotion()) {
          ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
        }
        state.shake *= Math.pow(0.88, frameScale);
        if (state.shake < 0.2) state.shake = 0;
      }

      ctx.clearRect(-10, -10, curW + 20, curH + 20);

      // --- GAME LOOP UPDATE ---
      if (!isPausedRef.current && state.isAlive) {
        state.corePulse += 0.05 * frameScale;
        state.gameTimeFrames += frameScale;

        // Smooth continuous speed progression: gradually scales difficulty every second survived!
        const timeFactor = Math.min(1.0, state.gameTimeFrames / 5400); // 0 -> 1 over 90 seconds
        state.speedMultiplier = 1.0 + timeFactor * 0.75 + (state.stage - 1) * 0.18;
        state.rotationSpeed = 0.17 + timeFactor * 0.04;

        // Invulnerability countdown
        if (state.invulnerableTime > 0) {
          state.invulnerableTime = Math.max(0, state.invulnerableTime - frameScale);
        }

        // Direct Aiming interpolation
        if (state.isDirectAiming && state.targetAngle !== null) {
          let diff = state.targetAngle - state.playerAngle;
          // Shortest angular path
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;

          if (Math.abs(diff) < 0.08) {
            state.playerAngle = state.targetAngle;
          } else {
            state.playerAngle +=
              Math.sign(diff) *
              Math.min(Math.abs(diff) * 0.35, state.rotationSpeed * 1.5 * frameScale);
          }
        } else if (state.playerTurnDir !== 0) {
          // Snappy button/key rotation
          state.playerAngle += state.playerTurnDir * state.rotationSpeed * frameScale;
        }

        // Normalise angle to 0..2PI
        if (state.playerAngle < 0) state.playerAngle += Math.PI * 2;
        if (state.playerAngle >= Math.PI * 2) state.playerAngle -= Math.PI * 2;

        // Stage transitions pause spawning, clear mixed-color walls, and force
        // the first new opening around the player's current position.
        if (state.transitionGraceFrames > 0) {
          state.transitionGraceFrames = Math.max(
            0,
            state.transitionGraceFrames - frameScale,
          );
        } else {
          state.spawnTimer += state.speedMultiplier * frameScale;
          const activeWallCount = state.walls.filter(
            (wall) => !wall.cleared && wall.radius > state.playerRadius,
          ).length;
          if (
            state.spawnTimer >= state.spawnInterval &&
            activeWallCount < CHRONO_MAX_ACTIVE_WALLS
          ) {
            state.spawnTimer = 0;
            spawnWall(maxSpawnRadius);
          } else if (activeWallCount >= CHRONO_MAX_ACTIVE_WALLS) {
            state.spawnTimer = Math.min(state.spawnTimer, state.spawnInterval);
          }
        }

        // Wall simulation & collision check
        for (let i = state.walls.length - 1; i >= 0; i--) {
          const wall = state.walls[i];
          const previousRadius = wall.radius;
          wall.radius -= wall.speed * frameScale;

          // Crossing detection cannot skip at high refresh rates or after a slow frame.
          const pR = state.playerRadius;
          const crossedPlayer = previousRadius >= pR && wall.radius < pR;
          if (crossedPlayer && !wall.cleared) {
            const isSafe = isAngleInChronoGap(
              state.playerAngle,
              wall.openSide,
              wall.openSpan,
              wall.sides,
            );

            if (isSafe) {
              // Successfully passed through the open slot!
              wall.cleared = true;
              state.score += 250;
              state.cleanPasses++;
              const chargedFocus = getChronoFocusCharges(state.cleanPasses, state.focusCharges);
              if (chargedFocus !== state.focusCharges) {
                state.focusCharges = chargedFocus;
                setFocusCharges(chargedFocus);
              }
              if (state.focusArmed) {
                if (isChronoFocusHit(state.playerAngle, wall.openSide, wall.openSpan, wall.sides)) {
                  state.focusStreak = Math.min(5, state.focusStreak + 1);
                  const focusBonus = getChronoFocusBonus(state.focusStreak);
                  state.score += focusBonus;
                  setFocusStreak(state.focusStreak);
                  addScorePopup(`FOCUS LOCK +${focusBonus}`, cx + Math.cos(state.playerAngle) * pR, cy + Math.sin(state.playerAngle) * pR - 18, '#FACC15');
                } else {
                  state.focusStreak = 0;
                  setFocusStreak(0);
                  addScorePopup('FOCUS MISSED — SAFE PASS', cx, cy - 36, '#A1A1AA');
                }
                state.focusArmed = false;
                setFocusArmed(false);
              }
              onScoreUpdate(state.score);
              if (soundEnabled) sounds.playScore();
              addScorePopup('+250', cx + Math.cos(state.playerAngle) * pR, cy + Math.sin(state.playerAngle) * pR, wall.color);

            } else if (state.invulnerableTime <= 0) {
              // Hit the wall!
              wall.cleared = true;
              if (state.focusArmed) {
                state.focusArmed = false;
                state.focusStreak = 0;
                setFocusArmed(false);
                setFocusStreak(0);
              }
              state.lives--;
              state.invulnerableTime = 70; // ~1.2s of mercy invulnerability
              state.shake = 14;
              setLives(state.lives);
              if (soundEnabled) sounds.playExplosion();
              addScorePopup('HULL HIT! -1 LIFE', cx + Math.cos(state.playerAngle) * pR, cy + Math.sin(state.playerAngle) * pR, '#EF4444');

              for (let k = 0; k < 18; k++) {
                const ang = Math.random() * Math.PI * 2;
                state.particles.push({
                  x: cx + Math.cos(state.playerAngle) * pR,
                  y: cy + Math.sin(state.playerAngle) * pR,
                  vx: Math.cos(ang) * (2 + Math.random() * 4),
                  vy: Math.sin(ang) * (2 + Math.random() * 4),
                  color: wall.color,
                  size: 3.5,
                  life: 0,
                  maxLife: 20,
                });
              }

              if (state.lives <= 0) {
                state.isAlive = false;
                onGameOver(state.score);
              }
            }
          }

          // Wall vanishes into singularity core
          if (wall.radius < 20) {
            state.walls.splice(i, 1);
          }
        }

        const nextStage = getChronoStageForScore(state.score);
        if (nextStage > state.stage) {
          beginStageTransition(nextStage, cx, cy);
        }

        // Energy Shards collection
        for (let i = state.shards.length - 1; i >= 0; i--) {
          const s = state.shards[i];
          const angleDiff = Math.abs(s.angle - state.playerAngle);
          const minDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);

          if (minDiff < 0.35) {
            state.shards.splice(i, 1);
            state.shardsCollected = (state.shardsCollected || 0) + 1;
            setShardsCount(state.shardsCollected);
            state.score += 400;
            onScoreUpdate(state.score);

            if (soundEnabled) sounds.playPop();

            if (state.shardsCollected >= 3) {
              state.shardsCollected = 0;
              state.empCharges = 1;
              setEmpReady(true);
              setShardsCount(0);
              if (soundEnabled) sounds.playPowerUp();
              addScorePopup('EMP CHARGED!', cx, cy - 30, '#A855F7');
            }
          }
        }
      }

      // --- RENDERING ---

      // Background Vortex Spoke Lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * maxSpawnRadius, cy + Math.sin(ang) * maxSpawnRadius);
        ctx.stroke();
      }

      // Escape Gap Telegraph Guides (Subtle luminous beam pointing to upcoming wall opening)
      const closestWall = selectNextChronoWall(state.walls, state.playerRadius);
      if (closestWall) {
        const sectorAngle = (Math.PI * 2) / closestWall.sides;
        const midOpenAngle =
          (closestWall.openSide + closestWall.openSpan * 0.5) * sectorAngle;

        ctx.strokeStyle = 'rgba(52, 211, 153, 0.15)';
        ctx.lineWidth = 24;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(
          cx + Math.cos(midOpenAngle) * maxSpawnRadius,
          cy + Math.sin(midOpenAngle) * maxSpawnRadius,
        );
        ctx.stroke();
      }

      // Contracting Polygon Walls
      state.walls.forEach((wall) => {
        const sectorAngle = (Math.PI * 2) / wall.sides;

        for (let s = 0; s < wall.sides; s++) {
          // Check if this sector is open
          let isOpen = false;
          for (let span = 0; span < wall.openSpan; span++) {
            if (s === (wall.openSide + span) % wall.sides) {
              isOpen = true;
              break;
            }
          }
          if (isOpen) continue; // Leave slot open

          const a1 = s * sectorAngle;
          const a2 = (s + 1) * sectorAngle;

          const x1 = cx + Math.cos(a1) * wall.radius;
          const y1 = cy + Math.sin(a1) * wall.radius;
          const x2 = cx + Math.cos(a2) * wall.radius;
          const y2 = cy + Math.sin(a2) * wall.radius;

          ctx.strokeStyle = wall.color;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          // End node caps
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(x1, y1, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Player Orbit Track Ring
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(cx, cy, state.playerRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Central Pulsing Singularity Core
      const coreR = 16 + Math.sin(state.corePulse * 3) * 3;
      ctx.fillStyle = '#A855F7';
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 2, 0, Math.PI * 2);
      ctx.fill();

      // Energy Shards
      state.shards.forEach((s) => {
        const sx = cx + Math.cos(s.angle) * s.radius;
        const sy = cy + Math.sin(s.angle) * s.radius;

        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // Player Triangle Arrow Ship (with invulnerability flashing)
      const isFlashing = state.invulnerableTime > 0 && Math.floor(state.invulnerableTime / 4) % 2 === 0;
      if (!isFlashing) {
        const px = cx + Math.cos(state.playerAngle) * state.playerRadius;
        const py = cy + Math.sin(state.playerAngle) * state.playerRadius;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(state.playerAngle + Math.PI / 2);

        // Shield aura if invulnerable
        if (state.invulnerableTime > 0) {
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 14, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(7, 7);
        ctx.lineTo(-7, 7);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#A855F7';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
      }

      // Particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx * frameScale;
        p.y += p.vy * frameScale;
        p.life += frameScale;
        const alpha = Math.max(0, 1 - p.life / p.maxLife);

        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(cx + p.x, cy + p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        if (p.life >= p.maxLife) {
          state.particles.splice(i, 1);
        }
      }

      // Floating Scores
      for (let i = state.floatingScores.length - 1; i >= 0; i--) {
        const fs = state.floatingScores[i];
        fs.y -= 1 * frameScale;
        fs.life += frameScale;
        const alpha = Math.max(0, 1 - fs.life / fs.maxLife);

        ctx.fillStyle = fs.color;
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(fs.text, fs.x, fs.y);
        ctx.globalAlpha = 1;

        if (fs.life >= fs.maxLife) {
          state.floatingScores.splice(i, 1);
        }
      }

      ctx.restore();
      return state.isAlive;
    },
  });

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between select-none game-canvas-container touch-none bg-[#090D16] overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block cursor-pointer touch-none" />

      {/* Top HUD */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
        <div className="flex items-center gap-3 bg-[#18181B]/90 border border-[#27272A] px-3.5 py-1.5 rounded-xl font-mono-arcade text-xs backdrop-blur-md">
          <span className="text-white font-bold">STAGE {stage}</span>
          <span className="text-[#71717A]">|</span>
          <div className="flex items-center gap-1 text-[#F43F5E]">
            {Array.from({ length: 3 }).map((_, i) => (
              <Heart
                key={i}
                className={`w-3.5 h-3.5 ${i < lives ? 'fill-current' : 'opacity-25'}`}
              />
            ))}
          </div>
          <span className="text-[#71717A]">|</span>
          <div className="flex items-center gap-1 text-amber-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{shardsCount}/3 SHARDS</span>
          </div>
          <span className="text-[#71717A]">|</span>
          <span className={focusArmed ? 'text-amber-300 font-black' : 'text-cyan-300 font-bold'}>
            FOCUS {focusCharges} • STREAK {focusStreak}
          </span>
        </div>

        {empReady && (
          <button
            type="button"
            onClick={triggerEmp}
            className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono-arcade text-xs font-bold shadow-lg shadow-purple-900/50 flex items-center gap-1.5 pointer-events-auto cursor-pointer animate-pulse"
          >
            <Radio className="w-3.5 h-3.5" /> EMP BLAST [SPACE]
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={triggerFocus}
        disabled={focusCharges <= 0 || focusArmed}
        className={`absolute bottom-20 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-xl border font-mono-arcade text-[10px] font-black pointer-events-auto transition-all ${
          focusArmed
            ? 'bg-amber-500/30 border-amber-400 text-amber-200 animate-pulse'
            : focusCharges > 0
              ? 'bg-cyan-950/90 border-cyan-400/50 text-cyan-200 hover:bg-cyan-900 cursor-pointer'
              : 'bg-zinc-900/80 border-zinc-700 text-zinc-600 cursor-not-allowed'
        }`}
      >
        {focusArmed ? 'FOCUS WAGER — CENTER NEXT GAP' : `FOCUS WAGER ×${focusCharges} [F / SHIFT]`}
      </button>

      {/* Bottom Control Bar */}
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-3 z-10 pointer-events-auto">
        <button
          type="button"
          onMouseDown={() => {
            gameStateRef.current.playerTurnDir = -1;
            gameStateRef.current.isDirectAiming = false;
            setLeftActive(true);
          }}
          onMouseUp={() => {
            gameStateRef.current.playerTurnDir = 0;
            setLeftActive(false);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            gameStateRef.current.playerTurnDir = -1;
            gameStateRef.current.isDirectAiming = false;
            setLeftActive(true);
          }}
          onTouchEnd={() => {
            gameStateRef.current.playerTurnDir = 0;
            setLeftActive(false);
          }}
          className={`flex-1 py-3.5 rounded-xl font-mono-arcade text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 select-none backdrop-blur-md ${
            leftActive
              ? 'bg-purple-600 text-white border-purple-400 scale-95 shadow-lg shadow-purple-500/30'
              : 'bg-[#18181B]/90 hover:bg-[#27272A] text-purple-300 border-zinc-700'
          }`}
        >
          ◀ ROTATE LEFT [A]
        </button>

        <button
          type="button"
          onMouseDown={() => {
            gameStateRef.current.playerTurnDir = 1;
            gameStateRef.current.isDirectAiming = false;
            setRightActive(true);
          }}
          onMouseUp={() => {
            gameStateRef.current.playerTurnDir = 0;
            setRightActive(false);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            gameStateRef.current.playerTurnDir = 1;
            gameStateRef.current.isDirectAiming = false;
            setRightActive(true);
          }}
          onTouchEnd={() => {
            gameStateRef.current.playerTurnDir = 0;
            setRightActive(false);
          }}
          className={`flex-1 py-3.5 rounded-xl font-mono-arcade text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 select-none backdrop-blur-md ${
            rightActive
              ? 'bg-purple-600 text-white border-purple-400 scale-95 shadow-lg shadow-purple-500/30'
              : 'bg-[#18181B]/90 hover:bg-[#27272A] text-purple-300 border-zinc-700'
          }`}
        >
          ROTATE RIGHT [D] ▶
        </button>
      </div>
    </div>
  );
};
