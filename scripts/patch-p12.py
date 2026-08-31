from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 marker, found {count}')
    p.write_text(text.replace(old, new, 1))


# Laser Rope — earned Redline risk/reward window.
replace_once(
    'src/games/LaserRopeGame.tsx',
    "import { getFrameInvariantBlend } from '../lib/frameRateRuntime';\n",
    "import { getFrameInvariantBlend } from '../lib/frameRateRuntime';\nimport {\n  LASER_ROPE_REDLINE_DURATION_SEC,\n  canActivateLaserRopeRedline,\n  getLaserRopeRedlineCharges,\n  getLaserRopeRedlineReward,\n  getLaserRopeRedlineSpeed,\n} from '../lib/laserRopeRedline';\n",
    'rope import',
)
replace_once(
    'src/games/LaserRopeGame.tsx',
    "    laserMode: 'LOW' as 'LOW' | 'HIGH' | 'DUAL',\n  }, 80);",
    "    laserMode: 'LOW' as 'LOW' | 'HIGH' | 'DUAL',\n    redlineCharges: 1,\n    redlineActive: false,\n    redlinePercent: 0,\n  }, 80);",
    'rope hud state',
)
replace_once(
    'src/games/LaserRopeGame.tsx',
    "    isFeverActive: false,\n    feverDuration: 0,\n\n    // Collectibles",
    "    isFeverActive: false,\n    feverDuration: 0,\n\n    // P12 Redline mastery: voluntarily trade speed for a larger payout.\n    redlineCharges: 1,\n    redlineActive: false,\n    redlineTimer: 0,\n\n    // Collectibles",
    'rope gameplay state',
)
replace_once(
    'src/games/LaserRopeGame.tsx',
    "  useEffect(() => {\n    const handleKeyDown = (e: KeyboardEvent) => {",
    "  const triggerRedline = () => {\n    const state = gameStateRef.current;\n    if (isPausedRef.current || !canActivateLaserRopeRedline(state.redlineCharges, state.redlineActive, state.isAlive)) return;\n    state.redlineCharges--;\n    state.redlineActive = true;\n    state.redlineTimer = LASER_ROPE_REDLINE_DURATION_SEC;\n    if (soundEnabled) sounds.playFeverMode();\n  };\n\n  useEffect(() => {\n    const handleKeyDown = (e: KeyboardEvent) => {",
    'rope trigger',
)
replace_once(
    'src/games/LaserRopeGame.tsx',
    "      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {\n        e.preventDefault();\n        triggerSlide();\n      }\n",
    "      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {\n        e.preventDefault();\n        triggerSlide();\n      } else if (e.code === 'KeyF' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {\n        e.preventDefault();\n        triggerRedline();\n      }\n",
    'rope keyboard',
)
replace_once(
    'src/games/LaserRopeGame.tsx',
    "        // Jump & Slide physics\n",
    "        if (state.redlineActive) {\n          state.redlineTimer -= dt;\n          if (state.redlineTimer <= 0) {\n            state.redlineTimer = 0;\n            state.redlineActive = false;\n          }\n        }\n\n        // Jump & Slide physics\n",
    'rope redline timer',
)
replace_once(
    'src/games/LaserRopeGame.tsx',
    "        const effectiveSpeed = state.isFeverActive ? state.sweepSpeed * 0.75 : state.sweepSpeed;\n        const sweepSmoothing = 1 - Math.pow(0.92, dt * 60);\n        state.sweepSpeed += (state.speedTarget - state.sweepSpeed) * sweepSmoothing;\n\n        const prevAngle = state.sweepAngle;\n        state.sweepAngle += effectiveSpeed * state.direction * dt;",
    "        const effectiveSpeed = state.isFeverActive ? state.sweepSpeed * 0.75 : state.sweepSpeed;\n        const sweepSmoothing = 1 - Math.pow(0.92, dt * 60);\n        state.sweepSpeed += (state.speedTarget - state.sweepSpeed) * sweepSmoothing;\n\n        const prevAngle = state.sweepAngle;\n        if (state.redlineActive) {\n          const redlineExtraSpeed = getLaserRopeRedlineSpeed(effectiveSpeed, true) - effectiveSpeed;\n          state.sweepAngle += redlineExtraSpeed * state.direction * dt;\n        }\n        state.sweepAngle += effectiveSpeed * state.direction * dt;",
    'rope redline speed',
)
replace_once(
    'src/games/LaserRopeGame.tsx',
    "              state.jumpStreak++;\n              state.feverCharge = Math.min(100, state.feverCharge + 15);",
    "              state.jumpStreak++;\n              state.redlineCharges = getLaserRopeRedlineCharges(state.jumpStreak, state.redlineCharges);\n              state.feverCharge = Math.min(100, state.feverCharge + 15);",
    'rope charge earn',
)
replace_once(
    'src/games/LaserRopeGame.tsx',
    "              const basePts = 150;\n              const feverMult = state.isFeverActive ? 2 : 1;\n              const earnedPts = basePts * state.multiplier * feverMult;",
    "              const basePts = 150;\n              const feverMult = state.isFeverActive ? 2 : 1;\n              const earnedPts = getLaserRopeRedlineReward(\n                basePts,\n                state.multiplier,\n                feverMult,\n                state.redlineActive,\n              );",
    'rope reward',
)
replace_once(
    'src/games/LaserRopeGame.tsx',
    "        const feverPercent = state.isFeverActive\n          ? Math.round((state.feverDuration / 6.0) * 100)\n          : Math.round(state.feverCharge);\n\n        if (",
    "        const feverPercent = state.isFeverActive\n          ? Math.round((state.feverDuration / 6.0) * 100)\n          : Math.round(state.feverCharge);\n        const redlinePercent = state.redlineActive\n          ? Math.round((state.redlineTimer / LASER_ROPE_REDLINE_DURATION_SEC) * 100)\n          : 0;\n\n        if (",
    'rope hud percent',
)
replace_once(
    'src/games/LaserRopeGame.tsx',
    "          prev.hasShield === state.hasShield &&\n          prev.laserMode === state.laserMode\n",
    "          prev.hasShield === state.hasShield &&\n          prev.laserMode === state.laserMode &&\n          prev.redlineCharges === state.redlineCharges &&\n          prev.redlineActive === state.redlineActive &&\n          prev.redlinePercent === redlinePercent\n",
    'rope hud compare',
)
replace_once(
    'src/games/LaserRopeGame.tsx',
    "          hasShield: state.hasShield,\n          laserMode: state.laserMode,\n        };",
    "          hasShield: state.hasShield,\n          laserMode: state.laserMode,\n          redlineCharges: state.redlineCharges,\n          redlineActive: state.redlineActive,\n          redlinePercent,\n        };",
    'rope hud publish',
)
replace_once(
    'src/games/LaserRopeGame.tsx',
    "      <canvas ref={canvasRef} className=\"w-full h-full min-h-0 block\" />\n\n      {/* On-screen Jump & Slide Controls */}",
    "      <canvas ref={canvasRef} className=\"w-full h-full min-h-0 block\" />\n\n      <button\n        type=\"button\"\n        onClick={(e) => {\n          e.stopPropagation();\n          triggerRedline();\n        }}\n        disabled={hudState.redlineCharges <= 0 || hudState.redlineActive}\n        className=\"absolute bottom-16 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-400/60 text-rose-200 font-mono text-[10px] font-black disabled:opacity-45 pointer-events-auto\"\n        aria-label=\"Activate Redline\"\n      >\n        {hudState.redlineActive ? `REDLINE ${hudState.redlinePercent}%` : `REDLINE (${hudState.redlineCharges}) · F/SHIFT`}\n      </button>\n\n      {/* On-screen Jump & Slide Controls */}",
    'rope redline button',
)

