import React from 'react';
import type { LaserRopeMode } from '../lib/laserRopePresentation';

interface LaserRopeHudState {
  score: number;
  jumpStreak: number;
  rpm: number;
  multiplier: number;
  feverPercent: number;
  hasShield: boolean;
  laserMode: LaserRopeMode;
  isFeverActive: boolean;
}

interface LaserRopeHudProps {
  state: LaserRopeHudState;
}

export const LaserRopeHud: React.FC<LaserRopeHudProps> = ({ state }) => {
  return (
    <div className="absolute top-2 left-2 right-2 z-10 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-1.5 pointer-events-none font-mono-arcade">
      <div className="min-w-0 rounded-xl border border-cyan-400/25 bg-[#07101E]/90 px-2 py-1.5 shadow-lg shadow-cyan-950/30 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[7px] sm:text-[8px] font-black tracking-[0.16em] text-cyan-300/60">
              SCORE
            </div>
            <div className="truncate text-sm sm:text-base font-black leading-none text-white tabular-nums">
              {state.score.toLocaleString()}
            </div>
          </div>
          <div className="h-7 w-px bg-cyan-300/15" />
          <div className="shrink-0 text-right">
            <div className="text-[7px] sm:text-[8px] font-black tracking-[0.14em] text-rose-300/60">
              STREAK
            </div>
            <div className="text-sm sm:text-base font-black leading-none text-rose-300 tabular-nums">
              {state.jumpStreak}
            </div>
          </div>
        </div>
      </div>

      <div
        className={`rounded-xl border px-2 py-1.5 text-center shadow-lg backdrop-blur-md ${
          state.isFeverActive
            ? 'border-amber-300/60 bg-amber-400/15 shadow-amber-500/20'
            : state.laserMode === 'HIGH'
              ? 'border-purple-400/45 bg-purple-500/10 shadow-purple-500/10'
              : 'border-rose-400/35 bg-[#100B18]/90 shadow-rose-500/10'
        }`}
      >
        <div className="text-[6px] sm:text-[7px] font-black tracking-[0.16em] text-zinc-400">
          LASER MODE
        </div>
        <div
          className={`text-[10px] sm:text-xs font-black tracking-wide ${
            state.isFeverActive
              ? 'text-amber-300'
              : state.laserMode === 'HIGH'
                ? 'text-purple-300'
                : 'text-rose-300'
          }`}
        >
          {state.isFeverActive ? 'OVERDRIVE' : state.laserMode}
        </div>
        <div className="mt-0.5 flex items-center justify-center gap-1">
          {state.multiplier > 1 && (
            <span className="rounded bg-amber-400/15 px-1 text-[7px] font-black text-amber-300">
              {state.multiplier}X
            </span>
          )}
          {state.hasShield && (
            <span className="rounded bg-purple-400/15 px-1 text-[7px] font-black text-purple-300">
              SHIELD
            </span>
          )}
        </div>
      </div>

      <div className="min-w-0 rounded-xl border border-cyan-400/25 bg-[#07101E]/90 px-2 py-1.5 shadow-lg shadow-cyan-950/30 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[7px] sm:text-[8px] font-black tracking-[0.14em] text-zinc-400">
            SPEED
          </span>
          <span className="text-[9px] sm:text-[10px] font-black text-cyan-200 tabular-nums">
            {state.rpm} RPM
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="shrink-0 text-[6px] sm:text-[7px] font-black tracking-[0.12em] text-amber-300/70">
            FEVER
          </span>
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full border border-zinc-700/80 bg-zinc-900/90">
            <div
              className={`h-full rounded-full transition-[width] duration-150 ${
                state.isFeverActive
                  ? 'bg-amber-300 shadow-[0_0_8px_rgba(250,204,21,0.8)]'
                  : 'bg-gradient-to-r from-cyan-400 via-purple-400 to-rose-400'
              }`}
              style={{ width: `${state.feverPercent}%` }}
            />
          </div>
          <span className="shrink-0 text-[7px] font-black text-zinc-300 tabular-nums">
            {state.feverPercent}%
          </span>
        </div>
      </div>
    </div>
  );
};
