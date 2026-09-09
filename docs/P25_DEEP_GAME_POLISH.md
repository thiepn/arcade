# P25 — Deep Gameplay Polish & Balance Pass

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

## Regression contract

`quality:gameplay-p25` certifies all 32 implementation markers and the quantitative envelopes above. Existing P0–P24, game-specific physics/input tests, full browser gameplay tests, responsive Chrome/Firefox/WebKit geometry tests, PWA/offline tests, leaderboard/backend tests, and Pages build checks remain required.

P25 does not claim that subjective fun can be fully automated. It does establish that the intended balance changes are bounded, all 32 games participate, score formulas are not altered by the shared P25 balance module, and the full existing regression suite still gates release.
