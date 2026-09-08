# Micro Arcade leaderboard backend

The leaderboard service is a Cloudflare Worker backed by D1. Browser players receive a persistent anonymous guest credential; D1 stores only a peppered SHA-256 hash of the secret. Each game run obtains a one-time play session that must be consumed to submit a score.

## One-time Cloudflare setup

1. Install dependencies: `bun install --frozen-lockfile`.
2. Authenticate Wrangler: `bunx wrangler login`.
3. Create the database: `bunx wrangler d1 create micro-arcade-leaderboards`.
4. For a new account, copy the returned database UUID into `wrangler.jsonc`. The checked-in UUID belongs to the already provisioned Micro Arcade production database; do not create another copy during routine deploys.
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
- `GET /v1/leaderboards/weekly` — current UTC-week overall ranking.
- `GET /v1/health` — service health endpoint.

## Security model

This is persistent browser guest identity, not hardware attestation. Clearing browser storage creates a new guest. Score submissions require a valid guest credential, a server-issued unused play session, accepted game ID, plausible elapsed time, a game-specific hard score ceiling, and the Worker rate-limit bindings. The browser never receives D1 credentials or the credential pepper.

The service is intended for casual competition: scores originate in an editable browser, so the bounds and replay controls cannot prove an honest game simulation. Do not use this model for prizes or trusted competitive results without server verification. Origin checks protect browser access; they are not authentication for non-browser clients. Cloudflare rate-limit bindings are local to Cloudflare locations, not a globally exact quota.

## Release and operations

- Production endpoint: `https://micro-arcade-leaderboards.thiepn.workers.dev`.
- Both migrations were applied and live guest/profile/score/weekly smoke tests passed on 2026-09-08. The synthetic Smoke Player and its scores were removed afterward.
- JSON requests are capped at 4096 actual bytes; rejected/auth/rate-limit/database failures return safe JSON with no-store headers. Rate-limit responses include `Retry-After: 60`.
- D1 batches transactionally consume a session and insert the score. A concurrent duplicate returns 409. Tie ordering is stable by score, achievement time and player ID.
- Observability is enabled at 10% sampling. Unexpected failures log only event, method, path and error type, never request bodies, credentials or SQL error text.
- `bun run worker:types` regenerates `worker/env.d.ts` from Wrangler. Keep the frontend and Worker TypeScript contexts separate.
- Keep `CREDENTIAL_PEPPER` stable: replacing it invalidates existing guest credentials. Store it through `wrangler secret put`, never git or frontend environment variables.
- Health checks confirm the HTTP service; the profile/leaderboard smoke test additionally verifies D1. No scheduled database cleanup or destructive reset is installed.

For rollback, inspect `bunx wrangler deployments list` and use `bunx wrangler rollback <version-id>` after verifying the target version and its schema compatibility. Do not reverse or drop the production D1 schema as part of a frontend rollback. Pages rollback should redeploy a previously successful source commit through CI.
