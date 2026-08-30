import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { haptics } from '../lib/haptics';
import { Shield, Bomb, Radio } from 'lucide-react';
import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';
import { VANGUARD_FIXED_STEP_SEC, getVanguardPhysicsStepBatch } from '../lib/vanguardRuntime';

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  isPlayer: boolean;
  damage: number;
  radius: number;
}

type EnemyType = 'drone' | 'interceptor' | 'cruiser' | 'sniper' | 'swarmer' | 'shield_carrier' | 'boss';

interface Enemy {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  color: string;
  shootTimer: number;
  phase: number;
  shield?: number;
}

interface DropItem {
  id: number;
  type: 'spread' | 'shield' | 'bomb' | 'laser';
  x: number;
  y: number;
  vy: number;
}

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

interface ScorePopup {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  life: number;
}

export const VanguardGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [bombs, setBombs] = useState(2);
  const [weaponLevel, setWeaponLevel] = useState(1);
  const [wave, setWave] = useState(1);
  const [bossHp, setBossHp] = useState<{ current: number; max: number } | null>(null);

  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const setSafeTimeout = useSafeTimeout();

  const gameStateRef = useRef({
    score: 0,
    lives: 3,
    bombs: 2,
    weaponLevel: 1,
    wave: 1,
    isAlive: true,
    playerX: 0,
    playerY: 0,
    targetX: 0,
    targetY: 0,
    playerRadius: 16,
    invulnerableTime: 0,
    shootCooldown: 0,
    bullets: [] as Bullet[],
    enemies: [] as Enemy[],
    drops: [] as DropItem[],
    particles: [] as Particle[],
    popups: [] as ScorePopup[],
    stars: [] as { x: number; y: number; speed: number; size: number }[],
    spawnTimer: 0,
    screenShake: 0,
    bossActive: false,
    bossDefeatedPoints: 0,
    keysPressed: {} as Record<string, boolean>,
    viewportWidth: 0,
    viewportHeight: 0,
    physicsAccumulator: 0,
  });

  const triggerBomb = useCallback(() => {
    const state = gameStateRef.current;
    if (state.bombs <= 0 || !state.isAlive || isPausedRef.current) return;

    state.bombs--;
    setBombs(state.bombs);
    state.screenShake = 22;
    haptics.heavy();

    if (soundEnabled) sounds.playExplosion();

    // Clear all enemy bullets
    state.bullets = state.bullets.filter((b) => b.isPlayer);

    // Blast all enemies
    state.enemies.forEach((enemy) => {
      enemy.hp -= 25;
      for (let i = 0; i < 18; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * 5;
        state.particles.push({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 1.0,
          maxLife: 1.0,
          color: '#38BDF8',
          size: 3 + Math.random() * 3,
        });
      }
    });

    state.popups.push({
      id: Math.random(),
      text: 'NOVA EMP CLEARED!',
      x: canvasRef.current ? canvasRef.current.width / 2 : 200,
      y: canvasRef.current ? canvasRef.current.height / 2 : 200,
      color: '#38BDF8',
      life: 1.2,
    });
  }, [soundEnabled]);

  const addScorePopup = (text: string, x: number, y: number, color = '#FACC15') => {
    gameStateRef.current.popups.push({
      id: Math.random(),
      text,
      x,
      y,
      color,
      life: 1.0,
    });
  };

  const addExplosion = (x: number, y: number, color = '#F43F5E', count = 18) => {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 1.5 + Math.random() * 4.5;
      gameStateRef.current.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 1.0,
        maxLife: 1.0,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  };

  // Spawn varied enemies based on wave
  const spawnEnemySquadron = (w: number) => {
    const state = gameStateRef.current;
    if (state.bossActive) return;

    // Check boss trigger every 1500 points
    if (state.score - state.bossDefeatedPoints >= 1500 && !state.bossActive) {
      state.bossActive = true;
      const bossMaxHp = 40 + state.wave * 20;
      state.enemies.push({
        id: Math.random(),
        type: 'boss',
        x: w / 2,
        y: -60,
        vx: 1.6,
        vy: 0.7,
        hp: bossMaxHp,
        maxHp: bossMaxHp,
        radius: 36,
        color: '#F43F5E',
        shootTimer: 0,
        phase: 0,
      });
      setBossHp({ current: bossMaxHp, max: bossMaxHp });
      addScorePopup('WARNING: FLAGSHIP WARPING IN!', w / 2, 70, '#EF4444');
      if (soundEnabled) sounds.playGameOver();
      return;
    }

    // Randomly pick enemy pattern from 6 rich archetypes
    const patternChoice = Math.random();
    const spawnX = 35 + Math.random() * (w - 70);

    if (patternChoice < 0.22) {
      // 1. Swarmer Cluster: 3 agile mini-jets in wedge formation
      for (let i = 0; i < 3; i++) {
        const offsetX = (i - 1) * 28;
        const offsetY = Math.abs(i - 1) * 20;
        state.enemies.push({
          id: Math.random(),
          type: 'swarmer',
          x: Math.max(30, Math.min(w - 30, spawnX + offsetX)),
          y: -30 - offsetY,
          vx: (Math.random() - 0.5) * 1.2,
          vy: 3.4 + state.wave * 0.15,
          hp: 1.5,
          maxHp: 1.5,
          radius: 11,
          color: '#A855F7',
          shootTimer: 0,
          phase: Math.random() * Math.PI,
        });
      }
    } else if (patternChoice < 0.45) {
      // 2. Swooping Plasma Drone
      state.enemies.push({
        id: Math.random(),
        type: 'drone',
        x: spawnX,
        y: -20,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 2.2 + state.wave * 0.2,
        hp: 2.5,
        maxHp: 2.5,
        radius: 14,
        color: '#34D399',
        shootTimer: 0,
        phase: Math.random() * Math.PI * 2,
      });
    } else if (patternChoice < 0.65) {
      // 3. Dive-bombing Interceptor
      state.enemies.push({
        id: Math.random(),
        type: 'interceptor',
        x: spawnX,
        y: -25,
        vx: (state.playerX - spawnX) * 0.008,
        vy: 4.2,
        hp: 3.5,
        maxHp: 3.5,
        radius: 15,
        color: '#FB923C',
        shootTimer: 0,
        phase: 0,
      });
    } else if (patternChoice < 0.82) {
      // 4. Laser Sniper (hovers and targets player)
      state.enemies.push({
        id: Math.random(),
        type: 'sniper',
        x: spawnX,
        y: -30,
        vx: (Math.random() - 0.5) * 1.2,
        vy: 1.2,
        hp: 4.5,
        maxHp: 4.5,
        radius: 18,
        color: '#38BDF8',
        shootTimer: 0,
        phase: 0,
      });
    } else {
      // 5. Armored Cruiser / Shield Carrier
      const isShield = Math.random() > 0.5;
      state.enemies.push({
        id: Math.random(),
        type: isShield ? 'shield_carrier' : 'cruiser',
        x: spawnX,
        y: -35,
        vx: (Math.random() - 0.5) * 0.9,
        vy: 1.3,
        hp: 7.0,
        maxHp: 7.0,
        radius: 24,
        color: isShield ? '#EC4899' : '#F59E0B',
        shootTimer: 0,
        phase: 0,
        shield: isShield ? 6 : 0,
      });
    }
  };

  useEffect(() => {
    // Pointer Tracking
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (isPausedRef.current || !gameStateRef.current.isAlive) return;
      const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      gameStateRef.current.targetX = Math.max(20, Math.min(rect.width - 20, clientX - rect.left));
      gameStateRef.current.targetY = Math.max(30, Math.min(rect.height - 30, clientY - rect.top));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPausedRef.current || !gameStateRef.current.isAlive) return;
      gameStateRef.current.keysPressed[e.key] = true;
      if (e.key === ' ' || e.key === 'e' || e.key === 'E' || e.key === 'b' || e.key === 'B') {
        triggerBomb();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      gameStateRef.current.keysPressed[e.key] = false;
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [triggerBomb]);

  useGameLoop({
    canvasRef,
    isPaused,
    onResize: (w, h) => {
      const state = gameStateRef.current;
      const isInitial = state.viewportWidth <= 0 || state.viewportHeight <= 0;

      if (isInitial) {
        state.playerX = w / 2;
        state.playerY = h * 0.8;
        state.targetX = w / 2;
        state.targetY = h * 0.8;
      } else {
        const scaleX = w / state.viewportWidth;
        const scaleY = h / state.viewportHeight;
        state.playerX *= scaleX;
        state.playerY *= scaleY;
        state.targetX *= scaleX;
        state.targetY *= scaleY;
        for (const bullet of state.bullets) {
          bullet.x *= scaleX;
          bullet.y *= scaleY;
        }
        for (const enemy of state.enemies) {
          enemy.x *= scaleX;
          enemy.y *= scaleY;
        }
        for (const drop of state.drops) {
          drop.x *= scaleX;
          drop.y *= scaleY;
        }
        for (const particle of state.particles) {
          particle.x *= scaleX;
          particle.y *= scaleY;
        }
        for (const popup of state.popups) {
          popup.x *= scaleX;
          popup.y *= scaleY;
        }
        for (const star of state.stars) {
          star.x *= scaleX;
          star.y *= scaleY;
        }
      }

      state.viewportWidth = w;
      state.viewportHeight = h;
      state.physicsAccumulator = 0;

      if (state.stars.length === 0) {
        for (let i = 0; i < 75; i++) {
          state.stars.push({
            x: Math.random() * w,
            y: Math.random() * h,
            speed: 1 + Math.random() * 3.5,
            size: Math.random() * 2 + 0.8,
          });
        }
      }
    },
    onUpdate: (ctx, deltaSec, curW, curH) => {
      const state = gameStateRef.current;
      const w = curW;
      const h = curH;

      const batch = !isPausedRef.current && state.isAlive
        ? getVanguardPhysicsStepBatch(state.physicsAccumulator, deltaSec)
        : { steps: 0, remainderSec: 0 };
      state.physicsAccumulator = batch.remainderSec;

      if (!isPausedRef.current && state.isAlive) {
        for (let simStep = 0; simStep < batch.steps && state.isAlive; simStep++) {
          const dt = VANGUARD_FIXED_STEP_SEC;
        // Keyboard motion
        const keySpeed = 6;
        if (state.keysPressed['ArrowLeft'] || state.keysPressed['a'] || state.keysPressed['A']) state.targetX -= keySpeed;
        if (state.keysPressed['ArrowRight'] || state.keysPressed['d'] || state.keysPressed['D']) state.targetX += keySpeed;
        if (state.keysPressed['ArrowUp'] || state.keysPressed['w'] || state.keysPressed['W']) state.targetY -= keySpeed;
        if (state.keysPressed['ArrowDown'] || state.keysPressed['s'] || state.keysPressed['S']) state.targetY += keySpeed;

        // Smooth Ship positioning
        state.targetX = Math.max(state.playerRadius, Math.min(w - state.playerRadius, state.targetX));
        state.targetY = Math.max(state.playerRadius, Math.min(h - state.playerRadius, state.targetY));
        state.playerX += (state.targetX - state.playerX) * 0.35;
        state.playerY += (state.targetY - state.playerY) * 0.35;

        // Starfield
        state.stars.forEach((star) => {
          star.y += star.speed;
          if (star.y > h) {
            star.y = 0;
            star.x = Math.random() * w;
          }
        });

        if (state.invulnerableTime > 0) state.invulnerableTime--;
        if (state.screenShake > 0) state.screenShake *= 0.9;

        // --- PLAYER AUTO-FIRE ---
        state.shootCooldown++;
        if (state.shootCooldown >= 8) {
          state.shootCooldown = 0;
          if (soundEnabled && Math.random() < 0.25) sounds.playLaser();

          if (state.weaponLevel === 1) {
            state.bullets.push({
              x: state.playerX - 6,
              y: state.playerY - 14,
              vx: 0,
              vy: -9,
              color: '#38BDF8',
              isPlayer: true,
              damage: 1,
              radius: 3,
            });
            state.bullets.push({
              x: state.playerX + 6,
              y: state.playerY - 14,
              vx: 0,
              vy: -9,
              color: '#38BDF8',
              isPlayer: true,
              damage: 1,
              radius: 3,
            });
          } else if (state.weaponLevel === 2) {
            state.bullets.push({
              x: state.playerX,
              y: state.playerY - 16,
              vx: 0,
              vy: -10,
              color: '#FACC15',
              isPlayer: true,
              damage: 1.5,
              radius: 4,
            });
            state.bullets.push({
              x: state.playerX - 8,
              y: state.playerY - 10,
              vx: -1.2,
              vy: -9.5,
              color: '#38BDF8',
              isPlayer: true,
              damage: 1,
              radius: 3,
            });
            state.bullets.push({
              x: state.playerX + 8,
              y: state.playerY - 10,
              vx: 1.2,
              vy: -9.5,
              color: '#38BDF8',
              isPlayer: true,
              damage: 1,
              radius: 3,
            });
          } else {
            // Quad Hyper Lasers
            [-10, -4, 4, 10].forEach((dx, idx) => {
              state.bullets.push({
                x: state.playerX + dx,
                y: state.playerY - 14,
                vx: (idx - 1.5) * 0.9,
                vy: -10.5,
                color: '#34D399',
                isPlayer: true,
                damage: 1.4,
                radius: 3.5,
              });
            });
          }
        }

        // --- ENEMY SPAWNER ---
        state.spawnTimer++;
        const spawnThreshold = Math.max(35, 75 - state.wave * 5);
        if (state.spawnTimer > spawnThreshold) {
          state.spawnTimer = 0;
          spawnEnemySquadron(w);
        }

        // --- UPDATE ENEMIES ---
        for (let i = state.enemies.length - 1; i >= 0; i--) {
          const enemy = state.enemies[i];
          enemy.x += enemy.vx;
          enemy.y += enemy.vy;
          enemy.phase += 0.05;

          // Drone swooping
          if (enemy.type === 'drone') {
            enemy.vx = Math.sin(enemy.phase) * 2.2;
          }

          // Sniper hovers at top 35% of screen
          if (enemy.type === 'sniper') {
            if (enemy.y > h * 0.3) enemy.vy = 0.2;
            if (enemy.x < 40 || enemy.x > w - 40) enemy.vx = -enemy.vx;
          }

          // Boss patrol
          if (enemy.type === 'boss') {
            if (enemy.y < 95) enemy.vy = 0.8;
            else enemy.vy = 0;

            if (enemy.x < 60 || enemy.x > w - 60) enemy.vx = -enemy.vx;

            setBossHp({ current: Math.max(0, enemy.hp), max: enemy.maxHp });
          }

          // Enemy Shooting Patterns
          enemy.shootTimer++;
          if (enemy.type === 'cruiser' && enemy.shootTimer > 65) {
            enemy.shootTimer = 0;
            state.bullets.push({
              x: enemy.x,
              y: enemy.y + 14,
              vx: (state.playerX - enemy.x) * 0.015,
              vy: 3.8,
              color: '#F59E0B',
              isPlayer: false,
              damage: 1,
              radius: 4,
            });
          } else if (enemy.type === 'sniper' && enemy.shootTimer > 75) {
            enemy.shootTimer = 0;
            const dx = state.playerX - enemy.x;
            const dy = state.playerY - enemy.y;
            const angle = Math.atan2(dy, dx);
            state.bullets.push({
              x: enemy.x,
              y: enemy.y + 12,
              vx: Math.cos(angle) * 5.5,
              vy: Math.sin(angle) * 5.5,
              color: '#38BDF8',
              isPlayer: false,
              damage: 1,
              radius: 4.5,
            });
          } else if (enemy.type === 'boss' && enemy.shootTimer > 35) {
            enemy.shootTimer = 0;
            [-1.8, 0, 1.8].forEach((vx) => {
              state.bullets.push({
                x: enemy.x + vx * 9,
                y: enemy.y + 24,
                vx,
                vy: 4.2,
                color: '#F43F5E',
                isPlayer: false,
                damage: 1,
                radius: 5,
              });
            });
          }

          // Player Collision
          if (
            Math.hypot(enemy.x - state.playerX, enemy.y - state.playerY) <
              enemy.radius + state.playerRadius &&
            state.invulnerableTime <= 0
          ) {
            state.lives--;
            setLives(state.lives);
            state.invulnerableTime = 70;
            state.screenShake = 16;
            haptics.impact();
            addExplosion(state.playerX, state.playerY, '#EF4444', 25);
            if (soundEnabled) sounds.playExplosion();
            addScorePopup('-1 LIFE', state.playerX, state.playerY - 20, '#EF4444');

            if (state.lives <= 0) {
              state.isAlive = false;
              haptics.gameOver();
              if (soundEnabled) sounds.playGameOver();
              setSafeTimeout(() => onGameOver(state.score), 400);
            }
          }

          // Off screen bottom
          if (enemy.y > h + 50) {
            state.enemies.splice(i, 1);
          }
        }

        // --- UPDATE BULLETS ---
        for (let i = state.bullets.length - 1; i >= 0; i--) {
          const b = state.bullets[i];
          b.x += b.vx;
          b.y += b.vy;

          if (b.y < -20 || b.y > h + 20 || b.x < -20 || b.x > w + 20) {
            state.bullets.splice(i, 1);
            continue;
          }

          if (b.isPlayer) {
            // Check hit on enemies
            for (let j = state.enemies.length - 1; j >= 0; j--) {
              const enemy = state.enemies[j];
              if (Math.hypot(b.x - enemy.x, b.y - enemy.y) < enemy.radius + b.radius) {
                if (enemy.shield && enemy.shield > 0) {
                  enemy.shield -= b.damage;
                  addExplosion(b.x, b.y, '#EC4899', 4);
                } else {
                  enemy.hp -= b.damage;
                  addExplosion(b.x, b.y, b.color, 4);
                }
                state.bullets.splice(i, 1);

                if (enemy.hp <= 0) {
                  // Enemy Destroyed!
                  addExplosion(enemy.x, enemy.y, enemy.color, enemy.type === 'boss' ? 45 : 18);
                  if (soundEnabled) sounds.playExplosion();

                  let points = 100;
                  if (enemy.type === 'interceptor') points = 150;
                  if (enemy.type === 'swarmer') points = 80;
                  if (enemy.type === 'sniper') points = 250;
                  if (enemy.type === 'cruiser') points = 350;
                  if (enemy.type === 'shield_carrier') points = 450;
                  if (enemy.type === 'boss') {
                    points = 2500;
                    state.bossActive = false;
                    state.bossDefeatedPoints = state.score + points;
                    state.wave++;
                    setWave(state.wave);
                    setBossHp(null);
                    addScorePopup(`FLAGSHIP DESTROYED! WAVE ${state.wave}`, w / 2, h / 2, '#34D399');
                    if (soundEnabled) sounds.playVictory();

                    // Drop Bomb Capsule
                    state.drops.push({
                      id: Math.random(),
                      type: 'bomb',
                      x: enemy.x,
                      y: enemy.y,
                      vy: 1.5,
                    });
                  }

                  state.score += points;
                  onScoreUpdate(state.score);
                  setScore(state.score);

                  // Powerup drop chance
                  if (enemy.type !== 'boss' && Math.random() < 0.18) {
                    const dropTypes: ('spread' | 'shield' | 'laser')[] = ['spread', 'shield', 'laser'];
                    const picked = dropTypes[Math.floor(Math.random() * dropTypes.length)];
                    state.drops.push({
                      id: Math.random(),
                      type: picked,
                      x: enemy.x,
                      y: enemy.y,
                      vy: 1.5,
                    });
                  }

                  state.enemies.splice(j, 1);
                }
                break;
              }
            }
          } else {
            // Enemy Bullet hitting player
            if (
              Math.hypot(b.x - state.playerX, b.y - state.playerY) < state.playerRadius + b.radius &&
              state.invulnerableTime <= 0
            ) {
              state.bullets.splice(i, 1);
              state.lives--;
              setLives(state.lives);
              state.invulnerableTime = 70;
              state.screenShake = 14;
              haptics.impact();
              addExplosion(state.playerX, state.playerY, '#EF4444', 20);
              if (soundEnabled) sounds.playExplosion();
              addScorePopup('-1 LIFE', state.playerX, state.playerY - 20, '#EF4444');

              if (state.lives <= 0) {
                state.isAlive = false;
                haptics.gameOver();
                if (soundEnabled) sounds.playGameOver();
                setSafeTimeout(() => onGameOver(state.score), 400);
              }
            }
          }
        }

        // --- UPDATE DROPS ---
        for (let i = state.drops.length - 1; i >= 0; i--) {
          const drop = state.drops[i];
          drop.y += drop.vy;

          if (Math.hypot(drop.x - state.playerX, drop.y - state.playerY) < 28) {
            state.drops.splice(i, 1);
            haptics.score();
            if (soundEnabled) sounds.playPop();

            if (drop.type === 'spread' || drop.type === 'laser') {
              state.weaponLevel = Math.min(3, state.weaponLevel + 1);
              setWeaponLevel(state.weaponLevel);
              addScorePopup('WEAPON UPGRADE!', state.playerX, state.playerY - 25, '#38BDF8');
            } else if (drop.type === 'shield') {
              state.lives = Math.min(4, state.lives + 1);
              setLives(state.lives);
              addScorePopup('+1 SHIELD!', state.playerX, state.playerY - 25, '#34D399');
            } else if (drop.type === 'bomb') {
              state.bombs = Math.min(4, state.bombs + 1);
              setBombs(state.bombs);
              addScorePopup('+1 NOVA EMP!', state.playerX, state.playerY - 25, '#A855F7');
            }
          } else if (drop.y > h + 30) {
            state.drops.splice(i, 1);
          }
        }

        // Effects advance on the same 60 Hz gameplay clock and freeze while paused.
        for (let i = state.particles.length - 1; i >= 0; i--) {
          const p = state.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 1.8 * dt;
          if (p.life <= 0) state.particles.splice(i, 1);
        }
        for (let i = state.popups.length - 1; i >= 0; i--) {
          const popup = state.popups[i];
          popup.y -= 54 * dt;
          popup.life -= 1.2 * dt;
          if (popup.life <= 0) state.popups.splice(i, 1);
        }
        }
      }

      // --- RENDERING ---
      ctx.clearRect(0, 0, w, h);

      // Deep space backdrop
      ctx.fillStyle = '#050714';
      ctx.fillRect(0, 0, w, h);

      // Starfield
      state.stars.forEach((star) => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Enemy Bullets
      state.bullets.forEach((b) => {
        if (!b.isPlayer) {
          ctx.fillStyle = b.color;
          ctx.shadowColor = b.color;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // Draw Drops
      state.drops.forEach((d) => {
        ctx.fillStyle = d.type === 'bomb' ? '#A855F7' : d.type === 'shield' ? '#34D399' : '#38BDF8';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(d.x, d.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Draw Enemies
      state.enemies.forEach((enemy) => {
        ctx.save();
        ctx.translate(enemy.x, enemy.y);

        ctx.fillStyle = enemy.color;
        ctx.shadowColor = enemy.color;
        ctx.shadowBlur = 12;

        if (enemy.type === 'swarmer') {
          // Micro Triangular Drone
          ctx.beginPath();
          ctx.moveTo(0, 10);
          ctx.lineTo(-8, -8);
          ctx.lineTo(8, -8);
          ctx.closePath();
          ctx.fill();
        } else if (enemy.type === 'interceptor') {
          // Sharp Fast Speeder
          ctx.beginPath();
          ctx.moveTo(0, 14);
          ctx.lineTo(-11, -10);
          ctx.lineTo(0, -6);
          ctx.lineTo(11, -10);
          ctx.closePath();
          ctx.fill();
        } else if (enemy.type === 'sniper') {
          // Turret Hexagon
          ctx.beginPath();
          ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(-2, 0, 4, 14);
        } else if (enemy.type === 'cruiser' || enemy.type === 'shield_carrier') {
          // Heavy Cruiser Hull
          ctx.beginPath();
          ctx.roundRect(-enemy.radius, -enemy.radius * 0.8, enemy.radius * 2, enemy.radius * 1.6, 6);
          ctx.fill();

          if (enemy.shield && enemy.shield > 0) {
            ctx.strokeStyle = '#EC4899';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, enemy.radius + 6, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (enemy.type === 'boss') {
          // Flagship Dreadnought
          ctx.beginPath();
          ctx.moveTo(0, 36);
          ctx.lineTo(-34, -20);
          ctx.lineTo(-14, -30);
          ctx.lineTo(14, -30);
          ctx.lineTo(34, -20);
          ctx.closePath();
          ctx.fill();

          // Core Reactor
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(0, 0, 10, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Standard Drone
          ctx.beginPath();
          ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.shadowBlur = 0;
        ctx.restore();
      });

      // Draw Player Bullets
      state.bullets.forEach((b) => {
        if (b.isPlayer) {
          ctx.fillStyle = b.color;
          ctx.shadowColor = b.color;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // Draw Player Vanguard Interceptor
      const isInvul = state.invulnerableTime > 0 && Math.floor(state.invulnerableTime / 4) % 2 === 0;
      if (!isInvul) {
        ctx.save();
        ctx.translate(state.playerX, state.playerY);

        // Jet Engine Exhaust
        ctx.fillStyle = '#38BDF8';
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(-6, 12);
        ctx.lineTo(0, 24 + Math.random() * 6);
        ctx.lineTo(6, 12);
        ctx.fill();

        // Hull
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(-14, 12);
        ctx.lineTo(-5, 8);
        ctx.lineTo(0, 10);
        ctx.lineTo(5, 8);
        ctx.lineTo(14, 12);
        ctx.closePath();
        ctx.fill();

        // Canopy Visor
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(0, -2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore();
      }

      // Draw Particles
      for (const p of state.particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // Draw Popups
      for (const popup of state.popups) {
        ctx.globalAlpha = Math.max(0, popup.life);
        ctx.fillStyle = popup.color;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(popup.text, popup.x, popup.y);
        ctx.globalAlpha = 1.0;
      }

      return state.isAlive;
    },
  });

  return (
    <div className="relative w-full h-full min-h-[420px] flex flex-col bg-[#050714] overflow-hidden select-none">
      {/* Top HUD */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-[#18181B]/90 border border-zinc-800 px-3 py-1.5 rounded-lg backdrop-blur-md">
            <Shield className="w-4 h-4 text-rose-500" />
            <span className="font-mono-arcade text-xs text-white font-bold tracking-widest">
              {'♥'.repeat(lives)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-[#18181B]/90 border border-zinc-800 px-3 py-1.5 rounded-lg backdrop-blur-md">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono-arcade text-xs text-cyan-400 font-bold">
              WAVE {wave} • LVL {weaponLevel}
            </span>
          </div>
        </div>

        <div className="bg-[#18181B]/90 border border-zinc-800 px-3.5 py-1.5 rounded-lg backdrop-blur-md">
          <span className="font-mono-arcade text-sm text-cyan-400 font-bold">
            {score.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Boss Health Bar Banner (When Active) */}
      {bossHp && (
        <div className="absolute top-14 left-8 right-8 z-10 pointer-events-none flex flex-col items-center">
          <div className="w-full max-w-md bg-zinc-900/90 border border-rose-500/50 p-2 rounded-xl backdrop-blur-md">
            <div className="flex justify-between text-[10px] font-mono-arcade text-rose-400 font-bold mb-1">
              <span>ALIEN FLAGSHIP DREADNOUGHT</span>
              <span>
                {Math.ceil(bossHp.current)} / {bossHp.max}
              </span>
            </div>
            <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 transition-all duration-150"
                style={{ width: `${(bossHp.current / bossHp.max) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Canvas Viewport */}
      <div className="flex-1 relative w-full h-full">
        <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />
      </div>

      {/* Bottom Nova EMP Bomb Trigger */}
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between z-10 pointer-events-auto">
        <div className="text-[11px] font-mono-arcade text-zinc-400 bg-[#18181B]/80 px-3 py-2 rounded-lg border border-zinc-800">
          AUTO-FIRING • GLIDE SHIP WITH CURSOR / TOUCH
        </div>

        <button
          type="button"
          onClick={triggerBomb}
          disabled={bombs <= 0 || isPaused}
          className={`px-5 py-3 rounded-xl font-mono-arcade text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none backdrop-blur-md ${
            bombs > 0 && !isPaused
              ? 'bg-cyan-600/90 hover:bg-cyan-500 text-white border-cyan-400 shadow-lg shadow-cyan-500/40 active:scale-95'
              : 'bg-zinc-800/60 text-zinc-500 border-zinc-700 cursor-not-allowed'
          }`}
        >
          <Bomb className="w-4 h-4" />
          NOVA EMP [{bombs}]
        </button>
      </div>
    </div>
  );
};
