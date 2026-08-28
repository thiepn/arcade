import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { Sparkles, Bomb, Zap, Snowflake, Shield, AlertTriangle, BatteryCharging } from 'lucide-react';
import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';
import { clamp, rescalePoint, rescaleVelocity } from '../lib/gameCoordinates';

interface ParticleNode {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  glow: string;
  type: 'standard' | 'shielded' | 'dampener' | 'evasive' | 'supernova' | 'multiplier' | 'extra_charge';
  state: 'moving' | 'frozen' | 'exploding' | 'dead';
  shieldHp: number;
  maxShieldHp: number;
  explosionRadius: number;
  maxExplosionRadius: number;
  explosionDuration: number;
  detonatorType?: 'plasma' | 'tesla' | 'cryo';
}

interface VortexField {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  pullStrength: number;
}

interface LightningArc {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  life: number;
}

interface Spark {
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
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

type DetonatorTool = 'plasma' | 'tesla' | 'cryo';

export const ChainGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const [wave, setWave] = useState(1);
  const [chainCount, setChainCount] = useState(0);
  const [targetMin, setTargetMin] = useState(10);
  const [chargesLeft, setChargesLeft] = useState(3);
  const [totalOrbs, setTotalOrbs] = useState(20);
  const [selectedTool, setSelectedTool] = useState<DetonatorTool>('plasma');
  const [comboBanner, setComboBanner] = useState<string | null>(null);

  const gameStateRef = useRef({
    particles: [] as ParticleNode[],
    vortexes: [] as VortexField[],
    lightningArcs: [] as LightningArc[],
    sparks: [] as Spark[],
    floatingTexts: [] as FloatingText[],
    chargesLeft: 3,
    score: 0,
    chainCount: 0,
    targetMin: 10,
    totalOrbs: 20,
    wave: 1,
    isFinished: false,
    shake: 0,
    selectedTool: 'plasma' as DetonatorTool,
    viewportWidth: 400,
    viewportHeight: 600,
  });

  const initParticles = useCallback((w: number, h: number, waveNum: number) => {
    // Balanced orb count that doesn't overcrowd the canvas
    const total = Math.min(36, 16 + waveNum * 2);
    // Required clear percentage climbs with wave: 50% on Wave 1 up to 85% on Wave 8+
    const reqPercent = Math.min(0.85, 0.5 + (waveNum - 1) * 0.05);
    const target = Math.max(8, Math.round(total * reqPercent));

    gameStateRef.current.targetMin = target;
    gameStateRef.current.totalOrbs = total;
    setTargetMin(target);
    setTotalOrbs(total);

    const nodes: ParticleNode[] = [];
    const colors = ['#F43F5E', '#38BDF8', '#34D399', '#FACC15', '#A855F7', '#FB923C'];
    const horizontalScale = clamp(w / 400, 0.85, 1.8);
    const verticalScale = clamp(h / 600, 0.85, 1.35);

    for (let i = 0; i < total; i++) {
      const baseSpeed = 1.3 + Math.min(1.8, waveNum * 0.15) + Math.random() * 1.0;
      const angle = Math.random() * Math.PI * 2;
      const color = colors[Math.floor(Math.random() * colors.length)];

      const rand = Math.random();
      let type: ParticleNode['type'] = 'standard';
      let maxRadius = 32 + Math.random() * 4; // Tight secondary explosion radius!
      let shieldHp = 0;
      let spd = baseSpeed;

      // Introduce special challenge orbs according to wave
      if (waveNum >= 3 && rand < 0.22) {
        // Shielded Orb: absorbs weak pulses, needs plasma or 2 hits
        type = 'shielded';
        shieldHp = 2;
        maxRadius = 34;
      } else if (waveNum >= 4 && rand >= 0.22 && rand < 0.36) {
        // Dampener / Void Hazard: absorbs explosions, stops lazy chains
        type = 'dampener';
        maxRadius = 20;
      } else if (waveNum >= 2 && rand >= 0.36 && rand < 0.52) {
        // Evasive fast orb
        type = 'evasive';
        spd = baseSpeed * 1.9;
        maxRadius = 30;
      } else if (rand >= 0.52 && rand < 0.62) {
        type = 'supernova';
        maxRadius = 58;
      } else if (rand >= 0.62 && rand < 0.72) {
        type = 'multiplier';
        maxRadius = 34;
      } else if (rand >= 0.72 && rand < 0.8) {
        type = 'extra_charge';
        maxRadius = 30;
      }

      nodes.push({
        id: i,
        x: 45 + Math.random() * (w - 90),
        y: 45 + Math.random() * (h - 90),
        vx: Math.cos(angle) * spd * horizontalScale,
        vy: Math.sin(angle) * spd * verticalScale,
        radius: type === 'shielded' ? 9 : type === 'dampener' ? 8 : type === 'supernova' ? 9 : 7,
        color:
          type === 'shielded'
            ? '#38BDF8'
            : type === 'dampener'
            ? '#7C3AED'
            : type === 'evasive'
            ? '#FACC15'
            : type === 'supernova'
            ? '#FF0055'
            : type === 'multiplier'
            ? '#EC4899'
            : type === 'extra_charge'
            ? '#10B981'
            : color,
        glow: color,
        type,
        state: 'moving',
        shieldHp,
        maxShieldHp: shieldHp,
        explosionRadius: 0,
        maxExplosionRadius: maxRadius,
        explosionDuration: 0,
      });
    }
    return nodes;
  }, []);

