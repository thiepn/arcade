# Micro Arcade

Micro Arcade is a browser-based collection of 32 instant-play mini-games built with React, TypeScript, Vite, Tailwind CSS, and an optional Cloudflare Worker + D1 leaderboard service.

## Local development

**Prerequisite:** Bun 1.4.0 (the repository-pinned toolchain)

```bash
bun install --frozen-lockfile
bun run dev
```

The arcade remains playable without a backend. Local statistics, high scores, favorites, achievements, settings, and game progress are stored in the browser.

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

Local storage remains authoritative for offline personal progress. Live leaderboard submissions/ranks require the configured Cloudflare Worker and network access.

## Mobile experience

The game shell uses dynamic viewport units and safe-area insets for modern phones, including notched devices and standalone PWA mode. Active games suppress background page scrolling/overscroll, preserve game-stage touch isolation, and request a screen wake lock when supported. Backgrounding or locking the device still pauses an active run.

The page no longer disables browser zoom globally. Reduced-motion preferences are also respected by the shell UI.

## Gamepad support

A standard browser Gamepad API bridge is active in the unified game shell.

- Left stick and D-pad drive keyboard-style directional controls where applicable.
- Face buttons map to common arcade actions and game-specific keys for games such as Merge, Rhythm, and Astro Blaster.
- Pointer-oriented games use a visible virtual cursor controlled by the stick/D-pad; the primary face button performs click/hold/drag input.
- Start/Select map to the shell pause/back action.
- Game-over controls support play again, back, next random game, and leaderboard actions.

Gamepad support is additive: existing touch, mouse, keyboard, and on-screen controls remain available and unchanged.

## Live leaderboard backend

The repository includes a Cloudflare Worker + D1 backend with persistent anonymous guest identity, one-time play sessions, score validation, rate limiting, and real rankings.

Leaderboard surfaces include:

- permanent per-game global leaderboards
- permanent global overall leaderboard
- **weekly overall leaderboard** across the entire arcade
- anonymous player profiles with editable display names and global/weekly ranks

The weekly leaderboard is intentionally **overall-only**. There is no weekly leaderboard for individual games. Each player's best accepted score for each game during the current UTC week is combined using the same overall rating model as the permanent global leaderboard. The weekly board changes automatically at Monday 00:00 UTC; no destructive reset job is required.

### Local Worker validation

```bash
bun run d1:migrate:local
bun run worker:dev
```

The permanent CI gate applies all D1 migrations, smoke-tests the Worker API, verifies frontend/Worker game parity, type-checks the applications, builds both root-hosted and GitHub Pages frontend variants, and runs MA3 PWA/offline/gamepad/mobile structural certification against both builds.

### Cloudflare deployment

The Micro Arcade database is provisioned and bound in `wrangler.jsonc`. The Worker runs at `https://micro-arcade-leaderboards.thiepn.workers.dev`. Its credential pepper is a Cloudflare secret. For another Cloudflare account, create a separate database and replace the binding UUID; never reuse or rotate the existing production pepper as part of a routine deployment.

```bash
bun run d1:migrate:remote
bun run worker:deploy
```

Then configure the frontend with:

```env
VITE_LEADERBOARD_API_URL=https://micro-arcade-leaderboards.<your-subdomain>.workers.dev
```

Without `VITE_LEADERBOARD_API_URL`, the application never fabricates leaderboard competitors; live ranking/profile surfaces remain offline while local gameplay continues to work.

## Version 1.1.1 release status

Version 1.1.1 keeps the completed 32-game roster unchanged while hardening the repository/deployment path and modernizing the certified build dependency baseline.

- all 32 game implementations remain code-split and loaded only when opened
- frontend registry and Cloudflare Worker accepted-game rules remain in exact 32-game parity
- `quality:release32` and `quality:hardening` are permanent CI gates
- GitHub Pages deploys only after successful `main` CI and rebuilds the exact CI-certified commit SHA
- GitHub Actions are full-SHA pinned; the checkout/configure/upload/deploy Pages stack uses the current Node-24-generation releases
- the certified dependency baseline includes `@types/node` 26, Lucide 1.34, Motion 13.1, Vite 8.2, and `@vitejs/plugin-react` 6.1
- the PWA build manifest lets the service worker cache every lazy game chunk for complete offline play
- root and per-game error boundaries provide recoverable failure isolation
- keyboard-operable game cards, skip navigation, visible focus, modal focus trapping, zoom support, reduced motion, and safe-area handling form the accessibility baseline
- CI enforces game parity, targeted gameplay regressions, Worker behavior, root and Pages builds, PWA integrity, lazy-loading structure, accessibility structure, and the per-chunk size ceiling

The September 2026 release-candidate audit adds validated persistence with temporary-storage fallback, bounded leaderboard requests and honest submission feedback, isolated modal/game input, atomic score replay handling, safe JSON API errors, complete versioned offline caches, and a responsive header. See [the audit and game inventory](docs/RELEASE_CANDIDATE_AUDIT.md) for evidence and testing limits.

Pages builds use the deployed Worker by default. Set the repository Actions variable `VITE_LEADERBOARD_API_URL` to override it. Local development stays local-only unless `.env.local` configures an API origin. Public API URLs are build-time configuration; credentials and the pepper must never use a `VITE_` variable.

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
