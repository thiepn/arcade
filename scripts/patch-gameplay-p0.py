from pathlib import Path
import json

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text()

def write(path, text):
    (ROOT / path).write_text(text)

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing marker: {label}')
    return text.replace(old, new, 1)

# ---------------------------------------------------------------------------
# 1. MERGE — replace scan-order/right-biased cascading with symmetric resolver.
# ---------------------------------------------------------------------------
p = 'src/games/MergeGame.tsx'
s = read(p)
s = replace_once(
    s,
    "import { Hammer, RefreshCw, Sparkles } from 'lucide-react';\n",
    "import { Hammer, RefreshCw, Sparkles } from 'lucide-react';\nimport { findNextMergeDecision } from '../lib/mergeRules';\n",
    'Merge import',
)
old = '''    while (hadMerge) {
      hadMerge = false;
      for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
          const tile = newBoard[c][r];
          if (!tile) continue;

          // Check below
          if (r < ROWS - 1 && newBoard[c][r + 1]?.val === tile.val) {
            newBoard[c][r + 1] = {
              val: tile.val * 2,
              id: nextTileId.current++,
              isMerging: true,
            };
            newBoard[c][r] = null;
            currentScore += tile.val * 2;
            hadMerge = true;
            mergeStreak++;
            break;
          }
          // Check right
          if (c < COLS - 1 && newBoard[c + 1][r]?.val === tile.val) {
            newBoard[c + 1][r] = {
              val: tile.val * 2,
              id: nextTileId.current++,
              isMerging: true,
            };
            newBoard[c][r] = null;
            currentScore += tile.val * 2;
            hadMerge = true;
            mergeStreak++;
            break;
          }
        }
        if (hadMerge) break;
      }

      // Drop physics
      for (let c = 0; c < COLS; c++) {
        const colTiles = newBoard[c].filter((t) => t !== null) as TileInfo[];
        const newCol: (TileInfo | null)[] = Array(ROWS - colTiles.length)
          .fill(null)
          .concat(colTiles);
        newBoard[c] = newCol;
      }
    }
'''
new = '''    while (hadMerge) {
      const valueBoard = newBoard.map((column) => column.map((tile) => tile?.val ?? null));
      const decision = findNextMergeDecision(valueBoard, colIndex);
      if (!decision) {
        hadMerge = false;
        break;
      }

      newBoard[decision.target.col][decision.target.row] = {
        val: decision.resultValue,
        id: nextTileId.current++,
        isMerging: true,
      };
      newBoard[decision.source.col][decision.source.row] = null;
      currentScore += decision.resultValue;
      mergeStreak++;

      // Gravity remains vertical, but horizontal merge destinations are selected
      // by the mirror-symmetric resolver rather than left-to-right scan order.
      for (let c = 0; c < COLS; c++) {
        const colTiles = newBoard[c].filter((t) => t !== null) as TileInfo[];
        const newCol: (TileInfo | null)[] = Array(ROWS - colTiles.length)
          .fill(null)
          .concat(colTiles);
        newBoard[c] = newCol;
      }
    }
'''
s = replace_once(s, old, new, 'Merge cascade')
write(p, s)

# ---------------------------------------------------------------------------
# 2. ORBIT — restore the documented one-button pulse and mobile parity.
# ---------------------------------------------------------------------------
p = 'src/games/OrbitGame.tsx'
s = read(p)
anchor = '''  const reverseDirection = () => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current) return;

    state.direction *= -1;
    if (soundEnabled) sounds.playPop();
  };
'''
replacement = anchor + '''
  const pulseOrbit = () => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current) return;

    state.currentLane = (state.currentLane + 1) % 3;
    state.targetRadius = state.baseRadii[state.currentLane];
    state.direction *= -1;
    state.warpEffect = 1;
    if (soundEnabled) sounds.playWarp();
  };
'''
s = replace_once(s, anchor, replacement, 'Orbit pulse function')
s = replace_once(
    s,
    '''    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      jumpNextLane();
    };
''',
    '''    const handlePointerDown = (e: PointerEvent) => {
      e.preventDefault();
      pulseOrbit();
    };
''',
    'Orbit pointer handler',
)
s = replace_once(
    s,
    '''      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        jumpNextLane();
''',
    '''      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        pulseOrbit();
''',
    'Orbit space control',
)
s = replace_once(
    s,
    '''    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      canvas.removeEventListener('mousedown', handlePointerDown);
      canvas.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
''',
    '''    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
''',
    'Orbit pointer listeners',
)
write(p, s)

