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
# Memory Matrix — optional Overclock on the next round.
# ---------------------------------------------------------------------------
path = 'src/games/MatrixGame.tsx'
source = read(path)
source = replace_once(
    source,
    "} from '../lib/matrixProtocols';\n",
    "} from '../lib/matrixProtocols';\nimport {\n  MATRIX_OVERCLOCK,\n  canArmMatrixOverclock,\n  getMatrixClearPoints,\n  getMatrixPlaybackSpeed,\n  getMatrixSequenceLength,\n  getMatrixStepPoints,\n} from '../lib/matrixMastery';\n",
    'Matrix mastery import',
)
source = replace_once(
    source,
    "  const [protocol, setProtocol] = useState<MatrixProtocol>('FORWARD');\n",
    "  const [protocol, setProtocol] = useState<MatrixProtocol>('FORWARD');\n  const [overclockActive, setOverclockActive] = useState(false);\n  const [overclockArmed, setOverclockArmed] = useState(false);\n",
    'Matrix mastery state',
)
source = replace_once(
    source,
    "    isInputLocked: true,\n  });",
    "    isInputLocked: true,\n    overclockActive: false,\n    overclockArmed: false,\n  });",
    'Matrix ref mastery state',
)
source = replace_once(
    source,
    "    // Initial 3 items, +1 every 2 rounds\n    const length = 3 + Math.floor((round - 1) * 0.7);\n    const newSeq: number[] = [];",
    "    const nextOverclockActive = state.overclockArmed;\n    state.overclockArmed = false;\n    state.overclockActive = nextOverclockActive;\n    setOverclockArmed(false);\n    setOverclockActive(nextOverclockActive);\n\n    // Initial 3 items, +1 every 2 rounds. Overclock deliberately adds memory load.\n    const baseLength = 3 + Math.floor((round - 1) * 0.7);\n    const length = getMatrixSequenceLength(baseLength, nextOverclockActive);\n    const newSeq: number[] = [];",
    'Matrix round length',
)
source = replace_once(
    source,
    "    const playbackSpeed = Math.max(180, 340 - round * 15);\n    playSequencePlayback(newSeq, playbackSpeed);",
    "    const playbackSpeed = getMatrixPlaybackSpeed(\n      Math.max(180, 340 - round * 15),\n      nextOverclockActive,\n    );\n    playSequencePlayback(newSeq, playbackSpeed);",
    'Matrix playback speed',
)
source = replace_once(
    source,
    "      const stepPoints = 100 + state.combo * 25;\n      state.score += stepPoints;",
    "      const stepPoints = getMatrixStepPoints(\n        100 + state.combo * 25,\n        state.overclockActive,\n      );\n      state.score += stepPoints;",
    'Matrix step scoring',
)
source = replace_once(
    source,
    "        setStatusMessage('CYBER LINK VERIFIED! +1000');\n        state.score += 1000 + Math.floor(state.timer * 10);",
    "        const clearPoints = getMatrixClearPoints(\n          1000 + Math.floor(state.timer * 10),\n          state.overclockActive,\n        );\n        setStatusMessage(\n          state.overclockActive\n            ? `OVERCLOCK VERIFIED! +${clearPoints}`\n            : `CYBER LINK VERIFIED! +${clearPoints}`,\n        );\n        state.score += clearPoints;",
    'Matrix clear scoring',
)
source = replace_once(
    source,
    "    if (replaysLeft <= 0 || isShowingSequence || !state.isAlive) return;",
    "    if (state.overclockActive || replaysLeft <= 0 || isShowingSequence || !state.isAlive) return;",
    'Matrix replay lockout',
)
source = replace_once(
    source,
    "  // Initial mount\n  useEffect(() => {",
    "  const toggleOverclock = useCallback(() => {\n    const state = gameStateRef.current;\n    if (!canArmMatrixOverclock(state.round, state.lives) || isPausedRef.current) return;\n    state.overclockArmed = !state.overclockArmed;\n    setOverclockArmed(state.overclockArmed);\n    if (soundEnabledRef.current) sounds.playPowerUp();\n  }, []);\n\n  // Initial mount\n  useEffect(() => {",
    'Matrix overclock toggle',
)
source = replace_once(
    source,
    "      } else if (key === 'R') {\n        handleReplayPattern();\n      }",
    "      } else if (key === 'R') {\n        handleReplayPattern();\n      } else if (key === 'O') {\n        toggleOverclock();\n      }",
    'Matrix O shortcut',
)
source = replace_once(
    source,
    "  }, [handleNodeClick, handleReplayPattern]);",
    "  }, [handleNodeClick, handleReplayPattern, toggleOverclock]);",
    'Matrix keyboard dependencies',
)
source = replace_once(
    source,
    "          <span className=\"text-cyan-300 font-bold\">PROTOCOL {protocol.replace('_', '+')}</span>\n          <span className=\"text-[#71717A]\">|</span>",
    "          <span className=\"text-cyan-300 font-bold\">PROTOCOL {protocol.replace('_', '+')}</span>\n          {overclockActive && (\n            <span className=\"rounded-md border border-fuchsia-400/35 bg-fuchsia-500/15 px-1.5 py-0.5 text-[9px] font-black text-fuchsia-300\">\n              OVERCLOCK\n            </span>\n          )}\n          <span className=\"text-[#71717A]\">|</span>",
    'Matrix active badge',
)
source = replace_once(
    source,
    "        <div className=\"flex items-center gap-2\">\n          <button\n            type=\"button\"\n            onClick={handleReplayPattern}",
    "        <div className=\"flex items-center gap-2\">\n          <button\n            type=\"button\"\n            onClick={toggleOverclock}\n            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono-arcade text-[10px] border transition-all cursor-pointer backdrop-blur-md ${\n              overclockArmed\n                ? 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/45'\n                : 'bg-[#18181B]/90 hover:bg-[#27272A] text-fuchsia-300 border-fuchsia-500/25'\n            }`}\n            title={`Next round: +${MATRIX_OVERCLOCK.sequenceBonus} nodes, faster playback, boosted scoring, no manual replay`}\n          >\n            <Zap className=\"w-3.5 h-3.5\" /> {overclockArmed ? 'OVERCLOCK ARMED' : 'OVERCLOCK NEXT'} [O]\n          </button>\n          <button\n            type=\"button\"\n            onClick={handleReplayPattern}",
    'Matrix overclock button',
)
source = replace_once(
    source,
    "            disabled={replaysLeft <= 0 || isShowingSequence}",
    "            disabled={overclockActive || replaysLeft <= 0 || isShowingSequence}",
    'Matrix replay disabled state',
)
source = replace_once(
    source,
    "              replaysLeft > 0 && !isShowingSequence",
    "              !overclockActive && replaysLeft > 0 && !isShowingSequence",
    'Matrix replay enabled style',
)
source = replace_once(
    source,
    "        <span>TAP PADS OR USE KEYS [QWE / ASD / ZXC]</span>",
    "        <span>TAP PADS OR USE KEYS [QWE / ASD / ZXC] • [O] ARM OVERCLOCK</span>",
    'Matrix bottom teaching',
)
write(path, source)


