import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';

const W = 840;
const H = 560;
const COLS = 30;
const ROWS = 20;
const GOAL = 72;
const STEP_MS = 82;

type Dir = 'up' | 'down' | 'left' | 'right';
type Enemy = { x: number; y: number; vx: number; vy: number };
type Runtime = {
  cells: Uint8Array;
  x: number;
  y: number;
  safeX: number;
  safeY: number;
  drawing: boolean;
  armed: boolean;
  lives: number;
  score: number;
  chain: number;
  percent: number;
  enemies: Enemy[];
  secondSpawned: boolean;
  lastStep: number;
  hitCooldown: number;
  finished: boolean;
  shake: number;
};

type Hud = { lives: number; score: number; chain: number; percent: number; armed: boolean; hunters: number };

const index = (x: number, y: number) => y * COLS + x;
const inside = (x: number, y: number) => x >= 0 && x < COLS && y >= 0 && y < ROWS;
const directionDelta = (dir: Dir) => dir === 'up' ? [0, -1] : dir === 'down' ? [0, 1] : dir === 'left' ? [-1, 0] : [1, 0];

const makeInitialCells = () => {
  const cells = new Uint8Array(COLS * ROWS);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) cells[index(x, y)] = 1;
    }
  }
  return cells;
};

const initialRuntime = (): Runtime => ({
  cells: makeInitialCells(),
  x: 0,
  y: Math.floor(ROWS / 2),
  safeX: 0,
  safeY: Math.floor(ROWS / 2),
  drawing: false,
  armed: false,
  lives: 3,
  score: 0,
  chain: 0,
  percent: 0,
  enemies: [{ x: COLS * 0.63, y: ROWS * 0.48, vx: 3.1, vy: 2.55 }],
  secondSpawned: false,
  lastStep: 0,
  hitCooldown: 0,
  finished: false,
  shake: 0,
});

const interiorCount = (cells: Uint8Array) => {
  let count = 0;
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) if (cells[index(x, y)] === 1) count++;
  return count;
};

