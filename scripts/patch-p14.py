from pathlib import Path


def replace_exact(path: str, old: str, new: str, label: str, count: int = 1) -> None:
    p = Path(path)
    text = p.read_text()
    found = text.count(old)
    if found != count:
        raise SystemExit(f"{label}: expected exactly {count} marker(s), found {found}")
    p.write_text(text.replace(old, new, count))


# ---------------- Rhythm: real sustained hold notes ----------------
replace_exact(
    'src/games/RhythmGame.tsx',
    "} from '../lib/rhythmTiming';\n\ninterface ActiveNote {",
    "} from '../lib/rhythmTiming';\nimport {\n  getRhythmHoldCompletionBonus,\n  isRhythmHoldComplete,\n  shouldBreakRhythmHold,\n} from '../lib/rhythmHoldMastery';\n\ninterface ActiveNote {",
    'rhythm hold helper import',
)
replace_exact(
    'src/games/RhythmGame.tsx',
    "  isHit?: boolean;\n  isMissed?: boolean;\n  scoreAwarded?: boolean;",
    "  isHit?: boolean;\n  isMissed?: boolean;\n  isHolding?: boolean;\n  holdCompleted?: boolean;\n  scoreAwarded?: boolean;",
    'rhythm active-note hold state',
)
replace_exact(
    'src/games/RhythmGame.tsx',
    "  const [activeLanes, setActiveLanes] = useState<boolean[]>([false, false, false, false]);\n",
    "  const [activeLanes, setActiveLanes] = useState<boolean[]>([false, false, false, false]);\n  const laneHeldRef = useRef<boolean[]>([false, false, false, false]);\n",
    'rhythm physical lane ownership',
)
replace_exact(
    'src/games/RhythmGame.tsx',
    "      isHit: false,\n      isMissed: false,\n    }));",
    "      isHit: false,\n      isMissed: false,\n      isHolding: false,\n      holdCompleted: false,\n    }));",
    'rhythm note initialization',
    count=2,
)
replace_exact(
    'src/games/RhythmGame.tsx',
    "    state.notes = newSong.notes.map((n, i) => ({",
    "    laneHeldRef.current = [false, false, false, false];\n    state.notes = newSong.notes.map((n, i) => ({",
    'rhythm song-switch ownership reset',
)
replace_exact(
    'src/games/RhythmGame.tsx',
    "    state.isAlive = true;\n    state.notes = song.notes.map((n, i) => ({",
    "    state.isAlive = true;\n    laneHeldRef.current = [false, false, false, false];\n    state.notes = song.notes.map((n, i) => ({",
    'rhythm initial ownership reset',
)
replace_exact(
    'src/games/RhythmGame.tsx',
    "      closestNote.isHit = true;\n      let points = 60;",
    "      closestNote.isHit = true;\n      if (closestNote.type === 'hold' && (closestNote.holdBeats ?? 0) > 0) {\n        closestNote.isHolding = true;\n        closestNote.holdCompleted = false;\n      }\n      let points = 60;",
    'rhythm enter sustained hold',
)
replace_exact(
    'src/games/RhythmGame.tsx',
    "          setActiveLanes((prev) => {\n            const next = [...prev];\n            next[i] = true;",
    "          laneHeldRef.current[i] = true;\n          setActiveLanes((prev) => {\n            const next = [...prev];\n            next[i] = true;",
    'rhythm keyboard hold down',
)
replace_exact(
    'src/games/RhythmGame.tsx',
    "          setActiveLanes((prev) => {\n            const next = [...prev];\n            next[i] = false;",
    "          laneHeldRef.current[i] = false;\n          setActiveLanes((prev) => {\n            const next = [...prev];\n            next[i] = false;",
    'rhythm keyboard hold up',
)
replace_exact(
    'src/games/RhythmGame.tsx',
    "        const judgementBeat = getLatencyCompensatedBeat(\n          state.currentBeat,\n          state.song.bpm,\n          latencyOffsetRef.current,\n        );\n        for (const note of state.notes) {",
    "        const judgementBeat = getLatencyCompensatedBeat(\n          state.currentBeat,\n          state.song.bpm,\n          latencyOffsetRef.current,\n        );\n\n        // Hold heads still use the certified P0 fixed-ms judgement. After a valid\n        // head hit, the lane must remain physically held until the laser tail ends.\n        for (const note of state.notes) {\n          if (!note.isHolding) continue;\n          const holdBeats = note.holdBeats ?? 0;\n          if (isRhythmHoldComplete(judgementBeat, note.beatTime, holdBeats)) {\n            note.isHolding = false;\n            note.holdCompleted = true;\n            const holdBonus = getRhythmHoldCompletionBonus(holdBeats, state.multiplier);\n            state.score += holdBonus;\n            state.grooveHealth = Math.min(100, state.grooveHealth + 3);\n            onScoreUpdate(state.score);\n            state.popups.push({\n              id: state.nextPopupId++,\n              text: 'HOLD CLEAR',\n              subtext: `+${holdBonus.toLocaleString()}`,\n              color: '#34D399',\n              lane: note.lane,\n              life: 1.0,\n              maxLife: 0.65,\n            });\n            if (soundEnabledRef.current) sounds.playSuccess();\n          } else if (\n            shouldBreakRhythmHold({\n              judgementBeat,\n              startBeat: note.beatTime,\n              holdBeats,\n              bpm: state.song.bpm,\n              laneHeld: laneHeldRef.current[note.lane],\n            })\n          ) {\n            note.isHolding = false;\n            note.holdCompleted = false;\n            note.isMissed = true;\n            state.combo = 0;\n            state.multiplier = 1;\n            state.missHits++;\n            state.grooveHealth = Math.max(0, state.grooveHealth - 7);\n            state.popups.push({\n              id: state.nextPopupId++,\n              text: 'HOLD BREAK',\n              color: '#EF4444',\n              lane: note.lane,\n              life: 1.0,\n              maxLife: 0.55,\n            });\n            if (soundEnabledRef.current) sounds.playBuzz();\n            if (state.grooveHealth <= 0) {\n              state.isAlive = false;\n              musicEngine.stop();\n              if (soundEnabledRef.current) sounds.playGameOver();\n              setSafeTimeout(() => onGameOver(state.score), 400);\n              break;\n            }\n          }\n        }\n\n        for (const note of state.notes) {",
    'rhythm sustained hold update',
)
replace_exact(
    'src/games/RhythmGame.tsx',
    "          state.notes.forEach((n) => {\n            n.isHit = false;\n            n.isMissed = false;\n          });",
    "          state.notes.forEach((n) => {\n            n.isHit = false;\n            n.isMissed = false;\n            n.isHolding = false;\n            n.holdCompleted = false;\n          });\n          laneHeldRef.current = [false, false, false, false];",
    'rhythm loop hold reset',
)
replace_exact(
    'src/games/RhythmGame.tsx',
    "      const visibleNotes = state.notes.filter((n) => {\n        if (n.isHit) return false;\n        const delta = n.beatTime - displayBeat;\n        return delta <= state.beatsAhead && delta >= -0.8;\n      });",
    "      const visibleNotes = state.notes.filter((n) => {\n        if (n.isHit && !n.isHolding) return false;\n        if (n.isHolding && n.holdBeats) {\n          return displayBeat <= n.beatTime + n.holdBeats;\n        }\n        const delta = n.beatTime - displayBeat;\n        return delta <= state.beatsAhead && delta >= -0.8;\n      });",
    'rhythm active-hold visibility',
)
replace_exact(
    'src/games/RhythmGame.tsx',
    "      for (const note of visibleNotes) {\n        const beatsRemaining = note.beatTime - displayBeat;\n        const ny = HIT_Y - (beatsRemaining / state.beatsAhead) * HIT_Y;",
    "      for (const note of visibleNotes) {\n        const isActiveHold = Boolean(note.isHolding && note.holdBeats);\n        const beatsRemaining = isActiveHold\n          ? Math.max(0, note.beatTime + (note.holdBeats ?? 0) - displayBeat)\n          : note.beatTime - displayBeat;\n        const ny = isActiveHold ? HIT_Y : HIT_Y - (beatsRemaining / state.beatsAhead) * HIT_Y;",
    'rhythm active hold anchor',
)
replace_exact(
    'src/games/RhythmGame.tsx',
    "        if (note.type === 'hold' && note.holdBeats) {\n          const holdPixelLen = (note.holdBeats / state.beatsAhead) * HIT_Y;",
    "        if (note.type === 'hold' && note.holdBeats) {\n          const visibleHoldBeats = isActiveHold ? beatsRemaining : note.holdBeats;\n          const holdPixelLen = (visibleHoldBeats / state.beatsAhead) * HIT_Y;",
    'rhythm shrinking hold tail',
)
replace_exact(
    'src/games/RhythmGame.tsx',
    "                setActiveLanes((prev) => {\n                  const next = [...prev];\n                  next[idx] = true;",
    "                laneHeldRef.current[idx] = true;\n                setActiveLanes((prev) => {\n                  const next = [...prev];\n                  next[idx] = true;",
    'rhythm touch hold down',
)
replace_exact(
    'src/games/RhythmGame.tsx',
    "              onPointerUp={() => {\n                setActiveLanes((prev) => {\n                  const next = [...prev];\n                  next[idx] = false;",
    "              onPointerUp={() => {\n                laneHeldRef.current[idx] = false;\n                setActiveLanes((prev) => {\n                  const next = [...prev];\n                  next[idx] = false;",
    'rhythm touch hold up',
)
replace_exact(
    'src/games/RhythmGame.tsx',
    "              onPointerLeave={() => {\n                setActiveLanes((prev) => {\n                  const next = [...prev];\n                  next[idx] = false;",
    "              onPointerLeave={() => {\n                laneHeldRef.current[idx] = false;\n                setActiveLanes((prev) => {\n                  const next = [...prev];\n                  next[idx] = false;",
    'rhythm touch hold leave',
)