p = 'src/data/games.ts'
s = read(p)
s = replace_once(
    s,
    "    instructions: 'Tap/Space to invert orbit direction and switch lane.',\n    controlsHint: 'Click / Tap / Space',\n",
    "    instructions: 'Tap/Space pulses to shift one lane and reverse direction. Up/Down changes lane only; Left/Right or A/D reverses direction only.',\n    controlsHint: 'Tap / Space: Pulse • Up/Down: Lane • A/D: Reverse',\n",
    'Orbit registry instructions',
)
write(p, s)

# ---------------------------------------------------------------------------
# 3. RHYTHM — fixed millisecond windows + user-visible latency compensation.
# ---------------------------------------------------------------------------
p = 'src/games/RhythmGame.tsx'
s = read(p)
s = replace_once(
    s,
    "import { useGameLoop, useSafeTimeout, useRenderPublishedState } from '../hooks/useGameLoop';\n",
    "import { useGameLoop, useSafeTimeout, useRenderPublishedState } from '../hooks/useGameLoop';\nimport {\n  RHYTHM_HIT_WINDOWS_MS,\n  RHYTHM_LATENCY_STEP_MS,\n  RHYTHM_LATENCY_STORAGE_KEY,\n  RHYTHM_MISS_WINDOW_MS,\n  clampRhythmLatencyOffset,\n  getLatencyCompensatedBeat,\n  getSignedTimingErrorMs,\n} from '../lib/rhythmTiming';\n",
    'Rhythm timing import',
)
marker = '''  const [selectedSongIndex, setSelectedSongIndex] = useState(0);
  const currentSong = RHYTHM_SONGS[selectedSongIndex];

'''
latency_state = '''  const [selectedSongIndex, setSelectedSongIndex] = useState(0);
  const currentSong = RHYTHM_SONGS[selectedSongIndex];
  const [latencyOffsetMs, setLatencyOffsetMs] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const stored = Number(window.localStorage.getItem(RHYTHM_LATENCY_STORAGE_KEY));
    return Number.isFinite(stored) ? clampRhythmLatencyOffset(stored) : 0;
  });
  const latencyOffsetRef = useRef(latencyOffsetMs);
  latencyOffsetRef.current = latencyOffsetMs;
  const [estimatedLatencyMs, setEstimatedLatencyMs] = useState(0);

  const updateLatencyOffset = useCallback((value: number) => {
    const next = clampRhythmLatencyOffset(value);
    latencyOffsetRef.current = next;
    setLatencyOffsetMs(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RHYTHM_LATENCY_STORAGE_KEY, String(next));
    }
  }, []);

'''
s = replace_once(s, marker, latency_state, 'Rhythm latency state')
old = '''    // Musical timing windows
    const WINDOW_PERFECT = 0.20;
    const WINDOW_GREAT = 0.38;
    const WINDOW_GOOD = 0.60;

    let closestNote: ActiveNote | null = null;
    let closestBeatDelta = Infinity;

    for (const note of state.notes) {
      if (note.lane === laneIndex && !note.isHit && !note.isMissed) {
        const delta = Math.abs(note.beatTime - state.currentBeat);
        if (delta < closestBeatDelta && delta <= WINDOW_GOOD) {
          closestBeatDelta = delta;
          closestNote = note;
        }
      }
    }
'''
new = '''    const judgementBeat = getLatencyCompensatedBeat(
      state.currentBeat,
      state.song.bpm,
      latencyOffsetRef.current,
    );
    let closestNote: ActiveNote | null = null;
    let closestTimingErrorMs = Infinity;
    let closestSignedErrorMs = 0;

    for (const note of state.notes) {
      if (note.lane === laneIndex && !note.isHit && !note.isMissed) {
        const signedErrorMs = getSignedTimingErrorMs(note.beatTime, judgementBeat, state.song.bpm);
        const timingErrorMs = Math.abs(signedErrorMs);
        if (timingErrorMs < closestTimingErrorMs && timingErrorMs <= RHYTHM_HIT_WINDOWS_MS.good) {
          closestTimingErrorMs = timingErrorMs;
          closestSignedErrorMs = signedErrorMs;
          closestNote = note;
        }
      }
    }
'''
s = replace_once(s, old, new, 'Rhythm judgement search')
s = replace_once(s, '      if (closestBeatDelta <= WINDOW_PERFECT) {\n', '      if (closestTimingErrorMs <= RHYTHM_HIT_WINDOWS_MS.perfect) {\n', 'Rhythm perfect window')
s = replace_once(s, '      } else if (closestBeatDelta <= WINDOW_GREAT) {\n', '      } else if (closestTimingErrorMs <= RHYTHM_HIT_WINDOWS_MS.great) {\n', 'Rhythm great window')
s = replace_once(
    s,
    "        subtext: `+${earned.toLocaleString()}`,\n",
    "        subtext: `${closestSignedErrorMs > 0 ? '+' : ''}${Math.round(closestSignedErrorMs)}ms • +${earned.toLocaleString()}`,\n",
    'Rhythm timing popup',
)
# Estimate browser audio output latency after the engine has initialized.
marker = '''  // Sync mute state to music engine
  useEffect(() => {
    musicEngine.setMuted(!soundEnabled);
  }, [soundEnabled]);

'''
replacement = marker + '''  useEffect(() => {
    setEstimatedLatencyMs(musicEngine.getEstimatedOutputLatencyMs());
  }, [selectedSongIndex, soundEnabled]);

'''
s = replace_once(s, marker, replacement, 'Rhythm audio estimate effect')
old = '''        // Update active notes: check missed notes (fallen past hit zone)
        const MISS_THRESHOLD_BEATS = 0.65;
        for (const note of state.notes) {
          if (!note.isHit && !note.isMissed && state.currentBeat - note.beatTime > MISS_THRESHOLD_BEATS) {
'''
new = '''        // Update active notes using the same fixed-ms, latency-compensated clock as judgement.
        const judgementBeat = getLatencyCompensatedBeat(
          state.currentBeat,
          state.song.bpm,
          latencyOffsetRef.current,
        );
        for (const note of state.notes) {
          const lateByMs = getSignedTimingErrorMs(note.beatTime, judgementBeat, state.song.bpm);
          if (!note.isHit && !note.isMissed && lateByMs > RHYTHM_MISS_WINDOW_MS) {
'''
s = replace_once(s, old, new, 'Rhythm miss window')
# Render note positions on the compensated clock so visual receptors and judged input agree.
s = replace_once(
    s,
    '''      const laneW = curW / 4;
      const HIT_Y = 0.86 * curH;
''',
    '''      const laneW = curW / 4;
      const HIT_Y = 0.86 * curH;
      const displayBeat = getLatencyCompensatedBeat(
        state.currentBeat,
        state.song.bpm,
        latencyOffsetRef.current,
      );
''',
    'Rhythm display clock',
)
s = replace_once(s, '        const delta = n.beatTime - state.currentBeat;\n', '        const delta = n.beatTime - displayBeat;\n', 'Rhythm visible note clock')
s = replace_once(s, '          const beatsRemaining = chordGroup[0].beatTime - state.currentBeat;\n', '          const beatsRemaining = chordGroup[0].beatTime - displayBeat;\n', 'Rhythm chord clock')
s = replace_once(s, '        const beatsRemaining = note.beatTime - state.currentBeat;\n', '        const beatsRemaining = note.beatTime - displayBeat;\n', 'Rhythm note clock')
# Compact latency UI next to track selector.
marker = '''          </div>

          {/* Section Indicator */}
'''
ui = '''          </div>

          <div
            className="flex items-center rounded-xl bg-[#18181B]/95 border border-[#27272A] overflow-hidden font-mono text-[10px]"
            title={`Audio sync compensation. Browser estimate: ${estimatedLatencyMs}ms. Positive values delay visual/judgement timing to match delayed audio.`}
          >
            <button
              type="button"
              onClick={() => updateLatencyOffset(latencyOffsetMs - RHYTHM_LATENCY_STEP_MS)}
              className="px-2 py-1 text-[#A1A1AA] hover:text-white hover:bg-[#27272A] cursor-pointer"
              aria-label="Reduce rhythm latency compensation by 10 milliseconds"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => updateLatencyOffset(estimatedLatencyMs)}
              className="px-1.5 py-1 text-cyan-300 hover:text-white hover:bg-[#27272A] cursor-pointer tabular-nums"
              title="Use the browser's estimated audio output latency"
            >
              SYNC {latencyOffsetMs >= 0 ? '+' : ''}{latencyOffsetMs}ms
            </button>
            <button
              type="button"
              onClick={() => updateLatencyOffset(latencyOffsetMs + RHYTHM_LATENCY_STEP_MS)}
              className="px-2 py-1 text-[#A1A1AA] hover:text-white hover:bg-[#27272A] cursor-pointer"
              aria-label="Increase rhythm latency compensation by 10 milliseconds"
            >
              +
            </button>
          </div>

          {/* Section Indicator */}
'''
s = replace_once(s, marker, ui, 'Rhythm sync UI')
write(p, s)

