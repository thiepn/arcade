import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { haptics } from '../lib/haptics';
import { RotateCcw, Award, Rocket, Compass, Clock, Zap, ArrowLeftRight, Navigation } from 'lucide-react';
import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';

interface Planet {
  x: number;
  y: number;
  radius: number;
  mass: number;
  baseMass: number;
  color: string;
  glow: string;
  type: 'gravity' | 'repulsion';
}

interface StarBonus {
  x: number;
  y: number;
  radius: number;
  collected: boolean;
}

interface Point {
  x: number;
  y: number;
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

export const GravityGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const [currentLevel, setCurrentLevel] = useState(1);
  const [lives, setLives] = useState(4);
  const [hasLaunched, setHasLaunched] = useState(false);
  const [starsCollected, setStarsCollected] = useState(0);
  const [boostsRemaining, setBoostsRemaining] = useState(4);
  const [isSlowMo, setIsSlowMo] = useState(false);
  const [gravityInverted, setGravityInverted] = useState(false);

  const isSlowMoRef = useRef(false);
  isSlowMoRef.current = isSlowMo;

  const gameStateRef = useRef({
    probe: { x: 150, y: 150, vx: 0, vy: 0, radius: 8 },
    startPos: { x: 150, y: 150 },
    aimDrag: { x: 0, y: 0 },
    isAiming: false,
    isSteering: false,
    steerTarget: { x: 0, y: 0 },
    target: { x: 300, y: 150, radius: 26 },
    planets: [] as Planet[],
    stars: [] as StarBonus[],
    particles: [] as Particle[],
    trail: [] as Point[],
    hasLaunched: false,
    boosts: 4,
    level: 1,
    lives: 4,
    score: 0,
    isAlive: true,
    attempts: 0,
    shake: 0,
    wormholePulse: 0,
    gravityInverted: false,
  });

