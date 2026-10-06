# Leaderboard release v3

The current competitive backend targets Supabase, not the retained legacy D1 Worker. See [release, migration, validation and recovery instructions](docs/leaderboard/RELEASE.md). Raw Score, normalized AP and bounded Rating are separate.

# Micro Arcade

Micro Arcade is a browser-based collection of 32 instant-play mini-games built with React, TypeScript, Vite, Tailwind CSS, and an optional Supabase-backed leaderboard service.

## Local development

**Prerequisite:** Bun 1.4.0 (the repository-pinned toolchain)

```bash
bun install --frozen-lockfile
bun run dev
```

The arcade remains playable without a backend. Local statistics, high scores, favorites, achievements, settings, and game progress are stored in the browser. The home screen also includes an offline-first UTC daily challenge streak that rotates through the full 32-game cabinet. Existing achievement XP and player levels are surfaced on the home page with near-goal progress and local, goal-aware Play next suggestions. Finished runs also summarize meaningful meta progression—PB gains, badge/XP and level movement, daily completion, available published-rank movement, and one goal-aware next-game suggestion—without requiring the backend for local progress.

## Production builds

Root/custom-domain build:

```bash
bunx tsc --noEmit
bun run build
bun run preview
```

GitHub Pages build (`/arcade/` base path):

```bash
bun run build:pages
```

GitHub Pages is deployed from the generated Vite `dist` artifact through `.github/workflows/pages.yml`; raw repository source is not the intended MA3 deployment artifact.

## PWA and offline play

MA3 makes Micro Arcade an installable progressive web app.

- Web app manifest with 192px, 512px, maskable, and Apple touch icons.
- Production service worker caches the built arcade shell and same-origin assets for offline reuse.
- Navigations use the installed build's cached shell so HTML and lazy chunks stay on the same release.
- Installation succeeds only after every lazy game asset is cached; incomplete updates preserve the installed release.
- Cache names include the build hash and deployment scope. One previous build is retained for other open tabs.
- External leaderboard/API requests are never intercepted by the service worker.
- A browser install prompt is surfaced when the platform supports `beforeinstallprompt`.
- Offline status is shown without blocking local gameplay.
- Service-worker updates are explicit: a waiting update is offered on the arcade home screen and is never allowed to force-reload an active game session.

Local storage remains authoritative for offline personal progress. Live leaderboard submissions/ranks require the configured Supabase leaderboard v3 service and network access.

## Mobile experience

The game shell uses dynamic viewport units and safe-area insets for modern phones, including notched devices and standalone PWA mode. Active games suppress background page scrolling/overscroll, preserve game-stage touch isolation, and request a screen wake lock when supported. Backgrounding or locking the device still pauses an active run.

The page no longer disables browser zoom globally. Reduced-motion preferences are respected by both CSS and JavaScript-driven Motion transitions. The home/PWA shell and sticky header also reserve display-cutout safe areas, matching the in-game shell.

## Gamepad support

A standard browser Gamepad API bridge is active in the unified game shell.

- Left stick and D-pad drive keyboard-style directional controls where applicable.
- Face buttons map to common arcade actions and game-specific keys for games such as Merge, Rhythm, and Astro Blaster.
- Pointer-oriented games use a visible virtual cursor controlled by the stick/D-pad; the primary face button performs click/hold/drag input.
- Start/Select map to the shell pause/back action.
- Game-over controls support play again, back, next random game, and leaderboard actions.

Gamepad support is additive: existing touch, mouse, keyboard, and on-screen controls remain available and unchanged.

## Live leaderboard backend

Production leaderboard v3 runs on Supabase Edge Functions + PostgreSQL. It provides persistent anonymous guest identity, one-time play sessions, server-side score validation, durable result receipts, rate limiting, recovery, and real rankings. The retained Cloudflare Worker/D1 code is legacy reference/regression material and is not the production v3 deployment target.

Leaderboard surfaces include:

- permanent per-game global leaderboards
- permanent global overall leaderboard
- **weekly overall leaderboard** across the entire arcade
- anonymous player profiles with editable display names and global/weekly ranks

