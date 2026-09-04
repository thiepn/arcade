# P19 — Arcade Cohesion Certification

## Scope

P19 treats Micro Arcade as one product containing 32 mechanically distinct games. It is a product-shell, navigation, presentation, interaction, responsive-layout and accessibility-cohesion phase. It does not change gameplay simulation, scoring, physics, difficulty, timing, mastery eligibility or balance.

P19 starts from production P18 commit `8f7124fde761f94c93b2bd96f4a15fbf8bc1712d`.

The design rule is **one arcade, thirty-two distinct games**.

## Explicit non-goals

P19 adds no gameplay recording or playback surface, no ghost runs, no input capture for playback, no run-history browser, no daily/weekly challenge service, no currency or unlock economy, and no new statistics platform. Existing favorites, recent games, statistics, achievements, profile and leaderboard surfaces are retained because they predate P19; P19 only normalizes their product presentation and interaction grammar.

## Product identity contract

Shared product identity is carried by:

- the arcade home header and game-card grid;
- one toolbar grammar inside `GameShell`;
- shared pause and result panel treatment;
- shared loading, empty and recovery-state treatment;
- shared modal overlay/panel geometry;
- shared focus and coarse-pointer behavior;
- restrained transitions that continue to honor reduced motion;
- common terminology such as **Back to Arcade**, **Restart**, **Play Again**, **Pause**, **Resume**, **Score** and **Best**.

Game identity remains free to vary through canvas art, gameplay palette, geometry, particles, sound, game-specific HUD detail and mastery effects.

## Design-system contract

P19 adds a small product-level token layer rather than replacing the existing theme system. Canonical product tokens cover radius, control size, panel background, border, overlay, focus color, shadow and transition duration. Existing theme variables remain authoritative, so the cohesion layer follows the active Micro Arcade theme rather than forcing one palette.

The canonical P19 classes are intentionally product-facing:

- `p19-app`
- `p19-home-header`
- `p19-game-grid`
- `p19-game-card`
- `p19-icon-button`
- `p19-nav-button`
- `p19-modal-overlay`
- `p19-modal-panel`
- `p19-loading-state`
- `p19-loading-panel`
- `p19-empty-state`
- `p19-recovery-panel`
- `p19-shell-toolbar`
- `p19-shell-stage`
- `p19-pause-overlay` / `p19-pause-panel`
- `p19-result-overlay` / `p19-result-panel`
- `p19-action-primary` / `p19-action-secondary` / `p19-action-tertiary`

## Shared component inventory

| Surface | Canonical implementation | P19 role |
|---|---|---|
| Arcade application | `App.tsx` | Owns product navigation and existing shared surfaces. |
| Home header | `Header.tsx` | Native-button brand, common navigation and utility controls. |
| Game card | `GameCard.tsx` | One card structure for the full roster. |
| Game shell | `GameShell.tsx` | One toolbar, stage, pause and result architecture for every game. |
| P18 teaching | `gameClarityRuntime.ts` | Remains authoritative for Objective / Essential / Secondary / Mastery / Watch For. |
| P19 cohesion | `arcadeCohesionRuntime.ts` | Decorates existing product surfaces with one canonical cohesion contract. |
| Loading surface | existing Suspense status surfaces | P19 normalizes them through one visual state contract. |
| Runtime recovery | `ErrorBoundary.tsx` | P19 normalizes the recovery presentation without exposing stack traces. |
| Overall leaderboard | `OverallLeaderboardModal.tsx` | Existing feature retained; receives canonical modal treatment. |
| Player profile | `PlayerProfileModal.tsx` | Existing feature retained; receives canonical modal treatment. |
| Stats/settings | `StatsModal.tsx` | Existing feature retained; receives canonical modal treatment. |

## Shell contract

Every registered game continues to run inside the same `GameShell`. P19 marks that shell with `data-p19-shell="canonical"`, normalizes the toolbar control language, stage frame, bottom hint, pause panel and result panel, and leaves every game component isolated from P19.

