from pathlib import Path

ROOT = Path('.')


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content)


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one marker, found {count}')
    return source.replace(old, new, 1)


# ---------------------------------------------------------------------------
# Breakout Mini — rotating mastery contracts.
# ---------------------------------------------------------------------------
path = 'src/games/BreakoutGame.tsx'
source = read(path)
source = replace_once(
    source,
    "import { ARCADE_FIXED_STEP_SEC, getArcadeStepBatch, getFrameScale } from '../lib/frameRateRuntime';\n",
    "import { ARCADE_FIXED_STEP_SEC, getArcadeStepBatch, getFrameScale } from '../lib/frameRateRuntime';\nimport {\n  advanceBreakoutContractProgress,\n  getBreakoutContract,\n  getBreakoutContractReward,\n  isBreakoutContractComplete,\n  type BreakoutContractEvent,\n} from '../lib/breakoutMastery';\n",
    'Breakout mastery import',
)
source = replace_once(
    source,
    "    round: 1,\n    keys: { left: false, right: false, space: false },",
    "    round: 1,\n    contract: getBreakoutContract(1),\n    contractProgress: 0,\n    contractComplete: false,\n    contractStreak: 0,\n    keys: { left: false, right: false, space: false },",
    'Breakout contract state',
)
source = replace_once(
    source,
    "    state.round = 1;\n    state.shake = 0;",
    "    state.round = 1;\n    state.contract = getBreakoutContract(1);\n    state.contractProgress = 0;\n    state.contractComplete = false;\n    state.contractStreak = 0;\n    state.shake = 0;",
    'Breakout contract reset',
)
source = replace_once(
    source,
    "      const spawnWallSparks = (x: number, y: number, color: string, st: typeof state) => {\n        for (let i = 0; i < 6; i++) {",
    "      const registerContractEvent = (event: BreakoutContractEvent, value = 1) => {\n        if (state.contractComplete) return;\n        const nextProgress = advanceBreakoutContractProgress(\n          state.contract,\n          state.contractProgress,\n          event,\n          value,\n        );\n        if (nextProgress === state.contractProgress) return;\n        state.contractProgress = nextProgress;\n\n        if (isBreakoutContractComplete(state.contract, nextProgress)) {\n          state.contractComplete = true;\n          state.contractStreak++;\n          const reward = getBreakoutContractReward(state.round, state.contractStreak);\n          state.score += reward;\n          onScoreUpdate(state.score);\n          state.floatingTexts.push({\n            x: curW / 2,\n            y: Math.min(220, curH * 0.34),\n            text: `CONTRACT CLEAR x${state.contractStreak} +${reward}`,\n            color: '#FACC15',\n            life: 0,\n            maxLife: 72,\n          });\n          if (soundEnabled) sounds.playVictory();\n        }\n      };\n\n      const spawnWallSparks = (x: number, y: number, color: string, st: typeof state) => {\n        for (let i = 0; i < 6; i++) {",
    'Breakout contract event helper',
)
source = replace_once(
    source,
    "                triggerBrickBreak(brick, state, curW, curH, soundEnabled);\n              } else {",
    "                triggerBrickBreak(brick, state, curW, curH, soundEnabled);\n                if (brick.maxHp > 1) registerContractEvent('ARMORED');\n                if (brick.special) registerContractEvent('SPECIAL');\n              } else {",
    'Breakout laser contract events',
)
source = replace_once(
    source,
    "            applyPowerUp(pUp.type, state, curW, curH, soundEnabled);\n            state.powerUps.splice(p, 1);",
    "            applyPowerUp(pUp.type, state, curW, curH, soundEnabled);\n            registerContractEvent('POWER');\n            state.powerUps.splice(p, 1);",
    'Breakout power contract event',
)
source = replace_once(
    source,
    "              state.combo++;\n              const pts = 50 * Math.min(6, state.combo);",
    "              state.combo++;\n              registerContractEvent('COMBO', state.combo);\n              const pts = 50 * Math.min(6, state.combo);",
    'Breakout combo contract event',
)
source = replace_once(
    source,
    "                triggerBrickBreak(brick, state, curW, curH, soundEnabled);\n              } else {\n                haptics.light();",
    "                triggerBrickBreak(brick, state, curW, curH, soundEnabled);\n                if (brick.maxHp > 1) registerContractEvent('ARMORED');\n                if (brick.special) registerContractEvent('SPECIAL');\n              } else {\n                haptics.light();",
    'Breakout ball contract events',
)
source = replace_once(
    source,
    "        if (remaining === 0) {\n          state.round++;\n          state.score += 1000 * state.round;",
    "        if (remaining === 0) {\n          if (!state.contractComplete) state.contractStreak = 0;\n          state.round++;\n          state.contract = getBreakoutContract(state.round);\n          state.contractProgress = 0;\n          state.contractComplete = false;\n          state.score += 1000 * state.round;",
    'Breakout round contract reset',
)
source = replace_once(
    source,
    "      // Draw Bricks\n      state.bricks.forEach((brick) => {",
    "      // Round contract HUD: optional mastery objective layered over the base brick-breaker loop.\n      ctx.save();\n      const contractWidth = Math.min(340, Math.max(210, curW - 24));\n      ctx.fillStyle = 'rgba(9, 9, 11, 0.86)';\n      ctx.beginPath();\n      ctx.roundRect(12, 12, contractWidth, 46, 10);\n      ctx.fill();\n      ctx.strokeStyle = state.contractComplete ? '#34D399' : '#FACC15';\n      ctx.lineWidth = 1;\n      ctx.stroke();\n      ctx.fillStyle = state.contractComplete ? '#6EE7B7' : '#FDE047';\n      ctx.font = '900 10px ui-monospace, monospace';\n      ctx.textAlign = 'left';\n      ctx.textBaseline = 'middle';\n      ctx.fillText(`R${state.round} • CONTRACT ${state.contract.label}`, 20, 28);\n      ctx.fillStyle = '#D4D4D8';\n      ctx.font = '700 9px ui-monospace, monospace';\n      ctx.fillText(\n        `${Math.min(state.contractProgress, state.contract.target)}/${state.contract.target}${state.contractComplete ? ' CLEAR' : ''} • CONTRACT CHAIN x${state.contractStreak}`,\n        20,\n        44,\n      );\n      ctx.restore();\n\n      // Draw Bricks\n      state.bricks.forEach((brick) => {",
    'Breakout contract HUD',
)
write(path, source)


