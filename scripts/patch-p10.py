from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one marker, found {count}')
    p.write_text(text.replace(old, new, 1))

# Dodge — make the existing 260ms dash an offensive mastery window.
path = 'src/games/DodgeGame.tsx'
replace_once(path,
"import { ARCADE_FIXED_STEP_SEC, getArcadeStepBatch, getFrameInvariantDecay, getFrameScale } from '../lib/frameRateRuntime';",
"import { ARCADE_FIXED_STEP_SEC, getArcadeStepBatch, getFrameInvariantDecay, getFrameScale } from '../lib/frameRateRuntime';\nimport {\n  DODGE_PHASE_CUT_MAX_CHAIN,\n  getDodgePhaseCutRechargeMs,\n  getDodgePhaseCutReward,\n  isDodgePhaseCut,\n} from '../lib/dodgeMastery';",
'Dodge mastery import')
replace_once(path,
"  laserTimer?: number;\n}",
"  laserTimer?: number;\n  phaseCut?: boolean;\n}",
'Dodge hazard phaseCut')
replace_once(path,
"  const [dashAvailable, setDashAvailable] = useState(2);",
"  const [dashAvailable, setDashAvailable] = useState(2);\n  const [phaseCutChain, setPhaseCutChain] = useState(0);",
'Dodge phase HUD state')
replace_once(path,
"    dashTimer: 0,\n    ghostTrail:",
"    dashTimer: 0,\n    dashCutCount: 0,\n    phaseCutChain: 0,\n    ghostTrail:",
'Dodge phase fields')
replace_once(path,
"    state.dashCharges--;\n    setDashAvailable(state.dashCharges);\n    state.isDashing = true;",
"    state.dashCharges--;\n    setDashAvailable(state.dashCharges);\n    state.dashCutCount = 0;\n    state.isDashing = true;",
'Dodge dash start')
replace_once(path,
"  const setSafeTimeout = useSafeTimeout();",
"  const registerPhaseCut = (x: number, y: number, color: string) => {\n    const state = gameStateRef.current;\n    state.dashCutCount++;\n    state.phaseCutChain = Math.min(DODGE_PHASE_CUT_MAX_CHAIN, state.phaseCutChain + 1);\n    const reward = getDodgePhaseCutReward(state.phaseCutChain);\n    state.score += reward;\n    state.dashRecharge += getDodgePhaseCutRechargeMs(state.phaseCutChain);\n    publishScore(state.score);\n    setPhaseCutChain(state.phaseCutChain);\n    for (let i = 0; i < 10; i++) {\n      const ang = Math.random() * Math.PI * 2;\n      state.particles.push({\n        x, y,\n        vx: Math.cos(ang) * (2 + Math.random() * 4),\n        vy: Math.sin(ang) * (2 + Math.random() * 4),\n        color, size: 2.8, life: 0, maxLife: 18,\n      });\n    }\n    if (soundEnabled) sounds.playSuccess();\n  };\n\n  const setSafeTimeout = useSafeTimeout();",
'Dodge register phase cut')
replace_once(path,
"    state.dashRecharge = 0;\n    state.slowMoTimer = 0;",
"    state.dashRecharge = 0;\n    state.dashCutCount = 0;\n    state.phaseCutChain = 0;\n    setPhaseCutChain(0);\n    state.slowMoTimer = 0;",
'Dodge reset phase')
replace_once(path,
"          if (state.dashTimer <= 0) {\n            state.isDashing = false;\n          }",
"          if (state.dashTimer <= 0) {\n            state.isDashing = false;\n            if (state.dashCutCount === 0) {\n              state.phaseCutChain = 0;\n              setPhaseCutChain(0);\n            }\n          }",
'Dodge empty dash resets chain')
replace_once(path,
"            // Check collision with player\n            if (!state.isDashing && Math.abs(state.playerX - h.x) < h.width / 2 + state.playerRadius - 2) {",
"            // Check collision with player. A deliberate dash through an active beam\n            // counts once as a Phase Cut instead of being merely passive invulnerability.\n            const laserDistance = Math.abs(state.playerX - h.x);\n            if (state.isDashing && !h.phaseCut && isDodgePhaseCut(true, laserDistance, h.width / 2 + state.playerRadius - 2)) {\n              h.phaseCut = true;\n              registerPhaseCut(h.x, state.playerY, '#EF4444');\n            } else if (!state.isDashing && laserDistance < h.width / 2 + state.playerRadius - 2) {",
'Dodge laser phase cut')
replace_once(path,
"            if (!state.isDashing && hDist < h.width / 2 + state.playerRadius - 3) {",
"            if (isDodgePhaseCut(state.isDashing, hDist, h.width / 2 + state.playerRadius - 3)) {\n              registerPhaseCut(h.x + h.width / 2, h.y + h.height / 2, h.color);\n              state.hazards.splice(i, 1);\n              continue;\n            }\n\n            if (!state.isDashing && hDist < h.width / 2 + state.playerRadius - 3) {",
'Dodge falling hazard phase cut')
replace_once(path,
"        </div>\n      </button>\n    </div>\n  );",
"        </div>\n        {phaseCutChain > 0 && (\n          <span className=\"ml-1 text-amber-300 text-[10px] font-black\">PHASE CUT x{phaseCutChain}</span>\n        )}\n      </button>\n    </div>\n  );",
'Dodge phase HUD')

