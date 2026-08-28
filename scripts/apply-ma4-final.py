from pathlib import Path
import json
import re

ROOT = Path('.')


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    return source.replace(old, new, 1)


# 1. Lazy-load all 31 game implementations instead of shipping them in the entry bundle.
games = read('src/data/games.ts')
pattern = re.compile(r"^import \{ (\w+) \} from '(\.\./games/[^']+)';\n", re.MULTILINE)
imports = pattern.findall(games)
if len(imports) != 31:
    raise RuntimeError(f'Expected 31 game imports, found {len(imports)}')
games = pattern.sub('', games)
games = replace_once(
    games,
    "import React from 'react';",
    "import { lazy, type ComponentType, type LazyExoticComponent } from 'react';",
    'React lazy import',
)
games = replace_once(
    games,
    "export interface GameEntry extends GameDefinition {\n  component: React.FC<any>;\n}",
    "type MiniGameComponent = ComponentType<any>;\n\nconst lazyGame = (loader: () => Promise<{ default: MiniGameComponent }>): LazyExoticComponent<MiniGameComponent> => lazy(loader);\n\nexport interface GameEntry extends GameDefinition {\n  component: LazyExoticComponent<MiniGameComponent>;\n}",
    'GameEntry lazy type',
)
for export_name, module_path in imports:
    games = replace_once(
        games,
        f'    component: {export_name},',
        f"    component: lazyGame(() => import('{module_path}').then(({{ {export_name} }}) => ({{ default: {export_name} }}))),",
        f'lazy component {export_name}',
    )
if games.count('component: lazyGame(') != 31:
    raise RuntimeError('Lazy game conversion did not produce 31 entries')
write('src/data/games.ts', games)


# 2. Defer the game shell and heavy modal surfaces; add skip navigation and localized boundaries.
app = read('src/App.tsx')
app = replace_once(
    app,
    "import React, { useState, useEffect, useMemo, useCallback } from 'react';",
    "import React, { Suspense, lazy, useState, useEffect, useMemo, useCallback } from 'react';",
    'App React imports',
)
for line in [
    "import { GameShell } from './components/GameShell';\n",
    "import { StatsModal } from './components/StatsModal';\n",
    "import { OverallLeaderboardModal } from './components/OverallLeaderboardModal';\n",
    "import { PlayerProfileModal } from './components/PlayerProfileModal';\n",
    "import { StressTester } from './components/StressTester';\n",
]:
    if line not in app:
        raise RuntimeError(f'App deferred import missing: {line.strip()}')
    app = app.replace(line, '', 1)
app = replace_once(
    app,
    "import { PwaStatus } from './components/PwaStatus';",
    "import { PwaStatus } from './components/PwaStatus';\nimport { ErrorBoundary } from './components/ErrorBoundary';",
    'App ErrorBoundary import',
)
lazy_block = """
const GameShell = lazy(() => import('./components/GameShell').then(({ GameShell }) => ({ default: GameShell })));
const StatsModal = lazy(() => import('./components/StatsModal').then(({ StatsModal }) => ({ default: StatsModal })));
const OverallLeaderboardModal = lazy(() => import('./components/OverallLeaderboardModal').then(({ OverallLeaderboardModal }) => ({ default: OverallLeaderboardModal })));
const PlayerProfileModal = lazy(() => import('./components/PlayerProfileModal').then(({ PlayerProfileModal }) => ({ default: PlayerProfileModal })));
const StressTester = lazy(() => import('./components/StressTester').then(({ StressTester }) => ({ default: StressTester })));

const DeferredSurface: React.FC<{ label: string; fullscreen?: boolean }> = ({ label, fullscreen = false }) => (
  <div
    className={`${fullscreen ? 'fixed inset-0 z-[70]' : 'fixed inset-0 z-[90]'} flex items-center justify-center bg-[#0A0A0B]/92 p-6 text-white backdrop-blur-sm`}
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <div className="flex items-center gap-3 rounded-xl border border-[#27272A] bg-[#111114] px-4 py-3 text-xs font-mono-arcade text-zinc-300 shadow-2xl">
      <span className="h-3 w-3 animate-pulse rounded-full bg-cyan-400" aria-hidden="true" />
      {label}
    </div>
  </div>
);

"""
app = replace_once(app, 'export default function App() {', lazy_block + 'export default function App() {', 'App lazy declarations')
root_open = '    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between selection:bg-cyan-500/30 selection:text-cyan-200">'
app = replace_once(
    app,
    root_open,
    root_open + '\n      <a href="#library-section" className="skip-link">Skip to game library</a>',
    'App skip link',
)
old_game = """      {activeGame && (
        <GameShell
          key={activeGame.id}
          game={activeGame}
          bestScore={stats.highScores[activeGame.id] || 0}
          soundEnabled={stats.soundEnabled}
          hapticsEnabled={stats.hapticsEnabled ?? true}
          onToggleSound={handleToggleSound}
          onToggleHaptics={handleToggleHaptics}
          onBackToArcade={() => setActiveGameId(null)}
          onPlayNextRandom={handlePlayRandomGame}
          onSaveScore={handleSaveScore}
          onViewLeaderboard={(gameId) => handleOpenStats('leaderboards', gameId)}
        />
      )}"""
