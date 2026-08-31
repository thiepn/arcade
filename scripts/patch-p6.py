from pathlib import Path

ROOT = Path('.')

def read(path: str) -> str:
    return (ROOT / path).read_text()

def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content)

def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing patch marker: {label}')
    return text.replace(old, new, 1)

# PERFECT STOP TYPES ---------------------------------------------------------
perfect_rules = read('src/lib/perfectStopGameplay.ts')
perfect_rules = replace_once(
    perfect_rules,
    "  | 'final-chaos';",
    "  | 'final-chaos'\n  | 'afterimage'\n  | 'phase-break'\n  | 'zero-margin';",
    'perfect stop encore ids',
)
write('src/lib/perfectStopGameplay.ts', perfect_rules)

# REACTION -------------------------------------------------------------------
reaction = read('src/games/ReactionGame.tsx')
reaction = replace_once(
    reaction,
    "} from '../lib/reactionGameplay';",
    "} from '../lib/reactionGameplay';\nimport { REACTION_OVERTIME_ROUNDS, isReactionOvertimeUnlocked } from '../lib/reactionOvertime';",
    'reaction overtime import',
)
reaction = replace_once(
    reaction,
    "  const [mistakes, setMistakes] = useState(0);",
    "  const [mistakes, setMistakes] = useState(0);\n  const [overtimeUnlocked, setOvertimeUnlocked] = useState(false);",
    'reaction overtime state',
)
reaction = replace_once(
    reaction,
    "  const roundConfig = REACTION_ROUNDS[roundIndex];\n  const maxRounds = REACTION_ROUNDS.length;",
    "  const getSessionRound = (index: number) =>\n    index < REACTION_ROUNDS.length\n      ? REACTION_ROUNDS[index]\n      : REACTION_OVERTIME_ROUNDS[index - REACTION_ROUNDS.length];\n  const roundConfig = getSessionRound(roundIndex);\n  const maxRounds = REACTION_ROUNDS.length + REACTION_OVERTIME_ROUNDS.length;\n  const displayRoundTotal = overtimeUnlocked || roundIndex >= REACTION_ROUNDS.length\n    ? maxRounds\n    : REACTION_ROUNDS.length;",
    'reaction session rounds',
)
reaction = replace_once(
    reaction,
    "    if (!correct) setMistakes((previous) => previous + 1);\n    if (reactionTimeMs !== null && correct) {\n      setHistory((previous) => [...previous, reactionTimeMs]);\n    }",
    "    const nextMistakes = mistakes + (correct ? 0 : 1);\n    const nextCorrectCount = history.length + (reactionTimeMs !== null && correct ? 1 : 0);\n    if (!correct) setMistakes(nextMistakes);\n    if (reactionTimeMs !== null && correct) {\n      setHistory((previous) => [...previous, reactionTimeMs]);\n    }",
    'reaction prospective performance',
)
reaction = replace_once(
    reaction,
    "    if (roundIndex >= maxRounds - 1) {\n      setSafeTimeout(() => onGameOver(newScore), 1500);\n    }",
    "    if (roundIndex === REACTION_ROUNDS.length - 1) {\n      const unlocksOvertime = isReactionOvertimeUnlocked(nextCorrectCount, nextMistakes);\n      setOvertimeUnlocked(unlocksOvertime);\n      if (unlocksOvertime) {\n        if (soundEnabledRef.current) sounds.playSuccess();\n      } else {\n        setSafeTimeout(() => onGameOver(newScore), 1500);\n      }\n    } else if (roundIndex >= maxRounds - 1) {\n      setSafeTimeout(() => onGameOver(newScore), 1500);\n    }",
    'reaction overtime unlock',
)
reaction = replace_once(
    reaction,
    "    if (mode === 'RESULT') {\n      if (roundIndex < maxRounds - 1) {\n        const nextIndex = roundIndex + 1;\n        setRoundIndex(nextIndex);\n        startRound(nextIndex);\n      }\n      return;\n    }",
    "    if (mode === 'RESULT') {\n      if (roundIndex === REACTION_ROUNDS.length - 1 && !overtimeUnlocked) return;\n      if (roundIndex < maxRounds - 1) {\n        const nextIndex = roundIndex + 1;\n        setRoundIndex(nextIndex);\n        startRound(nextIndex);\n      }\n      return;\n    }",
    'reaction result advance',
)
reaction = replace_once(
    reaction,
    "<span className=\"text-white font-bold\">{roundIndex + 1} / {maxRounds}</span>",
    "<span className=\"text-white font-bold\">{roundIndex + 1} / {displayRoundTotal}</span>",
    'reaction displayed total',
)
reaction = replace_once(
    reaction,
    "          <span className=\"px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/25 text-violet-300 text-[10px] font-mono-arcade w-fit\">\n            {roundConfig.label}\n          </span>",
    "          <span className=\"px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/25 text-violet-300 text-[10px] font-mono-arcade w-fit\">\n            {roundConfig.label}\n          </span>\n          {roundIndex >= REACTION_ROUNDS.length && (\n            <span className=\"px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono-arcade w-fit\">\n              OVERTIME\n            </span>\n          )}",
    'reaction overtime badge',
)
reaction = replace_once(
    reaction,
    "            <div className=\"mt-2 px-5 py-2 rounded-xl bg-[#18181B] border border-[#27272A] font-mono-arcade text-xs text-[#A1A1AA] flex items-center gap-2\">",
    "            {roundIndex === REACTION_ROUNDS.length - 1 && overtimeUnlocked && (\n              <div className=\"px-4 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono-arcade text-xs font-black\">\n                OVERTIME UNLOCKED\n              </div>\n            )}\n\n            <div className=\"mt-2 px-5 py-2 rounded-xl bg-[#18181B] border border-[#27272A] font-mono-arcade text-xs text-[#A1A1AA] flex items-center gap-2\">",
    'reaction overtime result',
)
reaction = replace_once(
    reaction,
    "<span>{roundIndex < maxRounds - 1 ? `TAP FOR ${REACTION_ROUNDS[roundIndex + 1].label}` : 'CALCULATING FINAL SCORE...'}</span>",
    "<span>{roundIndex < maxRounds - 1 && !(roundIndex === REACTION_ROUNDS.length - 1 && !overtimeUnlocked) ? `TAP FOR ${getSessionRound(roundIndex + 1).label}` : 'CALCULATING FINAL SCORE...'}</span>",
    'reaction next round label',
)
write('src/games/ReactionGame.tsx', reaction)