# ---------------------------------------------------------------------------
# Orbital Slingshot — sector navigation missions.
# ---------------------------------------------------------------------------
path = 'src/games/SlingshotGame.tsx'
source = read(path)
source = replace_once(
    source,
    "} from '../lib/slingshotRuntime';\n",
    "} from '../lib/slingshotRuntime';\nimport {\n  advanceSlingshotMissionProgress,\n  getSlingshotMission,\n  getSlingshotMissionReward,\n  isSlingshotMissionComplete,\n  type SlingshotMissionEvent,\n} from '../lib/slingshotMastery';\n",
    'Slingshot mastery import',
)
source = replace_once(
    source,
    "  const [sectorName, setSectorName] = useState('SOLAR CORE');\n",
    "  const [sectorName, setSectorName] = useState('SOLAR CORE');\n  const [missionHud, setMissionHud] = useState(() => ({\n    mission: getSlingshotMission(1),\n    progress: 0,\n    streak: 0,\n    complete: false,\n  }));\n",
    'Slingshot mission HUD state',
)
source = replace_once(
    source,
    "    sector: 1,\n    isAlive: true,",
    "    sector: 1,\n    mission: getSlingshotMission(1),\n    missionProgress: 0,\n    missionComplete: false,\n    missionStreak: 0,\n    isAlive: true,",
    'Slingshot mission ref state',
)
source = replace_once(
    source,
    "  const launchProbe = useCallback(() => {\n    const state = gameStateRef.current;",
    "  const registerMissionEvent = useCallback((event: SlingshotMissionEvent) => {\n    const state = gameStateRef.current;\n    if (state.missionComplete || !state.isAlive) return;\n\n    const nextProgress = advanceSlingshotMissionProgress(\n      state.mission,\n      state.missionProgress,\n      event,\n    );\n    if (nextProgress === state.missionProgress) return;\n    state.missionProgress = nextProgress;\n\n    if (isSlingshotMissionComplete(state.mission, nextProgress)) {\n      state.missionComplete = true;\n      state.missionStreak++;\n      const reward = getSlingshotMissionReward(state.sector, state.missionStreak);\n      state.score += reward;\n      onScoreUpdate(state.score);\n      setScore(state.score);\n      state.popups.push({\n        id: Math.random(),\n        text: `NAV MISSION CLEAR x${state.missionStreak} +${reward}`,\n        x: state.probeX,\n        y: state.probeY - 34,\n        color: '#FACC15',\n        life: 1.2,\n        scale: 1.15,\n      });\n      if (soundEnabled) sounds.playVictory();\n    }\n\n    setMissionHud({\n      mission: state.mission,\n      progress: state.missionProgress,\n      streak: state.missionStreak,\n      complete: state.missionComplete,\n    });\n  }, [onScoreUpdate, soundEnabled]);\n\n  const launchProbe = useCallback(() => {\n    const state = gameStateRef.current;",
    'Slingshot mission event helper',
)
source = replace_once(
    source,
    "    // Launch tangentially\n    state.isTethered = false;",
    "    if (state.isAimingAtNext) registerMissionEvent('LOCKED_LAUNCH');\n\n    // Launch tangentially\n    state.isTethered = false;",
    'Slingshot locked launch mission',
)
source = replace_once(
    source,
    "  }, [soundEnabled]);\n\n  const addScorePopup",
    "  }, [registerMissionEvent, soundEnabled]);\n\n  const addScorePopup",
    'Slingshot launch dependencies',
)
source = replace_once(
    source,
    "                if (node.isWarpGate) {\n                  // Warp into next sector!\n                  st.sector++;",
    "                if (isPerfect) registerMissionEvent('PERFECT_CAPTURE');\n\n                if (node.isWarpGate) {\n                  // Warp into next sector! Incomplete missions break the navigation chain.\n                  if (!st.missionComplete) st.missionStreak = 0;\n                  st.sector++;",
    'Slingshot capture mission',
)
source = replace_once(
    source,
    "                  const nextName = SECTOR_NAMES[(st.sector - 1) % SECTOR_NAMES.length];\n                  setSectorName(nextName);\n",
    "                  const nextName = SECTOR_NAMES[(st.sector - 1) % SECTOR_NAMES.length];\n                  setSectorName(nextName);\n                  st.mission = getSlingshotMission(st.sector);\n                  st.missionProgress = 0;\n                  st.missionComplete = false;\n                  setMissionHud({\n                    mission: st.mission,\n                    progress: 0,\n                    streak: st.missionStreak,\n                    complete: false,\n                  });\n",
    'Slingshot next mission',
)
source = replace_once(
    source,
    "            addScorePopup(`+${starBonus}`, star.x, star.y, '#FACC15');\n            if (soundEnabled) sounds.playPop();",
    "            addScorePopup(`+${starBonus}`, star.x, star.y, '#FACC15');\n            registerMissionEvent('STARDUST');\n            if (star.color === '#FACC15') registerMissionEvent('GOLD_DUST');\n            if (soundEnabled) sounds.playPop();",
    'Slingshot stardust mission',
)
source = replace_once(
    source,
    "      {/* Target Aiming Indicator / Lock-On Banner */}\n      <div className=\"absolute top-14 left-4 right-4 flex justify-center z-10 pointer-events-none\">",
    "      <div className=\"absolute top-14 left-4 z-10 pointer-events-none max-w-[calc(100%-2rem)]\">\n        <div className={`rounded-lg border px-2.5 py-1.5 backdrop-blur-md ${\n          missionHud.complete\n            ? 'border-emerald-400/45 bg-emerald-500/15 text-emerald-200'\n            : 'border-amber-400/35 bg-zinc-950/80 text-amber-200'\n        }`}>\n          <div className=\"font-mono-arcade text-[9px] font-black\">\n            NAV MISSION • {missionHud.mission.label} {missionHud.progress}/{missionHud.mission.target}\n            {missionHud.complete ? ' • CLEAR' : ''}\n          </div>\n          <div className=\"mt-0.5 font-mono-arcade text-[8px] text-zinc-400\">\n            {missionHud.mission.hint}{missionHud.streak > 0 ? ` • NAV x${missionHud.streak}` : ''}\n          </div>\n        </div>\n      </div>\n\n      {/* Target Aiming Indicator / Lock-On Banner */}\n      <div className=\"absolute top-[5.5rem] left-4 right-4 flex justify-center z-10 pointer-events-none\">",
    'Slingshot mission HUD',
)
write(path, source)