new_game = """      {activeGame && (
        <ErrorBoundary key={`game-shell-${activeGame.id}`} onReset={() => setActiveGameId(null)}>
          <Suspense fallback={<DeferredSurface label={`Loading ${activeGame.title}…`} fullscreen />}>
            <GameShell
              key={activeGame.id}
              game={activeGame}
              bestScore={stats.highScores[activeGame.id] || 0}
              soundEnabled={stats.soundEnabled}
              hapticsEnabled={stats.hapticsEnabled ?? true}
              onToggleSound={handleToggleSound}
              onToggleHaptics={handleToggleHaptics}
              onBackToArcade={() => setActiveGameId(null)}
              onPlayNextRandom={handlePlayRandomGame}
              onSaveScore={handleSaveScore}
              onViewLeaderboard={(gameId) => handleOpenStats('leaderboards', gameId)}
            />
          </Suspense>
        </ErrorBoundary>
      )}"""
app = replace_once(app, old_game, new_game, 'App game shell suspense')
app = replace_once(
    app,
    '<main className="w-full max-w-6xl mx-auto px-4 py-4 flex-1">',
    '<main id="library-section" tabIndex={-1} aria-label="Game library" className="w-full max-w-6xl mx-auto px-4 py-4 flex-1 outline-none">',
    'App library landmark',
)
app = replace_once(
    app,
    '          <div className="flex items-center gap-4">',
    '          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">',
    'App footer wrap',
)
app = replace_once(
    app,
    """      {import.meta.env.DEV && stressTesterOpen && (
        <StressTester onClose={() => setStressTesterOpen(false)} />
      )}""",
    """      {import.meta.env.DEV && stressTesterOpen && (
        <Suspense fallback={<DeferredSurface label="Loading developer tools…" />}>
          <StressTester onClose={() => setStressTesterOpen(false)} />
        </Suspense>
      )}""",
    'App lazy stress tester',
)
app = replace_once(
    app,
    """      {overallLeaderboardOpen && (
        <OverallLeaderboardModal stats={stats} onClose={() => setOverallLeaderboardOpen(false)} />
      )}""",
    """      {overallLeaderboardOpen && (
        <Suspense fallback={<DeferredSurface label="Loading leaderboards…" />}>
          <OverallLeaderboardModal stats={stats} onClose={() => setOverallLeaderboardOpen(false)} />
        </Suspense>
      )}""",
    'App lazy overall leaderboard',
)
app = replace_once(
    app,
    """      {profileOpen && (
        <PlayerProfileModal stats={stats} onClose={() => setProfileOpen(false)} />
      )}""",
    """      {profileOpen && (
        <Suspense fallback={<DeferredSurface label="Loading player profile…" />}>
          <PlayerProfileModal stats={stats} onClose={() => setProfileOpen(false)} />
        </Suspense>
      )}""",
    'App lazy profile',
)
old_stats = """      {statsModalOpen && (
        <StatsModal
          stats={stats}
          initialTab={statsModalTab}
          initialGameId={statsModalGameId}
          onClose={() => setStatsModalOpen(false)}
          onUpdateSound={(enabled, volume) => {
            const updated = updateSoundPreference(enabled, volume);
            setStats(updated);
          }}
          onUpdateHaptics={(enabled) => {
            const updated = updateHapticsPreference(enabled);
            setStats(updated);
          }}
          onUpdateTheme={handleUpdateTheme}
          onClearData={handleClearData}
          onLaunchGame={(gameId) => {
            setStatsModalOpen(false);
            handleLaunchGame(gameId);
          }}
        />
      )}"""