The weekly leaderboard is intentionally **overall-only**. There is no weekly leaderboard for individual games. Each player's best accepted score for each game during the current UTC week is combined using the same overall rating model as the permanent global leaderboard. The weekly board changes automatically at Monday 00:00 UTC; no destructive reset job is required.

### Production Supabase validation

Production deployment follows `docs/leaderboard/RELEASE.md`. CI validates the generated leaderboard policy, HTTP/client contracts, PostgreSQL integration, durable upload recovery and browser behavior before Pages deployment. The Pages workflow then checks the live Supabase v3 health/CORS/database reads before building the exact CI-certified commit.

### Legacy Cloudflare/D1 reference

The older Cloudflare Worker + D1 implementation remains in the repository for regression, historical compatibility and protocol-parity checks. It is not the production leaderboard v3 service, and `worker:deploy` intentionally prevents accidental legacy production deployment.

```bash
bun run d1:migrate:local
bun run worker:dev
```

Use the legacy Worker only for its existing local regression paths. Do not point the production frontend at it.

## Version 1.2.0 release status

Version 1.2.0 is the completed P27–P32 product release. It keeps the 32-game roster and scoring v2 economy unchanged while adding the daily return loop, surfaced progression, goal-aware recommendations, results-to-meta feedback, final device/motion/audio polish, and release closure.

- all 32 game implementations remain code-split and loaded only when opened
- frontend registry and retained scoring-protocol accepted-game rules remain in exact 32-game parity
- `quality:release32`, `quality:hardening`, and the P32 closure audit are permanent CI gates
- GitHub Pages deploys only after successful `main` CI and rebuilds the exact CI-certified commit SHA
- GitHub Actions are full-SHA pinned; the checkout/configure/upload/deploy Pages stack uses the current Node-24-generation releases
- the certified dependency baseline includes `@types/node` 26, Lucide 1.34, Motion 13.1, Vite 8.2, and `@vitejs/plugin-react` 6.1
- the PWA build manifest lets the service worker cache every lazy game chunk for complete offline play
- root and per-game error boundaries provide recoverable failure isolation
- keyboard-operable game cards, skip navigation, visible focus, modal focus trapping, zoom support, reduced motion, and safe-area handling form the accessibility baseline
- CI enforces game parity, targeted gameplay regressions, current Supabase leaderboard contracts, retained legacy regression behavior, root and Pages builds, PWA integrity, lazy-loading structure, accessibility structure, and the per-chunk size ceiling

The September 2026 release-candidate audit adds validated persistence with temporary-storage fallback, bounded leaderboard requests and honest submission feedback, isolated modal/game input, atomic score replay handling, safe JSON API errors, complete versioned offline caches, and a responsive header. See [the audit and game inventory](docs/RELEASE_CANDIDATE_AUDIT.md) for evidence and testing limits.

Pages production builds use the Supabase leaderboard v3 endpoint configured in `.github/workflows/pages.yml`. Local development stays local-only unless `.env.local` configures an API origin. Public API URLs are build-time configuration; server credentials must never use a `VITE_` variable.

## Maintenance mode

The P27–P32 roadmap is closed as of version 1.2.0. No P33 is scheduled.

Future changes should be driven by a reproducible defect, a security/platform compatibility requirement, or a concrete requested feature with clear user value. Prefer focused PRs over inventing another numbered phase. Scoring v2, leaderboard protocol v3, historical certification ledgers, and the production Supabase backend must not be silently redefined during routine maintenance.

New regression commands:

```bash
bun run quality:rc-storage
bun run quality:rc-contracts
# With a migrated local Worker running on port 8787:
bun run quality:rc-worker
# With a root build in dist and Chrome installed:
bun run quality:rc-browser
```

Use `RC_CHROME_PATH` for an alternate Chromium executable and `RC_ARTIFACT_DIR` for optional screenshots. The browser regression starts its own isolated local HTTP server. `bun run lint` is TypeScript checking; this repository does not have a separate ESLint gate.
