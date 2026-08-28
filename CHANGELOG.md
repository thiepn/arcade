# Changelog

## Unreleased

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
- Upgraded Laser Rope Reflex Phase A with a layered neon perspective backdrop, responsive framed arena, multi-layer animated laser beams, reactor-style hub, energy-node player rendering, glowing collectibles, and a compact responsive command-deck HUD without changing its core jump/slide mechanics.
- Added Laser Rope Reflex Phase B feedback polish with staged incoming-beam telegraphs, approach warnings, near-miss detection, animated success/shield/collision bursts, combo and streak callouts, controlled screen shake and flash, and a readable post-hit death presentation.
- Finished Laser Rope Reflex Phase C with a dedicated animated start briefing, explicit LOW/DUAL jump and HIGH slide guidance, themed pause and game-over states, score-based Reflex Grades, responsive labeled touch controls, and a longer readable transition from fatal impact into the results screen.
- Enlarged Cyber Block Drop on desktop with responsive cell sizing and added a standard one-hold-per-piece Hold/Swap system with Hold and Next previews, C/Shift keyboard bindings, and a dedicated mobile Hold control.
- Repaired Knife Target aiming so pointer/touch input captures an exact world-space impact point, the flying knife follows that line, rotating-core collision checks use the same local-angle coordinate system as rendered knives/crystals/shields, and embedded knives appear exactly where the shot lands.

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
