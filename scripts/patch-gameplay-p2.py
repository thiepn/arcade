from pathlib import Path
import json
import re

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text()

def write(path, text):
    (ROOT / path).write_text(text)

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing marker: {label}')
    return text.replace(old, new, 1)

def regex_once(text, pattern, replacement, label, flags=0):
    new_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return new_text

# ---------------------------------------------------------------------------
# 1. MEMORY MATRIX — transform the observed sequence by authored protocols.
# ---------------------------------------------------------------------------
p = 'src/games/MatrixGame.tsx'
s = read(p)
s = replace_once(
    s,
    "import { useSafeTimeout } from '../hooks/useGameLoop';\n",
    "import { useSafeTimeout } from '../hooks/useGameLoop';\nimport {\n  applyMatrixProtocol,\n  getMatrixProtocolForRound,\n  getMatrixProtocolPrompt,\n  type MatrixProtocol,\n} from '../lib/matrixProtocols';\n",
    'Matrix protocol import',
)
s = replace_once(
    s,
    "  const [timerProgress, setTimerProgress] = useState<number>(100);\n",
    "  const [timerProgress, setTimerProgress] = useState<number>(100);\n  const [protocol, setProtocol] = useState<MatrixProtocol>('FORWARD');\n",
    'Matrix protocol state',
)
s = replace_once(
    s,
    "    sequence: [] as number[],\n    playerStep: 0,\n",
    "    sequence: [] as number[],\n    expectedSequence: [] as number[],\n    protocol: 'FORWARD' as MatrixProtocol,\n    playerStep: 0,\n",
    'Matrix ref protocol state',
)
s = replace_once(
    s,
    "            setStatusMessage('REPLICATE PATTERN!');\n",
    "            setStatusMessage(getMatrixProtocolPrompt(gameStateRef.current.protocol));\n",
    'Matrix protocol prompt',
)
s = replace_once(
    s,
    "    state.sequence = newSeq;\n    setSequence(newSeq);\n\n    const playbackSpeed = Math.max(180, 340 - round * 15);\n",
    "    const nextProtocol = getMatrixProtocolForRound(round);\n    state.sequence = newSeq;\n    state.protocol = nextProtocol;\n    state.expectedSequence = applyMatrixProtocol(newSeq, nextProtocol);\n    setSequence(newSeq);\n    setProtocol(nextProtocol);\n\n    const playbackSpeed = Math.max(180, 340 - round * 15);\n",
    'Matrix round protocol setup',
)
s = replace_once(
    s,
    "    const expected = state.sequence[state.playerStep];\n",
    "    const expected = state.expectedSequence[state.playerStep];\n",
    'Matrix expected sequence',
)
s = replace_once(
    s,
    "          <span className=\"text-white font-bold\">ROUND {roundLevel}</span>\n          <span className=\"text-[#71717A]\">|</span>\n",
    "          <span className=\"text-white font-bold\">ROUND {roundLevel}</span>\n          <span className=\"text-[#71717A]\">|</span>\n          <span className=\"text-cyan-300 font-bold\">PROTOCOL {protocol.replace('_', '+')}</span>\n          <span className=\"text-[#71717A]\">|</span>\n",
    'Matrix protocol HUD',
)
write(p, s)

