# Leaderboard v3 — release and operations

## Scope and contract

This is a replacement competition service and client, not another native game-score rewrite. The authored game economy remains scoring version 2. Leaderboard protocol and rating version are 3. The complete policy is frozen by a SHA-256 identifier in `shared/leaderboard/policy.json` and generated SQL. A client and server with different policy IDs refuse to exchange competitive results.

**Score** is native gameplay output. **AP** is the existing per-game/per-mode conversion, now ranked at micro-AP precision. **Rating** sums one bounded contribution per game. Overall and weekly ties share ranks; uncapped AP cannot break rating ties. Different modes never create extra game slots.

Standard games contribute up to 10,000 rating at 10,000 AP. Finite elite targets are Reaction 6,500 AP, Perfect Stop 6,500 AP, and Gravity 8,000 AP. Contributions interpolate linearly to 10,000 and stop there; individual AP continues increasing. These are explicit design targets, not measured player percentiles or proof of equal human difficulty.

## Fixes and newly discovered defects

- Whole-number AP previously hid genuinely better runs. AP and rating now have canonical integer micro-units; all ordering uses those units, never display strings.
- The previous uncapped-total tie-breaker restored single-game dominance among capped ties. It is removed. Stable list order does not give tied players different ranks.
- Finite games can reach a full elite contribution without needing impossible scores.
- Results cannot choose their own AP. PostgreSQL derives both AP and contribution from preserved native evidence and the frozen policy.
- Results are bound to a player, game, mode, policy and session. Fresh v1/v2 API writes are rejected with an update-required response.
- Identical session-start requests reuse a token. Identical result retries return the original receipt, including after a lost response. A changed result for an already-used session is rejected. PostgreSQL row locks serialize simultaneous submissions.
- Submission evidence is immutable. Moderation changes eligibility with a separate audit record, not the native score.
- Conservative native/time screening excludes suspicious results until review. Authored finite ceilings reject impossible results. Long-run score envelopes are review thresholds, not automatic bans.
- Client IndexedDB outbox persists before transmission. Retries freeze native score, mode and duration, honor Retry-After and backoff, and cannot move a result to another player. LocalStorage and explicitly non-durable memory fallbacks are available.
- Invalid credentials no longer silently create a replacement player. Private recovery codes support restoring the same published identity on another device. Codes are not included in public responses, logs or run records.
- Existing credential hashes can be upgraded without changing player IDs. New high-entropy guest-secret hashes do not depend on the service-role key.
- Completion is captured before asynchronous uploads. Paused/background time is excluded from the gameplay clock. Weekly classification uses the stored completion estimate, not the eventual retry/arrival time.
- Hockey difficulty changes now start a new match instead of changing the label and rewards halfway through an existing one. Rhythm mode changes likewise remount clean state. Stale engine callbacks cannot finish a newer run.
- Mode-specific native PBs and AP PBs retain their own run context. Old local records cannot overwrite the new storage key. Stale settings saves merge monotonic record improvements.
- One shared leaderboard component replaces two divergent implementations. Global, weekly and game/mode views include full mobile names, pagination, precise rank context, self-position, contribution explanations, upload state and local/published distinction.
- Anonymous board reads no longer create guests. Unknown input fields, malformed data, oversized/stalled bodies and invalid pagination fail closed.
- Expired unused tokens and stale rate-limit buckets are cleaned in bounded batches on session creation. Submitted evidence is never pruned by this cleanup.
- Fresh-database bootstrap is now in the repository; the prior migration depended on manually created tables.

## Preserved data

The old `micro_arcade_score_submissions`, `micro_arcade_best_scores` and other v1/v2 tables remain in place. The migration does not delete or rewrite their original raw evidence. Compatible source-version-2 submissions are copied once into the new competition tables and re-evaluated against policy 3. Old source-version-1 gameplay remains visible in the player's archive but no longer enters the current-rule championship.

Old guest player IDs and recovery secrets remain valid through the hash upgrade. Already-earned local badges and settings remain preserved. Restoring a player links published records, not another browser's local preferences or unsent runs. Resetting local statistics does not erase public records, identity or pending uploads.

## Production deployment order

Production uses **Supabase**. The old Cloudflare/D1 implementation is retained as legacy reference/regression code and is not a protocol-3 deployment target. Do not point this frontend at the old Worker.