# Gravity Tower — precision landings earn optional Apex Drive.
replace_once(
    'src/games/TowerGame.tsx',
    "import { TOWER_FIXED_STEP_SEC, getTowerPhysicsStepBatch } from '../lib/towerRuntime';\n",
    "import { TOWER_FIXED_STEP_SEC, getTowerPhysicsStepBatch } from '../lib/towerRuntime';\nimport {\n  TOWER_APEX_DURATION_SEC,\n  canActivateTowerApexDrive,\n  getTowerApexBounceVelocity,\n  getTowerApexCharges,\n  getTowerApexReward,\n  getTowerPrecisionBonus,\n  isTowerPrecisionLanding,\n} from '../lib/towerApexMastery';\n",
    'tower import',
)
replace_once(
    'src/games/TowerGame.tsx',
    "    multiplier: 1,\n  }, 100);",
    "    multiplier: 1,\n    apexCharges: 1,\n    apexActive: false,\n    apexPercent: 0,\n    apexStreak: 0,\n  }, 100);",
    'tower hud state',
)
replace_once(
    'src/games/TowerGame.tsx',
    "    comboBounces: 0,\n    multiplier: 1,\n\n    // World & Camera",
    "    comboBounces: 0,\n    multiplier: 1,\n    apexCharges: 1,\n    apexActive: false,\n    apexTimer: 0,\n    apexPrecisionStreak: 0,\n\n    // World & Camera",
    'tower game state',
)
replace_once(
    'src/games/TowerGame.tsx',
    "  // Keyboard controls\n  useEffect(() => {",
    "  const triggerApexDrive = () => {\n    const state = gameStateRef.current;\n    if (isPausedRef.current || !canActivateTowerApexDrive(state.apexCharges, state.apexActive, state.isAlive)) return;\n    state.apexCharges--;\n    state.apexActive = true;\n    state.apexTimer = TOWER_APEX_DURATION_SEC;\n    if (soundEnabled) sounds.playFeverMode();\n  };\n\n  // Keyboard controls\n  useEffect(() => {",
    'tower trigger',
)
replace_once(
    'src/games/TowerGame.tsx',
    "      if ((e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') && state.isAlive) {",
    "      if (e.code === 'KeyF' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {\n        e.preventDefault();\n        triggerApexDrive();\n      }\n      if ((e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') && state.isAlive) {",
    'tower keyboard',
)
replace_once(
    'src/games/TowerGame.tsx',
    "        // Screen Shake decay\n",
    "        if (state.apexActive) {\n          state.apexTimer -= dt;\n          if (state.apexTimer <= 0) {\n            state.apexTimer = 0;\n            state.apexActive = false;\n          }\n        }\n\n        // Screen Shake decay\n",
    'tower timer',
)
replace_once(
    'src/games/TowerGame.tsx',
    "              state.py = platTop + state.radius;\n\n              if (plat.type === 'spring') {",
    "              state.py = platTop + state.radius;\n\n              const precisionLanding = isTowerPrecisionLanding(state.px, plat.x, plat.w);\n              if (precisionLanding) {\n                state.apexPrecisionStreak++;\n                state.apexCharges = getTowerApexCharges(state.apexPrecisionStreak, state.apexCharges);\n                const precisionBonus = getTowerApexReward(\n                  getTowerPrecisionBonus(state.apexPrecisionStreak),\n                  state.apexActive,\n                );\n                state.score += precisionBonus;\n                publishScore(state.score);\n                state.popups.push({\n                  id: state.nextId++,\n                  x: state.px,\n                  y: state.py + 34,\n                  text: `APEX x${state.apexPrecisionStreak} +${precisionBonus}`,\n                  color: '#FACC15',\n                  life: 1.0,\n                });\n              } else {\n                state.apexPrecisionStreak = 0;\n              }\n\n              if (plat.type === 'spring') {",
    'tower precision landing',
)
replace_once('src/games/TowerGame.tsx', "                state.vy = 23;\n", "                state.vy = getTowerApexBounceVelocity(23, state.apexActive);\n", 'tower spring bounce')
replace_once('src/games/TowerGame.tsx', "                state.vy = 13.5;\n", "                state.vy = getTowerApexBounceVelocity(13.5, state.apexActive);\n", 'tower crumble bounce')
replace_once('src/games/TowerGame.tsx', "                state.vy = 13.8;\n", "                state.vy = getTowerApexBounceVelocity(13.8, state.apexActive);\n", 'tower normal bounce')
replace_once(
    'src/games/TowerGame.tsx',
    "          state.score += deltaAlt * 2;\n          publishScore(state.score);",
    "          state.score += getTowerApexReward(deltaAlt * 2, state.apexActive);\n          publishScore(state.score);",
    'tower altitude reward',
)
replace_once(
    'src/games/TowerGame.tsx',
    "    state.magnetActive = false;\n    state.physicsAccumulator = 0;",
    "    state.magnetActive = false;\n    state.apexCharges = 1;\n    state.apexActive = false;\n    state.apexTimer = 0;\n    state.apexPrecisionStreak = 0;\n    state.physicsAccumulator = 0;",
    'tower reset',
)
replace_once(
    'src/games/TowerGame.tsx',
    "        comboStreak: state.comboBounces,\n        multiplier: state.multiplier,\n      });",
    "        comboStreak: state.comboBounces,\n        multiplier: state.multiplier,\n        apexCharges: state.apexCharges,\n        apexActive: state.apexActive,\n        apexPercent: state.apexActive ? Math.round((state.apexTimer / TOWER_APEX_DURATION_SEC) * 100) : 0,\n        apexStreak: state.apexPrecisionStreak,\n      });",
    'tower hud publish',
)
replace_once(
    'src/games/TowerGame.tsx',
    "      {/* Main Canvas */}\n      <canvas ref={canvasRef} className=\"w-full h-full block cursor-pointer\" />\n\n      {/* Controls Overlay Helper */}",
    "      {/* Main Canvas */}\n      <canvas ref={canvasRef} className=\"w-full h-full block cursor-pointer\" />\n\n      <button\n        type=\"button\"\n        onPointerDown={(e) => e.stopPropagation()}\n        onClick={(e) => {\n          e.stopPropagation();\n          triggerApexDrive();\n        }}\n        disabled={hudState.apexCharges <= 0 || hudState.apexActive}\n        className=\"absolute bottom-10 right-3 z-20 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/60 text-amber-200 font-mono text-[10px] font-black disabled:opacity-45 pointer-events-auto\"\n        aria-label=\"Activate Apex Drive\"\n      >\n        {hudState.apexActive ? `APEX ${hudState.apexPercent}%` : `APEX (${hudState.apexCharges}) · F/SHIFT`}\n      </button>\n\n      {/* Controls Overlay Helper */}",
    'tower button',
)
replace_once(
    'src/games/TowerGame.tsx',
    " • Stomp Drones</span>",
    " • Stomp Drones • Precision centers earn Apex</span>",
    'tower controls teaching',
)

