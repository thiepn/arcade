import React from 'react';
import { Activity, ArrowDown, ArrowUp, Play, Zap } from 'lucide-react';

interface LaserRopeStartPanelProps {
  onStart: () => void;
}

export const LaserRopeStartPanel: React.FC<LaserRopeStartPanelProps> = ({
  onStart,
}) => {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[radial-gradient(circle_at_50%_45%,rgba(56,189,248,0.13),rgba(3,7,18,0.88)_48%,rgba(2,6,23,0.97)_100%)] p-3 sm:p-5 backdrop-blur-[2px]">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-cyan-300/25 bg-[#050B16]/94 shadow-2xl shadow-cyan-950/40">
        <div className="border-b border-white/5 bg-gradient-to-r from-cyan-400/8 via-purple-400/8 to-rose-400/10 px-4 py-4 text-center sm:px-5">
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 text-cyan-200 shadow-[0_0_24px_rgba(56,189,248,0.18)]">
            <Activity className="h-5 w-5" />
          </div>
          <div className="font-mono-arcade text-[8px] font-black uppercase tracking-[0.24em] text-cyan-300/65">
            Reflex Protocol // Online
          </div>
          <h2 className="mt-1 font-mono-arcade text-xl font-black tracking-[0.08em] text-white sm:text-2xl">
            LASER ROPE
          </h2>
          <p className="mt-1 text-[10px] font-bold tracking-[0.14em] text-zinc-400">
            READ · REACT · SURVIVE
          </p>
        </div>

        <div className="space-y-3 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/[0.06] p-3">
              <div className="flex items-center gap-1.5 font-mono-arcade text-[9px] font-black text-cyan-200">
                <ArrowUp className="h-3.5 w-3.5" /> JUMP
              </div>
              <div className="mt-1 text-[10px] font-semibold leading-relaxed text-zinc-300">
                Clear <span className="font-black text-rose-300">LOW</span> and{' '}
                <span className="font-black text-rose-300">DUAL</span> sweeps.
              </div>
              <div className="mt-2 font-mono-arcade text-[8px] font-bold text-zinc-500">
                SPACE · W · ↑
              </div>
            </div>

            <div className="rounded-xl border border-purple-400/25 bg-purple-400/[0.06] p-3">
              <div className="flex items-center gap-1.5 font-mono-arcade text-[9px] font-black text-purple-200">
                <ArrowDown className="h-3.5 w-3.5" /> SLIDE
              </div>
              <div className="mt-1 text-[10px] font-semibold leading-relaxed text-zinc-300">
                Duck beneath <span className="font-black text-purple-300">HIGH</span> sweeps.
              </div>
              <div className="mt-2 font-mono-arcade text-[8px] font-bold text-zinc-500">
                S · ↓
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] px-3 py-2.5">
            <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
            <p className="text-[9px] font-semibold leading-relaxed text-zinc-300">
              Warning rings announce new beam patterns. The player-lane marker brightens as a sweep closes in.
            </p>
          </div>

          <button
            type="button"
            onClick={onStart}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-200/50 bg-cyan-300 px-4 py-3 font-mono-arcade text-[11px] font-black tracking-[0.1em] text-slate-950 shadow-[0_0_22px_rgba(103,232,249,0.2)] transition hover:bg-cyan-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050B16]"
          >
            <Play className="h-4 w-4 fill-current" /> START RUN
          </button>

          <p className="text-center font-mono-arcade text-[8px] font-bold tracking-wide text-zinc-500">
            PRESS SPACE / ENTER OR TAP START
          </p>
        </div>
      </div>
    </div>
  );
};
