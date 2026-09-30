# Changelog

## Leaderboard v3 — release candidate

- Rebuilt immutable run storage, precise AP and bounded rating with shared ranks.
- Added current-mode personal records, additive v2 migration and v1 history archive.
- Added server screening, owner/mode-bound sessions and atomic idempotent receipts.
- Added durable retry queue, recovery codes, mode filters, pagination and mobile explanations.
- Fixed mid-match Hockey mode changes and legacy raw-record recovery.
- Added real PostgreSQL 17 and browser failure-path release gates.
- Deployment and threat-model details: `docs/leaderboard/RELEASE.md`.


## Scoring v2 — 2026-09-09

- Calibrated Arcade Points across all 32 cabinets and all 36 selectable configurations.
- Corrected the Score/AP presentation contract: every game now keeps its native raw **Score** in the HUD and results, while **AP** is displayed separately and used for cross-game ranking. Raw-score and AP personal bests are stored independently, and per-game leaderboard rows can show raw Score as secondary context.
- Bounded Chain, Drift, Pulse, Matrix and Rhythm reward inflation.
- Unified local/global/weekly best-per-game rating with a 10,000 AP per-game contribution cap; per-game records remain uncapped.
- Versioned, mode-bound, server-computed points and non-destructive legacy conversion.
- Permanent formula, migration, protocol, storage and browser-boundary regression tests.
- See [the complete audit and calibration limits](docs/SCORING_V2_AUDIT.md).

## Unreleased

### P16 difficulty/balance hardening — 2026-09-30
- Guard Laser Rope random direction reversals with the same speed-aware geometric warning floor used for mode changes, preventing an immediate reverse crossing after the beam has just passed the player.
- Make Orb Cannon current/next chamber colors board-aware and reconcile them after every resolved shot, so eliminated colors cannot consume shots against the ceiling-drop clock.
- Replace stale P16 literal checks with executable current-envelope assertions for Stack, Aero, Dodge, Laser Rope, Pulse, Tower, Cyber Crosser and Orb Cannon; later P25 safety tightening remains valid as long as it stays inside the original P16 envelope.
- Add a P16 hardening addendum documenting the current safer Aero envelope and the two corrected fairness gaps.

### P15 historical-audit hardening — 2026-09-30
- Keep the original P15 roster document immutable instead of rescoring it after later gameplay hardening; P20–P24 depend on P15 as historical provenance.
- Strengthen `quality:gameplay-p15` with the exact post-P14 baseline SHA and an exact 32-row historical score signature, so scores/grades/ranks cannot be silently rewritten while still satisfying arithmetic checks.
- Certify non-increasing rank totals, the exact 5 S / 20 A / 7 B distribution, canonical top-five/bottom-five summaries, and the original P16 balance handoff/exit decision.
- No gameplay, current P24 score ledger, or historical P15 rating is changed.

### P14 flagship-depth hardening — 2026-09-30
- Make Rhythm's 90 ms hold-release grace measure from the actual release moment instead of the note head, so brief mid-hold keyboard/touch jitter is genuinely forgiven.
- Clear Rhythm lane ownership on window blur, reject suspended/modifier lane presses, and handle pointer cancellation so phantom held lanes cannot auto-complete hold notes.
- Keep Block Drop movement/soft-drop repeat behavior, but make rotate, hard drop, and Hold edge-triggered so held keys cannot act on freshly spawned pieces; soft drop no longer bypasses the 550 ms lock-delay window.
- Make Laser Blade's multi-cut reward truly stroke-bounded: a physical swipe can earn it once, continuous holding cannot manufacture fresh swipe windows, and pause/pointer-cancel ends the stroke.
- Expand `quality:gameplay-p14` plus the Block Drop dedicated gate around release grace, input ownership, lock delay, and one-stroke reward integrity.

### P13 flight-focus-style hardening — 2026-09-30
- Remap Gravity Recall from `R/Escape` to `Q` so the advertised Flight Contract recall action no longer collides with GameShell's global Restart/Pause shortcuts; update in-game and registry teaching accordingly.
- Cancel Gravity aim/steer pointer mutation while suspended and prevent pointer release from launching a queued slingshot behind the pause/game-over overlay; keep A/D repeat steering while making boost/flip/recall/slow-mo discrete.
- Freeze Chrono steering/direct-aim input—including its on-screen steering paddles—while paused/dead and reject repeat/modifier key events so Focus/EMP cannot auto-retrigger from a held key.
- Make Cyber Drift's Nitro keyboard action edge-triggered and modifier-safe while preserving held steering from the initial keydown.
- Extend `quality:gameplay-p13` and the dedicated Drift gate to certify shell-shortcut ownership, suspended pointer state, and discrete mastery actions.
- Align the P18 Gravity clarity profile with the new `Q` Recall binding so first-run/help teaching and registry controls stay identical.

