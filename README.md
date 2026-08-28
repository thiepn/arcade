# Micro Arcade

Micro Arcade is a browser-based collection of 31 instant-play mini-games built with React, TypeScript, Vite, Tailwind CSS, and an optional Cloudflare Worker + D1 leaderboard service.

## Local development

**Prerequisite:** Bun 1.4.0 (the repository-pinned toolchain)

```bash
bun install --frozen-lockfile
bun run dev
```

The arcade itself remains playable without a backend. Local statistics, high scores, favorites, achievements, settings, and game progress are stored in the browser.

## Production build

```bash
bunx tsc --noEmit
bun run build
bun run preview
```

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

The permanent CI gate applies all D1 migrations, smoke-tests the Worker API, verifies frontend/Worker game parity, type-checks both applications, and builds the production frontend.

### Cloudflare deployment

Create the D1 database, replace the placeholder database ID in `wrangler.jsonc`, configure `CREDENTIAL_PEPPER` as a Worker secret, apply the remote migrations, and deploy:

```bash
bunx wrangler d1 create micro-arcade-leaderboards
bunx wrangler secret put CREDENTIAL_PEPPER
bun run d1:migrate:remote
bun run worker:deploy
```

Then configure the frontend with:

```env
VITE_LEADERBOARD_API_URL=https://micro-arcade-leaderboards.<your-subdomain>.workers.dev
```

Without `VITE_LEADERBOARD_API_URL`, the application never fabricates leaderboard competitors; live ranking/profile surfaces simply remain offline while local gameplay continues to work.