# ---------------------------------------------------------------------------
# One Line — stars + ink efficiency become optional Master Route goals.
# ---------------------------------------------------------------------------
path = 'src/games/OneLineGame.tsx'
source = read(path)
source = replace_once(
    source,
    "} from '../lib/oneLineRuntime';\n",
    "} from '../lib/oneLineRuntime';\nimport {\n  getOneLineInkRemainingPercent,\n  getOneLineMasteryGoal,\n  getOneLineMasteryReward,\n  isOneLineMasteryClear,\n} from '../lib/oneLineMastery';\n",
    'One Line mastery import',
)
source = replace_once(
    source,
    "  const [inkPercent, setInkPercent] = useState(100);\n",
    "  const [inkPercent, setInkPercent] = useState(100);\n  const [masteryStreak, setMasteryStreak] = useState(0);\n  const [masteryResult, setMasteryResult] = useState('');\n",
    'One Line mastery React state',
)
source = replace_once(
    source,
    "    attempts: 0,\n    shake: 0,",
    "    attempts: 0,\n    masteryStreak: 0,\n    shake: 0,",
    'One Line mastery ref state',
)
source = replace_once(
    source,
    "    setInkPercent(100);\n    setLevel(lvl);",
    "    setInkPercent(100);\n    setMasteryResult('');\n    setLevel(lvl);",
    'One Line mastery result reset',
)
source = replace_once(
    source,
    "    if (soundEnabled) sounds.playClick();\n    generateLevel(state.level, w, h);",
    "    if (soundEnabled) sounds.playClick();\n    state.masteryStreak = 0;\n    setMasteryStreak(0);\n    generateLevel(state.level, w, h);",
    'One Line Random breaks mastery streak',
)
source = replace_once(
    source,
    "          const starsEarned = state.stars.filter((s) => s.collected).length;\n          const stageBonus = 1000 + starsEarned * 500;\n          state.score += stageBonus;",
    "          const starsEarned = state.stars.filter((s) => s.collected).length;\n          const masteryGoal = getOneLineMasteryGoal(state.level);\n          const inkBudget = getOneLineInkBudget(curW, curH);\n          const usedInk = calculateTotalLength(state.linePoints);\n          const inkRemaining = getOneLineInkRemainingPercent(usedInk, inkBudget);\n          const mastered = isOneLineMasteryClear(masteryGoal, starsEarned, inkRemaining);\n          let masteryBonus = 0;\n          if (mastered) {\n            state.masteryStreak++;\n            setMasteryStreak(state.masteryStreak);\n            masteryBonus = getOneLineMasteryReward(state.level, state.masteryStreak);\n            setMasteryResult(`MASTER ROUTE x${state.masteryStreak} +${masteryBonus}`);\n          } else {\n            state.masteryStreak = 0;\n            setMasteryStreak(0);\n            setMasteryResult('STANDARD CLEAR • MASTER ROUTE MISSED');\n          }\n\n          const stageBonus = 1000 + starsEarned * 500 + masteryBonus;\n          state.score += stageBonus;",
    'One Line mastery clear scoring',
)
source = replace_once(
    source,
    "  return (\n    <div className=\"relative w-full h-full flex flex-col items-center justify-between select-none game-canvas-container touch-none bg-[#090D16] overflow-hidden\">",
    "  const masteryGoal = getOneLineMasteryGoal(level);\n\n  return (\n    <div className=\"relative w-full h-full flex flex-col items-center justify-between select-none game-canvas-container touch-none bg-[#090D16] overflow-hidden\">",
    'One Line mastery render goal',
)
source = replace_once(
    source,
    "      {/* Bottom Hint */}\n      {!physicsRunning && (",
    "      <div className=\"absolute top-14 left-4 pointer-events-none z-10\">\n        <div className=\"rounded-lg border border-emerald-400/25 bg-zinc-950/80 px-2.5 py-1.5 font-mono-arcade text-[9px] text-emerald-200 backdrop-blur-md\">\n          <span className=\"font-black\">MASTER ROUTE • {masteryGoal.label}</span>\n          <span className=\"ml-2 text-zinc-400\">{masteryGoal.minStars}★ + {masteryGoal.minInkRemainingPercent}% INK</span>\n          {masteryStreak > 0 && <span className=\"ml-2 text-amber-300\">CHAIN x{masteryStreak}</span>}\n        </div>\n      </div>\n\n      {masteryResult && (\n        <div className=\"absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-amber-400/35 bg-zinc-950/90 px-4 py-2 font-mono-arcade text-xs font-black text-amber-200 shadow-xl pointer-events-none\">\n          {masteryResult}\n        </div>\n      )}\n\n      {/* Bottom Hint */}\n      {!physicsRunning && (",
    'One Line mastery HUD',
)
source = replace_once(
    source,
    "          <span>DRAW ONE RAMP • RELEASE TO RUN PHYSICS • STARS ARE OPTIONAL</span>",
    "          <span>DRAW ONE RAMP • STARS STAY OPTIONAL • MASTER ROUTE REWARDS STAR + INK EFFICIENCY</span>",
    'One Line mastery teaching',
)
write(path, source)