# ---------------- Block Drop: 7-bag + clear-chain/B2B mastery ----------------
replace_exact(
    'src/games/BlockDropGame.tsx',
    "import { getBlockDropLayout, resolveBlockDropHold } from '../lib/blockDropSupport';\n",
    "import { getBlockDropLayout, resolveBlockDropHold } from '../lib/blockDropSupport';\nimport { drawBlockDropBagPiece, resolveBlockDropLineMastery } from '../lib/blockDropMastery';\n",
    'block mastery import',
)
replace_exact(
    'src/games/BlockDropGame.tsx',
    "const TETROMINO_KEYS: TetrominoType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];\n\n",
    "",
    'remove independent tetromino key randomizer',
)
replace_exact(
    'src/games/BlockDropGame.tsx',
    "    holdType: null as TetrominoType | null,\n    canHold: true,\n  });",
    "    holdType: null as TetrominoType | null,\n    canHold: true,\n    clearChain: 0,\n    backToBack: false,\n  });",
    'block hud mastery state',
)
replace_exact(
    'src/games/BlockDropGame.tsx',
    "    holdPieceType: null as TetrominoType | null,\n    canHold: true,\n    dropTimer: 0,",
    "    holdPieceType: null as TetrominoType | null,\n    canHold: true,\n    pieceBag: [] as TetrominoType[],\n    clearChain: 0,\n    backToBack: false,\n    dropTimer: 0,",
    'block runtime mastery state',
)
replace_exact(
    'src/games/BlockDropGame.tsx',
    "  const getRandomPieceType = (): TetrominoType => {\n    return TETROMINO_KEYS[Math.floor(Math.random() * TETROMINO_KEYS.length)];\n  };",
    "  const getRandomPieceType = (): TetrominoType =>\n    drawBlockDropBagPiece(gameStateRef.current.pieceBag);",
    'block 7-bag draw',
)
replace_exact(
    'src/games/BlockDropGame.tsx',
    "    if (clearedLines > 0) {\n      state.lines += clearedLines;\n      const pts = [0, 100, 300, 500, 1000][clearedLines] * state.level;\n      state.score += pts;\n      onScoreUpdate(state.score);\n      if (soundEnabled) sounds.playLineClear();\n\n      state.level = Math.floor(state.lines / 10) + 1;\n      state.dropInterval = Math.max(0.12, 0.8 - (state.level - 1) * 0.08);\n\n      const label = clearedLines === 4 ? 'TETRIS! +1000' : `+${pts} LINES!`;\n      state.popups.push({\n        id: state.nextId++,\n        x: 100,\n        y: 180,\n        text: label,\n        color: clearedLines === 4 ? '#06B6D4' : '#FACC15',\n        life: 1.2,\n      });\n    }",
    "    const lineMastery = resolveBlockDropLineMastery({\n      clearedLines,\n      level: state.level,\n      clearChain: state.clearChain,\n      backToBack: state.backToBack,\n    });\n    state.clearChain = lineMastery.clearChain;\n    state.backToBack = lineMastery.backToBack;\n\n    if (clearedLines > 0) {\n      state.lines += clearedLines;\n      const pts = [0, 100, 300, 500, 1000][clearedLines] * state.level;\n      state.score += pts + lineMastery.masteryBonus;\n      onScoreUpdate(state.score);\n      if (soundEnabled) sounds.playLineClear();\n\n      state.level = Math.floor(state.lines / 10) + 1;\n      state.dropInterval = Math.max(0.12, 0.8 - (state.level - 1) * 0.08);\n\n      const label = clearedLines === 4 ? `TETRIS! +${pts}` : `+${pts} LINES!`;\n      state.popups.push({\n        id: state.nextId++,\n        x: 100,\n        y: 180,\n        text: label,\n        color: clearedLines === 4 ? '#06B6D4' : '#FACC15',\n        life: 1.2,\n      });\n      if (lineMastery.comboBonus > 0) {\n        state.popups.push({\n          id: state.nextId++,\n          x: 100,\n          y: 205,\n          text: `CLEAR CHAIN x${state.clearChain} +${lineMastery.comboBonus}`,\n          color: '#34D399',\n          life: 1.2,\n        });\n      }\n      if (lineMastery.backToBackBonus > 0) {\n        state.popups.push({\n          id: state.nextId++,\n          x: 100,\n          y: 230,\n          text: `B2B TETRIS +${lineMastery.backToBackBonus}`,\n          color: '#EC4899',\n          life: 1.2,\n        });\n      }\n    }",
    'block clear mastery integration',
)
replace_exact(
    'src/games/BlockDropGame.tsx',
    "    state.nextPieceType = getRandomPieceType();\n    state.currentPiece = spawnPiece(getRandomPieceType());\n    state.holdPieceType = null;\n    state.canHold = true;",
    "    state.pieceBag = [];\n    state.currentPiece = spawnPiece(getRandomPieceType());\n    state.nextPieceType = getRandomPieceType();\n    state.holdPieceType = null;\n    state.canHold = true;\n    state.clearChain = 0;\n    state.backToBack = false;",
    'block initialize bag and mastery',
)
replace_exact(
    'src/games/BlockDropGame.tsx',
    "            prev.holdType === state.holdPieceType &&\n            prev.canHold === state.canHold",
    "            prev.holdType === state.holdPieceType &&\n            prev.canHold === state.canHold &&\n            prev.clearChain === state.clearChain &&\n            prev.backToBack === state.backToBack",
    'block hud equality mastery',
)
replace_exact(
    'src/games/BlockDropGame.tsx',
    "            holdType: state.holdPieceType,\n            canHold: state.canHold,\n          };",
    "            holdType: state.holdPieceType,\n            canHold: state.canHold,\n            clearChain: state.clearChain,\n            backToBack: state.backToBack,\n          };",
    'block hud publication mastery',
)
replace_exact(
    'src/games/BlockDropGame.tsx',
    "          <div className=\"px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-emerald-400 font-mono text-xs font-bold backdrop-blur-md\">\n            LINES: {hudState.lines}\n          </div>\n        </div>",
    "          <div className=\"px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-emerald-400 font-mono text-xs font-bold backdrop-blur-md\">\n            LINES: {hudState.lines}\n          </div>\n          {hudState.clearChain > 1 && (\n            <div className=\"px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-black backdrop-blur-md\">\n              CHAIN x{hudState.clearChain}\n            </div>\n          )}\n          {hudState.backToBack && (\n            <div className=\"px-2.5 py-1 rounded-xl bg-pink-500/15 border border-pink-500/40 text-pink-300 font-mono text-xs font-black backdrop-blur-md\">\n              B2B READY\n            </div>\n          )}\n        </div>",
    'block mastery HUD',
)