# Aero Pulse — consecutive grazes earn player-spendable Flow Boost windows.
path = 'src/games/FlappyAeroGame.tsx'
replace_once(path,
"import { useGameLoop, useSafeTimeout, useRenderPublishedState } from '../hooks/useGameLoop';",
"import { useGameLoop, useSafeTimeout, useRenderPublishedState } from '../hooks/useGameLoop';\nimport {\n  AERO_FLOW_DURATION_SEC,\n  AERO_FLOW_MAX_CHARGES,\n  AERO_FLOW_SPEED_MULTIPLIER,\n  AERO_FLOW_START_CHARGES,\n  canTriggerAeroFlow,\n  getAeroFlowScore,\n  shouldEarnAeroFlow,\n} from '../lib/aeroMastery';",
'Aero mastery import')
replace_once(path,
"    multiplier: 1,\n  });",
"    multiplier: 1,\n    flowCharges: AERO_FLOW_START_CHARGES,\n    flowActive: false,\n  });",
'Aero HUD fields')
replace_once(path,
"    gatesCleared: 0,\n\n    scrollSpeed: 170,",
"    gatesCleared: 0,\n    flowCharges: AERO_FLOW_START_CHARGES,\n    flowTimer: 0,\n\n    scrollSpeed: 170,",
'Aero state fields')
replace_once(path,
"  useEffect(() => {\n    const handleKeyDown = (e: KeyboardEvent) => {\n      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {\n        e.preventDefault();\n        triggerFlap();\n      }\n    };",
"  const triggerFlowBoost = () => {\n    const state = gameStateRef.current;\n    if (!canTriggerAeroFlow(state.flowCharges, state.flowTimer, state.isAlive) || isPausedRef.current) return;\n    state.flowCharges--;\n    state.flowTimer = AERO_FLOW_DURATION_SEC;\n    if (soundEnabled) sounds.playWarp();\n  };\n\n  useEffect(() => {\n    const handleKeyDown = (e: KeyboardEvent) => {\n      if (e.code === 'KeyF' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {\n        e.preventDefault();\n        triggerFlowBoost();\n      } else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {\n        e.preventDefault();\n        triggerFlap();\n      }\n    };",
'Aero flow input')
replace_once(path,
"      if (!isPausedRef.current && state.isAlive) {\n        // Physics update",
"      if (!isPausedRef.current && state.isAlive) {\n        if (state.flowTimer > 0) {\n          state.flowTimer = Math.max(0, state.flowTimer - dt);\n        }\n\n        // Physics update",
'Aero flow timer')
replace_once(path,
"        // Speed ramp\n        state.scrollSpeed = Math.min(280, 175 + state.gatesCleared * 3.0);",
"        // Speed ramp. Flow raises route pressure without touching flap physics or collision geometry.\n        const baseScrollSpeed = Math.min(280, 175 + state.gatesCleared * 3.0);\n        state.scrollSpeed = baseScrollSpeed * (state.flowTimer > 0 ? AERO_FLOW_SPEED_MULTIPLIER : 1);",
'Aero flow speed')
replace_once(path,
"            state.gatesCleared++;\n            const gatePoints = 100 * state.multiplier;",
"            state.gatesCleared++;\n            if (!gate.grazed) state.grazeCombo = 0;\n            const gatePoints = getAeroFlowScore(100 * state.multiplier, state.flowTimer > 0);",
'Aero gate reward')
replace_once(path,
"              state.grazeCombo++;\n              const grazePoints = 50 * state.multiplier;",
"              state.grazeCombo++;\n              if (shouldEarnAeroFlow(state.grazeCombo)) {\n                state.flowCharges = Math.min(AERO_FLOW_MAX_CHARGES, state.flowCharges + 1);\n              }\n              const grazePoints = getAeroFlowScore(50 * state.multiplier, state.flowTimer > 0);",
'Aero graze earn')
replace_once(path,
"            const starPts = 200 * state.multiplier;",
"            const starPts = getAeroFlowScore(200 * state.multiplier, state.flowTimer > 0);",
'Aero star reward')
replace_once(path,
"          prev.grazeCombo === state.grazeCombo &&\n          prev.multiplier === state.multiplier",
"          prev.grazeCombo === state.grazeCombo &&\n          prev.multiplier === state.multiplier &&\n          prev.flowCharges === state.flowCharges &&\n          prev.flowActive === (state.flowTimer > 0)",
'Aero HUD compare')
replace_once(path,
"          grazeCombo: state.grazeCombo,\n          multiplier: state.multiplier,\n        };",
"          grazeCombo: state.grazeCombo,\n          multiplier: state.multiplier,\n          flowCharges: state.flowCharges,\n          flowActive: state.flowTimer > 0,\n        };",
'Aero HUD return')
replace_once(path,
"      <canvas ref={canvasRef} className=\"w-full h-full block\" />",
"      <button\n        type=\"button\"\n        onPointerDown={(e) => e.stopPropagation()}\n        onClick={triggerFlowBoost}\n        disabled={hudState.flowCharges <= 0 || hudState.flowActive}\n        className=\"absolute bottom-3 right-3 z-20 pointer-events-auto rounded-xl border border-sky-400/40 bg-[#18181B]/90 px-3 py-2 font-mono text-[10px] font-black text-sky-300 disabled:opacity-40\"\n      >\n        {hudState.flowActive ? 'FLOW BOOST ACTIVE' : `FLOW BOOST ${hudState.flowCharges}/2`}\n      </button>\n\n      <canvas ref={canvasRef} className=\"w-full h-full block\" />",
'Aero flow button')

