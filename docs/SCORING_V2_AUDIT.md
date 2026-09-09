# Micro Arcade — Scoring v2 audit and implementation

Date: 9 September 2026. Audited baseline: `77e563f3131c4fda171bf037db4ec447ac67a36f`.
Scope: all 32 registered cabinets, 36 selectable cabinet/mode configurations, shared score delivery, local records and both leaderboard backend implementations.

## Verdict and evidence limits

The previous point economies were not comparable. Stack awards units per placement while several action games award hundreds or thousands per event; Chain compounded chain length twice, Drift accumulated points every fixed tick, and Rhythm could combine an 8x streak with 2x Overdrive. Adding these native totals gave the units themselves competitive importance.

There was also a separate aggregation inconsistency. The local championship profile weighted raw high scores, achievement XP and play volume. The production overall/weekly SQL instead awarded 1,000 per game played plus a small raw-total term capped at 999. That formula prioritised participation breadth over performance: even extremely weak extra-game results could outweigh substantial skill improvements. Neither is retained.

This release replaces both with calibrated Arcade Points (AP), corrects five runaway native reward economies, and limits any one cabinet's overall-rating contribution. It does not make every cabinet mechanically identical, remove optional risk modes, shorten endless games, or award points for waiting.

**Score and AP are intentionally different concepts.** Score is the game-authored raw counter used inside that cabinet; AP is derived from that raw Score only at the arcade/leaderboard boundary. A game may legitimately show 18 Score or 180,000 Score, while AP places equivalent levels of performance onto a comparable competitive scale. AP must never replace the game's Score display.

**These are initial source-derived calibration anchors, not measured human percentiles.** At audit time the live database held only two submitted runs: Stack 18 native points in approximately 23 seconds and Reaction 4,964 in approximately 31 seconds. They cannot establish cross-game skill or difficulty distributions. Historical local-only play is not present in that database. The deterministic tests establish mathematical and integration properties; they do not establish that every human finds every game equally difficult.

## Plan executed

1. Trace engine event rewards, streak multipliers, stage/loop termination, selected difficulties, score callbacks, storage, achievements and server ranking.
2. Reduce compounding rewards where the event economy itself is excessive; keep the native engine counters internally so score-dependent level progression elsewhere is not accidentally retuned.
3. Apply one versioned, monotone AP conversion at the score boundary, with explicit per-game benchmarks and density-aware Rhythm chart profiles.
4. Use best-per-cabinet AP for ranking, with a bounded overall contribution and an uncapped displayed total/per-game record.
5. Preserve native historical evidence, migrate old records once, bind modes/versions to server sessions and recompute AP server-side.
6. Add permanent formula, migration, storage, actual Worker-handler and browser-boundary tests. Preserve the existing game and responsive regression gates.

## Comparable points without identical games

Each game has three native-counter anchors `a < b < c`, mapped to 1,000 / 3,000 / 6,000 AP. They represent an initial developing / strong / mastery design budget, **not** a percentile claim. Linear interpolation applies between anchors:

```
r <= a:  1000 * r / a
r <= b:  1000 + 2000 * (r - a) / (b - a)
r <= c:  3000 + 3000 * (r - b) / (c - b)
r >  c:  6000 + 2000 * log2(r / c)
```

Values are floored to whole AP after a tiny shared floating-point boundary tolerance. Rhythm then uses the documented chart reward factor. Zero performance earns zero. More positive native performance never reduces AP. Beyond mastery, doubling the native total earns a further 2,000 AP before the chart factor: 6,000 → 8,000 → 10,000 → 12,000. Endless play is not hard-capped or stopped at those values.

This deliberately gives diminishing marginal AP for extreme records rather than allowing compounding counters to monopolise the arcade. It also means an additional very small event can be hidden by integer rounding until subsequent events cross the next AP boundary. Finite games still end at their authored round/sector limits, so their achievable maximum is determined by those rounds rather than an arbitrary universal score ceiling. Longer survival earns points through gameplay events and active survival counters; paused time, lobby time and puzzle thinking time have no AP bonus.