# ---------------------------------------------------------------------------
# Knife Target — safe rotating Razor Marks reward deliberate precision aiming.
# ---------------------------------------------------------------------------
path = 'src/games/KnifeTargetGame.tsx'
source = read(path)
source = replace_once(
    source,
    "import { getKnifeStageConfig, getKnifeStageRotationSpeed } from '../lib/knifeStageProgression';\n",
    "import { getKnifeStageConfig, getKnifeStageRotationSpeed } from '../lib/knifeStageProgression';\nimport {\n  findKnifeRazorTarget,\n  getKnifeRazorBonus,\n  getKnifeRazorTolerance,\n  isKnifeRazorHit,\n  isKnifeRazorRush,\n} from '../lib/knifeMastery';\n",
    'Knife mastery import',
)
source = replace_once(
    source,
    "    stageLabel: 'STEADY CORE',\n  });",
    "    stageLabel: 'STEADY CORE',\n    precisionChain: 0,\n  });",
    'Knife HUD precision state',
)
source = replace_once(
    source,
    "    nextId: 1,\n  });",
    "    nextId: 1,\n    precisionTargetAngle: 0,\n    precisionTargetIndex: 0,\n    precisionChain: 0,\n  });",
    'Knife ref precision state',
)
source = replace_once(
    source,
    "    state.embeddedBlades = [];\n    state.apples = [];\n    state.shields = [];",
    "    state.embeddedBlades = [];\n    state.apples = [];\n    state.shields = [];\n    state.precisionTargetIndex = 0;\n    state.precisionChain = 0;",
    'Knife precision reset',
)
source = replace_once(
    source,
    "    for (let i = 0; i < config.shieldCount; i++) {\n      state.shields.push({\n        startAngle: normalizeKnifeAngle(0.25 + (i / config.shieldCount) * Math.PI * 2),\n        spanAngle: config.shieldSpan,\n      });\n    }\n  }, []);",
    "    for (let i = 0; i < config.shieldCount; i++) {\n      state.shields.push({\n        startAngle: normalizeKnifeAngle(0.25 + (i / config.shieldCount) * Math.PI * 2),\n        spanAngle: config.shieldSpan,\n      });\n    }\n\n    state.precisionTargetAngle = findKnifeRazorTarget(\n      stageNum,\n      state.precisionTargetIndex,\n      state.embeddedBlades.map((blade) => blade.angle),\n      state.shields,\n    );\n  }, []);",
    'Knife initial Razor target',
)
source = replace_once(
    source,
    "            } else {\n              state.embeddedBlades.push({ angle: hitAngle });\n              state.combo++;",
    "            } else {\n              const razorHit = isKnifeRazorHit(\n                hitAngle,\n                state.precisionTargetAngle,\n                state.stage,\n              );\n              state.embeddedBlades.push({ angle: hitAngle });\n              state.combo++;",
    'Knife Razor hit detection',
)
source = replace_once(
    source,
    "              if (soundEnabled) sounds.playKnifeStick();\n\n              for (const apple of state.apples) {",
    "              if (soundEnabled) sounds.playKnifeStick();\n\n              if (razorHit) {\n                state.precisionChain++;\n                const razorPts = getKnifeRazorBonus(state.precisionChain, state.stage);\n                state.score += razorPts;\n                onScoreUpdate(state.score);\n                state.popups.push({\n                  id: state.nextId++,\n                  x: impactPoint.x,\n                  y: impactPoint.y - 22,\n                  text: isKnifeRazorRush(state.precisionChain)\n                    ? `RAZOR RUSH x${state.precisionChain} +${razorPts}`\n                    : `RAZOR MARK +${razorPts}`,\n                  color: '#FACC15',\n                  life: 1.1,\n                });\n                if (soundEnabled) sounds.playCombo(Math.min(18, state.precisionChain));\n              } else {\n                state.precisionChain = 0;\n              }\n\n              state.precisionTargetIndex++;\n              state.precisionTargetAngle = findKnifeRazorTarget(\n                state.stage,\n                state.precisionTargetIndex,\n                state.embeddedBlades.map((blade) => blade.angle),\n                state.shields,\n              );\n\n              for (const apple of state.apples) {",
    'Knife Razor scoring',
)
source = replace_once(
    source,
    "      // Embedded knives and crystals now use the same standard polar-angle\n",
    "      // The gold Razor Mark is always generated away from existing blades and shields.\n      const razorTolerance = getKnifeRazorTolerance(state.stage);\n      ctx.save();\n      ctx.strokeStyle = '#FACC15';\n      ctx.shadowColor = '#FACC15';\n      ctx.shadowBlur = 14;\n      ctx.lineWidth = 6;\n      ctx.beginPath();\n      ctx.arc(\n        0,\n        0,\n        state.coreRadius + 12,\n        state.precisionTargetAngle - razorTolerance,\n        state.precisionTargetAngle + razorTolerance,\n      );\n      ctx.stroke();\n      ctx.restore();\n\n      // Embedded knives and crystals now use the same standard polar-angle\n",
    'Knife Razor rendering',
)
source = replace_once(
    source,
    "        stageLabel: state.stageLabel,\n      });",
    "        stageLabel: state.stageLabel,\n        precisionChain: state.precisionChain,\n      });",
    'Knife HUD sync',
)
source = replace_once(
    source,
    "          {hudState.multiplier > 1 && (",
    "          {hudState.precisionChain > 0 && (\n            <div className=\"px-2 py-1 rounded-xl bg-yellow-500/15 border border-yellow-400/40 text-yellow-300 font-mono text-[10px] font-black\">\n              RAZOR x{hudState.precisionChain}\n            </div>\n          )}\n\n          {hudState.multiplier > 1 && (",
    'Knife Razor HUD badge',
)
source = replace_once(
    source,
    "            Aim around the core, then Tap / Click to throw • Space / Enter throws at current aim",
    "            Aim around the core • Hit the gold Razor Mark to build a precision chain • Tap / Click to throw • Space / Enter uses current aim",
    'Knife bottom teaching',
)
write(path, source)


