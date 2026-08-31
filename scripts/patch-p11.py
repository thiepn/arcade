from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one marker, found {count}")
    p.write_text(text.replace(old, new, 1))


# Orbit — telegraphed authored threat formations.
replace_once(
    'src/games/OrbitGame.tsx',
    "import { getOrbitRouteLane, getOrbitRouteName, getOrbitRouteMultiplier, isOrbitNearMiss } from '../lib/orbitMastery';",
    "import { getOrbitRouteLane, getOrbitRouteName, getOrbitRouteMultiplier, isOrbitNearMiss } from '../lib/orbitMastery';\nimport {\n  ORBIT_FORMATION_COOLDOWN_SEC,\n  ORBIT_FORMATION_GRACE_SEC,\n  ORBIT_FORMATION_RESOLVE_SEC,\n  ORBIT_FORMATION_WARNING_SEC,\n  getOrbitFormationBonus,\n  getOrbitLaneName,\n  getOrbitThreatFormation,\n  type OrbitThreatFormation,\n  type OrbitThreatTarget,\n} from '../lib/orbitThreatMastery';",
    'orbit imports',
)
replace_once(
    'src/games/OrbitGame.tsx',
    "    lastNearMissAt: -99,\n    isAlive: true,",
    "    lastNearMissAt: -99,\n    formationIndex: 0,\n    pendingFormation: null as OrbitThreatFormation | null,\n    formationWarningTimer: 0,\n    formationResolveTimer: 0,\n    formationGraceTimer: 0,\n    formationCooldownTimer: 4.5,\n    formationSafeLane: 1 as 0 | 1 | 2,\n    formationChain: 0,\n    isAlive: true,",
    'orbit formation state',
)
replace_once(
    'src/games/OrbitGame.tsx',
    "  }, []);\n\n  const spawnCrystal = useCallback(() => {",
    "  }, []);\n\n  const spawnFormationHazard = useCallback((\n    target: OrbitThreatTarget,\n    w: number,\n    h: number,\n    cx: number,\n    cy: number,\n  ) => {\n    const state = gameStateRef.current;\n    const targetAngle = state.playerAngle + target.leadRadians * state.direction;\n    const laneRadius = state.baseRadii[target.lane];\n    const targetX = cx + Math.cos(targetAngle) * laneRadius;\n    const targetY = cy + Math.sin(targetAngle) * laneRadius;\n    const spawnDist = Math.max(w, h) * 0.72;\n    const spawnX = cx + Math.cos(targetAngle) * spawnDist;\n    const spawnY = cy + Math.sin(targetAngle) * spawnDist;\n    const dx = targetX - spawnX;\n    const dy = targetY - spawnY;\n    const distance = Math.max(1, Math.hypot(dx, dy));\n    const speed = 3.3 + Math.min(1.5, state.gameTime * 0.025);\n\n    state.hazards.push({\n      x: spawnX,\n      y: spawnY,\n      vx: (dx / distance) * speed,\n      vy: (dy / distance) * speed,\n      radius: 9,\n      color: '#FB7185',\n      trail: [],\n      nearMissAwarded: false,\n    });\n  }, []);\n\n  const spawnCrystal = useCallback(() => {",
    'orbit formation spawner',
)
replace_once(
    'src/games/OrbitGame.tsx',
    "        state.gameTime += dt / 1000;\n        state.corePulse += 0.05 * deltaRatio;",
    "        state.gameTime += dt / 1000;\n        const frameSeconds = dt / 1000;\n        state.corePulse += 0.05 * deltaRatio;\n\n        if (state.formationCooldownTimer > 0) {\n          state.formationCooldownTimer = Math.max(0, state.formationCooldownTimer - frameSeconds);\n        }\n        if (state.formationGraceTimer > 0) {\n          state.formationGraceTimer = Math.max(0, state.formationGraceTimer - frameSeconds);\n        }\n        if (state.formationWarningTimer > 0) {\n          state.formationWarningTimer = Math.max(0, state.formationWarningTimer - frameSeconds);\n          if (state.formationWarningTimer === 0 && state.pendingFormation) {\n            const formation = state.pendingFormation;\n            formation.targets.forEach((target) => {\n              spawnFormationHazard(target, curW, curH, cx, cy);\n            });\n            state.formationSafeLane = formation.safeLane;\n            state.formationResolveTimer = ORBIT_FORMATION_RESOLVE_SEC;\n            state.pendingFormation = null;\n          }\n        }\n        if (state.formationResolveTimer > 0) {\n          state.formationResolveTimer = Math.max(0, state.formationResolveTimer - frameSeconds);\n          if (state.formationResolveTimer === 0) {\n            if (state.currentLane === state.formationSafeLane) {\n              state.formationChain++;\n              const bonus = getOrbitFormationBonus(state.formationChain);\n              state.score += bonus;\n              onScoreUpdate(state.score);\n              state.floatingTexts.push({\n                x: cx,\n                y: cy - state.baseRadii[state.currentLane] - 20,\n                text: `FORMATION x${Math.min(5, state.formationChain)} +${bonus}`,\n                color: '#34D399',\n                life: 0,\n                maxLife: 36,\n              });\n              if (soundEnabled) sounds.playSuccess();\n            } else {\n              state.formationChain = 0;\n            }\n          }\n        }\n        if (\n          state.gameTime >= 4 &&\n          state.formationCooldownTimer <= 0 &&\n          state.formationWarningTimer <= 0 &&\n          state.formationResolveTimer <= 0 &&\n          !state.pendingFormation\n        ) {\n          state.pendingFormation = getOrbitThreatFormation(state.formationIndex++);\n          state.formationWarningTimer = ORBIT_FORMATION_WARNING_SEC;\n          state.formationGraceTimer = ORBIT_FORMATION_WARNING_SEC + ORBIT_FORMATION_GRACE_SEC;\n          state.formationCooldownTimer = ORBIT_FORMATION_COOLDOWN_SEC;\n          if (soundEnabled) sounds.playTick();\n        }",
    'orbit formation loop',
)
replace_once(
    'src/games/OrbitGame.tsx',
    "        if (state.hazardSpawnElapsedMs > hazardInterval) {",
    "        if (state.hazardSpawnElapsedMs > hazardInterval && state.formationGraceTimer <= 0) {",
    'orbit random hazard grace',
)
replace_once(
    'src/games/OrbitGame.tsx',
    "      // Route / graze mastery HUD is rendered on-canvas so it stays frame-local.\n      ctx.fillStyle = 'rgba(24, 24, 27, 0.88)';\n      ctx.fillRect(cx - 126, 12, 252, 26);\n      ctx.strokeStyle = 'rgba(63, 63, 70, 0.9)';\n      ctx.strokeRect(cx - 126, 12, 252, 26);\n      ctx.fillStyle = '#38BDF8';\n      ctx.font = 'bold 10px monospace';\n      ctx.textAlign = 'center';\n      ctx.textBaseline = 'middle';\n      ctx.fillText(\n        `${getOrbitRouteName(state.routeIndex)} • ROUTE x${getOrbitRouteMultiplier(state.routeChain)} • GRAZE x${Math.max(1, state.nearMissChain)}`,\n        cx,\n        25,\n      );",
    "      // Route / graze / formation mastery HUD is rendered on-canvas so it stays frame-local.\n      const masteryHudWidth = Math.max(220, Math.min(356, curW - 20));\n      ctx.fillStyle = 'rgba(24, 24, 27, 0.88)';\n      ctx.fillRect(cx - masteryHudWidth / 2, 12, masteryHudWidth, 28);\n      ctx.strokeStyle = 'rgba(63, 63, 70, 0.9)';\n      ctx.strokeRect(cx - masteryHudWidth / 2, 12, masteryHudWidth, 28);\n      ctx.fillStyle = state.pendingFormation ? '#FB7185' : '#38BDF8';\n      ctx.font = 'bold 9px monospace';\n      ctx.textAlign = 'center';\n      ctx.textBaseline = 'middle';\n      const threatLabel = state.pendingFormation\n        ? `${state.pendingFormation.name} • SAFE ${getOrbitLaneName(state.pendingFormation.safeLane)}`\n        : state.formationResolveTimer > 0\n          ? `FORMATION • SAFE ${getOrbitLaneName(state.formationSafeLane)}`\n          : 'THREAT SCAN';\n      ctx.fillText(\n        `${threatLabel} • FORMATION x${Math.max(1, state.formationChain)} • ROUTE x${getOrbitRouteMultiplier(state.routeChain)} • GRAZE x${Math.max(1, state.nearMissChain)}`,\n        cx,\n        26,\n      );",
    'orbit mastery HUD',
)