### P12 next-mastery-trio hardening — 2026-09-29
- Stop Gravity Tower from farming Apex mastery on repeated or alternating rebounds across already visited platforms: precision streaks, bonuses, charges, and the later Apex Route now advance only on each platform's first landing.
- Release Laser Rope and Gravity Tower keyboard ownership while paused/dead and ignore repeat/modifier events so held keys cannot auto-spend double jumps, Redline, Apex Drive, or wall-jump/micro-burst actions.
- Guard Chain touch capture and tactical tool selection before suspended/finished-state mutation, keeping pause and between-wave state genuinely frozen.
- Extend `quality:gameplay-p12` to certify unique-platform Apex progression and the trio's input-ownership boundaries.
- Update the dedicated Tower refresh-rate gate to require the stronger pause/game-over/repeat/modifier keyboard guard instead of its obsolete pause-only source marker.

### P11 classic-loop hardening — 2026-09-29
- Make Orbit threat-formation resolution geometry-aware: the certified 1.7-second window remains the minimum, but wide-screen formations now wait for their actual comet travel time plus clearance before awarding the safe-lane mastery bonus, and random hazards stay suppressed through that dynamic window.
- Extend formation cooldown only when geometry makes a formation outlast the original cadence, preserving post-formation breathing room without slowing ordinary compact-screen runs.
- Release Orbit, Pac Runner, and Cyber Serpent keyboard/touch ownership while paused or after game over; ignore repeat/modifier key events so discrete mastery/navigation actions cannot auto-fire or consume shared shell shortcuts.
- Freeze Pac and Snake swipe routing while suspended so queued movement cannot silently change behind pause/game-over overlays.
- Extend `quality:gameplay-p11` to certify viewport-safe Orbit timing and classic-loop input ownership.

### P10 current-bottom-three hardening — 2026-09-29
- Separate Dodge's intentional dash from shield-granted invulnerability so free shield i-frames cannot earn Phase Cuts, recharge dash economy, or preserve a mastery chain; make dash activation edge-triggered instead of key-repeat-driven.
- Release Aero's keyboard ownership while paused/dead and ignore repeated/modifier key events so holding Space cannot auto-flap and post-run shell controls remain available.
- Freeze Orb Cannon aim/keyboard input while suspended, prevent held keys from auto-firing, and make Burst/Swap buttons reflect shot-in-flight availability instead of appearing actionable when the mastery guard will reject them.
- Extend `quality:gameplay-p10` to certify intentional-dash eligibility, discrete action input, suspended aim ownership, and honest Orb agency UI.

### P9 next-bottom-three hardening — 2026-09-29
- Release Stack, Pulse, and Neon Puck Smash keyboard ownership while paused or after game over so their Space/Enter/mastery listeners cannot suppress GameShell post-run actions.
- Preserve the shared Alt+Enter fullscreen shortcut in Stack and Pulse by ignoring modifier-based shell shortcuts before game-specific input handling.
- Freeze Stack/Pulse pointer actions and Air Hockey keyboard/pointer target updates while gameplay is suspended, preventing hidden actions or a stored mallet movement jump on resume.
- Extend `quality:gameplay-p9` to permanently certify those input-ownership boundaries.

### P8 rebalanced-bottom-three hardening — 2026-09-29
- Attribute Breakout power drops to the round that spawned them so a carry-over drop from the previous board cannot satisfy the next round's Power Bank contract; powerups themselves still carry over and remain usable.
- Release Orbital Slingshot's Space/Enter/ArrowUp keyboard ownership after game over so GameShell post-run restart actions are no longer suppressed.
- Extend `quality:gameplay-p8` to certify late-round marked-brick supply, round-scoped Breakout power catches, and Slingshot post-run input ownership.
- Update the dedicated Slingshot determinism gate to require the stronger pause + game-over input guard rather than its obsolete pause-only source marker.

