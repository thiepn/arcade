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
# Stack — player-spendable Focus wagers.
# ---------------------------------------------------------------------------
path = 'src/games/StackGame.tsx'
source = read(path)
source = replace_once(
    source,
    "import React, { useEffect, useRef } from 'react';",
    "import React, { useEffect, useRef, useState } from 'react';",
    'Stack React imports',
)
source = replace_once(
    source,
    "import { getArcadeStepBatch, getFrameInvariantBlend, getFrameInvariantDecay, getFrameScale } from '../lib/frameRateRuntime';\n",
    "import { getArcadeStepBatch, getFrameInvariantBlend, getFrameInvariantDecay, getFrameScale } from '../lib/frameRateRuntime';\nimport {\n  STACK_FOCUS_MAX_CHARGES,\n  STACK_FOCUS_START_CHARGES,\n  canArmStackFocus,\n  getStackFocusReward,\n  getStackPerfectWindow,\n  shouldEarnStackFocus,\n} from '../lib/stackMastery';\n",
    'Stack mastery import',
)
source = replace_once(
    source,
    "  const setSafeTimeout = useSafeTimeout();\n\n  const gameStateRef = useRef({",
    "  const setSafeTimeout = useSafeTimeout();\n  const [focusHud, setFocusHud] = useState({\n    charges: STACK_FOCUS_START_CHARGES,\n    armed: false,\n    chain: 0,\n  });\n\n  const gameStateRef = useRef({",
    'Stack Focus HUD state',
)
source = replace_once(
    source,
    "    score: 0,\n    perfectStreak: 0,\n    isAlive: true,",
    "    score: 0,\n    perfectStreak: 0,\n    focusCharges: STACK_FOCUS_START_CHARGES,\n    focusArmed: false,\n    focusChain: 0,\n    isAlive: true,",
    'Stack Focus ref state',
)
source = replace_once(
    source,
    "  const getHue = (index: number) => {\n",
    "  const publishFocusHud = () => {\n    const state = gameStateRef.current;\n    setFocusHud({\n      charges: state.focusCharges,\n      armed: state.focusArmed,\n      chain: state.focusChain,\n    });\n  };\n\n  const armFocus = () => {\n    const state = gameStateRef.current;\n    if (!canArmStackFocus(state.focusCharges, state.focusArmed, state.isAlive) || isPausedRef.current) return;\n    state.focusCharges--;\n    state.focusArmed = true;\n    publishFocusHud();\n    if (soundEnabled) sounds.playPowerUp();\n  };\n\n  const getHue = (index: number) => {\n",
    'Stack Focus actions',
)
source = replace_once(
    source,
    "    const diff = state.currentX - prevBlock.x;\n    const absDiff = Math.abs(diff);\n\n    // Perfect alignment threshold (within 4 pixels)\n    if (absDiff <= 4) {",
    "    const diff = state.currentX - prevBlock.x;\n    const absDiff = Math.abs(diff);\n    const focusAttempt = state.focusArmed;\n    const perfectWindow = getStackPerfectWindow(focusAttempt);\n    if (focusAttempt) {\n      state.focusArmed = false;\n    }\n\n    // Focus deliberately tightens only the perfect snap window; an overlapping\n    // miss still resolves as an ordinary sliced placement instead of ending the run.\n    if (absDiff <= perfectWindow) {",
    'Stack Focus placement window',
)
source = replace_once(
    source,
    "      state.score += 1;\n      onScoreUpdate(state.score);\n",
    "      state.score += 1;\n      if (focusAttempt) {\n        state.focusChain++;\n        const reward = getStackFocusReward(state.blocks.length + 1, state.focusChain);\n        state.score += reward;\n        state.floatingTexts.push({\n          x: state.currentX + state.currentWidth / 2,\n          y: state.blocks.length * state.currentHeight + 38,\n          text: `FOCUS x${state.focusChain} +${reward}`,\n          color: '#FACC15',\n          life: 0,\n          maxLife: 44,\n        });\n      }\n      if (shouldEarnStackFocus(state.perfectStreak)) {\n        state.focusCharges = Math.min(STACK_FOCUS_MAX_CHARGES, state.focusCharges + 1);\n      }\n      publishFocusHud();\n      onScoreUpdate(state.score);\n",
    'Stack Focus perfect reward',
)
source = replace_once(
    source,
    "    state.perfectStreak = 0;\n\n    // Check complete miss",
    "    if (focusAttempt) {\n      state.focusChain = 0;\n      publishFocusHud();\n      state.floatingTexts.push({\n        x: state.currentX + state.currentWidth / 2,\n        y: state.blocks.length * state.currentHeight + 22,\n        text: 'FOCUS MISSED — STACK CONTINUES',\n        color: '#FB923C',\n        life: 0,\n        maxLife: 36,\n      });\n    }\n    state.perfectStreak = 0;\n\n    // Check complete miss",
    'Stack Focus miss handling',
)
source = replace_once(
    source,
    "    state.score = 0;\n    state.perfectStreak = 0;\n    state.cameraY = 0;",
    "    state.score = 0;\n    state.perfectStreak = 0;\n    state.focusCharges = STACK_FOCUS_START_CHARGES;\n    state.focusArmed = false;\n    state.focusChain = 0;\n    setFocusHud({ charges: STACK_FOCUS_START_CHARGES, armed: false, chain: 0 });\n    state.cameraY = 0;",
    'Stack Focus reset',
)
source = replace_once(
    source,
    "    const handleKeyDown = (e: KeyboardEvent) => {\n      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {",
    "    const handleKeyDown = (e: KeyboardEvent) => {\n      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyF') {\n        e.preventDefault();\n        armFocus();\n        return;\n      }\n      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {",
    'Stack Focus keyboard control',
)
source = replace_once(
    source,
    "      ctx.fillText(`${state.score * 10}m ALTITUDE`, curW - 20, 36);",
    "      ctx.fillText(`${Math.max(0, state.blocks.length - 1) * 10}m ALTITUDE`, curW - 20, 36);",
    'Stack altitude decoupled from bonus score',
)
source = replace_once(
    source,
    "  return (\n    <div className=\"relative w-full h-full flex items-center justify-center select-none game-canvas-container touch-none\">\n      <canvas ref={canvasRef} className=\"w-full h-full block cursor-pointer touch-none\" />\n    </div>\n  );",
    "  return (\n    <div className=\"relative w-full h-full flex items-center justify-center select-none game-canvas-container touch-none\">\n      <canvas ref={canvasRef} className=\"w-full h-full block cursor-pointer touch-none\" />\n\n      <div className=\"absolute top-3 left-3 z-10 pointer-events-none rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-1.5 font-mono text-[10px] font-black text-zinc-200 backdrop-blur-md\">\n        FOCUS {focusHud.charges}/{STACK_FOCUS_MAX_CHARGES}\n        {focusHud.chain > 0 ? ` • CHAIN x${focusHud.chain}` : ''}\n      </div>\n\n      <button\n        type=\"button\"\n        onClick={armFocus}\n        disabled={focusHud.charges <= 0 || focusHud.armed}\n        className={`absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-xl border px-4 py-2 font-mono text-[10px] font-black transition-all ${\n          focusHud.armed\n            ? 'border-amber-300 bg-amber-400/25 text-amber-200'\n            : focusHud.charges > 0\n            ? 'border-cyan-400/50 bg-zinc-950/85 text-cyan-200 hover:bg-cyan-500/15'\n            : 'cursor-not-allowed border-zinc-800 bg-zinc-950/70 text-zinc-600'\n        }`}\n      >\n        {focusHud.armed ? 'FOCUS ARMED • 2PX WINDOW' : `ARM FOCUS [F/SHIFT] • ${focusHud.charges} CHARGE${focusHud.charges === 1 ? '' : 'S'}`}\n      </button>\n    </div>\n  );",
    'Stack Focus HUD controls',
)
write(path, source)