# ---------------------------------------------------------------------------
# Neon Rail — six clean core pickups earn a player-spendable Surge charge.
# ---------------------------------------------------------------------------
path = 'src/games/NeonRailShiftGame.tsx'
source = read(path)
source = replace_once(
    source,
    "} from '../lib/neonRailDepth';\n",
    "} from '../lib/neonRailDepth';\nimport {\n  NEON_RAIL_MAX_SURGE_CHARGES,\n  NEON_RAIL_SURGE_DURATION,\n  getNeonRailMasteryReward,\n  getNeonRailSurgeScoreMultiplier,\n  getNeonRailSurgeSpeedMultiplier,\n  isNeonRailMasteryMilestone,\n} from '../lib/neonRailMastery';\n",
    'Rail mastery import',
)
source = replace_once(
    source,
    "    phraseName: 'SWITCHBACK' as NeonRailPhraseName,\n  });",
    "    phraseName: 'SWITCHBACK' as NeonRailPhraseName,\n    surgeCharges: 0,\n    surgeTimer: 0,\n  });",
    'Rail HUD surge state',
)
source = replace_once(
    source,
    "    phaseTimer: 0,\n    screenShake: 0,",
    "    phaseTimer: 0,\n    surgeCharges: 0,\n    surgeTimer: 0,\n    screenShake: 0,",
    'Rail ref surge state',
)
source = replace_once(
    source,
    "  useEffect(() => {\n    const handleKeyDown = (event: KeyboardEvent) => {",
    "  const triggerSurge = () => {\n    const state = gameStateRef.current;\n    if (\n      !state.isAlive ||\n      isPausedRef.current ||\n      state.surgeCharges <= 0 ||\n      state.surgeTimer > 0\n    ) {\n      return;\n    }\n    state.surgeCharges--;\n    state.surgeTimer = NEON_RAIL_SURGE_DURATION;\n    state.screenShake = Math.max(state.screenShake, 4);\n    if (soundEnabled) sounds.playFeverMode();\n  };\n\n  useEffect(() => {\n    const handleKeyDown = (event: KeyboardEvent) => {",
    'Rail triggerSurge',
)
source = replace_once(
    source,
    "        event.code === 'KeyD' ||\n        event.code === 'Space'",
    "        event.code === 'KeyD' ||\n        event.code === 'Space' ||\n        event.code === 'ShiftLeft' ||\n        event.code === 'ShiftRight'",
    'Rail Shift prevent default',
)
source = replace_once(
    source,
    "      if (event.code === 'Space') triggerPhase();",
    "      if (event.code === 'Space') triggerPhase();\n      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') triggerSurge();",
    'Rail Shift handler',
)
source = replace_once(
    source,
    "    state.phaseTimer = 0;\n    state.screenShake = 0;",
    "    state.phaseTimer = 0;\n    state.surgeCharges = 0;\n    state.surgeTimer = 0;\n    state.screenShake = 0;",
    'Rail surge reset',
)
source = replace_once(
    source,
    "      const playerScreenY = horizonY + trackHeight * NEON_RAIL_PLAYER_Y;\n      const currentSpeed = getNeonRailSpeed(state.elapsed);",
    "      const playerScreenY = horizonY + trackHeight * NEON_RAIL_PLAYER_Y;\n      const surgeActive = state.surgeTimer > 0;\n      const surgeScoreMultiplier = getNeonRailSurgeScoreMultiplier(surgeActive);\n      const currentSpeed =\n        getNeonRailSpeed(state.elapsed) * getNeonRailSurgeSpeedMultiplier(surgeActive);",
    'Rail surge speed',
)
source = replace_once(
    source,
    "        state.phaseTimer = Math.max(0, state.phaseTimer - dt);\n        state.screenShake",
    "        state.phaseTimer = Math.max(0, state.phaseTimer - dt);\n        state.surgeTimer = Math.max(0, state.surgeTimer - dt);\n        state.screenShake",
    'Rail surge timer',
)
source = replace_once(
    source,
    "        state.survivalScore += dt * (55 + currentSpeed * 70);",
    "        state.survivalScore += dt * (55 + currentSpeed * 70) * surgeScoreMultiplier;",
    'Rail surge survival scoring',
)
source = replace_once(
    source,
    "              if (state.phaseTimer > 0) {\n                state.bonusScore += 180;",
    "              if (state.phaseTimer > 0) {\n                const phaseBreakPoints = 180 * surgeScoreMultiplier;\n                state.bonusScore += phaseBreakPoints;",
    'Rail surge phase scoring',
)
source = replace_once(
    source,
    "                  text: 'PHASE BREAK +180',",
    "                  text: `PHASE BREAK +${phaseBreakPoints}`,",
    'Rail phase popup scoring',
)
source = replace_once(
    source,
    "                const points = 120 * multiplier * phaseRouteMultiplier;",
    "                const points = 120 * multiplier * phaseRouteMultiplier * surgeScoreMultiplier;",
    'Rail surge core scoring',
)
source = replace_once(
    source,
    "                state.bonusScore += points;\n                state.score = Math.floor(state.survivalScore + state.bonusScore);\n                state.popups.push({",
    "                state.bonusScore += points;\n\n                if (isNeonRailMasteryMilestone(state.combo)) {\n                  const masteryReward = getNeonRailMasteryReward(state.combo);\n                  const gainedCharge = state.surgeCharges < NEON_RAIL_MAX_SURGE_CHARGES;\n                  state.surgeCharges = Math.min(\n                    NEON_RAIL_MAX_SURGE_CHARGES,\n                    state.surgeCharges + 1,\n                  );\n                  state.bonusScore += masteryReward;\n                  state.popups.push({\n                    id: state.nextId++,\n                    x: width / 2,\n                    y: playerScreenY - 48,\n                    text: gainedCharge\n                      ? `ROUTE MASTERED +${masteryReward} • SURGE +1`\n                      : `ROUTE MASTERED +${masteryReward} • SURGE FULL`,\n                    color: '#FB923C',\n                    life: 1.15,\n                  });\n                  if (soundEnabled) sounds.playPowerUp();\n                }\n\n                state.score = Math.floor(state.survivalScore + state.bonusScore);\n                state.popups.push({",
    'Rail mastery charge reward',
)
source = replace_once(
    source,
    "            phraseName: state.phraseName,\n          });",
    "            phraseName: state.phraseName,\n            surgeCharges: state.surgeCharges,\n            surgeTimer: state.surgeTimer,\n          });",
    'Rail HUD surge sync',
)
source = replace_once(
    source,
    "      if (state.phaseTimer > 0) {\n        const pulse = 26 + Math.sin(state.elapsed * 22) * 5;",
    "      if (state.surgeTimer > 0) {\n        const surgePulse = 31 + Math.sin(state.elapsed * 26) * 4;\n        ctx.strokeStyle = '#FB923C';\n        ctx.shadowColor = '#FB923C';\n        ctx.shadowBlur = 20;\n        ctx.lineWidth = 3;\n        ctx.globalAlpha = 0.78;\n        ctx.beginPath();\n        ctx.arc(0, 0, surgePulse, 0, Math.PI * 2);\n        ctx.stroke();\n      }\n\n      if (state.phaseTimer > 0) {\n        const pulse = 26 + Math.sin(state.elapsed * 22) * 5;",
    'Rail surge player rendering',
)
source = replace_once(
    source,
    "          <div className=\"font-mono text-[9px] font-bold text-slate-500\">\n            {hudState.speed.toFixed(2)}x RAIL SPEED\n          </div>",
    "          <div className={`rounded-lg border px-2 py-0.5 font-mono text-[9px] font-black ${\n            hudState.surgeTimer > 0\n              ? 'border-orange-400/45 bg-orange-500/20 text-orange-200'\n              : hudState.surgeCharges > 0\n                ? 'border-orange-400/30 bg-slate-950/80 text-orange-300'\n                : 'border-slate-700/50 bg-slate-950/70 text-slate-500'\n          }`}>\n            {hudState.surgeTimer > 0\n              ? `SURGE ${hudState.surgeTimer.toFixed(1)}s • 2x SCORE`\n              : `SURGE ${hudState.surgeCharges}/${NEON_RAIL_MAX_SURGE_CHARGES} • SHIFT`}\n          </div>\n          <div className=\"font-mono text-[9px] font-bold text-slate-500\">\n            {hudState.speed.toFixed(2)}x RAIL SPEED\n          </div>",
    'Rail surge HUD',
)
source = replace_once(
    source,
    "      <div className=\"absolute bottom-2 left-2 right-2 z-20 grid grid-cols-3 gap-2 sm:hidden\">",
    "      <div className=\"absolute bottom-2 left-2 right-2 z-20 grid grid-cols-4 gap-2 sm:hidden\">",
    'Rail mobile grid columns',
)
source = replace_once(
    source,
    "        <button\n          type=\"button\"\n          onClick={() => shiftLane(1)}",
    "        <button\n          type=\"button\"\n          onClick={triggerSurge}\n          disabled={hudState.surgeCharges <= 0 || hudState.surgeTimer > 0}\n          className=\"flex h-11 flex-col items-center justify-center rounded-xl border border-orange-400/35 bg-orange-500/15 text-orange-200 active:scale-95 disabled:opacity-35 disabled:active:scale-100\"\n          aria-label=\"Activate score surge\"\n        >\n          <Zap className=\"h-4 w-4\" />\n          <span className=\"mt-0.5 font-mono text-[7px] font-black\">SURGE</span>\n        </button>\n        <button\n          type=\"button\"\n          onClick={() => shiftLane(1)}",
    'Rail mobile Surge button',
)
write(path, source)


