from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 marker, found {count}')
    p.write_text(text.replace(old, new, 1))


# ---------------------------------------------------------------------------
# Gravity — authored Flight Contracts that never alter deterministic physics.
# ---------------------------------------------------------------------------
replace_once(
    'src/games/GravityGame.tsx',
    "} from '../lib/gravityRuntime';\n",
    "} from '../lib/gravityRuntime';\nimport {\n  getGravityFlightContract,\n  getGravityFlightContractBonus,\n  isGravityFlightContractComplete,\n} from '../lib/gravityFlightContracts';\n",
    'gravity mastery import',
)
replace_once(
    'src/games/GravityGame.tsx',
    "  const [gravityInverted, setGravityInverted] = useState(false);\n",
    "  const [gravityInverted, setGravityInverted] = useState(false);\n  const [contractStreak, setContractStreak] = useState(0);\n  const [contractBoostsUsed, setContractBoostsUsed] = useState(0);\n  const [contractFlipsUsed, setContractFlipsUsed] = useState(0);\n  const [contractRecallsUsed, setContractRecallsUsed] = useState(0);\n",
    'gravity mastery react state',
)
replace_once(
    'src/games/GravityGame.tsx',
    "    steerImpulsePending: false,\n  });",
    "    steerImpulsePending: false,\n    contractStreak: 0,\n    boostsUsed: 0,\n    flipsUsed: 0,\n    recallsUsed: 0,\n  });",
    'gravity mastery game state',
)
replace_once(
    'src/games/GravityGame.tsx',
    "    state.boosts = 4;\n    state.gravityInverted = false;\n",
    "    state.boosts = 4;\n    state.boostsUsed = 0;\n    state.flipsUsed = 0;\n    state.recallsUsed = 0;\n    setContractBoostsUsed(0);\n    setContractFlipsUsed(0);\n    setContractRecallsUsed(0);\n    state.gravityInverted = false;\n",
    'gravity contract counter reset',
)
replace_once(
    'src/games/GravityGame.tsx',
    "    state.gravityInverted = !state.gravityInverted;\n    setGravityInverted(state.gravityInverted);\n",
    "    state.gravityInverted = !state.gravityInverted;\n    state.flipsUsed++;\n    setContractFlipsUsed(state.flipsUsed);\n    setGravityInverted(state.gravityInverted);\n",
    'gravity flip tracking',
)
replace_once(
    'src/games/GravityGame.tsx',
    "    if (soundEnabled) sounds.playPop();\n\n    // Warp particles at current position\n",
    "    if (state.hasLaunched) {\n      state.recallsUsed++;\n      setContractRecallsUsed(state.recallsUsed);\n    }\n\n    if (soundEnabled) sounds.playPop();\n\n    // Warp particles at current position\n",
    'gravity recall tracking',
)
replace_once(
    'src/games/GravityGame.tsx',
    "    state.boosts--;\n    setBoostsRemaining(state.boosts);\n",
    "    state.boosts--;\n    state.boostsUsed++;\n    setContractBoostsUsed(state.boostsUsed);\n    setBoostsRemaining(state.boosts);\n",
    'gravity boost tracking',
)
replace_once(
    'src/games/GravityGame.tsx',
    "            const collectedStars = state.stars.filter((star) => star.collected).length;\n            const sectorBonus = 1000 + collectedStars * 500;\n            state.score += sectorBonus;\n            onScoreUpdate(state.score);",
    "            const collectedStars = state.stars.filter((star) => star.collected).length;\n            const flightContract = getGravityFlightContract(state.level);\n            const contractComplete = isGravityFlightContractComplete(flightContract, {\n              stars: collectedStars,\n              boostsUsed: state.boostsUsed,\n              flipsUsed: state.flipsUsed,\n              recallsUsed: state.recallsUsed,\n            });\n            let contractBonus = 0;\n            if (contractComplete) {\n              state.contractStreak = Math.min(5, state.contractStreak + 1);\n              contractBonus = getGravityFlightContractBonus(state.level, state.contractStreak);\n              setContractStreak(state.contractStreak);\n              if (soundEnabled) sounds.playVictory();\n            } else {\n              state.contractStreak = 0;\n              setContractStreak(0);\n            }\n            const sectorBonus = 1000 + collectedStars * 500 + contractBonus;\n            state.score += sectorBonus;\n            onScoreUpdate(state.score);",
    'gravity contract completion',
)
replace_once(
    'src/games/GravityGame.tsx',
    "  return (\n    <div className=\"relative w-full h-full flex flex-col items-center justify-between select-none game-canvas-container touch-none bg-[#090D16] overflow-hidden\">",
    "  const activeFlightContract = getGravityFlightContract(currentLevel);\n\n  return (\n    <div className=\"relative w-full h-full flex flex-col items-center justify-between select-none game-canvas-container touch-none bg-[#090D16] overflow-hidden\">",
    'gravity active contract',
)
replace_once(
    'src/games/GravityGame.tsx',
    "      {/* Top Right Quick Controls */}\n",
    "      <div className=\"absolute top-14 left-1/2 -translate-x-1/2 max-w-[calc(100%-1rem)] px-3 py-1.5 rounded-xl bg-indigo-950/85 border border-indigo-400/30 text-[9px] sm:text-[10px] text-indigo-100 font-mono-arcade text-center pointer-events-none z-10 backdrop-blur-md\">\n        <span className=\"font-black text-indigo-300\">FLIGHT CONTRACT — {activeFlightContract.label}</span>\n        <span> • {activeFlightContract.detail}</span>\n        <span className=\"text-amber-300\"> • STREAK {contractStreak}</span>\n        <span className=\"text-zinc-400\"> • B{contractBoostsUsed} F{contractFlipsUsed} R{contractRecallsUsed}</span>\n      </div>\n\n      {/* Top Right Quick Controls */}\n",
    'gravity contract hud',
)