# ---------------------------------------------------------------------------
# Pulse — voluntary Sync Wagers layered over the unchanged base judgement.
# ---------------------------------------------------------------------------
path = 'src/games/PulseGame.tsx'
source = read(path)
source = replace_once(
    source,
    "import { getFrameInvariantBlend, getFrameInvariantDecay } from '../lib/frameRateRuntime';\n",
    "import { getFrameInvariantBlend, getFrameInvariantDecay } from '../lib/frameRateRuntime';\nimport {\n  PULSE_WAGER_MAX_CHARGES,\n  PULSE_WAGER_START_CHARGES,\n  PULSE_WAGER_WINDOW_PX,\n  canArmPulseWager,\n  getPulseWagerReward,\n  isPulseWagerHit,\n  shouldEarnPulseWager,\n} from '../lib/pulseMastery';\n",
    'Pulse wager import',
)
source = replace_once(
    source,
    "  const [patternInfo, setPatternInfo] = useState<GroovePattern>(GROOVE_PATTERNS[0]);\n",
    "  const [patternInfo, setPatternInfo] = useState<GroovePattern>(GROOVE_PATTERNS[0]);\n  const [wagerHud, setWagerHud] = useState({\n    charges: PULSE_WAGER_START_CHARGES,\n    armed: false,\n    streak: 0,\n  });\n",
    'Pulse wager HUD state',
)
source = replace_once(
    source,
    "    combo: 0,\n    score: 0,",
    "    combo: 0,\n    syncWagerCharges: PULSE_WAGER_START_CHARGES,\n    syncWagerArmed: false,\n    syncWagerStreak: 0,\n    score: 0,",
    'Pulse wager ref state',
)
source = replace_once(
    source,
    "  const nextBeat = useCallback(() => {\n",
    "  const publishWagerHud = () => {\n    const state = gameStateRef.current;\n    setWagerHud({\n      charges: state.syncWagerCharges,\n      armed: state.syncWagerArmed,\n      streak: state.syncWagerStreak,\n    });\n  };\n\n  const armSyncWager = () => {\n    const state = gameStateRef.current;\n    if (!canArmPulseWager(state.syncWagerCharges, state.syncWagerArmed, state.isAlive) || isPausedRef.current) return;\n    state.syncWagerCharges--;\n    state.syncWagerArmed = true;\n    publishWagerHud();\n    if (soundEnabledRef.current) sounds.playPowerUp();\n  };\n\n  const nextBeat = useCallback(() => {\n",
    'Pulse wager actions',
)
source = replace_once(
    source,
    "  const triggerHit = useCallback(() => {\n    const state = gameStateRef.current;\n    if (!state.isAlive || isPausedRef.current) return;\n",
    "  const triggerHit = useCallback(() => {\n    const state = gameStateRef.current;\n    if (!state.isAlive || isPausedRef.current) return;\n    const wagerAttempt = state.syncWagerArmed;\n    if (wagerAttempt) {\n      state.syncWagerArmed = false;\n    }\n",
    'Pulse wager attempt capture',
)
source = replace_once(
    source,
    "      state.combo = 0;\n      setCombo(0);\n      setFeverMode(false);\n      setLastFeedback({\n        text: 'EARLY MISS',",
    "      state.combo = 0;\n      setCombo(0);\n      setFeverMode(false);\n      if (wagerAttempt) {\n        state.syncWagerStreak = 0;\n        publishWagerHud();\n      }\n      setLastFeedback({\n        text: 'EARLY MISS',",
    'Pulse outward early wager fail',
)
# The inward early-miss block has the same leading marker after the first replacement.
source = replace_once(
    source,
    "      state.combo = 0;\n      setCombo(0);\n      setFeverMode(false);\n      setLastFeedback({\n        text: 'EARLY MISS',",
    "      state.combo = 0;\n      setCombo(0);\n      setFeverMode(false);\n      if (wagerAttempt) {\n        state.syncWagerStreak = 0;\n        publishWagerHud();\n      }\n      setLastFeedback({\n        text: 'EARLY MISS',",
    'Pulse inward early wager fail',
)
source = replace_once(
    source,
    "    setCombo(state.combo);\n    setFeverMode(state.combo >= 5);\n    onScoreUpdate(state.score);",
    "    if (wagerAttempt) {\n      if (isPulseWagerHit(absDiff)) {\n        state.syncWagerStreak++;\n        const wagerReward = getPulseWagerReward(state.combo, state.syncWagerStreak);\n        state.score += wagerReward;\n        setLastFeedback({\n          text: `SYNC WAGER x${state.syncWagerStreak}!`,\n          subtext: `±${PULSE_WAGER_WINDOW_PX}px BONUS • +${wagerReward}`,\n          color: 'text-fuchsia-300',\n        });\n        if (soundEnabledRef.current) sounds.playVictory();\n      } else {\n        state.syncWagerStreak = 0;\n      }\n    }\n    if (shouldEarnPulseWager(state.combo)) {\n      state.syncWagerCharges = Math.min(PULSE_WAGER_MAX_CHARGES, state.syncWagerCharges + 1);\n    }\n    publishWagerHud();\n\n    setCombo(state.combo);\n    setFeverMode(state.combo >= 5);\n    onScoreUpdate(state.score);",
    'Pulse wager result and earning',
)
source = replace_once(
    source,
    "    state.combo = 0;\n    state.bpm = 84;",
    "    state.combo = 0;\n    state.syncWagerCharges = PULSE_WAGER_START_CHARGES;\n    state.syncWagerArmed = false;\n    state.syncWagerStreak = 0;\n    setWagerHud({ charges: PULSE_WAGER_START_CHARGES, armed: false, streak: 0 });\n    state.bpm = 84;",
    'Pulse wager reset',
)
source = replace_once(
    source,
    "    const handleKeyDown = (e: KeyboardEvent) => {\n      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {",
    "    const handleKeyDown = (e: KeyboardEvent) => {\n      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyF') {\n        e.preventDefault();\n        armSyncWager();\n        return;\n      }\n      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {",
    'Pulse wager keyboard control',
)
source = replace_once(
    source,
    "          setLastFeedback({ text: 'MISSED BEAT', subtext: 'TOO LATE', color: 'text-[#F43F5E]' });\n          state.shake = 10;",
    "          if (state.syncWagerArmed) {\n            state.syncWagerArmed = false;\n            state.syncWagerStreak = 0;\n            publishWagerHud();\n          }\n          setLastFeedback({ text: 'MISSED BEAT', subtext: 'TOO LATE', color: 'text-[#F43F5E]' });\n          state.shake = 10;",
    'Pulse wager overshoot failure',
)
source = replace_once(
    source,
    "      ctx.setLineDash([]);\n\n      // Center Core",
    "      ctx.setLineDash([]);\n\n      if (state.syncWagerArmed) {\n        ctx.strokeStyle = 'rgba(232, 121, 249, 0.9)';\n        ctx.lineWidth = 2;\n        ctx.setLineDash([6, 4]);\n        ctx.beginPath();\n        ctx.arc(cx, cy, state.targetRadius - PULSE_WAGER_WINDOW_PX, 0, Math.PI * 2);\n        ctx.stroke();\n        ctx.beginPath();\n        ctx.arc(cx, cy, state.targetRadius + PULSE_WAGER_WINDOW_PX, 0, Math.PI * 2);\n        ctx.stroke();\n        ctx.setLineDash([]);\n      }\n\n      // Center Core",
    'Pulse wager ring rendering',
)
source = replace_once(
    source,
    "      {/* Bottom Cue */}\n      <div className=\"absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#18181B]/90 border border-[#27272A] px-4 py-1.5 rounded-full font-mono-arcade text-xs text-[#A1A1AA] pointer-events-none backdrop-blur-md\">",
    "      <button\n        type=\"button\"\n        onClick={armSyncWager}\n        disabled={wagerHud.charges <= 0 || wagerHud.armed}\n        className={`absolute bottom-12 left-1/2 z-20 -translate-x-1/2 rounded-xl border px-3.5 py-2 font-mono-arcade text-[10px] font-black transition-all ${\n          wagerHud.armed\n            ? 'border-fuchsia-300 bg-fuchsia-500/20 text-fuchsia-200'\n            : wagerHud.charges > 0\n            ? 'border-amber-400/45 bg-zinc-950/85 text-amber-200 hover:bg-amber-500/15'\n            : 'cursor-not-allowed border-zinc-800 bg-zinc-950/70 text-zinc-600'\n        }`}\n      >\n        {wagerHud.armed\n          ? `SYNC WAGER ARMED • ±${PULSE_WAGER_WINDOW_PX}px${wagerHud.streak > 0 ? ` • x${wagerHud.streak}` : ''}`\n          : `ARM SYNC WAGER [F/SHIFT] • ${wagerHud.charges}/${PULSE_WAGER_MAX_CHARGES}`}\n      </button>\n\n      {/* Bottom Cue */}\n      <div className=\"absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#18181B]/90 border border-[#27272A] px-4 py-1.5 rounded-full font-mono-arcade text-xs text-[#A1A1AA] pointer-events-none backdrop-blur-md\">",
    'Pulse wager HUD control',
)
write(path, source)