# ---------------- Laser Blade: center-cut Razor mastery ----------------
replace_exact(
    'src/games/BladeGame.tsx',
    "import { createBladeLaunchTrajectory, getBladeGravity, getBladeSimulationStepBatch } from '../lib/bladeTrajectory';\n",
    "import { createBladeLaunchTrajectory, getBladeGravity, getBladeSimulationStepBatch } from '../lib/bladeTrajectory';\nimport { resolveBladePrecisionSlice } from '../lib/bladePrecisionMastery';\n",
    'blade precision import',
)
replace_exact(
    'src/games/BladeGame.tsx',
    "    comboTimerRatio: 0,\n    hasShield: false,\n  }, 50);",
    "    comboTimerRatio: 0,\n    hasShield: false,\n    precisionChain: 0,\n  }, 50);",
    'blade precision HUD state',
)
replace_exact(
    'src/games/BladeGame.tsx',
    "    multiplier: 1,\n    isAlive: true,",
    "    multiplier: 1,\n    precisionChain: 0,\n    isAlive: true,",
    'blade precision runtime state',
)
replace_exact(
    'src/games/BladeGame.tsx',
    "          if (target.type === 'bomb') {\n            target.sliced = true;",
    "          if (target.type === 'bomb') {\n            target.sliced = true;\n            state.precisionChain = 0;",
    'blade bomb resets precision',
)
replace_exact(
    'src/games/BladeGame.tsx',
    "          // Points calculation\n          const earned = target.points * mult;\n          state.score += earned;\n          onScoreUpdate(state.score);\n          addPopup(`+${earned}`, target.x, target.y - 15, target.color, 1.0);",
    "          // Optional center-cut mastery. Ordinary valid slices still score normally.\n          const precision = resolveBladePrecisionSlice(dist, target.radius, state.precisionChain);\n          state.precisionChain = precision.chain;\n\n          // Points calculation\n          const earned = target.points * mult;\n          state.score += earned + precision.bonus;\n          onScoreUpdate(state.score);\n          addPopup(`+${earned}`, target.x, target.y - 15, target.color, 1.0);\n          if (precision.precise) {\n            addPopup(\n              precision.razorRush\n                ? `RAZOR RUSH x${precision.chain}! +${precision.bonus}`\n                : `CENTER CUT x${precision.chain} +${precision.bonus}`,\n              target.x,\n              target.y - 34,\n              precision.razorRush ? '#FACC15' : '#38BDF8',\n              precision.razorRush ? 1.3 : 1.05,\n            );\n            if (precision.razorRush && soundEnabled) sounds.playVictory();\n          }",
    'blade precision scoring',
)
replace_exact(
    'src/games/BladeGame.tsx',
    "              state.combo = 0;\n              state.comboTimer = 0;\n              state.multiplier = 1;",
    "              state.combo = 0;\n              state.comboTimer = 0;\n              state.multiplier = 1;\n              state.precisionChain = 0;",
    'blade missed target resets precision',
)
replace_exact(
    'src/games/BladeGame.tsx',
    "    state.multiplier = 1;\n    state.isAlive = true;",
    "    state.multiplier = 1;\n    state.precisionChain = 0;\n    state.isAlive = true;",
    'blade initialize precision',
)
replace_exact(
    'src/games/BladeGame.tsx',
    "          prev.comboTimerRatio === ratio &&\n          prev.hasShield === state.hasShield",
    "          prev.comboTimerRatio === ratio &&\n          prev.hasShield === state.hasShield &&\n          prev.precisionChain === state.precisionChain",
    'blade hud equality precision',
)
replace_exact(
    'src/games/BladeGame.tsx',
    "          comboTimerRatio: ratio,\n          hasShield: state.hasShield,\n        };",
    "          comboTimerRatio: ratio,\n          hasShield: state.hasShield,\n          precisionChain: state.precisionChain,\n        };",
    'blade hud publish precision',
)
replace_exact(
    'src/games/BladeGame.tsx',
    "          {hudState.hasShield && (\n            <div className=\"px-2 py-1 rounded-xl bg-purple-500/20 border border-purple-500/50 text-purple-300 font-mono text-xs font-black flex items-center gap-1\">\n              <Shield className=\"w-3.5 h-3.5\" />\n              <span>SHIELD</span>\n            </div>\n          )}\n        </div>",
    "          {hudState.hasShield && (\n            <div className=\"px-2 py-1 rounded-xl bg-purple-500/20 border border-purple-500/50 text-purple-300 font-mono text-xs font-black flex items-center gap-1\">\n              <Shield className=\"w-3.5 h-3.5\" />\n              <span>SHIELD</span>\n            </div>\n          )}\n          {hudState.precisionChain > 0 && (\n            <div className=\"px-2 py-1 rounded-xl bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 font-mono text-xs font-black\">\n              RAZOR x{hudState.precisionChain}\n            </div>\n          )}\n        </div>",
    'blade Razor HUD',
)
replace_exact(
    'src/games/BladeGame.tsx',
    "        SWIPE / DRAG BLADE TO SLICE • DODGE RED EMP BOMBS",
    "        SWIPE / DRAG TO SLICE • CENTER CUTS BUILD RAZOR • DODGE RED EMP BOMBS",
    'blade mastery footer',
)

