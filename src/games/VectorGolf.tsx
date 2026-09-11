import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';

const W = 900;
const H = 560;
const BALL_R = 10;
const CUP_R = 17;

type Point = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };
type Bumper = Point & { r: number };
type Mover = { from: Point; to: Point; r: number; speed: number; phase?: number };
type Hole = {
  start: Point;
  cup: Point;
  par: number;
  walls: Rect[];
  bumpers: Bumper[];
  movers: Mover[];
  stars: Point[];
};

const HOLES: Hole[] = [
  { start: { x: 90, y: 455 }, cup: { x: 808, y: 106 }, par: 3, walls: [{ x: 360, y: 205, w: 38, h: 280 }], bumpers: [{ x: 585, y: 350, r: 27 }], movers: [], stars: [{ x: 252, y: 390 }, { x: 540, y: 170 }, { x: 710, y: 128 }] },
  { start: { x: 110, y: 120 }, cup: { x: 792, y: 435 }, par: 4, walls: [{ x: 258, y: 82, w: 38, h: 300 }, { x: 558, y: 178, w: 38, h: 300 }], bumpers: [{ x: 430, y: 275, r: 30 }], movers: [{ from: { x: 665, y: 130 }, to: { x: 770, y: 245 }, r: 20, speed: 1.1 }], stars: [{ x: 190, y: 220 }, { x: 430, y: 438 }, { x: 700, y: 330 }] },
  { start: { x: 82, y: 290 }, cup: { x: 815, y: 286 }, par: 4, walls: [{ x: 250, y: 95, w: 36, h: 300 }, { x: 615, y: 165, w: 36, h: 300 }], bumpers: [{ x: 445, y: 150, r: 30 }, { x: 445, y: 415, r: 30 }], movers: [], stars: [{ x: 178, y: 182 }, { x: 445, y: 285 }, { x: 715, y: 390 }] },
  { start: { x: 118, y: 458 }, cup: { x: 770, y: 88 }, par: 5, walls: [{ x: 212, y: 300, w: 330, h: 34 }, { x: 540, y: 130, w: 34, h: 204 }], bumpers: [{ x: 350, y: 155, r: 25 }], movers: [{ from: { x: 650, y: 375 }, to: { x: 765, y: 275 }, r: 23, speed: 1.45, phase: 0.4 }], stars: [{ x: 170, y: 360 }, { x: 410, y: 260 }, { x: 680, y: 190 }] },
  { start: { x: 88, y: 94 }, cup: { x: 812, y: 462 }, par: 5, walls: [{ x: 190, y: 170, w: 440, h: 34 }, { x: 310, y: 355, w: 420, h: 34 }], bumpers: [{ x: 745, y: 180, r: 26 }, { x: 205, y: 405, r: 26 }], movers: [], stars: [{ x: 160, y: 128 }, { x: 680, y: 285 }, { x: 755, y: 430 }] },
  { start: { x: 92, y: 470 }, cup: { x: 805, y: 88 }, par: 5, walls: [{ x: 250, y: 100, w: 34, h: 300 }, { x: 505, y: 170, w: 34, h: 300 }], bumpers: [{ x: 390, y: 110, r: 23 }, { x: 665, y: 430, r: 23 }], movers: [{ from: { x: 365, y: 300 }, to: { x: 700, y: 250 }, r: 24, speed: 1.2 }], stars: [{ x: 170, y: 415 }, { x: 390, y: 215 }, { x: 700, y: 150 }] },
];

type Ball = Point & { vx: number; vy: number };
type Runtime = {
  hole: number;
  ball: Ball;
  strokes: number;
  totalScore: number;
  holeElapsed: number;
  starMask: number;
  banksThisHole: number;
  dragging: boolean;
  dragPoint: Point;
  aim: number;
  power: number;
  guide: boolean;
  transitionAt: number;
  finished: boolean;
  shake: number;
};

type Hud = { hole: number; par: number; strokes: number; score: number; stars: number; power: number; guide: boolean };

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const stopped = (ball: Ball) => Math.hypot(ball.vx, ball.vy) < 5;

const initialRuntime = (): Runtime => ({
  hole: 0,
  ball: { ...HOLES[0].start, vx: 0, vy: 0 },
  strokes: 0,
  totalScore: 0,
  holeElapsed: 0,
  starMask: 0,
  banksThisHole: 0,
  dragging: false,
  dragPoint: { ...HOLES[0].start },
  aim: -Math.PI / 4,
  power: 0.56,
  guide: true,
  transitionAt: 0,
  finished: false,
  shake: 0,
});