# ---------------------------------------------------------------------------
# Air Hockey — defensive meter -> player-spendable Power Play.
# ---------------------------------------------------------------------------
path = 'src/games/AirHockeyGame.tsx'
source = read(path)
source = replace_once(
    source,
    "} from '../lib/airHockeyFairness';\n",
    "} from '../lib/airHockeyFairness';\nimport {\n  AIR_HOCKEY_POWER_DURATION_SEC,\n  AIR_HOCKEY_POWER_IMPULSE_MULTIPLIER,\n  AIR_HOCKEY_POWER_MALLET_TRANSFER_MULTIPLIER,\n  AIR_HOCKEY_POWER_MAX,\n  canTriggerAirHockeyPower,\n  getAirHockeyPowerGoalBonus,\n  getAirHockeyPowerMeter,\n} from '../lib/airHockeyMastery';\n",
    'Air Hockey mastery import',
)
source = replace_once(
    source,
    "    combo: 0,\n    difficulty: 'MEDIUM' as DifficultyLevel,\n  });",
    "    combo: 0,\n    difficulty: 'MEDIUM' as DifficultyLevel,\n    powerMeter: 0,\n    powerPlayTime: 0,\n    powerStreak: 0,\n  });",
    'Air Hockey mastery HUD state',
)
source = replace_once(
    source,
    "    combo: 0,\n    difficulty: 'MEDIUM' as DifficultyLevel,\n\n    puck:",
    "    combo: 0,\n    difficulty: 'MEDIUM' as DifficultyLevel,\n    powerMeter: 0,\n    powerPlayTimer: 0,\n    powerStreak: 0,\n\n    puck:",
    'Air Hockey mastery ref state',
)
source = replace_once(
    source,
    "  const updatePointerTarget = (e: React.PointerEvent<HTMLDivElement>) => {",
    "  const triggerPowerPlay = () => {\n    const state = gameStateRef.current;\n    if (!canTriggerAirHockeyPower(state.powerMeter, state.powerPlayTimer, state.isAlive) || isPausedRef.current) return;\n    state.powerMeter = 0;\n    state.powerPlayTimer = AIR_HOCKEY_POWER_DURATION_SEC;\n    state.popups.push({\n      id: state.nextId++,\n      x: state.viewportWidth / 2,\n      y: state.viewportHeight * 0.68,\n      text: 'POWER PLAY ACTIVE!',\n      color: '#FACC15',\n      life: 1.0,\n    });\n    if (soundEnabled) sounds.playPowerUp();\n  };\n\n  const updatePointerTarget = (e: React.PointerEvent<HTMLDivElement>) => {",
    'Air Hockey Power Play action',
)
source = replace_once(
    source,
    "    const handleKeyDown = (e: KeyboardEvent) => {\n      const state = gameStateRef.current;",
    "    const handleKeyDown = (e: KeyboardEvent) => {\n      const state = gameStateRef.current;\n      if (e.code === 'Space' || e.code === 'KeyF') {\n        e.preventDefault();\n        triggerPowerPlay();\n        return;\n      }",
    'Air Hockey Power Play keyboard',
)
source = replace_once(
    source,
    "    state.combo = 0;\n    state.isGoalResetting = false;",
    "    state.combo = 0;\n    state.powerMeter = 0;\n    state.powerPlayTimer = 0;\n    state.powerStreak = 0;\n    state.isGoalResetting = false;",
    'Air Hockey Power Play reset',
)
source = replace_once(
    source,
    "        if (state.isGoalResetting) {\n          state.goalTimer -= dt;\n          if (state.goalTimer <= 0) state.isGoalResetting = false;\n        }\n",
    "        if (state.isGoalResetting) {\n          state.goalTimer -= dt;\n          if (state.goalTimer <= 0) state.isGoalResetting = false;\n        }\n        if (state.powerPlayTimer > 0) {\n          state.powerPlayTimer = Math.max(0, state.powerPlayTimer - dt);\n        }\n",
    'Air Hockey Power Play timer',
)
source = replace_once(
    source,
    "            const basePts = diffConfig.pointsPerGoal;\n            const pts = basePts * Math.min(4, state.combo);\n            state.gameScore += pts;",
    "            const basePts = diffConfig.pointsPerGoal;\n            const meterBeforeGoal = state.powerMeter;\n            state.powerMeter = getAirHockeyPowerMeter(state.powerMeter, 'GOAL');\n            if (meterBeforeGoal < AIR_HOCKEY_POWER_MAX && state.powerMeter >= AIR_HOCKEY_POWER_MAX) {\n              state.popups.push({ id: state.nextId++, x: centerX, y: centerY + 70, text: 'POWER PLAY READY', color: '#FACC15', life: 0.9 });\n            }\n            let powerBonus = 0;\n            if (state.powerPlayTimer > 0) {\n              state.powerStreak++;\n              powerBonus = getAirHockeyPowerGoalBonus(basePts, state.powerStreak);\n            }\n            const pts = basePts * Math.min(4, state.combo) + powerBonus;\n            state.gameScore += pts;",
    'Air Hockey Power Play goal scoring',
)
source = replace_once(
    source,
    "              text: `GOAL! +${pts}`,",
    "              text: state.powerPlayTimer > 0 ? `POWER GOAL x${state.powerStreak}! +${pts}` : `GOAL! +${pts}`,",
    'Air Hockey Power Play goal feedback',
)
source = replace_once(
    source,
    "            state.aiScore++;\n            state.combo = 0;",
    "            state.aiScore++;\n            state.combo = 0;\n            state.powerStreak = 0;",
    'Air Hockey Power streak loss',
)
source = replace_once(
    source,
    "            const relVx = puck.vx - mallet.vx;\n            const relVy = puck.vy - mallet.vy;\n            const impulse = -(1 + 0.65) * (relVx * nx + relVy * ny);\n\n            if (impulse > 0) {\n              puck.vx += nx * impulse + mallet.vx * 0.4;\n              puck.vy += ny * impulse + mallet.vy * 0.4;",
    "            const relVx = puck.vx - mallet.vx;\n            const relVy = puck.vy - mallet.vy;\n            const incomingDefense = isPlayer && puck.y > centerY && puck.vy > 20;\n            const powerActive = isPlayer && state.powerPlayTimer > 0;\n            const impulse = -(1 + 0.65) * (relVx * nx + relVy * ny);\n\n            if (impulse > 0) {\n              const impulseScale = powerActive ? AIR_HOCKEY_POWER_IMPULSE_MULTIPLIER : 1;\n              const transferScale = powerActive ? AIR_HOCKEY_POWER_MALLET_TRANSFER_MULTIPLIER : 1;\n              puck.vx += nx * impulse * impulseScale + mallet.vx * 0.4 * transferScale;\n              puck.vy += ny * impulse * impulseScale + mallet.vy * 0.4 * transferScale;\n\n              if (incomingDefense) {\n                const meterBeforeDefense = state.powerMeter;\n                state.powerMeter = getAirHockeyPowerMeter(state.powerMeter, 'DEFENSE');\n                if (meterBeforeDefense < AIR_HOCKEY_POWER_MAX && state.powerMeter >= AIR_HOCKEY_POWER_MAX) {\n                  state.popups.push({ id: state.nextId++, x: centerX, y: centerY + 70, text: 'POWER PLAY READY', color: '#FACC15', life: 0.9 });\n                }\n              }",
    'Air Hockey Power Play contact impulse',
)
source = replace_once(
    source,
    "      ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';\n      ctx.beginPath();\n      ctx.arc(state.playerMallet.x, state.playerMallet.y, state.playerMallet.radius + 4, 0, Math.PI * 2);",
    "      ctx.fillStyle = state.powerPlayTimer > 0 ? 'rgba(250, 204, 21, 0.28)' : 'rgba(6, 182, 212, 0.2)';\n      ctx.beginPath();\n      ctx.arc(state.playerMallet.x, state.playerMallet.y, state.playerMallet.radius + (state.powerPlayTimer > 0 ? 9 : 4), 0, Math.PI * 2);",
    'Air Hockey Power Play mallet aura',
)
source = replace_once(
    source,
    "          prev.combo === state.combo &&\n          prev.difficulty === state.difficulty\n        ) {",
    "          prev.combo === state.combo &&\n          prev.difficulty === state.difficulty &&\n          prev.powerMeter === Math.round(state.powerMeter) &&\n          prev.powerPlayTime === Math.ceil(state.powerPlayTimer) &&\n          prev.powerStreak === state.powerStreak\n        ) {",
    'Air Hockey Power HUD equality',
)
source = replace_once(
    source,
    "          combo: state.combo,\n          difficulty: state.difficulty,\n        };",
    "          combo: state.combo,\n          difficulty: state.difficulty,\n          powerMeter: Math.round(state.powerMeter),\n          powerPlayTime: Math.ceil(state.powerPlayTimer),\n          powerStreak: state.powerStreak,\n        };",
    'Air Hockey Power HUD publication',
)
source = replace_once(
    source,
    "        <div className=\"px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-zinc-300 font-mono text-xs font-bold backdrop-blur-md\">\n          TIME: <span className=\"text-amber-400 font-black\">{hudState.timeLeft}s</span>\n        </div>",
    "        <div className=\"flex items-center gap-2\">\n          <div className={`px-2.5 py-1 rounded-xl border font-mono text-xs font-black backdrop-blur-md ${\n            hudState.powerPlayTime > 0\n              ? 'border-amber-400/70 bg-amber-500/20 text-amber-200'\n              : hudState.powerMeter >= AIR_HOCKEY_POWER_MAX\n              ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200'\n              : 'border-zinc-700 bg-zinc-900/85 text-zinc-300'\n          }`}>\n            {hudState.powerPlayTime > 0\n              ? `POWER ${hudState.powerPlayTime}s${hudState.powerStreak > 0 ? ` • x${hudState.powerStreak}` : ''}`\n              : `POWER ${hudState.powerMeter}%`}\n          </div>\n          <div className=\"px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-zinc-300 font-mono text-xs font-bold backdrop-blur-md\">\n            TIME: <span className=\"text-amber-400 font-black\">{hudState.timeLeft}s</span>\n          </div>\n        </div>",
    'Air Hockey Power HUD badge',
)
source = replace_once(
    source,
    "      {/* Difficulty Selection Pills at Bottom */}\n      <div className=\"absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 flex max-w-[calc(100%-12px)] items-center gap-1 sm:gap-1.5 p-1 bg-zinc-900/90 border border-zinc-800 rounded-2xl backdrop-blur-md z-20 pointer-events-auto shadow-2xl\">",
    "      <button\n        type=\"button\"\n        onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); triggerPowerPlay(); }}\n        disabled={hudState.powerMeter < AIR_HOCKEY_POWER_MAX || hudState.powerPlayTime > 0}\n        className={`absolute bottom-14 left-1/2 z-20 -translate-x-1/2 rounded-xl border px-4 py-2 font-mono text-[10px] font-black transition-all ${\n          hudState.powerPlayTime > 0\n            ? 'border-amber-300 bg-amber-400/25 text-amber-100'\n            : hudState.powerMeter >= AIR_HOCKEY_POWER_MAX\n            ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30'\n            : 'cursor-not-allowed border-zinc-800 bg-zinc-950/75 text-zinc-600'\n        }`}\n      >\n        {hudState.powerPlayTime > 0 ? 'POWER PLAY ACTIVE' : hudState.powerMeter >= AIR_HOCKEY_POWER_MAX ? 'TRIGGER POWER PLAY [SPACE/F]' : 'DEFEND TO CHARGE POWER'}\n      </button>\n\n      {/* Difficulty Selection Pills at Bottom */}\n      <div className=\"absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 flex max-w-[calc(100%-12px)] items-center gap-1 sm:gap-1.5 p-1 bg-zinc-900/90 border border-zinc-800 rounded-2xl backdrop-blur-md z-20 pointer-events-auto shadow-2xl\">",
    'Air Hockey Power Play button',
)
write(path, source)


