import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(source, oldText, newText, label) {
  if (!source.includes(oldText)) throw new Error(`Missing expected pattern: ${label}`);
  return source.replace(oldText, newText);
}

let app = readFileSync('src/App.tsx', 'utf8');
app = replaceOnce(
  app,
  "import { StatsModal } from './components/StatsModal';\n",
  "import { StatsModal } from './components/StatsModal';\nimport { OverallLeaderboardModal } from './components/OverallLeaderboardModal';\nimport { PlayerProfileModal } from './components/PlayerProfileModal';\n",
  'App modal imports',
);
app = replaceOnce(
  app,
  "import { Sparkles, Gamepad2, Shuffle, Heart, BarChart2, Globe, Trophy, Medal, Activity } from 'lucide-react';",
  "import { Sparkles, Gamepad2, Shuffle, Heart, BarChart2, Globe, Trophy, Medal, Activity, UserRound } from 'lucide-react';",
  'App profile icon import',
);
app = replaceOnce(
  app,
  "  const [statsModalOpen, setStatsModalOpen] = useState<boolean>(false);\n",
  "  const [statsModalOpen, setStatsModalOpen] = useState<boolean>(false);\n  const [overallLeaderboardOpen, setOverallLeaderboardOpen] = useState<boolean>(false);\n  const [profileOpen, setProfileOpen] = useState<boolean>(false);\n",
  'App MA2 modal state',
);
app = replaceOnce(
  app,
  "        if (statsModalOpen) setStatsModalOpen(false);\n",
  "        if (statsModalOpen) setStatsModalOpen(false);\n        if (overallLeaderboardOpen) setOverallLeaderboardOpen(false);\n        if (profileOpen) setProfileOpen(false);\n",
  'App escape close',
);
app = replaceOnce(
  app,
  "  }, [activeGameId, searchOpen, statsModalOpen]);\n",
  "  }, [activeGameId, searchOpen, statsModalOpen, overallLeaderboardOpen, profileOpen]);\n",
  'App escape dependencies',
);
app = replaceOnce(
  app,
  "  const handleOpenStats = useCallback((tab: 'stats' | 'achievements' | 'leaderboards' = 'stats', gameId?: string) => {\n    haptics.light();\n    setStatsModalTab(tab);\n",
  "  const handleOpenStats = useCallback((tab: 'stats' | 'achievements' | 'leaderboards' = 'stats', gameId?: string) => {\n    haptics.light();\n    if (tab === 'leaderboards' && !gameId) {\n      setOverallLeaderboardOpen(true);\n      return;\n    }\n    setStatsModalTab(tab);\n",
  'App overall leaderboard routing',
);
app = replaceOnce(
  app,
  "          onOpenStats={handleOpenStats}\n",
  "          onOpenStats={handleOpenStats}\n          onOpenProfile={() => setProfileOpen(true)}\n",
  'App header profile prop',
);
app = replaceOnce(
  app,
  `            <button\n              type="button"\n              onClick={() => handleOpenStats('stats')}\n              className="hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"\n            >\n              <BarChart2 className="w-3.5 h-3.5 text-[#F43F5E]" /> Statistics\n            </button>`,
  `            <button\n              type="button"\n              onClick={() => setProfileOpen(true)}\n              className="hover:text-violet-300 transition-colors flex items-center gap-1.5 cursor-pointer"\n            >\n              <UserRound className="w-3.5 h-3.5 text-violet-400" /> Profile\n            </button>\n            <button\n              type="button"\n              onClick={() => handleOpenStats('stats')}\n              className="hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"\n            >\n              <BarChart2 className="w-3.5 h-3.5 text-[#F43F5E]" /> Statistics\n            </button>`,
  'App footer profile action',
);
app = replaceOnce(
  app,
  "      {/* Statistics Modal Overlay */}\n",
  `      {overallLeaderboardOpen && (\n        <OverallLeaderboardModal stats={stats} onClose={() => setOverallLeaderboardOpen(false)} />\n      )}\n\n      {profileOpen && (\n        <PlayerProfileModal stats={stats} onClose={() => setProfileOpen(false)} />\n      )}\n\n      {/* Statistics Modal Overlay */}\n`,
  'App MA2 modal rendering',
);
writeFileSync('src/App.tsx', app);

let header = readFileSync('src/components/Header.tsx', 'utf8');
header = replaceOnce(
  header,
  "  onOpenStats: (tab?: 'stats' | 'achievements' | 'leaderboards') => void;\n",
  "  onOpenStats: (tab?: 'stats' | 'achievements' | 'leaderboards') => void;\n  onOpenProfile: () => void;\n",
  'Header profile prop type',
);
header = replaceOnce(
  header,
  "  onOpenStats,\n  searchOpen,\n",
  "  onOpenStats,\n  onOpenProfile,\n  searchOpen,\n",
  'Header profile prop destructure',
);
header = replaceOnce(
  header,
  "              onOpenStats('achievements');\n",
  "              onOpenProfile();\n",
  'Header rank pill profile route',
);
header = replaceOnce(
  header,
  "            title={`Rank Tier: ${rankProfile.rankTierName} • ${rankProfile.title} (${rankProfile.badgeCount}/${rankProfile.totalBadges} Badges Unlocked)`}\n",
  "            title={`Open Player Profile • ${rankProfile.rankTierName} • ${rankProfile.title}`}\n",
  'Header rank pill title',
);
writeFileSync('src/components/Header.tsx', header);

console.log('MA2 app/header wiring applied');