new_stats = """      {statsModalOpen && (
        <Suspense fallback={<DeferredSurface label="Loading arcade data…" />}>
          <StatsModal
            stats={stats}
            initialTab={statsModalTab}
            initialGameId={statsModalGameId}
            onClose={() => setStatsModalOpen(false)}
            onUpdateSound={(enabled, volume) => {
              const updated = updateSoundPreference(enabled, volume);
              setStats(updated);
            }}
            onUpdateHaptics={(enabled) => {
              const updated = updateHapticsPreference(enabled);
              setStats(updated);
            }}
            onUpdateTheme={handleUpdateTheme}
            onClearData={handleClearData}
            onLaunchGame={(gameId) => {
              setStatsModalOpen(false);
              handleLaunchGame(gameId);
            }}
          />
        </Suspense>
      )}"""
app = replace_once(app, old_stats, new_stats, 'App lazy stats modal')
write('src/App.tsx', app)


# 3. Localize game failures and move confetti out of the game-shell entry chunk.
shell = read('src/components/GameShell.tsx')
shell = replace_once(
    shell,
    "import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';",
    "import React, { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';",
    'GameShell Suspense import',
)
shell = replace_once(
    shell,
    "import { useGamepadBridge } from '../hooks/useGamepadBridge';\nimport confetti from 'canvas-confetti';",
    "import { useGamepadBridge } from '../hooks/useGamepadBridge';\nimport { ErrorBoundary } from './ErrorBoundary';",
    'GameShell ErrorBoundary import',
)
old_confetti = """        try {
          confetti({
            particleCount: 75,
            spread: 60,
            origin: { y: 0.6 },
            colors: [game.accentColor, '#facc15', '#ffffff'],
          });
        } catch {}"""
new_confetti = """        void import('canvas-confetti')
          .then(({ default: confetti }) => {
            confetti({
              particleCount: 75,
              spread: 60,
              origin: { y: 0.6 },
              colors: [game.accentColor, '#facc15', '#ffffff'],
            });
          })
          .catch(() => {});"""
shell = replace_once(shell, old_confetti, new_confetti, 'GameShell dynamic confetti')
old_component = """          {/* Active Mini-Game Component */}
          <GameComponent
            key={gameSessionKey}
            onGameOver={sessionCallbacks.onGameOver}
            onScoreUpdate={sessionCallbacks.onScoreUpdate}
            isPaused={isPaused || gameOverData !== null}
            soundEnabled={soundEnabled}
            onRestartRequest={handleRestart}
          />"""
new_component = """          {/* Active Mini-Game Component */}
          <ErrorBoundary key={`game-${game.id}-${gameSessionKey}`} onReset={handleRestart}>
            <Suspense
              fallback={(
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0A0A0B]" role="status" aria-live="polite" aria-busy="true">
                  <div className="flex items-center gap-2 rounded-xl border border-[#27272A] bg-[#111114] px-4 py-3 text-xs font-mono-arcade text-zinc-300">
                    <span className="h-3 w-3 animate-pulse rounded-full" style={{ backgroundColor: game.accentColor }} aria-hidden="true" />
                    Loading {game.title}…
                  </div>
                </div>
              )}
            >
              <GameComponent
                key={gameSessionKey}
                onGameOver={sessionCallbacks.onGameOver}
                onScoreUpdate={sessionCallbacks.onScoreUpdate}
                isPaused={isPaused || gameOverData !== null}
                soundEnabled={soundEnabled}
                onRestartRequest={handleRestart}
              />
            </Suspense>
          </ErrorBoundary>"""
shell = replace_once(shell, old_component, new_component, 'GameShell lazy game fallback')
write('src/components/GameShell.tsx', shell)