p = 'src/lib/rhythmSongs.ts'
s = read(p)
marker = '''  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.35, this.ctx.currentTime);
    }
  }

'''
replacement = marker + '''  public getEstimatedOutputLatencyMs() {
    this.init();
    if (!this.ctx) return 0;
    const outputLatency = Number(
      (this.ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0,
    );
    const baseLatency = Number(this.ctx.baseLatency ?? 0);
    const totalSeconds = Math.max(0, baseLatency) + Math.max(0, outputLatency);
    return Math.round(Math.min(0.2, totalSeconds) * 1000);
  }

'''
s = replace_once(s, marker, replacement, 'Rhythm engine latency estimate')
write(p, s)

# ---------------------------------------------------------------------------
# 4. AIR HOCKEY — cap human pointer speed and make AI reaction imperfect.
# ---------------------------------------------------------------------------
p = 'src/games/AirHockeyGame.tsx'
s = read(p)
s = replace_once(
    s,
    "import { getAirHockeyTableLayout } from '../lib/airHockeyLayout';\n",
    "import { getAirHockeyTableLayout } from '../lib/airHockeyLayout';\nimport {\n  AIR_HOCKEY_DIFFICULTY_CONFIG as DIFFICULTY_CONFIG,\n  AIR_HOCKEY_MAX_PUCK_SPEED,\n  AIR_HOCKEY_PLAYER_MAX_SPEED,\n  advanceMalletTowardsTarget,\n  capAirHockeyVelocity,\n  type AirHockeyDifficultyLevel,\n} from '../lib/airHockeyFairness';\n",
    'Air Hockey fairness import',
)
start = s.index("type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD';")
end = s.index("\n\nexport const AirHockeyGame", start)
s = s[:start] + "type DifficultyLevel = AirHockeyDifficultyLevel;" + s[end:]
s = replace_once(
    s,
    '''    targetPlayerX: 200,
    targetPlayerY: 400,

    goalWidth: 140,
''',
    '''    targetPlayerX: 200,
    targetPlayerY: 400,
    aiTargetX: 200,
    aiTargetY: 100,
    aiDecisionCooldown: 0,

    goalWidth: 140,
''',
    'Air Hockey AI decision state',
)
s = replace_once(
    s,
    '''    state.puck.vx = (Math.random() - 0.5) * 60;
    state.puck.vy = 150;
''',
    '''    state.puck.vx = (Math.random() - 0.5) * 60;
    state.puck.vy = 150;
    state.aiDecisionCooldown = 0;
''',
    'Air Hockey init decision reset',
)
s = replace_once(
    s,
    '''      state.goalWidth = newTable.goalWidth;
      state.viewportWidth = w;
      state.viewportHeight = h;
''',
    '''      state.goalWidth = newTable.goalWidth;
      state.viewportWidth = w;
      state.viewportHeight = h;
      state.aiDecisionCooldown = 0;
''',
    'Air Hockey resize decision reset',
)
old = '''        state.playerMallet.vx = (boundedTargetX - state.playerMallet.x) / Math.max(0.016, dt);
        state.playerMallet.vy = (boundedTargetY - state.playerMallet.y) / Math.max(0.016, dt);
        state.playerMallet.x = boundedTargetX;
        state.playerMallet.y = boundedTargetY;
'''
new = '''        const playerMotion = advanceMalletTowardsTarget(
          state.playerMallet.x,
          state.playerMallet.y,
          boundedTargetX,
          boundedTargetY,
          AIR_HOCKEY_PLAYER_MAX_SPEED * table.motionScale,
          dt,
        );
        Object.assign(state.playerMallet, playerMotion);
'''
s = replace_once(s, old, new, 'Air Hockey player speed cap')
old = '''        let aiTargetX = aiHomeX;
        let aiTargetY = aiHomeY;

        const aiMinX = tableLeft + state.aiMallet.radius + 6;
        const aiMaxX = tableRight - state.aiMallet.radius - 6;
        const aiMinY = tableTop + state.aiMallet.radius + 6;
        const aiMaxY = centerY - state.aiMallet.radius - 10;

        if (state.puck.y < centerY + 20) {
          if (state.puck.y < state.aiMallet.y - 4) {
            aiTargetX = state.puck.x > tableCenterX
              ? aiMinX + 25 * table.motionScale
              : aiMaxX - 25 * table.motionScale;
            aiTargetY = Math.max(aiMinY, state.puck.y - 10 * table.motionScale);
          } else {
            const predX = state.puck.x + state.puck.vx * diffConfig.predFactor;
            aiTargetX = Math.max(aiMinX, Math.min(aiMaxX, predX));
            aiTargetY = Math.min(aiMaxY, Math.max(aiMinY, state.puck.y - 18));
          }
        } else {
          const guardFactor = (state.puck.x - tableCenterX) / (tableRight - tableLeft);
          aiTargetX = tableCenterX + guardFactor * 50 * table.motionScale;
          aiTargetY = aiHomeY;
        }

        aiTargetX = Math.max(aiMinX, Math.min(aiMaxX, aiTargetX));
        aiTargetY = Math.max(aiMinY, Math.min(aiMaxY, aiTargetY));

        const aiSpeed = diffConfig.aiSpeed * table.motionScale;
        const aiDX = aiTargetX - state.aiMallet.x;
        const aiDY = aiTargetY - state.aiMallet.y;
        const aiDist = Math.hypot(aiDX, aiDY);

        if (aiDist > 2) {
          state.aiMallet.vx = (aiDX / aiDist) * Math.min(aiSpeed, aiDist / dt);
          state.aiMallet.vy = (aiDY / aiDist) * Math.min(aiSpeed, aiDist / dt);
        } else {
          state.aiMallet.vx = 0;
          state.aiMallet.vy = 0;
        }

        state.aiMallet.x += state.aiMallet.vx * dt;
        state.aiMallet.y += state.aiMallet.vy * dt;
'''
new = '''        const aiMinX = tableLeft + state.aiMallet.radius + 6;
        const aiMaxX = tableRight - state.aiMallet.radius - 6;
        const aiMinY = tableTop + state.aiMallet.radius + 6;
        const aiMaxY = centerY - state.aiMallet.radius - 10;

        state.aiDecisionCooldown -= dt;
        if (state.aiDecisionCooldown <= 0) {
          state.aiDecisionCooldown = diffConfig.reactionMs / 1000;
          let aiTargetX = aiHomeX;
          let aiTargetY = aiHomeY;

          if (state.puck.y < centerY + 20) {
            if (state.puck.y < state.aiMallet.y - 4) {
              aiTargetX = state.puck.x > tableCenterX
                ? aiMinX + 25 * table.motionScale
                : aiMaxX - 25 * table.motionScale;
              aiTargetY = Math.max(aiMinY, state.puck.y - 10 * table.motionScale);
            } else {
              const predX = state.puck.x + state.puck.vx * diffConfig.predictionSeconds;
              aiTargetX = Math.max(aiMinX, Math.min(aiMaxX, predX));
              aiTargetY = Math.min(aiMaxY, Math.max(aiMinY, state.puck.y - 18));
            }
          } else {
            const guardFactor = (state.puck.x - tableCenterX) / (tableRight - tableLeft);
            aiTargetX = tableCenterX + guardFactor * 50 * table.motionScale;
            aiTargetY = aiHomeY;
          }

          aiTargetX += (Math.random() - 0.5) * 2 * diffConfig.aimErrorPx * table.motionScale;
          state.aiTargetX = Math.max(aiMinX, Math.min(aiMaxX, aiTargetX));
          state.aiTargetY = Math.max(aiMinY, Math.min(aiMaxY, aiTargetY));
        }

        const aiMotion = advanceMalletTowardsTarget(
          state.aiMallet.x,
          state.aiMallet.y,
          state.aiTargetX,
          state.aiTargetY,
          diffConfig.aiSpeed * table.motionScale,
          dt,
        );
        Object.assign(state.aiMallet, aiMotion);
'''
s = replace_once(s, old, new, 'Air Hockey AI fairness block')
old = '''        const pSpeed = Math.hypot(puck.vx, puck.vy);
        const maxSpeed = 680 * table.motionScale;
        if (pSpeed > maxSpeed) {
          puck.vx = (puck.vx / pSpeed) * maxSpeed;
          puck.vy = (puck.vy / pSpeed) * maxSpeed;
        }
'''
new = '''        const maxSpeed = AIR_HOCKEY_MAX_PUCK_SPEED * table.motionScale;
        const cappedPuck = capAirHockeyVelocity(puck.vx, puck.vy, maxSpeed);
        puck.vx = cappedPuck.vx;
        puck.vy = cappedPuck.vy;
'''
s = replace_once(s, old, new, 'Air Hockey pre-collision puck cap')
s = replace_once(
    s,
    '''        checkMalletHit(state.playerMallet, true);
        checkMalletHit(state.aiMallet, false);

''',
    '''        checkMalletHit(state.playerMallet, true);
        checkMalletHit(state.aiMallet, false);
        const postHitPuck = capAirHockeyVelocity(puck.vx, puck.vy, maxSpeed);
        puck.vx = postHitPuck.vx;
        puck.vy = postHitPuck.vy;

''',
    'Air Hockey post-hit puck cap',
)
write(p, s)