### P7 mastery-trio hardening — 2026-09-29
- Keep Memory Matrix manual/error/timeout replays at the current round's real playback cadence, including Overclock speed, instead of falling back to a fixed 320 ms retry; make the Matrix R replay shortcut consume the event so it cannot also trigger the global shell restart.
- Harden Knife Target Razor Mark placement with dense safety sampling and a deterministic best-clearance fallback, and stop its keyboard listener from consuming post-run Space/Enter shell actions.
- Stop Neon Rail's keyboard listener from consuming post-run shell actions and teach the desktop Shift: Surge control in-game.
- Extend `quality:gameplay-p7` to certify replay cadence, Razor target safety, shortcut isolation, post-run input ownership, and Surge teaching.

### P6 new-bottom-three hardening — 2026-09-29
- Fix Cyber Crosser district difficulty generation: pre-generated road and river lanes now derive movement speed from their own row instead of the player's current max row, so later authored districts no longer inherit opening-area traffic speeds.
- Align the traffic-speed tier changes to authored district starts (rows 4/12/20/28) rather than raw eight-row multiples, preventing mid-district difficulty jumps.
- Extend `quality:gameplay-p6` with representative district-speed escalation checks and a source contract that prevents pre-generation from flattening progression.

### P5 bottom-three hardening — 2026-09-29
- Make Orbit's route HUD follow the player's next consecutive collectible step rather than the number of crystals already spawned, so the named route cannot advance ahead of actual route progress.
- Stop Type Rush's global letter listener from consuming shared shell shortcuts while paused or after game over, and freeze direct word-target selection while gameplay is suspended.
- Extend `quality:gameplay-p5` to permanently certify both interaction contracts.

### P4 experiential gameplay hardening — 2026-09-29
- Restore Chain's tool-role integrity: Tesla arcs are now stopped by nullifiers and strip shield HP instead of directly detonating defensive targets, preserving Plasma as the taught defense-breaking tool.
- Restore One Line's advertised ten-layout variety by giving archetypes 7, 8, and 9 separate authored obstacle/star arrangements instead of sharing one fallback layout.
- Reset One Line's three-attempt budget whenever a fresh procedural stage is generated so failures cannot leak into the next stage or a random reroll.
- Freeze in-progress One Line drawing during pause and prevent pointer release from launching physics behind the pause overlay; extend `quality:gameplay-p4` to guard all three contracts.

### P3 browser/runtime hardening — 2026-09-29
- Make the all-game P3 browser gate require a genuinely mounted lazy game engine rather than merely a visible shared shell, and verify the loading fallback has cleared.
- Require the expected canvas on all 27 canvas-based cabinets, verify restart produces a fresh ready engine session, and verify exiting a game releases the global `game-active` page lock.

### P2 replay-depth hardening — 2026-09-29
- Preserve Memory Matrix playback timing across pause/resume: pending pattern flashes now retain their remaining active-time delay instead of expiring behind the pause overlay and collapsing together after resume.
- Move Type Rush spawn cadence onto active game time so a pause does not consume the hidden wait until the next word or inject an artificial spawn immediately after resume.
- Correct Pac-Runner ghost pathing so ghosts still avoid gratuitous 180° turns at intersections but reverse out of genuine dead ends instead of walking through maze walls.
- Extend the permanent `quality:gameplay-p2` gate to reject the old pause-polling scheduler and require active-time timer preservation.

### Release-candidate reliability pass — 2026-09-08
- Preserve local records when storage is corrupt or temporarily unavailable, validate cached rankings, and report storage/submission state accurately.
- Bound API requests, harden JSON parsing and asynchronous error handling, reject concurrent session replays deterministically, and stabilize tied ranks.
- Isolate modal keyboard actions from game listeners and release canceled gamepad drags and late wake locks.
- Version complete offline caches by build and scope; reject partial downloads and preserve active tabs during updates.
- Fix overlapping phone/tablet header controls and keep Favorites/Recent navigation available on small screens.
- Fix Reaction pause fairness so pre-cue and decoy countdowns freeze while paused and suspended time after a live cue is excluded from measured reaction time; keep both behaviors covered by the permanent P1 gameplay-depth gate.
- Deploy the dedicated Worker/D1 service, configure its Pages build endpoint, and add reproducible failure-path and real service-worker regression tests.

