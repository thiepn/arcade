import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Crown, Globe2, RefreshCw, Trophy, Users, X } from 'lucide-react';
import { UserStats } from '../types';
import { useModalFocus } from '../hooks/useModalFocus';
import {
  GlobalOverallEntry,
  OverallLeaderboardData,
  getDivisionColor,
  getOverallArcadeLeaderboard,
  getWeeklyOverallLeaderboard,
  isLiveLeaderboardConfigured,
  refreshOverallLeaderboard,
  refreshWeeklyOverallLeaderboard,
} from '../lib/leaderboards';

interface OverallLeaderboardModalProps {
  stats: UserStats;
  onClose: () => void;
}

type BoardMode = 'global' | 'weekly';

function number(value: number): string {
  return Math.max(0, Math.round(value || 0)).toLocaleString();
}

function formatWeekRange(start?: number, end?: number): string {
  if (!start || !end) return 'Current UTC week';
  const startDate = new Date(start);
  const endDate = new Date(end - 1);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone: 'UTC' };
  return `${startDate.toLocaleDateString(undefined, options)} – ${endDate.toLocaleDateString(undefined, options)}`;
}

function timeUntil(end?: number): string {
  if (!end) return 'Resets Monday 00:00 UTC';
  const remaining = Math.max(0, end - Date.now());
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  return `Resets in ${days}d ${hours}h`;
}

const Row: React.FC<{ entry: GlobalOverallEntry }> = ({ entry }) => {
  const accent = getDivisionColor(entry.division);
  return (
    <div
      className={`grid grid-cols-[42px_minmax(0,1fr)_88px_96px] sm:grid-cols-[52px_minmax(0,1fr)_110px_120px] items-center gap-2 px-3 sm:px-4 py-3 border-b border-[#27272A]/80 last:border-b-0 ${entry.isUser ? 'bg-cyan-500/10' : 'bg-transparent'}`}
    >
      <div className="font-mono-arcade font-black text-sm text-center" style={{ color: accent }}>
        {entry.rank === 1 ? <Crown className="w-4 h-4 mx-auto" /> : `#${entry.rank}`}
      </div>
      <div className="min-w-0 flex items-center gap-2">
        <span className="text-lg leading-none">{entry.country}</span>
        <div className="min-w-0">
          <div className={`truncate text-sm font-bold ${entry.isUser ? 'text-cyan-200' : 'text-zinc-100'}`}>{entry.name}</div>
          <div className="truncate text-[10px] text-zinc-500 font-mono-arcade">{entry.badgeTitle}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs sm:text-sm font-black text-zinc-100 tabular-nums">{number(entry.ratingScore)}</div>
        <div className="text-[9px] uppercase tracking-wider text-zinc-600 font-mono-arcade">rating</div>
      </div>
      <div className="text-right">
        <div className="text-xs sm:text-sm font-black text-amber-300 tabular-nums">{number(entry.totalScore)}</div>
        <div className="text-[9px] uppercase tracking-wider text-zinc-600 font-mono-arcade">combined</div>
      </div>
    </div>
  );
};