export const HexCapture: React.FC<GameComponentProps> = ({ onGameOver, onScoreUpdate, isPaused, soundEnabled }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<Runtime>(initialRuntime());
  const heldDir = useRef<Dir | null>(null);
  const gameOverSent = useRef(false);
  const [message, setMessage] = useState('PRESS SPACE — LEAVE SAFETY — RECONNECT');
  const [hud, setHud] = useState<Hud>({ lives: 3, score: 0, chain: 0, percent: 0, armed: false, hunters: 1 });

  const syncHud = useCallback(() => {
    const st = stateRef.current;
    setHud({ lives: st.lives, score: st.score, chain: st.chain, percent: st.percent, armed: st.armed || st.drawing, hunters: st.enemies.length });
  }, []);

  const finish = useCallback((won: boolean) => {
    const st = stateRef.current;
    if (st.finished || gameOverSent.current) return;
    st.finished = true;
    if (won) st.score += 8000 + st.lives * 1200;
    onScoreUpdate(st.score);
    gameOverSent.current = true;
    if (soundEnabled && won) sounds.playSuccess();
    onGameOver(st.score);
    syncHud();
  }, [onGameOver, onScoreUpdate, soundEnabled, syncHud]);

  const clearTrail = useCallback(() => {
    const cells = stateRef.current.cells;
    for (let i = 0; i < cells.length; i++) if (cells[i] === 2) cells[i] = 0;
  }, []);

  const loseLife = useCallback((reason = 'TRAIL HIT') => {
    const st = stateRef.current;
    const now = performance.now();
    if (st.finished || now < st.hitCooldown) return;
    st.hitCooldown = now + 650;
    clearTrail();
    st.drawing = false;
    st.armed = false;
    st.x = st.safeX;
    st.y = st.safeY;
    st.chain = 0;
    st.lives -= 1;
    st.shake = 12;
    if (soundEnabled) sounds.playHit();
    setMessage(`${reason} • ${Math.max(0, st.lives)} LIVES`);
    syncHud();
    if (st.lives <= 0) finish(false);
  }, [clearTrail, finish, soundEnabled, syncHud]);

  const closeCapture = useCallback(() => {
    const st = stateRef.current;
    const cells = st.cells;
    let trailCells = 0;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] === 2) { cells[i] = 1; trailCells++; }
    }
    if (!trailCells) {
      st.drawing = false;
      st.armed = false;
      syncHud();
      return;
    }

    const reachable = new Uint8Array(cells.length);
    const queueX = new Int16Array(cells.length);
    const queueY = new Int16Array(cells.length);
    let head = 0;
    let tail = 0;
    for (const enemy of st.enemies) {
      const sx = Math.max(1, Math.min(COLS - 2, Math.floor(enemy.x)));
      const sy = Math.max(1, Math.min(ROWS - 2, Math.floor(enemy.y)));
      const pos = index(sx, sy);
      if (cells[pos] === 1 || reachable[pos]) continue;
      reachable[pos] = 1;
      queueX[tail] = sx; queueY[tail] = sy; tail++;
    }
    while (head < tail) {
      const x = queueX[head];
      const y = queueY[head];
      head++;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
        const nx = x + dx; const ny = y + dy;
        if (nx <= 0 || nx >= COLS - 1 || ny <= 0 || ny >= ROWS - 1) continue;
        const pos = index(nx, ny);
        if (cells[pos] === 1 || reachable[pos]) continue;
        reachable[pos] = 1;
        queueX[tail] = nx; queueY[tail] = ny; tail++;
      }
    }

    let enclosed = 0;
    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        const pos = index(x, y);
        if (cells[pos] === 0 && !reachable[pos]) { cells[pos] = 1; enclosed++; }
      }
    }

    const claimed = trailCells + enclosed;
    st.drawing = false;
    st.armed = false;
    st.chain += 1;
    const totalInterior = (COLS - 2) * (ROWS - 2);
    st.percent = Math.min(100, interiorCount(cells) / totalInterior * 100);
    const chainBonus = Math.min(6, st.chain) * 420;
    const closureBonus = claimed * 90 + Math.floor(Math.sqrt(claimed) * 140) + chainBonus;
    st.score += closureBonus;
    st.safeX = st.x;
    st.safeY = st.y;
    st.shake = Math.min(9, 3 + claimed / 12);
    if (soundEnabled) sounds.playSuccess();
    onScoreUpdate(st.score);
    setMessage(claimed >= 55 ? `MEGA CAPTURE • +${closureBonus}` : `CAPTURE +${claimed} • +${closureBonus}`);

    if (!st.secondSpawned && st.percent >= 34) {
      st.secondSpawned = true;
      st.enemies.push({ x: COLS * 0.38, y: ROWS * 0.62, vx: -2.8, vy: 3.25 });
      setMessage('SECOND HUNTER ONLINE');
    }
    syncHud();
    if (st.percent >= GOAL) finish(true);
  }, [finish, onScoreUpdate, soundEnabled, syncHud]);

  const moveStep = useCallback((dir: Dir) => {
    const st = stateRef.current;
    if (isPaused || st.finished || performance.now() < st.hitCooldown) return;
    const [dx, dy] = directionDelta(dir);
    const nx = st.x + dx;
    const ny = st.y + dy;
    if (!inside(nx, ny)) return;
    const next = st.cells[index(nx, ny)];
    const current = st.cells[index(st.x, st.y)];

    if (next === 2) {
      loseLife('TRAIL CROSSED');
      return;
    }
    if (next === 0 && !st.drawing && !st.armed) return;

    if (next === 0) {
      if (!st.drawing) {
        st.drawing = true;
        st.safeX = st.x;
        st.safeY = st.y;
        setMessage('EXPOSED • RECONNECT TO SAFETY');
      }
      st.cells[index(nx, ny)] = 2;
    }

    st.x = nx;
    st.y = ny;

    if (st.drawing && next === 1) {
      closeCapture();
    } else if (!st.drawing && current === 1 && next === 1) {
      st.safeX = nx;
      st.safeY = ny;
    }
  }, [closeCapture, isPaused, loseLife]);

  const toggleCapture = useCallback(() => {
    const st = stateRef.current;
    if (isPaused || st.finished || st.drawing) return;
    st.armed = !st.armed;
    setMessage(st.armed ? 'CAPTURE ARMED • LEAVE THE SAFE ZONE' : 'CAPTURE CANCELLED');
    if (soundEnabled) sounds.playClick();
    syncHud();
  }, [isPaused, soundEnabled, syncHud]);

  useEffect(() => {
    const keyToDir = (code: string): Dir | null => {
      if (code === 'ArrowUp' || code === 'KeyW') return 'up';
      if (code === 'ArrowDown' || code === 'KeyS') return 'down';
      if (code === 'ArrowLeft' || code === 'KeyA') return 'left';
      if (code === 'ArrowRight' || code === 'KeyD') return 'right';
      return null;
    };
    const down = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      const dir = keyToDir(event.code);
      if (dir) {
        event.preventDefault();
        heldDir.current = dir;
        if (!event.repeat) moveStep(dir);
      } else if (event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        toggleCapture();
      }
    };
    const up = (event: KeyboardEvent) => {
      const dir = keyToDir(event.code);
      if (dir && heldDir.current === dir) heldDir.current = null;
    };
    window.addEventListener('keydown', down, { capture: true });
    window.addEventListener('keyup', up, { capture: true });
    return () => {
      window.removeEventListener('keydown', down, { capture: true });
      window.removeEventListener('keyup', up, { capture: true });
    };
  }, [moveStep, toggleCapture]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const st = stateRef.current;
      const dt = Math.min(0.033, Math.max(0, (now - last) / 1000));
      last = now;

      if (!isPaused && !st.finished) {
        if (heldDir.current && now - st.lastStep >= STEP_MS) {
          st.lastStep = now;
          moveStep(heldDir.current);
        }

        for (const enemy of st.enemies) {
          let nx = enemy.x + enemy.vx * dt;
          let ny = enemy.y + enemy.vy * dt;
          const cellAt = (x: number, y: number) => {
            const cx = Math.max(0, Math.min(COLS - 1, Math.floor(x)));
            const cy = Math.max(0, Math.min(ROWS - 1, Math.floor(y)));
            return st.cells[index(cx, cy)];
          };
          const xBlocked = cellAt(nx, enemy.y) === 1;
          const yBlocked = cellAt(enemy.x, ny) === 1;
          if (xBlocked) { enemy.vx *= -1; nx = enemy.x + enemy.vx * dt; }
          if (yBlocked) { enemy.vy *= -1; ny = enemy.y + enemy.vy * dt; }
          if (cellAt(nx, ny) === 1) { enemy.vx *= -1; enemy.vy *= -1; nx = enemy.x + enemy.vx * dt; ny = enemy.y + enemy.vy * dt; }
          enemy.x = Math.max(1.05, Math.min(COLS - 1.05, nx));
          enemy.y = Math.max(1.05, Math.min(ROWS - 1.05, ny));
          const underEnemy = cellAt(enemy.x, enemy.y);
          if (underEnemy === 2 || (st.drawing && Math.hypot(enemy.x - (st.x + 0.5), enemy.y - (st.y + 0.5)) < 0.7)) {
            loseLife('HUNTER HIT TRAIL');
            break;
          }
        }
      }

      const cw = W / COLS;
      const ch = H / ROWS;
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      if (st.shake > 0) {
        ctx.translate((Math.random() - 0.5) * st.shake, (Math.random() - 0.5) * st.shake);
        st.shake *= 0.76;
        if (st.shake < 0.25) st.shake = 0;
      }
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#0a0a18');
      bg.addColorStop(1, '#17102c');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const value = st.cells[index(x, y)];
          if (value === 1) {
            ctx.fillStyle = (x + y) % 2 ? '#312e81' : '#3730a3';
            ctx.fillRect(x * cw + 1, y * ch + 1, cw - 2, ch - 2);
          } else if (value === 2) {
            ctx.fillStyle = '#22d3ee';
            ctx.fillRect(x * cw + 2, y * ch + 2, cw - 4, ch - 4);
          } else {
            ctx.strokeStyle = 'rgba(167,139,250,.08)';
            ctx.strokeRect(x * cw + 0.5, y * ch + 0.5, cw - 1, ch - 1);
          }
        }
      }

      ctx.strokeStyle = 'rgba(196,181,253,.13)';
      ctx.lineWidth = 1;
      for (let y = 0; y < ROWS; y += 2) {
        for (let x = 1; x < COLS - 1; x += 2) {
          const cx = (x + 0.5) * cw;
          const cy = (y + 0.5) * ch;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = Math.PI / 3 * i;
            const px = cx + Math.cos(a) * Math.min(cw, ch) * 0.34;
            const py = cy + Math.sin(a) * Math.min(cw, ch) * 0.34;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath(); ctx.stroke();
        }
      }

      for (const enemy of st.enemies) {
        const ex = enemy.x * cw;
        const ey = enemy.y * ch;
        const pulse = 8 + Math.sin(now * 0.008) * 2;
        ctx.beginPath(); ctx.arc(ex, ey, pulse + 7, 0, Math.PI * 2); ctx.fillStyle = 'rgba(244,63,94,.15)'; ctx.fill();
        ctx.beginPath(); ctx.arc(ex, ey, pulse, 0, Math.PI * 2); ctx.fillStyle = '#fb7185'; ctx.fill();
        ctx.strokeStyle = '#fecdd3'; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex - 5, ey - 5); ctx.lineTo(ex + 5, ey + 5); ctx.moveTo(ex + 5, ey - 5); ctx.lineTo(ex - 5, ey + 5); ctx.stroke();
      }

      const px = (st.x + 0.5) * cw;
      const py = (st.y + 0.5) * ch;
      ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fillStyle = st.drawing ? '#22d3ee' : st.armed ? '#facc15' : '#f8fafc';
      ctx.shadowColor = st.drawing ? '#22d3ee' : '#a78bfa'; ctx.shadowBlur = 16; ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = '#111827'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [isPaused, loseLife, moveStep]);

  const pressDir = (dir: Dir) => {
    heldDir.current = dir;
    moveStep(dir);
  };
  const releaseDir = (dir: Dir) => { if (heldDir.current === dir) heldDir.current = null; };

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#090812] text-white" data-replacement-game="hex-capture">
      <div className="flex items-center justify-between gap-2 border-b border-violet-400/20 bg-[#0b0916]/95 px-3 py-2 text-[10px] font-mono-arcade sm:text-xs">
        <div><span className="text-violet-300">CAPTURE</span> {hud.percent.toFixed(1)}% <span className="text-slate-500">/ {GOAL}%</span></div>
        <div><span className="text-rose-300">LIVES</span> {hud.lives}</div>
        <div><span className="text-violet-300">CHAIN</span> x{hud.chain}</div>
        <div><span className="text-violet-300">SCORE</span> {hud.score.toLocaleString()}</div>
      </div>
      <div className="relative min-h-0 flex-1 p-2 sm:p-3">
        <canvas ref={canvasRef} width={W} height={H} className="h-full w-full rounded-xl border border-violet-400/25 bg-[#0a0914] object-contain shadow-[0_0_30px_rgba(139,92,246,.08)]" aria-label="Hex Capture territory field" />
        <div className="pointer-events-none absolute bottom-5 left-1/2 max-w-[92%] -translate-x-1/2 rounded-full border border-white/10 bg-black/70 px-3 py-1 text-center text-[10px] font-mono-arcade tracking-wider text-slate-100 sm:text-xs">
          {message}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-violet-400/20 bg-[#0b0916]/95 px-2 py-2 sm:px-3">
        <div className="hidden text-[10px] font-mono-arcade text-slate-400 sm:block">WASD / ARROWS • SPACE CAPTURE</div>
        <div className="grid grid-cols-3 grid-rows-2 gap-1" aria-label="Touch direction controls">
          <span />
          <button type="button" aria-label="Move up" onPointerDown={() => pressDir('up')} onPointerUp={() => releaseDir('up')} onPointerCancel={() => releaseDir('up')} className="h-9 w-10 rounded-lg border border-violet-400/25 bg-violet-500/10 text-sm text-violet-100 active:bg-violet-500/30">▲</button>
          <span />
          <button type="button" aria-label="Move left" onPointerDown={() => pressDir('left')} onPointerUp={() => releaseDir('left')} onPointerCancel={() => releaseDir('left')} className="h-9 w-10 rounded-lg border border-violet-400/25 bg-violet-500/10 text-sm text-violet-100 active:bg-violet-500/30">◀</button>
          <button type="button" aria-label="Move down" onPointerDown={() => pressDir('down')} onPointerUp={() => releaseDir('down')} onPointerCancel={() => releaseDir('down')} className="h-9 w-10 rounded-lg border border-violet-400/25 bg-violet-500/10 text-sm text-violet-100 active:bg-violet-500/30">▼</button>
          <button type="button" aria-label="Move right" onPointerDown={() => pressDir('right')} onPointerUp={() => releaseDir('right')} onPointerCancel={() => releaseDir('right')} className="h-9 w-10 rounded-lg border border-violet-400/25 bg-violet-500/10 text-sm text-violet-100 active:bg-violet-500/30">▶</button>
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={toggleCapture} aria-pressed={hud.armed} aria-label="Arm capture route" className={`min-h-10 rounded-xl border px-3 py-2 text-[10px] font-mono-arcade font-bold sm:text-xs ${hud.armed ? 'border-amber-300 bg-amber-400/20 text-amber-100' : 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100'}`}>
            {hud.armed ? 'CAPTURE ARMED' : 'CAPTURE'}
          </button>
        </div>
      </div>
    </div>
  );
};