# ---------------------------------------------------------------------------
# 2. TYPE RUSH — replace flat endless scaling with four named skill waves.
# ---------------------------------------------------------------------------
p = 'src/games/TypeRushGame.tsx'
s = read(p)
s = replace_once(
    s,
    "} from '../lib/typeRushRuntime';\n",
    "} from '../lib/typeRushRuntime';\nimport { chooseTypeRushWord, getTypeRushWave } from '../lib/typeRushProgression';\n",
    'Type Rush progression import',
)
s = regex_once(
    s,
    r"\nconst WORD_BANK = \[.*?\n\];\n",
    "\n",
    'Type Rush flat word bank removal',
    re.S,
)
s = replace_once(
    s,
    "  const [wpm, setWpm] = useState(0);\n",
    "  const [wpm, setWpm] = useState(0);\n  const [waveLabel, setWaveLabel] = useState('BOOT');\n",
    'Type Rush wave HUD state',
)
s = replace_once(
    s,
    "    gameTime: 0,\n    freezeTimer: 0,\n",
    "    gameTime: 0,\n    waveIndex: 0,\n    freezeTimer: 0,\n",
    'Type Rush wave ref state',
)
s = regex_once(
    s,
    r"    const availableWords = WORD_BANK\.filter\(\n      \(w\) => !state\.words\.some\(\(sw\) => sw\.word === w\)\n    \);\n    const chosen =\n      availableWords\[Math\.floor\(Math\.random\(\) \* availableWords\.length\)\] \|\| 'LASER';\n",
    "    const wave = getTypeRushWave(state.gameTime);\n    const chosen = chooseTypeRushWord(\n      wave,\n      state.words.map((word) => word.word),\n      Math.random(),\n    );\n",
    'Type Rush wave word selection',
)
s = replace_once(
    s,
    "    const baseSpeed = 0.15 + Math.min(0.22, state.gameTime * 0.0035);\n",
    "    const baseSpeed =\n      (0.15 + Math.min(0.18, state.gameTime * 0.0028)) * wave.speedMultiplier;\n",
    'Type Rush wave speed',
)
s = replace_once(
    s,
    "        let pts = target.word.length * 100 * multiplier;\n",
    "        const wave = getTypeRushWave(state.gameTime);\n        let pts = Math.round(target.word.length * 100 * multiplier * wave.scoreMultiplier);\n",
    'Type Rush wave scoring',
)
s = replace_once(
    s,
    "    state.gameTime = 0;\n    state.freezeTimer = 0;\n",
    "    state.gameTime = 0;\n    state.waveIndex = 0;\n    state.freezeTimer = 0;\n",
    'Type Rush reset wave',
)
s = replace_once(
    s,
    "    setWpm(0);\n    setWords([]);\n",
    "    setWpm(0);\n    setWaveLabel('BOOT');\n    setWords([]);\n",
    'Type Rush reset wave label',
)
s = regex_once(
    s,
    r"        // Spawning timer \(scaled for reasonable pace and reading room\)\n        const spawnInterval = Math\.max\(1200, 2400 - state\.gameTime \* 25\);\n        if \(currentTime - state\.lastSpawn > spawnInterval && state\.words\.length < 4\) \{\n          spawnWord\(\);\n          state\.lastSpawn = currentTime;\n        \}\n",
    "        // Four authored waves increase vocabulary length, density, speed, and reward.\n        const wave = getTypeRushWave(state.gameTime);\n        if (wave.index !== state.waveIndex) {\n          state.waveIndex = wave.index;\n          setWaveLabel(wave.label);\n          if (soundEnabledRef.current) sounds.playChime(700 + wave.index * 120);\n        }\n        const spawnInterval = wave.spawnIntervalMs;\n        if (currentTime - state.lastSpawn > spawnInterval && state.words.length < wave.maxWords) {\n          spawnWord();\n          state.lastSpawn = currentTime;\n        }\n",
    'Type Rush wave spawner',
)
s = replace_once(
    s,
    "          <div className=\"font-mono-arcade text-xs text-[#38BDF8] bg-[#18181B]/95 px-3 py-1.5 rounded-xl border border-[#27272A] shadow-md backdrop-blur\">\n            {wpm} WPM\n          </div>\n",
    "          <div className=\"font-mono-arcade text-[10px] text-[#FACC15] bg-[#18181B]/95 px-2.5 py-1.5 rounded-xl border border-[#FACC15]/25 shadow-md backdrop-blur\">\n            {waveLabel} WAVE\n          </div>\n          <div className=\"font-mono-arcade text-xs text-[#38BDF8] bg-[#18181B]/95 px-3 py-1.5 rounded-xl border border-[#27272A] shadow-md backdrop-blur\">\n            {wpm} WPM\n          </div>\n",
    'Type Rush wave HUD',
)
write(p, s)

