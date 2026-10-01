# P25 — Deep Gameplay Polish & Balance Pass

Original P25 merge: `85de2cb0bbba539cea8a37134ef50c46f3d3434d`.

Current hardening baseline: `f89652e8de521c9add62b258b9ffa008cb5735d8` (2026-10-01 definitive hardened P24).

P25 is a full-roster gameplay-quality pass over all 32 Micro Arcade games. It intentionally preserves the existing raw scoring formulas and leaderboard scale. The changes target difficulty shape, fairness, avoidable RNG streaks, late-run runaway pressure, device parity, recovery behavior, and first-minute readability.

## Product rules

1. Difficulty should primarily track physical/game progress, not bonus score inflation.
2. Two independent difficulty axes should not both grow without a ceiling.
3. Random generation may create variety, but not avoidable streaks of the same high-risk event.
4. Early play should teach the game; late play should become harder through authored complexity rather than unbounded speed.
5. Existing score formulas remain unchanged so historical leaderboard scores stay comparable.
6. Technical stalls, frame hitches, resize events, and input-device choice must not create hidden difficulty multipliers.

## 32-game change ledger

| Game | Deep-polish change |
| --- | --- |
| Orbit | Replaces the linear hazard-interval cliff with a smooth 58-second pressure curve and a stable 750 ms floor. |
| Stack | Scales the full moving-block speed by viewport scale, not just its base component, so late-game relative speed is consistent across screen widths. |
| Reaction | Prevents more than two consecutive identical LEFT/RIGHT choice cues while retaining unpredictability. |
| Dodge | Replaces the 29-second spawn cliff with a smooth 48-second ramp and adds density relief when many hazards are already active. |
| Pulse | Uses an asymptotic combo-to-BPM curve so success increases pressure smoothly instead of linearly hitting the cap. |
| Merge | Replaces independent tile RNG with a shuffled 2/2/4/4/8/16 bag, preserving long-run distribution while eliminating drought/streak variance. |
| Type Rush | Uses an asymptotic elapsed-time speed curve, reducing late runaway word velocity while retaining the authored wave multipliers. |
| One Line | Prevents immediate repetition of the same procedural archetype while preserving all ten puzzle families. |
| Breakout Mini | Guarantees a small round-dependent floor of tactical special bricks when random generation produces a dry board. |
| Perfect Stop | Reduces stacked speed/pulse/reversal pressure in Final Chaos while keeping its scoring multiplier unchanged. |
| Chain | Stops target percentage at 78% and uses a lower capped motion curve so orb count, special vocabulary, target ratio, and speed do not all scale aggressively together. |
| Gravity | Caps fixed-step catch-up work per frame so a long frame cannot turn into a sudden multi-step physics burst. |
| Laser Blade | Replaces abrupt score-threshold spawn jumps with a smooth bounded cadence curve. |
| Neon Pinball | Makes low-speed rescue progressive and slightly more deliberate, reducing dead-table stalls without awarding points. |
| Chrono Wave | Softens the last two spawn stages and caps extreme wall-speed multiplication while preserving reachability planning. |
| Memory Matrix | Restores one replay charge every third non-overclock clear, adding long-run recovery without changing clear points. |
| Cyber Drift | Prevents consecutive Rival/Hazard event repeats by substituting a gate/nitro beat, reducing RNG-driven pressure spikes. |
| Galaxy Vanguard | Caps ordinary enemy fall speeds and changes boss durability from unbounded linear growth to a strong early curve with diminishing late growth. |
| Orbital Slingshot | Narrows maximum lateral node displacement so procedural routes remain readable and reachable on narrow stages. |
| Cyber Serpent | Ties movement speed to snake growth instead of total score, so multipliers/Nova bonuses no longer secretly accelerate the game. |
| Neon Rhythm Tapper | Makes high-health misses cost 6 instead of 7 groove, retaining the original 7-point penalty once the player is under pressure. |
| Gravity Tower Jumper | Bounds procedural vertical gap range with a gentle altitude curve instead of exposing the full 46–91 px range immediately. |
| Cyber Pac-Runner | Keeps early protocol escalation but applies diminishing late-level ghost-speed growth with lower hard caps. |
| Aero Pulse | Separates and softens simultaneous speed/gap pressure: minimum gap rises to 96 px and scroll speed caps at 270. |
| Cyber Crosser | Gives districts explicit bounded traffic-speed bands instead of letting every road lane sample the same 65–125 range. |
| Orb Cannon | Gives the first two ceiling advances six shots instead of five, then returns to the established five-shot cadence. |
| Astro Blaster 360 | Caps initial large-asteroid count at nine so high waves gain difficulty through composition rather than unbounded starting clutter. |
| Laser Rope Reflex | Increases the minimum mode-change warning from 0.38 to as much as 0.45 seconds at maximum sweep speed. |
| Cyber Block Drop | Replaces the linear gravity cliff with a staged drop-interval table that reaches the same 0.12-second floor more progressively. |
| Knife Target | Uses diminishing post-cycle speed/preblade growth while retaining the existing hard caps and stage vocabulary. |
| Neon Puck Smash | Ramps AI movement from 84% to 100% over the opening eight seconds, preserving selected difficulty after the opening read. |
| Neon Rail Shift | Couples speed and spawn pressure to the same smooth 90-second curve, avoiding two mismatched linear ramps. |