The highest supported safe-integer native input maps to fewer than 150,000 AP in every configured game/mode. Normal run budgets are much smaller. This is a mathematical guard against the million-point display problem, not proof that an unusually high input was earned legitimately.

### Complete cabinet calibration

The three numeric columns are **native engine counters**. Native **Score** and normalized **Arcade Points (AP)** are separate values by contract: each game HUD and result surface keeps showing its own raw/native Score, while the shared GameShell shows AP beside it as the cross-game competitive value. Local storage preserves both the raw-score personal best and the AP personal best. Per-game and overall rankings use AP only; per-game leaderboard rows may show the associated raw Score as secondary context. Event popups remain in native score units.

| Cabinet | Run structure | Native at 1,000 AP | Native at 3,000 AP | Native at 6,000 AP | Reward/progression basis and engine source |
|---|---|---:|---:|---:|---|
| Orbit | endless | 1,500 | 6,500 | 18,000 | Route orbs, grazes and formation chains; only resolved threats award mastery. [`OrbitGame.tsx`](../src/games/OrbitGame.tsx) |
| Stack | endless | 12 | 45 | 120 | Physical placements plus bounded Focus and blueprint bonuses. Low native unit values are upscaled. [`StackGame.tsx`](../src/games/StackGame.tsx) |
| Reaction | finite | 4,500 | 14,000 | 24,000 | Eight core trials plus three qualified overtime trials; correct choices, latency and clean circuits. [`ReactionGame.tsx`](../src/games/ReactionGame.tsx) |
| Dodge | endless | 3,500 | 14,000 | 40,000 | Active survival plus combo, phase-cut and pickup rewards. [`DodgeGame.tsx`](../src/games/DodgeGame.tsx) |
| Pulse | endless | 8,000 | 32,000 | 85,000 | Timing grades, bounded perfect streaks, wagers and authored paths. [`PulseGame.tsx`](../src/games/PulseGame.tsx) |
| Merge | puzzle | 1,500 | 10,000 | 50,000 | Tile merge values and earned contracts; thinking time alone never earns points. [`MergeGame.tsx`](../src/games/MergeGame.tsx) |
| Type Rush | endless | 10,000 | 100,000 | 350,000 | Word length, four pressure waves, accuracy chains and priority targets. [`TypeRushGame.tsx`](../src/games/TypeRushGame.tsx) |
| One Line | endless-puzzle | 3,000 | 14,000 | 40,000 | Collected stars, stage clears, ink/attempt quality and route mastery. [`OneLineGame.tsx`](../src/games/OneLineGame.tsx) |
| Breakout Mini | endless | 5,000 | 25,000 | 90,000 | Brick HP, board clears, catches and contracts; later rounds keep contributing. [`BreakoutGame.tsx`](../src/games/BreakoutGame.tsx) |
| Perfect Stop | finite | 4,000 | 13,000 | 25,000 | Seven sectors plus three qualified Encore sectors; precision and route bonuses. [`PerfectStopGame.tsx`](../src/games/PerfectStopGame.tsx) |
| Chain | endless | 7,000 | 30,000 | 100,000 | Bounded per-orb chain factor plus wave clears, conserved charges and Resonance. [`ChainGame.tsx`](../src/games/ChainGame.tsx) |
| Gravity | finite | 2,500 | 8,500 | 16,000 | Five authored sectors, cores, optional flight contracts and final clear bonus. [`GravityGame.tsx`](../src/games/GravityGame.tsx) |
| Laser Blade | endless | 5,000 | 22,000 | 75,000 | Slices, precision cuts, chained targets and wave phrase bonuses. [`BladeGame.tsx`](../src/games/BladeGame.tsx) |
| Neon Pinball | endless | 8,000 | 40,000 | 140,000 | Bumpers, targets, missions and a capped 5x table multiplier across three balls. [`PinballGame.tsx`](../src/games/PinballGame.tsx) |
| Chrono Wave | endless | 2,500 | 9,500 | 28,000 | Cleared walls, Focus precision, stages and earned pickups. [`ChronoGame.tsx`](../src/games/ChronoGame.tsx) |
| Memory Matrix | endless | 2,500 | 11,000 | 35,000 | Correct sequence steps and timed clears; optional Overclock adds real memory load. [`MatrixGame.tsx`](../src/games/MatrixGame.tsx) |
| Cyber Drift | endless | 5,000 | 22,000 | 70,000 | Fixed 60-Hz active drifting, slower-earned combo tiers, near misses and style routes. [`DriftGame.tsx`](../src/games/DriftGame.tsx) |
| Galaxy Vanguard | endless | 8,000 | 45,000 | 180,000 | Enemy kills, escalating waves, bosses and special threat bonuses. [`VanguardGame.tsx`](../src/games/VanguardGame.tsx) |
| Orbital Slingshot | endless | 6,000 | 28,000 | 100,000 | Successful captures, launch quality, stardust and completed sector missions. [`SlingshotGame.tsx`](../src/games/SlingshotGame.tsx) |
| Cyber Serpent | endless | 3,000 | 16,000 | 50,000 | Food, bounded temporary multipliers, growth and firewall mastery. [`SnakeGame.tsx`](../src/games/SnakeGame.tsx) |
| Neon Rhythm Tapper | looping | 35,000 | 145,000 | 290,000 | Three authored charts loop while Groove survives. Per-chart density normalization, 0.85x Easy / 1x Medium / 1.3x Hard, and continued but diminishing AP after each mastery benchmark. [`RhythmGame.tsx`](../src/games/RhythmGame.tsx) |
| Gravity Tower Jumper | endless | 8,000 | 32,000 | 100,000 | New altitude, precision landings, gems and voluntary Apex risk. [`TowerGame.tsx`](../src/games/TowerGame.tsx) |
| Cyber Pac-Runner | endless | 1,500 | 6,500 | 22,000 | Pellets, ghosts, level clears, fruit and optional Hunt Rush. [`PacMazeGame.tsx`](../src/games/PacMazeGame.tsx) |
| Aero Pulse | endless | 1,500 | 9,000 | 32,000 | Gates, stars, safe grazes and faster optional Flow routes. [`FlappyAeroGame.tsx`](../src/games/FlappyAeroGame.tsx) |
| Cyber Crosser | endless | 800 | 5,000 | 18,000 | New forward rows, coins and district checkpoints; backtracking cannot farm rows. [`RoadCrossGame.tsx`](../src/games/RoadCrossGame.tsx) |
| Orb Cannon | endless | 7,000 | 35,000 | 120,000 | Matches, detached cascades, earned Burst and salvo contracts. [`BubbleBusterGame.tsx`](../src/games/BubbleBusterGame.tsx) |
| Astro Blaster 360 | endless | 4,000 | 18,000 | 65,000 | Asteroid sizes, UFOs and wave-clear bonuses. [`AstroBlasterGame.tsx`](../src/games/AstroBlasterGame.tsx) |
| Laser Rope Reflex | endless | 5,000 | 24,000 | 80,000 | Successful beam crossings, orbs, Fever, choreography and voluntary Redline. [`LaserRopeGame.tsx`](../src/games/LaserRopeGame.tsx) |
| Cyber Block Drop | endless | 1,500 | 12,000 | 55,000 | Drops, line clears, level multipliers, back-to-back and clear chains. [`BlockDropGame.tsx`](../src/games/BlockDropGame.tsx) |
| Knife Target | endless | 4,500 | 22,000 | 65,000 | Landed blades, apples, Razor marks and escalating stage clears. [`KnifeTargetGame.tsx`](../src/games/KnifeTargetGame.tsx) |
| Neon Puck Smash | timed | 1,500 | 7,000 | 20,000 | 60-second match. Goal rewards already scale Casual 1x, Pro 1.75x, Master 2.5x. [`AirHockeyGame.tsx`](../src/games/AirHockeyGame.tsx) |
| Neon Rail Shift | endless | 10,000 | 40,000 | 110,000 | Active survival, coins, phase cores and optional faster Surge routes. [`NeonRailShiftGame.tsx`](../src/games/NeonRailShiftGame.tsx) |