# ---------------------------------------------------------------------------
# 3. NEON RAIL SHIFT — authored movement phrases + optional Phase scoring routes.
# ---------------------------------------------------------------------------
p = 'src/games/NeonRailShiftGame.tsx'
s = read(p)
s = replace_once(
    s,
    "} from '../lib/neonRailShift';\n",
    "} from '../lib/neonRailShift';\nimport {\n  createNeonRailChallengePattern,\n  createNeonRailPhrase,\n  type NeonRailPhraseName,\n} from '../lib/neonRailDepth';\n",
    'Rail depth import',
)
s = replace_once(
    s,
    "  previousY: number;\n}\n",
    "  previousY: number;\n  phaseCore?: boolean;\n}\n",
    'Rail phase core object flag',
)
s = replace_once(
    s,
    "    phaseCooldown: 0,\n  });\n",
    "    phaseCooldown: 0,\n    phraseName: 'SWITCHBACK' as NeonRailPhraseName,\n  });\n",
    'Rail phrase HUD initial state',
)
s = replace_once(
    s,
    "    rowIndex: 0,\n    spawnTimer: 0.75,\n",
    "    rowIndex: 0,\n    phraseLanes: [1] as NeonRailLane[],\n    phraseStep: 0,\n    phraseName: 'SWITCHBACK' as NeonRailPhraseName,\n    spawnTimer: 0.75,\n",
    'Rail phrase runtime state',
)
s = replace_once(
    s,
    "    state.rowIndex = 0;\n    state.spawnTimer = 0.75;\n",
    "    state.rowIndex = 0;\n    state.phraseLanes = [1];\n    state.phraseStep = 0;\n    state.phraseName = 'SWITCHBACK';\n    state.spawnTimer = 0.75;\n",
    'Rail phrase reset',
)
s = regex_once(
    s,
    r"        if \(state\.spawnTimer <= 0\) \{\n          const pattern = createNeonRailPattern\(\n            state\.lastSafeLane,\n            state\.rowIndex,\n            Math\.random\(\),\n            Math\.random\(\),\n          \);\n          state\.lastSafeLane = pattern\.safeLane;\n          state\.rowIndex\+\+;\n",
    "        if (state.spawnTimer <= 0) {\n          if (state.phraseStep >= state.phraseLanes.length) {\n            const phrase = createNeonRailPhrase(state.lastSafeLane, Math.random());\n            state.phraseLanes = phrase.lanes;\n            state.phraseStep = 0;\n            state.phraseName = phrase.name;\n          }\n          const safeLane = state.phraseLanes[state.phraseStep++];\n          const pattern = createNeonRailChallengePattern(\n            safeLane,\n            state.rowIndex,\n            Math.random(),\n          );\n          state.lastSafeLane = pattern.safeLane;\n          state.rowIndex++;\n",
    'Rail phrase spawn logic',
)
s = replace_once(
    s,
    "            lane: pattern.coreLane,\n            y: -0.1,\n            previousY: -0.1,\n",
    "            lane: pattern.coreLane,\n            y: pattern.phaseOpportunity ? -0.18 : -0.1,\n            previousY: pattern.phaseOpportunity ? -0.18 : -0.1,\n            phaseCore: pattern.phaseOpportunity,\n",
    'Rail phase core spawn',
)
s = replace_once(
    s,
    "                const multiplier = Math.min(5, 1 + Math.floor(state.combo / 4));\n                const points = 120 * multiplier;\n",
    "                const multiplier = Math.min(5, 1 + Math.floor(state.combo / 4));\n                const phaseRouteMultiplier = object.phaseCore ? 3 : 1;\n                const points = 120 * multiplier * phaseRouteMultiplier;\n",
    'Rail phase route score',
)
s = replace_once(
    s,
    "                  text: state.combo >= 4 ? `CHAIN x${multiplier} +${points}` : `CORE +${points}`,\n                  color: multiplier > 1 ? '#FACC15' : '#34D399',\n",
    "                  text: object.phaseCore\n                    ? `PHASE ROUTE x3 +${points}`\n                    : state.combo >= 4\n                    ? `CHAIN x${multiplier} +${points}`\n                    : `CORE +${points}`,\n                  color: object.phaseCore || multiplier > 1 ? '#FACC15' : '#34D399',\n",
    'Rail phase route feedback',
)
s = replace_once(
    s,
    "            phaseCooldown: state.phaseCooldown,\n          });\n",
    "            phaseCooldown: state.phaseCooldown,\n            phraseName: state.phraseName,\n          });\n",
    'Rail phrase HUD update',
)
s = replace_once(
    s,
    "          ctx.fillStyle = '#34D399';\n          ctx.strokeStyle = '#A7F3D0';\n          ctx.shadowColor = '#34D399';\n",
    "          ctx.fillStyle = object.phaseCore ? '#FACC15' : '#34D399';\n          ctx.strokeStyle = object.phaseCore ? '#FEF08A' : '#A7F3D0';\n          ctx.shadowColor = object.phaseCore ? '#FACC15' : '#34D399';\n",
    'Rail phase core telegraph',
)
s = replace_once(
    s,
    "          <div className=\"rounded-xl border border-cyan-400/25 bg-slate-950/80 px-2.5 py-1 font-mono text-xs font-black text-cyan-300 backdrop-blur-md\">\n            SCORE {hudState.score.toLocaleString()}\n          </div>\n",
    "          <div className=\"rounded-xl border border-cyan-400/25 bg-slate-950/80 px-2.5 py-1 font-mono text-xs font-black text-cyan-300 backdrop-blur-md\">\n            SCORE {hudState.score.toLocaleString()}\n          </div>\n          <div className=\"rounded-xl border border-slate-600/40 bg-slate-950/75 px-2 py-1 font-mono text-[9px] font-black text-slate-300\">\n            {hudState.phraseName.replace('_', ' ')}\n          </div>\n",
    'Rail phrase HUD badge',
)
write(p, s)

