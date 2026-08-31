from pathlib import Path

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text()

def write(path, content):
    (ROOT / path).write_text(content)

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing patch marker: {label}')
    return text.replace(old, new, 1)

# ORBIT ---------------------------------------------------------------------
orbit = read('src/games/OrbitGame.tsx')
orbit = replace_once(orbits := orbit,
    "import { getFrameInvariantBlend, getFrameInvariantDecay, getFrameScale } from '../lib/frameRateRuntime';",
    "import { getFrameInvariantBlend, getFrameInvariantDecay, getFrameScale } from '../lib/frameRateRuntime';\nimport { getOrbitRouteLane, getOrbitRouteName, getOrbitRouteMultiplier, isOrbitNearMiss } from '../lib/orbitMastery';",
    'orbit import')
orbit = replace_once(orbit, "  trail: { x: number; y: number; alpha: number }[];\n}", "  trail: { x: number; y: number; alpha: number }[];\n  nearMissAwarded: boolean;\n}", 'orbit hazard flag')
orbit = replace_once(orbit, "  spin: number;\n}", "  spin: number;\n  routeIndex: number;\n}", 'orbit route id')
orbit = replace_once(orbit,
    "    combo: 1,\n    isAlive: true,",
    "    combo: 1,\n    routeIndex: 0,\n    lastRouteIndex: -1,\n    routeChain: 0,\n    nearMissChain: 0,\n    lastNearMissAt: -99,\n    isAlive: true,",
    'orbit mastery state')
orbit = replace_once(orbit, "      trail: [],\n    });", "      trail: [],\n      nearMissAwarded: false,\n    });", 'orbit hazard init')
orbit = replace_once(orbit,
    "  const spawnCrystal = useCallback(() => {\n    const state = gameStateRef.current;\n    const lane = Math.floor(Math.random() * 3);\n    state.crystals.push({\n      angle: Math.random() * Math.PI * 2,\n      lane,",
    "  const spawnCrystal = useCallback(() => {\n    const state = gameStateRef.current;\n    const routeIndex = state.routeIndex++;\n    const lane = getOrbitRouteLane(routeIndex);\n    const forwardArc = state.direction > 0 ? 0.8 : -0.8;\n    state.crystals.push({\n      angle: state.playerAngle + forwardArc + (Math.random() - 0.5) * 0.25,\n      lane,",
    'orbit route spawn')
orbit = replace_once(orbit,
    "      spin: 0,\n      color: lane === 0 ? '#FB923C' : lane === 1 ? '#38BDF8' : '#34D399',",
    "      spin: 0,\n      routeIndex,\n      color: lane === 0 ? '#FB923C' : lane === 1 ? '#38BDF8' : '#34D399',",
    'orbit route assign')
orbit = replace_once(orbit,
    "          if (dist < 18) {\n            // Picked up crystal!\n            state.score += 150 * state.combo;\n            state.combo = Math.min(8, state.combo + 1);",
    "          if (dist < 18) {\n            // Route chains reward collecting authored lane targets in sequence.\n            state.routeChain = c.routeIndex === state.lastRouteIndex + 1 ? state.routeChain + 1 : 1;\n            state.lastRouteIndex = c.routeIndex;\n            const routeMultiplier = getOrbitRouteMultiplier(state.routeChain);\n            const routePoints = 150 * routeMultiplier;\n            state.score += routePoints;\n            state.combo = Math.min(8, state.combo + 1);",
    'orbit route scoring')
orbit = replace_once(orbit, "              text: `+${150 * state.combo}`,", "              text: `ROUTE x${routeMultiplier} +${routePoints}`,", 'orbit route popup')
orbit = replace_once(orbit,
    "          // Collision with ship\n          const distToShip = Math.hypot(playerX - h.x, playerY - h.y);\n          if (distToShip < h.radius + 7) {",
    "          // Collision / graze mastery. A graze only scores once the comet is moving away.\n          const dxShip = h.x - playerX;\n          const dyShip = h.y - playerY;\n          const distToShip = Math.hypot(dxShip, dyShip);\n          const collisionRadius = h.radius + 7;\n          const relativeDot = dxShip * h.vx + dyShip * h.vy;\n          if (!h.nearMissAwarded && isOrbitNearMiss(distToShip, collisionRadius, relativeDot)) {\n            h.nearMissAwarded = true;\n            state.nearMissChain = state.gameTime - state.lastNearMissAt <= 6 ? state.nearMissChain + 1 : 1;\n            state.lastNearMissAt = state.gameTime;\n            const grazePoints = 100 * Math.min(5, state.nearMissChain);\n            state.score += grazePoints;\n            onScoreUpdate(state.score);\n            state.floatingTexts.push({\n              x: playerX,\n              y: playerY - 18,\n              text: `GRAZE x${state.nearMissChain} +${grazePoints}`,\n              color: '#FACC15',\n              life: 0,\n              maxLife: 30,\n            });\n            if (soundEnabled) sounds.playChime(820);\n          }\n          if (distToShip < collisionRadius) {",
    'orbit graze')