### Added
- Added P19 Arcade Cohesion: one product-level cohesion contract for the arcade home, 32 game cards, shared GameShell toolbar/stage, pause/results, app modals, loading, empty and recovery states without changing any game simulation.
- Added permanent `quality:gameplay-p19` and `quality:browser-p19` certification, including 96 game/profile browser sessions plus home-card, navigation-stress, sound-setting persistence, modal, small-mobile and orientation-recovery checks.
- Added `docs/P19_ARCADE_COHESION_CERTIFICATION.md` with the shared component inventory, product-vs-game identity contract, explicit no-replay/no-retention boundary, manual visual-cohesion protocol and 32-game certification matrix.
- Added P18 Clarity, Teaching & Accessibility Excellence: one explicit clarity profile for every shipped game with a concise objective, essential/secondary controls, canonical mastery terminology, danger/benefit/failure guidance, next-attempt coaching, and non-color visual-redundancy evidence.
- Added structured pause teaching (Objective / Essential / Secondary / Mastery / Watch For), concise result guidance, and selective one-time micro-hints for the 12 games whose core interactions benefit from immediate context without interrupting instant play.
- Added accessible shell control names and shortcuts, modal pause/result semantics with focus containment/restoration, visible keyboard focus treatment, responsive touch-target floors, and a permanent mastery terminology registry.
- Added `quality:gameplay-p18` plus a 96-session `quality:browser-p18` matrix covering all 32 games at desktop, 390px reduced-motion mobile, and 320px reduced-motion small-mobile layouts.
- Added P17 Game Feel & Feedback Excellence: one explicit feel profile for every shipped game, a bounded shared feedback runtime with an eight-node pool, game-specific semantic success/mastery/failure hierarchy, and a permanent `quality:gameplay-p17` certification.
- Added a dedicated P17 browser certification that exercises all 32 games in full-motion desktop and reduced-motion touch-mobile contexts, including input acknowledgement, mastery/failure hierarchy, restart stability, overflow prevention, and exit cleanup.

### Changed
- Normalized shared product geometry, focus rings, touch-target sizing, modal overlays/panels, action hierarchy, card weight and shell chrome while preserving per-game canvas art, palette, HUD, particles, sound and mastery identity.
- Replaced the clickable generic home-brand element with a named native button, normalized pause exit terminology to **Back to Arcade**, and added defensive modal-stack protection so only the top app-level modal remains interactive if overlapping surfaces are ever rendered.
- Preserved all existing favorites, recent-games, statistics, achievements, profile and leaderboard features without expanding them into replay, challenge, currency, unlock, run-history or new retention systems.
- Upgraded pause and result surfaces into compact learning/recovery surfaces while keeping all active gameplay free of persistent tutorial cards; high-speed games receive no new playfield-obscuring teaching UI.
- Added text/shape/position redundancy for P18 teaching so the clarity layer remains understandable with reduced motion, muted audio, or haptics disabled, without claiming full screen-reader playability or WCAG conformance for realtime canvas mechanics.
- Added reduced-motion-safe presentation feedback that preserves state information through contrast and outlines rather than motion-heavy effects, with smaller global feedback for high-speed games so hazards remain readable.
- Preserved all P0–P18 gameplay, scoring, timing, balance, fairness, game-feel, clarity and roster-grade contracts; P19 changes product cohesion only and does not promote letter grades or add gameplay systems.

## 1.1.1 — 2026-08-29

### Added
- Added repository governance and release-hardening files: CODEOWNERS, pull-request validation template, Dependabot maintenance, security disclosure policy, contribution workflow, production release checklist, and the permanent `quality:hardening` audit.

### Changed
- Hardened GitHub Actions with read-only checkout credentials, full-SHA action pinning, stale-CI cancellation, job timeouts, and a Pages deployment chain that builds and deploys the exact `main` commit only after its CI run succeeds.
- Upgraded the GitHub Pages Actions stack to Node-24-generation releases: checkout 7.0.1, configure-pages 6.0.0, upload-pages-artifact 5.0.0, and deploy-pages 5.0.0, each pinned to an immutable commit SHA.
- Regenerated and certified the Bun dependency lock while upgrading `@types/node` to 26.3, `lucide-react` to 1.34, and `motion` to 13.1.
- Upgraded the build toolchain as one compatibility unit to Vite 8.2.2 and `@vitejs/plugin-react` 6.1, with frozen-install, TypeScript, Worker, root build, Pages build, MA3/MA4, and all 32-game regression gates passing before and after merge.
- Kept the 32-game roster, scoring rules, gameplay behavior, Worker runtime behavior, and leaderboard semantics unchanged during the maintenance release.

## 1.1.0 — 2026-08-29

