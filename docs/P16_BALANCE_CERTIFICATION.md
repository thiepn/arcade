# P16 — Difficulty & Balance Certification

Baseline: `250f30ee353d4037ed4045d23b9a3f1b109556f5` (post-P15 production)

## Purpose

P16 converts P15's largest remaining unknown—whole-roster pacing—into an explicit release contract. This phase does **not** normalize every game to the same duration or difficulty. It certifies that each game's existing identity has a readable early game, a bounded or authored escalation model, and no known source-level path to an avoidable difficulty cliff.

The certification combines current source inspection with the permanent game-specific audits already enforced in CI. Numeric values below are code-level pacing markers, not claims about subjective human difficulty.

## Roster balance matrix

| ID | Game | Model | Early | Mid | Late | Objective pacing / fairness envelope | P16 |
|---|---|---|:---:|:---:|:---:|---|:---:|
| orbit | Orbit | Authored route + hazard | Low | Med | High | 3 lanes; P11 formations threaten exactly 2 lanes and telegraph 1 safe lane; random hazards pause around formations | PASS |
| stack | Stack | Continuous speed ramp | Low | Med | High | Base speed 3.5 scaled to viewport; physical block count adds 0.08 per block with +4.5 cap; Focus score never drives speed | PASS |
| reaction | Reaction | Finite authored rounds | Low | Med | High | 8 core + optional 3 overtime; launch waits bottom at 260 ms; inhibition decoys bottom at 320 ms; overtime scheduler must use the combined round table | PASS |
| dodge | Dodge | Continuous mixed hazards | Low | Med | High | Warp Dash remains 260 ms with bounded charges/recharge; Phase Cut rewards do not remove ordinary collision rules outside dash/shield states | PASS |
| pulse | Pulse | Tempo / pattern escalation | Low | Med | High | Pattern BPMs 78–126; combo boost is capped so dynamic BPM never exceeds 155; base judgement remains 8/18/28 px | PASS |
| merge | Merge | Player-paced puzzle | Low | Med | Med | No forced timer pressure; 3-tile queue and deterministic mirror-equivariant merge resolver; contracts scale without changing board legality | PASS |
| typerush | Type Rush | Four authored waves | Low | Med | High | Spawn interval 2300→1900→1550→1250 ms; max simultaneous words 3→4→4→5; speed 0.90→1.00→1.08→1.16 | PASS |
| oneline | One Line | Player-paced physics | Low | Med | Med | Fixed-step 240 Hz physics; limited ink and 3-attempt contract; ordinary portal clears remain valid without mastery stars | PASS |
| breakout | Breakout Mini | Round escalation | Low | Med | High | Multi-hit bricks and optional contracts add pressure without blocking ordinary round clears; powerups remain bounded temporary effects | PASS |
| perfectstop | Perfect Stop | Finite authored sectors | Low | Med | High | 7 core sectors with sweep speed 118→195 and tightening windows; only qualified runs unlock 3 optional Encore sectors | PASS |
| chain | Chain | Wave strategy | Low | Med | High | Exactly 3 tactical charges per wave; Resonance sequencing is optional and cannot reduce the base charge economy | PASS |
| gravity | Gravity | Five authored sectors | Low | Med | High | 5 authored sectors; deterministic 60 Hz Newtonian stepping; optional Flight Contracts do not narrow the legal warp-clear path | PASS |
| blade | Laser Blade | Procedural target waves | Low | Med | High | Trajectory audit certifies playable target arcs and refresh-rate invariance; Razor center cuts are bonus-only and ordinary valid slices remain valid | PASS |
| pinball | Neon Pinball | Stateful table escalation | Low | Med | High | Fixed-step collisions; 3 lives; finite kickbacks; one-shot ball saver; multiball drains and one-shot game over are permanently audited | PASS |
| chrono | Chrono Wave | Planner-authored wall escalation | Low | Med | High | Two-sector gaps, one-sector transitions and forced safe openings are reachability-certified; Focus is bonus-only | PASS |
| matrix | Memory Matrix | Sequence-length escalation | Low | Med | High | Protocol changes every 2 rounds; Overclock adds +2 nodes, playback ×0.78 with 140 ms floor, and remains voluntary | PASS |
| drift | Cyber Drift | Fixed-cadence driving | Low | Med | High | 60 Hz simulation; base speed 6.8, max 9.2, Nitro ×1.55 for 1.8 s; event spawn every 49 simulation steps (~0.82 s) | PASS |
| vanguard | Galaxy Vanguard | Wave / enemy escalation | Low | Med | High | 60 Hz gameplay clock certifies movement, firing, spawn cadence, enemy cadence, drops and effect durations across refresh rates | PASS |
| slingshot | Orbital Slingshot | Endless sector progression | Low | Med | High | Fixed-step orbit/free-flight timing and resize continuity; missions reward quality without making ordinary gravity-well capture illegal | PASS |
| snake | Cyber Serpent | Growth-stage escalation | Low | Med | High | Firewalls begin after growth and advance every 4 growth steps; final authored firewall set is bounded; Ghost threading is temporary and non-farmable | PASS |
| rhythm | Neon Rhythm Tapper | Song-authored timing | Low | Med | High | Fixed-ms judgement: Perfect 70, Great 125, Good 190, Miss 230; calibration ±200 ms; real holds preserve the same head windows | PASS |
| tower | Gravity Tower Jumper | Endless vertical escalation | Low | Med | High | 60 Hz fixed-step simulation; varied platform types and rising-laser pressure; Apex is a voluntary 4.5 s higher-pressure window | PASS |
| pacmaze | Cyber Pac-Runner | Level-based maze escalation | Low | Med | High | Distinct ghost targeting + Chase/Scatter; frightened duration has a 4.5 s floor as levels rise; Hunt Rush is optional extra risk | PASS |
| flappyaero | Aero Pulse | Gate-speed escalation | Low | Med | High | Base scroll 175 + 3 per gate, capped 280; gap 130 − 0.8 per gate, floored 90; spacing 200–240 px; optional Flow speed ×1.18 | PASS |
| roadcross | Cyber Crosser | Authored district escalation | Low | Med | High | 4 districts × 8 rows; starting/reset lanes are safe and authored layouts cap consecutive danger rows at 3 | PASS |
| bubblebuster | Orb Cannon | Board-pressure economy | Low | Med | High | Deterministic earned Burst (cap 2) replaces random bombs; one swap per shot; Burst earned at combo 4 or cascade drop 4+ | PASS |
| astroblaster | Astro Blaster 360 | Wave / density escalation | Low | Med | High | 60 Hz ship/bullet/asteroid/UFO clock; cooldowns and power durations are refresh-rate invariant; hyperspace remains bounded escape utility | PASS |
| laserrope | Laser Rope Reflex | Sweep-speed escalation | Low | Med | High | Sweep target 2.2→5.4 rad/s; Redline ×1.22 is voluntary; P16 requires ≥0.38 s warning before a LOW/HIGH/DUAL mode change can become active | PASS |
| blockdrop | Cyber Block Drop | Level / stack escalation | Low | Med | High | Fair 7-bag, Hold/Next planning, ghost landing, lock delay and wall kicks; B2B/clear chains affect score, not piece legality | PASS |
| knifetarget | Knife Target | Six authored stages | Low | Med | High | 6 stage identities; Razor tolerance starts at 0.15 rad and tightens by tier to a 0.09 rad floor; marks remain optional | PASS |
| airhockey | Neon Puck Smash | Fixed-duration adaptive match | Med | Med | High | 60 s match; player cap 1050, puck cap 680; AI Easy/Medium/Hard speeds 180/280/400 with 165/105/70 ms reaction delays | PASS |
| neonrail | Neon Rail Shift | Authored phrase escalation | Low | Med | High | 6-row reachable phrases; safe route always exists; Phase cooldown 5 s; earned Surge is a short voluntary faster 2× window | PASS |