# ---------------------------------------------------------------------------
# 4. KNIFE TARGET — six authored stage identities with readable mastery rules.
# ---------------------------------------------------------------------------
p = 'src/games/KnifeTargetGame.tsx'
s = read(p)
s = replace_once(
    s,
    "} from '../lib/knifeTargetAim';\n",
    "} from '../lib/knifeTargetAim';\nimport { getKnifeStageConfig, getKnifeStageRotationSpeed } from '../lib/knifeStageProgression';\n",
    'Knife stage progression import',
)
s = replace_once(
    s,
    "    multiplier: 1,\n  });\n",
    "    multiplier: 1,\n    stageLabel: 'STEADY CORE',\n  });\n",
    'Knife stage label HUD',
)
s = replace_once(
    s,
    "    coreSpeed: 2.2,\n    coreRadius: 65,\n    speedChangeTimer: 2.5,\n",
    "    coreSpeed: 2.2,\n    coreDirection: 1 as -1 | 1,\n    coreRadius: 65,\n    stageElapsed: 0,\n    reverseTimer: 0,\n    stageLabel: 'STEADY CORE',\n",
    'Knife stage runtime state',
)
s = regex_once(
    s,
    r"    state\.stage = stageNum;\n    state\.coreAngle = 0;\n    state\.coreSpeed =\n      \(1\.8 \+ stageNum \* 0\.3\) \* \(Math\.random\(\) < 0\.5 \? 1 : -1\);\n    state\.speedChangeTimer = Math\.random\(\) \* 2 \+ 1\.5;\n\n    const knifeCount = Math\.min\(14, 7 \+ stageNum\);\n    state\.totalKnivesForStage = knifeCount;\n    state\.knivesRemaining = knifeCount;\n    state\.isThrowing = false;\n    state\.flyingBladeProgress = 0;\n    state\.aimWorldAngle = Math\.PI / 2;\n    state\.flyingAimWorldAngle = Math\.PI / 2;\n    state\.embeddedBlades = \[\];\n    state\.apples = \[\];\n    state\.shields = \[\];\n\n    if \(stageNum > 1\) \{\n      const preBladeCount = Math\.min\(4, Math\.floor\(stageNum / 2\)\);\n      for \(let i = 0; i < preBladeCount; i\+\+\) \{\n        state\.embeddedBlades\.push\(\{\n          angle: normalizeKnifeAngle\(\n            \(i / preBladeCount\) \* Math\.PI \* 2 \+ Math\.random\(\) \* 0\.4,\n          \),\n        \}\);\n      \}\n    \}\n\n    const appleCount = Math\.floor\(Math\.random\(\) \* 2\) \+ 1;\n    for \(let i = 0; i < appleCount; i\+\+\) \{\n      state\.apples\.push\(\{\n        angle: Math\.random\(\) \* Math\.PI \* 2,\n        sliced: false,\n      \}\);\n    \}\n\n    if \(stageNum % 4 === 0\) \{\n      state\.shields\.push\(\{\n        startAngle: 0,\n        spanAngle: 0\.8,\n      \}\);\n    \}\n",
    "    const config = getKnifeStageConfig(stageNum);\n    state.stage = stageNum;\n    state.stageLabel = config.label;\n    state.coreAngle = 0;\n    state.stageElapsed = 0;\n    state.coreDirection = Math.random() < 0.5 ? 1 : -1;\n    state.reverseTimer = config.reverseInterval;\n    state.coreSpeed = getKnifeStageRotationSpeed(config, 0, state.coreDirection);\n\n    state.totalKnivesForStage = config.knifeCount;\n    state.knivesRemaining = config.knifeCount;\n    state.isThrowing = false;\n    state.flyingBladeProgress = 0;\n    state.aimWorldAngle = Math.PI / 2;\n    state.flyingAimWorldAngle = Math.PI / 2;\n    state.embeddedBlades = [];\n    state.apples = [];\n    state.shields = [];\n\n    for (let i = 0; i < config.preBladeCount; i++) {\n      state.embeddedBlades.push({\n        angle: normalizeKnifeAngle(\n          (i / Math.max(1, config.preBladeCount)) * Math.PI * 2 + Math.random() * 0.22,\n        ),\n      });\n    }\n\n    const appleOffset = Math.random() * Math.PI * 2;\n    for (let i = 0; i < config.appleCount; i++) {\n      state.apples.push({\n        angle: normalizeKnifeAngle(appleOffset + (i / config.appleCount) * Math.PI * 2),\n        sliced: false,\n      });\n    }\n\n    for (let i = 0; i < config.shieldCount; i++) {\n      state.shields.push({\n        startAngle: normalizeKnifeAngle(0.25 + (i / config.shieldCount) * Math.PI * 2),\n        spanAngle: config.shieldSpan,\n      });\n    }\n",
    'Knife authored stage init',
    re.S,
)
s = regex_once(
    s,
    r"        state\.speedChangeTimer -= dt;\n        if \(state\.speedChangeTimer <= 0\) \{\n          state\.speedChangeTimer = Math\.random\(\) \* 2\.5 \+ 1\.2;\n          const targetDir = Math\.random\(\) < 0\.5 \? 1 : -1;\n          state\.coreSpeed =\n            \(2\.0 \+ state\.stage \* 0\.35 \+ Math\.random\(\) \* 1\.5\) \* targetDir;\n        \}\n\n        state\.coreAngle \+= state\.coreSpeed \* dt;\n",
    "        const stageConfig = getKnifeStageConfig(state.stage);\n        state.stageElapsed += dt;\n        if (stageConfig.reverseInterval > 0) {\n          state.reverseTimer -= dt;\n          if (state.reverseTimer <= 0) {\n            state.coreDirection *= -1;\n            state.reverseTimer += stageConfig.reverseInterval;\n            if (soundEnabled) sounds.playWhoosh();\n          }\n        }\n        state.coreSpeed = getKnifeStageRotationSpeed(\n          stageConfig,\n          state.stageElapsed,\n          state.coreDirection,\n        );\n        state.coreAngle += state.coreSpeed * dt;\n",
    'Knife authored rotation behavior',
)
s = replace_once(
    s,
    "        multiplier: state.multiplier,\n      });\n",
    "        multiplier: state.multiplier,\n        stageLabel: state.stageLabel,\n      });\n",
    'Knife stage label HUD update',
)
s = replace_once(
    s,
    "          <div className=\"px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-sky-400 font-mono text-xs font-black backdrop-blur-md\">\n            STAGE {hudState.stage}\n          </div>\n",
    "          <div className=\"px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-sky-400 font-mono text-xs font-black backdrop-blur-md\">\n            STAGE {hudState.stage}\n          </div>\n          <div className=\"px-2 py-1 rounded-xl bg-[#18181B]/85 border border-sky-500/20 text-sky-200 font-mono text-[10px] font-bold backdrop-blur-md\">\n            {hudState.stageLabel}\n          </div>\n",
    'Knife stage identity HUD',
)
write(p, s)

