import React, { useEffect, useRef, useState } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { Rocket, Shield, ArrowUp, Flame, Magnet } from 'lucide-react';
import { useGameLoop, useSafeTimeout, useRenderPublishedState, useRenderPublishedCallback } from '../hooks/useGameLoop';
import { clamp } from '../lib/gameCoordinates';
import { TOWER_FIXED_STEP_SEC, getTowerPhysicsStepBatch } from '../lib/towerRuntime';
import {
  TOWER_APEX_DURATION_SEC,
  canActivateTowerApexDrive,
  getTowerApexBounceVelocity,
  getTowerApexCharges,
  getTowerApexReward,
  getTowerPrecisionBonus,
  isTowerPrecisionLanding,
} from '../lib/towerApexMastery';
import { isArcadeReducedMotion } from '../lib/motionPreferences';

interface Platform {
  id: number;
  x: number;
  y: number; // world Y coordinate (increases upwards)
  w: number;
  h: number;
  type: 'standard' | 'moving' | 'spring' | 'crumble' | 'phase';
  vx?: number;
  minX?: number;
  maxX?: number;
  broken?: boolean;
  breakTimer?: number;
  phaseTimer?: number;
  isPhasedOut?: boolean;
  hasGem?: boolean;
  hasJetpack?: boolean;
  hasShield?: boolean;
  hasMagnet?: boolean;
}

interface DroneEnemy {
  id: number;
  x: number;
  y: number;
  vx: number;
  radius: number;
  alive: boolean;
  minX: number;
  maxX: number;
  floatOffset: number;
}

interface BoostRing {
  id: number;
  x: number;
  y: number;
  radius: number;
  collected: boolean;
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

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

export const TowerGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const publishScore = useRenderPublishedCallback(onScoreUpdate, 100);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const setSafeTimeout = useSafeTimeout();

  const [hudState, setHudState] = useRenderPublishedState({
    altitude: 0,
    score: 0,
    hasShield: false,
    jetpackTime: 0,
    magnetTime: 0,
    laserDistance: 100,
    comboStreak: 0,
    multiplier: 1,
    apexCharges: 1,
    apexActive: false,
    apexPercent: 0,
    apexStreak: 0,
  }, 100);

  const gameStateRef = useRef({
    // Player Physics & Transform
    px: 200,
    py: 60,
    vx: 0,
    vy: 14,
    radius: 14,
    squashX: 1,
    squashY: 1,
    isAlive: true,
    facingRight: true,
    isTouchingWallLeft: false,
    isTouchingWallRight: false,
    wallSlideTimer: 0,

    // Upgrades & Power-ups
    hasShield: false,
    jetpackActive: false,
    jetpackTimer: 0,
    magnetActive: false,
    magnetTimer: 0,
    comboBounces: 0,
    multiplier: 1,
    apexCharges: 1,
    apexActive: false,
    apexTimer: 0,
    apexPrecisionStreak: 0,

    // World & Camera
    cameraY: 0,
    maxAltitude: 0,
    score: 0,
    laserY: -260,
    laserSpeed: 24,
    screenShake: 0,

    // Collections
    platforms: [] as Platform[],
    drones: [] as DroneEnemy[],
    boostRings: [] as BoostRing[],
    particles: [] as Particle[],
    popups: [] as FloatingText[],

    // Generation
    highestPlatformY: 0,
    highestObjectY: 0,
    nextId: 1,

    // Input state
    leftPressed: false,
    rightPressed: false,
    viewportWidth: 420,
    viewportHeight: 600,
    physicsAccumulator: 0,
  });