orbit = replace_once(orbit,
    "      // Blazing Stellar Center Star Core",
    "      // Route / graze mastery HUD is rendered on-canvas so it stays frame-local.\n      ctx.fillStyle = 'rgba(24, 24, 27, 0.88)';\n      ctx.fillRect(cx - 126, 12, 252, 26);\n      ctx.strokeStyle = 'rgba(63, 63, 70, 0.9)';\n      ctx.strokeRect(cx - 126, 12, 252, 26);\n      ctx.fillStyle = '#38BDF8';\n      ctx.font = 'bold 10px monospace';\n      ctx.textAlign = 'center';\n      ctx.textBaseline = 'middle';\n      ctx.fillText(\n        `${getOrbitRouteName(state.routeIndex)} • ROUTE x${getOrbitRouteMultiplier(state.routeChain)} • GRAZE x${Math.max(1, state.nearMissChain)}`,\n        cx,\n        25,\n      );\n\n      // Blazing Stellar Center Star Core",
    'orbit mastery hud')
write('src/games/OrbitGame.tsx', orbit)

# MERGE ---------------------------------------------------------------------
merge = read('src/games/MergeGame.tsx')
merge = replace_once(merge, "import { findNextMergeDecision } from '../lib/mergeRules';", "import { findNextMergeDecision } from '../lib/mergeRules';\nimport { getMergeContract, isMergeContractComplete } from '../lib/mergeMastery';", 'merge import')
merge = replace_once(merge, "  const [nextTile, setNextTile] = useState<number>(2);", "  const [tileQueue, setTileQueue] = useState<number[]>([2, 2, 4]);\n  const nextTile = tileQueue[0];", 'merge queue state')
merge = replace_once(merge, "  const [score, setScore] = useState(0);", "  const [score, setScore] = useState(0);\n  const [contractLevel, setContractLevel] = useState(1);", 'merge contract state')
merge = replace_once(merge, "  useEffect(() => {\n    setNextTile(getNewTileValue());\n  }, []);", "  useEffect(() => {\n    setTileQueue([getNewTileValue(), getNewTileValue(), getNewTileValue()]);\n  }, []);", 'merge queue init')
merge = replace_once(merge, "    setSwapsLeft((prev) => prev - 1);\n    setNextTile(getNewTileValue());", "    setSwapsLeft((prev) => prev - 1);\n    setTileQueue((queue) => [getNewTileValue(), queue[1], queue[2]]);", 'merge swap')
merge = replace_once(merge,
    "    setBoard(newBoard);\n    setScore(currentScore);\n    onScoreUpdate(currentScore);",
    "    const highestTile = Math.max(0, ...newBoard.flat().map((tile) => tile?.val ?? 0));\n    const activeContract = getMergeContract(contractLevel);\n    if (isMergeContractComplete(activeContract, { mergeStreak, highestTile })) {\n      currentScore += activeContract.bonus;\n      setContractLevel((level) => level + 1);\n      setHammerCharges((charges) => Math.min(2, charges + 1));\n      setSwapsLeft((swaps) => Math.min(3, swaps + 1));\n      haptics.combo();\n      if (soundEnabled) sounds.playSuccess();\n    }\n\n    setBoard(newBoard);\n    setScore(currentScore);\n    onScoreUpdate(currentScore);",
    'merge contract completion')
merge = replace_once(merge, "    setNextTile(getNewTileValue());", "    setTileQueue((queue) => [queue[1], queue[2], getNewTileValue()]);", 'merge advance queue')
merge = replace_once(merge, "  const nextStyle = TILE_STYLES[nextTile] || TILE_STYLES[2];", "  const contract = getMergeContract(contractLevel);", 'merge derive contract')
merge = replace_once(merge,
    "      {/* Top HUD: Next Tile & Powerups */}\n      <div className=\"mb-3 flex items-center justify-between w-full max-w-xs px-1\">",
    "      {/* Escalating contract gives every run a short-term planning goal. */}\n      <div className=\"mb-2 w-full max-w-xs flex items-center justify-between px-3 py-2 rounded-xl bg-[#18181B] border border-[#27272A] font-mono-arcade text-[10px] sm:text-xs\">\n        <div>\n          <div className=\"text-[#71717A]\">CONTRACT {contractLevel}</div>\n          <div className=\"text-[#FACC15] font-bold\">{contract.label}</div>\n        </div>\n        <div className=\"text-[#34D399] font-bold\">+{contract.bonus}</div>\n      </div>\n\n      {/* Top HUD: three-tile preview & powerups */}\n      <div className=\"mb-3 flex items-center justify-between w-full max-w-xs px-1\">",
    'merge contract hud')