P19 deliberately preserves the P18 DOM landmarks `GAME PAUSED`, `SESSION COMPLETE`, `NEW HIGH SCORE!`, `data-p18-dialog`, game toolbar IDs and the exact game-title span. This prevents cohesion work from bypassing P18 teaching/focus certification.

## Card contract

All game cards retain the same information hierarchy: category and session length, game identity art/icon, title, optional best score, tagline, favorite action and a full-card play affordance. P19 equalizes the product-level geometry, focus ring, card border behavior and coarse-pointer favorite target while preserving each game's accent color and icon.

## Modal contract

App-level modal dialogs receive the same overlay, panel, header and close-control treatment. Existing `useModalFocus` behavior remains in place. The P19 runtime defensively prevents multiple simultaneously rendered app-level modal dialogs from exposing multiple interactive focus surfaces: only the topmost dialog remains interactive.

Game pause/result dialogs remain owned by P18 semantics and gain only the P19 visual/action hierarchy.

## Result contract

The shared result panel retains:

1. result/new-best state;
2. game title;
3. Score and Best;
4. P18 failure-rule and next-try guidance;
5. **Play Again** as the primary fresh-run action;
6. existing optional leaderboard/random-game utilities as secondary actions;
7. **Back to Arcade** as the shared exit language.

“Play Again” starts a new run. P19 contains no previous-run playback facility.

## Loading, empty and recovery states

Suspense loading surfaces remain lightweight, status-labelled and layout-stable. P19 makes their panel, border, overlay and typography treatment consistent. The home empty-filter state and runtime recovery state use the same panel grammar. Player-facing recovery UI continues to avoid stack traces and developer internals.

## Settings cohesion

Sound and haptic preferences remain stored in the existing global stats/preferences object and are synchronized with the shared sound/haptic engines. P19 does not create per-game duplicates. Fullscreen remains shell-owned and must not reset the active game. P17/P18 muted-audio, haptic-independent and reduced-motion guarantees remain authoritative.

## Responsive contract

P19 preserves 320 px as a first-class shell width and covers 390 px mobile and desktop in permanent browser certification. Product panels recover on short viewports with internal scrolling. Coarse-pointer controls retain at least the existing P18 touch-target floor, and P19 canonical controls use a 44 px coarse-pointer target where practical.

The cohesion layer does not set gameplay coordinates, canvas dimensions, timing or hitboxes.

## Navigation contract

The production application uses an in-app active-game state rather than URL-per-game routing. P19 does not introduce a router solely for cohesion. Browser certification therefore covers home-to-game-to-home navigation, repeated cross-game switching, back-to-arcade cleanup, settings persistence and viewport/orientation changes. Direct game URLs are not invented where the baseline does not support them.

## Accessibility continuity

P18 remains the primary gameplay-teaching and modal-focus certification. P19 adds product-level consistency: a native brand button, canonical focus styling, modal-stack protection, shared control geometry and preserved accessible shell names. P19 does not claim that realtime visual games are fully screen-reader playable and does not claim complete WCAG conformance.

## Reduced-motion continuity

P19 adds no continuous animation loop. Its product transitions are CSS-only and collapse to effectively immediate transitions under `prefers-reduced-motion: reduce`. P17 camera-shake guards and P18 static information redundancy remain unchanged.

## 32-game certification matrix