  const handleTrigger = (clientX: number, clientY: number) => {
    const state = gameStateRef.current;
    if (state.chargesLeft <= 0 || isPausedRef.current || state.isFinished) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    state.chargesLeft--;
    setChargesLeft(state.chargesLeft);

    const tool = state.selectedTool;

    if (tool === 'plasma') {
      // PLASMA DETONATOR: Huge concussive blast (radius 76px) that shatters shields & hazards
      state.particles.push({
        id: 90000 + Math.random() * 1000,
        x: clickX,
        y: clickY,
        vx: 0,
        vy: 0,
        radius: 6,
        color: '#FF2D55',
        glow: '#FFFFFF',
        type: 'standard',
        state: 'exploding',
        shieldHp: 0,
        maxShieldHp: 0,
        explosionRadius: 8,
        maxExplosionRadius: 76,
        explosionDuration: 0,
        detonatorType: 'plasma',
      });
      state.shake = 8;
      if (soundEnabled) sounds.playShockwave();

      for (let s = 0; s < 18; s++) {
        const ang = Math.random() * Math.PI * 2;
        state.sparks.push({
          x: clickX,
          y: clickY,
          vx: Math.cos(ang) * (3 + Math.random() * 4),
          vy: Math.sin(ang) * (3 + Math.random() * 4),
          color: '#FF2D55',
          size: 3,
          life: 0,
          maxLife: 24,
        });
      }
    } else if (tool === 'tesla') {
      // TESLA ARC CHAIN: Shoots branched electrical bolts that leap to the nearest 4 orbs up to 200px away!
      if (soundEnabled) sounds.playLaser();
      state.shake = 6;

      // Find closest candidates to tap point
      const movingNodes = state.particles.filter((p) => p.state === 'moving' || p.state === 'frozen');
      movingNodes.sort((a, b) => {
        const distA = Math.hypot(a.x - clickX, a.y - clickY);
        const distB = Math.hypot(b.x - clickX, b.y - clickY);
        return distA - distB;
      });

      const targets = movingNodes.slice(0, 4);
      let lastX = clickX;
      let lastY = clickY;

      targets.forEach((target, idx) => {
        state.lightningArcs.push({
          x1: lastX,
          y1: lastY,
          x2: target.x,
          y2: target.y,
          color: '#38BDF8',
          life: 18 + idx * 4,
        });
        lastX = target.x;
        lastY = target.y;

        // Directly detonate the target
        target.state = 'exploding';
        target.explosionRadius = 6;
        target.detonatorType = 'tesla';
        state.chainCount++;

        state.floatingTexts.push({
          x: target.x,
          y: target.y,
          text: '⚡ ARC ZAP',
          color: '#38BDF8',
          life: 0,
          maxLife: 26,
        });
      });

      setChainCount(state.chainCount);
    } else if (tool === 'cryo') {
      // CRYO GRAVITY VORTEX: Creates a gravitational black hole vortex for 3.5 seconds
      state.vortexes.push({
        x: clickX,
        y: clickY,
        radius: 95,
        life: 0,
        maxLife: 150, // ~2.5 seconds
        pullStrength: 3.2,
      });

      state.shake = 4;
      if (soundEnabled) sounds.playChime(780);

      state.floatingTexts.push({
        x: clickX,
        y: clickY,
        text: '❄️ VORTEX ACTIVE',
        color: '#A78BFA',
        life: 0,
        maxLife: 32,
      });
    }
  };