merge = replace_once(merge,
    "          <span className=\"text-[11px] font-mono-arcade text-[#71717A] font-bold\">NEXT:</span>\n          <div\n            className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-xs sm:text-sm shadow-md transition-transform ${nextStyle.bg} ${nextStyle.border} ${nextStyle.text}`}\n            style={{ boxShadow: `0 0 10px ${nextStyle.glow}` }}\n          >\n            {nextTile}\n          </div>",
    "          <span className=\"text-[11px] font-mono-arcade text-[#71717A] font-bold\">QUEUE:</span>\n          <div className=\"flex items-center gap-1\">\n            {tileQueue.map((value, index) => {\n              const style = TILE_STYLES[value] || TILE_STYLES[2];\n              return (\n                <div\n                  key={`${value}-${index}`}\n                  className={`${index === 0 ? 'w-8 h-8' : 'w-6 h-6 opacity-65'} rounded-lg border flex items-center justify-center font-bold text-[10px] sm:text-xs ${style.bg} ${style.border} ${style.text}`}\n                  style={{ boxShadow: index === 0 ? `0 0 10px ${style.glow}` : undefined }}\n                >\n                  {value}\n                </div>\n              );\n            })}\n          </div>",
    'merge queue hud')
write('src/games/MergeGame.tsx', merge)

# TYPE RUSH -----------------------------------------------------------------
type_rush = read('src/games/TypeRushGame.tsx')
type_rush = replace_once(type_rush, "import { chooseTypeRushWord, getTypeRushWave } from '../lib/typeRushProgression';", "import { chooseTypeRushWord, getTypeRushWave } from '../lib/typeRushProgression';\nimport { getTypeRushDirective, getTypeRushSpecialWeight, getTypeRushTargetBonus } from '../lib/typeRushMastery';", 'type import')
type_rush = replace_once(type_rush, "    const randType = Math.random();", "    const randType = Math.random();\n    const specialWeight = getTypeRushSpecialWeight(wave.index);", 'type special mix')
type_rush = replace_once(type_rush,
    "    if (randType < 0.12) {\n      type = 'bomb';\n      color = '#F43F5E';\n    } else if (randType < 0.22) {\n      type = 'freeze';\n      color = '#A78BFA';\n    } else if (randType < 0.32) {\n      type = 'hyper';",
    "    if (randType < specialWeight.bomb) {\n      type = 'bomb';\n      color = '#F43F5E';\n    } else if (randType < specialWeight.freeze) {\n      type = 'freeze';\n      color = '#A78BFA';\n    } else if (randType < specialWeight.hyper) {\n      type = 'hyper';",
    'type special thresholds')
type_rush = replace_once(type_rush, "        let pts = Math.round(target.word.length * 100 * multiplier * wave.scoreMultiplier);", "        const targetBonus = getTypeRushTargetBonus(target.y, target.type, wave.index);\n        let pts = Math.round(target.word.length * 100 * multiplier * wave.scoreMultiplier * targetBonus);", 'type target bonus')
type_rush = replace_once(type_rush,
    "          <div className=\"font-mono-arcade text-[10px] text-[#FACC15] bg-[#18181B]/95 px-2.5 py-1.5 rounded-xl border border-[#FACC15]/25 shadow-md backdrop-blur\">\n            {waveLabel} WAVE\n          </div>",
    "          <div className=\"font-mono-arcade text-[10px] text-[#FACC15] bg-[#18181B]/95 px-2.5 py-1.5 rounded-xl border border-[#FACC15]/25 shadow-md backdrop-blur text-center\">\n            <div>{waveLabel} WAVE</div>\n            <div className=\"text-[8px] text-[#A1A1AA]\">{getTypeRushDirective(gameStateRef.current.waveIndex)}</div>\n          </div>",
    'type directive hud')