# Orb Cannon — deterministic earned bombs plus one visible chamber swap per shot.
path = 'src/games/BubbleBusterGame.tsx'
replace_once(path,
"import { useGameLoop, useSafeTimeout, useRenderPublishedState } from '../hooks/useGameLoop';",
"import { useGameLoop, useSafeTimeout, useRenderPublishedState } from '../hooks/useGameLoop';\nimport {\n  ORB_BURST_MAX_CHARGES,\n  ORB_BURST_START_CHARGES,\n  canArmOrbBurst,\n  canSwapOrbChamber,\n  shouldEarnOrbBurst,\n} from '../lib/orbCannonMastery';",
'Orb mastery import')
replace_once(path,
"    currentBubbleColor: COLORS[0],\n  });",
"    currentBubbleColor: COLORS[0],\n    burstCharges: ORB_BURST_START_CHARGES,\n    burstArmed: false,\n    canSwap: true,\n  });",
'Orb HUD fields')
replace_once(path,
"    nextBubbleColor: COLORS[1],\n    flyingBubble: null as FlyingBubble | null,",
"    nextBubbleColor: COLORS[1],\n    flyingBubble: null as FlyingBubble | null,\n    burstCharges: ORB_BURST_START_CHARGES,\n    burstArmed: false,\n    hasSwappedThisTurn: false,",
'Orb state fields')
replace_once(path,
"  // Shoot Action toward specified angle or current cannon angle\n  const shootBubble =",
"  const armBurst = () => {\n    const state = gameStateRef.current;\n    if (!canArmOrbBurst(state.burstCharges, state.burstArmed, Boolean(state.flyingBubble)) || isPausedRef.current || !state.isAlive) return;\n    state.burstCharges--;\n    state.burstArmed = true;\n    if (soundEnabled) sounds.playPowerUp();\n  };\n\n  const swapChamber = () => {\n    const state = gameStateRef.current;\n    if (!canSwapOrbChamber(state.hasSwappedThisTurn, Boolean(state.flyingBubble)) || isPausedRef.current || !state.isAlive) return;\n    const current = state.currentBubbleColor;\n    state.currentBubbleColor = state.nextBubbleColor;\n    state.nextBubbleColor = current;\n    state.hasSwappedThisTurn = true;\n    if (soundEnabled) sounds.playTick();\n  };\n\n  // Shoot Action toward specified angle or current cannon angle\n  const shootBubble =",
'Orb actions')
replace_once(path,
"      color: state.currentBubbleColor,\n      isBomb: Math.random() < 0.08,\n    };",
"      color: state.currentBubbleColor,\n      isBomb: state.burstArmed,\n    };\n    state.burstArmed = false;\n    state.hasSwappedThisTurn = false;",
'Orb deterministic burst')
replace_once(path,
"      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {",
"      if (e.code === 'KeyF' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {\n        e.preventDefault();\n        armBurst();\n      } else if (e.code === 'KeyQ') {\n        e.preventDefault();\n        swapChamber();\n      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {",
'Orb keyboard mastery')
replace_once(path,
"    state.currentBubbleColor = COLORS[0];\n    state.nextBubbleColor = COLORS[1];",
"    state.currentBubbleColor = COLORS[0];\n    state.nextBubbleColor = COLORS[1];\n    state.burstCharges = ORB_BURST_START_CHARGES;\n    state.burstArmed = false;\n    state.hasSwappedThisTurn = false;",
'Orb reset mastery')
replace_once(path,
"                if (dropCount > 0) {\n                  const dropPts = dropCount * 250 * state.multiplier;\n                  state.score += dropPts;\n                  onScoreUpdate(state.score);\n                  state.popups.push({\n                    id: state.nextId++,\n                    x: fb.x,\n                    y: fb.y - 15,\n                    text: `CASCADE +${dropPts}!`,\n                    color: '#FACC15',\n                    life: 1.0,\n                  });\n                }",
"                if (dropCount > 0) {\n                  const dropPts = dropCount * 250 * state.multiplier;\n                  state.score += dropPts;\n                  onScoreUpdate(state.score);\n                  state.popups.push({\n                    id: state.nextId++,\n                    x: fb.x,\n                    y: fb.y - 15,\n                    text: `CASCADE +${dropPts}!`,\n                    color: '#FACC15',\n                    life: 1.0,\n                  });\n                }\n\n                if (shouldEarnOrbBurst(state.combo, dropCount)) {\n                  state.burstCharges = Math.min(ORB_BURST_MAX_CHARGES, state.burstCharges + 1);\n                }",
'Orb earn burst')
replace_once(path,
"          prev.nextColor === state.nextBubbleColor &&\n          prev.currentBubbleColor === state.currentBubbleColor",
"          prev.nextColor === state.nextBubbleColor &&\n          prev.currentBubbleColor === state.currentBubbleColor &&\n          prev.burstCharges === state.burstCharges &&\n          prev.burstArmed === state.burstArmed &&\n          prev.canSwap === !state.hasSwappedThisTurn",
'Orb HUD compare')
replace_once(path,
"          nextColor: state.nextBubbleColor,\n          currentBubbleColor: state.currentBubbleColor,\n        };",
"          nextColor: state.nextBubbleColor,\n          currentBubbleColor: state.currentBubbleColor,\n          burstCharges: state.burstCharges,\n          burstArmed: state.burstArmed,\n          canSwap: !state.hasSwappedThisTurn,\n        };",
'Orb HUD return')
replace_once(path,
"      <canvas ref={canvasRef} className=\"w-full h-full block\" />",
"      <div className=\"absolute bottom-2.5 left-1/2 z-20 flex -translate-x-1/2 gap-2 pointer-events-auto\">\n        <button\n          type=\"button\"\n          onPointerDown={(e) => e.stopPropagation()}\n          onClick={swapChamber}\n          disabled={!hudState.canSwap}\n          className=\"rounded-xl border border-zinc-600 bg-[#18181B]/90 px-3 py-1.5 font-mono text-[10px] font-black text-zinc-200 disabled:opacity-35\"\n        >\n          SWAP [Q]\n        </button>\n        <button\n          type=\"button\"\n          onPointerDown={(e) => e.stopPropagation()}\n          onClick={armBurst}\n          disabled={hudState.burstCharges <= 0 || hudState.burstArmed}\n          className=\"rounded-xl border border-pink-400/50 bg-[#18181B]/90 px-3 py-1.5 font-mono text-[10px] font-black text-pink-300 disabled:opacity-35\"\n        >\n          {hudState.burstArmed ? 'BURST ARMED' : `BURST ${hudState.burstCharges}/2 [F]`}\n        </button>\n      </div>\n\n      <canvas ref={canvasRef} className=\"w-full h-full block\" />",
'Orb mastery buttons')