# ---------------------------------------------------------------------------
# Chrono — Focus Wager narrows only the mastery target, never the safe gap.
# ---------------------------------------------------------------------------
replace_once(
    'src/games/ChronoGame.tsx',
    "} from '../lib/chronoWavePlanner';\n",
    "} from '../lib/chronoWavePlanner';\nimport {\n  getChronoFocusBonus,\n  getChronoFocusCharges,\n  isChronoFocusHit,\n} from '../lib/chronoFocusMastery';\n",
    'chrono focus import',
)
replace_once(
    'src/games/ChronoGame.tsx',
    "  const [rightActive, setRightActive] = useState(false);\n",
    "  const [rightActive, setRightActive] = useState(false);\n  const [focusCharges, setFocusCharges] = useState(1);\n  const [focusArmed, setFocusArmed] = useState(false);\n  const [focusStreak, setFocusStreak] = useState(0);\n",
    'chrono focus react state',
)
replace_once(
    'src/games/ChronoGame.tsx',
    "    speedMultiplier: 1.0,\n  });",
    "    speedMultiplier: 1.0,\n    focusCharges: 1,\n    focusArmed: false,\n    focusStreak: 0,\n    cleanPasses: 0,\n  });",
    'chrono focus game state',
)
replace_once(
    'src/games/ChronoGame.tsx',
    "  // Trigger EMP Blast\n  const triggerEmp = useCallback(() => {",
    "  // P13 Focus Wager: spend a charge to demand a center-line pass on the next wall.\n  const triggerFocus = useCallback(() => {\n    const state = gameStateRef.current;\n    if (!state.isAlive || isPausedRef.current || state.focusArmed || state.focusCharges <= 0) return;\n    state.focusCharges--;\n    state.focusArmed = true;\n    setFocusCharges(state.focusCharges);\n    setFocusArmed(true);\n    if (soundEnabled) sounds.playChime(920);\n  }, [soundEnabled]);\n\n  // Trigger EMP Blast\n  const triggerEmp = useCallback(() => {",
    'chrono focus trigger',
)
replace_once(
    'src/games/ChronoGame.tsx',
    "    state.empCharges--;\n    setEmpReady(false);\n",
    "    state.empCharges--;\n    setEmpReady(false);\n    if (state.focusArmed) {\n      state.focusArmed = false;\n      state.focusStreak = 0;\n      setFocusArmed(false);\n      setFocusStreak(0);\n    }\n",
    'chrono emp cancels focus',
)
replace_once(
    'src/games/ChronoGame.tsx',
    "      } else if (e.key === ' ' || e.key === 'e' || e.key === 'E') {\n        triggerEmp();\n      }\n",
    "      } else if (e.key === ' ' || e.key === 'e' || e.key === 'E') {\n        triggerEmp();\n      } else if (e.key === 'f' || e.key === 'F' || e.key === 'Shift') {\n        e.preventDefault();\n        triggerFocus();\n      }\n",
    'chrono focus keyboard',
)
replace_once(
    'src/games/ChronoGame.tsx',
    "  }, [triggerEmp]);\n",
    "  }, [triggerEmp, triggerFocus]);\n",
    'chrono effect dependencies',
)
replace_once(
    'src/games/ChronoGame.tsx',
    "              state.score += 250;\n              onScoreUpdate(state.score);\n              if (soundEnabled) sounds.playScore();\n              addScorePopup('+250', cx + Math.cos(state.playerAngle) * pR, cy + Math.sin(state.playerAngle) * pR, wall.color);\n",
    "              state.score += 250;\n              state.cleanPasses++;\n              const chargedFocus = getChronoFocusCharges(state.cleanPasses, state.focusCharges);\n              if (chargedFocus !== state.focusCharges) {\n                state.focusCharges = chargedFocus;\n                setFocusCharges(chargedFocus);\n              }\n              if (state.focusArmed) {\n                if (isChronoFocusHit(state.playerAngle, wall.openSide, wall.openSpan, wall.sides)) {\n                  state.focusStreak = Math.min(5, state.focusStreak + 1);\n                  const focusBonus = getChronoFocusBonus(state.focusStreak);\n                  state.score += focusBonus;\n                  setFocusStreak(state.focusStreak);\n                  addScorePopup(`FOCUS LOCK +${focusBonus}`, cx + Math.cos(state.playerAngle) * pR, cy + Math.sin(state.playerAngle) * pR - 18, '#FACC15');\n                } else {\n                  state.focusStreak = 0;\n                  setFocusStreak(0);\n                  addScorePopup('FOCUS MISSED — SAFE PASS', cx, cy - 36, '#A1A1AA');\n                }\n                state.focusArmed = false;\n                setFocusArmed(false);\n              }\n              onScoreUpdate(state.score);\n              if (soundEnabled) sounds.playScore();\n              addScorePopup('+250', cx + Math.cos(state.playerAngle) * pR, cy + Math.sin(state.playerAngle) * pR, wall.color);\n",
    'chrono focus resolution',
)
replace_once(
    'src/games/ChronoGame.tsx',
    "              wall.cleared = true;\n              state.lives--;\n",
    "              wall.cleared = true;\n              if (state.focusArmed) {\n                state.focusArmed = false;\n                state.focusStreak = 0;\n                setFocusArmed(false);\n                setFocusStreak(0);\n              }\n              state.lives--;\n",
    'chrono focus collision reset',
)
replace_once(
    'src/games/ChronoGame.tsx',
    "          <div className=\"flex items-center gap-1 text-amber-400\">\n            <Sparkles className=\"w-3.5 h-3.5\" />\n            <span>{shardsCount}/3 SHARDS</span>\n          </div>\n",
    "          <div className=\"flex items-center gap-1 text-amber-400\">\n            <Sparkles className=\"w-3.5 h-3.5\" />\n            <span>{shardsCount}/3 SHARDS</span>\n          </div>\n          <span className=\"text-[#71717A]\">|</span>\n          <span className={focusArmed ? 'text-amber-300 font-black' : 'text-cyan-300 font-bold'}>\n            FOCUS {focusCharges} • STREAK {focusStreak}\n          </span>\n",
    'chrono focus hud',
)
replace_once(
    'src/games/ChronoGame.tsx',
    "      {/* Bottom Control Bar */}\n",
    "      <button\n        type=\"button\"\n        onClick={triggerFocus}\n        disabled={focusCharges <= 0 || focusArmed}\n        className={`absolute bottom-20 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-xl border font-mono-arcade text-[10px] font-black pointer-events-auto transition-all ${\n          focusArmed\n            ? 'bg-amber-500/30 border-amber-400 text-amber-200 animate-pulse'\n            : focusCharges > 0\n              ? 'bg-cyan-950/90 border-cyan-400/50 text-cyan-200 hover:bg-cyan-900 cursor-pointer'\n              : 'bg-zinc-900/80 border-zinc-700 text-zinc-600 cursor-not-allowed'\n        }`}\n      >\n        {focusArmed ? 'FOCUS WAGER — CENTER NEXT GAP' : `FOCUS WAGER ×${focusCharges} [F / SHIFT]`}\n      </button>\n\n      {/* Bottom Control Bar */}\n",
    'chrono focus button',
)