  const triggerApexDrive = () => {
    const state = gameStateRef.current;
    if (isPausedRef.current || !canActivateTowerApexDrive(state.apexCharges, state.apexActive, state.isAlive)) return;
    state.apexCharges--;
    state.apexActive = true;
    state.apexTimer = TOWER_APEX_DURATION_SEC;
    if (soundEnabled) sounds.playFeverMode();
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = gameStateRef.current;
      if (isPausedRef.current || !state.isAlive) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        state.leftPressed = true;
      }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        state.rightPressed = true;
      }
      // Wall Jump or Micro Burst
      if (e.code === 'KeyF' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        e.preventDefault();
        triggerApexDrive();
      }
      if ((e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') && state.isAlive) {
        if (state.isTouchingWallLeft) {
          state.vx = 8 * Math.min(1.8, Math.max(0.85, state.viewportWidth / 420));
          state.vy = 16;
          state.squashX = 0.7;
          state.squashY = 1.3;
          if (soundEnabled) sounds.playWallJump();
        } else if (state.isTouchingWallRight) {
          state.vx = -8 * Math.min(1.8, Math.max(0.85, state.viewportWidth / 420));
          state.vy = 16;
          state.squashX = 0.7;
          state.squashY = 1.3;
          if (soundEnabled) sounds.playWallJump();
        } else if (state.vy < 0 && !state.jetpackActive) {
          state.vy += 3.5;
          if (soundEnabled) sounds.playWhoosh();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const state = gameStateRef.current;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        state.leftPressed = false;
      }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        state.rightPressed = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [soundEnabled]);

  // Touch / Pointer controls
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current || isPausedRef.current || !gameStateRef.current.isAlive) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const state = gameStateRef.current;
    if (x < rect.width / 2) {
      state.leftPressed = true;
      state.rightPressed = false;
      // Wall jump trigger if touching right wall
      if (state.isTouchingWallRight) {
        state.vx = -8 * Math.min(1.8, Math.max(0.85, state.viewportWidth / 420));
        state.vy = 16;
        if (soundEnabled) sounds.playWallJump();
      }
    } else {
      state.rightPressed = true;
      state.leftPressed = false;
      // Wall jump trigger if touching left wall
      if (state.isTouchingWallLeft) {
        state.vx = 8 * Math.min(1.8, Math.max(0.85, state.viewportWidth / 420));
        state.vy = 16;
        if (soundEnabled) sounds.playWallJump();
      }
    }
  };

  const handlePointerUp = () => {
    const state = gameStateRef.current;
    state.leftPressed = false;
    state.rightPressed = false;
  };

  // Helper to generate platforms and exciting world entities up to target altitude
  const generateWorldUpTo = (targetY: number, currentWorldWidth: number) => {
    const state = gameStateRef.current;
    const w = Math.max(300, currentWorldWidth);
    const horizontalScale = Math.min(1.8, Math.max(0.85, w / 420));
    const platformScale = Math.min(1.45, horizontalScale);

    // Base platform
    if (state.platforms.length === 0) {
      const basePlatformWidth = 110 * platformScale;
      state.platforms.push({
        id: state.nextId++,
        x: w / 2 - basePlatformWidth / 2,
        y: 20,
        w: basePlatformWidth,
        h: 14,
        type: 'standard',
      });
      state.highestPlatformY = 20;
      state.highestObjectY = 20;
    }

    while (state.highestPlatformY < targetY) {
      const gapY = Math.random() * 45 + 46; // 46 to 91 px gap
      const nextY = state.highestPlatformY + gapY;
      const platW = (Math.random() * 25 + 68) * platformScale;
      const platX = Math.random() * (w - platW - 40) + 20;

      const rand = Math.random();
      let type: 'standard' | 'moving' | 'spring' | 'crumble' | 'phase' = 'standard';
      let vx = 0;
      let minX = 18;
      let maxX = w - platW - 18;

      if (rand < 0.22) {
        type = 'moving';
        vx = (Math.random() * 1.6 + 1.1) * horizontalScale * (Math.random() < 0.5 ? 1 : -1);
      } else if (rand < 0.38) {
        type = 'spring';
      } else if (rand < 0.52) {
        type = 'crumble';
      } else if (rand < 0.64) {
        type = 'phase';
      }

      const hasGem = Math.random() < 0.38;
      const hasJetpack = !hasGem && Math.random() < 0.05;
      const hasShield = !hasGem && !hasJetpack && Math.random() < 0.06;
      const hasMagnet = !hasGem && !hasJetpack && !hasShield && Math.random() < 0.06;

      state.platforms.push({
        id: state.nextId++,
        x: platX,
        y: nextY,
        w: platW,
        h: 14,
        type,
        vx,
        minX,
        maxX,
        phaseTimer: Math.random() * 2.0,
        isPhasedOut: false,
        hasGem,
        hasJetpack,
        hasShield,
        hasMagnet,
      });

      // Spawn Floating Cyber Drones above 250m
      if (nextY > 250 && Math.random() < 0.25) {
        const droneX = Math.random() * (w - 80) + 40;
        state.drones.push({
          id: state.nextId++,
          x: droneX,
          y: nextY + gapY * 0.5,
          vx: (Math.random() * 1.5 + 1.0) * horizontalScale * (Math.random() < 0.5 ? 1 : -1),
          radius: 14,
          alive: true,
          minX: 25,
          maxX: w - 25,
          floatOffset: Math.random() * Math.PI * 2,
        });
      }

      // Spawn Boost Speed Rings
      if (nextY > 150 && Math.random() < 0.16) {
        state.boostRings.push({
          id: state.nextId++,
          x: Math.random() * (w - 100) + 50,
          y: nextY + gapY * 0.6,
          radius: 18,
          collected: false,
        });
      }

      state.highestPlatformY = nextY;
    }
  };

  useEffect(() => {
    const state = gameStateRef.current;
    const initialWidth = 420;

    state.px = initialWidth / 2;
    state.py = 60;
    state.vx = 0;
    state.vy = 14;
    state.cameraY = 0;
    state.maxAltitude = 0;
    state.score = 0;
    state.laserY = -260;
    state.laserSpeed = 24;
    state.isAlive = true;
    state.platforms = [];
    state.drones = [];
    state.boostRings = [];
    state.particles = [];
    state.popups = [];
    state.highestPlatformY = 0;
    state.highestObjectY = 0;
    state.comboBounces = 0;
    state.multiplier = 1;
    state.hasShield = false;
    state.jetpackActive = false;
    state.magnetActive = false;
    state.apexCharges = 1;
    state.apexActive = false;
    state.apexTimer = 0;
    state.apexPrecisionStreak = 0;
    state.physicsAccumulator = 0;

    generateWorldUpTo(1800, initialWidth);
  }, []);

  useGameLoop({
    canvasRef,
    isPaused,
    onResize: (w, h) => {
      const state = gameStateRef.current;
      const scaleX = w / Math.max(1, state.viewportWidth);

      state.px = clamp(state.px * scaleX, state.radius + 16, w - state.radius - 16);
      state.vx *= scaleX;
      for (const platform of state.platforms) {
        platform.x *= scaleX;
        platform.w *= scaleX;
        if (platform.vx !== undefined) platform.vx *= scaleX;
        if (platform.minX !== undefined) platform.minX *= scaleX;
        if (platform.maxX !== undefined) platform.maxX *= scaleX;
      }
      for (const drone of state.drones) {
        drone.x *= scaleX;
        drone.vx *= scaleX;
        drone.minX *= scaleX;
        drone.maxX *= scaleX;
      }
      for (const ring of state.boostRings) ring.x *= scaleX;
      for (const particle of state.particles) {
        particle.x *= scaleX;
        particle.vx *= scaleX;
      }
      for (const popup of state.popups) popup.x *= scaleX;

      state.viewportWidth = w;
      state.viewportHeight = h;
      state.physicsAccumulator = 0;
      if (state.platforms.length === 0) generateWorldUpTo(1800, w);
    },
    onUpdate: (ctx, deltaSec, curW, curH) => {
      const state = gameStateRef.current;

      ctx.clearRect(0, 0, curW, curH);

      const batch = getTowerPhysicsStepBatch(state.physicsAccumulator, deltaSec);
      state.physicsAccumulator = batch.remainderSec;
      if (!isPausedRef.current && state.isAlive) {
        for (let simStep = 0; simStep < batch.steps && state.isAlive; simStep++) {
          const dt = TOWER_FIXED_STEP_SEC;
        if (state.apexActive) {
          state.apexTimer -= dt;
          if (state.apexTimer <= 0) {
            state.apexTimer = 0;
            state.apexActive = false;
          }
        }

        // Screen Shake decay
        if (state.screenShake > 0) {
          state.screenShake = Math.max(0, state.screenShake - dt * 15);
        }

        // Horizontal Movement & Acceleration
        const horizontalScale = Math.min(1.8, Math.max(0.85, curW / 420));
        const moveAccel = 38 * horizontalScale;
        const maxMoveSpeed = 8.8 * horizontalScale;
        if (state.leftPressed) {
          state.vx = Math.max(-maxMoveSpeed, state.vx - moveAccel * dt);
          state.facingRight = false;
        } else if (state.rightPressed) {
          state.vx = Math.min(maxMoveSpeed, state.vx + moveAccel * dt);
          state.facingRight = true;
        } else {
          state.vx *= 0.89;
        }

        state.px += state.vx;

        // Wall Sliding & Wall Collision Detection
        const spireLeftBound = 16;
        const spireRightBound = curW - 16;

        if (state.px - state.radius <= spireLeftBound) {
          state.px = spireLeftBound + state.radius;
          state.isTouchingWallLeft = true;
          state.isTouchingWallRight = false;
          if (state.vy < 0 && !state.jetpackActive) {
            state.vy = Math.max(state.vy, -3.5); // Wall friction slide
            // Wall slide sparks
            if (Math.random() < 0.4) {
              state.particles.push({
                x: spireLeftBound,
                y: state.py,
                vx: Math.random() * 3 + 1,
                vy: Math.random() * 2 - 1,
                life: 0.8,
                maxLife: 0.25,
                color: '#38BDF8',
                size: Math.random() * 3 + 1,
              });
            }
          }
        } else if (state.px + state.radius >= spireRightBound) {
          state.px = spireRightBound - state.radius;
          state.isTouchingWallRight = true;
          state.isTouchingWallLeft = false;
          if (state.vy < 0 && !state.jetpackActive) {
            state.vy = Math.max(state.vy, -3.5); // Wall friction slide
            if (Math.random() < 0.4) {
              state.particles.push({
                x: spireRightBound,
                y: state.py,
                vx: -(Math.random() * 3 + 1),
                vy: Math.random() * 2 - 1,
                life: 0.8,
                maxLife: 0.25,
                color: '#38BDF8',
                size: Math.random() * 3 + 1,
              });
            }
          }
        } else {
          state.isTouchingWallLeft = false;
          state.isTouchingWallRight = false;
        }

        // Vertical Physics (Gravity vs Jetpack)
        if (state.jetpackActive) {
          state.vy = 18.5;
          state.jetpackTimer -= dt;
          if (soundEnabled && Math.random() < 0.3) {
            sounds.playJetpackThrust();
          }

          state.particles.push({
            x: state.px + (Math.random() * 8 - 4),
            y: state.py - state.radius,
            vx: Math.random() * 2 - 1,
            vy: -Math.random() * 7 - 5,
            life: 1.0,
            maxLife: 0.35,
            color: '#F43F5E',
            size: Math.random() * 5 + 3,
          });

          if (state.jetpackTimer <= 0) {
            state.jetpackActive = false;
          }
        } else {
          const gravity = 26;
          state.vy -= gravity * dt;
        }

        state.py += state.vy;

        // Squash & Stretch restoration
        state.squashX += (1 - state.squashX) * 0.15;
        state.squashY += (1 - state.squashY) * 0.15;

        // Magnet Power-up timer & Gem Attraction
        if (state.magnetActive) {
          state.magnetTimer -= dt;
          if (state.magnetTimer <= 0) {
            state.magnetActive = false;
          }

          // Pull nearby gems
          for (const plat of state.platforms) {
            if (plat.hasGem) {
              const gemX = plat.x + plat.w / 2;
              const gemY = plat.y + plat.h + 14;
              const dist = Math.hypot(state.px - gemX, state.py - gemY);
              if (dist < 200) {
                // Collect magnetically
                plat.hasGem = false;
                const pts = 350 * state.multiplier;
                state.score += pts;
                publishScore(state.score);
                if (soundEnabled) sounds.playScore();
                state.popups.push({
                  id: state.nextId++,
                  x: state.px,
                  y: state.py + 25,
                  text: `+${pts} MAGNET`,
                  color: '#A855F7',
                  life: 1.0,
                });
              }
            }
          }
        }

        // Update Moving & Phase Platforms
        for (const plat of state.platforms) {
          if (plat.type === 'moving' && plat.vx) {
            plat.x += plat.vx;
            const leftLimit = plat.minX ?? 20;
            const rightLimit = plat.maxX ?? curW - plat.w - 20;
            if (plat.x < leftLimit) {
              plat.x = leftLimit;
              plat.vx = Math.abs(plat.vx);
            } else if (plat.x > rightLimit) {
              plat.x = rightLimit;
              plat.vx = -Math.abs(plat.vx);
            }
          }

          if (plat.type === 'phase' && plat.phaseTimer !== undefined) {
            plat.phaseTimer += dt * 2.2;
            plat.isPhasedOut = Math.sin(plat.phaseTimer) > 0.35;
          }

          if (plat.broken && plat.breakTimer !== undefined) {
            plat.breakTimer -= dt;
          }
        }

        // Update Cyber Drones
        for (const drone of state.drones) {
          if (!drone.alive) continue;
          drone.x += drone.vx;
          if (drone.x <= drone.minX) {
            drone.x = drone.minX;
            drone.vx = Math.abs(drone.vx);
          } else if (drone.x >= drone.maxX) {
            drone.x = drone.maxX;
            drone.vx = -Math.abs(drone.vx);
          }

          // Check Drone Collision with Player
          const dist = Math.hypot(state.px - drone.x, state.py - drone.y);
          if (dist < state.radius + drone.radius) {
            // STOMP check: Player falling on top of drone
            if (state.vy < 0 && state.py > drone.y + 4) {
              drone.alive = false;
              state.vy = 20; // High bounce
              state.squashX = 0.6;
              state.squashY = 1.4;
              state.comboBounces += 3;
              state.screenShake = 6;

              const dronePoints = 600 * state.multiplier;
              state.score += dronePoints;
              publishScore(state.score);

              if (soundEnabled) sounds.playDroneDestroy();

              // Drone destruction particles
              for (let i = 0; i < 22; i++) {
                const angle = Math.random() * Math.PI * 2;
                const spd = Math.random() * 6 + 2;
                state.particles.push({
                  x: drone.x,
                  y: drone.y,
                  vx: Math.cos(angle) * spd,
                  vy: Math.sin(angle) * spd,
                  life: 1.0,
                  maxLife: 0.45,
                  color: '#F43F5E',
                  size: Math.random() * 5 + 2,
                });
              }

              state.popups.push({
                id: state.nextId++,
                x: drone.x,
                y: drone.y + 25,
                text: `DRONE STOMP +${dronePoints}!`,
                color: '#F43F5E',
                life: 1.2,
              });
            } else if (!state.jetpackActive) {
              // Side hit: Shield saves, else knockback / death
              if (state.hasShield) {
                state.hasShield = false;
                drone.alive = false;
                state.vy = 18;
                if (soundEnabled) sounds.playShockwave();
                state.popups.push({
                  id: state.nextId++,
                  x: state.px,
                  y: state.py + 25,
                  text: 'SHIELD DEFLECTED DRONE!',
                  color: '#34D399',
                  life: 1.0,
                });
              } else {
                // Drone strike damage/fall
                state.vy = -10;
                if (soundEnabled) sounds.playExplosion();
              }
            }
          }
        }

        // Update Boost Warp Rings
        for (const ring of state.boostRings) {
          if (ring.collected) continue;
          const dist = Math.hypot(state.px - ring.x, state.py - ring.y);
          if (dist < state.radius + ring.radius) {
            ring.collected = true;
            state.vy = 24; // Sonic warp launch
            state.comboBounces += 2;
            state.screenShake = 4;
            const ringPts = 400 * state.multiplier;
            state.score += ringPts;
            publishScore(state.score);

            if (soundEnabled) sounds.playFeverMode();

            // Ring warp ring particles
            for (let i = 0; i < 20; i++) {
              const a = (i / 20) * Math.PI * 2;
              state.particles.push({
                x: ring.x + Math.cos(a) * ring.radius,
                y: ring.y + Math.sin(a) * ring.radius,
                vx: Math.cos(a) * 5,
                vy: Math.sin(a) * 5 + 4,
                life: 1.0,
                maxLife: 0.4,
                color: '#FACC15',
                size: Math.random() * 4 + 2,
              });
            }

            state.popups.push({
              id: state.nextId++,
              x: ring.x,
              y: ring.y + 30,
              text: `WARP BOOST +${ringPts}!`,
              color: '#FACC15',
              life: 1.0,
            });
          }
        }

        // Platform Collisions (Only when falling downwards)
        if (state.vy < 0 && !state.jetpackActive) {
          for (const plat of state.platforms) {
            if (plat.broken || plat.isPhasedOut) continue;

            const platTop = plat.y + plat.h;
            const prevPy = state.py - state.vy;

            // Check if player feet cross platform top bounds
            if (
              state.px + state.radius * 0.65 >= plat.x &&
              state.px - state.radius * 0.65 <= plat.x + plat.w &&
              state.py - state.radius <= platTop &&
              prevPy - state.radius >= platTop - 15
            ) {
              state.py = platTop + state.radius;

              const precisionLanding = isTowerPrecisionLanding(state.px, plat.x, plat.w);
              if (precisionLanding) {
                state.apexPrecisionStreak++;
                state.apexCharges = getTowerApexCharges(state.apexPrecisionStreak, state.apexCharges);
                const precisionBonus = getTowerApexReward(
                  getTowerPrecisionBonus(state.apexPrecisionStreak),
                  state.apexActive,
                );
                state.score += precisionBonus;
                publishScore(state.score);
                state.popups.push({
                  id: state.nextId++,
                  x: state.px,
                  y: state.py + 34,
                  text: `APEX x${state.apexPrecisionStreak} +${precisionBonus}`,
                  color: '#FACC15',
                  life: 1.0,
                });
              } else {
                state.apexPrecisionStreak = 0;
              }

              if (plat.type === 'spring') {
                state.vy = getTowerApexBounceVelocity(23, state.apexActive);
                state.squashX = 0.6;
                state.squashY = 1.4;
                state.comboBounces += 2;
                if (soundEnabled) sounds.playSpringBounce();

                for (let i = 0; i < 16; i++) {
                  state.particles.push({
                    x: plat.x + plat.w / 2,
                    y: platTop,
                    vx: (Math.random() - 0.5) * 6,
                    vy: Math.random() * 4 + 2,
                    life: 1.0,
                    maxLife: 0.4,
                    color: '#FACC15',
                    size: Math.random() * 4 + 2,
                  });
                }
              } else if (plat.type === 'crumble') {
                state.vy = getTowerApexBounceVelocity(13.5, state.apexActive);
                state.squashX = 0.75;
                state.squashY = 1.25;
                plat.broken = true;
                plat.breakTimer = 0.25;
                if (soundEnabled) sounds.playGlassBreak();

                for (let i = 0; i < 14; i++) {
                  state.particles.push({
                    x: plat.x + Math.random() * plat.w,
                    y: platTop,
                    vx: (Math.random() - 0.5) * 5,
                    vy: (Math.random() - 0.5) * 4 - 2,
                    life: 1.0,
                    maxLife: 0.35,
                    color: '#C084FC',
                    size: Math.random() * 3 + 2,
                  });
                }
              } else {
                state.vy = getTowerApexBounceVelocity(13.8, state.apexActive);
                state.squashX = 0.75;
                state.squashY = 1.25;
                state.comboBounces++;
                if (soundEnabled) sounds.playBounce();
              }

              // Multiplier scaling from combo
              if (state.comboBounces >= 30) state.multiplier = 5;
              else if (state.comboBounces >= 15) state.multiplier = 3;
              else if (state.comboBounces >= 6) state.multiplier = 2;
              else state.multiplier = 1;

              // Collect Items on platform
              if (plat.hasGem) {
                plat.hasGem = false;
                const gemPoints = 300 * state.multiplier;
                state.score += gemPoints;
                publishScore(state.score);
                if (soundEnabled) sounds.playScore();
                state.popups.push({
                  id: state.nextId++,
                  x: state.px,
                  y: state.py + 25,
                  text: `+${gemPoints}`,
                  color: '#38BDF8',
                  life: 1.0,
                });
              }

              if (plat.hasJetpack) {
                plat.hasJetpack = false;
                state.jetpackActive = true;
                state.jetpackTimer = 4.5;
                if (soundEnabled) sounds.playPowerUp();
                state.popups.push({
                  id: state.nextId++,
                  x: state.px,
                  y: state.py + 25,
                  text: 'JETPACK BOOST!',
                  color: '#F43F5E',
                  life: 1.0,
                });
              }

              if (plat.hasShield) {
                plat.hasShield = false;
                state.hasShield = true;
                if (soundEnabled) sounds.playPowerUp();
                state.popups.push({
                  id: state.nextId++,
                  x: state.px,
                  y: state.py + 25,
                  text: 'BUBBLE SHIELD!',
                  color: '#34D399',
                  life: 1.0,
                });
              }

              if (plat.hasMagnet) {
                plat.hasMagnet = false;
                state.magnetActive = true;
                state.magnetTimer = 8.0;
                if (soundEnabled) sounds.playMagnetPulse();
                state.popups.push({
                  id: state.nextId++,
                  x: state.px,
                  y: state.py + 25,
                  text: 'GEM MAGNET 8s!',
                  color: '#A855F7',
                  life: 1.0,
                });
              }

              break;
            }
          }
        }

        // Camera Elevation Tracking
        if (state.py > state.cameraY + curH * 0.35) {
          state.cameraY = state.py - curH * 0.35;
        }

        // Update Max Altitude & Altitude Score
        if (state.py > state.maxAltitude) {
          const deltaAlt = Math.floor(state.py - state.maxAltitude);
          state.maxAltitude = state.py;
          state.score += getTowerApexReward(deltaAlt * 2, state.apexActive);
          publishScore(state.score);
        }

        // Continuously generate upcoming world
        generateWorldUpTo(state.cameraY + curH + 600, curW);

        // Remove entities far below
        state.platforms = state.platforms.filter((p) => p.y >= state.cameraY - 250);
        state.drones = state.drones.filter((d) => d.y >= state.cameraY - 250);
        state.boostRings = state.boostRings.filter((r) => r.y >= state.cameraY - 250);

        // Rising Laser Death Beam
        state.laserSpeed = Math.min(75, 24 + (state.maxAltitude / 1500) * 8);
        state.laserY += state.laserSpeed * dt;

        // Death Check
        if (state.py < state.cameraY - curH * 0.6 || state.py <= state.laserY + 10) {
          if (state.hasShield) {
            state.hasShield = false;
            state.vy = 22;
            if (soundEnabled) sounds.playShockwave();
            state.popups.push({
              id: state.nextId++,
              x: state.px,
              y: state.py + 30,
              text: 'SHIELD SAVED YOU!',
              color: '#34D399',
              life: 1.0,
            });
          } else {
            state.isAlive = false;
            if (soundEnabled) sounds.playExplosion();
            setSafeTimeout(() => {
              onGameOver(state.score);
            }, 400);
          }
        }

        // Update Particles
        for (let p = state.particles.length - 1; p >= 0; p--) {
          const part = state.particles[p];
          part.x += part.vx;
          part.y += part.vy;
          part.life -= dt / part.maxLife;
          if (part.life <= 0) {
            state.particles.splice(p, 1);
          }
        }

        // Update Popups
        for (let pop = state.popups.length - 1; pop >= 0; pop--) {
          const popup = state.popups[pop];
          popup.y += 30 * dt;
          popup.life -= dt * 1.4;
          if (popup.life <= 0) {
            state.popups.splice(pop, 1);
          }
        }
        }
      }

      // ==========================================
      // RENDER CANVAS TOWER
      // ==========================================
      const toScreenY = (worldY: number) => {
        return curH - (worldY - state.cameraY);
      };

      ctx.save();
      // Apply screen shake
      if (state.screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * state.screenShake * 2;
        const shakeY = (Math.random() - 0.5) * state.screenShake * 2;
                if (!isArcadeReducedMotion()) {
          ctx.translate(shakeX, shakeY);
        }
      }

      // 1. Deep Space Cyber Spire Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, curH);
      bgGrad.addColorStop(0, '#050508');
      bgGrad.addColorStop(0.5, '#0A0A13');
      bgGrad.addColorStop(1, '#110A1C');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, curW, curH);

      // Left and Right Cyber Tower Neon Spires
      const spireWidth = 14;
      const leftSpireGrad = ctx.createLinearGradient(0, 0, spireWidth, 0);
      leftSpireGrad.addColorStop(0, '#38BDF8');
      leftSpireGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = leftSpireGrad;
      ctx.fillRect(0, 0, spireWidth, curH);

      const rightSpireGrad = ctx.createLinearGradient(curW - spireWidth, 0, curW, 0);
      rightSpireGrad.addColorStop(0, 'transparent');
      rightSpireGrad.addColorStop(1, '#38BDF8');
      ctx.fillStyle = rightSpireGrad;
      ctx.fillRect(curW - spireWidth, 0, spireWidth, curH);

      // Altitude Grid Stripes
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
      ctx.lineWidth = 1;
      const startGridY = Math.floor(state.cameraY / 60) * 60;
      for (let gy = startGridY; gy < state.cameraY + curH + 60; gy += 60) {
        const sy = toScreenY(gy);
        ctx.beginPath();
        ctx.moveTo(spireWidth, sy);
        ctx.lineTo(curW - spireWidth, sy);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${Math.round(gy)}m`, spireWidth + 4, sy - 4);
      }

      // 2. Render Boost Warp Rings
      for (const ring of state.boostRings) {
        if (ring.collected) continue;
        const sy = toScreenY(ring.y);
        if (sy < -50 || sy > curH + 50) continue;

        ctx.save();
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 3.5;
        ctx.shadowColor = '#FACC15';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(ring.x, sy, ring.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(250, 204, 21, 0.2)';
        ctx.fill();
        ctx.restore();
      }

      // 3. Render Platforms
      for (const plat of state.platforms) {
        const sy = toScreenY(plat.y + plat.h);
        if (sy < -50 || sy > curH + 50) continue;

        let platColor = '#38BDF8';
        if (plat.type === 'moving') platColor = '#FB923C';
        else if (plat.type === 'spring') platColor = '#FACC15';
        else if (plat.type === 'crumble') platColor = '#C084FC';
        else if (plat.type === 'phase') platColor = '#2DD4BF';

        ctx.save();
        ctx.shadowColor = platColor;
        ctx.shadowBlur = 10;

        if (plat.type === 'phase') {
          ctx.globalAlpha = plat.isPhasedOut ? 0.25 : 0.95;
        }

        ctx.fillStyle = plat.broken ? 'rgba(192, 132, 252, 0.3)' : platColor;
        ctx.beginPath();
        ctx.roundRect(plat.x, sy, plat.w, plat.h, 6);
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (plat.type === 'spring') {
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(plat.x + plat.w / 2, sy + plat.h / 2, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        // Render platform items
        if (plat.hasGem) {
          const gemX = plat.x + plat.w / 2;
          const gemY = sy - 14;
          ctx.fillStyle = '#38BDF8';
          ctx.beginPath();
          ctx.arc(gemX, gemY, 6.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.stroke();
        } else if (plat.hasJetpack) {
          const itemX = plat.x + plat.w / 2;
          const itemY = sy - 14;
          ctx.fillStyle = '#F43F5E';
          ctx.beginPath();
          ctx.arc(itemX, itemY, 7.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (plat.hasShield) {
          const itemX = plat.x + plat.w / 2;
          const itemY = sy - 14;
          ctx.fillStyle = '#34D399';
          ctx.beginPath();
          ctx.arc(itemX, itemY, 7.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (plat.hasMagnet) {
          const itemX = plat.x + plat.w / 2;
          const itemY = sy - 14;
          ctx.fillStyle = '#A855F7';
          ctx.beginPath();
          ctx.arc(itemX, itemY, 7.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      // 4. Render Cyber Drones
      for (const drone of state.drones) {
        if (!drone.alive) continue;
        const sy = toScreenY(drone.y);
        if (sy < -50 || sy > curH + 50) continue;

        ctx.save();
        ctx.translate(drone.x, sy);

        // Drone core
        ctx.fillStyle = '#EF4444';
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, drone.radius, 0, Math.PI * 2);
        ctx.fill();

        // Eye scanner
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        // Outer rotating cyber spikes
        ctx.strokeStyle = '#F87171';
        ctx.lineWidth = 2;
        const spikeAngle = performance.now() * 0.005;
        for (let s = 0; s < 4; s++) {
          const ang = spikeAngle + (s * Math.PI) / 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * (drone.radius + 2), Math.sin(ang) * (drone.radius + 2));
          ctx.lineTo(Math.cos(ang) * (drone.radius + 7), Math.sin(ang) * (drone.radius + 7));
          ctx.stroke();
        }

        ctx.restore();
      }

      // 5. Render Particles
      for (const p of state.particles) {
        const sy = toScreenY(p.y);
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, sy, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 6. Render Player Character
      if (state.isAlive) {
        const psx = state.px;
        const psy = toScreenY(state.py);

        ctx.save();
        ctx.translate(psx, psy);
        ctx.scale(state.squashX, state.squashY);

        // Magnet Aura
        if (state.magnetActive) {
          ctx.strokeStyle = '#A855F7';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(0, 0, state.radius + 12, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Bubble Shield halo
        if (state.hasShield) {
          ctx.strokeStyle = '#34D399';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = '#34D399';
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(0, 0, state.radius + 6, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Player Core Body
        const orbGrad = ctx.createRadialGradient(0, -2, 2, 0, 0, state.radius);
        orbGrad.addColorStop(0, '#FFFFFF');
        orbGrad.addColorStop(0.4, state.jetpackActive ? '#F43F5E' : state.magnetActive ? '#A855F7' : '#38BDF8');
        orbGrad.addColorStop(1, '#0C4A6E');

        ctx.fillStyle = orbGrad;
        ctx.shadowColor = state.jetpackActive ? '#F43F5E' : '#38BDF8';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(0, 0, state.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Eye visor
        const eyeOffset = state.facingRight ? 4 : -4;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(eyeOffset, -2, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // 7. Render Rising Hazard Laser Floor
      const laserScreenY = toScreenY(state.laserY);
      if (laserScreenY < curH + 200) {
        const laserGrad = ctx.createLinearGradient(0, laserScreenY, 0, curH);
        laserGrad.addColorStop(0, 'rgba(244, 63, 94, 0.9)');
        laserGrad.addColorStop(0.15, 'rgba(239, 68, 68, 0.4)');
        laserGrad.addColorStop(1, 'rgba(153, 27, 27, 0.8)');

        ctx.fillStyle = laserGrad;
        ctx.fillRect(0, laserScreenY, curW, curH - laserScreenY);

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.moveTo(0, laserScreenY);
        ctx.lineTo(curW, laserScreenY);
        ctx.stroke();
      }

      // 8. Render Floating Popups
      for (const pop of state.popups) {
        const sy = toScreenY(pop.y);
        ctx.save();
        ctx.globalAlpha = pop.life;
        ctx.fillStyle = pop.color;
        ctx.font = 'bold 15px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = pop.color;
        ctx.shadowBlur = 8;
        ctx.fillText(pop.text, pop.x, sy);
        ctx.restore();
      }

      ctx.restore();

      // Sync state to React HUD
      setHudState({
        altitude: Math.round(state.maxAltitude),
        score: state.score,
        hasShield: state.hasShield,
        jetpackTime: Math.ceil(state.jetpackTimer),
        magnetTime: Math.ceil(state.magnetTimer),
        laserDistance: Math.max(0, Math.round(state.py - state.laserY)),
        comboStreak: state.comboBounces,
        multiplier: state.multiplier,
        apexCharges: state.apexCharges,
        apexActive: state.apexActive,
        apexPercent: state.apexActive ? Math.round((state.apexTimer / TOWER_APEX_DURATION_SEC) * 100) : 0,
        apexStreak: state.apexPrecisionStreak,
      });

      return state.isAlive;
    },
  });

  return (
    <div
      ref={containerRef}
      id="tower-game-container"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className="relative w-full h-full min-h-0 flex flex-col items-center justify-center bg-[#050508] select-none overflow-hidden touch-none"
    >
      {/* Top HUD Display */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none gap-2 flex-wrap">
        {/* Altitude & Power-up Badges */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] flex items-center gap-1.5 text-sky-400 font-mono backdrop-blur-md">
            <ArrowUp className="w-3.5 h-3.5 animate-bounce" />
            <span className="text-xs font-black">{hudState.altitude}m</span>
          </div>

          {hudState.multiplier > 1 && (
            <div className="px-2 py-1 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-xs font-black">
              {hudState.multiplier}x MULTIPLIER
            </div>
          )}

          {hudState.jetpackTime > 0 && (
            <div className="px-2 py-1 rounded-xl bg-rose-500/25 border border-rose-500 text-rose-300 font-mono text-xs font-bold flex items-center gap-1 animate-pulse">
              <Rocket className="w-3.5 h-3.5" />
              <span>{hudState.jetpackTime}s</span>
            </div>
          )}

          {hudState.magnetTime > 0 && (
            <div className="px-2 py-1 rounded-xl bg-purple-500/25 border border-purple-500 text-purple-300 font-mono text-xs font-bold flex items-center gap-1 animate-pulse">
              <Magnet className="w-3.5 h-3.5" />
              <span>{hudState.magnetTime}s</span>
            </div>
          )}

          {hudState.hasShield && (
            <div className="px-2 py-1 rounded-xl bg-emerald-500/25 border border-emerald-500 text-emerald-300 font-mono text-xs font-bold flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" />
              <span>SHIELD</span>
            </div>
          )}
        </div>

        {/* Hazard Laser Warning */}
        <div
          className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 font-mono text-xs backdrop-blur-md ${
            hudState.laserDistance < 150
              ? 'bg-rose-500/25 border-rose-500 text-rose-300 animate-ping shadow-[0_0_10px_rgba(244,63,94,0.5)]'
              : 'bg-[#18181B]/90 border-[#27272A] text-[#A1A1AA]'
          }`}
        >
          <Flame className={`w-3.5 h-3.5 ${hudState.laserDistance < 150 ? 'text-rose-400' : 'text-[#71717A]'}`} />
          <span className="text-[11px] font-bold">LASER: {hudState.laserDistance}m</span>
        </div>
      </div>

      {/* Main Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block cursor-pointer" />

      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          triggerApexDrive();
        }}
        disabled={hudState.apexCharges <= 0 || hudState.apexActive}
        className="absolute bottom-10 right-3 z-20 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/60 text-amber-200 font-mono text-[10px] font-black disabled:opacity-45 pointer-events-auto"
        aria-label="Activate Apex Drive"
      >
        {hudState.apexActive ? `APEX ${hudState.apexPercent}%` : `APEX (${hudState.apexCharges}) · F/SHIFT`}
      </button>

      {/* Controls Overlay Helper */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none z-10">
        <div className="px-3 py-1 rounded-full bg-[#121215]/85 border border-[#27272A] text-[10px] text-[#A1A1AA] font-mono backdrop-blur-md">
          <span>Move: <b className="text-white">A / D</b> or <b className="text-white">← / →</b> • Wall Jump: <b className="text-white">Space</b> or <b className="text-white">Touch Spire</b> • Stomp Drones • Precision centers earn Apex</span>
        </div>
      </div>
    </div>
  );
};
