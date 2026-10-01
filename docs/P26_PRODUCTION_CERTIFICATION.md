# P26 — Real-Device Gameplay Validation, Long-Run Balance & Production Certification

P26 is the first production-qualification phase after the P24 roster certification and P25 all-game balance pass.

Audit baseline: `2eae101dce78198c769151a89e71dc5820240727` (hardened P25 before the production-resolution audit).

P26 does not add another retention layer, progression system, game mode, scoring version, compatibility slot, or qualitative ranking point. It verifies what the production bundle actually ships, hardens the two post-P24 replacement engines, stress-tests long-horizon balance envelopes, and makes built/deployed artifact evidence a permanent release condition.

## Production roster truth

The 32 public/competitive slots remain stable, including the compatibility ids `gravity` and `astroblaster`. Their production engines changed after the historical P15–P24 evaluation program:

- `gravity` now resolves to **Vector Golf**.
- `astroblaster` now resolves to **Hex Capture**.
- the retired `GravityGame.tsx` and `AstroBlasterGame.tsx` sources remain historical/regression material but must not ship as production game chunks;
- the compatibility ids remain unchanged so the 32-slot AP, leaderboard, Worker/API, storage and historical-data architecture does not move;
- the replacement epoch sanitation continues to prevent pre-cutover Gravity/Astro native records from becoming replacement-game personal bests.

P26 does not inherit the old Gravity/Astro qualitative scorecard as an evaluation of the replacement engines. The historical P24 **32 S / 0 A / 0 B** ledger remains immutable evidence for the phase program and compatibility slots; Vector Golf and Hex Capture receive current production qualification here instead of being falsely described as games that P15–P24 directly graded.

## Replacement score compatibility

The production-resolution audit found two score-economy risks that could not be ignored.

### Vector Golf

The original replacement formula rewarded up to five bank contacts per hole. Across six ideal holes, the mathematical maximum was approximately 33,900 native points, while the already-deployed finite `gravity:standard` policy has a 33,000 hard rejection ceiling.

P26 extracts the replacement scoring envelope into `src/lib/replacementGameBalance.ts` and caps rewarded bank contacts at three per hole. The physical game still permits unlimited rebounds; only score credit for incidental repeated wall contacts is bounded.

The exact conservative maximum is now **32,820** native points.

This keeps every authored hole, par, star, stroke, timing and bank-shot mechanic intact while guaranteeing that an otherwise legitimate elite completion cannot cross the existing 33,000 compatibility-slot hardMax. No policy id, AP anchor, scoring version or deployed server policy needs to change.

### Hex Capture

The original replacement formula used a square-root capture bonus plus a fixed chain bonus on every closure. Splitting territory into many tiny captures could therefore produce substantially more score than claiming the same finite board efficiently.

P26 makes closure reward additive over newly claimed cells:

- 80 native points per newly claimed cell;
- +4 points per claimed cell for each chain level, capped at chain 6;
- unchanged three-life win bonus of 8,000 + 1,200 per remaining life.

Captured cells become permanently safe, so they cannot be scored again. Even under the deliberately conservative assumption that all 504 interior cells are valued at the maximum chain rate, the whole-board upper bound is **64,016** native points. That remains below the reused `astroblaster:standard` 65,000 mastery anchor.

This removes micro-capture farming while preserving the game's core risk/reward identity: larger safe captures and sustained clean closures still score more.

## Long-run balance certification

`quality:gameplay-p26` accelerates the P25 balance functions across horizons from opening play through one million simulated progression seconds. This is mathematical progression testing, not a wall-clock bot that idles for days.

The gate verifies that:

- Air Hockey opening AI pace remains bounded at 84–100%;
- Laser Blade cadence remains within 65–50 frames;
- Block Drop gravity never passes its 0.12 s floor;
- Chain target ratio and motion remain capped;
- Dodge retains its density-relief floor;
- Aero Pulse keeps its minimum gap and maximum base speed;
- Orbit retains its 750 ms hazard floor;
- Pulse BPM pressure remains asymptotic;
- Crosser traffic stays inside the four bounded district bands;
- Serpent, Stack, Tower and Type Rush remain bounded at extreme progression;
- Vanguard ordinary enemy speeds remain capped and boss durability keeps diminishing growth;
- Neon Rail's speed/spawn axes remain bounded;
- Knife Target and Pac-Runner retain their hard speed/content caps;
- Chrono Wave retains its bounded final-stage cadence/speed;
- all sampled outputs remain finite;
- the browser/server run lifetime remains exactly six hours in both current protocol layers.

The phase does not claim that deterministic envelope tests prove subjective fun. They prove that known difficulty axes cannot numerically run away or become non-finite during extreme progression.

## Browser device-profile qualification

`quality:browser-p26` adds production-oriented profiles that differ from the earlier P19 portrait matrix:

