import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { haptics } from '../lib/haptics';
import { Disc, Heart, Shield, Trophy, Zap } from 'lucide-react';
import { useGameLoop, useRenderPublishedState } from '../hooks/useGameLoop';
import { clamp, rescalePoint, rescaleTrail, rescaleVelocity } from '../lib/gameCoordinates';
import {
  PINBALL_BALL_SAVER_SECONDS,
  PINBALL_FIXED_STEP,
  PINBALL_FLIPPER_REST_ANGLE,
  PINBALL_FLIPPER_UP_ANGLE,
  PINBALL_MAX_BALL_SPEED,
  PINBALL_MAX_SUBSTEPS,
  capPinballSpeed,
  closestPointOnSegment,
  consumePinballKickback,
  createPinballServeVelocity,
  getPinballGravity,
  getPinballLayout,
  getPinballSpeedScale,
  resolveCircleAabb,
  resolveCircleCircle,
  resolveCircleSegment,
  resolvePinballDrain,
  type PinballLayout,
} from '../lib/pinballPhysics';
import { isArcadeReducedMotion } from '../lib/motionPreferences';

type GamePhase = 'serving' | 'playing' | 'game-over';

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  trail: { x: number; y: number }[];
  cooldowns: Record<string, number>;
  lowSpeedTime: number;
}

interface Bumper {
  id: string;
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
  radius: number;
  angle: number;
  restAngle: number;
  upAngle: number;
  angularVelocity: number;
  isUp: boolean;
}

interface PinballHud {
  lives: number;
  multiplier: number;
  multiball: boolean;
  saverSeconds: number;
  saverAvailable: boolean;
  leftKickback: boolean;
  rightKickback: boolean;
  phase: GamePhase;
}

const INITIAL_HUD: PinballHud = {
  lives: 3,
  multiplier: 1,
  multiball: false,
  saverSeconds: 0,
  saverAvailable: false,
  leftKickback: true,
  rightKickback: true,
  phase: 'serving',
};

const makeFlipper = (right: boolean): Flipper => ({
  pivotX: 0,
  pivotY: 0,
  length: 84,
  radius: 8,
  angle: right ? Math.PI - PINBALL_FLIPPER_REST_ANGLE : PINBALL_FLIPPER_REST_ANGLE,
  restAngle: right ? Math.PI - PINBALL_FLIPPER_REST_ANGLE : PINBALL_FLIPPER_REST_ANGLE,
  upAngle: right ? Math.PI - PINBALL_FLIPPER_UP_ANGLE : PINBALL_FLIPPER_UP_ANGLE,
  angularVelocity: 0,
  isUp: false,
});

