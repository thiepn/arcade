# Micro Arcade release-candidate audit — 2026-09-08

## Scope and release assessment

Repository baseline: `thiepn/arcade` at `5f9e5a50e7c988c5be5fed1c6e883edfb59f3f44`. All 259 source snapshot files were checked against their Git blob hashes before editing. The application contains **32 games**, not 31. This pass preserves their IDs, score conventions, mechanics, lazy modules, existing progression, visual identities, and Apache-2.0 licensing.

Engineering assessment: **conditional GO for the casual arcade release**, with source/CI/Pages publication tracked separately from local verification. The Worker and D1 are deployed and live-tested. A successful final Pages workflow and deployed-page smoke are required before calling the complete public release verified. No claim is made that every skill path, physical controller, browser or long-term retention metric has been certified.

Subjective baseline-to-candidate ratings: reliability **6/10 → 8.5/10**; surrounding UI/accessibility **7/10 → 8.5/10**; offline/update safety **5/10 → 8.5/10**; backend integration **5/10 → 8/10**. These are audit judgments anchored to the concrete defects below, not measured player-satisfaction scores. Existing per-game S-rank documents are historical project scorecards; this audit does not independently assert that every game is objectively S-tier.

## What was preserved

Instant launch, clear primary play actions, game-specific mastery mechanics, 32 lazy game modules, shared lifecycle/HUD, native card buttons, favorite/recent history, achievements and ranks, five themes, sound/haptics settings, pause teaching, reduced-motion support, safe areas, anonymous profiles, per-game/all-time rankings and weekly overall rankings. The existing gameplay suite passed at baseline, so no speculative scoring rebalance or game rewrite was warranted.

React 19, Vite 8, TypeScript, Tailwind, Motion, Bun 1.4.0, Wrangler and the locked dependencies remain in place. No dependency upgrade was necessary for these fixes. The pre-existing presentation runtimes remain intact; replacing all of them would be a separate architectural project with substantial regression risk.

## Findings fixed

| Priority | Reproduced issue or code defect | Implemented correction | Evidence |
|---|---|---|---|
| P1 | Async Worker routes escaped the fetch-level catch; unauthenticated `/v1/me` returned HTML 500 | Await route promises, convert expected failures to JSON, scrub unexpected error logs | Baseline reproduction, local and live API checks |
| P1 | Invalid persisted shapes could crash consumers or turn string values into incorrect settings | Validate maps, arrays, booleans, finite scores and themes; isolate fresh defaults | Corrupt/null/array/type and record-preservation regressions |
| P1 | A failed storage write could erase progress on the next action | Keep an in-memory pending copy, retry persistence, show a clear temporary-storage notice | Denied-write/recovery tests |
| P1 | Fixed cache names and partial precaching could mix releases or leave missing lazy games | Content-derived build cache, deployment scope, all-assets install barrier, cleanup failed install | Real service-worker offline and failed-update tests |
| P1 | Old tabs could lose lazy chunks during updates; timers could force reload a run | Retain one previous complete build, reload only after explicit request and inactive game | Two-tab active-run update regression |
| P1 | Window game listeners canceled Space activation on the result leaderboard button | Preserve native control/text input before events reach game listeners; make obscured games inert and paused | Natural game over → keyboard leaderboard → replay regression |
| P1 | Concurrent score requests could surface a database exception for one consumed session | Preserve transactional D1 batch and convert proven replay conflict to 409 | Simultaneous submissions accept once, duplicate 409 |
| P2 | API payload type confusion, oversized bodies, prototype game names and user-agent rate-limit evasion | Strict JSON objects/types, actual 4 KB stream limit, own-property game allowlist, stable IP key | Local D1 tests plus injected rate-limit/database-outage contracts |
| P2 | Requests could hang; refresh completion and submission messages could imply success without acceptance | Eight-second per-request deadline, safe typed errors, real refresh completion and accepted/local/failed status | Network helper tests and offline result flow |
| P2 | Cached profiles/ranks and expired weekly data were trusted | Shape checks, stale-week rejection, guarded memory fallback and invalid-credential recovery | Schema review and corruption regressions |
| P2 | Phone/tablet header buttons overlapped despite no document-level overflow | Responsive second navigation row, compact narrow-phone controls, retained accessible labels | Seven-width screenshots and pairwise button-overlap checks |
| P2 | Theme cards were clickable generic elements, absent from keyboard navigation | Five named native toggle buttons with selected-state semantics; game-picker count comes from the registry | Keyboard selection and persistence regression for all five themes |
| P2 | Background footer/skip links remained interactive under app overlays | Inert background surfaces, visible focus filtering and modal ownership of Escape | Modal/browser suites |
| P2 | Gamepad drag release could hit a different target or synthesize an unintended click | Retain the original pointer target and cancel drags on disconnect/cleanup | Code review and existing input/lifecycle gates; physical controller not tested |
| P2 | Late wake-lock acquisition could outlive its game effect | Release a lock that resolves after cleanup; stop while obscured | Lifecycle review and browser navigation regressions |
| P2 | Tied ranks could disagree between top entries and own rank | Consistent score/time/player-ID ordering | D1 query review and API ranking smoke |
| P3 | Registry erased shared game-prop types; Worker used hand-written runtime types | Shared GameComponentProps and Wrangler-generated declarations in a separate TS context | Frontend and Worker typechecks |