# ---------------------------------------------------------------------------
# 5. PAC-RUNNER — explicit chase/scatter cycles + level-based mastery scaling.
# ---------------------------------------------------------------------------
p = 'src/games/PacMazeGame.tsx'
s = read(p)
s = replace_once(
    s,
    "} from '../lib/pacMazeControls';\n",
    "} from '../lib/pacMazeControls';\nimport {\n  getPacFrightenedDuration,\n  getPacGhostMode,\n  getPacGhostSpeed,\n  getPacGhostTarget,\n  type PacGhostMode,\n} from '../lib/pacGhostAi';\n",
    'Pac ghost AI import',
)
s = replace_once(
    s,
    "    ghostsEatenStreak: 0,\n  });\n",
    "    ghostsEatenStreak: 0,\n    level: 1,\n    ghostMode: 'SCATTER' as PacGhostMode,\n  });\n",
    'Pac HUD progression state',
)
s = replace_once(
    s,
    "    totalDots: 0,\n    dotsEaten: 0,\n\n    // Player position",
    "    totalDots: 0,\n    dotsEaten: 0,\n    level: 1,\n    levelElapsed: 0,\n    ghostMode: 'SCATTER' as PacGhostMode,\n\n    // Player position",
    'Pac runtime progression state',
)
s = replace_once(
    s,
    "      if (!isPausedRef.current && state.isAlive) {\n        // Mouth animation\n",
    "      if (!isPausedRef.current && state.isAlive) {\n        state.levelElapsed += dt;\n        const nextGhostMode = getPacGhostMode(state.levelElapsed, state.level);\n        if (nextGhostMode !== state.ghostMode) {\n          state.ghostMode = nextGhostMode;\n          for (const ghost of state.ghosts) {\n            ghost.dirX *= -1;\n            ghost.dirY *= -1;\n          }\n        }\n\n        // Mouth animation\n",
    'Pac chase scatter mode clock',
)
s = replace_once(
    s,
    "            state.frightenedTimer = 8.5; // 8.5 seconds frightened mode\n",
    "            state.frightenedTimer = getPacFrightenedDuration(state.level);\n",
    'Pac frightened level duration',
)
s = replace_once(
    s,
    "            state.grid = MAZE_MAP.map((r) => [...r]);\n            state.dotsEaten = 0;\n            state.px = 9;\n",
    "            state.grid = MAZE_MAP.map((r) => [...r]);\n            state.dotsEaten = 0;\n            state.level++;\n            state.levelElapsed = 0;\n            state.ghostMode = 'SCATTER';\n            state.frightenedTimer = 0;\n            state.ghostsEatenStreak = 0;\n            state.px = 9;\n",
    'Pac level increment',
)
s = replace_once(
    s,
    "            state.nextDirX = 0;\n            state.nextDirY = 0;\n          }\n",
    "            state.nextDirX = 0;\n            state.nextDirY = 0;\n            state.ghosts.forEach((ghost, index) => {\n              const starts = [[9, 10], [8, 10], [10, 10], [9, 11]] as const;\n              ghost.x = starts[index][0];\n              ghost.y = starts[index][1];\n              ghost.dirX = 0;\n              ghost.dirY = -1;\n            });\n          }\n",
    'Pac level ghost reset',
)
s = replace_once(
    s,
    "        const ghostSpeed = (isFrightened ? 2.8 : 4.4) * dt;\n",
    "        const ghostSpeed = getPacGhostSpeed(state.level, isFrightened) * dt;\n",
    'Pac level ghost speed',
)
s = regex_once(
    s,
    r"            // Target tile determination \(Chase player or Scatter or Run away\)\n            let targetX = state\.px;\n            let targetY = state\.py;\n\n            if \(isFrightened\) \{\n              targetX = Math\.random\(\) \* COLS;\n              targetY = Math\.random\(\) \* ROWS;\n            \} else if \(ghost\.id === 1\) \{\n              // Pinky targets 4 tiles ahead of player\n              targetX = state\.px \+ state\.dirX \* 4;\n              targetY = state\.py \+ state\.dirY \* 4;\n            \} else if \(ghost\.id === 2\) \{\n              // Inky flank\n              targetX = state\.px \* 2 - state\.ghosts\[0\]\.x;\n              targetY = state\.py \* 2 - state\.ghosts\[0\]\.y;\n            \} else if \(ghost\.id === 3\) \{\n              // Clyde \(wanders if close, chases if far\)\n              const d = Math\.hypot\(ghost\.x - state\.px, ghost\.y - state\.py\);\n              if \(d < 5\) \{\n                targetX = ghost\.scatterX;\n                targetY = ghost\.scatterY;\n              \}\n            \}\n",
    "            // Each ghost keeps a distinct chase personality; global scatter windows\n            // periodically break pursuit and create route-planning opportunities.\n            let targetX: number;\n            let targetY: number;\n            if (isFrightened) {\n              targetX = Math.random() * COLS;\n              targetY = Math.random() * ROWS;\n            } else {\n              const target = getPacGhostTarget(ghost, state.ghosts, state, state.ghostMode);\n              targetX = target.x;\n              targetY = target.y;\n            }\n",
    'Pac personality target integration',
    re.S,
)
s = replace_once(
    s,
    "          prev.ghostsEatenStreak === state.ghostsEatenStreak\n",
    "          prev.ghostsEatenStreak === state.ghostsEatenStreak &&\n          prev.level === state.level &&\n          prev.ghostMode === state.ghostMode\n",
    'Pac HUD dedupe progression',
)
s = replace_once(
    s,
    "          ghostsEatenStreak: state.ghostsEatenStreak,\n        };\n",
    "          ghostsEatenStreak: state.ghostsEatenStreak,\n          level: state.level,\n          ghostMode: state.ghostMode,\n        };\n",
    'Pac HUD progression return',
)
s = replace_once(
    s,
    "          {/* Lives */}\n",
    "          <div className=\"px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-sky-300 font-mono text-[10px] font-black backdrop-blur-md\">\n            LEVEL {hudState.level} · {hudState.ghostMode}\n          </div>\n\n          {/* Lives */}\n",
    'Pac level mode HUD',
)
write(p, s)