# ---------------- Registry teaching ----------------
replace_exact(
    'src/data/games.ts',
    "    description: 'A high-octane 4-lane cyber rhythm game. Notes cascade down the neon highway in sync with energetic procedural synth tracks. Tap the keys ([D], [F], [J], [K] or on-screen lane pads / 1,2,3,4 / Arrows) to trigger PERFECT, GREAT, or GOOD ratings with streak multipliers, combo bursts, and hold-note laser streams.',\n",
    "    description: 'A calibrated 4-lane cyber rhythm game with multiple synth tracks, fixed-ms PERFECT/GREAT/GOOD judgement, combo Overdrive, bonus notes, chords, and real sustained hold-note laser streams.',\n",
    'rhythm registry description',
)
replace_exact(
    'src/data/games.ts',
    "    instructions: 'Tap D/F/J/K or 1/2/3/4 or Arrows when falling beat notes cross the target receptor line.',\n",
    "    instructions: 'Tap D/F/J/K, 1/2/3/4, Arrows, or touch lanes on note heads; for hold notes, keep the input down and hold the lane through the full laser tail.',\n",
    'rhythm registry instructions',
)
replace_exact(
    'src/data/games.ts',
    "    description: 'Classic fast-paced tetromino puzzle action. Drop falling shapes, rotate with precision wall kicks, utilize ghost piece landing previews, and clear full horizontal rows for electrifying line clears.',\n",
    "    description: 'Classic tetromino puzzle action with responsive wall kicks, Hold/Next planning, ghost landings, a fair 7-bag piece stream, consecutive clear chains, and back-to-back Tetris mastery scoring.',\n",
    'block registry description',
)
replace_exact(
    'src/data/games.ts',
    "    instructions: 'Move with Left/Right, rotate with Up/W, soft drop with Down/S, hard drop with Space, and use C/Shift to Hold or swap one piece per placement.',\n",
    "    instructions: 'Plan around the 7-bag and Hold/Next queue. Move with Left/Right, rotate with Up/W, soft drop with Down/S, hard drop with Space, and use C/Shift to Hold; consecutive clears build a chain and consecutive four-line clears earn back-to-back Tetris bonuses.',\n",
    'block registry instructions',
)
replace_exact(
    'src/data/games.ts',
    "    description: 'Swipe and slice flying plasma cores, trigger multi-slice combos, freeze time with Chrono Orbs, and avoid hazard mines.',\n",
    "    description: 'Slice varied airborne plasma targets, chain multi-target swipes, use shields against EMP bombs, and aim through target centers for optional Razor precision chains and milestone rush bonuses.',\n",
    'blade registry description',
)
replace_exact(
    'src/data/games.ts',
    "    instructions: 'Swipe mouse/touch rapidly across flying orbs. Avoid explosive red mines.',\n",
    "    instructions: 'Swipe mouse/touch across targets and avoid red EMP bombs. Any clean hit counts, but center cuts build a Razor chain for escalating precision rewards.',\n",
    'blade registry instructions',
)

print('P14 source patch applied')