| Game | Shell | Toolbar | Pause | Result | Controls | Loading | Mobile | Small mobile | Focus | Reduced motion | Identity preserved | P19 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| orbit | Shared shell | Canonical | Structured | Canonical | Pulse/lane/reverse retained | Shared | PASS | PASS | PASS | PASS | Orbital pulse/graze/formations remain distinct. | PASS |
| stack | Shared shell | Canonical | Structured | Canonical | Drop + Focus retained | Shared | PASS | PASS | PASS | PASS | Minimal precision blocks and Focus wager remain distinct. | PASS |
| reaction | Shared shell | Canonical | Structured | Canonical | Reflex/choice controls retained | Shared | PASS | PASS | PASS | PASS | Cue/inhibition/overtime identity remains distinct. | PASS |
| dodge | Shared shell | Canonical | Structured | Canonical | Drag/arrows + Phase Cut retained | Shared | PASS | PASS | PASS | PASS | High-speed survival and Phase Cut remain distinct. | PASS |
| pulse | Shared shell | Canonical | Structured | Canonical | Timing input + Sync Wager retained | Shared | PASS | PASS | PASS | PASS | Timing/Fever/Sync Wager language remains distinct. | PASS |
| merge | Shared shell | Canonical | Structured | Canonical | Column placement retained | Shared | PASS | PASS | PASS | PASS | Deterministic merge planning/contracts remain distinct. | PASS |
| typerush | Shared shell | Canonical | Structured | Canonical | Physical/on-screen typing retained | Shared | PASS | PASS | PASS | PASS | Threat-word typing/directives remain distinct. | PASS |
| oneline | Shared shell | Canonical | Structured | Canonical | Draw/release retained | Shared | PASS | PASS | PASS | PASS | Draw-physics puzzle and Master Routes remain distinct. | PASS |
| breakout | Shared shell | Canonical | Structured | Canonical | Paddle controls retained | Shared | PASS | PASS | PASS | PASS | Brick/power-up contract identity remains distinct. | PASS |
| perfectstop | Shared shell | Canonical | Structured | Canonical | Stop input retained | Shared | PASS | PASS | PASS | PASS | Precision target and Master Encore remain distinct. | PASS |
| chain | Shared shell | Canonical | Structured | Canonical | Tactical tools retained | Shared | PASS | PASS | PASS | PASS | Tool planning and Resonance Orders remain distinct. | PASS |
| gravity | Shared shell | Canonical | Structured | Canonical | Slingshot/steer/flip retained | Shared | PASS | PASS | PASS | PASS | Newtonian flight/contracts remain distinct. | PASS |
| blade | Shared shell | Canonical | Structured | Canonical | Drag/swipe slicing retained | Shared | PASS | PASS | PASS | PASS | Slice trajectories and Razor mastery remain distinct. | PASS |
| pinball | Shared shell | Canonical | Structured | Canonical | Flippers/tap retained | Shared | PASS | PASS | PASS | PASS | Table physics/multiball identity remains distinct. | PASS |
| chrono | Shared shell | Canonical | Structured | Canonical | Steering/EMP/Focus retained | Shared | PASS | PASS | PASS | PASS | Sector-wave timing and Focus Wager remain distinct. | PASS |
| matrix | Shared shell | Canonical | Structured | Canonical | Grid/QWE-ASD-ZXC retained | Shared | PASS | PASS | PASS | PASS | Memory protocols/Overclock remain distinct. | PASS |
| drift | Shared shell | Canonical | Structured | Canonical | Steering/nitro retained | Shared | PASS | PASS | PASS | PASS | Driving lines and Style Routes remain distinct. | PASS |
| vanguard | Shared shell | Canonical | Structured | Canonical | Pointer/arrows/bomb retained | Shared | PASS | PASS | PASS | PASS | Shooter cadence and combat HUD remain distinct. | PASS |
| slingshot | Shared shell | Canonical | Structured | Canonical | Launch interaction retained | Shared | PASS | PASS | PASS | PASS | Orbital capture/mission physics remain distinct. | PASS |
| snake | Shared shell | Canonical | Structured | Canonical | Grid/swipe/D-pad retained | Shared | PASS | PASS | PASS | PASS | Serpent portals/firewalls/Phase Thread remain distinct. | PASS |
| rhythm | Shared shell | Canonical | Structured | Canonical | D/F/J/K lanes retained | Shared | PASS | PASS | PASS | PASS | Four-lane rhythm/holds/calibration remain distinct. | PASS |
| tower | Shared shell | Canonical | Structured | Canonical | Movement/jump/Apex retained | Shared | PASS | PASS | PASS | PASS | Vertical platform pressure/Apex Drive remain distinct. | PASS |
| pacmaze | Shared shell | Canonical | Structured | Canonical | WASD/arrows/swipe retained | Shared | PASS | PASS | PASS | PASS | Maze ghosts/Hunt Rush remain distinct. | PASS |
| flappyaero | Shared shell | Canonical | Structured | Canonical | Flap + Flow Boost retained | Shared | PASS | PASS | PASS | PASS | Gate/graze/Flow flight remains distinct. | PASS |
| roadcross | Shared shell | Canonical | Structured | Canonical | Step/swipe retained | Shared | PASS | PASS | PASS | PASS | Road/train/river district traversal remains distinct. | PASS |
| bubblebuster | Shared shell | Canonical | Structured | Canonical | Aim/shoot/swap/Burst retained | Shared | PASS | PASS | PASS | PASS | Orb-cannon aim/swap/Burst remains distinct. | PASS |
| astroblaster | Shared shell | Canonical | Structured | Canonical | Steer/thrust/fire/warp retained | Shared | PASS | PASS | PASS | PASS | 360-degree asteroid combat remains distinct. | PASS |
| laserrope | Shared shell | Canonical | Structured | Canonical | Jump/slide retained | Shared | PASS | PASS | PASS | PASS | LOW/HIGH/DUAL rope phases and Redline remain distinct. | PASS |
| blockdrop | Shared shell | Canonical | Structured | Canonical | Move/drop/hold retained | Shared | PASS | PASS | PASS | PASS | 7-bag/hold/B2B block mastery remains distinct. | PASS |
| knifetarget | Shared shell | Canonical | Structured | Canonical | Click/tap/space retained | Shared | PASS | PASS | PASS | PASS | Rotating target/Razor Marks remain distinct. | PASS |
| airhockey | Shared shell | Canonical | Structured | Canonical | Drag/touch/WASD + Power Play retained | Shared | PASS | PASS | PASS | PASS | Puck physics and earned Power Play remain distinct. | PASS |
| neonrail | Shared shell | Canonical | Structured | Canonical | Lane/Phase/Surge retained | Shared | PASS | PASS | PASS | PASS | Rail phrases, Phase and Surge remain distinct. | PASS |

