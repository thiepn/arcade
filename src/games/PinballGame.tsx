import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { haptics } from '../lib/haptics';
import { Heart, Zap, Sparkles, Trophy, Disc } from 'lucide-react';
import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  trail: { x: number; y: number }[];
}

interface Bumper {
  x: number;
  y: number;
  radius: number;
  points: number;
  color: string;
  glow: string;
  hitTimer: number;
}

interface DropTarget {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  isHit: boolean;
  color: string;
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

interface Flipper {
  pivotX: number;
  pivotY: number;
  length: number;
  angle: number;
  restAngle: number;
  upAngle: number;
  isUp: boolean;
}

interface Kickback {
  x: number;
  y: number;
  w: number;
  h: number;
  active: boolean;
  color: string;
}

export const PinballGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const setSafeTimeout = useSafeTimeout();

  const [lives, setLives] = useState(3);
  const [multiplier, setMultiplier] = useState(1);
  const [multiballActive, setMultiballActive] = useState(false);
  const [leftFlipperActive, setLeftFlipperActive] = useState(false);
  const [rightFlipperActive, setRightFlipperActive] = useState(false);
  const [kickbackReady, setKickbackReady] = useState(true);

  const gameStateRef = useRef({
    balls: [] as Ball[],
    bumpers: [] as Bumper[],
    dropTargets: [] as DropTarget[],
    particles: [] as Particle[],
    floatingScores: [] as FloatingScore[],
    leftFlipper: {
      pivotX: 0,
      pivotY: 0,
      length: 84,
      angle: 0.36,
      restAngle: 0.36,
      upAngle: -0.48,
      isUp: false,
    },
    rightFlipper: {
      pivotX: 0,
      pivotY: 0,
      length: 84,
      angle: Math.PI - 0.36,
      restAngle: Math.PI - 0.36,
      upAngle: Math.PI + 0.48,
      isUp: false,
    },
    score: 0,
    multiplier: 1,
    lives: 3,
    isAlive: true,
    shake: 0,
    multiballCount: 0,
    tableW: 400,
    tableH: 600,
    kickbackLeftActive: true,
    kickbackRightActive: true,
    centerPeg: { x: 0, y: 0, radius: 8, hitTimer: 0 },
  });

  const setupTable = useCallback((w: number, h: number) => {
    const state = gameStateRef.current;
    state.tableW = w;
    state.tableH = h;

    const cx = w * 0.5;

    // Bumpers in upper area
    state.bumpers = [
      {
        x: cx - 55,
        y: h * 0.25,
        radius: 24,
        points: 250,
        color: '#38BDF8',
        glow: 'rgba(56, 189, 248, 0.6)',
        hitTimer: 0,
      },
      {
        x: cx + 55,
        y: h * 0.25,
        radius: 24,
        points: 250,
        color: '#F43F5E',
        glow: 'rgba(244, 63, 94, 0.6)',
        hitTimer: 0,
      },
      {
        x: cx,
        y: h * 0.16,
        radius: 28,
        points: 500,
        color: '#FACC15',
        glow: 'rgba(250, 204, 21, 0.6)',
        hitTimer: 0,
      },
      {
        x: cx,
        y: h * 0.36,
        radius: 20,
        points: 300,
        color: '#A855F7',
        glow: 'rgba(168, 85, 247, 0.6)',
        hitTimer: 0,
      },
      {
        x: cx - 75,
        y: h * 0.44,
        radius: 16,
        points: 200,
        color: '#34D399',
        glow: 'rgba(52, 211, 153, 0.6)',
        hitTimer: 0,
      },
      {
        x: cx + 75,
        y: h * 0.44,
        radius: 16,
        points: 200,
        color: '#34D399',
        glow: 'rgba(52, 211, 153, 0.6)',
        hitTimer: 0,
      },
    ];

    // Drop Targets at top side
    state.dropTargets = [
      { id: 1, x: cx - 65, y: h * 0.08, w: 28, h: 8, isHit: false, color: '#34D399' },
      { id: 2, x: cx - 14, y: h * 0.08, w: 28, h: 8, isHit: false, color: '#34D399' },
      { id: 3, x: cx + 37, y: h * 0.08, w: 28, h: 8, isHit: false, color: '#34D399' },
    ];

    // Center Save Peg
    state.centerPeg = {
      x: cx,
      y: h * 0.90,
      radius: 9,
      hitTimer: 0,
    };

    // Extended Flippers with tight center gap
    const flipperY = h * 0.86;
    const flipperLen = Math.min(95, Math.max(78, w * 0.20));
    state.leftFlipper.length = flipperLen;
    state.rightFlipper.length = flipperLen;

    // Flipper pivot distance chosen so flipper tips at rest leave only a 16px gap!
    const pivotOffset = flipperLen * 0.88;
    state.leftFlipper.pivotX = cx - pivotOffset;
    state.leftFlipper.pivotY = flipperY;
    state.rightFlipper.pivotX = cx + pivotOffset;
    state.rightFlipper.pivotY = flipperY;

    // Spawn 1 initial ball at launch lane (right side)
    if (state.balls.length === 0) {
      state.balls = [
        {
          x: w * 0.86,
          y: h * 0.52,
          vx: -3.5,
          vy: -8.8,
          radius: 9.5,
          trail: [],
        },
      ];
    }
  }, []);