  const setupLevel = useCallback((lvl: number, w: number, h: number) => {
    const state = gameStateRef.current;
    if (lvl > 5) {
      if (soundEnabled) sounds.playVictory();
      onGameOver(state.score + 3000);
      return;
    }

    // Centered Launch Base
    const cx = w * 0.5;
    const cy = h * 0.5;

    state.startPos = { x: cx, y: cy };
    state.probe = { x: cx, y: cy, vx: 0, vy: 0, radius: 8 };
    state.trail = [];
    state.particles = [];
    state.hasLaunched = false;
    state.isAiming = false;
    state.isSteering = false;
    state.boosts = 4;
    state.gravityInverted = false;
    setGravityInverted(false);
    setBoostsRemaining(4);
    setHasLaunched(false);
    setStarsCollected(0);
    setCurrentLevel(lvl);

    if (lvl === 1) {
      // Sector 1: Solar Orbit Slingshot
      state.target = { x: w * 0.84, y: h * 0.22, radius: 26 };
      state.planets = [
        {
          x: w * 0.5,
          y: h * 0.22,
          radius: 26,
          mass: 440,
          baseMass: 440,
          color: '#FB923C',
          glow: 'rgba(251, 146, 60, 0.5)',
          type: 'gravity',
        },
      ];
      state.stars = [
        { x: w * 0.28, y: h * 0.22, radius: 8, collected: false },
        { x: w * 0.5, y: h * 0.78, radius: 8, collected: false },
        { x: w * 0.75, y: h * 0.55, radius: 8, collected: false },
      ];
    } else if (lvl === 2) {
      // Sector 2: Binary Gravity Corridor
      state.target = { x: w * 0.85, y: h * 0.78, radius: 26 };
      state.planets = [
        {
          x: w * 0.7,
          y: h * 0.28,
          radius: 22,
          mass: 400,
          baseMass: 400,
          color: '#EC4899',
          glow: 'rgba(236, 72, 153, 0.5)',
          type: 'gravity',
        },
        {
          x: w * 0.28,
          y: h * 0.75,
          radius: 22,
          mass: 400,
          baseMass: 400,
          color: '#38BDF8',
          glow: 'rgba(56, 189, 248, 0.5)',
          type: 'gravity',
        },
      ];
      state.stars = [
        { x: w * 0.7, y: h * 0.52, radius: 8, collected: false },
        { x: w * 0.38, y: h * 0.28, radius: 8, collected: false },
        { x: w * 0.85, y: h * 0.45, radius: 8, collected: false },
      ];
    } else if (lvl === 3) {
      // Sector 3: Repulsor Slingshot Gate
      state.target = { x: w * 0.16, y: h * 0.22, radius: 26 };
      state.planets = [
        {
          x: w * 0.28,
          y: h * 0.7,
          radius: 24,
          mass: -320,
          baseMass: -320,
          color: '#A855F7',
          glow: 'rgba(168, 85, 247, 0.5)',
          type: 'repulsion',
        },
        {
          x: w * 0.72,
          y: h * 0.32,
          radius: 24,
          mass: 450,
          baseMass: 450,
          color: '#F43F5E',
          glow: 'rgba(244, 63, 94, 0.5)',
          type: 'gravity',
        },
      ];
      state.stars = [
        { x: w * 0.5, y: h * 0.22, radius: 8, collected: false },
        { x: w * 0.72, y: h * 0.72, radius: 8, collected: false },
        { x: w * 0.16, y: h * 0.65, radius: 8, collected: false },
      ];
    } else if (lvl === 4) {
      // Sector 4: Triangular Star System
      state.target = { x: w * 0.5, y: h * 0.86, radius: 26 };
      state.planets = [
        {
          x: w * 0.26,
          y: h * 0.28,
          radius: 20,
          mass: 380,
          baseMass: 380,
          color: '#38BDF8',
          glow: 'rgba(56, 189, 248, 0.5)',
          type: 'gravity',
        },
        {
          x: w * 0.74,
          y: h * 0.28,
          radius: 20,
          mass: 380,
          baseMass: 380,
          color: '#FACC15',
          glow: 'rgba(250, 204, 21, 0.5)',
          type: 'gravity',
        },
        {
          x: w * 0.8,
          y: h * 0.72,
          radius: 20,
          mass: -280,
          baseMass: -280,
          color: '#A855F7',
          glow: 'rgba(168, 85, 247, 0.5)',
          type: 'repulsion',
        },
      ];
      state.stars = [
        { x: w * 0.5, y: h * 0.2, radius: 8, collected: false },
        { x: w * 0.26, y: h * 0.72, radius: 8, collected: false },
        { x: w * 0.65, y: h * 0.55, radius: 8, collected: false },
      ];
    } else {
      // Sector 5: Grand Cosmic Odyssey
      state.target = { x: w * 0.86, y: h * 0.18, radius: 26 };
      state.planets = [
        {
          x: w * 0.24,
          y: h * 0.75,
          radius: 22,
          mass: 420,
          baseMass: 420,
          color: '#38BDF8',
          glow: 'rgba(56, 189, 248, 0.5)',
          type: 'gravity',
        },
        {
          x: w * 0.5,
          y: h * 0.18,
          radius: 24,
          mass: 460,
          baseMass: 460,
          color: '#FB923C',
          glow: 'rgba(251, 146, 60, 0.5)',
          type: 'gravity',
        },
        {
          x: w * 0.76,
          y: h * 0.75,
          radius: 22,
          mass: 420,
          baseMass: 420,
          color: '#EC4899',
          glow: 'rgba(236, 72, 153, 0.5)',
          type: 'gravity',
        },
      ];
      state.stars = [
        { x: w * 0.24, y: h * 0.35, radius: 8, collected: false },
        { x: w * 0.5, y: h * 0.82, radius: 8, collected: false },
        { x: w * 0.76, y: h * 0.35, radius: 8, collected: false },
      ];
    }
  }, [onGameOver, soundEnabled]);

