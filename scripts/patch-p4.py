from pathlib import Path
import json

ROOT = Path('.')


def replace_once(path: str, old: str, new: str) -> None:
    p = ROOT / path
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'marker missing in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))


# --- Cyber Serpent: make Ghost Phase strategically meaningful with deterministic firewall progression.
helper = ROOT / 'src/games/snakeExperience.ts'
helper.write_text("""export interface SnakeGridPoint {\n  x: number;\n  y: number;\n}\n\nconst FIREWALL_PATTERNS: readonly (readonly SnakeGridPoint[])[] = [\n  [\n    { x: 6, y: 5 },\n    { x: 6, y: 6 },\n    { x: 6, y: 7 },\n  ],\n  [\n    { x: 14, y: 14 },\n    { x: 15, y: 14 },\n    { x: 16, y: 14 },\n  ],\n  [\n    { x: 15, y: 6 },\n    { x: 15, y: 7 },\n    { x: 15, y: 8 },\n    { x: 15, y: 9 },\n  ],\n  [\n    { x: 5, y: 15 },\n    { x: 6, y: 15 },\n    { x: 7, y: 15 },\n    { x: 8, y: 15 },\n  ],\n];\n\nexport const getSnakeFirewallStage = (snakeLength: number): number =>\n  Math.min(FIREWALL_PATTERNS.length, Math.max(0, Math.floor((snakeLength - 4) / 4)));\n\nexport const getSnakeFirewallCells = (\n  stage: number,\n  blockedKeys: ReadonlySet<string> = new Set<string>(),\n): SnakeGridPoint[] => {\n  const cappedStage = Math.max(0, Math.min(FIREWALL_PATTERNS.length, Math.floor(stage)));\n  const seen = new Set<string>();\n  const cells: SnakeGridPoint[] = [];\n\n  for (const pattern of FIREWALL_PATTERNS.slice(0, cappedStage)) {\n    for (const cell of pattern) {\n      const key = `${cell.x},${cell.y}`;\n      if (blockedKeys.has(key) || seen.has(key)) continue;\n      seen.add(key);\n      cells.push({ ...cell });\n    }\n  }\n\n  return cells;\n};\n""")