  const spawnExtraBall = useCallback((w: number, h: number) => {
    const state = gameStateRef.current;
    state.balls.push({
      x: w * 0.5 + (Math.random() - 0.5) * 40,
      y: h * 0.15,
      vx: (Math.random() - 0.5) * 6,
      vy: 2 + Math.random() * 3,
      radius: 9,
      trail: [],
    });
    setMultiballActive(true);
    if (soundEnabled) sounds.playPowerUp();
  }, [soundEnabled]);

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

  // Flip Left Flipper
  const setLeftFlipper = useCallback((isUp: boolean) => {
    const state = gameStateRef.current;
    state.leftFlipper.isUp = isUp;
    setLeftFlipperActive(isUp);
    if (isUp && soundEnabled) sounds.playFlipper();
  }, [soundEnabled]);

  // Flip Right Flipper
  const setRightFlipper = useCallback((isUp: boolean) => {
    const state = gameStateRef.current;
    state.rightFlipper.isUp = isUp;
    setRightFlipperActive(isUp);
    if (isUp && soundEnabled) sounds.playFlipper();
  }, [soundEnabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Keyboard bindings (A / Left Arrow -> Left Flipper, D / Right Arrow -> Right Flipper, Space -> Both)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        setLeftFlipper(true);
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        setRightFlipper(true);
      } else if (e.key === ' ') {
        setLeftFlipper(true);
        setRightFlipper(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        setLeftFlipper(false);
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        setRightFlipper(false);
      } else if (e.key === ' ') {
        setLeftFlipper(false);
        setRightFlipper(false);
      }
    };

    // Touch & Mouse bindings: Click/tap left half for left flipper, right half for right flipper
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const touches = 'touches' in e ? Array.from(e.touches) : [e as MouseEvent];

      touches.forEach((touch) => {
        const x = touch.clientX - rect.left;
        if (x < rect.width * 0.5) {
          setLeftFlipper(true);
        } else {
          setRightFlipper(true);
        }
      });
    };