Native rules and risk modifiers not among the five reductions remain intact: route/orb precision, stage clears, voluntary Overclock, Apex, Surge, Redline, Hunt Rush, Focus, contracts, Fever and similar earned gameplay states still increase native performance under their existing conditions. Because the AP map is monotone, they continue to improve the result. They do not create extra cabinet slots in overall ranking. Existing permanent game audits cover their lifecycle, reward and input contracts; this release does not claim to have run a factorial human trial of every optional-state combination.

### Selected difficulty modes

**Neon Puck Smash:** Casual / Pro / Master (`EASY` / `MEDIUM` / `HARD`) retain 500 / 875 / 1,250 native points per goal before the existing bounded combo and earned Power Play. These already encode difficulty rewards; there is no second AP difficulty multiplier. Six consecutive goals under the same conditions, excluding Power Play, yield approximately **3,461 / 5,019 / 6,339 AP** respectively. This compares matched performance, not expected win rates against each AI.

**Neon Rhythm Tapper:** the three charts have different note densities and durations. Each is calibrated separately, then harder charts receive a higher reward factor:

| Chart | Difficulty | Native anchors | AP factor |
|---|---|---|---:|
| Neon Midnight Drive (`neon_midnight`) | Easy | 30,000 / 125,000 / 250,000 | 0.85 |
| Cyber City Odyssey (`cyber_odyssey`) | Medium | 35,000 / 145,000 / 290,000 | 1.00 |
| Hypernova (`hypernova`) | Hard | 36,000 / 150,000 / 300,000 | 1.30 |