# ---------------------------------------------------------------------------
# 5. Permanent quality/release wiring (CI workflow is connector-updated later).
# ---------------------------------------------------------------------------
p = 'package.json'
data = json.loads(read(p))
scripts = data['scripts']
if 'quality:gameplay-p0' not in scripts:
    out = {}
    inserted = False
    for key, value in scripts.items():
        out[key] = value
        if key == 'quality:hud-render':
            out['quality:gameplay-p0'] = 'bun scripts/audit-gameplay-p0.ts'
            inserted = True
    if not inserted:
        raise SystemExit('package quality:hud-render marker missing')
    data['scripts'] = out
write(p, json.dumps(data, indent=2) + '\n')

p = 'scripts/audit-release-32.ts'
s = read(p)
if "'quality:gameplay-p0'" not in s:
    s = replace_once(s, "  'quality:hud-render',\n", "  'quality:hud-render',\n  'quality:gameplay-p0',\n", 'release gameplay gate')
if "'scripts/audit-gameplay-p0.ts'" not in s:
    s = replace_once(s, "  'scripts/audit-hud-render-performance.ts',\n", "  'scripts/audit-hud-render-performance.ts',\n  'scripts/audit-gameplay-p0.ts',\n", 'release gameplay audit')
write(p, s)

print('P0 gameplay/fairness patch applied.')