# ---------------------------------------------------------------------------
# Registry teaching — preserve P2 phrases while exposing P7 mastery decisions.
# ---------------------------------------------------------------------------
path = 'src/data/games.ts'
source = read(path)
source = replace_once(
    source,
    "    tagline: 'Decode and replicate high-speed cyber sequences.',\n    description: 'Memorize sequences across transforming memory protocols: forward, reverse, mirror, and reverse-mirror.',\n",
    "    tagline: 'Transform patterns, then decide when to overclock your memory.',\n    description: 'Memorize sequences across transforming memory protocols, then arm optional Overclock rounds for +2 nodes, faster playback, no manual replay, and higher rewards.',\n",
    'Matrix P7 registry copy',
)
source = replace_once(
    source,
    "    instructions: 'Watch the pads, then reproduce the sequence using the active transforming memory protocol.',\n    controlsHint: 'Tap Grid / Keys QWE-ASD-ZXC / Numpad',",
    "    instructions: 'Watch the pads, reproduce the active transforming memory protocol, and press O or tap Overclock to arm a harder next round.',\n    controlsHint: 'Tap Grid / QWE-ASD-ZXC / Numpad • O: Overclock',",
    'Matrix P7 registry controls',
)
source = replace_once(
    source,
    "    description: 'Aim through six rotating stage identities: steady, backspin, pulse, shield, precision, and boss cores.',\n",
    "    description: 'Aim through six rotating stage identities while chasing safe gold Razor Marks for precision chains and escalating bonus payouts.',\n",
    'Knife P7 registry description',
)
source = replace_once(
    source,
    "    instructions: 'Aim around the core and throw into open arcs; learn each of the six rotating stage identities.',\n",
    "    instructions: 'Aim around the core and throw into open arcs; gold Razor Marks are optional precision targets that relocate after every safe hit.',\n",
    'Knife P7 registry instructions',
)
source = replace_once(
    source,
    "    description: 'Read authored rail phrases, build core streaks, and spend Phase on optional blocked high-value routes.',\n",
    "    description: 'Read authored rail phrases, spend Phase on blocked x3 routes, and collect six consecutive route cores to earn player-spendable Surge charges.',\n",
    'Rail P7 registry description',
)
source = replace_once(
    source,
    "    instructions: 'Follow authored rail phrases with A/D or taps. Space activates Phase; gold cores behind barriers are optional x3 routes.',\n    controlsHint: 'A / D • Arrow Keys • Tap Lane • Space: Phase',",
    "    instructions: 'Follow authored rail phrases with A/D or taps. Space activates Phase; every six consecutive cores earns Surge, which Shift spends for faster 2x scoring.',\n    controlsHint: 'A / D • Arrow Keys • Tap Lane • Space: Phase • Shift: Surge',",
    'Rail P7 registry controls',
)
write(path, source)