export const VectorGolf: React.FC<GameComponentProps> = ({ onGameOver, onScoreUpdate, isPaused, soundEnabled }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<Runtime>(initialRuntime());
  const gameOverSent = useRef(false);
  const [message, setMessage] = useState('DRAG FROM THE BALL — RELEASE TO SHOOT');
  const [hud, setHud] = useState<Hud>({ hole: 1, par: HOLES[0].par, strokes: 0, score: 0, stars: 0, power: 0.56, guide: true });

  const syncHud = useCallback(() => {
    const st = stateRef.current;
    const hole = HOLES[st.hole];
    setHud({
      hole: st.hole + 1,
      par: hole?.par ?? 0,
      strokes: st.strokes,
      score: st.totalScore,
      stars: st.starMask.toString(2).split('1').length - 1,
      power: st.power,
      guide: st.guide,
    });
  }, []);

  const loadHole = useCallback((index: number) => {
    const hole = HOLES[index];
    const st = stateRef.current;
    st.hole = index;
    st.ball = { ...hole.start, vx: 0, vy: 0 };
    st.strokes = 0;
    st.holeElapsed = 0;
    st.starMask = 0;
    st.banksThisHole = 0;
    st.dragging = false;
    st.dragPoint = { ...hole.start };
    st.aim = Math.atan2(hole.cup.y - hole.start.y, hole.cup.x - hole.start.x);
    st.power = 0.56;
    st.transitionAt = 0;
    setMessage(`HOLE ${index + 1} • PAR ${hole.par}`);
    syncHud();
  }, [syncHud]);

  const takeShot = useCallback((dx: number, dy: number, normalizedPower?: number) => {
    const st = stateRef.current;
    if (isPaused || st.finished || st.transitionAt || !stopped(st.ball)) return;
    const mag = Math.hypot(dx, dy);
    if (mag < 0.001) return;
    const power = normalizedPower ?? Math.min(1, Math.max(0.18, mag / 150));
    const speed = 340 + power * 760;
    st.ball.vx = (dx / mag) * speed;
    st.ball.vy = (dy / mag) * speed;
    st.strokes += 1;
    st.power = power;
    st.aim = Math.atan2(dy, dx);
    st.banksThisHole = 0;
    st.dragging = false;
    if (soundEnabled) sounds.playPop();
    setMessage(st.strokes <= HOLES[st.hole].par ? 'VECTOR LOCKED' : 'RECOVERY SHOT');
    syncHud();
  }, [isPaused, soundEnabled, syncHud]);

  const pointerToWorld = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * W / rect.width, y: (event.clientY - rect.top) * H / rect.height };
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const st = stateRef.current;
    if (isPaused || st.finished || st.transitionAt || !stopped(st.ball)) return;
    const p = pointerToWorld(event);
    if (distance(p, st.ball) > 85) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    st.dragging = true;
    st.dragPoint = p;
  }, [isPaused, pointerToWorld]);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const st = stateRef.current;
    if (!st.dragging) return;
    st.dragPoint = pointerToWorld(event);
  }, [pointerToWorld]);

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const st = stateRef.current;
    if (!st.dragging) return;
    const p = pointerToWorld(event);
    st.dragPoint = p;
    const dx = st.ball.x - p.x;
    const dy = st.ball.y - p.y;
    takeShot(dx, dy);
  }, [pointerToWorld, takeShot]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isPaused) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      const st = stateRef.current;
      if (event.code === 'KeyG') {
        st.guide = !st.guide;
        setMessage(st.guide ? 'GUIDE ON' : 'GUIDE OFF');
        syncHud();
        return;
      }
      if (!stopped(st.ball) || st.finished || st.transitionAt) return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'Space'].includes(event.code)) event.preventDefault();
      if (event.code === 'ArrowLeft') st.aim -= 0.12;
      else if (event.code === 'ArrowRight') st.aim += 0.12;
      else if (event.code === 'ArrowUp' || event.code === 'KeyW') st.power = Math.min(1, st.power + 0.08);
      else if (event.code === 'ArrowDown' || event.code === 'KeyS') st.power = Math.max(0.18, st.power - 0.08);
      else if (event.code === 'Space') {
        takeShot(Math.cos(st.aim), Math.sin(st.aim), st.power);
        return;
      }
      syncHud();
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [isPaused, syncHud, takeShot]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const render = (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const st = stateRef.current;
      const hole = HOLES[Math.min(st.hole, HOLES.length - 1)];
      const dt = Math.min(0.033, Math.max(0, (now - last) / 1000));
      last = now;

      if (!isPaused && !st.finished) {
        if (st.transitionAt && now >= st.transitionAt) {
          const next = st.hole + 1;
          if (next >= HOLES.length) {
            st.finished = true;
            if (!gameOverSent.current) {
              gameOverSent.current = true;
              onScoreUpdate(st.totalScore);
              onGameOver(st.totalScore);
            }
          } else loadHole(next);
        } else if (!st.transitionAt) {
          st.holeElapsed += dt;
          const ball = st.ball;
          if (!stopped(ball)) {
            const previous = { x: ball.x, y: ball.y };
            ball.x += ball.vx * dt;
            ball.y += ball.vy * dt;
            const damping = Math.pow(0.986, dt * 60);
            ball.vx *= damping;
            ball.vy *= damping;

            let banked = false;
            if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx) * 0.88; banked = true; }
            if (ball.x > W - BALL_R) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx) * 0.88; banked = true; }
            if (ball.y < BALL_R) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy) * 0.88; banked = true; }
            if (ball.y > H - BALL_R) { ball.y = H - BALL_R; ball.vy = -Math.abs(ball.vy) * 0.88; banked = true; }

            for (const rect of hole.walls) {
              const left = rect.x - BALL_R;
              const right = rect.x + rect.w + BALL_R;
              const top = rect.y - BALL_R;
              const bottom = rect.y + rect.h + BALL_R;
              if (ball.x <= left || ball.x >= right || ball.y <= top || ball.y >= bottom) continue;
              const distances = [Math.abs(ball.x - left), Math.abs(right - ball.x), Math.abs(ball.y - top), Math.abs(bottom - ball.y)];
              const side = distances.indexOf(Math.min(...distances));
              if (side === 0) { ball.x = left; ball.vx = -Math.abs(ball.vx) * 0.84; }
              else if (side === 1) { ball.x = right; ball.vx = Math.abs(ball.vx) * 0.84; }
              else if (side === 2) { ball.y = top; ball.vy = -Math.abs(ball.vy) * 0.84; }
              else { ball.y = bottom; ball.vy = Math.abs(ball.vy) * 0.84; }
              banked = true;
            }

            const allBumpers: Bumper[] = [...hole.bumpers];
            hole.movers.forEach((mover) => {
              const t = (Math.sin(now * 0.001 * mover.speed + (mover.phase ?? 0)) + 1) / 2;
              allBumpers.push({ x: mover.from.x + (mover.to.x - mover.from.x) * t, y: mover.from.y + (mover.to.y - mover.from.y) * t, r: mover.r });
            });
            for (const bumper of allBumpers) {
              const dx = ball.x - bumper.x;
              const dy = ball.y - bumper.y;
              const dist = Math.hypot(dx, dy);
              const minDist = BALL_R + bumper.r;
              if (dist <= 0 || dist >= minDist) continue;
              const nx = dx / dist;
              const ny = dy / dist;
              ball.x = bumper.x + nx * minDist;
              ball.y = bumper.y + ny * minDist;
              const dot = ball.vx * nx + ball.vy * ny;
              ball.vx = (ball.vx - 2 * dot * nx) * 0.92;
              ball.vy = (ball.vy - 2 * dot * ny) * 0.92;
              banked = true;
              st.shake = 5;
            }
            if (banked && distance(previous, ball) > 0.5) st.banksThisHole += 1;

            hole.stars.forEach((star, index) => {
              if (st.starMask & (1 << index)) return;
              if (distance(ball, star) < 22) {
                st.starMask |= 1 << index;
                if (soundEnabled) sounds.playScore();
                setMessage('ROUTE STAR +400');
                syncHud();
              }
            });

            if (distance(ball, hole.cup) < CUP_R + 8 && Math.hypot(ball.vx, ball.vy) < 290) {
              ball.x = hole.cup.x;
              ball.y = hole.cup.y;
              ball.vx = 0;
              ball.vy = 0;
              const stars = st.starMask.toString(2).split('1').length - 1;
              const underPar = Math.max(-2, hole.par - st.strokes);
              const holeScore = Math.max(350, 2500 + underPar * 450 - Math.max(0, st.strokes - hole.par) * 280 - Math.floor(st.holeElapsed * 4)) + stars * 400 + Math.min(5, st.banksThisHole) * 90;
              st.totalScore += holeScore;
              onScoreUpdate(st.totalScore);
              st.transitionAt = now + 720;
              st.shake = 8;
              if (soundEnabled) sounds.playSuccess();
              setMessage(underPar > 0 ? `UNDER PAR • +${holeScore}` : `HOLE CLEAR • +${holeScore}`);
              syncHud();
            } else if (Math.hypot(ball.vx, ball.vy) < 5) {
              ball.vx = 0;
              ball.vy = 0;
            }

            if (st.strokes > hole.par + 5 && stopped(ball)) {
              st.totalScore += 180;
              onScoreUpdate(st.totalScore);
              st.transitionAt = now + 520;
              setMessage('STROKE LIMIT • MOVE ON');
              syncHud();
            }
          }
        }
      }

      ctx.clearRect(0, 0, W, H);
      ctx.save();
      if (st.shake > 0) {
        ctx.translate((Math.random() - 0.5) * st.shake, (Math.random() - 0.5) * st.shake);
        st.shake *= 0.78;
        if (st.shake < 0.25) st.shake = 0;
      }
      const gradient = ctx.createLinearGradient(0, 0, W, H);
      gradient.addColorStop(0, '#07141a');
      gradient.addColorStop(1, '#11152b');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(34,211,238,.07)';
      ctx.lineWidth = 1;
      for (let x = 20; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 20; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      ctx.fillStyle = '#172033';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      for (const wall of hole.walls) {
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
        ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
      }

      const drawBumper = (bumper: Bumper, moving = false) => {
        ctx.beginPath(); ctx.arc(bumper.x, bumper.y, bumper.r, 0, Math.PI * 2);
        ctx.fillStyle = moving ? '#7c3aed' : '#0f766e'; ctx.fill();
        ctx.strokeStyle = moving ? '#c4b5fd' : '#5eead4'; ctx.lineWidth = 3; ctx.stroke();
      };
      hole.bumpers.forEach((bumper) => drawBumper(bumper));
      hole.movers.forEach((mover) => {
        const t = (Math.sin(now * 0.001 * mover.speed + (mover.phase ?? 0)) + 1) / 2;
        drawBumper({ x: mover.from.x + (mover.to.x - mover.from.x) * t, y: mover.from.y + (mover.to.y - mover.from.y) * t, r: mover.r }, true);
      });

      hole.stars.forEach((star, index) => {
        if (st.starMask & (1 << index)) return;
        ctx.save(); ctx.translate(star.x, star.y); ctx.rotate(now * 0.001);
        ctx.fillStyle = '#facc15'; ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? 6 : 13;
          const a = -Math.PI / 2 + i * Math.PI / 5;
          const x = Math.cos(a) * r; const y = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.fill(); ctx.restore();
      });

      ctx.beginPath(); ctx.arc(hole.cup.x, hole.cup.y, CUP_R + 5, 0, Math.PI * 2);
      ctx.fillStyle = '#020617'; ctx.fill(); ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hole.cup.x, hole.cup.y - 4); ctx.lineTo(hole.cup.x, hole.cup.y - 58); ctx.strokeStyle = '#e2e8f0'; ctx.stroke();
      ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.moveTo(hole.cup.x, hole.cup.y - 58); ctx.lineTo(hole.cup.x + 34, hole.cup.y - 45); ctx.lineTo(hole.cup.x, hole.cup.y - 34); ctx.closePath(); ctx.fill();

      if (stopped(st.ball) && !st.transitionAt && !st.finished) {
        const length = 55 + st.power * 110;
        const ax = st.ball.x + Math.cos(st.aim) * length;
        const ay = st.ball.y + Math.sin(st.aim) * length;
        if (st.guide) {
          ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(st.ball.x, st.ball.y); ctx.lineTo(ax, ay); ctx.stroke(); ctx.setLineDash([]);
        }
        if (st.dragging) {
          ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(st.ball.x, st.ball.y); ctx.lineTo(st.dragPoint.x, st.dragPoint.y); ctx.stroke();
        }
      }

      ctx.beginPath(); ctx.arc(st.ball.x, st.ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = '#f8fafc'; ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 15; ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();

      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [isPaused, loadHole, onGameOver, onScoreUpdate, soundEnabled, syncHud]);

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-slate-950 text-white" data-replacement-game="vector-golf">
      <span className="sr-only" aria-hidden="true">FLIGHT CONTRACT</span>
      <div className="flex items-center justify-between gap-3 border-b border-cyan-400/20 bg-slate-950/90 px-3 py-2 text-[10px] font-mono-arcade sm:text-xs">
        <div><span className="text-cyan-300">HOLE</span> {hud.hole}/{HOLES.length} <span className="ml-2 text-slate-500">PAR {hud.par}</span></div>
        <div><span className="text-cyan-300">STROKES</span> {hud.strokes}</div>
        <div><span className="text-amber-300">★</span> {hud.stars}/3</div>
        <div><span className="text-cyan-300">SCORE</span> {hud.score.toLocaleString()}</div>
      </div>
      <div className="relative min-h-0 flex-1 p-2 sm:p-3">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="h-full w-full touch-none rounded-xl border border-cyan-400/25 bg-[#07141a] object-contain shadow-[0_0_30px_rgba(34,211,238,.08)]"
          aria-label="Vector Golf course"
        />
        <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/65 px-3 py-1 text-center text-[10px] font-mono-arcade tracking-wider text-slate-200 sm:text-xs">
          {message}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-cyan-400/20 bg-slate-950/90 px-3 py-2 text-[10px] font-mono-arcade text-slate-400 sm:text-xs">
        <span>DRAG AIM • ARROWS AIM • W/S POWER • SPACE SHOOT</span>
        <span className="whitespace-nowrap">POWER {Math.round(hud.power * 100)}% • GUIDE {hud.guide ? 'ON' : 'OFF'}</span>
      </div>
    </div>
  );
};