## Intentional deviations

Game-specific canvas HUDs, palettes, world geometry, touch-control layouts and mastery displays are intentionally not normalized because they communicate game identity or mechanics. P19 only normalizes the product frame around them.

The app retains existing profile, achievements, recently-played and statistics surfaces; removing them is outside P19 and adding new meta layers is prohibited.

## Manual product-cohesion protocol

Automation verifies DOM/runtime invariants, not taste. Manual acceptance should inspect:

1. the 32-card home grid for balanced visual weight and scanability;
2. several unrelated games to confirm the shell is recognizably the same product;
3. pause/result panels to confirm action placement is predictable;
4. app-level leaderboard/profile/stats surfaces for one modal language;
5. 320 px, 390 px, tablet, desktop, ultrawide and short-landscape layouts;
6. reduced-motion mode;
7. a cropped cross-game blind test: shell UI should look product-related while gameplay remains visibly distinct.

## No grade inflation

P19 does not regrade the roster. The historical P15 distribution remains:

- **S:** 5
- **A:** 20
- **B:** 7
- **C/D/F:** 0

Individual S-rank promotion begins in later phases.

## Exit decision

P19 is certified only when the permanent source/browser gates pass together with P0–P18, release32, TypeScript, Worker checks, production/Pages builds, MA3/MA4 and the live 32-game smoke test. Subjective visual cohesion remains a documented manual acceptance activity.