- high-DPR mobile landscape: 844×390 CSS px, DPR 3, touch;
- high-DPR mobile portrait: 390×844 CSS px, DPR 3, touch;
- touch tablet: 820×1180 CSS px, DPR 2.

Full CI launches **all 32 production slots in high-DPR landscape** and then performs deep Vector Golf / Hex Capture qualification in portrait and tablet, for **36 sessions** total.

It verifies:

- canonical P18/P19 shell ownership;
- dynamic visual-viewport height synchronization;
- no shell horizontal overflow;
- bounded canvas backing stores;
- reduced-motion propagation;
- exact production replacement names and engine markers;
- 36 px minimum replacement touch targets;
- Vector Golf guide state and G shortcut;
- interrupted Vector drag ownership cannot become a shot;
- Hex Capture repeat-safe Space behavior;
- Hex directional pressed state and blur cleanup;
- pause/resume focus restoration;
- repeated replacement restarts leave exactly one shell and one live engine;
- page/console error cleanliness.

The browser device profiles are hardware proxies. They exercise Chromium's mobile/touch/high-DPR paths, but they cannot measure a physical panel, GPU driver, thermal throttling, operating-system gesture arbitration, battery behavior, real touch latency, audio hardware resume, or vendor-specific standalone-PWA bugs.

## Built-artifact production certification

`quality:production-p26` inspects the actual Vite `dist` artifact instead of relying on source assumptions.

It requires:

- exactly 32 built game entries;
- exactly one Vector Golf chunk;
- exactly one Hex Capture chunk;
- zero built GravityGame or AstroBlasterGame chunks;
- every manifest JS/CSS/asset dependency to exist;
- no broken manifest import edges;
- expected root or `/arcade/` base paths;
- a versioned service worker with its build-id placeholder replaced;
- complete manifest-driven lazy-chunk discovery;
- every game chunk present and below the existing 350 KB limit.

CI runs this once against the root build and again against the GitHub Pages build.

## Deployment certification

The Pages workflow already deploys only after successful CI and checks the live Supabase leaderboard backend. P26 extends it in two places:

1. the exact Pages artifact is inspected with `quality:production-p26` before upload;
2. after deployment, `quality:browser-p26` runs in quick mode against the deployment URL.

The live quick check runs both production replacement slots across landscape, portrait and tablet profiles. It therefore verifies the exact deployed replacement chunks, not merely local source.

A P26 production release is automated-green only when the P26 static gate, production artifact gate, full CI browser gate, Pages predeploy artifact gate and deployed Pages quick smoke all succeed for the same release chain.

## Physical-device manual boundary

Physical-device signoff remains a manual boundary. No GitHub-hosted browser runner can truthfully certify real handset thermals, OEM WebView/Chrome behavior, iOS Safari/PWA behavior or physical touch/audio latency.

For a release that is explicitly labeled **physical-device certified**, perform at least the following on representative hardware:

| Surface | Minimum manual checks |
| --- | --- |
| Android Chrome | install/open, portrait + landscape, 15+ minute play, pause/background/resume, audio mute/unmute, touch controls, system-back behavior |
| Android standalone PWA | offline cold launch, update after a new deployment, orientation change during play, wake-lock behavior, background/foreground restoration |
| iPhone Safari / Home Screen | safe areas, browser chrome/visual viewport changes, touch/pointer cancellation, audio resume, orientation if supported |
| Tablet | landscape/portrait sizing, reachability of bottom controls, canvas sharpness/memory, repeated game switches |
| Low/mid-power device | sustained frame pacing, thermal degradation, input latency and memory pressure after repeated launches |

Record device model, OS/browser version, install mode, orientation, game ids tested, duration and any observed throttling/crash/input issue. A browser-emulated pass is not a substitute for that evidence.

## Historical scorecard boundary

P26 preserves:

- immutable P15 history;
- exact P20–P23 promotion ledgers;
- the P24 compatibility-slot composition ledger;
- the 55/60 historical S threshold;
- P25's non-scoring balance role.

Because Vector Golf and Hex Capture were introduced after that grading sequence, P26 does **not** relabel them as historically P24-certified S games. Their current evidence is production/runtime/balance qualification. A future rubric phase could explicitly evaluate the replacement engines if a current qualitative S-rank statement is required.

## Exit criteria

P26 closes its automated portion only when:

1. `quality:gameplay-p26` passes;
2. `quality:production-p26` passes on both root and Pages builds;
3. `quality:browser-p26` passes its full 36-session CI matrix;
4. all earlier release32 gates still pass;
5. Pages builds the exact successful CI SHA;
6. the pre-upload Pages artifact passes P26;
7. the deployed Pages quick P26 smoke passes;
8. no production policy hash or scoring version was silently changed.

Physical-device certification is intentionally separate and must not be inferred from those automated conditions.