# ---------------------------------------------------------------------------
# Drift — optional positive-event Style Routes; driving physics are untouched.
# ---------------------------------------------------------------------------
replace_once(
    'src/games/DriftGame.tsx',
    "import { DRIFT_FIXED_STEP_SEC, getDriftPhysicsStepBatch } from '../lib/driftRuntime';\n",
    "import { DRIFT_FIXED_STEP_SEC, getDriftPhysicsStepBatch } from '../lib/driftRuntime';\nimport {\n  DRIFT_STYLE_MAX_CHAIN,\n  DRIFT_STYLE_ROUTES,\n  DriftStyleEvent,\n  advanceDriftStyleRoute,\n  getDriftStyleBonus,\n  getDriftStyleEventLabel,\n} from '../lib/driftStyleRoutes';\n",
    'drift style import',
)
replace_once(
    'src/games/DriftGame.tsx',
    "  const [currentSpeedKmh, setCurrentSpeedKmh] = useRenderPublishedState(160, 100);\n",
    "  const [currentSpeedKmh, setCurrentSpeedKmh] = useRenderPublishedState(160, 100);\n  const [styleRouteIndex, setStyleRouteIndex] = useState(0);\n  const [styleRouteProgress, setStyleRouteProgress] = useState(0);\n  const [styleChain, setStyleChain] = useState(0);\n",
    'drift style react state',
)
replace_once(
    'src/games/DriftGame.tsx',
    "    physicsAccumulator: 0,\n  });",
    "    physicsAccumulator: 0,\n    styleRouteIndex: 0,\n    styleRouteProgress: 0,\n    styleChain: 0,\n  });",
    'drift style game state',
)
replace_once(
    'src/games/DriftGame.tsx',
    "  useEffect(() => {\n    const canvas = canvasRef.current;",
    "  const recordStyleEvent = useCallback((event: DriftStyleEvent) => {\n    const state = gameStateRef.current;\n    const next = advanceDriftStyleRoute(state.styleRouteIndex, state.styleRouteProgress, event);\n    state.styleRouteIndex = next.routeIndex;\n    state.styleRouteProgress = next.progress;\n    if (next.completed) {\n      state.styleChain = Math.min(DRIFT_STYLE_MAX_CHAIN, state.styleChain + 1);\n      const bonus = getDriftStyleBonus(state.styleChain);\n      state.score += bonus;\n      publishScore(state.score);\n      setScore(state.score);\n      addScorePopup(`STYLE ROUTE x${state.styleChain} +${bonus}`, state.carX, state.carY - 48, '#FACC15', 1.2);\n      if (soundEnabled) sounds.playVictory();\n    }\n    setStyleRouteIndex(state.styleRouteIndex);\n    setStyleRouteProgress(state.styleRouteProgress);\n    setStyleChain(state.styleChain);\n  }, [addScorePopup, publishScore, setScore, soundEnabled]);\n\n  useEffect(() => {\n    const canvas = canvasRef.current;",
    'drift style recorder',
)
replace_once(
    'src/games/DriftGame.tsx',
    "              if (soundEnabled) sounds.playVictory();\n\n              // Boost Nitro\n",
    "              if (soundEnabled) sounds.playVictory();\n              recordStyleEvent('apex');\n\n              // Boost Nitro\n",
    'drift apex style event',
)
replace_once(
    'src/games/DriftGame.tsx',
    "              addScorePopup('+NITRO CELL!', st.carX, st.carY - 30, '#38BDF8');\n              if (soundEnabled) sounds.playPop();\n",
    "              addScorePopup('+NITRO CELL!', st.carX, st.carY - 30, '#38BDF8');\n              if (soundEnabled) sounds.playPop();\n              recordStyleEvent('nitro');\n",
    'drift nitro style event',
)
replace_once(
    'src/games/DriftGame.tsx',
    "                addScorePopup(`CLOSE PASS! +${bonus}`, st.carX, st.carY - 25, '#FACC15');\n                if (soundEnabled) sounds.playSuccess();\n",
    "                addScorePopup(`CLOSE PASS! +${bonus}`, st.carX, st.carY - 25, '#FACC15');\n                if (soundEnabled) sounds.playSuccess();\n                recordStyleEvent('rival');\n",
    'drift rival style event',
)
replace_once(
    'src/games/DriftGame.tsx',
    "  return (\n    <div className=\"relative w-full h-full min-h-0 flex flex-col bg-[#09090B] overflow-hidden select-none touch-none\">",
    "  const activeStyleRoute = DRIFT_STYLE_ROUTES[styleRouteIndex];\n  const expectedStyleEvent = getDriftStyleEventLabel(activeStyleRoute.events[styleRouteProgress]);\n\n  return (\n    <div className=\"relative w-full h-full min-h-0 flex flex-col bg-[#09090B] overflow-hidden select-none touch-none\">",
    'drift active style route',
)
replace_once(
    'src/games/DriftGame.tsx',
    "      {/* Responsive Touch Steer Paddles & Nitro */}\n",
    "      <div className=\"absolute bottom-[4.5rem] left-1/2 -translate-x-1/2 z-10 max-w-[calc(100%-1rem)] px-3 py-1.5 rounded-xl bg-amber-950/85 border border-amber-400/30 text-[9px] sm:text-[10px] text-amber-100 font-mono-arcade text-center pointer-events-none backdrop-blur-md\">\n        <span className=\"font-black text-amber-300\">STYLE ROUTE — {activeStyleRoute.label}</span>\n        <span> • NEXT {expectedStyleEvent}</span>\n        <span className=\"text-cyan-300\"> • {styleRouteProgress}/3 • CHAIN {styleChain}</span>\n      </div>\n\n      {/* Responsive Touch Steer Paddles & Nitro */}\n",
    'drift style hud',
)