### Added
- Added Neon Rail Shift as the 32nd game: a responsive three-rail reflex runner with certified reachable barrier sequences, safe-lane core guidance, streak scoring, progressive speed, touch/keyboard lane switching, and a cooldown-based Phase shield.
- Added the permanent `quality:release32` gate to enforce exact parity between 32 game modules, 32 lazy registry entries, 32 Worker rules, current release metadata, permanent regression audits, and repository cleanup constraints.

### Changed
- Added a shared `ResizeObserver`-driven canvas coordinate layer and migrated Air Hockey, Astro Blaster, Breakout, Chain, Dodge, Laser Blade, Neon Pinball, Stack, and Gravity Tower to remap live game state across desktop resizing, fullscreen changes, and device orientation changes.
- Replaced Laser Blade's fixed launch velocity with a certified height-aware parabola that places every target apex in the upper 12–32% of mobile and desktop arenas.
- Rebuilt Neon Pinball around fixed 120 Hz substeps, collision separation and cooldowns, finite one-use outlane kickbacks, a five-second one-use ball saver, a genuinely open center drain, exact three-life accounting, multiball-aware drains, and a one-shot game-over callback.
- Replaced Chrono Wave's independent random single-sector gaps with a reachability planner: every wall now has a two-sector opening, consecutive openings move by at most one sector, impact times remain ordered, stage color changes clear old walls and provide a protected transition window, and the first new opening is forced around the player's current position.
- Normalized Chrono Wave movement, spawning, wall contraction, collision crossing, particles, and UI effects to a 60 Hz simulation baseline so high-refresh displays cannot accelerate the game into unavoidable sequences.
- Removed the global plain-`F` fullscreen shortcut so Neon Rhythm Tapper owns all D/F/J/K lane keys; fullscreen remains available from the toolbar and through `Alt+Enter`.
- Rebuilt Cyber Pac-Runner movement around captured WASD/arrow input, immediate mid-corridor reversals, retained direction buffering, a forgiving intersection turn window, tile-center collision stepping, and deterministic tunnel wrapping.
- Added a cross-game mobile runtime layer that tracks the visual viewport, avoids zero-size canvas initialization, caps backing-canvas memory, polyfills rounded canvas rectangles for older mobile browsers, and replaces silent animation-loop crashes with a visible recovery panel.
- Repaired Cyber Drift on mobile with responsive road geometry, live resize remapping, shrink-safe layout, compact touch controls, and pointer-captured steering.
- Upgraded Laser Rope Reflex across Phases A–C with a layered neon arena, multi-layer beams, reactor/player redesign, upgraded HUD, incoming-pattern telegraphs, near-miss/combo/collision feedback, screen effects, dedicated start/pause/game-over presentation, Reflex Grades, and responsive labeled controls while preserving its certified core mechanics.
- Enlarged Cyber Block Drop on desktop with responsive cell sizing and added a standard one-hold-per-piece Hold/Swap system with Hold and Next previews, C/Shift keyboard bindings, and a dedicated mobile Hold control.
- Repaired Knife Target aiming so pointer/touch input captures an exact world-space impact point, the flying knife follows that line, rotating-core collision checks use the same local-angle coordinate system as rendered knives/crystals/shields, and embedded knives appear exactly where the shot lands.
- Reworked Neon Puck Smash around a bounded portrait table instead of stretching the arena to the full canvas: desktop width is capped, tall and short mobile layouts stay inside the rendered stage, HUD/difficulty controls get reserved clearance, game state remaps relative to the table on resize, AI/puck motion scales with arena size, touch dragging uses pointer capture, and puck drag is frame-rate normalized.

## 1.0.0 — 2026-08-28

### Added
- Installable, fully offline-capable PWA shell.
- Persistent Cloudflare guest identity, permanent global rankings, weekly overall ranking, and player profiles.
- Unified gamepad controls and mobile safe-area/wake-lock behavior.
- Root and per-game runtime recovery boundaries.
- Skip navigation, visible keyboard focus, accessible game-card actions, and modal focus trapping.

### Changed
- All 31 game implementations and heavy secondary surfaces are lazy-loaded.
- Vite emits a build manifest and stable vendor chunks.
- The service worker precaches all production chunks, including lazy game modules.
- GitHub Pages deploys the certified Vite `/arcade/` artifact.

### Removed
- Simulated leaderboard competitors and obsolete AI Studio/server scaffolding.