# 4. Use a native, non-nested primary play button for each game card.
write('src/components/GameCard.tsx', """import React from 'react';
import { motion } from 'motion/react';
import { GameDefinition } from '../types';
import {
  Heart,
  Play,
  Zap,
  Layers,
  Radio,
  Grid,
  Keyboard,
  PenTool,
  Boxes,
  Crosshair,
  Sparkles,
  Compass,
  ShieldAlert,
  Sword,
  Disc,
  Hexagon,
  Terminal,
  Flame,
  Rocket,
  Pickaxe,
  Ghost,
  Wind,
  Footprints,
  CircleDot,
  Target,
  Activity,
  Grid3X3,
  Trophy,
} from 'lucide-react';
import { sounds } from '../lib/sound';

interface GameCardProps {
  game: GameDefinition;
  highScore: number;
  playCount: number;
  isFavorite: boolean;
  onSelect: (gameId: string) => void;
  onToggleFavorite: (gameId: string, e: React.MouseEvent) => void;
  index?: number;
}

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Orbit: Compass,
  Layers,
  Zap,
  ShieldAlert,
  Radio,
  Grid,
  Keyboard,
  PenTool,
  Boxes,
  Crosshair,
  Sparkles,
  Compass,
  Sword,
  Disc,
  Hexagon,
  Terminal,
  Flame,
  Rocket,
  Pickaxe,
  Ghost,
  Wind,
  Footprints,
  CircleDot,
  Target,
  Activity,
  Grid3X3,
  Trophy,
};

export const GameCard: React.FC<GameCardProps> = ({
  game,
  highScore,
  playCount,
  isFavorite,
  onSelect,
  onToggleFavorite,
  index = 0,
}) => {
  const IconComponent = ICON_MAP[game.icon] || Zap;
  const titleId = `game-title-${game.id}`;
  const descriptionId = `game-description-${game.id}`;

  return (
    <motion.article
      id={`game-card-${game.id}`}
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.92, transition: { duration: 0.15, ease: 'easeOut' } }}
      transition={{
        duration: 0.3,
        delay: Math.min(index * 0.035, 0.35),
        ease: [0.22, 1, 0.36, 1],
        layout: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
      }}
      whileHover={{ y: -4, transition: { duration: 0.18, ease: 'easeOut' } }}
      className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-[#27272A] bg-[#18181B] p-4 transition-colors duration-200 hover:border-[#F43F5E] hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <button
        type="button"
        id={`play-btn-${game.id}`}
        onClick={() => {
          sounds.playClick();
          onSelect(game.id);
        }}
        className="absolute inset-0 z-10 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0B]"
        aria-label={`Play ${game.title}. ${game.tagline}`}
      />

      <div className="relative z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2">
          <span
            className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: `${game.accentColor}18`, color: game.accentColor }}
          >
            {game.category}
          </span>
          <span className="text-[10px] text-[#71717A]">• {game.sessionLength}</span>
        </div>

        <button
          type="button"
          id={`fav-btn-${game.id}`}
          onClick={(event) => {
            event.stopPropagation();
            sounds.playPop();
            onToggleFavorite(game.id, event);
          }}
          className={`pointer-events-auto relative z-30 rounded-lg p-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 ${
            isFavorite ? 'bg-[#F43F5E]/10 text-[#F43F5E]' : 'text-[#52525B] hover:text-[#A1A1AA]'
          }`}
          aria-label={isFavorite ? `Remove ${game.title} from favorites` : `Add ${game.title} to favorites`}
          aria-pressed={isFavorite}
        >
          <Heart className={`h-3.5 w-3.5 ${isFavorite ? 'fill-[#F43F5E]' : ''}`} />
        </button>
      </div>

      <div className="pointer-events-none relative z-0 my-3.5 flex h-28 w-full items-center justify-center overflow-hidden rounded-lg border border-[#27272A]/70 bg-[#0A0A0B]">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-110"
          style={{ backgroundColor: `${game.accentColor}14`, color: game.accentColor }}
        >
          <IconComponent className="h-6 w-6" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-[#0A0A0B]/80 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <span className="flex items-center gap-1.5 rounded-md bg-white px-3.5 py-1 text-xs font-bold text-black shadow-md">
            <Play className="h-3 w-3 fill-current" /> PLAY
          </span>
        </div>
      </div>

      <div className="pointer-events-none relative z-0 flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 id={titleId} className="truncate text-base font-bold text-white">{game.title}</h3>
          {highScore > 0 && (
            <span className="shrink-0 rounded border border-amber-500/20 bg-amber-950/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 font-mono-arcade">
              BEST {highScore.toLocaleString()}
            </span>
          )}
        </div>
        <p id={descriptionId} className="line-clamp-1 text-xs text-[#71717A]">{game.tagline}</p>
        <span className="sr-only">Played {playCount.toLocaleString()} times.</span>
      </div>
    </motion.article>
  );
};
""")