## 2026-10-01 all-game balance hardening addendum

The original P25 balance envelopes remain frozen. The current-source audit found that the actual gameplay integrations were still present, but the permanent P25 test mostly checked isolated sample values and whether a marker string existed somewhere in a file. That was too weak for an all-game balance certification. It also found one driver-level inconsistency in Laser Blade: the bounded cadence curve was still keyed to raw score even though raw score includes precision/combo bonuses.

The hardening pass strengthens the evidence and corrects that one progression-driver mismatch without changing any scoring formula:

- all continuous P25 curves are now sampled across their real progression domain for monotonicity and hard bounds;
- Laser Blade cadence now follows authored wave count instead of raw score, so precision/combo/multi-cut bonuses cannot secretly accelerate spawn pressure; the same 65→50 frame envelope is preserved;
- Type Rush is checked with the actual BOOT/SURGE/OVERCLOCK/REDLINE multipliers rather than only a `1.0x` synthetic multiplier;
- Vanguard certifies all five ordinary enemy kinds plus diminishing boss growth;
- Cyber Crosser certifies the four explicit district traffic-speed bands;
- Neon Rail proves speed and spawn pressure remain coupled to the same normalized curve;
- Knife Target and Cyber Pac-Runner are checked across repeated progression cycles instead of only at one extreme level;
- Perfect Stop now locks the complete Final Chaos pressure/window contract, not just speed and reversal timing;
- Reaction proves any third identical LEFT/RIGHT cue is forcibly broken across the RNG range;
- Merge proves the complete `2/2/4/4/8/16` multiset on repeated bag refills;
- all **32 live integration paths** are checked in the actual game source so an imported-but-unused helper can no longer satisfy P25;
- pre-P25 formulas for score-driven Snake speed, uncapped Vanguard boss HP, wide Crosser traffic RNG, old Type Rush linear speed and other key failure modes are explicitly forbidden.

The audit also found one certification mismatch in Gravity. `GRAVITY_MAX_STEPS_PER_FRAME` was set to `6`, but the pre-existing 50 ms frame clamp and 60 Hz fixed step can request at most three steps from a valid accumulator. The explicit cap is now `3`, matching the real integrator bound. This does **not** make Gravity harder or easier; it makes the stated catch-up contract truthful and permanently testable.

No raw scoring formula or P24 scorecard is changed by this hardening pass. The definitive roster remains **32 S / 0 A / 0 B**, and P25 remains a non-scoring balance/fairness layer.

## Regression contract

`quality:gameplay-p25` certifies all 32 live integration paths, broad quantitative envelopes, anti-regression formulas, specialist progression modules, and the hardened P24 baseline. Existing P0–P24, game-specific physics/input tests, full browser gameplay tests, responsive Chrome/Firefox/WebKit geometry tests, PWA/offline tests, leaderboard/backend tests, and Pages build checks remain required.

P25 does not claim that subjective fun can be fully automated. It does establish that the intended balance changes are bounded, all 32 games participate, score formulas are not altered by the shared P25 balance module, and the full existing regression suite still gates release.