**Rhythm is a looping survival game, not a one-song finite challenge.** Finishing a chart loops it while Groove survives. The curve continues rewarding later loops. A chart-completion bonus is no longer granted after the same update has already killed the run. Switching charts updates the mode-bound session; it cannot create additional overall game entries.

## Native inflation corrections

| Game | Previous problem | Implemented rule | Deterministic comparison |
|---|---|---|---|
| Chain | Orb value multiplied chain length by an additional growing chain tier; accumulated wave reward grew cubically | Per-orb factor starts at 1x, rises by 0.15 per link and stops at 2.8x; special orb 2x; wave/charge/Resonance rewards remain | 36 ordinary orbs: **625,800 → 12,474 native**, about 50.2x lower, excluding clear bonuses |
| Cyber Drift | 10/20 native per fixed tick multiplied by up to 6x; each tier earned in about half a second | 1/2 native per tick, up to 6x; each tier now needs 180 ticks (3 seconds) | 60 seconds already at 6x without boost: **216,000 → 21,600 native**, excluding style rewards and initial ramp |
| Pulse | High perfect streak: 250 × 6 × 3 = 4,500, versus Great 240 | Perfect streak factor capped at 2x; established streak bonus 1.5x | Maximum perfect event **4,500 → 750 native**; perfect/Great ratio falls from 18.75x to 3.125x |
| Memory Matrix | Each correct step earned 100 + 25 × unbounded combo | Combo term saturates at 20; base step at most 600 | Longer sequences and harder Overclock remain worthwhile without indefinitely growing per-step base value |
| Neon Rhythm Tapper | Streak ladder reached 8x, then Overdrive doubled it | Streak ladder 1 / 1.25 / 1.5 / 1.75 / 2; Overdrive 1.5x | Combined maximum multiplier **16x → 3x**, with hold and precision bonuses retained |

These tests call the actual helpers imported by the engines, not a separate guessed implementation.

### Finite and looping score-budget checks

Reaction uses the actual eight main and three overtime round definitions and clean SPEED circuit bonuses. The mathematical zero-latency budget is 31,706 native / **6,803 AP**; this is not human-achievable reaction time. Correct 200 ms trials produce **6,108 AP**, 400 ms **4,236 AP**, and 650 ms **2,210 AP**. The old backend's 10,000-native ceiling could reject legitimate overtime runs; its coarse acceptance range now includes the authored budget.