# PERFECT STOP ---------------------------------------------------------------
perfect = read('src/games/PerfectStopGame.tsx')
perfect = replace_once(
    perfect,
    "} from '../lib/perfectStopGameplay';",
    "} from '../lib/perfectStopGameplay';\nimport { PERFECT_STOP_ENCORE_ROUNDS, isPerfectStopEncoreUnlocked } from '../lib/perfectStopEncore';\n\nconst PERFECT_STOP_SESSION_ROUNDS = [...PERFECT_STOP_ROUNDS, ...PERFECT_STOP_ENCORE_ROUNDS];",
    'perfect encore import',
)
perfect = replace_once(
    perfect,
    "  const [streak, setStreak] = useState(0);",
    "  const [streak, setStreak] = useState(0);\n  const [masterHits, setMasterHits] = useState(0);\n  const [encoreUnlocked, setEncoreUnlocked] = useState(false);",
    'perfect mastery state',
)
perfect = replace_once(
    perfect,
    "  const roundConfig = PERFECT_STOP_ROUNDS[roundIndex];\n  const maxRounds = PERFECT_STOP_ROUNDS.length;",
    "  const roundConfig = PERFECT_STOP_SESSION_ROUNDS[roundIndex];\n  const maxRounds = PERFECT_STOP_SESSION_ROUNDS.length;\n  const displayRoundTotal = encoreUnlocked || roundIndex >= PERFECT_STOP_ROUNDS.length\n    ? maxRounds\n    : PERFECT_STOP_ROUNDS.length;",
    'perfect session rounds',
)
perfect = replace_once(perfect, "    const config = PERFECT_STOP_ROUNDS[index];", "    const config = PERFECT_STOP_SESSION_ROUNDS[index];", 'perfect start config')
perfect = replace_once(
    perfect,
    "    setResult(judgement);\n    setStreak(judgement.nextStreak);",
    "    setResult(judgement);\n    setStreak(judgement.nextStreak);\n    const isMasterHit = judgement.rating === 'PERFECT' || judgement.rating === 'GREAT';\n    const nextMasterHits = masterHits + (roundIndex < PERFECT_STOP_ROUNDS.length && isMasterHit ? 1 : 0);\n    if (roundIndex < PERFECT_STOP_ROUNDS.length && isMasterHit) setMasterHits(nextMasterHits);",
    'perfect mastery hits',
)
perfect = replace_once(
    perfect,
    "    if (roundIndex >= maxRounds - 1) {\n      setSafeTimeout(() => onGameOver(newScore), 1400);\n    }",
    "    if (roundIndex === PERFECT_STOP_ROUNDS.length - 1) {\n      const unlocksEncore = isPerfectStopEncoreUnlocked(nextMasterHits);\n      setEncoreUnlocked(unlocksEncore);\n      if (unlocksEncore) {\n        if (soundEnabled) sounds.playSuccess();\n      } else {\n        setSafeTimeout(() => onGameOver(newScore), 1400);\n      }\n    } else if (roundIndex >= maxRounds - 1) {\n      setSafeTimeout(() => onGameOver(newScore), 1400);\n    }",
    'perfect encore unlock',
)
perfect = replace_once(
    perfect,
    "  const handleNextRound = () => {\n    if (roundIndex >= maxRounds - 1 || !result) return;",
    "  const handleNextRound = () => {\n    if (!result) return;\n    if (roundIndex === PERFECT_STOP_ROUNDS.length - 1 && !encoreUnlocked) return;\n    if (roundIndex >= maxRounds - 1) return;",
    'perfect next guard',
)
perfect = replace_once(perfect, "        const config = PERFECT_STOP_ROUNDS[roundIndex];", "        const config = PERFECT_STOP_SESSION_ROUNDS[roundIndex];", 'perfect loop config')
perfect = replace_once(perfect, "SECTOR {roundIndex + 1} / {maxRounds}", "SECTOR {roundIndex + 1} / {displayRoundTotal}", 'perfect displayed total')
perfect = replace_once(
    perfect,
    "          <span className=\"font-mono-arcade text-[10px] text-[#38BDF8] bg-[#38BDF8]/10 px-2.5 py-1 rounded-lg border border-[#38BDF8]/20 w-fit\">\n            {roundConfig.label}\n          </span>",
    "          <span className=\"font-mono-arcade text-[10px] text-[#38BDF8] bg-[#38BDF8]/10 px-2.5 py-1 rounded-lg border border-[#38BDF8]/20 w-fit\">\n            {roundConfig.label}\n          </span>\n          <span className=\"font-mono-arcade text-[9px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 w-fit\">\n            MASTER {Math.min(masterHits, 4)} / 4\n          </span>",
    'perfect mastery badge',
)
perfect = replace_once(
    perfect,
    "        <div>\n          {isRunning ? (",
    "        <div>\n          {roundIndex === PERFECT_STOP_ROUNDS.length - 1 && encoreUnlocked && result && (\n            <div className=\"mb-2 px-5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono-arcade font-black text-xs text-center\">\n              MASTER ENCORE UNLOCKED\n            </div>\n          )}\n          {isRunning ? (",
    'perfect encore banner',
)
perfect = replace_once(
    perfect,
    "          ) : roundIndex < maxRounds - 1 ? (\n            <div className=\"px-6 py-2.5 rounded-xl bg-[#18181B] text-white font-mono-arcade font-bold text-xs border border-[#27272A]\">\n              TAP FOR {PERFECT_STOP_ROUNDS[roundIndex + 1].label}\n            </div>",
    "          ) : roundIndex < maxRounds - 1 && !(roundIndex === PERFECT_STOP_ROUNDS.length - 1 && !encoreUnlocked) ? (\n            <div className=\"px-6 py-2.5 rounded-xl bg-[#18181B] text-white font-mono-arcade font-bold text-xs border border-[#27272A]\">\n              TAP FOR {PERFECT_STOP_SESSION_ROUNDS[roundIndex + 1].label}\n            </div>",
    'perfect next label',
)
write('src/games/PerfectStopGame.tsx', perfect)