type_rush = replace_once(type_rush,
    "            <div\n              key={w.id}\n              className={`absolute pointer-events-none -translate-x-1/2 transition-all duration-75",
    "            <button\n              type=\"button\"\n              key={w.id}\n              onClick={(event) => {\n                event.stopPropagation();\n                const state = gameStateRef.current;\n                const previous = state.words.find((word) => word.id === state.activeWordId);\n                if (previous && previous.id !== w.id) previous.typedIndex = 0;\n                state.activeWordId = w.id;\n                setActiveWordId(w.id);\n                setWords([...state.words]);\n                focusDeviceKeyboard();\n              }}\n              aria-label={`Target ${w.word}`}\n              className={`absolute pointer-events-auto -translate-x-1/2 transition-all duration-75",
    'type clickable target')
type_rush = replace_once(type_rush,
    "                <span className=\"text-white\">{w.word.substring(w.typedIndex)}</span>\n              </span>\n            </div>\n          );\n        })}",
    "                <span className=\"text-white\">{w.word.substring(w.typedIndex)}</span>\n              </span>\n              <span className=\"text-[8px] text-[#71717A]\">{getTypeRushTargetBonus(w.y, w.type, gameStateRef.current.waveIndex).toFixed(1)}x</span>\n            </button>\n          );\n        })}",
    'type target close')
write('src/games/TypeRushGame.tsx', type_rush)

# REGISTRY ------------------------------------------------------------------
registry = read('src/data/games.ts')
registry = replace_once(registry, "description: 'Read authored crystal routes, chain lane-perfect pickups, and graze passing comets for escalating risk-reward bonuses.'" if "Read authored crystal routes" in registry else "description: 'Switch orbital radius and direction to evade deep space debris and collect stellar cores.'", "description: 'Read authored crystal routes, chain lane-perfect pickups, and graze passing comets for escalating risk-reward bonuses.'", 'orbit registry description')
registry = replace_once(registry, "instructions: 'Follow the named crystal route for multiplier chains. Graze comets after they pass for bonus points. Tap/Space pulses lane+direction; Up/Down is lane-only and A/D reverses only.'" if "Follow the named crystal route" in registry else "instructions: 'Tap/Space pulses to shift one lane and reverse direction. Up/Down changes lane only; Left/Right or A/D reverses direction only.'", "instructions: 'Follow the named crystal route for multiplier chains. Graze comets after they pass for bonus points. Tap/Space pulses lane+direction; Up/Down is lane-only and A/D reverses only.'", 'orbit registry instruction')
registry = replace_once(registry, "tagline: 'Drop numbers and trigger chain combos.',\n    description: 'Drop numbered tiles into columns. Matching adjacent values combine and collapse.'", "tagline: 'Plan three tiles ahead and clear escalating merge contracts.',\n    description: 'Use the three-tile preview, limited swaps, and hammer charges to engineer cascades and complete alternating combo/value contracts.'", 'merge registry copy')
registry = replace_once(registry, "instructions: 'Tap column or press 1–4 to drop tiles and merge identical numbers.'", "instructions: 'Read the three-tile queue, choose columns to build cascades, and complete the current contract to recharge tactical tools.'", 'merge registry instruction')
registry = replace_once(registry, "description: 'Defend the perimeter through four escalating typing waves with progressively longer, denser, faster word sets.'", "description: 'Defend four lanes through distinct typing directives: tap a word to lock your target, prioritize urgent or special threats, and cash higher risk for higher multipliers.'", 'type registry description')
registry = replace_once(registry, "instructions: 'Type falling words accurately; four escalating typing waves steadily increase vocabulary length and pressure.'", "instructions: 'Type to auto-lock the most urgent matching word, or tap/click any word to choose it directly. Later waves alter special-word pressure and reward urgent targets more heavily.'", 'type registry instruction')
write('src/data/games.ts', registry)

# PACKAGE / RELEASE ---------------------------------------------------------
pkg = read('package.json')
pkg = replace_once(pkg, '    "quality:gameplay-p4": "bun scripts/audit-gameplay-p4.ts",', '    "quality:gameplay-p4": "bun scripts/audit-gameplay-p4.ts",\n    "quality:gameplay-p5": "bun scripts/audit-gameplay-p5.ts",', 'package p5')
write('package.json', pkg)

release = read('scripts/audit-release-32.ts')
release = replace_once(release, "  'quality:gameplay-p4',", "  'quality:gameplay-p4',\n  'quality:gameplay-p5',", 'release gate')
release = replace_once(release, "  'scripts/audit-gameplay-p4.ts',", "  'scripts/audit-gameplay-p4.ts',\n  'scripts/audit-gameplay-p5.ts',", 'release file')
write('scripts/audit-release-32.ts', release)