Perfect Stop's ten perfect main/Encore results with primary-route rewards model **32,590 native / 6,765 AP**. Gravity keeps its five-sector finish and final-clear reward rather than being falsely treated as infinite. One Line continues generating stages until failure and is explicitly classified as an endless puzzle.

An optimistic Rhythm ideal-event budget, using the actual authored notes with an upper allowance for earned Overdrive and completed holds, produces:

| Chart | Approximate first-loop length | Old native budget | New native budget | First-loop AP | Two-times-native AP |
|---|---:|---:|---:|---:|---:|
| Easy | 99.3 s | 1,443,904 | 295,371 | 5,509 | 7,209 |
| Medium | 90.0 s | 1,714,462 | 345,029 | 6,501 | 8,501 |
| Hard | 75.8 s | 1,755,256 | 354,319 | 8,424 | 11,024 |

These are source-derived **budget models**, not observed runs or a proven optimal input sequence. Overdrive timing and hold-tail interactions can lower actual achievable results. The final column models twice the first-loop native budget, not an exact second-loop replay. It verifies continued rewards and sensible matched-performance difficulty ordering.

## Overall and weekly competition

```
Arcade rating = sum over the 32 cabinets of min(best cabinet AP, 10,000)
Total AP      = sum over the 32 cabinets of best cabinet AP
```

One best record is selected per cabinet, across its modes. Weekly ranking uses the best submission in that UTC week per cabinet. Replaying a game, changing its mode, or submitting the same points does not add another contribution. Positive performance counts; zero-score attendance does not earn rating. The deterministic tie order uses rating, then total AP, then achievement time, then player ID.

One specialist can contribute at most 10,000 rating. Four 3,000-AP records contribute 12,000 and therefore beat any one-game specialist. Records above 10,000 still raise Total AP, per-game standings and personal records. The cap protects the **overall** competition, not the game itself. The all-cabinet rating ceiling is 320,000. Achievement XP and play counts remain profile/progression information but no longer determine competitive rank.

## Historical records and compatibility

There is no player identity reset and no deletion of recorded history. Local storage moves to a separate `micro_arcade_stats_v2` key, archives original native personal bests in `legacyHighScores`, preserves settings/favourites/time/play counts, and converts old scores once. Keeping the v1 key separate prevents a cached old client from writing native counters over new AP values. Explicit “reset progress” still clears both as requested by that action. Already-earned legacy score badges remain earned, but their XP cannot inflate competitive rating.

The database retains `raw_score`, source version and mode metadata, converts existing submission/best rows transactionally, and recalculates overall/weekly rankings from AP. The five retuned engines use separate **legacy anchors**, so old inflated native records are not fed through their smaller new-economy anchors. Legacy Rhythm records lacked chart metadata and use the documented neutral legacy profile. There is no reliable way to reconstruct missing historical input/mode evidence; this is a conservative approximate conversion, not a claim of exact equivalent skill.

| Changed economy | Legacy native anchors |
|---|---|
| Chain | 25,000 / 350,000 / 1,400,000 |
| Drift | 25,000 / 200,000 / 750,000 |
| Pulse | 30,000 / 200,000 / 650,000 |
| Matrix | 2,500 / 20,000 / 100,000 |
| Rhythm | 200,000 / 800,000 / 1,700,000 |

The database conversion is guarded by **832 JavaScript/PostgreSQL golden parity vectors** inside the migration transaction. Any mismatch raises an exception and rolls back the migration. The D1 migration is separately tested against 256 legacy vectors in both history and best-score tables. Released migration files must not be edited and reapplied to tune scoring; a later economic change needs a new scoring version and an explicit migration.

## Server trust and operational limits

