import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { haptics } from '../lib/haptics';
import { Shield, Sparkles, Zap, Target, Orbit, Compass, Award } from 'lucide-react';
import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';
import {
  advanceSlingshotProbe,
  getSlingshotPhysicsStepBatch,
  getSlingshotResizeScale,
  remapSlingshotPoint,
} from '../lib/slingshotRuntime';

interface PlanetNode {
  id: number;
  x: number;
  y: number;
  radius: number;
  gravityRadius: number;
  color: string;
  glowColor: string;
  type: 'terran' | 'gas' | 'lava' | 'blackhole' | 'warp';
  hasRings?: boolean;
  ringAngle?: number;
  isHazard?: boolean;
  hazardAngle?: number;
  hazardSpeed?: number;
  isWarpGate?: boolean;
  visited: boolean;
  label: string;
  pulsePhase: number;
}

interface StarDust {
  id: number;
  x: number;
  y: number;
  collected: boolean;
  color: string;
}

interface Asteroid {
  x: number;
  y: number;
  size: number;
  angle: number;
  orbitNodeId: number;
  orbitRadius: number;
  orbitSpeed: number;
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
  scale?: number;
}

interface NebulaCloud {
  x: number;
  y: number;
  radius: number;
  color: string;
}

export const SlingshotGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [combo, setCombo] = useState(1);
  const [currentSector, setCurrentSector] = useState(1);
  const [isLockedOn, setIsLockedOn] = useState(false);
  const [sectorName, setSectorName] = useState('SOLAR CORE');

  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const setSafeTimeout = useSafeTimeout();

  const SECTOR_NAMES = [
    'SOLAR CORE',
    'NEBULA RIFT',
    'QUANTUM CLUSTER',
    'ASTEROID FORGE',
    'EVENT HORIZON',
    'HYPERSPACE VOID',
  ];

  const gameStateRef = useRef({
    score: 0,
    lives: 3,
    combo: 1,
    sector: 1,
    isAlive: true,
    // Probe state
    probeX: 0,
    probeY: 0,
    probeVx: 0,
    probeVy: 0,
    isTethered: true,
    currentAnchorId: 0,
    orbitAngle: 0,
    orbitSpeed: 0.055,
    orbitRadius: 46,
    cameraY: 0,
    targetCameraY: 0,
    screenShake: 0,
    nodes: [] as PlanetNode[],
    stardust: [] as StarDust[],
    asteroids: [] as Asteroid[],
    nebulae: [] as NebulaCloud[],
    particles: [] as Particle[],
    popups: [] as ScorePopup[],
    trail: [] as { x: number; y: number; alpha: number; color?: string }[],
    nodeCounter: 0,
    isAimingAtNext: false,
    lockOnSoundPlayed: false,
    physicsAccumulator: 0,
    viewportWidth: 0,
    viewportHeight: 0,
  });

  const launchProbe = useCallback(() => {
    const state = gameStateRef.current;
    if (!state.isTethered || !state.isAlive || isPausedRef.current) return;

    const anchor = state.nodes.find((n) => n.id === state.currentAnchorId);
    if (!anchor) return;

    // Launch tangentially
    state.isTethered = false;
    const launchSpeed = state.isAimingAtNext ? 9.8 : 8.8;
    const tangentAngle = state.orbitAngle + Math.PI / 2;
    state.probeVx = Math.cos(tangentAngle) * launchSpeed;
    state.probeVy = Math.sin(tangentAngle) * launchSpeed;

    if (state.isAimingAtNext) {
      haptics.medium();
    } else {
      haptics.light();
    }

    if (soundEnabled) {
      if (state.isAimingAtNext) {
        sounds.playVictory();
      } else {
        sounds.playSlingshotRelease();
      }
    }

    state.screenShake = state.isAimingAtNext ? 8 : 4;

    // Launch burst particles
    const burstCount = state.isAimingAtNext ? 24 : 14;
    for (let i = 0; i < burstCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 2.0 + Math.random() * 4.5;
      state.particles.push({
        x: state.probeX,
        y: state.probeY,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.85,
        maxLife: 0.85,
        color: state.isAimingAtNext ? '#34D399' : '#38BDF8',
        size: 3 + Math.random() * 2.5,
      });
    }
  }, [soundEnabled]);

  const addScorePopup = (text: string, x: number, y: number, color = '#FACC15', scale = 1.0) => {
    gameStateRef.current.popups.push({
      id: Math.random(),
      text,
      x,
      y,
      color,
      life: 1.0,
      scale,
    });
  };

  // Initialize planetary sector chain
  const initNodes = (w: number, h: number) => {
    const state = gameStateRef.current;
    state.nodes = [];
    state.stardust = [];
    state.asteroids = [];
    state.nebulae = [];
    state.viewportWidth = w;
    state.viewportHeight = h;
    state.physicsAccumulator = 0;

    const startX = w / 2;
    const startY = h * 0.76;

    // Start Base
    state.nodes.push({
      id: 0,
      x: startX,
      y: startY,
      radius: 24,
      gravityRadius: 80,
      color: '#06B6D4',
      glowColor: '#38BDF8',
      type: 'terran',
      visited: true,
      label: 'ALPHA STATION',
      pulsePhase: 0,
    });
    state.currentAnchorId = 0;
    state.probeX = startX + state.orbitRadius;
    state.probeY = startY;

    let prevY = startY;
    let prevX = startX;

    // Generate colorful backdrop nebulae
    for (let n = 0; n < 6; n++) {
      state.nebulae.push({
        x: Math.random() * w,
        y: startY - n * 300 - Math.random() * 150,
        radius: 120 + Math.random() * 100,
        color: n % 2 === 0 ? 'rgba(139, 92, 246, 0.12)' : 'rgba(236, 72, 153, 0.10)',
      });
    }

    for (let i = 1; i <= 8; i++) {
      state.nodeCounter++;
      const ny = prevY - (145 + Math.random() * 45);
      const nx = Math.max(75, Math.min(w - 75, prevX + (Math.random() - 0.5) * 220));
      const isWarp = i === 8;
      const isLava = !isWarp && i % 3 === 0;
      const isGas = !isWarp && i % 2 === 0 && !isLava;
      const isHazard = !isWarp && i > 2 && Math.random() < 0.35;

      let nodeType: PlanetNode['type'] = 'terran';
      let color = '#38BDF8';
      let glowColor = '#0284C7';
      if (isWarp) {
        nodeType = 'warp';
        color = '#F43F5E';
        glowColor = '#E11D48';
      } else if (isLava) {
        nodeType = 'lava';
        color = '#F97316';
        glowColor = '#EA580C';
      } else if (isGas) {
        nodeType = 'gas';
        color = '#A855F7';
        glowColor = '#9333EA';
      }

      const nodeId = state.nodeCounter;
      state.nodes.push({
        id: nodeId,
        x: nx,
        y: ny,
        radius: isWarp ? 28 : isGas ? 26 : 23,
        gravityRadius: isWarp ? 90 : 80,
        color,
        glowColor,
        type: nodeType,
        hasRings: isGas,
        ringAngle: Math.PI / 4,
        isHazard,
        isWarpGate: isWarp,
        hazardAngle: 0,
        hazardSpeed: (Math.random() > 0.5 ? 1 : -1) * 0.035,
        visited: false,
        label: isWarp ? `WARP TO SECTOR ${state.sector + 1}` : `PLANET ${i}`,
        pulsePhase: Math.random() * Math.PI * 2,
      });

      // Add orbiting hazard asteroids for hazard planets
      if (isHazard) {
        for (let a = 0; a < 2; a++) {
          state.asteroids.push({
            x: nx,
            y: ny,
            size: 5,
            angle: (a * Math.PI),
            orbitNodeId: nodeId,
            orbitRadius: 54,
            orbitSpeed: 0.04,
          });
        }
      }

      // Stardust path between planets
      for (let s = 1; s <= 3; s++) {
        const ratio = s / 4;
        state.stardust.push({
          id: Math.random(),
          x: prevX + (nx - prevX) * ratio,
          y: prevY + (ny - prevY) * ratio,
          collected: false,
          color: s === 2 ? '#FACC15' : '#38BDF8',
        });
      }

      prevY = ny;
      prevX = nx;
    }
  };

  useEffect(() => {
    const handleAction = (e: MouseEvent | TouchEvent | KeyboardEvent) => {
      if (isPausedRef.current) return;
      if ('key' in e && e.key !== ' ' && e.key !== 'Enter' && e.key !== 'ArrowUp') return;
      if ('key' in e) e.preventDefault();
      if (e.type === 'touchstart') e.preventDefault();
      launchProbe();
    };

    window.addEventListener('keydown', handleAction);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('mousedown', handleAction);
      canvas.addEventListener('touchstart', handleAction, { passive: false });
    }

    return () => {
      window.removeEventListener('keydown', handleAction);
      if (canvas) {
        canvas.removeEventListener('mousedown', handleAction);
        canvas.removeEventListener('touchstart', handleAction);
      }
    };
  }, [launchProbe]);

  useGameLoop({
    canvasRef,
    isPaused,
    onResize: (w, h) => {
      const st = gameStateRef.current;
      const oldW = st.viewportWidth;
      const oldH = st.viewportHeight;
      if (oldW <= 0 || oldH <= 0 || st.nodes.length === 0) {
        initNodes(w, h);
        return;
      }
      if (Math.abs(oldW - w) < 0.5 && Math.abs(oldH - h) < 0.5) return;

      const sx = w / oldW;
      const sy = h / oldH;
      const sizeScale = getSlingshotResizeScale(oldW, oldH, w, h);

      st.nodes = st.nodes.map((node) => ({
        ...node,
        x: node.x * sx,
        y: node.y * sy,
        radius: node.radius * sizeScale,
        gravityRadius: node.gravityRadius * sizeScale,
      }));
      st.stardust = st.stardust.map((star) => ({
        ...star,
        x: star.x * sx,
        y: star.y * sy,
      }));
      st.asteroids = st.asteroids.map((asteroid) => ({
        ...asteroid,
        x: asteroid.x * sx,
        y: asteroid.y * sy,
        size: asteroid.size * sizeScale,
        orbitRadius: asteroid.orbitRadius * sizeScale,
      }));
      st.nebulae = st.nebulae.map((nebula) => ({
        ...nebula,
        x: nebula.x * sx,
        y: nebula.y * sy,
        radius: nebula.radius * sizeScale,
      }));
      st.trail = st.trail.map((point) => ({ ...point, ...remapSlingshotPoint(point, oldW, oldH, w, h) }));
      st.particles.forEach((particle) => {
        particle.x *= sx;
        particle.y *= sy;
        particle.vx *= sx;
        particle.vy *= sy;
        particle.size *= sizeScale;
      });
      st.popups.forEach((popup) => {
        popup.x *= sx;
        popup.y *= sy;
      });

      st.orbitRadius *= sizeScale;
      const currentAnchor = st.nodes.find((node) => node.id === st.currentAnchorId);
      if (st.isTethered && currentAnchor) {
        st.probeX = currentAnchor.x + Math.cos(st.orbitAngle) * st.orbitRadius;
        st.probeY = currentAnchor.y + Math.sin(st.orbitAngle) * st.orbitRadius;
      } else {
        st.probeX *= sx;
        st.probeY *= sy;
        st.probeVx *= sx;
        st.probeVy *= sy;
      }

      st.cameraY *= sy;
      st.targetCameraY *= sy;
      st.viewportWidth = w;
      st.viewportHeight = h;
      st.physicsAccumulator = 0;
    },
    onUpdate: (ctx, deltaSec, w, h) => {
      const st = gameStateRef.current;
      if (st.nodes.length === 0) {
        initNodes(w, h);
      }

      if (!isPausedRef.current && st.isAlive) {
        const frameScale = Math.max(0.001, Math.min(deltaSec, 0.05) * 60);
        if (st.screenShake > 0) {
          st.screenShake *= Math.pow(0.88, frameScale);
          if (st.screenShake < 0.2) st.screenShake = 0;
        }

        // Visual pulses stay smooth while gameplay advances in fixed 60 Hz steps.
        st.nodes.forEach((n) => {
          n.pulsePhase += 0.04 * frameScale;
        });

        const batch = getSlingshotPhysicsStepBatch(st.physicsAccumulator, deltaSec);
        st.physicsAccumulator = batch.remainderSec;
        for (let simStep = 0; simStep < batch.steps && st.isAlive; simStep++) {
          const currentAnchor = st.nodes.find((n) => n.id === st.currentAnchorId);
          const nextAnchor = st.nodes.find((n) => n.id === st.currentAnchorId + 1);

          // Asteroids and probe movement share the same fixed simulation clock.
          st.asteroids.forEach((ast) => {
            const anchor = st.nodes.find((n) => n.id === ast.orbitNodeId);
            if (anchor) {
              ast.angle += ast.orbitSpeed;
              ast.x = anchor.x + Math.cos(ast.angle) * ast.orbitRadius;
              ast.y = anchor.y + Math.sin(ast.angle) * ast.orbitRadius;
            }
          });

          if (st.isTethered && currentAnchor) {
          // Orbit motion
          st.orbitAngle += st.orbitSpeed;
          st.probeX = currentAnchor.x + Math.cos(st.orbitAngle) * st.orbitRadius;
          st.probeY = currentAnchor.y + Math.sin(st.orbitAngle) * st.orbitRadius;
          st.targetCameraY = -currentAnchor.y + h * 0.65;

          // Check tangent lock-on alignment to next destination
          if (nextAnchor) {
            const tangentAngle = st.orbitAngle + Math.PI / 2;
            const dx = nextAnchor.x - st.probeX;
            const dy = nextAnchor.y - st.probeY;
            const angleToNext = Math.atan2(dy, dx);
            let angleDiff = Math.abs(tangentAngle - angleToNext);
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

            const isLocked = Math.abs(angleDiff) < 0.26;
            st.isAimingAtNext = isLocked;
            setIsLockedOn(isLocked);

            if (isLocked && !st.lockOnSoundPlayed && soundEnabled) {
              sounds.playOrbitLock();
              st.lockOnSoundPlayed = true;
            } else if (!isLocked) {
              st.lockOnSoundPlayed = false;
            }
          } else {
            st.isAimingAtNext = false;
            setIsLockedOn(false);
          }
        } else {
          // Free space flight on the same fixed simulation clock as orbital motion.
          advanceSlingshotProbe(st);
          st.targetCameraY = -st.probeY + h * 0.65;
          st.isAimingAtNext = false;
          setIsLockedOn(false);

          st.trail.push({
            x: st.probeX,
            y: st.probeY,
            alpha: 0.85,
            color: st.isAimingAtNext ? '#34D399' : '#38BDF8',
          });

          // Check Asteroid Collisions in free flight
          for (let a = 0; a < st.asteroids.length; a++) {
            const ast = st.asteroids[a];
            if (Math.hypot(ast.x - st.probeX, ast.y - st.probeY) < 14) {
              st.lives--;
              setLives(st.lives);
              st.combo = 1;
              setCombo(1);
              st.screenShake = 14;
              haptics.impact();
              addScorePopup('ASTEROID HIT! -1 LIFE', st.probeX, st.probeY - 25, '#EF4444', 1.2);
              if (soundEnabled) sounds.playExplosion();

              if (currentAnchor) {
                st.isTethered = true;
                st.probeX = currentAnchor.x + st.orbitRadius;
                st.probeY = currentAnchor.y;
                st.orbitAngle = 0;
              }

              if (st.lives <= 0) {
                st.isAlive = false;
                haptics.gameOver();
                if (soundEnabled) sounds.playGameOver();
                setSafeTimeout(() => onGameOver(st.score), 500);
              }
              break;
            }
          }

          // Check Gravity Capture across all planet nodes
          for (let i = 0; i < st.nodes.length; i++) {
            const node = st.nodes[i];
            if (node.id === st.currentAnchorId) continue;

            const dist = Math.hypot(node.x - st.probeX, node.y - st.probeY);
            if (dist < node.gravityRadius) {
              // Captured into orbit!
              st.isTethered = true;
              st.currentAnchorId = node.id;
              st.orbitAngle = Math.atan2(st.probeY - node.y, st.probeX - node.x);

              const crossProduct =
                (st.probeX - node.x) * st.probeVy - (st.probeY - node.y) * st.probeVx;
              st.orbitSpeed = crossProduct > 0 ? 0.055 : -0.055;

              haptics.light();
              if (soundEnabled) sounds.playGravityCapture();

              if (!node.visited) {
                node.visited = true;
                const isPerfect = dist < node.gravityRadius * 0.65;
                const basePoints = isPerfect ? 700 : 350;
                const gained = basePoints * st.combo;

                st.score += gained;
                onScoreUpdate(st.score);
                setScore(st.score);

                st.combo++;
                setCombo(st.combo);

                if (node.isWarpGate) {
                  // Warp into next sector!
                  st.sector++;
                  setCurrentSector(st.sector);
                  const nextName = SECTOR_NAMES[(st.sector - 1) % SECTOR_NAMES.length];
                  setSectorName(nextName);

                  st.screenShake = 16;
                  haptics.combo();
                  addScorePopup(`WARP TO ${nextName}! +2500`, node.x, node.y - 45, '#F43F5E', 1.35);
                  st.score += 2500;
                  onScoreUpdate(st.score);
                  setScore(st.score);
                  if (soundEnabled) sounds.playWarp();
                } else if (isPerfect) {
                  haptics.score();
                  addScorePopup(`PERFECT SLINGSHOT! +${gained}`, node.x, node.y - 35, '#34D399', 1.25);
                  if (soundEnabled) sounds.playVictory();
                } else {
                  haptics.score();
                  addScorePopup(`+${gained}`, node.x, node.y - 30, '#38BDF8');
                  if (soundEnabled) sounds.playScore();
                }

                // Spawn more planets ahead dynamically
                const highestNode = st.nodes[st.nodes.length - 1];
                if (highestNode && highestNode.y - st.probeY > -850) {
                  for (let k = 1; k <= 8; k++) {
                    st.nodeCounter++;
                    const lastN = st.nodes[st.nodes.length - 1];
                    const ny = lastN.y - (145 + Math.random() * 45);
                    const nx = Math.max(75, Math.min(w - 75, lastN.x + (Math.random() - 0.5) * 220));
                    const isWarp = k === 8;
                    const isLava = !isWarp && k % 3 === 0;
                    const isGas = !isWarp && k % 2 === 0 && !isLava;
                    const isHaz = !isWarp && Math.random() < 0.35;

                    let nType: PlanetNode['type'] = 'terran';
                    let col = '#38BDF8';
                    let glow = '#0284C7';
                    if (isWarp) {
                      nType = 'warp';
                      col = '#F43F5E';
                      glow = '#E11D48';
                    } else if (isLava) {
                      nType = 'lava';
                      col = '#F97316';
                      glow = '#EA580C';
                    } else if (isGas) {
                      nType = 'gas';
                      col = '#A855F7';
                      glow = '#9333EA';
                    }

                    const newId = st.nodeCounter;
                    st.nodes.push({
                      id: newId,
                      x: nx,
                      y: ny,
                      radius: isWarp ? 28 : isGas ? 26 : 23,
                      gravityRadius: isWarp ? 90 : 80,
                      color: col,
                      glowColor: glow,
                      type: nType,
                      hasRings: isGas,
                      ringAngle: Math.PI / 4,
                      isHazard: isHaz,
                      isWarpGate: isWarp,
                      hazardAngle: 0,
                      hazardSpeed: (Math.random() > 0.5 ? 1 : -1) * 0.035,
                      visited: false,
                      label: isWarp ? `WARP SECTOR ${st.sector + 1}` : `PLANET ${st.nodeCounter}`,
                      pulsePhase: Math.random() * Math.PI * 2,
                    });

                    // Add Asteroids
                    if (isHaz) {
                      for (let a = 0; a < 2; a++) {
                        st.asteroids.push({
                          x: nx,
                          y: ny,
                          size: 5,
                          angle: (a * Math.PI),
                          orbitNodeId: newId,
                          orbitRadius: 54,
                          orbitSpeed: 0.04,
                        });
                      }
                    }

                    // Add Stardust crystals
                    for (let s = 1; s <= 3; s++) {
                      const ratio = s / 4;
                      st.stardust.push({
                        id: Math.random(),
                        x: lastN.x + (nx - lastN.x) * ratio,
                        y: lastN.y + (ny - lastN.y) * ratio,
                        collected: false,
                        color: s === 2 ? '#FACC15' : '#38BDF8',
                      });
                    }
                  }
                }
              }

              break;
            }
          }

          // Off-screen void loss check
          if (
            st.probeX < -150 ||
            st.probeX > w + 150 ||
            (currentAnchor && st.probeY > currentAnchor.y + 380)
          ) {
            st.lives--;
            setLives(st.lives);
            st.combo = 1;
            setCombo(1);
            st.screenShake = 16;
            if (soundEnabled) sounds.playExplosion();

            if (currentAnchor) {
              st.isTethered = true;
              st.probeX = currentAnchor.x + st.orbitRadius;
              st.probeY = currentAnchor.y;
              st.orbitAngle = 0;
            }

            addScorePopup('LOST IN DEEP VOID! -1 LIFE', w / 2, h / 2, '#EF4444', 1.25);

            if (st.lives <= 0) {
              st.isAlive = false;
              if (soundEnabled) sounds.playGameOver();
              setSafeTimeout(() => onGameOver(st.score), 500);
            }
          }
        }

        // Stardust pickups
        st.stardust.forEach((star) => {
          if (!star.collected && Math.hypot(star.x - st.probeX, star.y - st.probeY) < 28) {
            star.collected = true;
            const starBonus = 180 * st.combo;
            st.score += starBonus;
            onScoreUpdate(st.score);
            setScore(st.score);
            addScorePopup(`+${starBonus}`, star.x, star.y, '#FACC15');
            if (soundEnabled) sounds.playPop();

            // Stardust glitter particles
            for (let i = 0; i < 8; i++) {
              st.particles.push({
                x: star.x,
                y: star.y,
                vx: (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 3,
                life: 0.7,
                maxLife: 0.7,
                color: '#FACC15',
                size: 2.5,
              });
            }
          }
        });

          // Trail fade is tied to simulation time rather than render frequency.
          st.trail.forEach((t) => (t.alpha -= 0.02));
          st.trail = st.trail.filter((t) => t.alpha > 0.02);
        }

        const cameraBlend = 1 - Math.pow(1 - 0.085, frameScale);
        st.cameraY += (st.targetCameraY - st.cameraY) * cameraBlend;
      }

      // --- RENDERING ---
      ctx.clearRect(0, 0, w, h);

      ctx.save();
      if (st.screenShake > 0) {
        ctx.translate(
          (Math.random() - 0.5) * st.screenShake,
          (Math.random() - 0.5) * st.screenShake
        );
      }

      // Deep space backdrop
      const spaceGrad = ctx.createLinearGradient(0, 0, 0, h);
      spaceGrad.addColorStop(0, '#04050E');
      spaceGrad.addColorStop(0.5, '#07091B');
      spaceGrad.addColorStop(1, '#0C0A24');
      ctx.fillStyle = spaceGrad;
      ctx.fillRect(0, 0, w, h);

      // Starfield background
      ctx.fillStyle = '#FFFFFF';
      for (let i = 0; i < 35; i++) {
        const sx = ((i * 73) % w);
        const sy = ((i * 127 + st.cameraY * 0.2) % h + h) % h;
        const sa = (Math.sin(i + performance.now() * 0.002) + 1) * 0.35 + 0.2;
        ctx.globalAlpha = sa;
        ctx.beginPath();
        ctx.arc(sx, sy, (i % 3 === 0 ? 1.8 : 1.0), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      ctx.save();
      ctx.translate(0, st.cameraY);

      // Distant Nebulae
      st.nebulae.forEach((neb) => {
        const radGrad = ctx.createRadialGradient(neb.x, neb.y, 10, neb.x, neb.y, neb.radius);
        radGrad.addColorStop(0, neb.color);
        radGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(neb.x, neb.y, neb.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Stardust Crystals
      st.stardust.forEach((star) => {
        if (star.collected) return;
        ctx.fillStyle = star.color;
        ctx.shadowColor = star.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(star.x, star.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Inner white spark
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(star.x, star.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      // Planetary Nodes
      st.nodes.forEach((node) => {
        const isCurrent = node.id === st.currentAnchorId;

        // Animated Gravity Well Ring
        const pulse = Math.sin(node.pulsePhase) * 4;
        ctx.strokeStyle = `${node.color}40`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.gravityRadius + pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Outer Atmosphere Glow
        const glowGrad = ctx.createRadialGradient(
          node.x,
          node.y,
          node.radius * 0.8,
          node.x,
          node.y,
          node.radius * 1.8
        );
        glowGrad.addColorStop(0, `${node.color}50`);
        glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Planetary Rings (for Gas Giants)
        if (node.hasRings) {
          ctx.strokeStyle = `${node.color}90`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(node.x, node.y, node.radius * 1.7, node.radius * 0.5, node.ringAngle || 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Planet Body with 3D spherical shading
        const sphereGrad = ctx.createRadialGradient(
          node.x - node.radius * 0.35,
          node.y - node.radius * 0.35,
          node.radius * 0.1,
          node.x,
          node.y,
          node.radius
        );
        sphereGrad.addColorStop(0, '#FFFFFF');
        sphereGrad.addColorStop(0.3, node.color);
        sphereGrad.addColorStop(1, node.glowColor);

        ctx.fillStyle = sphereGrad;
        ctx.shadowColor = node.color;
        ctx.shadowBlur = node.isWarpGate ? 24 : 14;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Warp Gate Event Horizon Swirl
        if (node.isWarpGate) {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius * 0.5, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Label
        ctx.fillStyle = isCurrent ? '#38BDF8' : '#A1A1AA';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y + node.radius + 15);
      });

      // Asteroids
      st.asteroids.forEach((ast) => {
        ctx.fillStyle = '#E4E4E7';
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(ast.x, ast.y, ast.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Target Lock-On Beam (When tethered)
      if (st.isTethered) {
        const tangentAngle = st.orbitAngle + Math.PI / 2;
        const lineLen = st.isAimingAtNext ? 180 : 90;
        const tx = st.probeX + Math.cos(tangentAngle) * lineLen;
        const ty = st.probeY + Math.sin(tangentAngle) * lineLen;

        ctx.strokeStyle = st.isAimingAtNext ? '#34D399' : 'rgba(250, 204, 21, 0.45)';
        ctx.lineWidth = st.isAimingAtNext ? 3.5 : 2;
        ctx.shadowColor = st.isAimingAtNext ? '#34D399' : '#FACC15';
        ctx.shadowBlur = st.isAimingAtNext ? 14 : 0;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(st.probeX, st.probeY);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        // Predictive Target Ring at beam end
        if (st.isAimingAtNext) {
          ctx.strokeStyle = '#34D399';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(tx, ty, 10, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Probe Trail
      st.trail.forEach((t) => {
        ctx.fillStyle = `rgba(56, 189, 248, ${t.alpha})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Probe Energy Core
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = st.isAimingAtNext ? '#34D399' : '#38BDF8';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(st.probeX, st.probeY, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      const effectFrameScale = isPausedRef.current ? 0 : Math.max(0, Math.min(deltaSec, 0.05) * 60);

      // Draw Particles
      for (let i = st.particles.length - 1; i >= 0; i--) {
        const p = st.particles[i];
        p.x += p.vx * effectFrameScale;
        p.y += p.vy * effectFrameScale;
        p.life -= 0.03 * effectFrameScale;
        if (p.life <= 0) {
          st.particles.splice(i, 1);
          continue;
        }
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // Popups
      for (let i = st.popups.length - 1; i >= 0; i--) {
        const popup = st.popups[i];
        popup.y -= 1.0 * effectFrameScale;
        popup.life -= 0.02 * effectFrameScale;
        if (popup.life <= 0) {
          st.popups.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, popup.life);
        ctx.fillStyle = popup.color;
        ctx.font = `bold ${Math.round(12 * (popup.scale || 1.0))}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(popup.text, popup.x, popup.y);
        ctx.globalAlpha = 1.0;
      }

      ctx.restore();
      ctx.restore();

      return st.isAlive;
    },
  });

  return (
    <div className="relative w-full h-full min-h-0 flex flex-col bg-[#060814] overflow-hidden select-none">
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
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono-arcade text-xs text-amber-400 font-bold">
              {combo}x SLINGSHOT
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#18181B]/90 border border-zinc-800 px-3 py-1.5 rounded-lg backdrop-blur-md">
            <span className="font-mono-arcade text-xs text-cyan-300 font-bold">
              SECTOR {currentSector}: {sectorName}
            </span>
          </div>
          <div className="bg-[#18181B]/90 border border-zinc-800 px-3.5 py-1.5 rounded-lg backdrop-blur-md">
            <span className="font-mono-arcade text-sm text-cyan-400 font-bold">
              {score.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Target Aiming Indicator / Lock-On Banner */}
      <div className="absolute top-14 left-4 right-4 flex justify-center z-10 pointer-events-none">
        <div
          className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border backdrop-blur-md transition-all duration-150 ${
            isLockedOn
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-lg shadow-emerald-500/30 scale-105'
              : 'bg-zinc-900/60 border-zinc-800 text-zinc-400'
          }`}
        >
          <Target className={`w-4 h-4 ${isLockedOn ? 'text-emerald-400 animate-pulse' : 'text-zinc-500'}`} />
          <span className="font-mono-arcade text-xs font-bold">
            {isLockedOn ? 'PERFECT LOCK-ON! TAP TO SLINGSHOT' : 'WAIT FOR TRAJECTORY ALIGNMENT'}
          </span>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div className="flex-1 relative w-full h-full">
        <canvas ref={canvasRef} className="w-full h-full block cursor-pointer" />
      </div>

      {/* Bottom Tap Action Prompt */}
      <div className="absolute bottom-3 left-4 right-4 z-10 pointer-events-auto">
        <button
          type="button"
          onClick={launchProbe}
          className={`w-full py-4 rounded-xl font-mono-arcade text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 select-none backdrop-blur-md ${
            isLockedOn
              ? 'bg-emerald-600/90 hover:bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/40 active:scale-[0.98]'
              : 'bg-cyan-600/90 hover:bg-cyan-500 text-white border-cyan-400 shadow-lg shadow-cyan-500/30 active:scale-[0.98]'
          }`}
        >
          <Zap className="w-4 h-4" />
          {isLockedOn ? 'LAUNCH PERFECT SLINGSHOT [TAP / SPACE]' : 'RELEASE ORBIT [TAP / SPACE]'}
        </button>
      </div>
    </div>
  );
};