replace_once(
    'src/games/SnakeGame.tsx',
    "import { getFrameInvariantDecay, getFrameScale } from '../lib/frameRateRuntime';\n",
    "import { getFrameInvariantDecay, getFrameScale } from '../lib/frameRateRuntime';\nimport { getSnakeFirewallCells, getSnakeFirewallStage } from './snakeExperience';\n",
)
replace_once(
    'src/games/SnakeGame.tsx',
    "  const [combo, setCombo] = useState(0);\n",
    "  const [combo, setCombo] = useState(0);\n  const [firewallStage, setFirewallStage] = useState(0);\n",
)
replace_once(
    'src/games/SnakeGame.tsx',
    "    foods: [] as FoodItem[],\n    particles: [] as Particle[],\n",
    "    foods: [] as FoodItem[],\n    firewalls: [] as Point[],\n    firewallStage: 0,\n    particles: [] as Particle[],\n",
)
replace_once(
    'src/games/SnakeGame.tsx',
    "    state.foods.forEach((f) => occupied.add(`${f.x},${f.y}`));\n",
    "    state.foods.forEach((f) => occupied.add(`${f.x},${f.y}`));\n    state.firewalls.forEach((cell) => occupied.add(`${cell.x},${cell.y}`));\n",
)
replace_once(
    'src/games/SnakeGame.tsx',
    "    const state = gameStateRef.current;\n    state.foods = [];\n    spawnFood('regular');\n",
    "    const state = gameStateRef.current;\n    state.foods = [];\n    state.firewalls = [];\n    state.firewallStage = 0;\n    setFirewallStage(0);\n    spawnFood('regular');\n",
)
replace_once(
    'src/games/SnakeGame.tsx',
    "    // Self collision\n    const selfCollision = state.snake.some(\n",
    "    // Firewall collision. Ghost Phase now has a concrete traversal purpose.\n    const firewallCollision = state.firewalls.some(\n      (cell) => cell.x === newHead.x && cell.y === newHead.y\n    );\n    if (firewallCollision && !isGhost) {\n      state.isAlive = false;\n      state.shake = 16;\n      haptics.gameOver();\n      if (soundEnabled) sounds.playExplosion();\n      addFloatingText('FIREWALL HIT', newHead.x * state.cellSize, newHead.y * state.cellSize, '#F43F5E');\n      setSafeTimeout(() => onGameOver(state.score), 400);\n      return;\n    }\n\n    // Self collision\n    const selfCollision = state.snake.some(\n",
)
replace_once(
    'src/games/SnakeGame.tsx',
    "      // Spawn replacement food\n      spawnFood();\n",
    "      // Every four growth steps adds another short, navigable firewall phrase.\n      const nextFirewallStage = getSnakeFirewallStage(state.snake.length);\n      if (nextFirewallStage > state.firewallStage) {\n        const blocked = new Set<string>();\n        state.snake.forEach((segment) => blocked.add(`${segment.x},${segment.y}`));\n        state.foods.forEach((food) => blocked.add(`${food.x},${food.y}`));\n        state.firewalls = getSnakeFirewallCells(nextFirewallStage, blocked);\n        state.firewallStage = nextFirewallStage;\n        setFirewallStage(nextFirewallStage);\n        addFloatingText(\n          `FIREWALL LEVEL ${nextFirewallStage}`,\n          newHead.x * state.cellSize,\n          newHead.y * state.cellSize - 18,\n          '#F43F5E',\n        );\n        if (soundEnabled) sounds.playTone(300 + nextFirewallStage * 70, 0.09, 'sawtooth');\n      }\n\n      // Spawn replacement food\n      spawnFood();\n",
)
replace_once(
    'src/games/SnakeGame.tsx',
    "      // Food items\n      state.foods.forEach((f) => {\n",
    "      // Firewall cells: short static phrases that can be bypassed with Ghost Phase.\n      state.firewalls.forEach((cell) => {\n        const x = cell.x * state.cellSize;\n        const y = cell.y * state.cellSize;\n        const inset = Math.max(2, state.cellSize * 0.12);\n        ctx.save();\n        ctx.globalAlpha = state.ghostTimer > 0 ? 0.42 : 0.92;\n        ctx.shadowColor = '#F43F5E';\n        ctx.shadowBlur = 10;\n        ctx.fillStyle = 'rgba(244, 63, 94, 0.24)';\n        ctx.fillRect(x + inset, y + inset, state.cellSize - inset * 2, state.cellSize - inset * 2);\n        ctx.strokeStyle = '#F43F5E';\n        ctx.lineWidth = 2;\n        ctx.strokeRect(x + inset, y + inset, state.cellSize - inset * 2, state.cellSize - inset * 2);\n        ctx.beginPath();\n        ctx.moveTo(x + inset + 2, y + state.cellSize - inset - 2);\n        ctx.lineTo(x + state.cellSize - inset - 2, y + inset + 2);\n        ctx.stroke();\n        ctx.restore();\n      });\n\n      // Food items\n      state.foods.forEach((f) => {\n",
)
replace_once(
    'src/games/SnakeGame.tsx',
    "          <span className=\"text-[#71717A]\">|</span>\n\n          {multiplier > 1 && (\n",
    "          <span className=\"text-[#71717A]\">|</span>\n\n          {firewallStage > 0 && (\n            <span className=\"text-rose-400 font-bold\">FW L{firewallStage}</span>\n          )}\n\n          {multiplier > 1 && (\n",
)