The browser sends native performance, not a client-selected AP value. Sessions bind the game, scoring version and selected mode. Both server implementations compute the same AP curve, check input range and elapsed-time consistency, reject replayed/expired sessions and reject version/mode changes at submission. Supabase also computes AP inside the atomic consume RPC; the client cannot submit a preconverted million-AP record. Cached v1 clients retain an explicit legacy path; unknown future versions fail closed rather than mixing units.

A six-hour session lifetime replaces the old thirty-minute operational limit. It is not a time-based bonus or an endless score cap. Runs exceeding that online lifetime can still retain local progress but are not accepted into the remote board. Coarse native sanity ranges are 100,000 for finite cabinets, 1,000,000 for timed hockey and 10^12 for others. These are rejection guards, not expected play budgets.

**This is not replay-verifying anti-cheat.** A client-executed game cannot prove an arbitrary submitted counter from an elapsed-time check alone. Sessions, authentication, rate limits and server normalization reduce errors and basic abuse but do not establish trusted gameplay. The overall cap additionally limits the effect of a single implausible cabinet record. A later anti-cheat project should verify game events/replays or adjudicate suspicious runs, without pretending duration alone proves skill.

## Verification and release gates

Permanent commands:

```
bun run quality:scoring
bun run quality:scoring-migrations
SCORING_CHROME_PATH=/path/to/chrome bun run quality:scoring-browser
bunx tsc --noEmit
bun run worker:check
bun run build:pages
```

The formula suite performs 119,511 assertions including monotonic sweeps, anchor continuity, invalid inputs, all supported modes, finite budgets, bounded streaks and overall anti-dominance. These are assertion counts, not 119,511 independent gameplay scenarios. The storage suite checks migration idempotence, cached-client isolation, settings, legacy badges, metadata, duplicate/lower records, quota recovery and reset. The actual Worker-handler suite performs 743 checks against an in-memory migrated SQLite database, including authenticated mode submissions, replay, context escalation, expiry and local/server aggregate parity.

The browser boundary suite uses a test-only controlled engine with the **real GameShell and storage**, covering all 36 configurations at 320×480, 390×844 and 1280×800. It verifies HUD/result/persistence/API point parity, native wire values, mode binding, duplicate finish, restart and narrow-screen result overflow. This fixture is not a gameplay bot and is not a production entrypoint. Actual game startup, input, rotation and responsive behavior remain covered by the existing Chromium/Firefox/WebKit CI suites. Browser execution is performed in CI; the local development browser was blocked by its administrator navigation policy and was not treated as a passing browser test.

The release must pass its CI gates before merging. Deploy the atomic Supabase migration, then the Edge function, then the frontend, preserving guest credentials and origin checks. The legacy RPC wrapper keeps cached clients compatible during that transition; new clients require a scoring-v2 response. The retained Cloudflare Worker and D1 migration are updated/tested as an alternative backend, not falsely reported as a production Cloudflare deployment.

## Post-release calibration criteria

Structural fairness is enforced now; fine difficulty calibration requires human data. Use paired players across multiple cabinets, equal attempt budgets and comparable familiarity. Record cabinet, selected mode, native/AP result, active duration, completion/progress, optional risk state and source version. Do not treat a single player's maximum as a population percentile or automatically normalize against the current leaderboard leader.

Compare medians, interquartile ranges and upper-tail results within skill/exposure bands; stratify by duration instead of paying a waiting-time bonus. Treat unfinished endless runs as censored rather than failed finite attempts. Repeatedly observed differences above roughly 3x for matched sessions deserve review; persistent differences above 10x are a strong imbalance flag, not an automatic mathematical rejection of an exceptional run. Check that harder modes reward equivalent demonstrated performance while considering that their typical completion rates may be lower.

Recalibrate only with enough runs across multiple players to distinguish a real economy issue from familiarity, input-device differences or a sampling accident. Keep versioned profiles and native evidence so a later tuning pass is auditable. The expected claim for this release is **comparable score units, restrained runaway economies, preserved difficulty/survival rewards and bounded overall dominance**—not identical difficulty or a permanently perfect balance.