  // Dynamic Gravity Polarity Flip (Attract <-> Repel)
  const handleFlipGravity = useCallback(() => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current) return;

    state.gravityInverted = !state.gravityInverted;
    setGravityInverted(state.gravityInverted);

    state.planets.forEach((p) => {
      p.mass = state.gravityInverted ? -p.baseMass : p.baseMass;
      p.type = p.mass < 0 ? 'repulsion' : 'gravity';
    });

    state.shake = 6;
    haptics.medium();
    if (soundEnabled) sounds.playWarp();

    // Pulse rings on all planets
    state.planets.forEach((p) => {
      for (let k = 0; k < 12; k++) {
        const ang = (k / 12) * Math.PI * 2;
        state.particles.push({
          x: p.x + Math.cos(ang) * p.radius,
          y: p.y + Math.sin(ang) * p.radius,
          vx: Math.cos(ang) * 3,
          vy: Math.sin(ang) * 3,
          color: p.type === 'repulsion' ? '#A855F7' : '#38BDF8',
          size: 3,
          life: 0,
          maxLife: 20,
        });
      }
    });
  }, [soundEnabled]);

  // Steer / Change Direction towards a target coordinate
  const applyDirectionSteer = useCallback((targetX: number, targetY: number, power = 1.0) => {
    const state = gameStateRef.current;
    if (!state.hasLaunched || !state.isAlive || isPausedRef.current) return;

    const dx = targetX - state.probe.x;
    const dy = targetY - state.probe.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return;

    const steerDirX = dx / dist;
    const steerDirY = dy / dist;

    // Apply smooth directional turning force
    state.probe.vx += steerDirX * 0.45 * power;
    state.probe.vy += steerDirY * 0.45 * power;

    // Thruster exhaust particles opposite to steering
    for (let k = 0; k < 3; k++) {
      state.particles.push({
        x: state.probe.x - steerDirX * 6,
        y: state.probe.y - steerDirY * 6,
        vx: -steerDirX * (2 + Math.random() * 3) + (Math.random() - 0.5) * 1.5,
        vy: -steerDirY * (2 + Math.random() * 3) + (Math.random() - 0.5) * 1.5,
        color: '#38BDF8',
        size: 2.5,
        life: 0,
        maxLife: 12,
      });
    }
  }, []);

  // Keyboard Steer Left / Right (Rotate velocity vector)
  const handleRotateDirection = useCallback((angleDelta: number) => {
    const state = gameStateRef.current;
    if (!state.hasLaunched || !state.isAlive || isPausedRef.current) return;

    const speed = Math.hypot(state.probe.vx, state.probe.vy);
    if (speed < 0.1) return;

    const currentAngle = Math.atan2(state.probe.vy, state.probe.vx);
    const newAngle = currentAngle + angleDelta;

    state.probe.vx = Math.cos(newAngle) * speed;
    state.probe.vy = Math.sin(newAngle) * speed;

    if (soundEnabled) sounds.playLaser();

    // Side thruster particles
    const perpX = -Math.sin(newAngle) * Math.sign(angleDelta);
    const perpY = Math.cos(newAngle) * Math.sign(angleDelta);
    for (let k = 0; k < 6; k++) {
      state.particles.push({
        x: state.probe.x,
        y: state.probe.y,
        vx: perpX * (2 + Math.random() * 2),
        vy: perpY * (2 + Math.random() * 2),
        color: '#FACC15',
        size: 2.5,
        life: 0,
        maxLife: 12,
      });
    }
  }, [soundEnabled]);

  // Instant recall back to the launch pad
  const handleRecallProbe = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current) return;

    if (soundEnabled) sounds.playPop();

    // Warp particles at current position
    for (let k = 0; k < 14; k++) {
      state.particles.push({
        x: state.probe.x,
        y: state.probe.y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        color: '#38BDF8',
        size: 3,
        life: 0,
        maxLife: 15,
      });
    }

    state.probe.x = state.startPos.x;
    state.probe.y = state.startPos.y;
    state.probe.vx = 0;
    state.probe.vy = 0;
    state.trail = [];
    state.hasLaunched = false;
    state.isAiming = false;
    state.isSteering = false;
    state.boosts = 4;
    setBoostsRemaining(4);
    setHasLaunched(false);
  }, [soundEnabled]);

  // Forward thruster burst along current velocity vector
  const handleForwardBoost = useCallback(() => {
    const state = gameStateRef.current;
    if (!state.hasLaunched || !state.isAlive || state.boosts <= 0 || isPausedRef.current) return;

    state.boosts--;
    setBoostsRemaining(state.boosts);

    const speed = Math.hypot(state.probe.vx, state.probe.vy) || 1;
    const dirX = state.probe.vx / speed;
    const dirY = state.probe.vy / speed;

    // Apply forward impulse
    state.probe.vx += dirX * 2.5;
    state.probe.vy += dirY * 2.5;
    state.shake = 6;

    if (soundEnabled) sounds.playLaser();

    // Rocket flame particles in opposite direction
    for (let k = 0; k < 18; k++) {
      state.particles.push({
        x: state.probe.x - dirX * 8,
        y: state.probe.y - dirY * 8,
        vx: -dirX * (3 + Math.random() * 4) + (Math.random() - 0.5) * 2,
        vy: -dirY * (3 + Math.random() * 4) + (Math.random() - 0.5) * 2,
        color: Math.random() > 0.4 ? '#FB923C' : '#FACC15',
        size: 3,
        life: 0,
        maxLife: 18,
      });
    }
  }, [soundEnabled]);

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

    // Slingshot Aim & Launch OR In-Flight Direction Steering Controls
    const handleDown = (e: MouseEvent | TouchEvent) => {
      const state = gameStateRef.current;
      if (isPausedRef.current || !state.isAlive) return;

      const pos = getPos(e);

      if (state.hasLaunched) {
        // In-flight steering: steer towards click/touch point!
        state.isSteering = true;
        state.steerTarget = pos;
        applyDirectionSteer(pos.x, pos.y, 1.5);
        return;
      }

      if ('touches' in e) e.preventDefault();
      state.isAiming = true;
      state.aimDrag = pos;
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const state = gameStateRef.current;
      const pos = getPos(e);

      if (state.hasLaunched && state.isSteering) {
        state.steerTarget = pos;
        applyDirectionSteer(pos.x, pos.y, 1.0);
        return;
      }

      if (!state.isAiming || state.hasLaunched) return;
      if ('touches' in e) e.preventDefault();
      state.aimDrag = pos;
    };

    const handleUp = () => {
      const state = gameStateRef.current;
      state.isSteering = false;

      if (!state.isAiming || state.hasLaunched) return;
      state.isAiming = false;

      const dx = state.probe.x - state.aimDrag.x;
      const dy = state.probe.y - state.aimDrag.y;
      const power = Math.hypot(dx, dy);

      if (power > 12) {
        state.probe.vx = dx * 0.075;
        state.probe.vy = dy * 0.075;
        state.hasLaunched = true;
        state.attempts++;
        setHasLaunched(true);
        haptics.medium();
        if (soundEnabled) sounds.playPop();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R' || e.key === 'Escape') {
        handleRecallProbe();
      } else if (e.key === 'g' || e.key === 'G') {
        handleFlipGravity();
      } else if (e.key === 'a' || e.key === 'ArrowLeft') {
        handleRotateDirection(-0.25);
      } else if (e.key === 'd' || e.key === 'ArrowRight') {
        handleRotateDirection(0.25);
      } else if (e.key === ' ' || e.key === 'w' || e.key === 'ArrowUp') {
        handleForwardBoost();
      } else if (e.key === 's' || e.key === 'ArrowDown') {
        // Retro-brake
        const state = gameStateRef.current;
        if (state.hasLaunched && state.isAlive) {
          state.probe.vx *= 0.75;
          state.probe.vy *= 0.75;
          if (soundEnabled) sounds.playPop();
        }
      } else if (e.key === 'Shift') {
        setIsSlowMo((prev) => !prev);
      }
    };

    canvas.addEventListener('mousedown', handleDown);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    canvas.addEventListener('touchstart', handleDown, { passive: false });
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      canvas.removeEventListener('mousedown', handleDown);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      canvas.removeEventListener('touchstart', handleDown);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    applyDirectionSteer,
    handleFlipGravity,
    handleForwardBoost,
    handleRecallProbe,
    handleRotateDirection,
    soundEnabled,
  ]);

  useGameLoop({
    canvasRef,
    isPaused,
    onResize: (w, h) => {
      setupLevel(gameStateRef.current.level, w, h);
    },
    onUpdate: (ctx, dt, curW, curH) => {
      const state = gameStateRef.current;

      ctx.save();

      if (state.shake > 0) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
        state.shake *= 0.88;
        if (state.shake < 0.2) state.shake = 0;
      }

      ctx.clearRect(-20, -20, curW + 40, curH + 40);

      state.wormholePulse += 0.05;

      if (!isPausedRef.current && state.isAlive) {
        if (state.hasLaunched) {
          const timeScale = isSlowMoRef.current ? 0.35 : 1.0;

          // Continuous touch/mouse steering if user is holding pointer down
          if (state.isSteering) {
            applyDirectionSteer(state.steerTarget.x, state.steerTarget.y, 0.6);
          }

          // Pure Newtonian gravitational & repulsor physics
          let fx = 0;
          let fy = 0;

          state.planets.forEach((planet) => {
            const dx = planet.x - state.probe.x;
            const dy = planet.y - state.probe.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 6) {
              const force = (planet.mass * 0.75) / (dist * dist);
              fx += (dx / dist) * force;
              fy += (dy / dist) * force;
            }

            // Planet collision
            if (dist < planet.radius * 0.85 + state.probe.radius) {
              state.hasLaunched = false;
              state.shake = 10;
              state.lives--;
              setLives(state.lives);
              haptics.impact();
              if (soundEnabled) sounds.playExplosion();

              for (let k = 0; k < 18; k++) {
                const ang = Math.random() * Math.PI * 2;
                state.particles.push({
                  x: state.probe.x,
                  y: state.probe.y,
                  vx: Math.cos(ang) * (2 + Math.random() * 4),
                  vy: Math.sin(ang) * (2 + Math.random() * 4),
                  color: planet.color,
                  size: 3.5,
                  life: 0,
                  maxLife: 25,
                });
              }

              if (state.lives <= 0) {
                state.isAlive = false;
                haptics.gameOver();
                onGameOver(state.score);
              } else {
                setSafeTimeout(() => {
                  state.probe.x = state.startPos.x;
                  state.probe.y = state.startPos.y;
                  state.probe.vx = 0;
                  state.probe.vy = 0;
                  state.trail = [];
                  state.boosts = 4;
                  setBoostsRemaining(4);
                  setHasLaunched(false);
                }, 400);
              }
            }
          });

          // Target Wormhole gravitational pull
          const tdx = state.target.x - state.probe.x;
          const tdy = state.target.y - state.probe.y;
          const tdist = Math.hypot(tdx, tdy);

          if (tdist < 100) {
            const pull = (100 - tdist) * 0.0045;
            fx += (tdx / tdist) * pull;
            fy += (tdy / tdist) * pull;
          }

          state.probe.vx += fx * timeScale;
          state.probe.vy += fy * timeScale;
          state.probe.x += state.probe.vx * timeScale;
          state.probe.y += state.probe.vy * timeScale;

          // Trail logging
          state.trail.push({ x: state.probe.x, y: state.probe.y });
          if (state.trail.length > 50) state.trail.shift();

          // Star pickups
          state.stars.forEach((s) => {
            if (!s.collected) {
              const sdist = Math.hypot(s.x - state.probe.x, s.y - state.probe.y);
              if (sdist < s.radius + state.probe.radius) {
                s.collected = true;
                state.score += 500;
                onScoreUpdate(state.score);
                setStarsCollected((prev) => prev + 1);
                haptics.score();
                if (soundEnabled) sounds.playScore();

                for (let k = 0; k < 12; k++) {
                  state.particles.push({
                    x: s.x,
                    y: s.y,
                    vx: (Math.random() - 0.5) * 5,
                    vy: (Math.random() - 0.5) * 5,
                    color: '#FACC15',
                    size: 3,
                    life: 0,
                    maxLife: 20,
                  });
                }
              }
            }
          });

          // Target Wormhole Victory Condition
          if (tdist < state.target.radius * 0.8 + state.probe.radius) {
            state.hasLaunched = false;
            setHasLaunched(false);

            const collectedStars = state.stars.filter((s) => s.collected).length;
            const sectorBonus = 1000 + collectedStars * 500;
            state.score += sectorBonus;
            onScoreUpdate(state.score);

            haptics.combo();
            if (soundEnabled) sounds.playSuccess();

            for (let k = 0; k < 30; k++) {
              state.particles.push({
                x: state.target.x,
                y: state.target.y,
                vx: (Math.random() - 0.5) * 7,
                vy: (Math.random() - 0.5) * 7,
                color: '#34D399',
                size: 4,
                life: 0,
                maxLife: 30,
              });
            }

            state.level++;
            setSafeTimeout(() => {
              setupLevel(state.level, curW, curH);
            }, 600);
          }

          // Deep Space Void (Out of Bounds)
          if (
            state.probe.x < -80 ||
            state.probe.x > curW + 80 ||
            state.probe.y < -80 ||
            state.probe.y > curH + 80
          ) {
            state.hasLaunched = false;
            setHasLaunched(false);
            state.lives--;
            setLives(state.lives);
            if (soundEnabled) sounds.playBuzz();

            if (state.lives <= 0) {
              state.isAlive = false;
              onGameOver(state.score);
            } else {
              setSafeTimeout(() => {
                state.probe.x = state.startPos.x;
                state.probe.y = state.startPos.y;
                state.probe.vx = 0;
                state.probe.vy = 0;
                state.trail = [];
                state.boosts = 4;
                setBoostsRemaining(4);
                setHasLaunched(false);
              }, 300);
            }
          }
        }
      }

      // --- RENDERING ---

      // Background Deep Cosmic Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < curW; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, curH);
        ctx.stroke();
      }

      // Launch Base Pad (Centered on screen)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(state.startPos.x, state.startPos.y, 22, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(56, 189, 248, 0.06)';
      ctx.beginPath();
      ctx.arc(state.startPos.x, state.startPos.y, 22, 0, Math.PI * 2);
      ctx.fill();

      // Planets & Repulsors
      state.planets.forEach((p) => {
        // Gravity / Repulsion Aura Ring
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.type === 'repulsion' ? 1.5 : 1;
        if (p.type === 'repulsion') ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 2.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Core Planet Body
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.type === 'repulsion' ? 'REPULSE' : 'ATTRACT', p.x, p.y);
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

      // Target Wormhole
      const targetR = state.target.radius + Math.sin(state.wormholePulse) * 2;
      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(state.target.x, state.target.y, targetR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(52, 211, 153, 0.2)';
      ctx.beginPath();
      ctx.arc(state.target.x, state.target.y, targetR, 0, Math.PI * 2);
      ctx.fill();

      // Steering Target Indicator Line (when user is touching/holding in flight)
      if (state.hasLaunched && state.isSteering) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(state.probe.x, state.probe.y);
        ctx.lineTo(state.steerTarget.x, state.steerTarget.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(state.steerTarget.x, state.steerTarget.y, 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Trajectory Prediction (Slingshot)
      if (state.isAiming && !state.hasLaunched) {
        const dx = state.probe.x - state.aimDrag.x;
        const dy = state.probe.y - state.aimDrag.y;
        let simX = state.probe.x;
        let simY = state.probe.y;
        let simVx = dx * 0.075;
        let simVy = dy * 0.075;

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(simX, simY);

        for (let step = 0; step < 220; step++) {
          let sfx = 0;
          let sfy = 0;
          for (let p of state.planets) {
            const pdx = p.x - simX;
            const pdy = p.y - simY;
            const pdist = Math.hypot(pdx, pdy);
            if (pdist > 6) {
              const pforce = (p.mass * 0.75) / (pdist * pdist);
              sfx += (pdx / pdist) * pforce;
              sfy += (pdy / pdist) * pforce;
            }
          }

          const simTdx = state.target.x - simX;
          const simTdy = state.target.y - simY;
          const simTdist = Math.hypot(simTdx, simTdy);
          if (simTdist < 100) {
            const simPull = (100 - simTdist) * 0.0045;
            sfx += (simTdx / simTdist) * simPull;
            sfy += (simTdy / simTdist) * simPull;
          }

          simVx += sfx;
          simVy += sfy;
          simX += simVx;
          simY += simVy;
          ctx.lineTo(simX, simY);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Slingshot Pull Vector Line
        ctx.strokeStyle = '#F43F5E';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(state.probe.x, state.probe.y);
        ctx.lineTo(state.aimDrag.x, state.aimDrag.y);
        ctx.stroke();
      }

      // Probe Trail
      if (state.trail.length > 1) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(state.trail[0].x, state.trail[0].y);
        for (let i = 1; i < state.trail.length; i++) {
          ctx.lineTo(state.trail[i].x, state.trail[i].y);
        }
        ctx.stroke();
      }

      // Probe Ship & Heading Indicator
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(state.probe.x, state.probe.y, state.probe.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Velocity direction pointer
      if (state.hasLaunched) {
        const spd = Math.hypot(state.probe.vx, state.probe.vy);
        if (spd > 0.1) {
          const hx = (state.probe.vx / spd) * 14;
          const hy = (state.probe.vy / spd) * 14;
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(state.probe.x, state.probe.y);
          ctx.lineTo(state.probe.x + hx, state.probe.y + hy);
          ctx.stroke();
        }
      }

      // Particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
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
    <div className="relative w-full h-full flex flex-col items-center justify-between select-none game-canvas-container touch-none bg-[#090D16] overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair touch-none" />

      {/* Top HUD */}
      <div className="absolute top-3 left-4 flex items-center gap-3 bg-[#18181B]/90 border border-[#27272A] px-3.5 py-1.5 rounded-xl font-mono-arcade text-xs z-10 pointer-events-none backdrop-blur-md">
        <span className="text-white font-bold">SECTOR {currentLevel}/5</span>
        <div className="flex items-center gap-1 text-amber-400">
          <Award className="w-3.5 h-3.5" />
          <span>{starsCollected} / 3 STARS</span>
        </div>
        <span className="text-[#71717A]">|</span>
        <span className="text-[#F43F5E] font-bold">PROBES: {lives}</span>
        <span className="text-[#71717A]">|</span>
        <span className={gravityInverted ? 'text-purple-400 font-bold' : 'text-cyan-400 font-bold'}>
          {gravityInverted ? 'REPULSE FIELD' : 'GRAVITY FIELD'}
        </span>
      </div>

      {/* Top Right Quick Controls */}
      <div className="absolute top-3 right-4 flex items-center gap-2 z-10">
        {/* Flip Gravity Polarity Button */}
        <button
          type="button"
          onClick={handleFlipGravity}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono-arcade text-xs transition-colors cursor-pointer backdrop-blur-md ${
            gravityInverted
              ? 'bg-purple-600/30 border-purple-500 text-purple-300'
              : 'bg-[#18181B]/90 border-[#27272A] text-cyan-300 hover:text-white'
          }`}
          title="Flip gravitational polarity (Attract <-> Repel)"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" /> FLIP GRAVITY [G]
        </button>

        {/* Slow-mo Toggle */}
        {hasLaunched && (
          <button
            type="button"
            onClick={() => setIsSlowMo(!isSlowMo)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono-arcade text-xs transition-colors cursor-pointer backdrop-blur-md ${
              isSlowMo
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 animate-pulse'
                : 'bg-[#18181B]/90 border-[#27272A] text-[#A1A1AA] hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> {isSlowMo ? 'SLOW-MO [ACTIVE]' : 'SLOW-MO'}
          </button>
        )}

        <button
          type="button"
          onClick={handleRecallProbe}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#18181B] hover:bg-[#27272A] active:bg-[#3F3F46] text-[#A1A1AA] hover:text-white border border-[#27272A] font-mono-arcade text-xs transition-colors cursor-pointer backdrop-blur-md"
        >
          <RotateCcw className="w-3.5 h-3.5" /> RE-AIM [R]
        </button>
      </div>

      {/* Bottom Action Bar & Guidance */}
      {hasLaunched ? (
        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-2.5 z-10 pointer-events-auto">
          {/* Turn Left */}
          <button
            type="button"
            onClick={() => handleRotateDirection(-0.25)}
            className="px-3 py-2.5 bg-[#18181B]/90 hover:bg-[#27272A] text-cyan-300 font-mono-arcade text-xs font-bold rounded-xl border border-zinc-700 backdrop-blur-md transition-all cursor-pointer flex items-center justify-center gap-1"
          >
            ◀ TURN [A]
          </button>

          {/* Forward Thruster Boost */}
          <button
            type="button"
            onClick={handleForwardBoost}
            disabled={boostsRemaining <= 0}
            className={`flex-1 py-2.5 rounded-xl font-mono-arcade text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 backdrop-blur-md ${
              boostsRemaining > 0
                ? 'bg-cyan-600/80 hover:bg-cyan-500 active:scale-95 text-white border-cyan-400/40 shadow-lg shadow-cyan-950/50'
                : 'bg-zinc-800/60 text-zinc-500 border-zinc-700 cursor-not-allowed'
            }`}
          >
            <Rocket className="w-3.5 h-3.5" /> BOOST ({boostsRemaining}) [SPACE]
          </button>

          {/* Turn Right */}
          <button
            type="button"
            onClick={() => handleRotateDirection(0.25)}
            className="px-3 py-2.5 bg-[#18181B]/90 hover:bg-[#27272A] text-cyan-300 font-mono-arcade text-xs font-bold rounded-xl border border-zinc-700 backdrop-blur-md transition-all cursor-pointer flex items-center justify-center gap-1"
          >
            TURN [D] ▶
          </button>

          {/* Recall Button */}
          <button
            type="button"
            onClick={handleRecallProbe}
            className="px-3 py-2.5 bg-[#18181B]/90 hover:bg-[#27272A] text-zinc-400 hover:text-white font-mono-arcade text-xs font-bold rounded-xl border border-zinc-700 backdrop-blur-md transition-all cursor-pointer flex items-center justify-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> RECALL [R]
          </button>
        </div>
      ) : (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#18181B]/90 border border-[#27272A] px-4 py-1.5 rounded-full font-mono-arcade text-xs text-[#A1A1AA] pointer-events-none z-10 backdrop-blur-md text-center">
          <Compass className="w-3.5 h-3.5 text-[#38BDF8] animate-spin" />
          <span>DRAG TO SLINGSHOT • CLICK/TOUCH IN FLIGHT OR USE A/D TO CHANGE DIRECTION</span>
        </div>
      )}
    </div>
  );
};