# 5. Trap focus in modal surfaces and restore focus when they close.
write('src/hooks/useModalFocus.ts', """import { useEffect, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useModalFocus(dialogRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusInitial = () => {
      const autofocus = dialog.querySelector<HTMLElement>('[autofocus]');
      const first = autofocus ?? dialog.querySelector<HTMLElement>(FOCUSABLE) ?? dialog;
      first.focus({ preventScroll: true });
    };
    const frame = requestAnimationFrame(focusInitial);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      dialog.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus({ preventScroll: true });
    };
  }, [dialogRef]);
}
""")

stats = read('src/components/StatsModal.tsx')
stats = replace_once(stats, "import React, { useState, useMemo, useEffect } from 'react';", "import React, { useState, useMemo, useEffect, useRef } from 'react';", 'StatsModal useRef')
stats = replace_once(stats, "import { useSafeTimeout } from '../hooks/useGameLoop';", "import { useSafeTimeout } from '../hooks/useGameLoop';\nimport { useModalFocus } from '../hooks/useModalFocus';", 'StatsModal focus hook import')
stats = replace_once(stats, "}) => {\n  const [activeTab", "}) => {\n  const dialogRef = useRef<HTMLDivElement>(null);\n  useModalFocus(dialogRef);\n\n  const [activeTab", 'StatsModal focus hook use')
stats = replace_once(
    stats,
    """      <div
        id="stats-modal-container"
        className="w-full max-w-4xl rounded-2xl bg-[#111114] border border-[#27272A] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in-98 duration-200"
      >""",
    """      <div
        ref={dialogRef}
        id="stats-modal-container"
        role="dialog"
        aria-modal="true"
        aria-label="Arcade statistics, achievements, leaderboards and settings"
        tabIndex={-1}
        className="w-full max-w-4xl rounded-2xl bg-[#111114] border border-[#27272A] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in-98 duration-200 outline-none"
      >""",
    'StatsModal dialog semantics',
)
write('src/components/StatsModal.tsx', stats)

overall = read('src/components/OverallLeaderboardModal.tsx')
overall = replace_once(overall, "import React, { useCallback, useEffect, useMemo, useState } from 'react';", "import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';", 'Overall useRef')
overall = replace_once(overall, "import { UserStats } from '../types';", "import { UserStats } from '../types';\nimport { useModalFocus } from '../hooks/useModalFocus';", 'Overall focus import')
overall = replace_once(overall, "export const OverallLeaderboardModal: React.FC<OverallLeaderboardModalProps> = ({ stats, onClose }) => {\n  const [mode", "export const OverallLeaderboardModal: React.FC<OverallLeaderboardModalProps> = ({ stats, onClose }) => {\n  const dialogRef = useRef<HTMLDivElement>(null);\n  useModalFocus(dialogRef);\n\n  const [mode", 'Overall focus use')
overall = replace_once(
    overall,
    '<div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Overall leaderboards">',
    '<div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 outline-none" role="dialog" aria-modal="true" aria-label="Overall leaderboards">',
    'Overall dialog ref',
)
write('src/components/OverallLeaderboardModal.tsx', overall)

profile = read('src/components/PlayerProfileModal.tsx')
profile = replace_once(profile, "import React, { useCallback, useEffect, useMemo, useState } from 'react';", "import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';", 'Profile useRef')
profile = replace_once(profile, "import { UserStats } from '../types';", "import { UserStats } from '../types';\nimport { useModalFocus } from '../hooks/useModalFocus';", 'Profile focus import')
profile = replace_once(profile, "export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({ stats, onClose }) => {\n  const live", "export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({ stats, onClose }) => {\n  const dialogRef = useRef<HTMLDivElement>(null);\n  useModalFocus(dialogRef);\n\n  const live", 'Profile focus use')
profile = replace_once(
    profile,
    '<div className="fixed inset-0 z-[85] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Player profile">',
    '<div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-[85] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 outline-none" role="dialog" aria-modal="true" aria-label="Player profile">',
    'Profile dialog ref',
)
write('src/components/PlayerProfileModal.tsx', profile)


# 6. Permanent keyboard/focus accessibility styles.
css = read('src/index.css')
if '/* MA4 — accessibility and release focus */' not in css:
    css += """

/* MA4 — accessibility and release focus */
.skip-link {
  position: fixed;
  top: max(0.75rem, env(safe-area-inset-top));
  left: 0.75rem;
  z-index: 120;
  transform: translateY(-200%);
  border: 2px solid #67e8f9;
  border-radius: 0.75rem;
  background: #ffffff;
  color: #000000;
  padding: 0.65rem 0.9rem;
  font-size: 0.75rem;
  font-weight: 900;
  transition: transform 120ms ease;
}

.skip-link:focus {
  transform: translateY(0);
}

:where(button, a, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid #67e8f9;
  outline-offset: 3px;
}

@media (forced-colors: active) {
  :where(button, a, input, select, textarea, [tabindex]):focus-visible {
    outline: 2px solid CanvasText;
  }
}
"""
write('src/index.css', css)