  const setSafeTimeout = useSafeTimeout();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const state = gameStateRef.current;
    state.chargesLeft = 3;
    state.chainCount = 0;
    state.wave = 1;
    state.score = 0;
    state.isFinished = false;
    state.shake = 0;
    state.sparks = [];
    state.vortexes = [];
    state.lightningArcs = [];
    state.floatingTexts = [];
    state.particles = initParticles(400, 600, 1);
    setChargesLeft(3);
    setChainCount(0);
    setWave(1);

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if ('touches' in e) e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      handleTrigger(clientX, clientY);
    };

    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('touchstart', handlePointerDown, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', handlePointerDown);
      canvas.removeEventListener('touchstart', handlePointerDown);
    };
  }, [initParticles]);

  useGameLoop({
    canvasRef,
    isPaused,
    onResize: (w, h) => {
      const state = gameStateRef.current;
      const scaleX = w / Math.max(1, state.viewportWidth);
      const scaleY = h / Math.max(1, state.viewportHeight);
      const uniformScale = Math.min(scaleX, scaleY);

      for (const particle of state.particles) {
        rescalePoint(particle, scaleX, scaleY);
        rescaleVelocity(particle, scaleX, scaleY);
        particle.radius *= uniformScale;
        particle.explosionRadius *= uniformScale;
        particle.maxExplosionRadius *= uniformScale;
      }
      for (const vortex of state.vortexes) {
        rescalePoint(vortex, scaleX, scaleY);
        vortex.radius *= uniformScale;
        vortex.pullStrength *= uniformScale;
      }
      for (const arc of state.lightningArcs) {
        arc.x1 *= scaleX;
        arc.y1 *= scaleY;
        arc.x2 *= scaleX;
        arc.y2 *= scaleY;
      }
      for (const spark of state.sparks) {
        rescalePoint(spark, scaleX, scaleY);
        rescaleVelocity(spark, scaleX, scaleY);
        spark.size *= uniformScale;
      }
      for (const text of state.floatingTexts) rescalePoint(text, scaleX, scaleY);

      state.viewportWidth = w;
      state.viewportHeight = h;
      if (state.particles.length === 0) state.particles = initParticles(w, h, state.wave);
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

      let activeExplosions = 0;
      let movingCount = 0;

      if (!isPausedRef.current) {
        // 1. Process Cryo Vortex Fields (Gravity Pull & Freeze)
        for (let vIdx = state.vortexes.length - 1; vIdx >= 0; vIdx--) {
          const v = state.vortexes[vIdx];
          v.life++;

          state.particles.forEach((p) => {
            if (p.state === 'moving' || p.state === 'frozen') {
              const dx = v.x - p.x;
              const dy = v.y - p.y;
              const dist = Math.hypot(dx, dy);

              if (dist < v.radius) {
                // Pull toward center & freeze speed
                p.state = 'frozen';
                p.vx *= 0.82;
                p.vy *= 0.82;
                const pull = (1 - dist / v.radius) * v.pullStrength;
                p.x += (dx / (dist || 1)) * pull;
                p.y += (dy / (dist || 1)) * pull;
              }
            }
          });

          // Vortex collapse explosion when life completes
          if (v.life >= v.maxLife) {
            state.vortexes.splice(vIdx, 1);
            state.particles.push({
              id: 99000 + Math.random() * 100,
              x: v.x,
              y: v.y,
              vx: 0,
              vy: 0,
              radius: 6,
              color: '#A78BFA',
              glow: '#FFFFFF',
              type: 'standard',
              state: 'exploding',
              shieldHp: 0,
              maxShieldHp: 0,
              explosionRadius: 8,
              maxExplosionRadius: 65,
              explosionDuration: 0,
              detonatorType: 'cryo',
            });
            if (soundEnabled) sounds.playExplosion();
          }
        }

        // 2. Count and update particles
        state.particles.forEach((p) => {
          if (p.state === 'exploding') {
            activeExplosions++;
            p.explosionDuration++;

            if (p.explosionDuration < 28) {
              p.explosionRadius += (p.maxExplosionRadius - p.explosionRadius) * 0.22;
            } else if (p.explosionDuration > 45) {
              p.explosionRadius *= 0.85;
              if (p.explosionRadius < 2) {
                p.state = 'dead';
              }
            }

            // Chain check against other moving or frozen nodes
            state.particles.forEach((other) => {
              if (other.state === 'moving' || other.state === 'frozen') {
                const dist = Math.hypot(p.x - other.x, p.y - other.y);

                if (dist < p.explosionRadius + other.radius) {
                  // Dampener Hazard: absorbs the explosion and extinguishes it
                  if (other.type === 'dampener' && p.detonatorType !== 'plasma') {
                    p.state = 'dead';
                    state.floatingTexts.push({
                      x: other.x,
                      y: other.y,
                      text: '🛡️ PULSE BLOCKED',
                      color: '#7C3AED',
                      life: 0,
                      maxLife: 25,
                    });
                    if (soundEnabled) sounds.playTone(220, 0.08, 'sawtooth');
                    return;
                  }

                  // Shielded Orb: absorbs first hit, pops on 2nd hit or direct plasma blast
                  if (other.type === 'shielded' && other.shieldHp > 0 && p.detonatorType !== 'plasma') {
                    other.shieldHp--;
                    state.floatingTexts.push({
                      x: other.x,
                      y: other.y,
                      text: 'SHIELD -1',
                      color: '#38BDF8',
                      life: 0,
                      maxLife: 20,
                    });
                    if (soundEnabled) sounds.playTone(480, 0.05, 'triangle');
                    return;
                  }

                  // Orb explodes!
                  other.state = 'exploding';
                  other.explosionRadius = 4;
                  state.chainCount++;
                  setChainCount(state.chainCount);

                  // Lightning tracer
                  state.lightningArcs.push({
                    x1: p.x,
                    y1: p.y,
                    x2: other.x,
                    y2: other.y,
                    color: other.color,
                    life: 12,
                  });

                  // Abilities
                  if (other.type === 'supernova') {
                    state.shake = 10;
                    other.maxExplosionRadius = 68;
                    state.floatingTexts.push({
                      x: other.x,
                      y: other.y,
                      text: '💥 SUPERNOVA!',
                      color: '#FF0055',
                      life: 0,
                      maxLife: 30,
                    });
                    if (soundEnabled) sounds.playExplosion();
                  } else if (other.type === 'extra_charge') {
                    state.chargesLeft = Math.min(5, state.chargesLeft + 1);
                    setChargesLeft(state.chargesLeft);
                    state.floatingTexts.push({
                      x: other.x,
                      y: other.y,
                      text: '+1 CHARGE ⚡',
                      color: '#10B981',
                      life: 0,
                      maxLife: 32,
                    });
                    if (soundEnabled) sounds.playChime(1100);
                  }

                  const multiplier = other.type === 'multiplier' ? 3 : 1;
                  const comboFactor = Math.floor(state.chainCount / 4) + 1;
                  const pts = state.chainCount * 140 * multiplier * comboFactor;
                  state.score += pts;

                  if (state.chainCount % 8 === 0) {
                    setComboBanner(`${state.chainCount}X CHAIN CASCADE!`);
                    setSafeTimeout(() => setComboBanner(null), 1400);
                  }

                  state.floatingTexts.push({
                    x: other.x,
                    y: other.y,
                    text: comboFactor > 1 ? `+${pts} (${comboFactor}x)` : `+${pts}`,
                    color: other.color,
                    life: 0,
                    maxLife: 24,
                  });

                  if (soundEnabled) sounds.playCombo(state.chainCount);
                  onScoreUpdate(state.score);
                  state.shake = Math.min(8, state.shake + 1.8);

                  for (let s = 0; s < 10; s++) {
                    const ang = Math.random() * Math.PI * 2;
                    state.sparks.push({
                      x: other.x,
                      y: other.y,
                      vx: Math.cos(ang) * (2 + Math.random() * 3),
                      vy: Math.sin(ang) * (2 + Math.random() * 3),
                      color: other.color,
                      size: 2.5,
                      life: 0,
                      maxLife: 20,
                    });
                  }
                }
              }
            });
          } else if (p.state === 'moving' || p.state === 'frozen') {
            movingCount++;
            if (p.state === 'moving') {
              p.x += p.vx;
              p.y += p.vy;

              // Evasive micro-swerve
              if (p.type === 'evasive' && Math.random() < 0.05) {
                p.vx += (Math.random() - 0.5) * 1.5;
                p.vy += (Math.random() - 0.5) * 1.5;
              }

              // Bounce on borders
              if (p.x - p.radius < 0 || p.x + p.radius > curW) p.vx *= -1;
              if (p.y - p.radius < 0 || p.y + p.radius > curH) p.vy *= -1;
            }
          }
        });

        // Check wave completion or failure
        const allOrbsCleared = movingCount === 0 && state.particles.length > 0;
        const noChargesAndQuiet =
          state.chargesLeft === 0 && activeExplosions === 0 && state.vortexes.length === 0;

        if (
          (allOrbsCleared || noChargesAndQuiet) &&
          activeExplosions === 0 &&
          state.vortexes.length === 0 &&
          !state.isFinished
        ) {
          state.isFinished = true;
          const targetReached = state.chainCount >= state.targetMin || allOrbsCleared;

          if (targetReached) {
            if (soundEnabled) sounds.playSuccess();

            const chargeBonus = state.chargesLeft * 1200;
            const wipeBonus = allOrbsCleared ? 2500 : 0;
            const waveBonus = state.chainCount * 250 + chargeBonus + wipeBonus;
            state.score += waveBonus;
            onScoreUpdate(state.score);

            setComboBanner(
              allOrbsCleared
                ? `🌟 100% BOARD WIPE! +${waveBonus} PTS`
                : `🎉 WAVE ${state.wave} CLEARED! +${waveBonus} PTS`
            );

            setSafeTimeout(() => {
              setComboBanner(null);
              state.wave++;
              setWave(state.wave);
              state.chargesLeft = 3;
              state.isFinished = false;
              state.chainCount = 0;
              state.lightningArcs = [];
              state.vortexes = [];
              setChargesLeft(3);
              setChainCount(0);
              state.particles = initParticles(curW, curH, state.wave);
            }, 1600);
          } else {
            if (soundEnabled) sounds.playGameOver();
            setSafeTimeout(() => {
              onGameOver(state.score);
            }, 800);
          }
        }

        // Lightning arcs
        for (let i = state.lightningArcs.length - 1; i >= 0; i--) {
          state.lightningArcs[i].life--;
          if (state.lightningArcs[i].life <= 0) {
            state.lightningArcs.splice(i, 1);
          }
        }

        // Sparks
        for (let i = state.sparks.length - 1; i >= 0; i--) {
          const s = state.sparks[i];
          s.x += s.vx;
          s.y += s.vy;
          s.life++;
          if (s.life >= s.maxLife) {
            state.sparks.splice(i, 1);
          }
        }
      }

      // --- RENDERING ---

      // Background cyber grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < curW; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, curH);
        ctx.stroke();
      }

      // Draw Cryo Vortex Singularity Fields
      state.vortexes.forEach((v) => {
        const pulseR = v.radius * (0.85 + Math.sin(v.life * 0.15) * 0.15);
        ctx.strokeStyle = '#A78BFA';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(v.x, v.y, pulseR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(167, 139, 250, 0.15)';
        ctx.beginPath();
        ctx.arc(v.x, v.y, pulseR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🌀', v.x, v.y);
      });

      // Draw Lightning Arcs
      state.lightningArcs.forEach((arc) => {
        ctx.strokeStyle = arc.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(arc.x1, arc.y1);
        const midX = (arc.x1 + arc.x2) / 2 + (Math.random() - 0.5) * 14;
        const midY = (arc.y1 + arc.y2) / 2 + (Math.random() - 0.5) * 14;
        ctx.lineTo(midX, midY);
        ctx.lineTo(arc.x2, arc.y2);
        ctx.stroke();
      });

      // Draw Explosions
      state.particles.forEach((p) => {
        if (p.state === 'exploding') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.explosionRadius, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = `${p.color}24`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.explosionRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw Moving & Frozen Nodes
      state.particles.forEach((p) => {
        if (p.state === 'moving' || p.state === 'frozen') {
          // Glow halo
          ctx.fillStyle = `${p.color}33`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 1.5, 0, Math.PI * 2);
          ctx.fill();

          // Core
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();

          // Highlight center
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 0.4, 0, Math.PI * 2);
          ctx.fill();

          // Special Type Icons & Shields
          if (p.type === 'shielded' && p.shieldHp > 0) {
            ctx.strokeStyle = '#38BDF8';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius + 3.5, 0, Math.PI * 2);
            ctx.stroke();
          } else if (p.type === 'dampener') {
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('✕', p.x, p.y);
          } else if (p.type === 'supernova') {
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('💥', p.x, p.y);
          } else if (p.type === 'extra_charge') {
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⚡', p.x, p.y);
          }
        }
      });

      // Draw Sparks
      state.sparks.forEach((s) => {
        const alpha = Math.max(0, 1 - s.life / s.maxLife);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Draw Floating Texts
      for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
        const ft = state.floatingTexts[i];
        ft.y -= 0.8;
        ft.life++;
        const alpha = Math.max(0, 1 - ft.life / ft.maxLife);

        ctx.fillStyle = ft.color;
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1;

        if (ft.life >= ft.maxLife) {
          state.floatingTexts.splice(i, 1);
        }
      }

      ctx.restore();
      return !state.isFinished;
    },
  });

  const selectWeapon = (tool: DetonatorTool) => {
    setSelectedTool(tool);
    gameStateRef.current.selectedTool = tool;
    if (soundEnabled) sounds.playClick();
  };

  const progressPercent = Math.min(100, Math.round((chainCount / targetMin) * 100));

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between select-none game-canvas-container touch-none">
      <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair touch-none" />

      {/* Top HUD */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-3 bg-[#18181B]/90 border border-[#27272A] px-3.5 py-1.5 rounded-xl font-mono-arcade text-xs">
          <span className="text-white font-bold">WAVE {wave}</span>
          <div className="flex items-center gap-1.5 text-[#38BDF8]">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="font-bold">
              {chainCount} / {targetMin} TARGET
            </span>
          </div>
          <span className="text-[#71717A]">|</span>
          <span className="text-emerald-400 font-bold">CHARGES: {chargesLeft}</span>
        </div>

        {/* Progress Bar */}
        <div className="w-32 hidden sm:flex flex-col gap-1 bg-[#18181B]/90 border border-[#27272A] p-2 rounded-xl">
          <div className="flex justify-between text-[10px] font-mono-arcade text-[#A1A1AA]">
            <span>CLEAR GOAL</span>
            <span className={chainCount >= targetMin ? 'text-emerald-400 font-bold' : ''}>
              {progressPercent}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#27272A] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-200 ${
                chainCount >= targetMin ? 'bg-[#34D399]' : 'bg-[#38BDF8]'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Wave Clear / Combo Banner */}
      {comboBanner && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-[#18181B]/95 border border-[#FACC15]/50 px-5 py-2 rounded-2xl shadow-[0_0_25px_rgba(250,204,21,0.3)] pointer-events-none animate-in zoom-in duration-200 z-30">
          <span className="font-mono-arcade font-black text-xs sm:text-sm text-[#FACC15] tracking-wider whitespace-nowrap">
            {comboBanner}
          </span>
        </div>
      )}

      {/* Tactical Detonator Selector with Distinct Purpose Descriptions */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-2 bg-[#18181B]/95 border border-[#27272A] p-1 sm:p-1.5 rounded-2xl shadow-2xl z-20">
        <button
          type="button"
          onClick={() => selectWeapon('plasma')}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-mono-arcade text-[11px] sm:text-xs transition-all cursor-pointer ${
            selectedTool === 'plasma'
              ? 'bg-[#F43F5E] text-white font-bold shadow-[0_0_12px_rgba(244,63,94,0.4)]'
              : 'text-[#A1A1AA] hover:text-white hover:bg-[#27272A]'
          }`}
          title="Heavy Concussive Blast - Breaks Shields & Nullifiers"
        >
          <Bomb className="w-3.5 h-3.5" /> PLASMA BLAST
        </button>

        <button
          type="button"
          onClick={() => selectWeapon('tesla')}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-mono-arcade text-[11px] sm:text-xs transition-all cursor-pointer ${
            selectedTool === 'tesla'
              ? 'bg-[#38BDF8] text-black font-bold shadow-[0_0_12px_rgba(56,189,248,0.4)]'
              : 'text-[#A1A1AA] hover:text-white hover:bg-[#27272A]'
          }`}
          title="Forking Chain Lightning - Bridges Wide Distances"
        >
          <Zap className="w-3.5 h-3.5" /> TESLA ARC
        </button>

        <button
          type="button"
          onClick={() => selectWeapon('cryo')}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-mono-arcade text-[11px] sm:text-xs transition-all cursor-pointer ${
            selectedTool === 'cryo'
              ? 'bg-[#A78BFA] text-black font-bold shadow-[0_0_12px_rgba(167,139,250,0.4)]'
              : 'text-[#A1A1AA] hover:text-white hover:bg-[#27272A]'
          }`}
          title="Gravity Singularity - Forcefully Pulls & Clusters Orbs"
        >
          <Snowflake className="w-3.5 h-3.5" /> CRYO VORTEX
        </button>
      </div>
    </div>
  );
};