## Quantitative priority probes

P16 gives extra automated scrutiny to the ten P15 priority areas rather than pretending every game exposes the same kind of measurable difficulty variable.

### Stack

- Speed progression is tied to **physical block count**, not score.
- The additive progression is capped at +4.5.
- Focus rewards cannot accelerate the base game.

### Aero Pulse

- Non-Flow base speed caps at 280 px/s.
- Procedural gate spacing never drops below 200 px, giving at least ~0.714 s between generated gate anchors at the base speed cap.
- Flow's ×1.18 pressure is explicitly player-chosen; it may reduce that interval as its intended risk.
- Gap height bottoms at 90 px instead of shrinking without limit.

### Laser Rope Reflex

P16 found the only direct fairness defect in the priority set: LOW/HIGH/DUAL mode changes were selected on a wall-clock timer without checking beam phase. At high sweep speed that could make a newly announced mode relevant almost immediately.

P16 therefore adds a geometric transition guard. A candidate mode may only activate if its next relevant bottom crossing is at least **0.38 seconds** away, using the actual current direction, sweep speed, Fever state, Redline multiplier and candidate beam count. If the beam is too close, the mode change waits and retries; speed is not reduced and no free invulnerability is introduced.

### Pulse

- The six base patterns remain distinct rather than becoming one linear tempo ramp.
- Dynamic BPM is hard-capped at 155.
- Existing 8/18/28 px judgement windows remain unchanged.

### Reaction

P16 also found a latent session-progression bug: `startRound(index)` still read only the 8-entry core array even after P6 introduced 3 overtime rounds. The UI used the combined core+overtime table, but the scheduler could dereference an undefined config on round 9.

P16 changes the scheduler to use the same combined `getSessionRound(index)` lookup as the rest of the game. This is a correctness fix, not a difficulty reduction.

### Type Rush

The four-wave curve remains monotonic in the intended pressure dimensions: spawn interval decreases, simultaneous-word ceiling rises, and fall-speed multiplier increases.

### Cyber Drift

Spawn cadence remains fixed at 49 simulation steps while world motion accelerates only during bounded Nitro. This avoids spawn-frequency and speed escalation multiplying each other uncontrollably.

### Dodge / Gravity Tower / Cyber Crosser / Orb Cannon

Their existing permanent gates already certify the most failure-sensitive invariants: bounded dash/phase behavior, 60 Hz Tower physics, district reachability/reset lanes, and deterministic Burst/swap rules. P16 treats the remaining tuning as experiential rather than inventing unsupported numeric human-reaction claims.

## Exit decision

**PASS after the two P16 corrections above.**

- No game requires broad difficulty redesign.
- No game is normalized to another game's session length.
- The roster retains short reflex games, longer puzzle games, finite authored gauntlets and endless score attacks.
- P17 should now focus on feedback hierarchy and input/game feel rather than adding new mechanics.