export const OverallLeaderboardModal: React.FC<OverallLeaderboardModalProps> = ({ stats, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(dialogRef);

  const [mode, setMode] = useState<BoardMode>('global');
  const [globalBoard, setGlobalBoard] = useState<OverallLeaderboardData>(() => getOverallArcadeLeaderboard(stats));
  const [weeklyBoard, setWeeklyBoard] = useState<OverallLeaderboardData>(() => getWeeklyOverallLeaderboard(stats));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const live = isLiveLeaderboardConfigured();

  const refresh = useCallback(async () => {
    if (!live) return;
    setLoading(true);
    setError(null);
    try {
      const [global, weekly] = await Promise.all([
        refreshOverallLeaderboard(),
        refreshWeeklyOverallLeaderboard(),
      ]);
      setGlobalBoard(global);
      setWeeklyBoard(weekly);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [live]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const board = mode === 'global' ? globalBoard : weeklyBoard;
  const title = mode === 'global' ? 'GLOBAL OVERALL' : 'WEEKLY OVERALL';
  const subtitle = mode === 'global'
    ? 'Permanent arcade ranking across all games'
    : `${formatWeekRange(weeklyBoard.weekStart, weeklyBoard.weekEnd)} • ${timeUntil(weeklyBoard.weekEnd)}`;

  const entries = useMemo(() => board.topEntries, [board.topEntries]);

  return (
    <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 outline-none" role="dialog" aria-modal="true" aria-label="Overall leaderboards">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-[#27272A] bg-[#0A0A0B] shadow-2xl flex flex-col">
        <div className="px-4 sm:px-5 py-4 border-b border-[#27272A] flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-black font-mono-arcade text-white">{title}</h2>
              <p className="text-[11px] sm:text-xs text-zinc-500 mt-1">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => void refresh()} disabled={!live || loading} className="p-2 rounded-lg border border-[#27272A] bg-[#18181B] text-zinc-400 hover:text-white disabled:opacity-40" title="Refresh leaderboards">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={onClose} className="p-2 rounded-lg border border-[#27272A] bg-[#18181B] text-zinc-400 hover:text-white" aria-label="Close leaderboards">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-5 pt-4">
          <div className="grid grid-cols-2 p-1 rounded-xl border border-[#27272A] bg-[#121215]">
            <button
              type="button"
              onClick={() => setMode('global')}
              className={`py-2.5 rounded-lg text-xs font-mono-arcade font-black flex items-center justify-center gap-2 transition-colors ${mode === 'global' ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/30' : 'text-zinc-500 hover:text-zinc-200'}`}
            >
              <Globe2 className="w-4 h-4" /> GLOBAL
            </button>
            <button
              type="button"
              onClick={() => setMode('weekly')}
              className={`py-2.5 rounded-lg text-xs font-mono-arcade font-black flex items-center justify-center gap-2 transition-colors ${mode === 'weekly' ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30' : 'text-zinc-500 hover:text-zinc-200'}`}
            >
              <CalendarDays className="w-4 h-4" /> WEEKLY
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-5 py-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#27272A] bg-[#121215] px-3 py-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-mono-arcade text-zinc-600"><Users className="w-3.5 h-3.5" /> Competitors</div>
            <div className="mt-1 text-xl font-black text-white tabular-nums">{number(board.totalWorldCompetitors)}</div>
          </div>
          <div className="rounded-xl border border-[#27272A] bg-[#121215] px-3 py-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-mono-arcade text-zinc-600"><Trophy className="w-3.5 h-3.5" /> Your rank</div>
            <div className="mt-1 text-xl font-black text-white tabular-nums">{board.userRank ? `#${board.userRank}` : '—'}</div>
          </div>
        </div>

        {!live && (
          <div className="mx-4 sm:mx-5 mb-4 px-3 py-2 rounded-lg border border-amber-500/20 bg-amber-500/5 text-[11px] text-amber-200/80">
            Live Cloudflare leaderboard is not configured in this build. Local statistics remain available, but weekly ranking requires the Worker.
          </div>
        )}
        {error && <div className="mx-4 sm:mx-5 mb-4 text-[11px] text-rose-300">{error}</div>}

        <div className="mx-4 sm:mx-5 mb-5 rounded-xl border border-[#27272A] overflow-auto min-h-[220px]">
          <div className="grid grid-cols-[42px_minmax(0,1fr)_88px_96px] sm:grid-cols-[52px_minmax(0,1fr)_110px_120px] gap-2 px-3 sm:px-4 py-2 bg-[#121215] border-b border-[#27272A] text-[9px] uppercase tracking-wider text-zinc-600 font-mono-arcade">
            <span className="text-center">Rank</span><span>Player</span><span className="text-right">Rating</span><span className="text-right">Combined</span>
          </div>
          {entries.length > 0 ? entries.map((entry) => <Row key={entry.id} entry={entry} />) : (
            <div className="py-12 text-center text-sm text-zinc-600">{loading ? 'Loading rankings…' : mode === 'weekly' ? 'No weekly scores yet.' : 'No global scores yet.'}</div>
          )}
          {board.userEntry && board.userRank && !entries.some((entry) => entry.isUser) && (
            <>
              <div className="px-4 py-2 text-[9px] text-center text-zinc-700 font-mono-arcade border-y border-[#27272A]">YOUR POSITION</div>
              <Row entry={board.userEntry} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
