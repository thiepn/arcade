import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { haptics } from '../lib/haptics';
import { Flame, Zap, Shield, Sparkles, Gauge, AlertTriangle } from 'lucide-react';
import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';

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

interface RoadSegment {
  y: number;
  curve: number;
  hasGate?: boolean;
  gateSide?: 'left' | 'right' | 'center';
  gatePassed?: boolean;
  hasHazard?: boolean;
  hazardX?: number;
  hazardType?: 'oil' | 'barrier';
  hasNitro?: boolean;
  nitroX?: number;
  nitroCollected?: boolean;
  hasRival?: boolean;
  rivalX?: number;
  rivalSpeed?: number;
  rivalColor?: string;
  rivalPassed?: boolean;
}

interface StreetLight {
  y: number;
  side: -1 | 1;
}

export const DriftGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [multiplier, setMultiplier] = useState(1);
  const [driftTier, setDriftTier] = useState<string>('NORMAL');
  const [nitroEnergy, setNitroEnergy] = useState(70); // 0..100
  const [isBoosting, setIsBoosting] = useState(false);
  const [steerLeft, setSteerLeft] = useState(false);
  const [steerRight, setSteerRight] = useState(false);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(160);

  const isPausedRef = useRef(isPaused);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const ROAD_WIDTH = 300;

  const gameStateRef = useRef({
    score: 0,
    lives: 3,
    multiplier: 1,
    isAlive: true,
    needsRedraw: true,
    // Car State
    carX: 0,
    carY: 0,
    carVx: 0,
    carAngle: 0, // Visual drift tilt
    isDrifting: false,
    driftTimer: 0,
    consecutiveDriftTime: 0,
    speed: 6.8,
    maxSpeed: 9.2,
    nitro: 70,
    isBoosting: false,
    invulnerableTime: 0,
    screenShake: 0,
    // Track State
    trackDistance: 0,
    roadCurve: 0,
    targetCurve: 0,
    curveChangeTimer: 0,
    segments: [] as RoadSegment[],
    streetlights: [] as StreetLight[],
    skidmarks: [] as { x1: number; y1: number; x2: number; y2: number; alpha: number; color: string }[],
    particles: [] as Particle[],
    speedlines: [] as { x: number; y: number; len: number; speed: number; alpha: number }[],
    popups: [] as ScorePopup[],
    steerInput: 0,
    soundCooldown: 0,
    spawnTimer: 0,
  });

  const setSafeTimeout = useSafeTimeout();

  const triggerNitro = useCallback(() => {
    const state = gameStateRef.current;
    if (state.nitro >= 25 && !state.isBoosting && state.isAlive) {
      state.nitro -= 25;
      setNitroEnergy(state.nitro);
      state.isBoosting = true;
      setIsBoosting(true);
      state.screenShake = 10;
      haptics.heavy();
      if (soundEnabled) sounds.playNitroRoar();

      // Launch nitro flame burst particles
      for (let i = 0; i < 30; i++) {
        const ang = Math.PI / 2 + (Math.random() - 0.5) * 0.9;
        const spd = 6 + Math.random() * 8;
        state.particles.push({
          x: state.carX + (Math.random() - 0.5) * 18,
          y: state.carY + 22,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0.9,
          maxLife: 0.9,
          color: Math.random() > 0.4 ? '#38BDF8' : '#EC4899',
          size: 3.5 + Math.random() * 3.5,
        });
      }

      setSafeTimeout(() => {
        state.isBoosting = false;
        setIsBoosting(false);
      }, 1800);
    }
  }, [soundEnabled, setSafeTimeout]);

  const addScorePopup = useCallback((text: string, x: number, y: number, color = '#FACC15', scale = 1.0) => {
    gameStateRef.current.popups.push({
      id: Math.random(),
      text,
      x,
      y,
      color,
      life: 1.0,
      scale,
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Input Handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        gameStateRef.current.steerInput = -1;
        setSteerLeft(true);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        gameStateRef.current.steerInput = 1;
        setSteerRight(true);
      } else if (e.key === ' ' || e.key === 'Shift' || e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        e.preventDefault();
        triggerNitro();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if ((e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') && gameStateRef.current.steerInput === -1) {
        gameStateRef.current.steerInput = 0;
        setSteerLeft(false);
      } else if ((e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') && gameStateRef.current.steerInput === 1) {
        gameStateRef.current.steerInput = 0;
        setSteerRight(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [triggerNitro]);

  useGameLoop({
    canvasRef,
    isPaused,
    onResize: (w, h) => {
      const state = gameStateRef.current;
      state.carX = w / 2;
      state.carY = h * 0.76;
      if (state.streetlights.length === 0) {
        for (let y = -200; y < h + 400; y += 120) {
          state.streetlights.push({ y, side: -1 });
          state.streetlights.push({ y: y + 60, side: 1 });
        }
      }
      if (state.speedlines.length === 0) {
        for (let i = 0; i < 25; i++) {
          state.speedlines.push({
            x: Math.random() * w,
            y: Math.random() * h,
            len: 20 + Math.random() * 40,
            speed: 8 + Math.random() * 8,
            alpha: 0.2 + Math.random() * 0.4,
          });
        }
      }
    },
    onUpdate: (ctx, dt, w, h) => {
      const st = gameStateRef.current;
      
      ctx.save();
      const roadCenterX = w / 2;

      if (!isPausedRef.current && st.isAlive) {
        if (st.invulnerableTime > 0) st.invulnerableTime--;
        if (st.screenShake > 0) st.screenShake *= 0.88;
        if (st.soundCooldown > 0) st.soundCooldown--;

        // Speed calculation
        const baseSpeed = st.isBoosting ? st.maxSpeed * 1.55 : st.speed;
        const currentSpeed = baseSpeed;
        st.trackDistance += currentSpeed;

        const kmh = Math.round((currentSpeed / st.speed) * 160 + (st.isDrifting ? 15 : 0));
        setCurrentSpeedKmh(kmh);

        // Passive Nitro generation over time
        if (!st.isBoosting && st.nitro < 100) {
          st.nitro = Math.min(100, st.nitro + 0.06);
          setNitroEnergy(st.nitro);
        }

        // Road Curvature Animation
        st.curveChangeTimer++;
        if (st.curveChangeTimer > 120) {
          st.curveChangeTimer = 0;
          st.targetCurve = (Math.random() - 0.5) * 2.2;
        }
        st.roadCurve += (st.targetCurve - st.roadCurve) * 0.025;

        // --- PRECISE DRIFT DYNAMICS ---
        const lateralAcc = 0.65;
        const maxLateralVel = 7.0;

        if (st.steerInput !== 0) {
          st.carVx += st.steerInput * lateralAcc;
          st.carVx = Math.max(-maxLateralVel, Math.min(maxLateralVel, st.carVx));
          // Car tilt and drift angle
          st.carAngle += (st.steerInput * 0.38 - st.carAngle) * 0.22;
          st.isDrifting = Math.abs(st.carVx) > 3.2;
        } else {
          // Centering drag
          st.carVx *= 0.86;
          st.carAngle *= 0.86;
          st.isDrifting = false;
        }

        st.carX += st.carVx;

        // Road Boundaries
        const minX = roadCenterX - ROAD_WIDTH / 2 + 20;
        const maxX = roadCenterX + ROAD_WIDTH / 2 - 20;

        if (st.carX < minX) {
          st.carX = minX;
          st.carVx = 0;
          if (st.invulnerableTime <= 0) {
            st.lives--;
            setLives(st.lives);
            st.invulnerableTime = 60;
            st.screenShake = 14;
            haptics.impact();
            if (soundEnabled) sounds.playExplosion();
            addScorePopup('GUARDRAIL IMPACT! -1 LIFE', st.carX, st.carY - 30, '#EF4444', 1.2);
            if (st.lives <= 0) {
              st.isAlive = false;
              haptics.gameOver();
              if (soundEnabled) sounds.playGameOver();
              onGameOver(st.score);
            }
          }
        } else if (st.carX > maxX) {
          st.carX = maxX;
          st.carVx = 0;
          if (st.invulnerableTime <= 0) {
            st.lives--;
            setLives(st.lives);
            st.invulnerableTime = 60;
            st.screenShake = 14;
            haptics.impact();
            if (soundEnabled) sounds.playExplosion();
            addScorePopup('GUARDRAIL IMPACT! -1 LIFE', st.carX, st.carY - 30, '#EF4444', 1.2);
            if (st.lives <= 0) {
              st.isAlive = false;
              haptics.gameOver();
              if (soundEnabled) sounds.playGameOver();
              onGameOver(st.score);
            }
          }
        }

        // Drifting effects & score multipliers
        if (st.isDrifting || st.isBoosting) {
          st.consecutiveDriftTime++;

          // Dual skidmarks
          const skidAngle = st.carAngle;
          const leftWheelOffset = -10;
          const rightWheelOffset = 10;
          const cosA = Math.cos(skidAngle);
          const sinA = Math.sin(skidAngle);

          const lx = st.carX + leftWheelOffset * cosA - 16 * sinA;
          const ly = st.carY + leftWheelOffset * sinA + 16 * cosA;
          const rx = st.carX + rightWheelOffset * cosA - 16 * sinA;
          const ry = st.carY + rightWheelOffset * sinA + 16 * cosA;

          st.skidmarks.push({
            x1: lx,
            y1: ly,
            x2: rx,
            y2: ry,
            alpha: 0.7,
            color: st.isBoosting ? '#38BDF8' : '#F43F5E',
          });

          // Play drift sound periodically
          if (soundEnabled && st.soundCooldown <= 0 && st.isDrifting) {
            sounds.playDriftSkid();
            st.soundCooldown = 18;
          }

          // Score accumulation
          const addedDrift = Math.floor((st.isBoosting ? 20 : 10) * st.multiplier);
          st.score += addedDrift;
          onScoreUpdate(st.score);
          setScore(st.score);

          // Extra Nitro generation while drifting
          st.nitro = Math.min(100, st.nitro + 0.2);
          setNitroEnergy(st.nitro);

          // Multiplier progression & tiers
          st.driftTimer++;
          if (st.driftTimer > 30 && st.multiplier < 6) {
            st.multiplier++;
            st.driftTimer = 0;
            setMultiplier(st.multiplier);

            let tierName = 'GOOD DRIFT!';
            let tierColor = '#38BDF8';
            if (st.multiplier === 3) {
              tierName = 'GREAT DRIFT!';
              tierColor = '#34D399';
            } else if (st.multiplier === 4) {
              tierName = 'S-TIER DRIFT!';
              tierColor = '#FACC15';
            } else if (st.multiplier >= 5) {
              tierName = 'HYPER DRIFT!';
              tierColor = '#EC4899';
            }
            setDriftTier(tierName);

            if (soundEnabled) sounds.playVictory();
            addScorePopup(`${st.multiplier}x ${tierName}`, st.carX, st.carY - 35, tierColor, 1.25);
          }

          // Glowing sparks & tire smoke particles
          if (Math.random() < 0.75) {
            st.particles.push({
              x: (Math.random() > 0.5 ? lx : rx) + (Math.random() - 0.5) * 6,
              y: (Math.random() > 0.5 ? ly : ry) + 4,
              vx: (Math.random() - 0.5) * 3 - st.carVx * 0.25,
              vy: 2 + Math.random() * 3,
              life: 0.8,
              maxLife: 0.8,
              color: st.isBoosting ? '#38BDF8' : Math.random() > 0.5 ? '#F43F5E' : '#FDE047',
              size: 2.5 + Math.random() * 3.5,
            });
          }
        } else {
          st.consecutiveDriftTime = 0;
          st.driftTimer = 0;
          if (st.multiplier > 1 && Math.random() < 0.02) {
            st.multiplier = 1;
            setMultiplier(1);
            setDriftTier('NORMAL');
          }
        }

        // --- SPAWN APEX GATES, NITRO CELLS, HAZARDS & RIVALS ---
        st.spawnTimer++;
        if (st.spawnTimer > 48) {
          st.spawnTimer = 0;
          const rand = Math.random();

          if (rand < 0.35) {
            // Apex Drift Gate
            const side = Math.random() > 0.5 ? 'left' : 'right';
            st.segments.push({
              y: -80,
              curve: st.roadCurve,
              hasGate: true,
              gateSide: side,
              gatePassed: false,
            });
          } else if (rand < 0.6) {
            // Nitro Energy Cell
            const nx = roadCenterX + (Math.random() - 0.5) * (ROAD_WIDTH - 80);
            st.segments.push({
              y: -80,
              curve: st.roadCurve,
              hasNitro: true,
              nitroX: nx,
              nitroCollected: false,
            });
          } else if (rand < 0.82) {
            // Rival Traffic Car
            const rx = roadCenterX + (Math.random() - 0.5) * (ROAD_WIDTH - 90);
            const rivalColors = ['#8B5CF6', '#10B981', '#F59E0B', '#6366F1'];
            st.segments.push({
              y: -100,
              curve: st.roadCurve,
              hasRival: true,
              rivalX: rx,
              rivalSpeed: currentSpeed * (0.45 + Math.random() * 0.25),
              rivalColor: rivalColors[Math.floor(Math.random() * rivalColors.length)],
              rivalPassed: false,
            });
          } else {
            // Hazard (Oil slick or EMP barrier)
            const hx = roadCenterX + (Math.random() - 0.5) * (ROAD_WIDTH - 80);
            st.segments.push({
              y: -80,
              curve: st.roadCurve,
              hasHazard: true,
              hazardX: hx,
              hazardType: Math.random() > 0.5 ? 'oil' : 'barrier',
            });
          }
        }

        // --- UPDATE TRACK SEGMENTS & COLLISIONS ---
        for (let i = st.segments.length - 1; i >= 0; i--) {
          const seg = st.segments[i];

          // Move down with road speed (rivals move relative to player)
          if (seg.hasRival && seg.rivalSpeed !== undefined) {
            seg.y += currentSpeed - seg.rivalSpeed;
          } else {
            seg.y += currentSpeed;
          }

          // Apex Gate Passing
          if (seg.hasGate && !seg.gatePassed && Math.abs(seg.y - st.carY) < 30) {
            const gateX =
              seg.gateSide === 'left'
                ? roadCenterX - ROAD_WIDTH / 2 + 40
                : roadCenterX + ROAD_WIDTH / 2 - 40;

            if (Math.abs(st.carX - gateX) < 50) {
              seg.gatePassed = true;
              const bonus = 450 * st.multiplier;
              st.score += bonus;
              onScoreUpdate(st.score);
              setScore(st.score);
              addScorePopup(`APEX HIT! +${bonus}`, gateX, seg.y - 15, '#34D399', 1.2);
              if (soundEnabled) sounds.playVictory();

              // Boost Nitro
              st.nitro = Math.min(100, st.nitro + 25);
              setNitroEnergy(st.nitro);
            }
          }

          // Nitro Cell Attraction & Collision
          if (seg.hasNitro && !seg.nitroCollected && seg.nitroX !== undefined) {
            const dist = Math.hypot(seg.nitroX - st.carX, seg.y - st.carY);

            // Magnetic pull if drifting close
            if (dist < 110 && st.isDrifting) {
              seg.nitroX += (st.carX - seg.nitroX) * 0.15;
            }

            if (dist < 34) {
              seg.nitroCollected = true;
              st.nitro = Math.min(100, st.nitro + 35);
              setNitroEnergy(st.nitro);
              st.score += 250 * st.multiplier;
              onScoreUpdate(st.score);
              setScore(st.score);
              addScorePopup('+NITRO CELL!', st.carX, st.carY - 30, '#38BDF8');
              if (soundEnabled) sounds.playPop();
            }
          }

          // Rival Overtake & Collision
          if (seg.hasRival && seg.rivalX !== undefined) {
            const dist = Math.hypot(seg.rivalX - st.carX, seg.y - st.carY);

            // Close Overtake Bonus
            if (!seg.rivalPassed && seg.y > st.carY + 20) {
              seg.rivalPassed = true;
              if (Math.abs(seg.rivalX - st.carX) < 60) {
                const bonus = 500 * st.multiplier;
                st.score += bonus;
                onScoreUpdate(st.score);
                setScore(st.score);
                addScorePopup(`CLOSE PASS! +${bonus}`, st.carX, st.carY - 25, '#FACC15');
                if (soundEnabled) sounds.playSuccess();
              }
            }

            // Direct Collision
            if (dist < 32 && st.invulnerableTime <= 0) {
              st.lives--;
              setLives(st.lives);
              st.invulnerableTime = 65;
              st.screenShake = 16;
              addScorePopup('RIVAL CRASH! -1 LIFE', st.carX, st.carY - 30, '#EF4444', 1.2);
              if (soundEnabled) sounds.playExplosion();

              if (st.lives <= 0) {
                st.isAlive = false;
                if (soundEnabled) sounds.playGameOver();
                onGameOver(st.score);
              }
            }
          }

          // Hazard Collision
          if (seg.hasHazard && seg.hazardX !== undefined && st.invulnerableTime <= 0) {
            if (Math.hypot(seg.hazardX - st.carX, seg.y - st.carY) < 30) {
              if (seg.hazardType === 'oil') {
                // Spin out
                st.carVx = (Math.random() > 0.5 ? 1 : -1) * 6;
                st.carAngle = (Math.random() - 0.5) * 0.9;
                st.screenShake = 10;
                addScorePopup('OIL SLICK SPIN!', st.carX, st.carY - 25, '#F59E0B');
                if (soundEnabled) sounds.playWhoosh();
              } else {
                // Electric barrier hit
                st.lives--;
                setLives(st.lives);
                st.invulnerableTime = 65;
                st.screenShake = 16;
                addScorePopup('EMP BARRIER! -1 LIFE', st.carX, st.carY - 30, '#EF4444', 1.2);
                if (soundEnabled) sounds.playExplosion();

                if (st.lives <= 0) {
                  st.isAlive = false;
                  if (soundEnabled) sounds.playGameOver();
                  onGameOver(st.score);
                }
              }
            }
          }

          // Cull old segments
          if (seg.y > h + 150) {
            st.segments.splice(i, 1);
          }
        }

        // Streetlights movement
        st.streetlights.forEach((sl) => {
          sl.y += currentSpeed;
          if (sl.y > h + 100) sl.y = -100;
        });

        // Speedlines animation
        st.speedlines.forEach((sl) => {
          sl.y += currentSpeed * 1.5;
          if (sl.y > h) {
            sl.y = -sl.len;
            sl.x = Math.random() * w;
          }
        });

        // Skid marks fade
        st.skidmarks.forEach((s) => (s.alpha -= 0.012));
        st.skidmarks = st.skidmarks.filter((s) => s.alpha > 0.02);
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

      // Deep Neon Cyberpunk Backdrop
      const gradBg = ctx.createLinearGradient(0, 0, 0, h);
      gradBg.addColorStop(0, '#05050A');
      gradBg.addColorStop(0.5, '#0B0A1A');
      gradBg.addColorStop(1, '#110D24');
      ctx.fillStyle = gradBg;
      ctx.fillRect(0, 0, w, h);

      // Neon Skyline Silhouettes in background
      ctx.fillStyle = '#0F0E26';
      for (let bx = 0; bx < w; bx += 45) {
        const bHeight = 70 + Math.sin(bx * 0.05) * 35;
        ctx.fillRect(bx, 0, 40, bHeight);
        // Window dots
        ctx.fillStyle = 'rgba(236, 72, 153, 0.25)';
        for (let wy = 15; wy < bHeight - 10; wy += 14) {
          ctx.fillRect(bx + 8, wy, 4, 6);
          ctx.fillRect(bx + 24, wy, 4, 6);
        }
        ctx.fillStyle = '#0F0E26';
      }

      // Perspective Grid Lines
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 35) {
        ctx.beginPath();
        ctx.moveTo(x, 80);
        ctx.lineTo(x + (x - roadCenterX) * 0.4, h);
        ctx.stroke();
      }

      // Speed lines during nitro / high speed
      if (st.isBoosting || st.isDrifting) {
        ctx.strokeStyle = st.isBoosting ? 'rgba(56, 189, 248, 0.4)' : 'rgba(244, 63, 94, 0.25)';
        ctx.lineWidth = st.isBoosting ? 2 : 1;
        st.speedlines.forEach((sl) => {
          ctx.beginPath();
          ctx.moveTo(sl.x, sl.y);
          ctx.lineTo(sl.x, sl.y + sl.len);
          ctx.stroke();
        });
      }

      // --- DRAW HIGHWAY ROAD ---
      const roadLeft = roadCenterX - ROAD_WIDTH / 2;
      const roadRight = roadCenterX + ROAD_WIDTH / 2;

      // Road Asphalt with subtle dark gradient
      const roadGrad = ctx.createLinearGradient(roadLeft, 0, roadRight, 0);
      roadGrad.addColorStop(0, '#16161D');
      roadGrad.addColorStop(0.5, '#1C1C24');
      roadGrad.addColorStop(1, '#16161D');
      ctx.fillStyle = roadGrad;
      ctx.fillRect(roadLeft, 0, ROAD_WIDTH, h);

      // Outer Neon Guardrails with glowing chevrons
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#F43F5E';
      ctx.shadowColor = '#F43F5E';
      ctx.shadowBlur = 14;

      // Left Guardrail
      ctx.beginPath();
      ctx.moveTo(roadLeft, 0);
      ctx.lineTo(roadLeft, h);
      ctx.stroke();

      // Right Guardrail
      ctx.beginPath();
      ctx.moveTo(roadRight, 0);
      ctx.lineTo(roadRight, h);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Guardrail Streetlights zooming past
      st.streetlights.forEach((sl) => {
        const lx = sl.side === -1 ? roadLeft - 8 : roadRight + 8;
        ctx.fillStyle = '#38BDF8';
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(lx, sl.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Center Dashed Lane Markers (Scrolling with speed)
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
      ctx.setLineDash([24, 20]);
      ctx.lineDashOffset = -st.trackDistance;
      ctx.beginPath();
      ctx.moveTo(roadCenterX, 0);
      ctx.lineTo(roadCenterX, h);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Skid Marks
      st.skidmarks.forEach((s) => {
        ctx.fillStyle = s.color === '#38BDF8' ? `rgba(56, 189, 248, ${s.alpha})` : `rgba(244, 63, 94, ${s.alpha})`;
        ctx.fillRect(s.x1 - 3, s.y1, 6, 8);
        ctx.fillRect(s.x2 - 3, s.y2, 6, 8);
      });

      // Draw Track Items, Gates, Rivals & Hazards
      st.segments.forEach((seg) => {
        // Apex Gate (Holographic Arch)
        if (seg.hasGate && !seg.gatePassed) {
          const gx =
            seg.gateSide === 'left'
              ? roadLeft + 40
              : roadRight - 40;

          ctx.strokeStyle = '#34D399';
          ctx.lineWidth = 3.5;
          ctx.shadowColor = '#34D399';
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(gx, seg.y, 20, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Inner rotating apex core
          ctx.fillStyle = '#34D399';
          ctx.beginPath();
          ctx.arc(gx, seg.y, 6, 0, Math.PI * 2);
          ctx.fill();

          // Apex label
          ctx.fillStyle = '#34D399';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('APEX', gx, seg.y + 4);
        }

        // Nitro Capsule
        if (seg.hasNitro && !seg.nitroCollected && seg.nitroX !== undefined) {
          ctx.fillStyle = '#38BDF8';
          ctx.shadowColor = '#38BDF8';
          ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.arc(seg.nitroX, seg.y, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Glowing energy core
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(seg.nitroX, seg.y, 5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Rival Traffic Car
        if (seg.hasRival && seg.rivalX !== undefined) {
          ctx.save();
          ctx.translate(seg.rivalX, seg.y);

          // Underglow
          ctx.fillStyle = seg.rivalColor || '#8B5CF6';
          ctx.shadowColor = seg.rivalColor || '#8B5CF6';
          ctx.shadowBlur = 12;
          ctx.fillRect(-12, -18, 24, 36);
          ctx.shadowBlur = 0;

          // Body
          ctx.fillStyle = '#27272A';
          ctx.beginPath();
          ctx.roundRect(-12, -20, 24, 40, 4);
          ctx.fill();

          // Windshield
          ctx.fillStyle = '#06B6D4';
          ctx.beginPath();
          ctx.roundRect(-7, -10, 14, 14, 2);
          ctx.fill();

          // Rear Lights
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(-10, 17, 5, 3);
          ctx.fillRect(5, 17, 5, 3);

          ctx.restore();
        }

        // Hazard
        if (seg.hasHazard && seg.hazardX !== undefined) {
          if (seg.hazardType === 'oil') {
            ctx.fillStyle = '#3B240B';
            ctx.beginPath();
            ctx.ellipse(seg.hazardX, seg.y, 22, 11, 0, 0, Math.PI * 2);
            ctx.fill();

            // Shimmer highlight
            ctx.strokeStyle = '#F59E0B';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(seg.hazardX, seg.y, 16, 7, 0, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            // EMP Barrier
            ctx.strokeStyle = '#EF4444';
            ctx.lineWidth = 3.5;
            ctx.shadowColor = '#EF4444';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(seg.hazardX - 20, seg.y);
            ctx.lineTo(seg.hazardX + 20, seg.y);
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Warning Icon
            ctx.fillStyle = '#EF4444';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('⚡ EMP', seg.hazardX, seg.y - 6);
          }
        }
      });

      // Draw Particles
      for (let i = st.particles.length - 1; i >= 0; i--) {
        const p = st.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03;
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

      // Draw Cyber Drift Car
      const isInvul = st.invulnerableTime > 0 && Math.floor(st.invulnerableTime / 4) % 2 === 0;
      if (!isInvul) {
        ctx.save();
        ctx.translate(st.carX, st.carY);
        ctx.rotate(st.carAngle);

        // Headlight Beams illuminating the road ahead
        const beamGrad = ctx.createLinearGradient(0, -22, 0, -90);
        beamGrad.addColorStop(0, 'rgba(253, 224, 71, 0.45)');
        beamGrad.addColorStop(1, 'rgba(253, 224, 71, 0.0)');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(-11, -22);
        ctx.lineTo(-24, -90);
        ctx.lineTo(24, -90);
        ctx.lineTo(11, -22);
        ctx.closePath();
        ctx.fill();

        // Underglow Neon
        ctx.shadowColor = st.isBoosting ? '#38BDF8' : '#F43F5E';
        ctx.shadowBlur = 24;
        ctx.fillStyle = st.isBoosting ? '#38BDF8' : '#F43F5E';
        ctx.fillRect(-13, -20, 26, 40);
        ctx.shadowBlur = 0;

        // Chassis Body
        ctx.fillStyle = '#18181B';
        ctx.beginPath();
        ctx.roundRect(-14, -23, 28, 46, 5);
        ctx.fill();

        // Aerodynamic Hood Strip
        ctx.fillStyle = st.isBoosting ? '#38BDF8' : '#F43F5E';
        ctx.fillRect(-2, -22, 4, 14);

        // Cockpit Windshield
        ctx.fillStyle = '#06B6D4';
        ctx.beginPath();
        ctx.roundRect(-9, -12, 18, 16, 3);
        ctx.fill();

        // Rear Spoiler Wing
        ctx.fillStyle = '#3F3F46';
        ctx.fillRect(-15, 20, 30, 4);

        // Tail Lights & Exhaust Flame Ports
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(-12, 20, 6, 3);
        ctx.fillRect(6, 20, 6, 3);

        // Headlights
        ctx.fillStyle = '#FDE047';
        ctx.fillRect(-12, -23, 6, 3);
        ctx.fillRect(6, -23, 6, 3);

        // Invulnerability Hex Shield Bubble
        if (st.invulnerableTime > 0) {
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#38BDF8';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(0, 0, 32, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        ctx.restore();
      }

      // Draw Score Popups
      for (let i = st.popups.length - 1; i >= 0; i--) {
        const popup = st.popups[i];
        popup.y -= 1.0;
        popup.life -= 0.02;
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
      return st.isAlive;
    },
  });

  const handleSteerStart = (dir: -1 | 1) => {
    haptics.light();
    gameStateRef.current.steerInput = dir;
    if (dir === -1) setSteerLeft(true);
    if (dir === 1) setSteerRight(true);
  };

  const handleSteerEnd = () => {
    gameStateRef.current.steerInput = 0;
    setSteerLeft(false);
    setSteerRight(false);
  };

  return (
    <div className="relative w-full h-full min-h-[420px] flex flex-col bg-[#09090B] overflow-hidden select-none">
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
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono-arcade text-xs text-cyan-400 font-bold">
              {multiplier}x {driftTier}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Speedometer */}
          <div className="flex items-center gap-1 bg-[#18181B]/90 border border-zinc-800 px-2.5 py-1.5 rounded-lg backdrop-blur-md">
            <Gauge className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-mono-arcade text-xs text-zinc-200 font-bold">
              {currentSpeedKmh} KM/H
            </span>
          </div>

          {/* Nitro Energy Bar */}
          <div className="flex items-center gap-1.5 bg-[#18181B]/90 border border-zinc-800 px-3 py-1.5 rounded-lg backdrop-blur-md">
            <Flame className="w-3.5 h-3.5 text-cyan-400" />
            <div className="w-16 h-2.5 bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-zinc-700">
              <div
                className={`h-full rounded-full transition-all duration-150 ${
                  nitroEnergy >= 25 ? 'bg-cyan-400 shadow-sm shadow-cyan-400/50' : 'bg-zinc-600'
                }`}
                style={{ width: `${nitroEnergy}%` }}
              />
            </div>
          </div>

          <div className="bg-[#18181B]/90 border border-zinc-800 px-3.5 py-1.5 rounded-lg backdrop-blur-md">
            <span className="font-mono-arcade text-sm text-rose-400 font-bold">
              {score.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div className="flex-1 relative w-full h-full">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* Responsive Touch Steer Paddles & Nitro */}
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between z-10 pointer-events-auto">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onPointerDown={() => handleSteerStart(-1)}
            onPointerUp={handleSteerEnd}
            onPointerLeave={handleSteerEnd}
            className={`w-16 h-14 rounded-xl border font-mono-arcade text-base font-bold flex items-center justify-center select-none transition-all active:scale-95 cursor-pointer ${
              steerLeft
                ? 'bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/40'
                : 'bg-[#18181B]/90 hover:bg-[#27272A] text-zinc-300 border-zinc-700'
            }`}
          >
            ◀ STEER
          </button>
          <button
            type="button"
            onPointerDown={() => handleSteerStart(1)}
            onPointerUp={handleSteerEnd}
            onPointerLeave={handleSteerEnd}
            className={`w-16 h-14 rounded-xl border font-mono-arcade text-base font-bold flex items-center justify-center select-none transition-all active:scale-95 cursor-pointer ${
              steerRight
                ? 'bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/40'
                : 'bg-[#18181B]/90 hover:bg-[#27272A] text-zinc-300 border-zinc-700'
            }`}
          >
            STEER ▶
          </button>
        </div>

        <button
          type="button"
          onClick={triggerNitro}
          disabled={nitroEnergy < 25 || isBoosting}
          className={`px-6 py-4 rounded-xl font-mono-arcade text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none backdrop-blur-md ${
            nitroEnergy >= 25 && !isBoosting
              ? 'bg-cyan-600/90 hover:bg-cyan-500 text-white border-cyan-400 shadow-lg shadow-cyan-500/40 active:scale-95'
              : 'bg-zinc-800/60 text-zinc-500 border-zinc-700 cursor-not-allowed'
          }`}
        >
          <Zap className="w-4 h-4" />
          {isBoosting ? 'BOOST ACTIVE!' : 'NITRO BOOST [SPACE]'}
        </button>
      </div>
    </div>
  );
};