# Pac-Runner — optional Hunt Rush inside each frightened window.
replace_once(
    'src/games/PacMazeGame.tsx',
    "import React, { useEffect, useRef, useState } from 'react';",
    "import React, { useCallback, useEffect, useRef, useState } from 'react';",
    'pac React import',
)
replace_once(
    'src/games/PacMazeGame.tsx',
    "} from '../lib/pacGhostAi';",
    "} from '../lib/pacGhostAi';\nimport {\n  PAC_HUNT_TIMER_FACTOR,\n  canActivatePacHunt,\n  getPacHuntCapturePoints,\n  getPacHuntGhostSpeed,\n} from '../lib/pacHuntMastery';",
    'pac hunt import',
)
replace_once(
    'src/games/PacMazeGame.tsx',
    "    ghostMode: 'SCATTER' as PacGhostMode,\n  });",
    "    ghostMode: 'SCATTER' as PacGhostMode,\n    huntReady: false,\n    huntActive: false,\n  });",
    'pac HUD hunt state',
)
replace_once(
    'src/games/PacMazeGame.tsx',
    "    ghostsEatenStreak: 0,\n\n    // Fruit",
    "    ghostsEatenStreak: 0,\n    huntReady: false,\n    huntActive: false,\n\n    // Fruit",
    'pac runtime hunt state',
)
replace_once(
    'src/games/PacMazeGame.tsx',
    "  // Count dots\n  useEffect(() => {",
    "  const triggerHuntRush = useCallback(() => {\n    const state = gameStateRef.current;\n    if (!canActivatePacHunt(state.huntReady, state.frightenedTimer, state.isAlive) || isPausedRef.current) return;\n    state.huntReady = false;\n    state.huntActive = true;\n    state.frightenedTimer *= PAC_HUNT_TIMER_FACTOR;\n    state.popups.push({\n      id: state.nextId++,\n      x: 0,\n      y: 0,\n      text: 'HUNT RUSH x2',\n      color: '#F43F5E',\n      life: 1.2,\n    });\n    if (soundEnabled) sounds.playFeverMode();\n  }, [soundEnabled]);\n\n  // Count dots\n  useEffect(() => {",
    'pac hunt trigger',
)
replace_once(
    'src/games/PacMazeGame.tsx',
    "    const handleKeyDown = (event: KeyboardEvent) => {\n      const direction = getPacDirectionForCode(event.code);",
    "    const handleKeyDown = (event: KeyboardEvent) => {\n      if (event.code === 'KeyF' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') {\n        event.preventDefault();\n        triggerHuntRush();\n        return;\n      }\n      const direction = getPacDirectionForCode(event.code);",
    'pac hunt keyboard',
)
replace_once(
    'src/games/PacMazeGame.tsx',
    "    window.addEventListener('keydown', handleKeyDown, true);\n    return () => window.removeEventListener('keydown', handleKeyDown, true);\n  }, []);",
    "    window.addEventListener('keydown', handleKeyDown, true);\n    return () => window.removeEventListener('keydown', handleKeyDown, true);\n  }, [triggerHuntRush]);",
    'pac key effect dependency',
)
replace_once(
    'src/games/PacMazeGame.tsx',
    "          if (state.frightenedTimer <= 0) {\n            state.ghostsEatenStreak = 0;\n          }",
    "          if (state.frightenedTimer <= 0) {\n            state.ghostsEatenStreak = 0;\n            state.huntReady = false;\n            state.huntActive = false;\n          }",
    'pac hunt expiry',
)
replace_once(
    'src/games/PacMazeGame.tsx',
    "            state.frightenedTimer = getPacFrightenedDuration(state.level);\n            state.ghostsEatenStreak = 0;",
    "            state.frightenedTimer = getPacFrightenedDuration(state.level);\n            state.ghostsEatenStreak = 0;\n            state.huntReady = true;\n            state.huntActive = false;",
    'pac pellet grants hunt',
)
replace_once(
    'src/games/PacMazeGame.tsx',
    "            state.frightenedTimer = 0;\n            state.ghostsEatenStreak = 0;",
    "            state.frightenedTimer = 0;\n            state.ghostsEatenStreak = 0;\n            state.huntReady = false;\n            state.huntActive = false;",
    'pac level reset hunt',
)
replace_once(
    'src/games/PacMazeGame.tsx',
    "        const ghostSpeed = getPacGhostSpeed(state.level, isFrightened) * dt;",
    "        const ghostSpeed = getPacHuntGhostSpeed(\n          getPacGhostSpeed(state.level, isFrightened),\n          state.huntActive && isFrightened,\n        ) * dt;",
    'pac hunt ghost speed',
)
replace_once(
    'src/games/PacMazeGame.tsx',
    "              state.ghostsEatenStreak++;\n              const pts = 200 * Math.pow(2, state.ghostsEatenStreak - 1);",
    "              state.ghostsEatenStreak++;\n              const basePts = 200 * Math.pow(2, state.ghostsEatenStreak - 1);\n              const pts = getPacHuntCapturePoints(basePts, state.huntActive);",
    'pac hunt capture reward',
)
replace_once(
    'src/games/PacMazeGame.tsx',
    "          prev.level === state.level &&\n          prev.ghostMode === state.ghostMode",
    "          prev.level === state.level &&\n          prev.ghostMode === state.ghostMode &&\n          prev.huntReady === state.huntReady &&\n          prev.huntActive === state.huntActive",
    'pac HUD hunt comparison',
)
replace_once(
    'src/games/PacMazeGame.tsx',
    "          level: state.level,\n          ghostMode: state.ghostMode,\n        };",
    "          level: state.level,\n          ghostMode: state.ghostMode,\n          huntReady: state.huntReady,\n          huntActive: state.huntActive,\n        };",
    'pac HUD hunt publish',
)
replace_once(
    'src/games/PacMazeGame.tsx',
    "        <div className=\"px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-zinc-400 font-mono text-xs font-bold backdrop-blur-md\">\n          DOTS: <span className=\"text-white\">{hudState.dotsLeft}</span>\n        </div>",
    "        <div className=\"flex items-center gap-2\">\n          {(hudState.huntReady || hudState.huntActive) && (\n            <button\n              type=\"button\"\n              onClick={triggerHuntRush}\n              disabled={!hudState.huntReady}\n              className={`pointer-events-auto px-2.5 py-1 rounded-xl border font-mono text-[10px] font-black ${\n                hudState.huntActive\n                  ? 'bg-rose-500/30 border-rose-400 text-rose-200 animate-pulse'\n                  : 'bg-rose-500/15 border-rose-500/60 text-rose-300 hover:bg-rose-500/25'\n              } disabled:cursor-default`}\n            >\n              {hudState.huntActive ? 'HUNT x2' : 'HUNT RUSH · F'}\n            </button>\n          )}\n          <div className=\"px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-zinc-400 font-mono text-xs font-bold backdrop-blur-md\">\n            DOTS: <span className=\"text-white\">{hudState.dotsLeft}</span>\n          </div>\n        </div>",
    'pac Hunt HUD button',
)