# Chain — rotating three-tool Resonance Orders.
replace_once(
    'src/games/ChainGame.tsx',
    "import { getArcadeStepBatch, getFrameScale } from '../lib/frameRateRuntime';\n",
    "import { getArcadeStepBatch, getFrameScale } from '../lib/frameRateRuntime';\nimport {\n  advanceChainResonance,\n  formatChainResonanceTool,\n  getChainResonanceBonus,\n  getChainResonanceOrder,\n  isChainResonanceComplete,\n} from '../lib/chainResonanceMastery';\n",
    'chain import',
)
replace_once(
    'src/games/ChainGame.tsx',
    "  const [comboBanner, setComboBanner] = useState<string | null>(null);\n",
    "  const [comboBanner, setComboBanner] = useState<string | null>(null);\n  const [resonanceStep, setResonanceStep] = useState(0);\n  const [resonanceChain, setResonanceChain] = useState(0);\n  const [resonanceFailed, setResonanceFailed] = useState(false);\n",
    'chain react state',
)
replace_once(
    'src/games/ChainGame.tsx',
    "    selectedTool: 'plasma' as DetonatorTool,\n    viewportWidth: 400,",
    "    selectedTool: 'plasma' as DetonatorTool,\n    resonanceStep: 0,\n    resonanceChain: 0,\n    resonanceFailed: false,\n    viewportWidth: 400,",
    'chain game state',
)
replace_once(
    'src/games/ChainGame.tsx',
    "    const tool = state.selectedTool;\n\n    if (tool === 'plasma') {",
    "    const tool = state.selectedTool;\n    const nextResonance = advanceChainResonance(\n      state.wave,\n      { step: state.resonanceStep, failed: state.resonanceFailed },\n      tool,\n    );\n    state.resonanceStep = nextResonance.step;\n    state.resonanceFailed = nextResonance.failed;\n    setResonanceStep(nextResonance.step);\n    setResonanceFailed(nextResonance.failed);\n\n    if (tool === 'plasma') {",
    'chain progress trigger',
)
replace_once(
    'src/games/ChainGame.tsx',
    "    state.physicsAccumulator = 0;\n    state.particles = initParticles(400, 600, 1);",
    "    state.physicsAccumulator = 0;\n    state.resonanceStep = 0;\n    state.resonanceChain = 0;\n    state.resonanceFailed = false;\n    state.particles = initParticles(400, 600, 1);",
    'chain reset state',
)
replace_once(
    'src/games/ChainGame.tsx',
    "    setChainCount(0);\n    setWave(1);\n",
    "    setChainCount(0);\n    setWave(1);\n    setResonanceStep(0);\n    setResonanceChain(0);\n    setResonanceFailed(false);\n",
    'chain reset ui',
)
replace_once(
    'src/games/ChainGame.tsx',
    "            const chargeBonus = state.chargesLeft * 1200;\n            const wipeBonus = allOrbsCleared ? 2500 : 0;\n            const waveBonus = state.chainCount * 250 + chargeBonus + wipeBonus;\n            state.score += waveBonus;",
    "            const resonanceComplete = isChainResonanceComplete({\n              step: state.resonanceStep,\n              failed: state.resonanceFailed,\n            });\n            state.resonanceChain = resonanceComplete ? state.resonanceChain + 1 : 0;\n            const resonanceBonus = resonanceComplete\n              ? getChainResonanceBonus(state.resonanceChain)\n              : 0;\n            setResonanceChain(state.resonanceChain);\n\n            const chargeBonus = state.chargesLeft * 1200;\n            const wipeBonus = allOrbsCleared ? 2500 : 0;\n            const waveBonus = state.chainCount * 250 + chargeBonus + wipeBonus + resonanceBonus;\n            state.score += waveBonus;",
    'chain wave reward',
)
replace_once(
    'src/games/ChainGame.tsx',
    "              state.chainCount = 0;\n              state.lightningArcs = [];\n              state.vortexes = [];\n              setChargesLeft(3);\n              setChainCount(0);",
    "              state.chainCount = 0;\n              state.resonanceStep = 0;\n              state.resonanceFailed = false;\n              state.lightningArcs = [];\n              state.vortexes = [];\n              setChargesLeft(3);\n              setChainCount(0);\n              setResonanceStep(0);\n              setResonanceFailed(false);",
    'chain next wave reset',
)
replace_once(
    'src/games/ChainGame.tsx',
    "  const progressPercent = Math.min(100, Math.round((chainCount / targetMin) * 100));\n  const toolPurpose =",
    "  const progressPercent = Math.min(100, Math.round((chainCount / targetMin) * 100));\n  const resonanceOrder = getChainResonanceOrder(wave);\n  const resonanceLabel = resonanceOrder.order.map(formatChainResonanceTool).join(' → ');\n  const toolPurpose =",
    'chain resonance display data',
)
replace_once(
    'src/games/ChainGame.tsx',
    "      {/* Wave Clear / Combo Banner */}\n",
    "      <div className=\"absolute top-14 left-1/2 -translate-x-1/2 max-w-[calc(100%-1rem)] px-3 py-1 rounded-full bg-black/70 border border-fuchsia-400/30 font-mono-arcade text-[9px] sm:text-[10px] text-fuchsia-200 whitespace-nowrap pointer-events-none z-20\">\n        RESONANCE {resonanceOrder.name}: {resonanceLabel} · {resonanceFailed ? 'BROKEN' : `${resonanceStep}/3`} · CHAIN x{Math.max(1, resonanceChain)}\n      </div>\n\n      {/* Wave Clear / Combo Banner */}\n",
    'chain resonance hud',
)