# ---------------------------------------------------------------------------
# Registry teaching copy — describe the new mastery layer before first play.
# ---------------------------------------------------------------------------
path = 'src/data/games.ts'
source = read(path)
source = replace_once(
    source,
    "    description: 'Spend a limited ink budget on one physical ramp, release the ball, exploit walls/bouncers, and optionally collect three stars before the portal.',\n",
    "    description: 'Solve ten procedural physics archetypes, then chase rotating Master Route goals that combine optional stars with ink-efficiency targets and mastery streaks.',\n",
    'One Line registry description',
)
source = replace_once(
    source,
    "    instructions: 'Draw one continuous ramp with limited ink, then release to run physics. Guide the ball into the portal; stars are optional bonus targets.',\n",
    "    instructions: 'Draw one continuous ramp with limited ink. Ordinary clears only require the portal; Master Route goals reward star collection plus efficient ink use.',\n",
    'One Line registry instructions',
)
source = replace_once(
    source,
    "    description: 'Shatter multi-hit bricks and catch marked drops for Multiball, Laser, Wide Paddle, Fireball, and score boosts.',\n",
    "    description: 'Shatter multi-hit bricks and exploit five powerups while rotating round contracts challenge combo control, power catches, armor breaks, and special-brick hunting.',\n",
    'Breakout registry description',
)
source = replace_once(
    source,
    "    instructions: 'Move the paddle to keep balls alive. Break marked bricks and catch their falling powerups to reshape each run.',\n",
    "    instructions: 'Keep the ball alive, use marked powerups, and clear the optional round contract to build an escalating contract chain.',\n",
    'Breakout registry instructions',
)
source = replace_once(
    source,
    "    description: 'Orbit celestial planets in deep space. Tap at the exact tangent angle to launch across space, catching the gravity field of the next cosmic anchor while gathering star dust crystals.',\n",
    "    description: 'Cross endless gravity-well sectors while rotating sector navigation missions reward lock-on launches, deep captures, stardust routes, and gold-trail precision.',\n",
    'Slingshot registry description',
)
source = replace_once(
    source,
    "    instructions: 'Tap or press Space to release orbit tangentially. Enter target gravity wells to tether.',\n",
    "    instructions: 'Tap or press Space to release orbit tangentially. Enter gravity wells to tether and complete the current navigation mission before each warp.',\n",
    'Slingshot registry instructions',
)
write(path, source)