export const PinballGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const [hud, setHud] = useRenderPublishedState<PinballHud>(INITIAL_HUD);
  const [leftFlipperActive, setLeftFlipperActive] = useState(false);
  const [rightFlipperActive, setRightFlipperActive] = useState(false);

  const gameStateRef = useRef({
    balls: [] as Ball[],
    bumpers: [] as Bumper[],
    dropTargets: [] as DropTarget[],
    particles: [] as Particle[],
    floatingScores: [] as FloatingScore[],
    leftFlipper: makeFlipper(false),
    rightFlipper: makeFlipper(true),
    score: 0,
    multiplier: 1,
    lives: 3,
    isAlive: true,
    phase: 'serving' as GamePhase,
    serveTimer: 0.2,
    pendingNewLife: true,
    ballSaverTime: 0,
    ballSaverAvailable: false,
    kickbackLeftActive: true,
    kickbackRightActive: true,
    dropResetTimer: 0,
    physicsAccumulator: 0,
    gameOverTimer: 0,
    gameOverReported: false,
    shake: 0,
    nextBallId: 1,
    tableW: 400,
    tableH: 600,
    initialized: false,
  });

  const addScorePopup = useCallback(
    (text: string, x: number, y: number, color = '#FFFFFF') => {
      gameStateRef.current.floatingScores.push({
        x,
        y,
        text,
        color,
        life: 0,
        maxLife: 0.75,
      });
    },
    [],
  );

  const spawnParticles = useCallback(
    (x: number, y: number, color: string, count: number, speed = 220) => {
      const state = gameStateRef.current;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const magnitude = speed * (0.45 + Math.random() * 0.75);
        state.particles.push({
          x,
          y,
          vx: Math.cos(angle) * magnitude,
          vy: Math.sin(angle) * magnitude,
          color,
          size: 2 + Math.random() * 2.5,
          life: 0,
          maxLife: 0.28 + Math.random() * 0.18,
        });
      }
    },
    [],
  );

  const awardScore = useCallback(
    (basePoints: number, x: number, y: number, color: string, label?: string) => {
      const state = gameStateRef.current;
      const points = Math.round(basePoints * state.multiplier);
      state.score += points;
      onScoreUpdate(state.score);
      addScorePopup(label ? `${label} +${points}` : `+${points}`, x, y, color);
      return points;
    },
    [addScorePopup, onScoreUpdate],
  );

  const createBall = useCallback((layout: PinballLayout, extraBall = false): Ball => {
    const radius = clamp(Math.min(layout.width, layout.height) * 0.016, 8.5, 11);
    if (extraBall) {
      const scale = getPinballSpeedScale(layout.height);
      return {
        id: gameStateRef.current.nextBallId++,
        x: layout.width * 0.5 + (Math.random() - 0.5) * layout.width * 0.12,
        y: layout.height * 0.16,
        vx: (Math.random() - 0.5) * 300 * scale,
        vy: (90 + Math.random() * 110) * scale,
        radius,
        trail: [],
        cooldowns: {},
        lowSpeedTime: 0,
      };
    }

    const velocity = createPinballServeVelocity(layout.height);
    return {
      id: gameStateRef.current.nextBallId++,
      x: layout.rightBound - clamp(layout.width * 0.05, 24, 44),
      y: layout.height * 0.58,
      vx: velocity.vx,
      vy: velocity.vy,
      radius,
      trail: [],
      cooldowns: {},
      lowSpeedTime: 0,
    };
  }, []);

  const launchServe = useCallback(
    (width: number, height: number, newLife: boolean) => {
      const state = gameStateRef.current;
      const layout = getPinballLayout(width, height);

      if (newLife) {
        state.kickbackLeftActive = true;
        state.kickbackRightActive = true;
        state.ballSaverTime = PINBALL_BALL_SAVER_SECONDS;
        state.ballSaverAvailable = true;
      }

      state.balls = [createBall(layout, false)];
      state.phase = 'playing';
      state.isAlive = true;
      state.pendingNewLife = false;
      state.physicsAccumulator = 0;
      if (soundEnabled) sounds.playPowerUp();
    },
    [createBall, soundEnabled],
  );

  const spawnExtraBall = useCallback(
    (width: number, height: number) => {
      const state = gameStateRef.current;
      state.balls.push(createBall(getPinballLayout(width, height), true));
      if (soundEnabled) sounds.playPowerUp();
    },
    [createBall, soundEnabled],
  );

  const setupTable = useCallback((width: number, height: number) => {
    const state = gameStateRef.current;
    const previousWidth = state.tableW;
    const previousHeight = state.tableH;
    const previousTargetState = new Map(state.dropTargets.map((target) => [target.id, target.isHit]));
    const previousBumperTimers = new Map(state.bumpers.map((bumper) => [bumper.id, bumper.hitTimer]));

    if (state.initialized && previousWidth > 0 && previousHeight > 0) {
      const scaleX = width / previousWidth;
      const scaleY = height / previousHeight;
      const uniformScale = Math.min(scaleX, scaleY);
      const previousGravity = getPinballGravity(previousHeight);
      const nextGravity = getPinballGravity(height);
      const timeScale = Math.sqrt(Math.max(0.0001, (scaleY * previousGravity) / nextGravity));
      const velocityScaleX = scaleX / timeScale;
      const velocityScaleY = scaleY / timeScale;

      for (const ball of state.balls) {
        rescalePoint(ball, scaleX, scaleY);
        rescaleVelocity(ball, velocityScaleX, velocityScaleY);
        rescaleTrail(ball.trail, scaleX, scaleY);
        ball.radius = clamp(ball.radius * uniformScale, 8.5, 11);
      }
      for (const particle of state.particles) {
        rescalePoint(particle, scaleX, scaleY);
        rescaleVelocity(particle, velocityScaleX, velocityScaleY);
        particle.size *= uniformScale;
      }
      for (const floatingScore of state.floatingScores) {
        rescalePoint(floatingScore, scaleX, scaleY);
      }
      state.shake *= uniformScale;
    }

    const layout = getPinballLayout(width, height);
    const centerX = width / 2;
    const minDimension = Math.min(width, height);
    const smallBumper = clamp(minDimension * 0.032, 16, 22);
    const mediumBumper = clamp(minDimension * 0.041, 20, 27);
    const largeBumper = clamp(minDimension * 0.047, 23, 31);

    state.bumpers = [
      {
        id: 'upper-left',
        x: centerX - width * 0.075,
        y: height * 0.25,
        radius: mediumBumper,
        points: 250,
        color: '#38BDF8',
        glow: 'rgba(56, 189, 248, 0.6)',
        hitTimer: previousBumperTimers.get('upper-left') ?? 0,
      },
      {
        id: 'upper-right',
        x: centerX + width * 0.075,
        y: height * 0.25,
        radius: mediumBumper,
        points: 250,
        color: '#F43F5E',
        glow: 'rgba(244, 63, 94, 0.6)',
        hitTimer: previousBumperTimers.get('upper-right') ?? 0,
      },
      {
        id: 'crown',
        x: centerX,
        y: height * 0.15,
        radius: largeBumper,
        points: 500,
        color: '#FACC15',
        glow: 'rgba(250, 204, 21, 0.6)',
        hitTimer: previousBumperTimers.get('crown') ?? 0,
      },
      {
        id: 'center',
        x: centerX,
        y: height * 0.37,
        radius: mediumBumper * 0.86,
        points: 300,
        color: '#A855F7',
        glow: 'rgba(168, 85, 247, 0.6)',
        hitTimer: previousBumperTimers.get('center') ?? 0,
      },
      {
        id: 'lower-left',
        x: centerX - width * 0.105,
        y: height * 0.46,
        radius: smallBumper,
        points: 200,
        color: '#34D399',
        glow: 'rgba(52, 211, 153, 0.6)',
        hitTimer: previousBumperTimers.get('lower-left') ?? 0,
      },
      {
        id: 'lower-right',
        x: centerX + width * 0.105,
        y: height * 0.46,
        radius: smallBumper,
        points: 200,
        color: '#34D399',
        glow: 'rgba(52, 211, 153, 0.6)',
        hitTimer: previousBumperTimers.get('lower-right') ?? 0,
      },
    ];

    const targetWidth = clamp(width * 0.034, 24, 32);
    const targetGap = clamp(width * 0.018, 12, 20);
    const targetStart = centerX - (targetWidth * 3 + targetGap * 2) / 2;
    state.dropTargets = Array.from({ length: 3 }, (_, index) => ({
      id: index + 1,
      x: targetStart + index * (targetWidth + targetGap),
      y: height * 0.075,
      w: targetWidth,
      h: clamp(height * 0.012, 7, 10),
      isHit: previousTargetState.get(index + 1) ?? false,
      color: '#34D399',
    }));

    const leftProgress = clamp(
      (state.leftFlipper.angle - state.leftFlipper.restAngle) /
        (state.leftFlipper.upAngle - state.leftFlipper.restAngle || 1),
      0,
      1,
    );
    const rightProgress = clamp(
      (state.rightFlipper.angle - state.rightFlipper.restAngle) /
        (state.rightFlipper.upAngle - state.rightFlipper.restAngle || 1),
      0,
      1,
    );

    state.leftFlipper.pivotX = layout.leftPivotX;
    state.leftFlipper.pivotY = layout.flipperY;
    state.leftFlipper.length = layout.flipperLength;
    state.leftFlipper.radius = layout.flipperRadius;
    state.leftFlipper.restAngle = PINBALL_FLIPPER_REST_ANGLE;
    state.leftFlipper.upAngle = PINBALL_FLIPPER_UP_ANGLE;
    state.leftFlipper.angle =
      state.leftFlipper.restAngle +
      (state.leftFlipper.upAngle - state.leftFlipper.restAngle) * leftProgress;

    state.rightFlipper.pivotX = layout.rightPivotX;
    state.rightFlipper.pivotY = layout.flipperY;
    state.rightFlipper.length = layout.flipperLength;
    state.rightFlipper.radius = layout.flipperRadius;
    state.rightFlipper.restAngle = Math.PI - PINBALL_FLIPPER_REST_ANGLE;
    state.rightFlipper.upAngle = Math.PI - PINBALL_FLIPPER_UP_ANGLE;
    state.rightFlipper.angle =
      state.rightFlipper.restAngle +
      (state.rightFlipper.upAngle - state.rightFlipper.restAngle) * rightProgress;

    state.tableW = width;
    state.tableH = height;
    state.initialized = true;
  }, []);

  const setLeftFlipper = useCallback(
    (isUp: boolean) => {
      const state = gameStateRef.current;
      if (!state.isAlive || state.phase === 'game-over') return;
      const changed = state.leftFlipper.isUp !== isUp;
      state.leftFlipper.isUp = isUp;
      setLeftFlipperActive(isUp);
      if (changed && isUp && soundEnabled) sounds.playFlipper();
    },
    [soundEnabled],
  );

  const setRightFlipper = useCallback(
    (isUp: boolean) => {
      const state = gameStateRef.current;
      if (!state.isAlive || state.phase === 'game-over') return;
      const changed = state.rightFlipper.isUp !== isUp;
      state.rightFlipper.isUp = isUp;
      setRightFlipperActive(isUp);
      if (changed && isUp && soundEnabled) sounds.playFlipper();
    },
    [soundEnabled],
  );

  const handleLastBallDrain = useCallback(
    (width: number, height: number) => {
      const state = gameStateRef.current;
      const result = resolvePinballDrain({
        ballsRemaining: state.balls.length,
        lives: state.lives,
        ballSaverSeconds: state.ballSaverTime,
        ballSaverAvailable: state.ballSaverAvailable,
      });

      state.ballSaverAvailable = result.ballSaverAvailable;
      if (result.action === 'continue') return;

      if (result.action === 'ball-save') {
        state.ballSaverTime = 0;
        state.phase = 'serving';
        state.serveTimer = 0.42;
        state.pendingNewLife = false;
        addScorePopup('BALL SAVED', width / 2, height * 0.72, '#34D399');
        if (soundEnabled) sounds.playShockwave();
        haptics.combo();
        return;
      }

      state.lives = result.lives;
      state.ballSaverTime = 0;
      state.ballSaverAvailable = false;
      haptics.impact();
      if (soundEnabled) sounds.playBuzz();

      if (result.action === 'new-life') {
        state.phase = 'serving';
        state.serveTimer = 0.78;
        state.pendingNewLife = true;
        addScorePopup(`BALL ${4 - state.lives}`, width / 2, height * 0.72, '#FACC15');
        return;
      }

      state.phase = 'game-over';
      state.isAlive = false;
      state.gameOverTimer = 0.65;
      state.gameOverReported = false;
      state.leftFlipper.isUp = false;
      state.rightFlipper.isUp = false;
      setLeftFlipperActive(false);
      setRightFlipperActive(false);
      if (soundEnabled) sounds.playGameOver();
      haptics.gameOver();
    },
    [addScorePopup, soundEnabled],
  );

  useEffect(() => {
    const state = gameStateRef.current;
    state.balls = [];
    state.bumpers = [];
    state.dropTargets = [];
    state.particles = [];
    state.floatingScores = [];
    state.leftFlipper = makeFlipper(false);
    state.rightFlipper = makeFlipper(true);
    state.score = 0;
    state.multiplier = 1;
    state.lives = 3;
    state.isAlive = true;
    state.phase = 'serving';
    state.serveTimer = 0.2;
    state.pendingNewLife = true;
    state.ballSaverTime = 0;
    state.ballSaverAvailable = false;
    state.kickbackLeftActive = true;
    state.kickbackRightActive = true;
    state.dropResetTimer = 0;
    state.physicsAccumulator = 0;
    state.gameOverTimer = 0;
    state.gameOverReported = false;
    state.shake = 0;
    state.nextBallId = 1;
    state.initialized = false;
    setHud(INITIAL_HUD);
    setLeftFlipperActive(false);
    setRightFlipperActive(false);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.code === 'ArrowLeft' ||
        event.code === 'ArrowRight' ||
        event.code === 'Space'
      ) {
        event.preventDefault();
      }

      if (event.code === 'KeyA' || event.code === 'ArrowLeft') {
        setLeftFlipper(true);
      } else if (event.code === 'KeyD' || event.code === 'ArrowRight') {
        setRightFlipper(true);
      } else if (event.code === 'Space') {
        setLeftFlipper(true);
        setRightFlipper(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'KeyA' || event.code === 'ArrowLeft') {
        setLeftFlipper(false);
      } else if (event.code === 'KeyD' || event.code === 'ArrowRight') {
        setRightFlipper(false);
      } else if (event.code === 'Space') {
        setLeftFlipper(false);
        setRightFlipper(false);
      }
    };

    const updateTouchFlippers = (touches: TouchList) => {
      const rect = canvas.getBoundingClientRect();
      let leftActive = false;
      let rightActive = false;
      for (const touch of Array.from(touches)) {
        if (touch.clientX - rect.left < rect.width / 2) leftActive = true;
        else rightActive = true;
      }
      setLeftFlipper(leftActive);
      setRightFlipper(rightActive);
    };

    const handleMouseDown = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (event.clientX - rect.left < rect.width / 2) setLeftFlipper(true);
      else setRightFlipper(true);
    };

    const handleMouseUp = () => {
      setLeftFlipper(false);
      setRightFlipper(false);
    };

    const handleTouchStart = (event: TouchEvent) => {
      event.preventDefault();
      updateTouchFlippers(event.touches);
    };

    const handleTouchMove = (event: TouchEvent) => {
      event.preventDefault();
      updateTouchFlippers(event.touches);
    };

    const handleTouchEnd = (event: TouchEvent) => {
      event.preventDefault();
      updateTouchFlippers(event.touches);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [setLeftFlipper, setRightFlipper]);

  useGameLoop({
    canvasRef,
    isPaused,
    onResize: (width, height) => {
      setupTable(width, height);
    },
    onUpdate: (ctx, deltaSec, width, height) => {
      const state = gameStateRef.current;
      const delta = Math.min(deltaSec, 0.05);
      const layout = getPinballLayout(width, height);

      if (!state.initialized) setupTable(width, height);

      const cooldownActive = (ball: Ball, key: string) => (ball.cooldowns[key] ?? 0) > 0;
      const setCooldown = (ball: Ball, key: string, seconds: number) => {
        ball.cooldowns[key] = seconds;
      };
      const playBounceOnce = (ball: Ball) => {
        if (cooldownActive(ball, 'wall-sound')) return;
        setCooldown(ball, 'wall-sound', 0.07);
        if (soundEnabled) sounds.playBounce();
      };

      const moveFlipper = (flipper: Flipper, step: number) => {
        const targetAngle = flipper.isUp ? flipper.upAngle : flipper.restAngle;
        const maxAngularSpeed = flipper.isUp ? 13.5 : 10.5;
        const angleDelta = clamp(
          targetAngle - flipper.angle,
          -maxAngularSpeed * step,
          maxAngularSpeed * step,
        );
        flipper.angle += angleDelta;
        flipper.angularVelocity = angleDelta / step;
      };

      const resolveFlipper = (ball: Ball, flipper: Flipper, key: string) => {
        const tipX = flipper.pivotX + Math.cos(flipper.angle) * flipper.length;
        const tipY = flipper.pivotY + Math.sin(flipper.angle) * flipper.length;
        const closest = closestPointOnSegment(
          ball.x,
          ball.y,
          flipper.pivotX,
          flipper.pivotY,
          tipX,
          tipY,
        );
        const contactDistance = closest.t * flipper.length;
        const surfaceVx = -Math.sin(flipper.angle) * flipper.angularVelocity * contactDistance;
        const surfaceVy = Math.cos(flipper.angle) * flipper.angularVelocity * contactDistance;
        const collision = resolveCircleSegment(
          ball,
          flipper.pivotX,
          flipper.pivotY,
          tipX,
          tipY,
          flipper.radius,
          0.9,
          surfaceVx,
          surfaceVy,
        );
        if (!collision || cooldownActive(ball, key)) return;

        setCooldown(ball, key, 0.055);
        const speedScale = getPinballSpeedScale(height);
        if (flipper.isUp) {
          ball.vx += collision.normalX * 95 * speedScale;
          ball.vy += collision.normalY * 95 * speedScale - 85 * speedScale;
        }
        capPinballSpeed(ball);
        awardScore(40, closest.x, closest.y - 10, '#38BDF8');
        haptics.light();
      };

      const handleTargetSetCompleted = () => {
        if (state.dropResetTimer > 0 || !state.dropTargets.every((target) => target.isHit)) {
          return;
        }
        state.multiplier = Math.min(5, state.multiplier + 1);
        state.dropResetTimer = 3.2;
        spawnExtraBall(width, height);
        addScorePopup('MULTIBALL FRENZY!', width / 2, height * 0.34, '#FACC15');
        if (soundEnabled) sounds.playPowerUp();
        haptics.combo();
      };

      const triggerKickback = (ball: Ball, side: 'left' | 'right') => {
        const active = side === 'left' ? state.kickbackLeftActive : state.kickbackRightActive;
        const result = consumePinballKickback(active);
        if (!result.triggered) return false;

        if (side === 'left') state.kickbackLeftActive = result.active;
        else state.kickbackRightActive = result.active;

        const speedScale = getPinballSpeedScale(height);
        ball.x = side === 'left'
          ? layout.leftBound + layout.kickbackWidth + ball.radius + 4
          : layout.rightBound - layout.kickbackWidth - ball.radius - 4;
        ball.y = layout.kickbackY - ball.radius - 2;
        ball.vx = (side === 'left' ? 230 : -230) * speedScale;
        ball.vy = -690 * speedScale;
        setCooldown(ball, `kickback-${side}`, 0.4);
        state.shake = 7;
        awardScore(
          350,
          ball.x,
          ball.y - 12,
          side === 'left' ? '#38BDF8' : '#F43F5E',
          'OUTLANE SAVE',
        );
        spawnParticles(ball.x, ball.y, side === 'left' ? '#38BDF8' : '#F43F5E', 16, 280);
        if (soundEnabled) sounds.playShockwave();
        haptics.combo();
        return true;
      };

      const stepSimulation = (step: number) => {
        moveFlipper(state.leftFlipper, step);
        moveFlipper(state.rightFlipper, step);

        const gravity = getPinballGravity(height);
        const speedScale = getPinballSpeedScale(height);
        const damping = Math.pow(0.9985, step * 60);

        for (const bumper of state.bumpers) {
          bumper.hitTimer = Math.max(0, bumper.hitTimer - step);
        }

        for (let ballIndex = state.balls.length - 1; ballIndex >= 0; ballIndex--) {
          const ball = state.balls[ballIndex];
          for (const key of Object.keys(ball.cooldowns)) {
            ball.cooldowns[key] -= step;
            if (ball.cooldowns[key] <= 0) delete ball.cooldowns[key];
          }

          ball.vy += gravity * step;
          ball.vx *= damping;
          ball.vy *= damping;
          ball.x += ball.vx * step;
          ball.y += ball.vy * step;
          capPinballSpeed(ball);

          ball.trail.push({ x: ball.x, y: ball.y });
          if (ball.trail.length > 14) ball.trail.shift();

          if (ball.x - ball.radius < layout.leftBound) {
            ball.x = layout.leftBound + ball.radius;
            ball.vx = Math.abs(ball.vx) * 0.84;
            playBounceOnce(ball);
          } else if (ball.x + ball.radius > layout.rightBound) {
            ball.x = layout.rightBound - ball.radius;
            ball.vx = -Math.abs(ball.vx) * 0.84;
            playBounceOnce(ball);
          }

          if (ball.y - ball.radius < layout.topBound) {
            ball.y = layout.topBound + ball.radius;
            ball.vy = Math.abs(ball.vy) * 0.84;
            playBounceOnce(ball);
          }

          const leftSlingStartX = layout.leftBound + 8;
          const leftSlingStartY = layout.slingY;
          const leftSlingEndX = layout.leftBound + clamp(width * 0.07, 46, 62);
          const leftSlingEndY = layout.slingY + clamp(height * 0.055, 30, 42);
          const leftSlingHit = resolveCircleSegment(
            ball,
            leftSlingStartX,
            leftSlingStartY,
            leftSlingEndX,
            leftSlingEndY,
            5,
            0.9,
          );
          if (leftSlingHit && !cooldownActive(ball, 'sling-left')) {
            setCooldown(ball, 'sling-left', 0.12);
            ball.vx += 240 * speedScale;
            ball.vy -= 290 * speedScale;
            capPinballSpeed(ball);
            awardScore(150, ball.x, ball.y, '#38BDF8');
            spawnParticles(ball.x, ball.y, '#38BDF8', 10, 220);
            if (soundEnabled) sounds.playBumper();
          }

          const rightSlingStartX = layout.rightBound - 8;
          const rightSlingStartY = layout.slingY;
          const rightSlingEndX = layout.rightBound - clamp(width * 0.07, 46, 62);
          const rightSlingEndY = layout.slingY + clamp(height * 0.055, 30, 42);
          const rightSlingHit = resolveCircleSegment(
            ball,
            rightSlingStartX,
            rightSlingStartY,
            rightSlingEndX,
            rightSlingEndY,
            5,
            0.9,
          );
          if (rightSlingHit && !cooldownActive(ball, 'sling-right')) {
            setCooldown(ball, 'sling-right', 0.12);
            ball.vx -= 240 * speedScale;
            ball.vy -= 290 * speedScale;
            capPinballSpeed(ball);
            awardScore(150, ball.x, ball.y, '#F43F5E');
            spawnParticles(ball.x, ball.y, '#F43F5E', 10, 220);
            if (soundEnabled) sounds.playBumper();
          }

          const leftGuideStartX = layout.leftBound + clamp(width * 0.06, 38, 54);
          const leftGuideStartY = layout.slingY + clamp(height * 0.075, 42, 56);
          const leftGuideEndX = layout.leftPivotX - clamp(width * 0.016, 10, 16);
          const leftGuideEndY = layout.flipperY - clamp(height * 0.035, 20, 28);
          resolveCircleSegment(
            ball,
            leftGuideStartX,
            leftGuideStartY,
            leftGuideEndX,
            leftGuideEndY,
            4,
            0.78,
          );

          const rightGuideStartX = layout.rightBound - clamp(width * 0.06, 38, 54);
          const rightGuideStartY = leftGuideStartY;
          const rightGuideEndX = layout.rightPivotX + clamp(width * 0.016, 10, 16);
          const rightGuideEndY = leftGuideEndY;
          resolveCircleSegment(
            ball,
            rightGuideStartX,
            rightGuideStartY,
            rightGuideEndX,
            rightGuideEndY,
            4,
            0.78,
          );

          if (
            ball.vy > 0 &&
            ball.y + ball.radius > layout.kickbackY &&
            ball.y - ball.radius < layout.drainY
          ) {
            if (
              ball.x - ball.radius < layout.leftBound + layout.kickbackWidth &&
              !cooldownActive(ball, 'kickback-left')
            ) {
              triggerKickback(ball, 'left');
            } else if (
              ball.x + ball.radius > layout.rightBound - layout.kickbackWidth &&
              !cooldownActive(ball, 'kickback-right')
            ) {
              triggerKickback(ball, 'right');
            }
          }

          for (const bumper of state.bumpers) {
            const collision = resolveCircleCircle(ball, bumper.x, bumper.y, bumper.radius, 0.88);
            if (!collision || cooldownActive(ball, `bumper-${bumper.id}`)) continue;

            setCooldown(ball, `bumper-${bumper.id}`, 0.105);
            ball.vx += collision.normalX * 285 * speedScale;
            ball.vy += collision.normalY * 285 * speedScale;
            capPinballSpeed(ball);
            bumper.hitTimer = 0.12;
            state.shake = 5;
            awardScore(bumper.points, bumper.x, bumper.y - bumper.radius - 8, bumper.color);
            spawnParticles(bumper.x, bumper.y, bumper.color, 12, 260);
            if (soundEnabled) sounds.playBumper();
            haptics.score();
          }

          for (const target of state.dropTargets) {
            if (target.isHit) continue;
            const collision = resolveCircleAabb(
              ball,
              target.x,
              target.y,
              target.w,
              target.h,
              0.8,
            );
            if (!collision || cooldownActive(ball, `target-${target.id}`)) continue;

            setCooldown(ball, `target-${target.id}`, 0.15);
            target.isHit = true;
            ball.vy += 120 * speedScale;
            awardScore(600, target.x + target.w / 2, target.y - 12, '#34D399', 'TARGET');
            spawnParticles(target.x + target.w / 2, target.y, '#34D399', 12, 210);
            if (soundEnabled) sounds.playScore();
            haptics.score();
            handleTargetSetCompleted();
          }

          resolveFlipper(ball, state.leftFlipper, 'flipper-left');
          resolveFlipper(ball, state.rightFlipper, 'flipper-right');

          const speed = Math.hypot(ball.vx, ball.vy);
          if (speed < 55 && ball.y < layout.flipperY - 35) {
            ball.lowSpeedTime += step;
            if (ball.lowSpeedTime > 1.5) {
              ball.lowSpeedTime = 0;
              ball.vx += (Math.random() - 0.5) * 150 * speedScale;
              ball.vy -= 130 * speedScale;
            }
          } else {
            ball.lowSpeedTime = 0;
          }

          capPinballSpeed(ball, PINBALL_MAX_BALL_SPEED);

          if (ball.y - ball.radius > layout.drainY) {
            state.balls.splice(ballIndex, 1);
            if (state.balls.length === 0) {
              handleLastBallDrain(width, height);
            }
          }
        }
      };

      if (!isPausedRef.current) {
        if (state.phase === 'serving') {
          state.serveTimer -= delta;
          if (state.serveTimer <= 0) {
            launchServe(width, height, state.pendingNewLife);
          }
        } else if (state.phase === 'playing') {
          state.ballSaverTime = Math.max(0, state.ballSaverTime - delta);
          if (state.ballSaverTime <= 0) state.ballSaverAvailable = false;

          if (state.dropResetTimer > 0) {
            state.dropResetTimer -= delta;
            if (state.dropResetTimer <= 0) {
              state.dropResetTimer = 0;
              state.dropTargets.forEach((target) => {
                target.isHit = false;
              });
            }
          }

          state.physicsAccumulator = Math.min(
            state.physicsAccumulator + delta,
            PINBALL_FIXED_STEP * PINBALL_MAX_SUBSTEPS,
          );
          let substeps = 0;
          while (
            state.physicsAccumulator >= PINBALL_FIXED_STEP &&
            substeps < PINBALL_MAX_SUBSTEPS &&
            state.phase === 'playing'
          ) {
            stepSimulation(PINBALL_FIXED_STEP);
            state.physicsAccumulator -= PINBALL_FIXED_STEP;
            substeps++;
          }
        } else if (state.phase === 'game-over' && !state.gameOverReported) {
          state.gameOverTimer -= delta;
          if (state.gameOverTimer <= 0) {
            state.gameOverReported = true;
            onGameOver(state.score);
          }
        }

        for (let i = state.particles.length - 1; i >= 0; i--) {
          const particle = state.particles[i];
          particle.x += particle.vx * delta;
          particle.y += particle.vy * delta;
          particle.vy += 260 * delta;
          particle.life += delta;
          if (particle.life >= particle.maxLife) state.particles.splice(i, 1);
        }

        for (let i = state.floatingScores.length - 1; i >= 0; i--) {
          const floatingScore = state.floatingScores[i];
          floatingScore.y -= 34 * delta;
          floatingScore.life += delta;
          if (floatingScore.life >= floatingScore.maxLife) {
            state.floatingScores.splice(i, 1);
          }
        }
      }

      state.shake *= Math.pow(0.045, delta);
      if (state.shake < 0.1) state.shake = 0;

      ctx.save();
      if (state.shake > 0) {
                if (!isArcadeReducedMotion()) {
          ctx.translate(
          (Math.random() - 0.5) * state.shake,
          (Math.random() - 0.5) * state.shake,
          );
        }
      }

      const background = ctx.createLinearGradient(0, 0, 0, height);
      background.addColorStop(0, '#070B13');
      background.addColorStop(1, '#090D16');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.035)';
      ctx.lineWidth = 1;
      for (let x = layout.leftBound; x <= layout.rightBound; x += 34) {
        ctx.beginPath();
        ctx.moveTo(x, layout.topBound);
        ctx.lineTo(x, layout.drainY);
        ctx.stroke();
      }

      ctx.strokeStyle = '#3F3F46';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(layout.leftBound, layout.drainY);
      ctx.lineTo(layout.leftBound, layout.topBound);
      ctx.lineTo(layout.rightBound, layout.topBound);
      ctx.lineTo(layout.rightBound, layout.drainY);
      ctx.stroke();

      const leftSlingEndX = layout.leftBound + clamp(width * 0.07, 46, 62);
      const leftSlingEndY = layout.slingY + clamp(height * 0.055, 30, 42);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(layout.leftBound + 8, layout.slingY);
      ctx.lineTo(leftSlingEndX, leftSlingEndY);
      ctx.lineTo(layout.leftBound + 8, leftSlingEndY + 24);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const rightSlingEndX = layout.rightBound - clamp(width * 0.07, 46, 62);
      ctx.fillStyle = 'rgba(244, 63, 94, 0.14)';
      ctx.strokeStyle = '#F43F5E';
      ctx.beginPath();
      ctx.moveTo(layout.rightBound - 8, layout.slingY);
      ctx.lineTo(rightSlingEndX, leftSlingEndY);
      ctx.lineTo(layout.rightBound - 8, leftSlingEndY + 24);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const leftGuideStartX = layout.leftBound + clamp(width * 0.06, 38, 54);
      const leftGuideStartY = layout.slingY + clamp(height * 0.075, 42, 56);
      const leftGuideEndX = layout.leftPivotX - clamp(width * 0.016, 10, 16);
      const leftGuideEndY = layout.flipperY - clamp(height * 0.035, 20, 28);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(leftGuideStartX, leftGuideStartY);
      ctx.lineTo(leftGuideEndX, leftGuideEndY);
      ctx.stroke();

      ctx.strokeStyle = '#F43F5E';
      ctx.beginPath();
      ctx.moveTo(layout.rightBound - clamp(width * 0.06, 38, 54), leftGuideStartY);
      ctx.lineTo(layout.rightPivotX + clamp(width * 0.016, 10, 16), leftGuideEndY);
      ctx.stroke();

      const drawKickback = (side: 'left' | 'right', active: boolean) => {
        const x = side === 'left'
          ? layout.leftBound + 3
          : layout.rightBound - layout.kickbackWidth - 3;
        const color = side === 'left' ? '#38BDF8' : '#F43F5E';
        ctx.fillStyle = active ? `${color}33` : 'rgba(63, 63, 70, 0.18)';
        ctx.strokeStyle = active ? color : '#52525B';
        ctx.lineWidth = 2;
        ctx.fillRect(x, layout.kickbackY, layout.kickbackWidth, layout.kickbackHeight);
        ctx.strokeRect(x, layout.kickbackY, layout.kickbackWidth, layout.kickbackHeight);
        ctx.fillStyle = active ? color : '#71717A';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          active ? 'READY' : 'USED',
          x + layout.kickbackWidth / 2,
          layout.kickbackY + layout.kickbackHeight / 2,
        );
      };
      drawKickback('left', state.kickbackLeftActive);
      drawKickback('right', state.kickbackRightActive);

      if (state.ballSaverAvailable && state.ballSaverTime > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.75)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(width / 2 - layout.centerGapHalf, layout.drainY - 4);
        ctx.lineTo(width / 2 + layout.centerGapHalf, layout.drainY - 4);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#34D399';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          `BALL SAVE ${Math.ceil(state.ballSaverTime)}s`,
          width / 2,
          layout.drainY - 13,
        );
        ctx.restore();
      }

      for (const target of state.dropTargets) {
        if (target.isHit) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
          ctx.lineWidth = 1;
          ctx.strokeRect(target.x, target.y, target.w, target.h);
          continue;
        }
        ctx.fillStyle = target.color;
        ctx.shadowColor = target.color;
        ctx.shadowBlur = 8;
        ctx.fillRect(target.x, target.y, target.w, target.h);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#D1FAE5';
        ctx.lineWidth = 1;
        ctx.strokeRect(target.x, target.y, target.w, target.h);
      }

      for (const bumper of state.bumpers) {
        const pulse = bumper.hitTimer > 0 ? 1.1 : 1;
        const radius = bumper.radius * pulse;
        ctx.fillStyle = bumper.glow;
        ctx.beginPath();
        ctx.arc(bumper.x, bumper.y, radius * 1.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = bumper.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(bumper.x, bumper.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = bumper.hitTimer > 0 ? '#FFFFFF' : bumper.color;
        ctx.beginPath();
        ctx.arc(bumper.x, bumper.y, radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${bumper.points}`, bumper.x, bumper.y);
      }

      const drawFlipper = (flipper: Flipper, color: string) => {
        const tipX = flipper.pivotX + Math.cos(flipper.angle) * flipper.length;
        const tipY = flipper.pivotY + Math.sin(flipper.angle) * flipper.length;
        ctx.strokeStyle = color;
        ctx.lineWidth = flipper.radius * 2;
        ctx.lineCap = 'round';
        ctx.shadowColor = color;
        ctx.shadowBlur = flipper.isUp ? 14 : 7;
        ctx.beginPath();
        ctx.moveTo(flipper.pivotX, flipper.pivotY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(flipper.pivotX, flipper.pivotY, flipper.radius * 0.72, 0, Math.PI * 2);
        ctx.fill();
      };
      drawFlipper(state.leftFlipper, state.leftFlipper.isUp ? '#38BDF8' : '#F43F5E');
      drawFlipper(state.rightFlipper, state.rightFlipper.isUp ? '#38BDF8' : '#F43F5E');

      for (const ball of state.balls) {
        if (ball.trail.length > 1) {
          for (let i = 1; i < ball.trail.length; i++) {
            const alpha = i / ball.trail.length;
            ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.45})`;
            ctx.lineWidth = 1 + alpha * 3;
            ctx.beginPath();
            ctx.moveTo(ball.trail[i - 1].x, ball.trail[i - 1].y);
            ctx.lineTo(ball.trail[i].x, ball.trail[i].y);
            ctx.stroke();
          }
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      for (const particle of state.particles) {
        const alpha = Math.max(0, 1 - particle.life / particle.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (const floatingScore of state.floatingScores) {
        const alpha = Math.max(0, 1 - floatingScore.life / floatingScore.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = floatingScore.color;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(floatingScore.text, floatingScore.x, floatingScore.y);
      }
      ctx.globalAlpha = 1;

      if (state.phase === 'serving') {
        ctx.fillStyle = 'rgba(9, 13, 22, 0.55)';
        ctx.fillRect(layout.leftBound, height * 0.43, layout.rightBound - layout.leftBound, 62);
        ctx.fillStyle = '#FACC15';
        ctx.font = 'bold 15px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          state.pendingNewLife ? `BALL ${4 - state.lives}` : 'BALL SAVED',
          width / 2,
          height * 0.48,
        );
      } else if (state.phase === 'game-over') {
        ctx.fillStyle = 'rgba(3, 5, 10, 0.72)';
        ctx.fillRect(layout.leftBound, height * 0.4, layout.rightBound - layout.leftBound, 92);
        ctx.fillStyle = '#F43F5E';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', width / 2, height * 0.46);
        ctx.fillStyle = '#A1A1AA';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`FINAL SCORE ${state.score}`, width / 2, height * 0.5);
      }

      ctx.restore();

      const nextHud: PinballHud = {
        lives: state.lives,
        multiplier: state.multiplier,
        multiball: state.balls.length > 1,
        saverSeconds: Math.ceil(state.ballSaverTime),
        saverAvailable: state.ballSaverAvailable && state.ballSaverTime > 0,
        leftKickback: state.kickbackLeftActive,
        rightKickback: state.kickbackRightActive,
        phase: state.phase,
      };
      setHud((previous) =>
        previous.lives === nextHud.lives &&
        previous.multiplier === nextHud.multiplier &&
        previous.multiball === nextHud.multiball &&
        previous.saverSeconds === nextHud.saverSeconds &&
        previous.saverAvailable === nextHud.saverAvailable &&
        previous.leftKickback === nextHud.leftKickback &&
        previous.rightKickback === nextHud.rightKickback &&
        previous.phase === nextHud.phase
          ? previous
          : nextHud,
      );

      return !state.gameOverReported;
    },
  });

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between select-none game-canvas-container touch-none bg-[#090D16] overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block cursor-pointer touch-none" />

      <div className="absolute top-3 left-4 right-4 flex items-start justify-between gap-3 z-10 pointer-events-none">
        <div className="flex flex-wrap items-center gap-2 bg-[#18181B]/90 border border-[#27272A] px-3.5 py-1.5 rounded-xl font-mono-arcade text-xs backdrop-blur-md">
          <div className="flex items-center gap-1 text-[#F43F5E]">
            {Array.from({ length: 3 }).map((_, index) => (
              <Heart
                key={index}
                className={`w-3.5 h-3.5 ${index < hud.lives ? 'fill-current' : 'opacity-25'}`}
              />
            ))}
          </div>
          <span className="text-[#71717A]">|</span>
          <div className="flex items-center gap-1 text-cyan-400 font-bold">
            <Trophy className="w-3.5 h-3.5" />
            <span>MULT x{hud.multiplier}</span>
          </div>
          {hud.multiball && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold flex items-center gap-1">
              <Disc className="w-3 h-3 animate-spin" /> MULTIBALL
            </span>
          )}
          {hud.saverAvailable && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-bold flex items-center gap-1">
              <Shield className="w-3 h-3" /> SAVE {hud.saverSeconds}s
            </span>
          )}
          <span className={`px-1.5 py-0.5 rounded font-bold ${
            hud.leftKickback || hud.rightKickback
              ? 'bg-cyan-500/10 text-cyan-300'
              : 'bg-zinc-700/30 text-zinc-500'
          }`}>
            KICKBACKS {Number(hud.leftKickback) + Number(hud.rightKickback)}/2
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-1 bg-[#18181B]/90 border border-[#27272A] px-3 py-1.5 rounded-xl font-mono-arcade text-xs text-[#A1A1AA] backdrop-blur-md">
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span>A/D OR TAP SIDES FOR FLIPPERS</span>
        </div>
      </div>

      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-4 z-10 pointer-events-auto">
        <button
          type="button"
          onPointerDown={(event) => {
            event.preventDefault();
            setLeftFlipper(true);
          }}
          onPointerUp={() => setLeftFlipper(false)}
          onPointerCancel={() => setLeftFlipper(false)}
          onPointerLeave={() => setLeftFlipper(false)}
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
          onPointerDown={(event) => {
            event.preventDefault();
            setRightFlipper(true);
          }}
          onPointerUp={() => setRightFlipper(false)}
          onPointerCancel={() => setRightFlipper(false)}
          onPointerLeave={() => setRightFlipper(false)}
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