# --- Orbit: make the always-visible help match P0's actual pulse semantics.
replace_once(
    'src/games/OrbitGame.tsx',
    "      <div className=\"absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#18181B]/90 border border-[#27272A] px-4 py-2 rounded-2xl font-mono-arcade text-xs text-[#A1A1AA] pointer-events-none\">\n        <span className=\"text-[#38BDF8] font-bold\">TAP / SPACE:</span>\n        <span>SWITCH ORBITAL LANE</span>\n        <span className=\"text-[#71717A]\">|</span>\n        <span className=\"text-[#34D399] font-bold\">A/D / ARROWS:</span>\n        <span>REVERSE</span>\n      </div>\n",
    "      <div className=\"absolute bottom-4 left-1/2 -translate-x-1/2 max-w-[calc(100%-1.5rem)] flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-[#18181B]/90 border border-[#27272A] px-3 py-2 rounded-2xl font-mono-arcade text-[10px] sm:text-xs text-[#A1A1AA] pointer-events-none text-center\">\n        <span className=\"text-[#38BDF8] font-bold\">TAP / SPACE:</span>\n        <span>PULSE = LANE + REVERSE</span>\n        <span className=\"text-[#71717A]\">|</span>\n        <span className=\"text-[#FACC15] font-bold\">↑ / ↓:</span>\n        <span>LANE</span>\n        <span className=\"text-[#71717A]\">|</span>\n        <span className=\"text-[#34D399] font-bold\">A/D / ← / →:</span>\n        <span>REVERSE</span>\n      </div>\n",
)

# --- Chain: expose tool purpose to touch users instead of relying on hover titles.
replace_once(
    'src/games/ChainGame.tsx',
    "  const progressPercent = Math.min(100, Math.round((chainCount / targetMin) * 100));\n\n  return (\n",
    "  const progressPercent = Math.min(100, Math.round((chainCount / targetMin) * 100));\n  const toolPurpose =\n    selectedTool === 'plasma'\n      ? 'PLASMA — BREAK SHIELDS / NULLIFIERS'\n      : selectedTool === 'tesla'\n      ? 'TESLA — BRIDGE DISTANT ORBS'\n      : 'CRYO — PULL ORBS INTO A CLUSTER';\n\n  return (\n",
)
replace_once(
    'src/games/ChainGame.tsx',
    "      {/* Tactical Detonator Selector with Distinct Purpose Descriptions */}\n      <div className=\"absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-2 bg-[#18181B]/95 border border-[#27272A] p-1 sm:p-1.5 rounded-2xl shadow-2xl z-20\">\n",
    "      <div className=\"absolute bottom-14 left-1/2 -translate-x-1/2 max-w-[calc(100%-1rem)] px-3 py-1 rounded-full bg-black/60 border border-white/10 font-mono-arcade text-[9px] sm:text-[10px] text-[#D4D4D8] whitespace-nowrap pointer-events-none z-20\">\n        {toolPurpose}\n      </div>\n\n      {/* Tactical Detonator Selector with Distinct Purpose Descriptions */}\n      <div className=\"absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-2 bg-[#18181B]/95 border border-[#27272A] p-1 sm:p-1.5 rounded-2xl shadow-2xl z-20\">\n",
)

# --- One Line: teach the real ramp/ink/star loop rather than imply endpoint tracing.
replace_once(
    'src/games/OneLineGame.tsx',
    "          <span>DRAW A LINE TO GUIDE THE BALL INTO THE GREEN GOAL</span>\n",
    "          <span>DRAW ONE RAMP • RELEASE TO RUN PHYSICS • STARS ARE OPTIONAL</span>\n",
)