# ---------------------------------------------------------------------------
# Registry teaching copy.
# ---------------------------------------------------------------------------
path = 'src/data/games.ts'
source = read(path)
source = replace_once(
    source,
    "    description: 'Drop sliding blocks with razor precision. Overhanging edges are cleanly sliced away.',\n",
    "    description: 'Stack clean placements, build perfect streaks to earn Focus charges, then spend Focus on an optional 2px precision wager for escalating mastery-chain bonuses.',\n",
    'Stack P9 registry description',
)
source = replace_once(
    source,
    "    instructions: 'Tap/Space to drop each block on top of the tower.',\n    controlsHint: 'Click / Tap / Space',",
    "    instructions: 'Tap/Space to place blocks. Every three consecutive perfects earns Focus; press F/Shift or tap Focus to wager a tighter 2px perfect window on the next placement.',\n    controlsHint: 'Click / Tap / Space • F / Shift: Focus',",
    'Stack P9 registry controls',
)
source = replace_once(
    source,
    "    description: 'Tap precisely as expanding concentric waves align with the golden target perimeter.',\n",
    "    description: 'Read six groove patterns, sustain Fever combos, and spend earned Sync Wagers on an optional ±10px bonus window that builds a separate risk-reward streak.',\n",
    'Pulse P9 registry description',
)
source = replace_once(
    source,
    "    instructions: 'Tap/Space at the exact moment the ring overlaps the target.',\n    controlsHint: 'Click / Tap / Space',",
    "    instructions: 'Tap/Space on the beat. Every four-hit combo earns a Sync Wager; press F/Shift or tap Wager to arm the tighter bonus window for the next beat without changing ordinary judgement.',\n    controlsHint: 'Click / Tap / Space • F / Shift: Sync Wager',",
    'Pulse P9 registry controls',
)
source = replace_once(
    source,
    "    description: 'Take control of the neon mallet and battle a dynamic bot opponent. Bank shots off side rails, execute lightning power hits, protect your goal pocket, and race to victory before the timer expires.',\n",
    "    description: 'Battle fair adaptive AI, charge a Power Play meter through clean defensive contacts and goals, then spend it on a short capped-velocity offensive surge with bonus power-goal streaks.',\n",
    'Air Hockey P9 registry description',
)
source = replace_once(
    source,
    "    instructions: 'Drag your cyan mallet with mouse or touch (or WASD/Arrows) to smash the puck.',\n    controlsHint: 'Mouse Drag / Touch / WASD',",
    "    instructions: 'Drag or use WASD/Arrows to defend and attack. Clean defensive contacts fill Power; when ready, press Space/F or tap Power Play for a short stronger-contact scoring window.',\n    controlsHint: 'Mouse Drag / Touch / WASD • Space / F: Power Play',",
    'Air Hockey P9 registry controls',
)
write(path, source)