# Registry teaching copy.
path = 'src/data/games.ts'
replace_once(path,
"    description: 'Maneuver your agile drone left and right to dodge descending spikes and gather shield power.',\n    category: 'Reflex',\n    sessionLength: '1–3 min',\n    accentColor: '#f43f5e',\n    accentGlow: 'rgba(244, 63, 94, 0.4)',\n    accentBg: 'rgba(244, 63, 94, 0.1)',\n    instructions: 'Drag or use Arrow keys to steer clear of red obstacles.',\n    controlsHint: 'Touch Drag / Mouse / Arrow Keys',",
"    description: 'Read a mixed hazard storm, collect tactical powerups, and turn Warp Dash into an offensive Phase Cut chain by deliberately slicing through threats during its brief invulnerability window.',\n    category: 'Reflex',\n    sessionLength: '1–3 min',\n    accentColor: '#f43f5e',\n    accentGlow: 'rgba(244, 63, 94, 0.4)',\n    accentBg: 'rgba(244, 63, 94, 0.1)',\n    instructions: 'Drag or use Arrow keys to steer. Space/Warp Dash grants a brief phase window; intentionally cross hazards during it to score Phase Cuts and accelerate dash recharge.',\n    controlsHint: 'Touch Drag / Mouse / Arrows • Space: Warp Dash / Phase Cut',",
'Registry Dodge P10')
replace_once(path,
"    description: 'Pilot an ultra-responsive cyber aero craft through oscillating neon barriers. Graze close to laser gates for high-risk bonus multipliers, collect energy shields, and chain consecutive gates.',\n    category: 'Timing',\n    sessionLength: '1–2 min',\n    accentColor: '#38bdf8',\n    accentGlow: 'rgba(56, 189, 248, 0.4)',\n    accentBg: 'rgba(56, 189, 248, 0.1)',\n    instructions: 'Click, Tap, or press Space to thrust upward. Pass through laser gate openings.',\n    controlsHint: 'Click / Tap / Space',",
"    description: 'Pilot through oscillating gates, chain consecutive grazes to earn Flow Boost charges, then spend them on faster high-risk 2x-reward flight windows.',\n    category: 'Timing',\n    sessionLength: '1–2 min',\n    accentColor: '#38bdf8',\n    accentGlow: 'rgba(56, 189, 248, 0.4)',\n    accentBg: 'rgba(56, 189, 248, 0.1)',\n    instructions: 'Click, Tap, or Space to thrust. Three consecutive grazes earn Flow Boost; press F/Shift or tap Flow Boost for four seconds of faster 2x scoring.',\n    controlsHint: 'Click / Tap / Space • F / Shift: Flow Boost',",
'Registry Aero P10')
replace_once(path,
"    description: 'Rotate the high-precision plasma cannon to shoot colored bubbles into the ceiling matrix. Match 3 or more of the same color to trigger explosive cascade drops before the ceiling descends.',\n    category: 'Puzzle',\n    sessionLength: '1–3 min',\n    accentColor: '#ec4899',\n    accentGlow: 'rgba(236, 72, 153, 0.4)',\n    accentBg: 'rgba(236, 72, 153, 0.1)',\n    instructions: 'Aim with Mouse/Touch/Arrows, shoot with Click/Space. Match 3 to pop.',\n    controlsHint: 'Aim: Mouse/Touch/A-D • Shoot: Click/Space',",
"    description: 'Plan with the visible current/next chamber, swap once per shot, build combos and cascade drops to earn Burst charges, then spend them on deterministic bomb shots before the ceiling descends.',\n    category: 'Puzzle',\n    sessionLength: '1–3 min',\n    accentColor: '#ec4899',\n    accentGlow: 'rgba(236, 72, 153, 0.4)',\n    accentBg: 'rgba(236, 72, 153, 0.1)',\n    instructions: 'Aim and shoot to match 3. Press Q or tap Swap once per shot to exchange current/next; combo or cascade play earns Burst charges, armed with F/Shift for a bomb shot.',\n    controlsHint: 'Aim: Mouse/Touch/A-D • Shoot: Click/Space • Q: Swap • F/Shift: Burst',",
'Registry Orb P10')

print('P10 gameplay patch applied')
