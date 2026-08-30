import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { haptics } from '../lib/haptics';
import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';
import { clamp, rescalePoint, rescaleTrail, rescaleVelocity } from '../lib/gameCoordinates';
import { ASTRO_FIXED_STEP_SEC, getAstroPhysicsStepBatch } from '../lib/astroRuntime';
import {
  RotateCcw,
  RotateCw,
  Rocket,
  Crosshair,
  Shield,
  Zap,
  Sparkles,
  Heart,
  Radio,
} from 'lucide-react';

interface Ship {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  isThrusting: boolean;
  shieldTimer: number;
  tripleShotTimer: number;
  invulnerableTimer: number;
}

interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  isEnemy?: boolean;
}

interface Asteroid {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  tier: 3 | 2 | 1; // 3: Large, 2: Medium, 1: Small
  specialType: 'normal' | 'gold' | 'explosive' | 'ice';
  vertices: { x: number; y: number }[];
  rotation: number;
  vRot: number;
  color: string;
  glow: string;
  points: number;
}

interface Ufo {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  shootTimer: number;
  color: string;
}

interface Stardust {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  points: number;
  color: string;
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

interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  life: number;
  maxLife: number;
}

export const AstroBlasterGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [hasShield, setHasShield] = useState(false);
  const [hasTripleShot, setHasTripleShot] = useState(false);

  const gameStateRef = useRef({
    score: 0,
    lives: 3,
    level: 1,
    isAlive: true,
    shake: 0,
    nextId: 1,
    width: 600,
    height: 500,

    ship: {
      x: 300,
      y: 250,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      radius: 14,
      isThrusting: false,
      shieldTimer: 0,
      tripleShotTimer: 0,
      invulnerableTimer: 90, // Safe on spawn
    } as Ship,

    bullets: [] as Bullet[],
    asteroids: [] as Asteroid[],
    ufos: [] as Ufo[],
    stardustList: [] as Stardust[],
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],

    keys: {
      left: false,
      right: false,
      thrust: false,
      shoot: false,
    },

    ufoSpawnTimer: 450,
    shootCooldown: 0,
    physicsAccumulator: 0,
  });

  const addPopup = useCallback((text: string, x: number, y: number, color = '#FFFFFF') => {
    gameStateRef.current.floatingTexts.push({
      id: gameStateRef.current.nextId++,
      text,
      x,
      y,
      color,
      life: 0,
      maxLife: 35,
    });
  }, []);

  // Generate randomized vector polygon for asteroid
  const createAsteroidVertices = (radius: number) => {
    const numPoints = 8 + Math.floor(Math.random() * 5);
    const vertices: { x: number; y: number }[] = [];
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const dist = radius * (0.75 + Math.random() * 0.45);
      vertices.push({
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
      });
    }
    return vertices;
  };

  const spawnAsteroid = useCallback(
    (
      x: number,
      y: number,
      tier: 3 | 2 | 1,
      specialType: 'normal' | 'gold' | 'explosive' | 'ice' = 'normal'
    ) => {
      const state = gameStateRef.current;
      const radius = tier === 3 ? 34 : tier === 2 ? 22 : 12;
      const speed = tier === 3 ? 0.7 + Math.random() * 0.8 : tier === 2 ? 1.2 + Math.random() * 1.0 : 1.8 + Math.random() * 1.2;
      const ang = Math.random() * Math.PI * 2;

      let color = '#38BDF8';
      let glow = 'rgba(56, 189, 248, 0.4)';
      let points = tier === 3 ? 50 : tier === 2 ? 100 : 200;

      if (specialType === 'gold') {
        color = '#FACC15';
        glow = 'rgba(250, 204, 21, 0.6)';
        points *= 3;
      } else if (specialType === 'explosive') {
        color = '#EF4444';
        glow = 'rgba(239, 68, 68, 0.6)';
        points *= 2;
      } else if (specialType === 'ice') {
        color = '#06B6D4';
        glow = 'rgba(6, 182, 212, 0.6)';
        points *= 2;
      }

      state.asteroids.push({
        id: state.nextId++,
        x,
        y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        radius,
        tier,
        specialType,
        vertices: createAsteroidVertices(radius),
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.04,
        color,
        glow,
        points,
      });
    },
    []
  );

  const startLevel = useCallback(
    (lvl: number) => {
      const state = gameStateRef.current;
      const w = state.width;
      const h = state.height;
      state.level = lvl;
      setLevel(lvl);

      const numLarge = 3 + lvl;
      for (let i = 0; i < numLarge; i++) {
        let x: number, y: number;
        do {
          x = Math.random() * w;
          y = Math.random() * h;
        } while (Math.hypot(x - state.ship.x, y - state.ship.y) < 130);

        const rand = Math.random();
        let special: 'normal' | 'gold' | 'explosive' | 'ice' = 'normal';
        if (rand < 0.15) special = 'gold';
        else if (rand < 0.28) special = 'explosive';
        else if (rand < 0.40) special = 'ice';

        spawnAsteroid(x, y, 3, special);
      }

      addPopup(`WAVE ${lvl} ENGAGED`, w / 2, h / 2, '#38BDF8');
      if (soundEnabledRef.current) sounds.playPowerUp();
    },
    [addPopup, spawnAsteroid]
  );

  // Shoot Plasma Cannon
  const fireBullet = useCallback(() => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current || state.shootCooldown > 0) return;

    state.shootCooldown = 11;
    const s = state.ship;
    const speed = 9.5;

    if (soundEnabled) sounds.playLaser();
    haptics.light();

    if (s.tripleShotTimer > 0) {
      // Triple Shot
      [-0.22, 0, 0.22].forEach((offset) => {
        const bulletAngle = s.angle + offset;
        state.bullets.push({
          id: state.nextId++,
          x: s.x + Math.cos(s.angle) * s.radius,
          y: s.y + Math.sin(s.angle) * s.radius,
          vx: Math.cos(bulletAngle) * speed + s.vx * 0.3,
          vy: Math.sin(bulletAngle) * speed + s.vy * 0.3,
          life: 0,
          maxLife: 42,
          color: '#FACC15',
        });
      });
    } else {
      // Twin Lasers
      state.bullets.push({
        id: state.nextId++,
        x: s.x + Math.cos(s.angle) * s.radius,
        y: s.y + Math.sin(s.angle) * s.radius,
        vx: Math.cos(s.angle) * speed + s.vx * 0.3,
        vy: Math.sin(s.angle) * speed + s.vy * 0.3,
        life: 0,
        maxLife: 45,
        color: '#38BDF8',
      });
    }
  }, [soundEnabled]);

  // Emergency Hyperspace Warp
  const triggerHyperspace = useCallback(() => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current) return;

    const w = state.width;
    const h = state.height;

    // Warp Out Particles
    for (let k = 0; k < 20; k++) {
      const ang = Math.random() * Math.PI * 2;
      state.particles.push({
        x: state.ship.x,
        y: state.ship.y,
        vx: Math.cos(ang) * (3 + Math.random() * 4),
        vy: Math.sin(ang) * (3 + Math.random() * 4),
        color: '#A855F7',
        size: 3.5,
        life: 0,
        maxLife: 25,
      });
    }

    state.ship.x = w * (0.15 + Math.random() * 0.7);
    state.ship.y = h * (0.15 + Math.random() * 0.7);
    state.ship.vx = 0;
    state.ship.vy = 0;
    state.ship.invulnerableTimer = 60;

    if (soundEnabled) sounds.playTeleportWarp();
    haptics.heavy();
    addPopup('HYPERSPACE WARP!', state.ship.x, state.ship.y - 20, '#A855F7');
  }, [addPopup, soundEnabled]);

  // Keyboard input listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      const keys = gameStateRef.current.keys;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.thrust = true;
      if (e.key === ' ' || e.code === 'Space') {
        keys.shoot = true;
        fireBullet();
      }
      if (e.key === 'Shift' || e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
        triggerHyperspace();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const keys = gameStateRef.current.keys;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.thrust = false;
      if (e.key === ' ' || e.code === 'Space') keys.shoot = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [fireBullet, triggerHyperspace]);

  const setSafeTimeout = useSafeTimeout();

  // Initial setup on mount
  useEffect(() => {
    const state = gameStateRef.current;
    state.score = 0;
    state.lives = 3;
    state.level = 1;
    state.isAlive = true;
    state.asteroids = [];
    state.bullets = [];
    state.ufos = [];
    state.stardustList = [];
    state.particles = [];
    state.floatingTexts = [];
    state.ship.vx = 0;
    state.ship.vy = 0;
    state.ship.angle = -Math.PI / 2;
    state.ship.shieldTimer = 0;
    state.ship.tripleShotTimer = 0;
    state.ship.invulnerableTimer = 90;
    state.ufoSpawnTimer = 450;
    state.shootCooldown = 0;
    state.physicsAccumulator = 0;
    startLevel(1);
  }, [startLevel]);

  useGameLoop({
    canvasRef,
    isPaused,
    onResize: (w, h) => {
      const state = gameStateRef.current;
      const scaleX = w / Math.max(1, state.width);
      const scaleY = h / Math.max(1, state.height);
      const uniformScale = Math.min(scaleX, scaleY);

      rescalePoint(state.ship, scaleX, scaleY);
      rescaleVelocity(state.ship, scaleX, scaleY);
      state.ship.radius = clamp(state.ship.radius * uniformScale, 11, 21);

      for (const bullet of state.bullets) {
        rescalePoint(bullet, scaleX, scaleY);
        rescaleVelocity(bullet, scaleX, scaleY);
      }
      for (const asteroid of state.asteroids) {
        rescalePoint(asteroid, scaleX, scaleY);
        rescaleVelocity(asteroid, scaleX, scaleY);
        asteroid.radius *= uniformScale;
        for (const vertex of asteroid.vertices) {
          vertex.x *= uniformScale;
          vertex.y *= uniformScale;
        }
      }
      for (const ufo of state.ufos) {
        rescalePoint(ufo, scaleX, scaleY);
        rescaleVelocity(ufo, scaleX, scaleY);
        ufo.radius *= uniformScale;
      }
      for (const stardust of state.stardustList) {
        rescalePoint(stardust, scaleX, scaleY);
        rescaleVelocity(stardust, scaleX, scaleY);
      }
      for (const particle of state.particles) {
        rescalePoint(particle, scaleX, scaleY);
        rescaleVelocity(particle, scaleX, scaleY);
        particle.size *= uniformScale;
      }
      for (const text of state.floatingTexts) rescalePoint(text, scaleX, scaleY);

      state.width = w;
      state.height = h;
      state.physicsAccumulator = 0;
      state.ship.x = ((state.ship.x % w) + w) % w;
      state.ship.y = ((state.ship.y % h) + h) % h;
    },
    onUpdate: (ctx, deltaSec, width, height) => {
      const state = gameStateRef.current;
      const w = width;
      const h = height;
      state.width = w;
      state.height = h;

      ctx.save();
      if (state.shake > 0) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
        const frameScale = Math.max(0, Math.min(deltaSec, 0.08) * 60);
        state.shake *= Math.pow(0.88, frameScale);
        if (state.shake < 0.2) state.shake = 0;
      }

      ctx.clearRect(-10, -10, w + 20, h + 20);

      // =====================================
      // PHYSICS & UPDATE LOGIC
      // =====================================
      if (!isPausedRef.current && state.isAlive) {
        const batch = getAstroPhysicsStepBatch(state.physicsAccumulator, deltaSec);
        state.physicsAccumulator = batch.remainderSec;
        for (let simStep = 0; simStep < batch.steps && state.isAlive; simStep++) {
          const dt = ASTRO_FIXED_STEP_SEC;
          const s = state.ship;

        // Ship Timers
        if (s.invulnerableTimer > 0) s.invulnerableTimer--;
        if (s.shieldTimer > 0) s.shieldTimer--;
        if (s.tripleShotTimer > 0) s.tripleShotTimer--;
        if (state.shootCooldown > 0) state.shootCooldown--;

        // Ship Steering
        const rotSpeed = 0.075;
        if (state.keys.left) s.angle -= rotSpeed;
        if (state.keys.right) s.angle += rotSpeed;

        // Thrust Acceleration
        s.isThrusting = state.keys.thrust;
        if (s.isThrusting) {
          const thrustPower = 0.16;
          s.vx += Math.cos(s.angle) * thrustPower;
          s.vy += Math.sin(s.angle) * thrustPower;

          // Thruster Exhaust Particles
          const exhaustAngle = s.angle + Math.PI + (Math.random() - 0.5) * 0.5;
          state.particles.push({
            x: s.x - Math.cos(s.angle) * s.radius,
            y: s.y - Math.sin(s.angle) * s.radius,
            vx: Math.cos(exhaustAngle) * (2 + Math.random() * 3) + s.vx * 0.3,
            vy: Math.sin(exhaustAngle) * (2 + Math.random() * 3) + s.vy * 0.3,
            color: Math.random() > 0.4 ? '#38BDF8' : '#F59E0B',
            size: 2.5,
            life: 0,
            maxLife: 16,
          });
        }

        // Space Friction
        s.vx *= 0.985;
        s.vy *= 0.985;

        // Max Speed Cap
        const maxSpeed = 7.5;
        const curSpeed = Math.hypot(s.vx, s.vy);
        if (curSpeed > maxSpeed) {
          s.vx = (s.vx / curSpeed) * maxSpeed;
          s.vy = (s.vy / curSpeed) * maxSpeed;
        }

        // Update Ship Position & Toroidal Screen Wrap
        s.x = (s.x + s.vx + w) % w;
        s.y = (s.y + s.vy + h) % h;

        // Update Bullets
        for (let i = state.bullets.length - 1; i >= 0; i--) {
          const b = state.bullets[i];
          b.x = (b.x + b.vx + w) % w;
          b.y = (b.y + b.vy + h) % h;
          b.life++;
          if (b.life >= b.maxLife) {
            state.bullets.splice(i, 1);
          }
        }

        // Update Asteroids
        for (let i = state.asteroids.length - 1; i >= 0; i--) {
          const a = state.asteroids[i];
          a.x = (a.x + a.vx + w) % w;
          a.y = (a.y + a.vy + h) % h;
          a.rotation += a.vRot;
        }

        // Update UFOs
        state.ufoSpawnTimer--;
        if (state.ufoSpawnTimer <= 0) {
          state.ufoSpawnTimer = 500 + Math.random() * 400;
          const ufoY = h * (0.2 + Math.random() * 0.6);
          const fromLeft = Math.random() > 0.5;
          state.ufos.push({
            id: state.nextId++,
            x: fromLeft ? -20 : w + 20,
            y: ufoY,
            vx: fromLeft ? 1.8 : -1.8,
            vy: (Math.random() - 0.5) * 0.8,
            radius: 18,
            shootTimer: 80,
            color: '#EC4899',
          });
          if (soundEnabled) sounds.playTone(880, 0.2, 'square');
        }

        for (let i = state.ufos.length - 1; i >= 0; i--) {
          const ufo = state.ufos[i];
          ufo.x += ufo.vx;
          ufo.y += ufo.vy;
          ufo.shootTimer--;

          // UFO Shoots at Player
          if (ufo.shootTimer <= 0) {
            ufo.shootTimer = 90;
            const aimAngle = Math.atan2(s.y - ufo.y, s.x - ufo.x);
            state.bullets.push({
              id: state.nextId++,
              x: ufo.x,
              y: ufo.y,
              vx: Math.cos(aimAngle) * 4.5,
              vy: Math.sin(aimAngle) * 4.5,
              life: 0,
              maxLife: 60,
              color: '#EC4899',
              isEnemy: true,
            });
            if (soundEnabled) sounds.playLaser();
          }

          if (ufo.x < -40 || ufo.x > w + 40) {
            state.ufos.splice(i, 1);
          }
        }

        // Update Stardust Collectibles
        for (let i = state.stardustList.length - 1; i >= 0; i--) {
          const sd = state.stardustList[i];
          sd.x = (sd.x + sd.vx + w) % w;
          sd.y = (sd.y + sd.vy + h) % h;
          sd.life++;

          // Magnet toward ship if close
          const distToShip = Math.hypot(s.x - sd.x, s.y - sd.y);
          if (distToShip < 90) {
            const pullAng = Math.atan2(s.y - sd.y, s.x - sd.x);
            sd.vx += Math.cos(pullAng) * 0.4;
            sd.vy += Math.sin(pullAng) * 0.4;
          }

          // Collection by ship
          if (distToShip < s.radius + 12) {
            state.score += sd.points;
            onScoreUpdate(state.score);
            if (soundEnabled) sounds.playScore();
            haptics.light();
            addPopup(`+${sd.points}`, sd.x, sd.y - 12, sd.color);
            state.stardustList.splice(i, 1);
            continue;
          }

          if (sd.life >= sd.maxLife) {
            state.stardustList.splice(i, 1);
          }
        }

        // =====================================
        // BULLET - ASTEROID COLLISIONS
        // =====================================
        for (let bIdx = state.bullets.length - 1; bIdx >= 0; bIdx--) {
          const b = state.bullets[bIdx];
          if (b.isEnemy) continue;

          for (let aIdx = state.asteroids.length - 1; aIdx >= 0; aIdx--) {
            const a = state.asteroids[aIdx];
            const dist = Math.hypot(b.x - a.x, b.y - a.y);

            if (dist < a.radius + 4) {
              // Destroy bullet
              state.bullets.splice(bIdx, 1);

              // Shatter asteroid
              state.score += a.points;
              onScoreUpdate(state.score);
              state.shake = 5;

              if (soundEnabled) sounds.playPop();
              haptics.score();

              // Spawn Stardust
              state.stardustList.push({
                id: state.nextId++,
                x: a.x,
                y: a.y,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                points: 50,
                color: a.color,
                life: 0,
                maxLife: 260,
              });

              // Explosive Special Asteroid chain reaction
              if (a.specialType === 'explosive') {
                state.shake = 12;
                if (soundEnabled) sounds.playExplosion();
                addPopup('💥 CHAIN DETONATION!', a.x, a.y - 20, '#EF4444');
                for (let k = 0; k < 25; k++) {
                  const ang = Math.random() * Math.PI * 2;
                  state.particles.push({
                    x: a.x,
                    y: a.y,
                    vx: Math.cos(ang) * (3 + Math.random() * 6),
                    vy: Math.sin(ang) * (3 + Math.random() * 6),
                    color: '#EF4444',
                    size: 4,
                    life: 0,
                    maxLife: 24,
                  });
                }
              }

              // Powerup drop chance
              if (a.specialType === 'gold') {
                s.tripleShotTimer = 360; // 6 seconds triple shot
                if (soundEnabled) sounds.playPowerUp();
                addPopup('⚡ TRIPLE BLASTER!', a.x, a.y - 25, '#FACC15');
              } else if (a.specialType === 'ice') {
                s.shieldTimer = 360; // 6 seconds shield
                if (soundEnabled) sounds.playPowerUp();
                addPopup('🛡️ DEFLECTOR SHIELD!', a.x, a.y - 25, '#06B6D4');
              }

              // Split asteroid into lower tier
              if (a.tier === 3) {
                spawnAsteroid(a.x, a.y, 2, a.specialType);
                spawnAsteroid(a.x, a.y, 2, 'normal');
              } else if (a.tier === 2) {
                spawnAsteroid(a.x, a.y, 1, 'normal');
                spawnAsteroid(a.x, a.y, 1, 'normal');
              }

              // Debris Particles
              for (let k = 0; k < 12; k++) {
                const ang = Math.random() * Math.PI * 2;
                state.particles.push({
                  x: a.x,
                  y: a.y,
                  vx: Math.cos(ang) * (2 + Math.random() * 4),
                  vy: Math.sin(ang) * (2 + Math.random() * 4),
                  color: a.color,
                  size: 3,
                  life: 0,
                  maxLife: 20,
                });
              }

              state.asteroids.splice(aIdx, 1);
              break;
            }
          }
        }

        // =====================================
        // BULLET - UFO COLLISIONS
        // =====================================
        for (let bIdx = state.bullets.length - 1; bIdx >= 0; bIdx--) {
          const b = state.bullets[bIdx];
          if (b.isEnemy) continue;

          for (let uIdx = state.ufos.length - 1; uIdx >= 0; uIdx--) {
            const u = state.ufos[uIdx];
            if (Math.hypot(b.x - u.x, b.y - u.y) < u.radius + 4) {
              state.bullets.splice(bIdx, 1);
              state.score += 500;
              onScoreUpdate(state.score);
              state.shake = 10;
              if (soundEnabled) sounds.playExplosion();
              haptics.heavy();
              addPopup('+500 UFO DOWN!', u.x, u.y - 20, '#EC4899');

              for (let k = 0; k < 20; k++) {
                const ang = Math.random() * Math.PI * 2;
                state.particles.push({
                  x: u.x,
                  y: u.y,
                  vx: Math.cos(ang) * (3 + Math.random() * 5),
                  vy: Math.sin(ang) * (3 + Math.random() * 5),
                  color: '#EC4899',
                  size: 3.5,
                  life: 0,
                  maxLife: 25,
                });
              }

              state.ufos.splice(uIdx, 1);
              break;
            }
          }
        }

        // =====================================
        // SHIP COLLISIONS (ASTEROIDS, ENEMY BULLETS, UFOS)
        // =====================================
        if (s.invulnerableTimer <= 0) {
          let shipHit = false;

          // Check Asteroids
          for (const a of state.asteroids) {
            if (Math.hypot(s.x - a.x, s.y - a.y) < s.radius + a.radius - 4) {
              shipHit = true;
              break;
            }
          }

          // Check Enemy Bullets
          if (!shipHit) {
            for (let i = state.bullets.length - 1; i >= 0; i--) {
              const b = state.bullets[i];
              if (b.isEnemy && Math.hypot(s.x - b.x, s.y - b.y) < s.radius + 6) {
                state.bullets.splice(i, 1);
                shipHit = true;
                break;
              }
            }
          }

          // Check UFOs
          if (!shipHit) {
            for (const u of state.ufos) {
              if (Math.hypot(s.x - u.x, s.y - u.y) < s.radius + u.radius - 2) {
                shipHit = true;
                break;
              }
            }
          }

          if (shipHit) {
            if (s.shieldTimer > 0) {
              // Shield absorbed hit
              s.shieldTimer = 0;
              s.invulnerableTimer = 60;
              state.shake = 8;
              if (soundEnabled) sounds.playShockwave();
              haptics.heavy();
              addPopup('SHIELD DEFLECTED IMPACT!', s.x, s.y - 20, '#06B6D4');
            } else {
              // Player takes damage
              state.lives--;
              setLives(state.lives);
              state.shake = 16;
              s.invulnerableTimer = 120;
              s.vx = 0;
              s.vy = 0;
              s.x = w / 2;
              s.y = h / 2;

              if (soundEnabled) sounds.playExplosion();
              haptics.gameOver();
              addPopup('⚠️ SHIP CRITICAL! -1 LIFE', s.x, s.y - 20, '#EF4444');

              // Death particles
              for (let k = 0; k < 30; k++) {
                const ang = Math.random() * Math.PI * 2;
                state.particles.push({
                  x: s.x,
                  y: s.y,
                  vx: Math.cos(ang) * (3 + Math.random() * 6),
                  vy: Math.sin(ang) * (3 + Math.random() * 6),
                  color: '#38BDF8',
                  size: 4,
                  life: 0,
                  maxLife: 30,
                });
              }

              if (state.lives <= 0) {
                state.isAlive = false;
                setSafeTimeout(() => onGameOver(state.score), 500);
              }
            }
          }
        }

        // Check Wave Clear
        if (state.asteroids.length === 0) {
          startLevel(state.level + 1);
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

        // Update Popups
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

      // =====================================
      // VECTOR GRAPHICS RENDERING
      // =====================================
      ctx.fillStyle = '#060814';
      ctx.fillRect(0, 0, w, h);

      // Deep Space Starfield & Cyber Grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Render Stardust Crystals
      for (const sd of state.stardustList) {
        const alpha = Math.max(0, 1 - sd.life / sd.maxLife);
        ctx.save();
        ctx.translate(sd.x, sd.y);
        ctx.globalAlpha = alpha;

        ctx.fillStyle = sd.color;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
      }

      // Render Asteroids (Vector Wireframes)
      for (const a of state.asteroids) {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rotation);

        // Glow halo
        ctx.fillStyle = a.glow;
        ctx.beginPath();
        ctx.arc(0, 0, a.radius * 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Polygon boundary
        ctx.strokeStyle = a.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        a.vertices.forEach((v, idx) => {
          if (idx === 0) ctx.moveTo(v.x, v.y);
          else ctx.lineTo(v.x, v.y);
        });
        ctx.closePath();
        ctx.stroke();

        // Inner polygon shading
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.fill();

        // Inner core marking for special asteroids
        if (a.specialType === 'gold') {
          ctx.fillStyle = '#FACC15';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('★', 0, 0);
        } else if (a.specialType === 'explosive') {
          ctx.fillStyle = '#EF4444';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⚡', 0, 0);
        } else if (a.specialType === 'ice') {
          ctx.fillStyle = '#06B6D4';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🛡', 0, 0);
        }

        ctx.restore();
      }

      // Render UFOs
      for (const u of state.ufos) {
        ctx.save();
        ctx.translate(u.x, u.y);

        ctx.fillStyle = 'rgba(236, 72, 153, 0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 0, u.radius, u.radius * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = u.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, -3, u.radius * 0.45, Math.PI, 0);
        ctx.stroke();

        ctx.restore();
      }

      // Render Bullets
      for (const b of state.bullets) {
        ctx.save();
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.isEnemy ? 3.5 : 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Render Ship
      if (state.isAlive) {
        const s = state.ship;
        const isBlinking = s.invulnerableTimer > 0 && Math.floor(s.invulnerableTimer / 6) % 2 === 0;

        if (!isBlinking) {
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(s.angle);

          // Deflector Shield Bubble
          if (s.shieldTimer > 0) {
            ctx.strokeStyle = '#06B6D4';
            ctx.lineWidth = 2;
            ctx.shadowColor = '#06B6D4';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(0, 0, s.radius + 8, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Delta Wing Hull
          ctx.strokeStyle = s.tripleShotTimer > 0 ? '#FACC15' : '#38BDF8';
          ctx.shadowColor = s.tripleShotTimer > 0 ? '#FACC15' : '#38BDF8';
          ctx.shadowBlur = 8;
          ctx.lineWidth = 2;
          ctx.fillStyle = '#0F172A';

          ctx.beginPath();
          ctx.moveTo(s.radius, 0); // Nose
          ctx.lineTo(-s.radius * 0.8, -s.radius * 0.75); // Left Wing
          ctx.lineTo(-s.radius * 0.4, 0); // Engine Notch
          ctx.lineTo(-s.radius * 0.8, s.radius * 0.75); // Right Wing
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Cockpit canopy
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(s.radius * 0.2, 0, 2.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
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

      // Render Floating Popups
      for (const ft of state.floatingTexts) {
        const alpha = Math.max(0, 1 - ft.life / ft.maxLife);
        ctx.fillStyle = ft.color;
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1;
      }

      ctx.restore();

      // Sync React state
      setHasShield(state.ship.shieldTimer > 0);
      setHasTripleShot(state.ship.tripleShotTimer > 0);

      return state.isAlive;
    },
  });

  return (
    <div
      ref={containerRef}
      id="astro-blaster-container"
      className="relative w-full h-full min-h-0 flex flex-col items-center justify-between bg-[#060814] select-none overflow-hidden touch-none"
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
                  i < lives ? 'text-red-500 fill-red-500' : 'text-zinc-600'
                }`}
              />
            ))}
          </div>

          {/* Wave */}
          <div className="px-2.5 py-1 rounded-xl bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 font-mono text-xs font-black">
            WAVE {level}
          </div>

          {/* Shield Power */}
          {hasShield && (
            <div className="px-2 py-1 rounded-xl bg-blue-500/20 border border-blue-500/50 text-blue-300 font-mono text-xs font-black flex items-center gap-1 animate-pulse">
              <Shield className="w-3.5 h-3.5" />
              <span>SHIELD</span>
            </div>
          )}

          {/* Triple shot Power */}
          {hasTripleShot && (
            <div className="px-2 py-1 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-xs font-black flex items-center gap-1 animate-pulse">
              <Zap className="w-3.5 h-3.5" />
              <span>TRIPLE CANNON</span>
            </div>
          )}
        </div>

        <div className="text-[11px] font-mono text-zinc-500 hidden sm:block">
          ARROWS / WASD • SPACE: FIRE • SHIFT: WARP
        </div>
      </div>

      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* On-Screen Mobile & Touch Controls */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-auto z-10 sm:hidden">
        {/* Left Side: Turn Controls */}
        <div className="flex items-center gap-2">
          <button
            id="astro-turn-left"
            onPointerDown={() => {
              gameStateRef.current.keys.left = true;
            }}
            onPointerUp={() => {
              gameStateRef.current.keys.left = false;
            }}
            onPointerLeave={() => {
              gameStateRef.current.keys.left = false;
            }}
            className="w-13 h-13 rounded-2xl bg-zinc-900/90 border border-cyan-500/40 text-cyan-400 flex items-center justify-center active:scale-95 active:bg-cyan-500/20 backdrop-blur-md"
            aria-label="Turn Left"
          >
            <RotateCcw className="w-6 h-6" />
          </button>

          <button
            id="astro-turn-right"
            onPointerDown={() => {
              gameStateRef.current.keys.right = true;
            }}
            onPointerUp={() => {
              gameStateRef.current.keys.right = false;
            }}
            onPointerLeave={() => {
              gameStateRef.current.keys.right = false;
            }}
            className="w-13 h-13 rounded-2xl bg-zinc-900/90 border border-cyan-500/40 text-cyan-400 flex items-center justify-center active:scale-95 active:bg-cyan-500/20 backdrop-blur-md"
            aria-label="Turn Right"
          >
            <RotateCw className="w-6 h-6" />
          </button>
        </div>

        {/* Right Side: Action Controls */}
        <div className="flex items-center gap-2">
          <button
            id="astro-warp"
            onClick={triggerHyperspace}
            className="w-12 h-12 rounded-2xl bg-purple-950/80 border border-purple-500/40 text-purple-400 flex items-center justify-center active:scale-95 active:bg-purple-500/20 backdrop-blur-md"
            aria-label="Hyperspace Warp"
          >
            <Radio className="w-5 h-5" />
          </button>

          <button
            id="astro-thrust"
            onPointerDown={() => {
              gameStateRef.current.keys.thrust = true;
            }}
            onPointerUp={() => {
              gameStateRef.current.keys.thrust = false;
            }}
            onPointerLeave={() => {
              gameStateRef.current.keys.thrust = false;
            }}
            className="w-13 h-13 rounded-2xl bg-amber-950/80 border border-amber-500/40 text-amber-400 flex items-center justify-center active:scale-95 active:bg-amber-500/20 backdrop-blur-md font-mono text-xs font-bold"
            aria-label="Thrust"
          >
            <Rocket className="w-6 h-6" />
          </button>

          <button
            id="astro-fire"
            onPointerDown={fireBullet}
            className="w-14 h-14 rounded-2xl bg-cyan-600 border border-cyan-300 text-white flex items-center justify-center active:scale-95 active:bg-cyan-500 shadow-lg shadow-cyan-500/30 font-mono text-xs font-bold"
            aria-label="Fire Plasma"
          >
            <Crosshair className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
};