# CYBER CROSSER --------------------------------------------------------------
road = read('src/games/RoadCrossGame.tsx')
road = replace_once(
    road,
    "import { canAcceptRoadCrossMove, getRoadCrossBoardMetrics } from '../lib/roadCrossSupport';",
    "import { canAcceptRoadCrossMove, getRoadCrossBoardMetrics } from '../lib/roadCrossSupport';\nimport { getRoadCrossCheckpointBonus, getRoadCrossDistrict, getRoadCrossDistrictLevel, getRoadCrossLaneType } from '../lib/roadCrossMastery';",
    'road district import',
)
road = replace_once(
    road,
    "    multiplier: 1,\n  });",
    "    multiplier: 1,\n    districtName: 'NEON SUBURB',\n  });",
    'road hud district',
)
road = replace_once(
    road,
    "    multiplier: 1,\n\n    lanes: [] as Lane[],",
    "    multiplier: 1,\n    districtLevel: 0,\n    districtName: 'NEON SUBURB',\n\n    lanes: [] as Lane[],",
    'road state district',
)
road = replace_once(
    road,
    "        state.maxRowReached = state.row;\n        state.score += delta * 20 * state.multiplier;\n        onScoreUpdate(state.score);",
    "        state.maxRowReached = state.row;\n        state.score += delta * 20 * state.multiplier;\n\n        const nextDistrictLevel = getRoadCrossDistrictLevel(state.row);\n        if (nextDistrictLevel > state.districtLevel) {\n          state.districtLevel = nextDistrictLevel;\n          state.districtName = getRoadCrossDistrict(state.row).name;\n          const checkpointBonus = getRoadCrossCheckpointBonus(nextDistrictLevel);\n          state.score += checkpointBonus;\n          state.popups.push({\n            id: state.nextId++,\n            x: state.width / 2,\n            y: 76,\n            text: `${state.districtName} +${checkpointBonus}`,\n            color: '#34D399',\n            life: 1.4,\n          });\n          if (soundEnabled) sounds.playSuccess();\n        }\n\n        onScoreUpdate(state.score);",
    'road checkpoint bonus',
)
road = replace_once(
    road,
    "      let type: LaneType = 'road';\n      const rand = Math.random();\n\n      if (nextRow <= 3) {\n        type = 'grass';\n      } else if (rand < 0.3) {\n        type = 'grass';\n      } else if (rand < 0.65) {\n        type = 'road';\n      } else if (rand < 0.85) {\n        type = 'river';\n      } else {\n        type = 'train';\n      }",
    "      const type: LaneType = getRoadCrossLaneType(nextRow);",
    'road authored lane types',
)
road = replace_once(
    road,
    "    state.multiplier = 1;\n    state.lanes = [];",
    "    state.multiplier = 1;\n    state.districtLevel = 0;\n    state.districtName = getRoadCrossDistrict(4).name;\n    state.lanes = [];",
    'road district reset',
)
road = replace_once(
    road,
    "          prev.combo === state.combo &&\n          prev.multiplier === state.multiplier",
    "          prev.combo === state.combo &&\n          prev.multiplier === state.multiplier &&\n          prev.districtName === state.districtName",
    'road hud equality',
)
road = replace_once(
    road,
    "          combo: state.combo,\n          multiplier: state.multiplier,",
    "          combo: state.combo,\n          multiplier: state.multiplier,\n          districtName: state.districtName,",
    'road hud publish',
)
road = replace_once(
    road,
    "          <div className=\"px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-emerald-400 font-mono text-xs font-black backdrop-blur-md\">\n            ROW: {hudState.distance}\n          </div>",
    "          <div className=\"px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-emerald-400 font-mono text-xs font-black backdrop-blur-md\">\n            ROW: {hudState.distance}\n          </div>\n          <div className=\"px-2.5 py-1 rounded-xl bg-sky-500/15 border border-sky-500/35 text-sky-300 font-mono text-[10px] font-black backdrop-blur-md\">\n            {hudState.districtName}\n          </div>",
    'road district hud',
)
write('src/games/RoadCrossGame.tsx', road)

