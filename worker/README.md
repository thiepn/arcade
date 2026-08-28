# Micro Arcade leaderboard backend

The leaderboard service is a Cloudflare Worker backed by D1. Browser players receive a persistent anonymous guest credential; D1 stores only a peppered SHA-256 hash of the secret. Each game run obtains a one-time play session that must be consumed to submit a score.

## One-time Cloudflare setup

1. Install dependencies: `bun install --frozen-lockfile`.
2. Authenticate Wrangler: `bunx wrangler login`.
3. Create the database: `bunx wrangler d1 create micro-arcade-leaderboards`.
4. Copy the returned database UUID into `wrangler.jsonc` in place of the all-zero placeholder UUID.
5. Create a high-entropy credential pepper: `bunx wrangler secret put CREDENTIAL_PEPPER`.
6. Apply migrations: `bun run d1:migrate:remote`.
7. Deploy the Worker: `bun run worker:deploy`.
8. Copy the deployed Worker origin into `.env.local` as `VITE_LEADERBOARD_API_URL=https://...workers.dev` for local frontend development and configure the equivalent build-time variable in the production frontend deployment.

For local Worker development, create an untracked `.dev.vars` file containing `CREDENTIAL_PEPPER=<random-secret>` and run `bun run d1:migrate:local` followed by `bun run worker:dev`.

## API

- `POST /v1/guest` — create a guest identity and return its opaque browser credential.
- `GET /v1/me` — read the current guest profile.
- `PATCH /v1/me` — update the display name.
- `POST /v1/sessions` — issue a one-time game session.
- `POST /v1/scores` — validate and consume a session, then record the score transactionally.
- `GET /v1/leaderboards/:gameId` — top scores plus the authenticated player's rank.
- `GET /v1/leaderboards/overall` — cross-game ranking.
- `GET /v1/health` — service health endpoint.

## Security model

This is persistent browser guest identity, not hardware attestation. Clearing browser storage creates a new guest. Score submissions require a valid guest credential, a server-issued unused play session, accepted game ID, plausible elapsed time, a game-specific hard score ceiling, and the Worker rate-limit bindings. The browser never receives D1 credentials or the credential pepper.