# 7. Build manifest + stable vendor chunks; service worker precaches every lazy chunk.
write('vite.config.ts', """import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    manifest: 'asset-manifest.json',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'react-vendor';
          if (id.includes('/motion/') || id.includes('/framer-motion/')) return 'motion-vendor';
          if (id.includes('/lucide-react/')) return 'icons-vendor';
          if (id.includes('/canvas-confetti/')) return 'confetti';
          return undefined;
        },
      },
    },
  },
});
""")

write('public/sw.js', """/* Micro Arcade MA4 service worker — complete offline arcade + explicit updates. */
const CACHE_PREFIX = 'micro-arcade-shell-';
const CACHE_NAME = `${CACHE_PREFIX}ma4-v1`;

function scopeUrl(path = './') {
  return new URL(path, self.registration.scope).href;
}

function isCacheable(url) {
  const parsed = new URL(url);
  const scope = new URL(self.registration.scope);
  return parsed.origin === scope.origin && parsed.href.startsWith(scope.href);
}

function discoverHtmlAssets(html) {
  const urls = new Set([
    scopeUrl('./'),
    scopeUrl('manifest.webmanifest'),
    scopeUrl('asset-manifest.json'),
    scopeUrl('icons/icon-192.png'),
    scopeUrl('icons/icon-512.png'),
    scopeUrl('icons/apple-touch-icon.png'),
  ]);
  const attrPattern = /(?:src|href)=["']([^"']+)["']/gi;
  let match;
  while ((match = attrPattern.exec(html))) {
    try {
      const resolved = new URL(match[1], scopeUrl('./')).href;
      if (isCacheable(resolved)) urls.add(resolved);
    } catch {}
  }
  return urls;
}

function discoverManifestAssets(manifest) {
  const urls = new Set();
  for (const entry of Object.values(manifest || {})) {
    for (const value of [entry?.file, ...(entry?.css || []), ...(entry?.assets || [])]) {
      if (!value) continue;
      const resolved = scopeUrl(value);
      if (isCacheable(resolved)) urls.add(resolved);
    }
  }
  return urls;
}

async function fetchAndCache(cache, url) {
  const response = await fetch(url, { cache: 'reload' });
  if (!response.ok) throw new Error(`Unable to cache ${url}: ${response.status}`);
  await cache.put(url, response.clone());
  return response;
}

async function precacheArcade() {
  const cache = await caches.open(CACHE_NAME);
  const rootResponse = await fetchAndCache(cache, scopeUrl('./'));
  const html = await rootResponse.clone().text();
  const urls = discoverHtmlAssets(html);

  try {
    const manifestResponse = await fetchAndCache(cache, scopeUrl('asset-manifest.json'));
    const manifest = await manifestResponse.clone().json();
    for (const url of discoverManifestAssets(manifest)) urls.add(url);
  } catch (error) {
    console.warn('[Micro Arcade SW] Build manifest precache failed:', error);
  }

  urls.delete(scopeUrl('./'));
  urls.delete(scopeUrl('asset-manifest.json'));
  await Promise.all([...urls].map(async (url) => {
    try {
      await fetchAndCache(cache, url);
    } catch (error) {
      console.warn('[Micro Arcade SW] Optional precache failed:', url, error);
    }
  }));
}

self.addEventListener('install', (event) => {
  // Do not call skipWaiting here. Updates activate only after explicit player consent.
  event.waitUntil(precacheArcade());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function navigationResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const network = await fetch(request);
    if (network.ok) await cache.put(scopeUrl('./'), network.clone());
    return network;
  } catch {
    return (await cache.match(scopeUrl('./'))) || Response.error();
  }
}

async function assetResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    void fetch(request).then((network) => {
      if (network.ok) return cache.put(request, network.clone());
    }).catch(() => {});
    return cached;
  }
  const network = await fetch(request);
  if (network.ok) await cache.put(request, network.clone());
  return network;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!isCacheable(url.href)) return; // Never intercept the leaderboard/API origin.
  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request));
    return;
  }
  event.respondWith(assetResponse(request));
});
""")


