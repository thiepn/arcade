import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Edit3, Gamepad2, Globe2, Medal, Save, Trophy, UserRound, X } from 'lucide-react';
import { UserStats } from '../types';
import { GAMES_REGISTRY } from '../data/games';
import { ACHIEVEMENTS_REGISTRY, getTotalPlayCount, getUniqueGamesCount } from '../lib/achievements';
import {
  GuestProfileData,
  OverallLeaderboardData,
  getCachedGuestProfile,
  getGuestProfile,
  getOverallArcadeLeaderboard,
  getWeeklyOverallLeaderboard,
  isLiveLeaderboardConfigured,
  refreshOverallLeaderboard,
  refreshWeeklyOverallLeaderboard,
  updateGuestDisplayName,
} from '../lib/leaderboards';

interface PlayerProfileModalProps {
  stats: UserStats;
  onClose: () => void;
}

function number(value: number): string {
  return Math.max(0, Math.round(value || 0)).toLocaleString();
}

function countryFlag(code: string): string {
  const normalized = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized) || normalized === 'XX') return '🌐';
  return String.fromCodePoint(...[...normalized].map((char) => 127397 + char.charCodeAt(0)));
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({ stats, onClose }) => {
  const live = isLiveLeaderboardConfigured();
  const [profile, setProfile] = useState<GuestProfileData | null>(() => getCachedGuestProfile());
  const [globalBoard, setGlobalBoard] = useState<OverallLeaderboardData>(() => getOverallArcadeLeaderboard(stats));
  const [weeklyBoard, setWeeklyBoard] = useState<OverallLeaderboardData>(() => getWeeklyOverallLeaderboard(stats));
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.name ?? '');
  const [error, setError] = useState<string | null>(null);

  const localTotalPlays = useMemo(() => getTotalPlayCount(stats), [stats]);
  const uniqueGames = useMemo(() => getUniqueGamesCount(stats), [stats]);
  const unlockedAchievements = useMemo(
    () => ACHIEVEMENTS_REGISTRY.filter((achievement) => achievement.isUnlocked(stats)).length,
    [stats],
  );
  const mostPlayedGame = useMemo(() => {
    let bestId: string | null = null;
    let bestCount = 0;
    for (const [gameId, count] of Object.entries(stats.playCounts)) {
      if ((count || 0) > bestCount) {
        bestId = gameId;
        bestCount = count || 0;
      }
    }
    return bestId ? GAMES_REGISTRY.find((game) => game.id === bestId)?.title ?? bestId : 'None yet';
  }, [stats.playCounts]);
  const favoriteGame = useMemo(() => {
    const first = stats.favorites[0];
    return first ? GAMES_REGISTRY.find((game) => game.id === first)?.title ?? first : 'None selected';
  }, [stats.favorites]);

  const load = useCallback(async () => {
    if (!live) return;
    setLoading(true);
    setError(null);
    try {
      const [nextProfile, global, weekly] = await Promise.all([
        getGuestProfile(),
        refreshOverallLeaderboard(),
        refreshWeeklyOverallLeaderboard(),
      ]);
      setProfile(nextProfile);
      setName(nextProfile.name);
      setGlobalBoard(global);
      setWeeklyBoard(weekly);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load player profile');
    } finally {
      setLoading(false);
    }
  }, [live]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const saveName = async () => {
    if (!live || !name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await updateGuestDisplayName(name.trim());
      setEditing(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update display name');
      setLoading(false);
    }
  };

  const joined = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Local only';

  return (
    <div className="fixed inset-0 z-[85] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Player profile">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl border border-[#27272A] bg-[#0A0A0B] shadow-2xl">
        <div className="px-4 sm:px-5 py-4 border-b border-[#27272A] flex items-center justify-between gap-3 sticky top-0 bg-[#0A0A0B]/95 backdrop-blur z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center shrink-0">
              <UserRound className="w-5 h-5 text-violet-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                {editing ? (
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={20}
                    autoFocus
                    className="min-w-0 w-52 max-w-full rounded-lg bg-[#18181B] border border-violet-500/40 px-2.5 py-1.5 text-sm text-white outline-none focus:border-violet-400"
                  />
                ) : (
                  <h2 className="text-lg sm:text-xl font-black text-white truncate">{profile?.name ?? 'Local Player'}</h2>
                )}
                {live && (
                  <button
                    type="button"
                    onClick={() => editing ? void saveName() : setEditing(true)}
                    disabled={loading}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-violet-300 hover:bg-violet-500/10 disabled:opacity-40"
                    title={editing ? 'Save display name' : 'Edit display name'}
                  >
                    {editing ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                  </button>
                )}
              </div>
              <div className="text-[10px] text-zinc-600 font-mono-arcade mt-1">
                {profile ? `${countryFlag(profile.countryCode)} ${profile.countryCode} • ID ${profile.id.slice(0, 8).toUpperCase()}` : 'Persistent guest profile activates with the live Worker'}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg border border-[#27272A] bg-[#18181B] text-zinc-400 hover:text-white" aria-label="Close profile">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!live && (
          <div className="mx-4 sm:mx-5 mt-4 px-3 py-2 rounded-lg border border-amber-500/20 bg-amber-500/5 text-[11px] text-amber-200/80">
            Cloudflare is not configured in this build, so global identity and ranks are unavailable. Local arcade statistics are shown below.
          </div>
        )}
        {error && <div className="mx-4 sm:mx-5 mt-4 text-[11px] text-rose-300">{error}</div>}

        <div className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
            <Globe2 className="w-4 h-4 text-cyan-300 mb-2" />
            <div className="text-xl font-black text-white">{globalBoard.userRank ? `#${globalBoard.userRank}` : '—'}</div>
            <div className="text-[9px] font-mono-arcade text-zinc-600 uppercase">Global rank</div>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
            <CalendarDays className="w-4 h-4 text-amber-300 mb-2" />
            <div className="text-xl font-black text-white">{weeklyBoard.userRank ? `#${weeklyBoard.userRank}` : '—'}</div>
            <div className="text-[9px] font-mono-arcade text-zinc-600 uppercase">Weekly rank</div>
          </div>
          <div className="rounded-xl border border-[#27272A] bg-[#121215] p-3">
            <Trophy className="w-4 h-4 text-violet-300 mb-2" />
            <div className="text-xl font-black text-white">{number(globalBoard.userEntry.ratingScore)}</div>
            <div className="text-[9px] font-mono-arcade text-zinc-600 uppercase">Global rating</div>
          </div>
          <div className="rounded-xl border border-[#27272A] bg-[#121215] p-3">
            <Medal className="w-4 h-4 text-emerald-300 mb-2" />
            <div className="text-xl font-black text-white">{unlockedAchievements}/{ACHIEVEMENTS_REGISTRY.length}</div>
            <div className="text-[9px] font-mono-arcade text-zinc-600 uppercase">Achievements</div>
          </div>
        </div>

        <div className="px-4 sm:px-5 pb-5 grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#27272A] bg-[#121215] p-4">
            <h3 className="text-xs font-mono-arcade font-black text-zinc-300 mb-3">ARCADE ACTIVITY</h3>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-zinc-500">Local plays</dt><dd className="font-bold text-zinc-200">{number(localTotalPlays)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-zinc-500">Games tried</dt><dd className="font-bold text-zinc-200">{uniqueGames}/{GAMES_REGISTRY.length}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-zinc-500">Ranked submissions</dt><dd className="font-bold text-zinc-200">{number(profile?.submissions ?? 0)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-zinc-500">Ranked games</dt><dd className="font-bold text-zinc-200">{number(profile?.rankedGames ?? 0)}</dd></div>
            </dl>
          </div>

          <div className="rounded-xl border border-[#27272A] bg-[#121215] p-4">
            <h3 className="text-xs font-mono-arcade font-black text-zinc-300 mb-3">PLAYER DETAILS</h3>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-zinc-500">Joined</dt><dd className="font-bold text-zinc-200 text-right">{joined}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-zinc-500">Favorite</dt><dd className="font-bold text-zinc-200 text-right truncate max-w-[55%]">{favoriteGame}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-zinc-500">Most played</dt><dd className="font-bold text-zinc-200 text-right truncate max-w-[55%]">{mostPlayedGame}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-zinc-500">Weekly combined</dt><dd className="font-bold text-amber-200">{number(weeklyBoard.userEntry.totalScore)}</dd></div>
            </dl>
          </div>
        </div>

        <div className="mx-4 sm:mx-5 mb-5 rounded-xl border border-[#27272A] bg-[#0E0E11] px-4 py-3 flex items-start gap-3">
          <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-[11px] leading-relaxed text-zinc-500">
            This profile is anonymous. The browser stores your guest credential; the server stores its hash, display name, country code, ranks, and accepted score history. No sign-in is required.
          </p>
        </div>
      </div>
    </div>
  );
};