1. Require a green full GitHub CI run for the exact release commit. This includes PostgreSQL integration, browser/network tests and existing game regressions.
2. Export/backup the existing `micro_arcade_*` tables through the normal database backup process. Record submission counts and a digest over original raw evidence. Never put service-role keys or player credentials in repository artifacts.
3. Apply repository migrations in filename order. Existing tables are created with `IF NOT EXISTS`, v2 has native-evidence null guards, and v3 backfill has unique-session conflict guards. On an existing project, reconcile migration history first; do not drop schemas or reset production. The v3 migration is additive and transactional, with a five-second lock timeout.
4. Deploy `supabase/functions/micro-arcade-leaderboards/index.ts` plus relative `server/leaderboard` and `shared/leaderboard` dependencies. Supabase CLI example: `supabase functions deploy micro-arcade-leaderboards --no-verify-jwt --project-ref hycegznamzjhwinegaai`. JWT checking is intentionally disabled ONLY because the handler authenticates high-entropy guest credentials itself. Keep the built-in `SUPABASE_SERVICE_ROLE_KEY` server-only.
5. Verify `/v3/health` and public overall/weekly/game reads. Health must return protocol 3 and the exact release policy ID. Verify CORS from the production origin. The Pages workflow checks these requirements before building/deploying.
6. Merge the certified frontend release. The existing main-CI → Pages pipeline deploys only the exact main commit that passed CI. Do not bypass its gate.
7. Confirm deployed HTML/service-worker build hash, perform a real non-test game on desktop and mobile, verify its receipt and public rank, then reload to check persistence. Automated live smoke checks must also pass.

There is a short coordinated cutover: old cached clients preserve local progress but receive an update-required response from the new API. Reload to join the new board. Do not claim the release is live before backend and Pages checks actually succeed.

## Maintenance and recovery

Set server environment `LEADERBOARD_READ_ONLY=1` and redeploy the same v3 handler to pause writes while preserving readable records. Queued uploads see a retryable maintenance response. Clear it after the repair. Prefer a forward fix; do not roll the database back destructively or deploy the old credential-dependent v2 backend over upgraded credentials.

Each play session allows up to six hours of run wall time and seven additional days for delivery. Exact duplicate receipts remain queryable afterward. Longer gameplay is still local, but cannot create a valid result beyond that session's six-hour limit. Runs without an online-issued session are local-only; reconnecting cannot retroactively authenticate arbitrary local history.

Queue capacity is 256 pending/auth-blocked runs. Full queues preserve existing entries and show an explicit error rather than silently deleting pending runs. Up to 100 terminal local receipts are retained; the server retains the evidence. Browser storage may be denied or evicted; the UI reports unavailable durable storage and never promises that in-memory fallback survives a closed tab.

## Review workflow (service-role/admin only)

No public endpoint can moderate a score. Inspect runs with `status='review'`. Review plausibility and associated native score, mode, frozen active/wall durations and source version. Then call `micro_arcade_lb_review(p_run, p_status, p_reason)` with `ranked` or `rejected` and a meaningful reason. This records the previous/new status and reason atomically. Current rankings recompute from eligible evidence; a rejected best falls back to the next eligible run. A moderation change invalidates older page snapshots instead of silently mixing rankings across pages. The player can use “Retry / check uploads” to reconcile a reviewed receipt.

Use `micro_arcade_lb_cleanup()` for a manual bounded cleanup if needed. Do not delete historical submitted session rows, which are evidence references.

## Security and calibration limits

This is **plausibility-screened casual competition**, not replay-verified or bot-proof competition. A browser can fabricate a believable run within a conservative envelope; preventing that needs authoritative game simulation or replay verification. CORS is not authentication, and rate limits do not prove human play. Gateway IP throttling is best-effort; authenticated-player throttling is independent. The API rejects arbitrary AP values, wrong ownership/context, impossible finite scores and obvious extreme short-run submissions, but does not claim to identify every cheat.

Fine cross-game difficulty calibration still needs matched-player results. Keep source policy immutable; publish a new version for later calibration. Do not silently redefine v3 or change native game rewards to disguise AP differences. Do not treat large assertion counts as human balance trials.

## Repeatable validation

`bun run quality:leaderboard` — policy generation agreement, all 36 domains, clocks, durable queue/failure semantics, HTTP security boundaries.

`bun run quality:leaderboard-db` — explicitly opted-in local PostgreSQL 17 `*_test` database only. The harness refuses remote/non-test databases and needs `LB_TEST_RESET=1`. It creates fixture roles, fresh schema, v2 history and the additive v3 migration; tests atomicity, permissions, precision and ranking.

`bun run quality:leaderboard-browser` — actual Chromium UI at 320/390/768/1280 pixels with a controlled API; IndexedDB reload and response-loss scenarios. `quality:scoring-browser` retains 108 game/mode/viewport score-boundary cases. These are not gameplay-skill simulations.

Keep the full existing CI gates, including Firefox/WebKit game layouts. Local administrator-blocked browser navigation is not a passing test; use actual CI evidence.