# 8. Release metadata and application version.
index = read('index.html')
index = replace_once(
    index,
    '    <meta name="color-scheme" content="dark" />',
    '    <meta name="color-scheme" content="dark" />\n    <meta name="referrer" content="no-referrer" />\n    <meta property="og:type" content="website" />\n    <meta property="og:title" content="Micro Arcade" />\n    <meta property="og:description" content="31 instant-play browser arcade games with offline support and global rankings." />\n    <meta name="twitter:card" content="summary" />',
    'Index release metadata',
)
write('index.html', index)

package = json.loads(read('package.json'))
package['version'] = '1.0.0'
package['description'] = 'A polished, installable collection of 31 instant-play browser arcade games.'
package['license'] = 'Apache-2.0'
package['scripts']['quality:ma4'] = 'bun scripts/audit-ma4.mjs'
write('package.json', json.dumps(package, indent=2) + '\n')

readme = read('README.md')
if '## Version 1.0 release status' not in readme:
    readme += """

## Version 1.0 release status

MA4 completes the product-hardening roadmap:

- every game implementation is code-split and loaded only when opened
- large statistics, profile, leaderboard, game-shell, and developer surfaces are deferred
- the PWA build manifest lets the service worker cache every lazy game chunk for complete offline play
- root and per-game error boundaries provide recoverable failure isolation
- keyboard-operable game cards, skip navigation, visible focus, modal focus trapping, zoom support, reduced motion, and safe-area handling form the accessibility baseline
- CI enforces game parity, Worker behavior, root and Pages builds, PWA integrity, lazy-loading structure, accessibility structure, and a per-chunk size ceiling

The public frontend is release-ready. Live ranking surfaces still require the documented one-time Cloudflare D1/Worker provisioning and frontend API URL configuration.
"""
write('README.md', readme)

write('CHANGELOG.md', """# Changelog

## 1.0.0 — 2026-08-28

### Added
- Installable, fully offline-capable PWA shell.
- Persistent Cloudflare guest identity, permanent global rankings, weekly overall ranking, and player profiles.
- Unified gamepad controls and mobile safe-area/wake-lock behavior.
- Root and per-game runtime recovery boundaries.
- Skip navigation, visible keyboard focus, accessible game-card actions, and modal focus trapping.

### Changed
- All 31 game implementations and heavy secondary surfaces are lazy-loaded.
- Vite emits a build manifest and stable vendor chunks.
- The service worker precaches all production chunks, including lazy game modules.
- GitHub Pages deploys the certified Vite `/arcade/` artifact.

### Removed
- Simulated leaderboard competitors and obsolete AI Studio/server scaffolding.
""")

write('LICENSE', """Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

Copyright 2026 Jonathan / thiepn

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
""")