# --- Registry: first-run copy must describe the mechanics players actually receive.
replace_once(
    'src/data/games.ts',
    "    description: 'Laser paddle physics, sparks, multi-hit bricks, and fast-paced explosive clearances.',\n",
    "    description: 'Shatter multi-hit bricks and catch marked drops for Multiball, Laser, Wide Paddle, Fireball, and score boosts.',\n",
)
replace_once(
    'src/data/games.ts',
    "    instructions: 'Move paddle horizontally to bounce the ball and shatter bricks.',\n",
    "    instructions: 'Move the paddle to keep balls alive. Break marked bricks and catch their falling powerups to reshape each run.',\n",
)
replace_once(
    'src/data/games.ts',
    "    description: 'Draw a single stroke ramp. Release to let realistic 2D gravity roll the ball into the portal.',\n",
    "    description: 'Spend a limited ink budget on one physical ramp, release the ball, exploit walls/bouncers, and optionally collect three stars before the portal.',\n",
)
replace_once(
    'src/data/games.ts',
    "    instructions: 'Draw one line from start to finish, then release.',\n",
    "    instructions: 'Draw one continuous ramp with limited ink, then release to run physics. Guide the ball into the portal; stars are optional bonus targets.',\n",
)
replace_once(
    'src/data/games.ts',
    "    tagline: 'Detonate one spark for a massive cascade.',\n    description: 'Place a single blast wave. Watch bouncing particles trigger an enormous multi-stage chain reaction.',\n    category: 'Strategy',\n    sessionLength: '1 min',\n",
    "    tagline: 'Spend three tactical detonations to engineer the biggest cascade.',\n    description: 'Choose Plasma to break shields, Tesla to bridge distant orbs, or Cryo to cluster targets, then spend three charges to hit each wave goal.',\n    category: 'Strategy',\n    sessionLength: '1–3 min',\n",
)
replace_once(
    'src/data/games.ts',
    "    instructions: 'Tap anywhere once to spawn the initial detonation.',\n    controlsHint: 'Click / Tap',\n",
    "    instructions: 'Select Plasma, Tesla, or Cryo for a distinct tactical effect, then place up to three detonations to reach the wave target and exploit special orbs.',\n    controlsHint: 'Select Tool • Click / Tap Arena • 3 Charges',\n",
)
replace_once(
    'src/data/games.ts',
    "    tagline: 'Navigate the grid, collect energy cores, and phase through obstacles.',\n    description: 'Control an electric cyber serpent across a neon grid matrix. Collect energy orbs, activate Ghost Phase to pass through barriers, grab 2x multipliers, and dodge the lethal laser perimeter.',\n",
    "    tagline: 'Grow through an evolving grid and phase through firewall barriers.',\n    description: 'Control an electric cyber serpent through wraparound portals as short firewall phrases appear every four growth steps. Ghost Phase lets you pass through firewalls and your own body while multipliers reward aggressive routes.',\n",
)
replace_once(
    'src/data/games.ts',
    "    instructions: 'Use Arrow Keys / WASD or swipe to steer. Eat orbs to grow and trigger ghost powerups.',\n",
    "    instructions: 'Use Arrow Keys / WASD or swipe to steer. Every four growth steps adds firewall cells; collect Ghost Phase to pass through firewalls and yourself.',\n",
)