# Cyber Serpent — unique firewall Phase Thread mastery.
replace_once(
    'src/games/SnakeGame.tsx',
    "import { getSnakeFirewallCells, getSnakeFirewallStage } from './snakeExperience';",
    "import { getSnakeFirewallCells, getSnakeFirewallStage } from './snakeExperience';\nimport { extendSnakeGhostTimerForThread, getSnakePhaseThreadReward } from '../lib/snakePhaseMastery';",
    'snake phase import',
)
replace_once(
    'src/games/SnakeGame.tsx',
    "  const [combo, setCombo] = useState(0);\n  const [firewallStage, setFirewallStage] = useState(0);",
    "  const [combo, setCombo] = useState(0);\n  const [firewallStage, setFirewallStage] = useState(0);\n  const [phaseThreadChain, setPhaseThreadChain] = useState(0);",
    'snake phase HUD state',
)
replace_once(
    'src/games/SnakeGame.tsx',
    "    comboCount: 0,\n    comboTimer: 0,",
    "    comboCount: 0,\n    comboTimer: 0,\n    phaseThreadCells: new Set<string>(),\n    phaseThreadChain: 0,",
    'snake phase runtime state',
)
replace_once(
    'src/games/SnakeGame.tsx',
    "    state.firewallStage = 0;\n    setFirewallStage(0);",
    "    state.firewallStage = 0;\n    state.phaseThreadCells.clear();\n    state.phaseThreadChain = 0;\n    setFirewallStage(0);\n    setPhaseThreadChain(0);",
    'snake phase init',
)
replace_once(
    'src/games/SnakeGame.tsx',
    "    if (state.ghostTimer > 0) {\n      state.ghostTimer--;\n      setGhostTime(state.ghostTimer);\n    }",
    "    if (state.ghostTimer > 0) {\n      state.ghostTimer--;\n      setGhostTime(state.ghostTimer);\n      if (state.ghostTimer === 0) {\n        state.phaseThreadCells.clear();\n        state.phaseThreadChain = 0;\n        setPhaseThreadChain(0);\n      }\n    }",
    'snake phase expiry',
)
replace_once(
    'src/games/SnakeGame.tsx',
    "      setSafeTimeout(() => onGameOver(state.score), 400);\n      return;\n    }\n\n    // Self collision",
    "      setSafeTimeout(() => onGameOver(state.score), 400);\n      return;\n    }\n\n    if (firewallCollision && isGhost) {\n      const cellKey = `${newHead.x},${newHead.y}`;\n      if (!state.phaseThreadCells.has(cellKey)) {\n        state.phaseThreadCells.add(cellKey);\n        state.phaseThreadChain++;\n        const reward = getSnakePhaseThreadReward(state.phaseThreadChain);\n        state.score += reward;\n        state.ghostTimer = extendSnakeGhostTimerForThread(state.ghostTimer, state.phaseThreadChain);\n        setScore(state.score);\n        setGhostTime(state.ghostTimer);\n        setPhaseThreadChain(state.phaseThreadChain);\n        onScoreUpdate(state.score);\n        addFloatingText(\n          `PHASE THREAD x${state.phaseThreadChain} +${reward}`,\n          newHead.x * state.cellSize,\n          newHead.y * state.cellSize - 14,\n          '#C084FC',\n        );\n        haptics.combo();\n        if (soundEnabled) sounds.playChime(720 + Math.min(6, state.phaseThreadChain) * 55);\n      }\n    }\n\n    // Self collision",
    'snake phase traversal',
)
replace_once(
    'src/games/SnakeGame.tsx',
    "      if (eaten.type === 'ghost') {\n        state.ghostTimer = 65; // ~6.5 seconds\n        setGhostTime(65);",
    "      if (eaten.type === 'ghost') {\n        state.ghostTimer = 65; // ~6.5 seconds\n        state.phaseThreadCells.clear();\n        state.phaseThreadChain = 0;\n        setGhostTime(65);\n        setPhaseThreadChain(0);",
    'snake ghost phase reset',
)
replace_once(
    'src/games/SnakeGame.tsx',
    "          {ghostTime > 0 && (\n            <span className=\"px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold flex items-center gap-1 animate-pulse\">\n              <Ghost className=\"w-3 h-3\" /> GHOST PHASE\n            </span>\n          )}",
    "          {ghostTime > 0 && (\n            <span className=\"px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold flex items-center gap-1 animate-pulse\">\n              <Ghost className=\"w-3 h-3\" /> GHOST PHASE\n            </span>\n          )}\n\n          {phaseThreadChain > 0 && (\n            <span className=\"text-fuchsia-300 font-bold\">THREAD x{phaseThreadChain}</span>\n          )}",
    'snake phase HUD',
)

