# Changelog

## Unreleased

### Added
- Added P17 Game Feel & Feedback Excellence: one explicit feel profile for every shipped game, a bounded shared feedback runtime with an eight-node pool, game-specific semantic success/mastery/failure hierarchy, and a permanent `quality:gameplay-p17` certification.
- Added a dedicated P17 browser certification that exercises all 32 games in full-motion desktop and reduced-motion touch-mobile contexts, including input acknowledgement, mastery/failure hierarchy, restart stability, overflow prevention, and exit cleanup.

### Changed
- Added reduced-motion-safe presentation feedback that preserves state information through contrast and outlines rather than motion-heavy effects, with smaller global feedback for high-speed games so hazards remain readable.
- Preserved all P0–P16 gameplay, scoring, timing, balance, fairness and roster-grade contracts; P17 does not promote letter grades or add gameplay systems.

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