# --- Permanent P4 regression audit.
audit = ROOT / 'scripts/audit-gameplay-p4.ts'
audit.write_text("""import { readFileSync } from 'node:fs';\nimport { getSnakeFirewallCells, getSnakeFirewallStage } from '../src/games/snakeExperience';\n\nconst read = (path: string) => readFileSync(path, 'utf8');\nconst errors: string[] = [];\nconst assert = (condition: boolean, message: string) => {\n  if (!condition) errors.push(message);\n};\n\nconst snake = read('src/games/SnakeGame.tsx');\nconst orbit = read('src/games/OrbitGame.tsx');\nconst chain = read('src/games/ChainGame.tsx');\nconst oneline = read('src/games/OneLineGame.tsx');\nconst registry = read('src/data/games.ts');\n\nconst expectedStages = new Map<number, number>([\n  [4, 0], [7, 0], [8, 1], [12, 2], [16, 3], [20, 4], [99, 4],\n]);\nfor (const [length, stage] of expectedStages) {\n  assert(getSnakeFirewallStage(length) === stage, `snake length ${length} should map to firewall stage ${stage}`);\n}\n\nconst allCells = getSnakeFirewallCells(4);\nassert(allCells.length === 14, `expected 14 total firewall cells, found ${allCells.length}`);\nassert(new Set(allCells.map((cell) => `${cell.x},${cell.y}`)).size === allCells.length, 'firewall patterns contain duplicate cells');\nassert(allCells.every((cell) => cell.x > 0 && cell.x < 21 && cell.y > 0 && cell.y < 21), 'firewalls must stay inside the 22x22 grid interior');\nconst blocked = new Set(['6,5', '15,14']);\nconst filtered = getSnakeFirewallCells(4, blocked);\nassert(filtered.length === 12, 'blocked snake/food cells must be removed from firewall rebuilds');\nassert(filtered.every((cell) => !blocked.has(`${cell.x},${cell.y}`)), 'firewall rebuild placed a cell on blocked occupancy');\nassert(snake.includes('firewallCollision && !isGhost'), 'Cyber Serpent does not make Ghost Phase bypass firewalls');\nassert(snake.includes('getSnakeFirewallStage(state.snake.length)'), 'Cyber Serpent firewall progression is not tied to growth');\nassert(snake.includes('FW L{firewallStage}'), 'Cyber Serpent does not surface firewall progression in the HUD');\n\nassert(orbit.includes('PULSE = LANE + REVERSE'), 'Orbit always-visible control help does not explain Pulse semantics');\nassert(orbit.includes('↑ / ↓:'), 'Orbit help does not distinguish lane-only controls');\n\nassert(chain.includes('PLASMA — BREAK SHIELDS / NULLIFIERS'), 'Chain lacks visible Plasma purpose teaching');\nassert(chain.includes('TESLA — BRIDGE DISTANT ORBS'), 'Chain lacks visible Tesla purpose teaching');\nassert(chain.includes('CRYO — PULL ORBS INTO A CLUSTER'), 'Chain lacks visible Cryo purpose teaching');\nassert(registry.includes('Spend three tactical detonations to engineer the biggest cascade.'), 'Chain registry still undersells the three-charge tactical loop');\nassert(!registry.includes('Tap anywhere once to spawn the initial detonation.'), 'stale one-tap Chain instruction remains');\n\nfor (const term of ['Multiball', 'Laser', 'Wide Paddle', 'Fireball']) {\n  assert(registry.includes(term), `Breakout first-run copy does not expose ${term}`);\n}\nassert(registry.includes('limited ink budget'), 'One Line copy does not explain its ink constraint');\nassert(registry.includes('stars are optional bonus targets'), 'One Line copy does not explain optional star mastery');\nassert(oneline.includes('RELEASE TO RUN PHYSICS'), 'One Line in-game hint does not explain the draw/release state transition');\n\nassert(registry.includes('firewall phrases appear every four growth steps'), 'Cyber Serpent registry does not explain firewall progression');\nassert(!registry.includes('dodge the lethal laser perimeter'), 'Cyber Serpent still advertises a nonexistent lethal perimeter');\n\nif (errors.length) {\n  console.error('P4 EXPERIENTIAL GAMEPLAY QUALITY AUDIT — FAIL');\n  for (const error of errors) console.error(`- ${error}`);\n  process.exit(1);\n}\n\nconsole.log('P4 EXPERIENTIAL GAMEPLAY QUALITY AUDIT — PASS');\nconsole.log('Snake firewall mastery, Orbit control teaching, Chain tactical teaching, Breakout powerup clarity, and One Line draw/physics clarity are certified.');\n""")

# package.json
pkg_path = ROOT / 'package.json'
pkg = json.loads(pkg_path.read_text())
scripts = pkg.setdefault('scripts', {})
scripts['quality:gameplay-p4'] = 'bun scripts/audit-gameplay-p4.ts'
pkg_path.write_text(json.dumps(pkg, indent=2) + '\n')

# Final release audit must require P4 and its file.
replace_once(
    'scripts/audit-release-32.ts',
    "  'quality:gameplay-p2',\n  'quality:browser-p3',\n",
    "  'quality:gameplay-p2',\n  'quality:gameplay-p4',\n  'quality:browser-p3',\n",
)
replace_once(
    'scripts/audit-release-32.ts',
    "  'scripts/audit-gameplay-p2.ts',\n  'scripts/audit-browser-gameplay-p3.mjs',\n",
    "  'scripts/audit-gameplay-p2.ts',\n  'scripts/audit-gameplay-p4.ts',\n  'scripts/audit-browser-gameplay-p3.mjs',\n",
)

print('P4 experiential patch applied')