# ---------------------------------------------------------------------------
# 6. Registry copy — accurately communicate the new mastery loops.
# ---------------------------------------------------------------------------
p = 'src/data/games.ts'
s = read(p)

def update_game_description(text, game_id, description, instructions=None):
    pattern = rf"(id: '{re.escape(game_id)}',[\s\S]*?description: )'[^']*'"
    text, count = re.subn(pattern, lambda m: m.group(1) + repr(description), text, count=1)
    if count != 1:
        raise SystemExit(f'registry description missing: {game_id}')
    if instructions is not None:
        pattern = rf"(id: '{re.escape(game_id)}',[\s\S]*?instructions: )'[^']*'"
        text, count = re.subn(pattern, lambda m: m.group(1) + repr(instructions), text, count=1)
        if count != 1:
            raise SystemExit(f'registry instructions missing: {game_id}')
    return text

s = update_game_description(
    s,
    'matrix',
    'Memorize sequences across transforming memory protocols: forward, reverse, mirror, and reverse-mirror.',
    'Watch the pads, then reproduce the sequence using the active transforming memory protocol.',
)
s = update_game_description(
    s,
    'typerush',
    'Defend the perimeter through four escalating typing waves with progressively longer, denser, faster word sets.',
    'Type falling words accurately; four escalating typing waves steadily increase vocabulary length and pressure.',
)
s = update_game_description(
    s,
    'railshift',
    'Read authored rail phrases, build core streaks, and spend Phase on optional blocked high-value routes.',
    'Follow authored rail phrases with A/D or taps. Space activates Phase; gold cores behind barriers are optional x3 routes.',
)
s = update_game_description(
    s,
    'knife',
    'Aim through six rotating stage identities: steady, backspin, pulse, shield, precision, and boss cores.',
    'Aim around the core and throw into open arcs; learn each of the six rotating stage identities.',
)
s = update_game_description(
    s,
    'pacmaze',
    'Clear increasingly fast maze levels while distinct ghosts switch through readable chase/scatter cycles.',
    'Clear dots, exploit power pellets, and route around ghost chase/scatter cycles as levels accelerate.',
)
write(p, s)

# ---------------------------------------------------------------------------
# 7. Permanent quality gate registration (CI workflow wired separately).
# ---------------------------------------------------------------------------
p = 'package.json'
pkg = json.loads(read(p))
scripts = pkg['scripts']
new_scripts = {}
for key, value in scripts.items():
    new_scripts[key] = value
    if key == 'quality:gameplay-p1':
        new_scripts['quality:gameplay-p2'] = 'bun scripts/audit-gameplay-p2.ts'
pkg['scripts'] = new_scripts
write(p, json.dumps(pkg, indent=2) + '\n')

p = 'scripts/audit-release-32.ts'
s = read(p)
s = replace_once(
    s,
    "  'quality:gameplay-p1',\n",
    "  'quality:gameplay-p1',\n  'quality:gameplay-p2',\n",
    'release P2 quality gate',
)
s = replace_once(
    s,
    "  'scripts/audit-gameplay-p1.ts',\n",
    "  'scripts/audit-gameplay-p1.ts',\n  'scripts/audit-gameplay-p2.ts',\n",
    'release P2 audit file',
)
write(p, s)