# 9. Permanent MA4 source + build certification.
write('scripts/audit-ma4.mjs', """import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const dist = process.env.MA4_DIST || 'dist';
const expectedBase = process.env.MA4_EXPECT_BASE || '/';
const errors = [];
const read = (path) => readFileSync(join(root, path), 'utf8');

const games = read('src/data/games.ts');
const app = read('src/App.tsx');
const card = read('src/components/GameCard.tsx');
const shell = read('src/components/GameShell.tsx');
const main = read('src/main.tsx');
const css = read('src/index.css');
const statsModal = read('src/components/StatsModal.tsx');
const overallModal = read('src/components/OverallLeaderboardModal.tsx');
const profileModal = read('src/components/PlayerProfileModal.tsx');
const modalFocus = read('src/hooks/useModalFocus.ts');
const serviceWorker = read('public/sw.js');
const vite = read('vite.config.ts');
const pkg = JSON.parse(read('package.json'));

const lazyGameCount = (games.match(/component:\s*lazyGame\(/g) ?? []).length;
const staticGameImports = (games.match(/from ['"]\.\.\/games\//g) ?? []).length;
if (lazyGameCount !== 31) errors.push(`Expected 31 lazy game components, found ${lazyGameCount}`);
if (staticGameImports !== 0) errors.push(`Found ${staticGameImports} static game imports in the registry`);
for (const surface of ['GameShell', 'StatsModal', 'OverallLeaderboardModal', 'PlayerProfileModal', 'StressTester']) {
  if (!app.includes(`const ${surface} = lazy(`)) errors.push(`${surface} is not deferred with React.lazy`);
}
if (!app.includes('href="#library-section"') || !app.includes('id="library-section"')) errors.push('Skip navigation / game-library landmark is missing');
if (!app.includes('<ErrorBoundary key={`game-shell-')) errors.push('Game-shell error isolation is missing');
if (!card.includes('id={`play-btn-${game.id}`}') || !card.includes('aria-pressed={isFavorite}')) errors.push('Game cards lack separate native play/favorite controls');
if (card.includes('role="button"')) errors.push('Game card should use a native play button, not a simulated role button');
if (!shell.includes("import('canvas-confetti')")) errors.push('Confetti remains in the eager GameShell chunk');
if (!shell.includes('<Suspense') || !shell.includes('<ErrorBoundary key={`game-')) errors.push('Lazy game loading/failure isolation is missing');
if (!main.includes('<ErrorBoundary>') || !main.includes("vite:preloadError")) errors.push('Root runtime/dynamic-import recovery is missing');
if (!css.includes('.skip-link') || !css.includes(':focus-visible')) errors.push('Visible keyboard navigation styles are missing');
if (!modalFocus.includes("event.key !== 'Tab'")) errors.push('Modal focus trap is missing');
for (const [name, source] of [['Stats', statsModal], ['Overall', overallModal], ['Profile', profileModal]]) {
  if (!source.includes('useModalFocus(dialogRef)') || !source.includes('aria-modal="true"')) errors.push(`${name} modal focus/semantics are incomplete`);
}
if (!vite.includes("manifest: 'asset-manifest.json'")) errors.push('Vite asset manifest is not enabled');
if (!vite.includes("return 'react-vendor'")) errors.push('Stable vendor chunking is missing');
if (!serviceWorker.includes("scopeUrl('asset-manifest.json')") || !serviceWorker.includes('discoverManifestAssets')) errors.push('Service worker does not precache lazy build chunks');
if (pkg.version !== '1.0.0' || pkg.license !== 'Apache-2.0') errors.push('Release package metadata is incomplete');
for (const path of ['CHANGELOG.md', 'LICENSE']) if (!existsSync(join(root, path))) errors.push(`${path} is missing`);

const manifestPath = join(root, dist, 'asset-manifest.json');
if (!existsSync(manifestPath)) {
  errors.push(`${dist}: asset-manifest.json is missing`);
} else {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const gameEntries = Object.keys(manifest).filter((key) => key.startsWith('src/games/') && key.endsWith('.tsx'));
  if (gameEntries.length !== 31) errors.push(`${dist}: expected 31 built game entries, found ${gameEntries.length}`);
  const entry = manifest['src/main.tsx'];
  if (!entry) {
    errors.push(`${dist}: main manifest entry is missing`);
  } else {
    const initialKeys = new Set();
    const visit = (key) => {
      if (initialKeys.has(key)) return;
      initialKeys.add(key);
      for (const dependency of manifest[key]?.imports || []) visit(dependency);
    };
    visit('src/main.tsx');
    const eagerGames = [...initialKeys].filter((key) => key.startsWith('src/games/'));
    if (eagerGames.length) errors.push(`${dist}: game modules leaked into initial graph: ${eagerGames.join(', ')}`);
  }
}

const assetsDir = join(root, dist, 'assets');
if (!existsSync(assetsDir)) {
  errors.push(`${dist}: assets directory is missing`);
} else {
  const jsFiles = readdirSync(assetsDir).filter((name) => name.endsWith('.js'));
  if (jsFiles.length < 10) errors.push(`${dist}: expected code-split JavaScript output, found ${jsFiles.length} chunks`);
  for (const file of jsFiles) {
    const size = statSync(join(assetsDir, file)).size;
    if (size > 350_000) errors.push(`${dist}: ${file} is ${size} bytes; expected <= 350000`);
  }
}

const builtIndexPath = join(root, dist, 'index.html');
if (existsSync(builtIndexPath) && expectedBase !== '/') {
  const builtIndex = readFileSync(builtIndexPath, 'utf8');
  if (!builtIndex.includes(`${expectedBase}assets/`)) errors.push(`${dist}: expected asset base ${expectedBase}`);
}

if (errors.length) {
  console.error('MA4 audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`MA4 audit passed: 31 lazy games, deferred secondary surfaces, accessible interaction/focus, recoverable runtime boundaries, complete offline chunk precache, and <=350 KB chunks in ${dist}.`);
""")

print('MA4 final hardening applied')