## Research applied

The implementation follows primary platform guidance: [Cloudflare Worker best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/) for awaited work and runtime boundaries; [D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/) for transactional batch behavior; [Cloudflare rate limits](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) for per-location limits; [MDN service-worker lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) for install/update semantics; and [MDN aria-modal](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-modal) for actual background inertness alongside dialog semantics. Research was limited to decisions that affected this release; broad competitor imitation would not repair these reliability defects.

## Verification and its limits

- Baseline: frontend typecheck, 52 existing static/gameplay quality gates, root/Pages builds, fresh local D1 migrations, positive API smoke, and 96 P19 browser game/profile sessions passed. The HTML-500 negative path still failed and was fixed.
- Candidate: all existing static/gameplay quality gates and the new storage/request tests pass. Frontend typecheck and Worker typecheck/dry-run pass. Root and Pages build/PWA structure checks are required on their respective build output.
- Full input smoke: **64/64** sessions across all 32 games on desktop and emulated touch mobile, including inputs, canvas signal, animation-frame sampling, restart and exit.
- P17 feel: **64/64**; P18 clarity/focus: **96/96**; P19 shell/navigation/settings/orientation: **96/96**; targeted P20/P21/P22/P23 suites: **18/18, 18/18, 24/24, 21/21**. One P21 run failed during local build turnover; a stable-build rerun passed and is retained as the final result.
- New browser coverage: all 32 games after offline reload, natural Flappy Aero failure/result/replay, keyboard leaderboard activation, modal isolation, seven homepage widths (320/360/390/768/1024/1440/1920), two-tab update safety, and deliberate missing-asset update rejection. These are behavior tests of the real built service worker.
- New API coverage: malformed JSON, wrong content type, non-object payload, actual-byte body limit, disallowed origin, unknown/prototype game names, invalid score/duration/name types, concurrent replay, safe 401/429/500 responses, Retry-After, and redacted outage logs.
- Live Worker: guest, profile, rename, one-time sessions, accepted scores, duplicate replay, per-game/overall/weekly rankings and profile activity passed. Only the synthetic test player's records were removed afterward.
- Screenshots were visually inspected; geometric assertions alone had missed the original header overlap. Local screenshots are included with the audit deliverables.

Browser automation used Chromium-based Edge on Windows, desktop/touch emulation, and reduced-motion profiles. It does not substitute for physical iOS Safari standalone installation, a real Bluetooth controller, assistive-technology gameplay or an extended battery/thermal soak. Canvas games are not claimed fully playable through a screen reader. The existing `lint` command is TypeScript checking, not ESLint. The runtime smoke is not exhaustive game-balance validation or proof of every possible win/loss sequence.

The initial JS graph still excludes all game modules. The largest generated JavaScript chunk remains well below the enforced 350 KB ceiling (approximately 213 KB uncompressed); the release keeps existing lazy loading and vendor splitting. This is build evidence, not a public-device Lighthouse score.

## Production and rollback

Worker: `https://micro-arcade-leaderboards.thiepn.workers.dev`. Dedicated D1 database: `micro-arcade-leaderboards`, both migrations applied. Secret: `CREDENTIAL_PEPPER`, configured only in Cloudflare. The Pages workflow includes the public API URL and accepts an Actions-variable override. Build secrets, `.dev.vars`, local D1 state, dependency folders and logs are excluded from git.

Guest credentials prove possession of an anonymous browser identity, not honest execution. Client-generated scores plus ceilings, timing checks, rate limits and replay protection are suitable for casual rankings only. There is no prize-grade anticheat guarantee, global rate quota or account recovery after storage removal. Offline runs stay local and are not secretly queued or retroactively attributed to a fresh server session.

Rollback instructions and deployment commands are in `worker/README.md`. Preserve the credential pepper and database schema. Future account/cloud-sync systems, deeper controller support, automated session retention cleanup, long-session device testing and architecture simplification are follow-up work rather than hidden requirements for local play.

## Per-game inventory and smoke coverage

Each row preserves the canonical storage/API ID. All rows passed desktop/touch input smoke, shared shell/pause/restart/exit checks and cached offline launch. Controls below come from the shipped registry; this is a traceable inventory, not a claim that every advanced mastery branch was manually completed.

