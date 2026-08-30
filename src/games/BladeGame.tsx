import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { haptics } from '../lib/haptics';
import { Heart, Flame, Shield } from 'lucide-react';
import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';
import { rescalePoint, rescaleTrail, rescaleVelocity } from '../lib/gameCoordinates';
import { createBladeLaunchTrajectory, getBladeGravity, getBladeSimulationStepBatch } from '../lib/bladeTrajectory';

interface TargetItem {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: 'watermelon' | 'pineapple' | 'strawberry' | 'dragonfruit' | 'kiwi' | 'mango' | 'gold' | 'shield' | 'bomb';
  name: string;
  color: string;
  glow: string;
  points: number;
  slicesNeeded: number;
  slicesDone: number;
  sliced: boolean;
  rotation: number;
  vRot: number;
  symbol: string;
}

interface SlicedPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  glow: string;
  symbol: string;
  rotation: number;
  vRot: number;
  cutAngle: number;
  side: 1 | -1;
  life: number;
  maxLife: number;
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

interface TrailPoint {
  x: number;
  y: number;
  time: number;
}

interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export const BladeGame: React.FC<GameComponentProps> = ({
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
    lives: 3,
    combo: 0,
    multiplier: 1,
    comboTimerRatio: 0,
    hasShield: false,
  });

  const gameStateRef = useRef({
    score: 0,
    lives: 3,
    combo: 0,
    comboTimer: 0,
    maxComboTimer: 75, // ~1.25 seconds to chain next slice
    maxCombo: 0,
    multiplier: 1,
    isAlive: true,
    hasShield: false,
    shake: 0,

    targets: [] as TargetItem[],
    slicedPieces: [] as SlicedPiece[],
    particles: [] as Particle[],
    bladeTrail: [] as TrailPoint[],
    floatingTexts: [] as FloatingText[],

    isPointerDown: false,
    strokeStartTime: 0,
    strokeCuts: 0,

    spawnTimer: 0,
    spawnInterval: 65,
    waveCount: 0,
    difficultyTier: 1,
    nextId: 1,
    width: 420,
    height: 500,
    physicsAccumulator: 0,
  });

  const addPopup = useCallback((text: string, x: number, y: number, color = '#FFFFFF', scale = 1.0) => {
    gameStateRef.current.floatingTexts.push({
      id: gameStateRef.current.nextId++,
      text,
      x,
      y,
      color,
      life: 0,
      maxLife: 36,
      scale,
    });
  }, []);

  const spawnWave = useCallback((w: number, h: number) => {
    const state = gameStateRef.current;
    // Controlled wave count
    const count = Math.min(4, 2 + Math.floor(Math.random() * (state.difficultyTier > 2 ? 3 : 2)));

    let bombPlacedInWave = false;

    for (let i = 0; i < count; i++) {
      const rand = Math.random();
      let type: TargetItem['type'] = 'strawberry';
      let name = 'Plasma Berry';
      let color = '#F43F5E';
      let glow = 'rgba(244, 63, 94, 0.4)';
      let radius = 22;
      let points = 100;
      let slicesNeeded = 1;
      let symbol = '🍓';

      if (!bombPlacedInWave && rand < 0.18 && state.difficultyTier >= 2) {
        // Red EMP Bomb
        type = 'bomb';
        name = 'EMP Bomb';
        color = '#EF4444';
        glow = 'rgba(239, 68, 68, 0.6)';
        radius = 24;
        points = 0;
        symbol = '💣';
        bombPlacedInWave = true;
      } else if (rand < 0.04 && !state.hasShield) {
        // Rare Shield
        type = 'shield';
        name = 'Energy Shield';
        color = '#A855F7';
        glow = 'rgba(168, 85, 247, 0.5)';
        radius = 23;
        points = 150;
        symbol = '🛡️';
      } else if (rand < 0.22) {
        // Cyber Kiwi
        type = 'kiwi';
        name = 'Cyber Kiwi';
        color = '#84CC16';
        glow = 'rgba(132, 204, 22, 0.4)';
        radius = 21;
        points = 120;
        symbol = '🥝';
      } else if (rand < 0.42) {
        // Quantum Watermelon
        type = 'watermelon';
        name = 'Cyber Melon';
        color = '#10B981';
        glow = 'rgba(16, 185, 129, 0.4)';
        radius = 29;
        points = 150;
        symbol = '🍉';
      } else if (rand < 0.60) {
        // Golden Mango
        type = 'mango';
        name = 'Golden Mango';
        color = '#F59E0B';
        glow = 'rgba(245, 158, 11, 0.4)';
        radius = 25;
        points = 180;
        symbol = '🥭';
      } else if (rand < 0.78) {
        // Solar Pineapple (2-Slice required)
        type = 'pineapple';
        name = 'Solar Pineapple';
        color = '#EAB308';
        glow = 'rgba(234, 179, 8, 0.4)';
        radius = 27;
        points = 250;
        slicesNeeded = 2;
        symbol = '🍍';
      } else if (rand < 0.90) {
        // Neon Dragonfruit
        type = 'dragonfruit';
        name = 'Neon Dragon';
        color = '#EC4899';
        glow = 'rgba(236, 72, 153, 0.4)';
        radius = 26;
        points = 220;
        symbol = '🫐';
      } else {
        // Star Core Bonus
        type = 'gold';
        name = 'Star Core';
        color = '#FBBF24';
        glow = 'rgba(251, 191, 36, 0.6)';
        radius = 27;
        points = 300;
        slicesNeeded = 1;
        symbol = '⭐';
      }

      // Trajectories & Physics
      const spawnSlot = (i + 1) / (count + 1);
      const startX = w * (0.15 + spawnSlot * 0.7 + (Math.random() - 0.5) * 0.12);
      const startY = h + 25;
      const trajectory = createBladeLaunchTrajectory({
        startX,
        startY,
        width: w,
        height: h,
      });
      const { vx, vy } = trajectory;

      state.targets.push({
        id: state.nextId++,
        x: startX,
        y: startY,
        vx,
        vy,
        radius,
        type,
        name,
        color,
        glow,
        points,
        slicesNeeded,
        slicesDone: 0,
        sliced: false,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.08,
        symbol,
      });
    }
  }, []);

  // Razor-sharp segment collision check with responsive multi-slice combo engine
  const performSliceCheck = useCallback(
    (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
      const state = gameStateRef.current;
      if (!state.isAlive || isPausedRef.current) return;

      const segDx = p2.x - p1.x;
      const segDy = p2.y - p1.y;
      const segLenSq = segDx * segDx + segDy * segDy;
      if (segLenSq < 1) return;

      const cutAngle = Math.atan2(segDy, segDx);
      const perpAngle = cutAngle + Math.PI / 2;

      for (let i = state.targets.length - 1; i >= 0; i--) {
        const target = state.targets[i];
        if (target.sliced) continue;

        // Line-segment to circle distance calculation
        let t = ((target.x - p1.x) * segDx + (target.y - p1.y) * segDy) / segLenSq;
        t = Math.max(0, Math.min(1, t));
        const projX = p1.x + t * segDx;
        const projY = p1.y + t * segDy;
        const dist = Math.hypot(target.x - projX, target.y - projY);

        // Hitbox tolerance
        if (dist <= target.radius + 8) {
          // BOMB DETONATION
          if (target.type === 'bomb') {
            target.sliced = true;
            if (state.hasShield) {
              state.hasShield = false;
              state.shake = 10;
              if (soundEnabled) sounds.playShockwave();
              haptics.heavy();
              addPopup('SHIELD DEFLECTED BOMB!', target.x, target.y - 20, '#A855F7', 1.2);
            } else {
              state.lives--;
              state.combo = 0;
              state.comboTimer = 0;
              state.multiplier = 1;
              state.strokeCuts = 0;
              state.shake = 18;
              if (soundEnabled) sounds.playExplosion();
              haptics.gameOver();
              addPopup('⚠️ BOMB HIT! -1 LIFE', target.x, target.y - 20, '#EF4444', 1.3);

              for (let k = 0; k < 25; k++) {
                const ang = Math.random() * Math.PI * 2;
                const spd = 3 + Math.random() * 7;
                state.particles.push({
                  x: target.x,
                  y: target.y,
                  vx: Math.cos(ang) * spd,
                  vy: Math.sin(ang) * spd,
                  color: '#EF4444',
                  size: 4,
                  life: 0,
                  maxLife: 28,
                });
              }

              if (state.lives <= 0) {
                state.isAlive = false;
                setSafeTimeout(() => onGameOver(state.score), 400);
              }
            }
            return;
          }

          // MULTI-HIT TARGET PARTIAL SLICE
          target.slicesDone++;
          if (target.slicesDone < target.slicesNeeded) {
            target.radius *= 0.88;
            state.shake = 3;
            if (soundEnabled) sounds.playHit();
            haptics.light();
            addPopup('STRIKE 1/2!', target.x, target.y - 15, '#FACC15', 1.1);

            for (let k = 0; k < 6; k++) {
              state.particles.push({
                x: target.x,
                y: target.y,
                vx: (Math.random() - 0.5) * 5,
                vy: (Math.random() - 0.5) * 5,
                color: target.color,
                size: 3,
                life: 0,
                maxLife: 14,
              });
            }
            return;
          }

          // FULL CLEAN SLICE!
          target.sliced = true;
          state.strokeCuts++;
          state.combo++;
          state.comboTimer = state.maxComboTimer; // Reset combo decay window
          state.shake = 4;
          if (state.combo > state.maxCombo) state.maxCombo = state.combo;

          if (soundEnabled) sounds.playSlash();
          haptics.score();

          // Calculate Multiplier based on active chained combo
          let mult = 1;
          if (state.combo >= 10) mult = 3;
          else if (state.combo >= 4) mult = 2;
          state.multiplier = mult;

          // Powerup Trigger: Shield
          if (target.type === 'shield') {
            state.hasShield = true;
            if (soundEnabled) sounds.playPowerUp();
            addPopup('🛡️ SHIELD READY', target.x, target.y - 25, '#A855F7', 1.2);
          }

          // Points calculation
          const earned = target.points * mult;
          state.score += earned;
          onScoreUpdate(state.score);
          addPopup(`+${earned}`, target.x, target.y - 15, target.color, 1.0);

          // Split into 2 separating halves
          const separation = 4.0;
          state.slicedPieces.push(
            {
              x: target.x - Math.cos(perpAngle) * 5,
              y: target.y - Math.sin(perpAngle) * 5,
              vx: target.vx * 0.4 - Math.cos(perpAngle) * separation,
              vy: target.vy * 0.4 - Math.sin(perpAngle) * separation,
              radius: target.radius * 0.85,
              color: target.color,
              glow: target.glow,
              symbol: target.symbol,
              rotation: target.rotation,
              vRot: -0.1,
              cutAngle,
              side: -1,
              life: 0,
              maxLife: 26,
            },
            {
              x: target.x + Math.cos(perpAngle) * 5,
              y: target.y + Math.sin(perpAngle) * 5,
              vx: target.vx * 0.4 + Math.cos(perpAngle) * separation,
              vy: target.vy * 0.4 + Math.sin(perpAngle) * separation,
              radius: target.radius * 0.85,
              color: target.color,
              glow: target.glow,
              symbol: target.symbol,
              rotation: target.rotation,
              vRot: 0.1,
              cutAngle,
              side: 1,
              life: 0,
              maxLife: 26,
            }
          );

          // Slicing Particle Blast
          for (let k = 0; k < 12; k++) {
            const ang = cutAngle + (Math.random() - 0.5) * 1.5;
            const spd = 2.5 + Math.random() * 5;
            state.particles.push({
              x: target.x,
              y: target.y,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              color: target.color,
              size: 3.2,
              life: 0,
              maxLife: 20,
            });
          }
        }
      }

      // Discrete single-swipe multi-cut bonus (e.g. slicing 3+ in one quick stroke)
      if (state.strokeCuts >= 3) {
        const bonus = state.strokeCuts * 150;
        state.score += bonus;
        onScoreUpdate(state.score);
        if (soundEnabled) sounds.playVictory();
        addPopup(`🔥 ${state.strokeCuts}x SWIPE COMBO! +${bonus}`, p2.x, p2.y - 30, '#FACC15', 1.3);
        state.strokeCuts = 0; // consumed bonus for this stroke
      }
    },
    [addPopup, onGameOver, onScoreUpdate, soundEnabled]
  );

  // Pointer event handlers with stroke-bounded combo tracking
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current || !gameStateRef.current.isAlive || isPausedRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const state = gameStateRef.current;
    state.isPointerDown = true;
    state.strokeStartTime = performance.now();
    state.strokeCuts = 0;
    state.bladeTrail = [{ x, y, time: performance.now() }];
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!containerRef.current || isPausedRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const state = gameStateRef.current;
    if (!state.isPointerDown && e.buttons > 0) {
      state.isPointerDown = true;
      state.strokeStartTime = performance.now();
      state.strokeCuts = 0;
    }

    if (state.isPointerDown && state.isAlive) {
      const now = performance.now();

      // Reset single-stroke cut counter if finger has been held down longer than 320ms
      if (now - state.strokeStartTime > 320) {
        state.strokeStartTime = now;
        state.strokeCuts = 0;
      }

      const trail = state.bladeTrail;
      const prev = trail[trail.length - 1];

      trail.push({ x, y, time: now });
      if (trail.length > 12) trail.shift();

      if (prev) {
        const dist = Math.hypot(x - prev.x, y - prev.y);
        if (dist > 3) {
          performSliceCheck(prev, { x, y });
        }
      }
    }
  };

  const handlePointerUp = () => {
    const state = gameStateRef.current;
    state.isPointerDown = false;
    state.strokeCuts = 0;
  };

  const setSafeTimeout = useSafeTimeout();

  useEffect(() => {
    const state = gameStateRef.current;
    state.score = 0;
    state.lives = 3;
    state.combo = 0;
    state.comboTimer = 0;
    state.multiplier = 1;
    state.isAlive = true;
    state.hasShield = false;
    state.targets = [];
    state.slicedPieces = [];
    state.particles = [];
    state.floatingTexts = [];
    state.bladeTrail = [];
    state.spawnTimer = 20;
    state.physicsAccumulator = 0;
  }, []);

  useGameLoop({
    canvasRef,
    isPaused,
    onResize: (w, h) => {
      const state = gameStateRef.current;
      const scaleX = w / Math.max(1, state.width);
      const scaleY = h / Math.max(1, state.height);
      const previousGravity = getBladeGravity(state.height);
      const nextGravity = getBladeGravity(h);
      const flightTimeScale = Math.sqrt(
        Math.max(0.0001, (scaleY * previousGravity) / nextGravity),
      );
      const velocityScaleX = scaleX / flightTimeScale;
      const velocityScaleY = scaleY / flightTimeScale;

      for (const target of state.targets) {
        rescalePoint(target, scaleX, scaleY);
        rescaleVelocity(target, velocityScaleX, velocityScaleY);
      }
      for (const piece of state.slicedPieces) {
        rescalePoint(piece, scaleX, scaleY);
        rescaleVelocity(piece, velocityScaleX, velocityScaleY);
      }
      for (const particle of state.particles) {
        rescalePoint(particle, scaleX, scaleY);
        rescaleVelocity(particle, velocityScaleX, velocityScaleY);
      }
      rescaleTrail(state.bladeTrail, scaleX, scaleY);
      for (const text of state.floatingTexts) rescalePoint(text, scaleX, scaleY);

      state.width = w;
      state.height = h;
    },
    onUpdate: (ctx, dt, width, height) => {
      const state = gameStateRef.current;
      const w = width;
      const h = height;
      state.width = w;
      state.height = h;

      ctx.save();
      // Screen shake decays by elapsed time, not render count.
      const frameScale = Math.max(0.001, Math.min(dt, 0.05) * 60);
      if (state.shake > 0) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
        state.shake *= Math.pow(0.86, frameScale);
        if (state.shake < 0.2) state.shake = 0;
      }

      ctx.clearRect(-10, -10, w + 20, h + 20);

      if (!isPausedRef.current && state.isAlive) {
        const batch = getBladeSimulationStepBatch(state.physicsAccumulator, dt);
        state.physicsAccumulator = batch.remainderSec;

        // Preserve the original 60 Hz feel while making every gameplay timer and
        // physics update independent of the display refresh rate.
        for (let simStep = 0; simStep < batch.steps && state.isAlive; simStep++) {
        // Combo decay timer countdown
        if (state.comboTimer > 0) {
          state.comboTimer--;
          if (state.comboTimer === 0) {
            state.combo = 0;
            state.multiplier = 1;
          }
        }

        // Standard Spawner
        state.spawnTimer++;
        if (state.spawnTimer >= state.spawnInterval) {
          state.spawnTimer = 0;
          state.waveCount++;
          spawnWave(w, h);

          // Progressive Difficulty curve
          if (state.score > 12000) {
            state.difficultyTier = 4;
            state.spawnInterval = 48;
          } else if (state.score > 6000) {
            state.difficultyTier = 3;
            state.spawnInterval = 54;
          } else if (state.score > 2000) {
            state.difficultyTier = 2;
            state.spawnInterval = 60;
          }
        }

        // Update Flying Targets
        const gravity = getBladeGravity(h);
        for (let i = state.targets.length - 1; i >= 0; i--) {
          const t = state.targets[i];
          t.vy += gravity;
          t.x += t.vx;
          t.y += t.vy;
          t.rotation += t.vRot;

          // Dropped past bottom
          if (t.y > h + 50 && t.vy > 0) {
            if (!t.sliced && t.type !== 'bomb') {
              // Missing a fruit immediately breaks active combo
              state.combo = 0;
              state.comboTimer = 0;
              state.multiplier = 1;
            }
            state.targets.splice(i, 1);
          } else if (t.sliced) {
            state.targets.splice(i, 1);
          }
        }

        // Update Sliced Halves
        for (let i = state.slicedPieces.length - 1; i >= 0; i--) {
          const sp = state.slicedPieces[i];
          sp.vy += gravity * 1.2;
          sp.x += sp.vx;
          sp.y += sp.vy;
          sp.rotation += sp.vRot;
          sp.life++;
          if (sp.life >= sp.maxLife || sp.y > h + 60) {
            state.slicedPieces.splice(i, 1);
          }
        }

        // Update Particles
        for (let i = state.particles.length - 1; i >= 0; i--) {
          const p = state.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life++;
          if (p.life >= p.maxLife) {
            state.particles.splice(i, 1);
          }
        }

        // Blade Trail fading
        const now = performance.now();
        state.bladeTrail = state.bladeTrail.filter((pt) => now - pt.time < 150);

        // Update Floating Popups
        for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
          const ft = state.floatingTexts[i];
          ft.y -= 1.1;
          ft.life++;
          if (ft.life >= ft.maxLife) {
            state.floatingTexts.splice(i, 1);
          }
        }
        }
      }

      // ==========================================
      // CANVAS RENDERING
      // ==========================================
      ctx.fillStyle = '#05050A';
      ctx.fillRect(0, 0, w, h);

      // Background Subtle Cyber Mesh
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 36) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Render Flying Targets
      for (const t of state.targets) {
        if (t.sliced) continue;
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.rotate(t.rotation);

        if (t.type === 'bomb') {
          // EMP Bomb
          ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
          ctx.beginPath();
          ctx.arc(0, 0, t.radius * 1.3, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#18181B';
          ctx.beginPath();
          ctx.arc(0, 0, t.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 15px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('💣', 0, 0);
        } else {
          // Glow Halo
          ctx.fillStyle = t.glow;
          ctx.beginPath();
          ctx.arc(0, 0, t.radius * 1.25, 0, Math.PI * 2);
          ctx.fill();

          // Core Sphere
          ctx.fillStyle = t.color;
          ctx.beginPath();
          ctx.arc(0, 0, t.radius, 0, Math.PI * 2);
          ctx.fill();

          // Highlight Rim
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Inner Symbol
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(t.symbol, 0, 0);
        }

        ctx.restore();
      }

      // Render Sliced Halves
      for (const sp of state.slicedPieces) {
        const alpha = Math.max(0, 1 - sp.life / sp.maxLife);
        ctx.save();
        ctx.translate(sp.x, sp.y);
        ctx.rotate(sp.rotation);
        ctx.globalAlpha = alpha;

        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.arc(0, 0, sp.radius, 0, Math.PI);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
      }

      // Render Particles
      for (const p of state.particles) {
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Render Katana Blade Laser Trail
      const trail = state.bladeTrail;
      if (trail.length > 1) {
        const now = performance.now();
        for (let i = 1; i < trail.length; i++) {
          const pt1 = trail[i - 1];
          const pt2 = trail[i];
          const age = now - pt2.time;
          const alpha = Math.max(0, 1 - age / 150);
          const prog = i / trail.length;

          // Outer Laser Glow
          ctx.strokeStyle = state.combo >= 4
            ? `rgba(250, 204, 21, ${alpha})`
            : `rgba(244, 63, 94, ${alpha})`;
          ctx.lineWidth = 3 + prog * 6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);
          ctx.stroke();

          // White Razor Blade Core
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.lineWidth = 1.5 + prog * 1.5;
          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);
          ctx.stroke();
        }
      }

      // Render Floating Popups
      for (const ft of state.floatingTexts) {
        const alpha = Math.max(0, 1 - ft.life / ft.maxLife);
        ctx.fillStyle = ft.color;
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${Math.round(13 * ft.scale)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1;
      }

      ctx.restore();

      // Sync React HUD
      const ratio = state.comboTimer / state.maxComboTimer;
      setHudState((prev) => {
        if (
          prev.lives === state.lives &&
          prev.combo === state.combo &&
          prev.multiplier === state.multiplier &&
          prev.comboTimerRatio === ratio &&
          prev.hasShield === state.hasShield
        ) {
          return prev;
        }
        return {
          lives: state.lives,
          combo: state.combo,
          multiplier: state.multiplier,
          comboTimerRatio: ratio,
          hasShield: state.hasShield,
        };
      });

      return state.isAlive;
    },
  });

  return (
    <div
      ref={containerRef}
      id="laser-blade-container"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className="relative w-full h-full min-h-0 flex flex-col items-center justify-center bg-[#05050A] select-none overflow-hidden touch-none cursor-crosshair"
    >
      {/* Top HUD */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Lives */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] backdrop-blur-md">
            {Array.from({ length: 3 }).map((_, i) => (
              <Heart
                key={i}
                className={`w-4 h-4 transition-colors ${
                  i < hudState.lives ? 'text-red-500 fill-red-500' : 'text-zinc-600'
                }`}
              />
            ))}
          </div>

          {/* Shield */}
          {hudState.hasShield && (
            <div className="px-2 py-1 rounded-xl bg-purple-500/20 border border-purple-500/50 text-purple-300 font-mono text-xs font-black flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" />
              <span>SHIELD</span>
            </div>
          )}
        </div>

        {/* Combo Pill with decay timer bar */}
        {hudState.combo > 1 && (
          <div className="relative flex flex-col items-center px-3 py-1 rounded-xl bg-pink-500/20 border border-pink-500/50 text-pink-400 font-mono text-xs font-black overflow-hidden shadow-lg shadow-pink-500/10">
            <div className="flex items-center gap-1.5 z-10">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>
                COMBO {hudState.combo}x {hudState.multiplier > 1 ? `(${hudState.multiplier}x PTS)` : ''}
              </span>
            </div>
            {/* Decay Progress Bar */}
            <div
              className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-pink-500 to-amber-400 transition-all duration-75"
              style={{ width: `${Math.max(0, Math.min(100, hudState.comboTimerRatio * 100))}%` }}
            />
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />

      <div className="absolute bottom-2 text-[11px] font-mono text-zinc-500 pointer-events-none">
        SWIPE / DRAG BLADE TO SLICE • DODGE RED EMP BOMBS
      </div>
    </div>
  );
};