# Registry teaching copy.
replace_once(
    'src/data/games.ts',
    "    description: 'Read authored crystal routes, chain lane-perfect pickups, and graze passing comets for escalating risk-reward bonuses.',\n    category: 'Reflex',\n    sessionLength: '1–2 min',\n    accentColor: '#38bdf8',\n    accentGlow: 'rgba(56, 189, 248, 0.4)',\n    accentBg: 'rgba(56, 189, 248, 0.1)',\n    instructions: 'Tap/Space pulses to shift one lane and reverse direction. Follow the named crystal route for multiplier chains and graze comets after they pass; Up/Down is lane-only and A/D reverses only.',",
    "    description: 'Read crystal routes, graze passing comets, and survive telegraphed threat formations that clearly advertise one safe orbital lane.',\n    category: 'Reflex',\n    sessionLength: '1–2 min',\n    accentColor: '#38bdf8',\n    accentGlow: 'rgba(56, 189, 248, 0.4)',\n    accentBg: 'rgba(56, 189, 248, 0.1)',\n    instructions: 'Tap/Space pulses to shift one lane and reverse direction. Follow route crystals, graze comets after they pass, and move to the advertised SAFE lane during telegraphed threat formations; Up/Down is lane-only and A/D reverses only.',",
    'orbit registry teaching',
)
replace_once(
    'src/data/games.ts',
    "    description: 'Control an electric cyber serpent through wraparound portals as short firewall phrases appear every four growth steps. Ghost Phase lets you pass through firewalls and your own body while multipliers reward aggressive routes.',\n    category: 'Reflex',\n    sessionLength: '1–3 min',\n    accentColor: '#34d399',\n    accentGlow: 'rgba(52, 211, 153, 0.4)',\n    accentBg: 'rgba(52, 211, 153, 0.1)',\n    instructions: 'Use Arrow Keys / WASD or swipe to steer. Every four growth steps adds firewall cells; collect Ghost Phase to pass through firewalls and yourself.',",
    "    description: 'Grow through wraparound portals and escalating firewalls; Ghost Phase now enables Phase Thread routes that reward unique firewall crossings instead of passive invulnerability alone.',\n    category: 'Reflex',\n    sessionLength: '1–3 min',\n    accentColor: '#34d399',\n    accentGlow: 'rgba(52, 211, 153, 0.4)',\n    accentBg: 'rgba(52, 211, 153, 0.1)',\n    instructions: 'Use Arrow Keys / WASD or swipe to steer. Every four growth steps adds firewall cells; during Ghost Phase, deliberately cross unique firewall cells to build a Phase Thread and earn bounded time extensions.',",
    'snake registry teaching',
)
replace_once(
    'src/data/games.ts',
    "    description: 'Clear increasingly fast maze levels while distinct ghosts switch through readable chase/scatter cycles.',\n    category: 'Reflex',\n    sessionLength: '1–3 min',\n    accentColor: '#facc15',\n    accentGlow: 'rgba(250, 204, 21, 0.4)',\n    accentBg: 'rgba(250, 204, 21, 0.1)',\n    instructions: 'Clear dots, exploit power pellets, and route around ghost chase/scatter cycles as levels accelerate.',\n    controlsHint: 'WASD / Arrow Keys / Swipe',",
    "    description: 'Clear increasingly fast maze levels against four distinct ghosts, then turn each power pellet into an optional Hunt Rush risk-reward decision.',\n    category: 'Reflex',\n    sessionLength: '1–3 min',\n    accentColor: '#facc15',\n    accentGlow: 'rgba(250, 204, 21, 0.4)',\n    accentBg: 'rgba(250, 204, 21, 0.1)',\n    instructions: 'Clear dots and read chase/scatter cycles. Each power pellet grants one Hunt Rush: press F/Shift or tap Hunt to shorten frightened time, speed the ghosts up, and double capture rewards.',\n    controlsHint: 'WASD / Arrows / Swipe • F / Shift: Hunt Rush',",
    'pac registry teaching',
)

print('P11 source patch applied')