| ID | Game | Category | Core controls | Final smoke |
|---|---|---|---|---|
| orbit | Orbit | Reflex | Tap / Space: Pulse • Up/Down: Lane • A/D: Reverse | Desktop / touch / offline: PASS |
| stack | Stack | Timing | Click / Tap / Space • F / Shift: Focus | Desktop / touch / offline: PASS |
| reaction | Reaction | Reflex | Tap / Space • Choice: A/D or Left/Right | Desktop / touch / offline: PASS |
| dodge | Dodge | Reflex | Touch Drag / Mouse / Arrows • Space: Warp Dash / Phase Cut | Desktop / touch / offline: PASS |
| pulse | Pulse | Timing | Click / Tap / Space • F / Shift: Sync Wager | Desktop / touch / offline: PASS |
| merge | Merge | Puzzle | Tap Column / Keys 1–4 | Desktop / touch / offline: PASS |
| typerush | Type Rush | Typing | Physical Keyboard / On-Screen Keypad | Desktop / touch / offline: PASS |
| oneline | One Line | Physics | Click & Drag / Touch Draw | Desktop / touch / offline: PASS |
| breakout | Breakout Mini | Reflex | Mouse Drag / Touch / Arrow Keys | Desktop / touch / offline: PASS |
| perfectstop | Perfect Stop | Timing | Click / Tap / Space | Desktop / touch / offline: PASS |
| chain | Chain | Strategy | Select Tool • Click / Tap Arena • 3 Charges | Desktop / touch / offline: PASS |
| gravity | Gravity | Physics | Slingshot Drag • Touch/A/D to Steer • [G] Flip | Desktop / touch / offline: PASS |
| blade | Laser Blade | Reflex | Mouse Drag / Swipe Slice | Desktop / touch / offline: PASS |
| pinball | Neon Pinball | Physics | A / D • Left/Right Arrow • Tap Sides | Desktop / touch / offline: PASS |
| chrono | Chrono Wave | Reflex | A / D • Left/Right Arrow • [Space] EMP • F/Shift: Focus Wager | Desktop / touch / offline: PASS |
| matrix | Memory Matrix | Puzzle | Tap Grid / QWE-ASD-ZXC / Numpad • O: Overclock | Desktop / touch / offline: PASS |
| drift | Cyber Drift | Physics | A / D • Arrow Keys • [Space] Nitro | Desktop / touch / offline: PASS |
| vanguard | Galaxy Vanguard | Reflex | Mouse Drag / Touch / Arrows • [Space] Bomb | Desktop / touch / offline: PASS |
| slingshot | Orbital Slingshot | Timing | Click / Tap / Space | Desktop / touch / offline: PASS |
| snake | Cyber Serpent | Reflex | Arrow Keys / WASD / Swipe / D-Pad | Desktop / touch / offline: PASS |
| rhythm | Neon Rhythm Tapper | Timing | D / F / J / K • 1 / 2 / 3 / 4 • Arrows • Tap Lanes | Desktop / touch / offline: PASS |
| tower | Gravity Tower Jumper | Physics | A / D • Left/Right • Touch Halves • Space • F/Shift: Apex | Desktop / touch / offline: PASS |
| pacmaze | Cyber Pac-Runner | Reflex | WASD / Arrows / Swipe • F / Shift: Hunt Rush | Desktop / touch / offline: PASS |
| flappyaero | Aero Pulse | Timing | Click / Tap / Space • F / Shift: Flow Boost | Desktop / touch / offline: PASS |
| roadcross | Cyber Crosser | Reflex | WASD / Arrow Keys / Tap / Swipe | Desktop / touch / offline: PASS |
| bubblebuster | Orb Cannon | Puzzle | Aim: Mouse/Touch/A-D • Shoot: Click/Space • Q: Swap • F/Shift: Burst | Desktop / touch / offline: PASS |
| astroblaster | Astro Blaster 360 | Reflex | A / D: Steer • W: Thrust • Space: Fire • Shift: Warp | Desktop / touch / offline: PASS |
| laserrope | Laser Rope Reflex | Timing | Jump: Space / W / ↑ • Slide: S / ↓ • Tap Buttons | Desktop / touch / offline: PASS |
| blockdrop | Cyber Block Drop | Puzzle | Arrows / WASD • Space: Hard Drop • C / Shift: Hold | Desktop / touch / offline: PASS |
| knifetarget | Knife Target | Timing | Click / Tap / Space | Desktop / touch / offline: PASS |
| airhockey | Neon Puck Smash | Physics | Mouse Drag / Touch / WASD • Space / F: Power Play | Desktop / touch / offline: PASS |
| neonrail | Neon Rail Shift | Reflex | A / D • Arrow Keys • Tap Lane • Space: Phase • Shift: Surge | Desktop / touch / offline: PASS |