# Registry teaching — preserve prior exact contractual phrases while adding P12 systems.
replace_once(
    'src/data/games.ts',
    "description: 'Choose Plasma to break shields, Tesla to bridge distant orbs, or Cryo to cluster targets, then spend three charges to hit each wave goal.',",
    "description: 'Choose Plasma to break shields, Tesla to bridge distant orbs, or Cryo to cluster targets, then spend three charges to hit each wave goal while optional rotating Resonance Orders reward deliberate three-tool sequencing.',",
    'registry chain description',
)
replace_once(
    'src/data/games.ts',
    "instructions: 'Select Plasma, Tesla, or Cryo for a distinct tactical effect, then place up to three detonations to reach the wave target and exploit special orbs.',",
    "instructions: 'Select Plasma, Tesla, or Cryo for a distinct tactical effect, then place up to three detonations to reach the wave target and exploit special orbs. Match the visible Resonance Order for an optional streak bonus.',",
    'registry chain instructions',
)
replace_once(
    'src/data/games.ts',
    "description: 'Ascend an infinite vertical cyber tower by bouncing across neon platforms. Dodge glitch hazards, trigger high-altitude super springs, ride anti-gravity jetpacks, and stay ahead of the rising laser death field.',",
    "description: 'Ascend an infinite vertical cyber tower through varied platforms, drones and powerups; precision center landings earn Apex Drive charges for optional higher-bounce, double-reward ascent windows.',",
    'registry tower description',
)
replace_once(
    'src/data/games.ts',
    "instructions: 'Steer with A/D, Left/Right Arrows, or touch screen halves to land on platforms and bounce upward. Space for micro-boost.',",
    "instructions: 'Steer with A/D, Left/Right Arrows, or touch screen halves to land on platforms and bounce upward. Center landings build Apex charges; press F/Shift or tap Apex for a faster high-reward ascent window. Space remains the micro-boost/wall-jump control.',",
    'registry tower instructions',
)
replace_once(
    'src/data/games.ts',
    "controlsHint: 'A / D • Left/Right Arrow • Touch Halves • [Space]',",
    "controlsHint: 'A / D • Left/Right • Touch Halves • Space • F/Shift: Apex',",
    'registry tower controls',
)
replace_once(
    'src/data/games.ts',
    "description: 'Stand on the central energy hub and leap over rotating neon laser sweeps. Master the timing as RPM accelerates, adapt to sudden direction flips, and chain perfect clearance streaks.',",
    "description: 'Jump, slide and double-jump through LOW, HIGH and DUAL sweeps; sustained clean evasions earn Redline charges that can be spent on faster, double-reward mastery windows.',",
    'registry rope description',
)
replace_once(
    'src/data/games.ts',
    "instructions: 'Jump LOW and DUAL sweeps with Space, W, Arrow Up, or the Jump button. Slide under HIGH sweeps with S, Arrow Down, or the Slide button. Watch the warning rings before patterns change.',",
    "instructions: 'Jump LOW and DUAL sweeps with Space, W, Arrow Up, or the Jump button. Slide under HIGH sweeps with S, Arrow Down, or the Slide button. Every five clean evasions earns Redline; press F/Shift or tap Redline for four seconds of faster 2x-reward play.',",
    'registry rope instructions',
)
replace_once(
    'src/data/games.ts',
    "controlsHint: 'Jump: Space / W / ↑ • Slide: S / ↓ • Tap Buttons',",
    "controlsHint: 'Jump: Space/W/↑ • Slide: S/↓ • F/Shift: Redline • Tap',",
    'registry rope controls',
)

print('P12 source patch applied')