# REGISTRY COPY --------------------------------------------------------------
registry = read('src/data/games.ts')
registry = replace_once(
    registry,
    "    description: 'Eight escalating rounds mix green-light reactions, left/right decisions, no-go decoys, and combined inhibition challenges.',",
    "    description: 'Eight escalating rounds mix speed, choice, and inhibition; a clean run unlocks a three-round adaptive overtime with higher-risk cues and rewards.',",
    'reaction registry p6',
)
registry = replace_once(
    registry,
    "    description: 'Lock a sweeping marker onto shifting targets through speed gates, micro-zones, moving beacons, timed reversals, and a final chaos sector.',",
    "    description: 'Master seven core sectors, then earn a three-sector Master Encore by landing enough GREAT/PERFECT stops before Final Chaos.',",
    'perfect registry p6',
)
registry = replace_once(
    registry,
    "    description: 'Guide your cyber bot across multi-lane hover-car traffic, supersonic hyperloop tracks, and flowing plasma rivers with floating cargo barges. Stay ahead of the creeping laser field!',",
    "    description: 'Cross four authored eight-row districts—Neon Suburb, Rush Circuit, Flood Channel, and Railworks—while variable traffic, barges, trains, and the creeping laser keep every run tense.',",
    'road registry p6',
)
registry = replace_once(
    registry,
    "    instructions: 'Hop with WASD / Arrow Keys or Tap/Swipe. Ride barges across plasma rivers.',",
    "    instructions: 'Hop with WASD / Arrow Keys or Tap/Swipe. Read each district rhythm, use grass as a reset lane, ride barges, and reach district checkpoints for escalating bonuses.',",
    'road instructions p6',
)
write('src/data/games.ts', registry)

# PACKAGE --------------------------------------------------------------------
pkg = read('package.json')
pkg = replace_once(
    pkg,
    '    "quality:gameplay-p5": "bun scripts/audit-gameplay-p5.ts"',
    '    "quality:gameplay-p5": "bun scripts/audit-gameplay-p5.ts",\n    "quality:gameplay-p6": "bun scripts/audit-gameplay-p6.ts"',
    'package p6',
)
write('package.json', pkg)

# RELEASE CERTIFICATION ------------------------------------------------------
release = read('scripts/audit-release-32.ts')
release = replace_once(
    release,
    "  'quality:gameplay-p5',\n  'quality:browser-p3',",
    "  'quality:gameplay-p5',\n  'quality:gameplay-p6',\n  'quality:browser-p3',",
    'release p6 gate',
)
release = replace_once(
    release,
    "  'scripts/audit-gameplay-p5.ts',\n  'scripts/audit-browser-gameplay-p3.mjs',",
    "  'scripts/audit-gameplay-p5.ts',\n  'scripts/audit-gameplay-p6.ts',\n  'scripts/audit-browser-gameplay-p3.mjs',",
    'release p6 audit',
)
write('scripts/audit-release-32.ts', release)