    const handlePointerUp = (e: MouseEvent | TouchEvent) => {
      if ('touches' in e && e.touches.length > 0) {
        const rect = canvas.getBoundingClientRect();
        let leftActive = false;
        let rightActive = false;
        Array.from(e.touches).forEach((touch) => {
          const x = touch.clientX - rect.left;
          if (x < rect.width * 0.5) leftActive = true;
          else rightActive = true;
        });
        setLeftFlipper(leftActive);
        setRightFlipper(rightActive);
      } else {
        setLeftFlipper(false);
        setRightFlipper(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mouseup', handlePointerUp);
    canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mouseup', handlePointerUp);
      canvas.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [setLeftFlipper, setRightFlipper]);

  useGameLoop({
    canvasRef,
    isPaused,
    onResize: (w, h) => {
      setupTable(w, h);
    },
    onUpdate: (ctx, deltaSec, curW, curH) => {
      const state = gameStateRef.current;

      ctx.save();

      if (state.shake > 0) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
        state.shake *= 0.88;
        if (state.shake < 0.2) state.shake = 0;
      }

      ctx.clearRect(-10, -10, curW + 20, curH + 20);

      // Table dimensions
      const leftBound = curW * 0.08;
      const rightBound = curW * 0.92;
      const topBound = curH * 0.05;
      const slingY = curH * 0.68;
      const flipperY = state.leftFlipper.pivotY;

      // --- PHYSICS UPDATE ---
      if (!isPausedRef.current && state.isAlive) {
        // Flipper motion interpolation
        const lf = state.leftFlipper;
        const rf = state.rightFlipper;
        const flipperSpeed = 0.45;

        const targetLAngle = lf.isUp ? lf.upAngle : lf.restAngle;
        lf.angle += (targetLAngle - lf.angle) * flipperSpeed;

        const targetRAngle = rf.isUp ? rf.upAngle : rf.restAngle;
        rf.angle += (targetRAngle - rf.angle) * flipperSpeed;

        // Gravity constant
        const gravity = 0.18;

        // Bumper hit timer countdown
        state.bumpers.forEach((b) => {
          if (b.hitTimer > 0) b.hitTimer--;
        });
        if (state.centerPeg.hitTimer > 0) state.centerPeg.hitTimer--;

        // Balls simulation
        for (let bIdx = state.balls.length - 1; bIdx >= 0; bIdx--) {
          const ball = state.balls[bIdx];

          ball.vy += gravity;
          ball.vx *= 0.997;
          ball.vy *= 0.997;

          ball.x += ball.vx;
          ball.y += ball.vy;

          // Trail
          ball.trail.push({ x: ball.x, y: ball.y });
          if (ball.trail.length > 10) ball.trail.shift();

          // Left / Right Outer Walls
          if (ball.x < leftBound + ball.radius) {
            ball.x = leftBound + ball.radius;
            ball.vx = Math.abs(ball.vx) * 0.85;
            if (soundEnabled) sounds.playBounce();
          } else if (ball.x > rightBound - ball.radius) {
            ball.x = rightBound - ball.radius;
            ball.vx = -Math.abs(ball.vx) * 0.85;
            if (soundEnabled) sounds.playBounce();
          }

          // Top Arch Curve
          if (ball.y < topBound + ball.radius) {
            ball.y = topBound + ball.radius;
            ball.vy = Math.abs(ball.vy) * 0.85;
            if (soundEnabled) sounds.playBounce();
          }

          // Slingshots (Angled energetic kickers above flippers)
          // Left slingshot
          if (ball.x > leftBound && ball.x < leftBound + 48 && ball.y > slingY && ball.y < slingY + 55) {
            ball.vx = Math.abs(ball.vx) + 4.8;
            ball.vy = -Math.abs(ball.vy) * 1.15 - 3;
            state.score += 150 * state.multiplier;
            onScoreUpdate(state.score);
            if (soundEnabled) sounds.playBumper();
            addScorePopup(`+${150 * state.multiplier}`, ball.x, ball.y, '#38BDF8');
          }
          // Right slingshot
          if (ball.x < rightBound && ball.x > rightBound - 48 && ball.y > slingY && ball.y < slingY + 55) {
            ball.vx = -Math.abs(ball.vx) - 4.8;
            ball.vy = -Math.abs(ball.vy) * 1.15 - 3;
            state.score += 150 * state.multiplier;
            onScoreUpdate(state.score);
            if (soundEnabled) sounds.playBumper();
            addScorePopup(`+${150 * state.multiplier}`, ball.x, ball.y, '#F43F5E');
          }

          // Inlane Funnel Rails (angled guide walls directing balls straight to flipper pivots)
          // Left inlane guide wall from (leftBound, slingY + 55) down to (lf.pivotX, lf.pivotY)
          const gL1x = leftBound;
          const gL1y = slingY + 55;
          const gL2x = state.leftFlipper.pivotX;
          const gL2y = state.leftFlipper.pivotY;
          const gLdx = gL2x - gL1x;
          const gLdy = gL2y - gL1y;
          const gLlen = Math.hypot(gLdx, gLdy);
          const uL = Math.max(0, Math.min(1, ((ball.x - gL1x) * gLdx + (ball.y - gL1y) * gLdy) / (gLlen * gLlen)));
          const nearLx = gL1x + uL * gLdx;
          const nearLy = gL1y + uL * gLdy;
          const distL = Math.hypot(ball.x - nearLx, ball.y - nearLy);
          if (distL < ball.radius + 4 && ball.y > gL1y - 10) {
            // Deflect inward toward right
            const nx = -gLdy / gLlen;
            const ny = gLdx / gLlen;
            ball.x = nearLx + nx * (ball.radius + 5);
            ball.y = nearLy + ny * (ball.radius + 5);
            ball.vx = Math.abs(ball.vx) * 0.7 + 1.5;
            ball.vy = Math.abs(ball.vy) * 0.7;
          }

          // Right inlane guide wall from (rightBound, slingY + 55) down to (rf.pivotX, rf.pivotY)
          const gR1x = rightBound;
          const gR1y = slingY + 55;
          const gR2x = state.rightFlipper.pivotX;
          const gR2y = state.rightFlipper.pivotY;
          const gRdx = gR2x - gR1x;
          const gRdy = gR2y - gR1y;
          const gRlen = Math.hypot(gRdx, gRdy);
          const uR = Math.max(0, Math.min(1, ((ball.x - gR1x) * gRdx + (ball.y - gR1y) * gRdy) / (gRlen * gRlen)));
          const nearRx = gR1x + uR * gRdx;
          const nearRy = gR1y + uR * gRdy;
          const distR = Math.hypot(ball.x - nearRx, ball.y - nearRy);
          if (distR < ball.radius + 4 && ball.y > gR1y - 10) {
            // Deflect inward toward left
            const nx = -gRdy / gRlen;
            const ny = gRdx / gRlen;
            ball.x = nearRx - nx * (ball.radius + 5);
            ball.y = nearRy + ny * (ball.radius + 5);
            ball.vx = -Math.abs(ball.vx) * 0.7 - 1.5;
            ball.vy = Math.abs(ball.vy) * 0.7;
          }

          // Outlane Laser Kickback Protectors (Left & Right Outlanes)
          const kickbackY = curH * 0.82;
          if (ball.x < leftBound + 24 && ball.y > kickbackY && ball.y < kickbackY + 45) {
            // Left Laser Kickback trigger!
            ball.vx = 4.5 + Math.random() * 2;
            ball.vy = -12.5;
            state.score += 500 * state.multiplier;
            onScoreUpdate(state.score);
            state.shake = 6;
            if (soundEnabled) sounds.playShockwave();
            haptics.combo();
            addScorePopup('OUTLANE SAVE! +500', ball.x, ball.y - 10, '#38BDF8');
          }
          if (ball.x > rightBound - 24 && ball.y > kickbackY && ball.y < kickbackY + 45) {
            // Right Laser Kickback trigger!
            ball.vx = -4.5 - Math.random() * 2;
            ball.vy = -12.5;
            state.score += 500 * state.multiplier;
            onScoreUpdate(state.score);
            state.shake = 6;
            if (soundEnabled) sounds.playShockwave();
            haptics.combo();
            addScorePopup('OUTLANE SAVE! +500', ball.x, ball.y - 10, '#F43F5E');
          }

          // Center Save Peg (Peg right below center between flippers)
          const peg = state.centerPeg;
          const pegDist = Math.hypot(ball.x - peg.x, ball.y - peg.y);
          if (pegDist < peg.radius + ball.radius) {
            const nx = (ball.x - peg.x) / (pegDist || 1);
            const ny = (ball.y - peg.y) / (pegDist || 1);
            ball.vx = nx * 8 + (Math.random() - 0.5) * 4;
            ball.vy = -Math.abs(ny * 9.5) - 3;
            peg.hitTimer = 10;
            state.score += 300 * state.multiplier;
            onScoreUpdate(state.score);
            if (soundEnabled) sounds.playBumper();
            haptics.light();
            addScorePopup('CENTER SAVE! +300', peg.x, peg.y - 12, '#FACC15');
          }

          // Bumper collisions
          state.bumpers.forEach((bumper) => {
            const dx = ball.x - bumper.x;
            const dy = ball.y - bumper.y;
            const dist = Math.hypot(dx, dy);
            const minDist = bumper.radius + ball.radius;

            if (dist < minDist) {
              const nx = dx / (dist || 1);
              const ny = dy / (dist || 1);
              const kickSpeed = 9.8;

              ball.x = bumper.x + nx * (minDist + 1);
              ball.y = bumper.y + ny * (minDist + 1);
              ball.vx = nx * kickSpeed;
              ball.vy = ny * kickSpeed;

              bumper.hitTimer = 10;
              state.shake = 5;
              const pts = bumper.points * state.multiplier;
              state.score += pts;
              onScoreUpdate(state.score);
              haptics.score();

              if (soundEnabled) sounds.playBumper();
              addScorePopup(`+${pts}`, bumper.x, bumper.y - 10, bumper.color);

              // Sparks
              for (let k = 0; k < 10; k++) {
                const ang = Math.random() * Math.PI * 2;
                state.particles.push({
                  x: bumper.x + Math.cos(ang) * bumper.radius,
                  y: bumper.y + Math.sin(ang) * bumper.radius,
                  vx: Math.cos(ang) * (2 + Math.random() * 3),
                  vy: Math.sin(ang) * (2 + Math.random() * 3),
                  color: bumper.color,
                  size: 2.5,
                  life: 0,
                  maxLife: 15,
                });
              }
            }
          });

          // Drop targets collision
          state.dropTargets.forEach((target) => {
            if (
              !target.isHit &&
              ball.x > target.x - ball.radius &&
              ball.x < target.x + target.w + ball.radius &&
              ball.y > target.y - ball.radius &&
              ball.y < target.y + target.h + ball.radius
            ) {
              target.isHit = true;
              ball.vy = Math.abs(ball.vy) * 0.8;
              state.score += 800 * state.multiplier;
              onScoreUpdate(state.score);
              haptics.score();
              if (soundEnabled) sounds.playScore();
              addScorePopup(`TARGET HIT! +${800 * state.multiplier}`, target.x, target.y - 12, '#34D399');

              // Check if all drop targets hit -> MULTIBALL FRENZY!
              const allHit = state.dropTargets.every((t) => t.isHit);
              if (allHit) {
                state.multiplier++;
                setMultiplier(state.multiplier);
                spawnExtraBall(curW, curH);
                haptics.combo();
                addScorePopup('MULTIBALL FRENZY!', curW * 0.5, curH * 0.35, '#FACC15');
                setSafeTimeout(() => {
                  state.dropTargets.forEach((t) => (t.isHit = false));
                }, 4000);
              }
            }
          });

          // Left Flipper collision
          const lTipX = lf.pivotX + Math.cos(lf.angle) * lf.length;
          const lTipY = lf.pivotY + Math.sin(lf.angle) * lf.length;
          const lSegDx = lTipX - lf.pivotX;
          const lSegDy = lTipY - lf.pivotY;
          const lLen = Math.hypot(lSegDx, lSegDy);
          const lu = Math.max(0, Math.min(1, ((ball.x - lf.pivotX) * lSegDx + (ball.y - lf.pivotY) * lSegDy) / (lLen * lLen)));
          const lNearX = lf.pivotX + lu * lSegDx;
          const lNearY = lf.pivotY + lu * lSegDy;
          const lDist = Math.hypot(ball.x - lNearX, ball.y - lNearY);

          if (lDist < ball.radius + 9) {
            const perpX = -lSegDy / lLen;
            const perpY = lSegDx / lLen;
            const flipForce = lf.isUp ? 14 : 7;
            ball.vx = perpX * flipForce + (Math.random() - 0.5) * 2;
            ball.vy = -Math.abs(perpY * flipForce) - 3.5;
            ball.y = lNearY - ball.radius - 3;
            haptics.light();
            if (soundEnabled) sounds.playFlipper();
            state.score += 75;
            onScoreUpdate(state.score);
          }

          // Right Flipper collision
          const rTipX = rf.pivotX + Math.cos(rf.angle) * rf.length;
          const rTipY = rf.pivotY + Math.sin(rf.angle) * rf.length;
          const rSegDx = rTipX - rf.pivotX;
          const rSegDy = rTipY - rf.pivotY;
          const rLen = Math.hypot(rSegDx, rSegDy);
          const ru = Math.max(0, Math.min(1, ((ball.x - rf.pivotX) * rSegDx + (ball.y - rf.pivotY) * rSegDy) / (rLen * rLen)));
          const rNearX = rf.pivotX + ru * rSegDx;
          const rNearY = rf.pivotY + ru * rSegDy;
          const rDist = Math.hypot(ball.x - rNearX, ball.y - rNearY);

          if (rDist < ball.radius + 9) {
            const perpX = -rSegDy / rLen;
            const perpY = rSegDx / rLen;
            const flipForce = rf.isUp ? 14 : 7;
            ball.vx = -perpX * flipForce + (Math.random() - 0.5) * 2;
            ball.vy = -Math.abs(perpY * flipForce) - 3.5;
            ball.y = rNearY - ball.radius - 3;
            haptics.light();
            if (soundEnabled) sounds.playFlipper();
            state.score += 75;
            onScoreUpdate(state.score);
          }

          // Ball Out of Bottom Drain
          if (ball.y > curH + 40) {
            state.balls.splice(bIdx, 1);

            // If no balls remaining, lose 1 life
            if (state.balls.length === 0) {
              setMultiballActive(false);
              state.lives--;
              setLives(state.lives);
              haptics.impact();
              if (soundEnabled) sounds.playBuzz();

              if (state.lives <= 0) {
                state.isAlive = false;
                haptics.gameOver();
                onGameOver(state.score);
              } else {
                setSafeTimeout(() => {
                  state.balls = [
                    {
                      x: curW * 0.86,
                      y: curH * 0.52,
                      vx: -3.5,
                      vy: -8.8,
                      radius: 9.5,
                      trail: [],
                    },
                  ];
                }, 600);
              }
            }
          }
        }
      }

      // --- RENDERING ---

      // Table Outline Frame
      ctx.strokeStyle = '#27272A';
      ctx.lineWidth = 4;
      ctx.strokeRect(leftBound, topBound, rightBound - leftBound, curH * 0.9);

      // Inlane Guide Rails & Funnel Walls
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(leftBound, slingY + 55);
      ctx.lineTo(state.leftFlipper.pivotX, state.leftFlipper.pivotY);
      ctx.stroke();

      ctx.strokeStyle = '#F43F5E';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(rightBound, slingY + 55);
      ctx.lineTo(state.rightFlipper.pivotX, state.rightFlipper.pivotY);
      ctx.stroke();

      // Outlane Laser Kickback Visuals
      const kickY = curH * 0.82;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.fillRect(leftBound + 2, kickY, 18, 40);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.strokeRect(leftBound + 2, kickY, 18, 40);
      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 8px monospace';
      ctx.fillText('SAVE', leftBound + 11, kickY + 22);

      ctx.fillStyle = 'rgba(244, 63, 94, 0.25)';
      ctx.fillRect(rightBound - 20, kickY, 18, 40);
      ctx.strokeStyle = '#F43F5E';
      ctx.lineWidth = 2;
      ctx.strokeRect(rightBound - 20, kickY, 18, 40);
      ctx.fillStyle = '#F43F5E';
      ctx.fillText('SAVE', rightBound - 11, kickY + 22);

      // Center Save Peg
      const cPeg = state.centerPeg;
      ctx.fillStyle = cPeg.hitTimer > 0 ? '#FFFFFF' : '#FACC15';
      ctx.beginPath();
      ctx.arc(cPeg.x, cPeg.y, cPeg.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Slingshot Guides
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.beginPath();
      ctx.moveTo(leftBound, slingY);
      ctx.lineTo(leftBound + 44, slingY + 27);
      ctx.lineTo(leftBound, slingY + 55);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = 'rgba(244, 63, 94, 0.15)';
      ctx.beginPath();
      ctx.moveTo(rightBound, slingY);
      ctx.lineTo(rightBound - 44, slingY + 27);
      ctx.lineTo(rightBound, slingY + 55);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#F43F5E';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Drop Targets
      state.dropTargets.forEach((target) => {
        if (!target.isHit) {
          ctx.fillStyle = target.color;
          ctx.fillRect(target.x, target.y, target.w, target.h);
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1;
          ctx.strokeRect(target.x, target.y, target.w, target.h);
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.strokeRect(target.x, target.y, target.w, target.h);
        }
      });

      // Bumpers
      state.bumpers.forEach((b) => {
        const rad = b.radius + (b.hitTimer > 0 ? 3 : 0);

        // Glow
        ctx.fillStyle = b.glow;
        ctx.beginPath();
        ctx.arc(b.x, b.y, rad * 1.3, 0, Math.PI * 2);
        ctx.fill();

        // Outer Ring
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(b.x, b.y, rad, 0, Math.PI * 2);
        ctx.stroke();

        // Center
        ctx.fillStyle = b.hitTimer > 0 ? '#FFFFFF' : b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, rad * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${b.points}`, b.x, b.y);
      });

      // Flippers
      const lf = state.leftFlipper;
      const rf = state.rightFlipper;

      // Left Flipper Arm
      const lTipX = lf.pivotX + Math.cos(lf.angle) * lf.length;
      const lTipY = lf.pivotY + Math.sin(lf.angle) * lf.length;
      ctx.strokeStyle = lf.isUp ? '#38BDF8' : '#F43F5E';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lf.pivotX, lf.pivotY);
      ctx.lineTo(lTipX, lTipY);
      ctx.stroke();

      // Right Flipper Arm
      const rTipX = rf.pivotX + Math.cos(rf.angle) * rf.length;
      const rTipY = rf.pivotY + Math.sin(rf.angle) * rf.length;
      ctx.strokeStyle = rf.isUp ? '#38BDF8' : '#F43F5E';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(rf.pivotX, rf.pivotY);
      ctx.lineTo(rTipX, rTipY);
      ctx.stroke();

      // Pivot Caps
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(lf.pivotX, lf.pivotY, 6, 0, Math.PI * 2);
      ctx.arc(rf.pivotX, rf.pivotY, 6, 0, Math.PI * 2);
      ctx.fill();

      // Balls
      state.balls.forEach((ball) => {
        // Trail
        if (ball.trail.length > 1) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(ball.trail[0].x, ball.trail[0].y);
          for (let i = 1; i < ball.trail.length; i++) {
            ctx.lineTo(ball.trail[i].x, ball.trail[i].y);
          }
          ctx.stroke();
        }

        // Ball Body
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // Particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        const alpha = Math.max(0, 1 - p.life / p.maxLife);

        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        if (p.life >= p.maxLife) {
          state.particles.splice(i, 1);
        }
      }

      // Floating Scores
      for (let i = state.floatingScores.length - 1; i >= 0; i--) {
        const fs = state.floatingScores[i];
        fs.y -= 1;
        fs.life++;
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
          <div className="flex items-center gap-1 text-[#F43F5E]">
            {Array.from({ length: 3 }).map((_, i) => (
              <Heart
                key={i}
                className={`w-3.5 h-3.5 ${i < lives ? 'fill-current' : 'opacity-25'}`}
              />
            ))}
          </div>

          <span className="text-[#71717A]">|</span>

          <div className="flex items-center gap-1 text-cyan-400 font-bold">
            <Trophy className="w-3.5 h-3.5" />
            <span>MULT x{multiplier}</span>
          </div>

          {multiballActive && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold animate-bounce flex items-center gap-1">
              <Disc className="w-3 h-3 animate-spin" /> MULTIBALL!
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 bg-[#18181B]/90 border border-[#27272A] px-3 py-1.5 rounded-xl font-mono-arcade text-xs text-[#A1A1AA] backdrop-blur-md">
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span>A/D OR TAP SIDES FOR FLIPPERS</span>
        </div>
      </div>

      {/* On-screen touch flipper buttons for mobile comfort */}
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-4 z-10 pointer-events-auto">
        <button
          type="button"
          onMouseDown={() => setLeftFlipper(true)}
          onMouseUp={() => setLeftFlipper(false)}
          onTouchStart={(e) => {
            e.preventDefault();
            setLeftFlipper(true);
          }}
          onTouchEnd={() => setLeftFlipper(false)}
          className={`flex-1 py-3.5 rounded-xl font-mono-arcade text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 select-none backdrop-blur-md ${
            leftFlipperActive
              ? 'bg-cyan-500 text-black border-cyan-300 scale-95 shadow-lg shadow-cyan-500/30'
              : 'bg-[#18181B]/90 text-cyan-300 border-zinc-700 hover:bg-[#27272A]'
          }`}
        >
          ◀ LEFT FLIPPER [A]
        </button>

        <button
          type="button"
          onMouseDown={() => setRightFlipper(true)}
          onMouseUp={() => setRightFlipper(false)}
          onTouchStart={(e) => {
            e.preventDefault();
            setRightFlipper(true);
          }}
          onTouchEnd={() => setRightFlipper(false)}
          className={`flex-1 py-3.5 rounded-xl font-mono-arcade text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 select-none backdrop-blur-md ${
            rightFlipperActive
              ? 'bg-cyan-500 text-black border-cyan-300 scale-95 shadow-lg shadow-cyan-500/30'
              : 'bg-[#18181B]/90 text-cyan-300 border-zinc-700 hover:bg-[#27272A]'
          }`}
        >
          RIGHT FLIPPER [D] ▶
        </button>
      </div>
    </div>
  );
};