# ---------------------------------------------------------------------------
# Registry teaching — preserve established control semantics while explaining P13.
# ---------------------------------------------------------------------------
replace_once(
    'src/data/games.ts',
    "    description: 'Drag back to aim launch velocity. Use gravity wells to slingshot the probe into the warp beacon.',\n",
    "    description: 'Navigate five authored gravity sectors and pursue optional Flight Contracts that reward star routes, boost discipline, polarity use, and clean no-recall trajectories.',\n",
    'gravity registry description',
)
replace_once(
    'src/data/games.ts',
    "    instructions: 'Drag to slingshot probe. Touch/click or use A/D to steer direction in flight, and G to flip gravity.',\n",
    "    instructions: 'Drag to slingshot, steer in flight, boost with Space and flip with G. Each sector advertises an optional Flight Contract; complete it before the warp beacon to build a contract streak.',\n",
    'gravity registry instructions',
)
replace_once(
    'src/data/games.ts',
    "    description: 'Orbit around the glowing singularity, weaving through closing laser gates and rhythmically pulsing polygon waves.',\n",
    "    description: 'Orbit through planner-certified laser gaps, collect shards for EMP, and spend earned Focus Wagers on optional center-line precision passes for escalating mastery rewards.',\n",
    'chrono registry description',
)
replace_once(
    'src/data/games.ts',
    "    instructions: 'Hold A/D or Left/Right to rotate around the core. Space to trigger EMP blast.',\n    controlsHint: 'A / D • Left/Right Arrow • [Space] EMP',\n",
    "    instructions: 'Hold A/D or Left/Right to rotate. Space/E triggers EMP. Every four clean wall passes can earn Focus; press F/Shift or tap Focus Wager to arm the next gap for a tighter center-line bonus.',\n    controlsHint: 'A / D • Left/Right Arrow • [Space] EMP • F/Shift: Focus Wager',\n",
    'chrono registry instructions',
)
replace_once(
    'src/data/games.ts',
    "    description: 'Power-slide around twisting highway curves, graze neon apex gates, trigger nitro boosts, and dodge oil slicks and electrified barriers.',\n",
    "    description: 'Power-slide through hazards, rivals and apex gates while rotating Style Routes ask you to deliberately chain Apex, Close Pass and Nitro events for escalating mastery bonuses.',\n",
    'drift registry description',
)
replace_once(
    'src/data/games.ts',
    "    instructions: 'Steer with A/D, Arrow Keys, or on-screen buttons to drift. Tap Space/Nitro to boost.',\n",
    "    instructions: 'Steer with A/D, Arrow Keys, or on-screen buttons and use Space/Nitro to boost. Read the current Style Route and choose which positive events to pursue in order.',\n",
    'drift registry instructions',
)

print('P13 source patch applied')
