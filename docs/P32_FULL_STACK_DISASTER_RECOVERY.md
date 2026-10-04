# P32 — Full-Stack Disaster Recovery Exercise, Cold Restore Orchestration, Recovery-Time Measurement & End-to-End Failover Certification

Date: 2026-10-04.

## Purpose

P32 proves that Arcade can be reconstructed from recovery data into an isolated cold environment and used by the real application stack without changing production traffic or production durable gameplay data.

The certified path is:

`production → P31 verified export → fresh PostgreSQL 17 → repository migrations → exact durable-data restore → exact leaderboard HTTP handler → real Vite frontend → Chromium browser certification`.

Production receives a P27 probe before and after every P32 exercise.

## Free-plan recovery boundary

The shared Supabase project remains on the Free plan. P32 does not provision a Supabase Branch, Restore-to-New-Project target, paid daily-backup restore, or PITR target.

The isolated cold target is a disposable PostgreSQL 17 service on a GitHub-hosted runner. This avoids introducing paid recovery infrastructure solely for a drill while still exercising the repository migrations, protected data, leaderboard database functions, exact HTTP handler, frontend build, browser CORS, leaderboard reads, and gameplay shell.

## Two backup sources are intentionally distinguished

P32 does not claim that automated CI decrypts the real encrypted backup.

### Retained encrypted artifact reference

Every exercise downloads the latest successful P31 encrypted Actions artifact. It verifies:

- the P31 evidence manifest is valid;
- the `.cms` ciphertext exists;
- its SHA-256 exactly matches the retained manifest;
- the capture timestamp can be used to measure current encrypted-backup age.

This proves the retained off-site object remains present and unchanged.

### Automated cold-restore source

The actual automated restore uses a fresh P31 logical export obtained with a short-lived GitHub OIDC token using audience `arcade-p32-recovery`.

The P31 export Edge Function authorizes only the exact repository, owner, main ref, GitHub-hosted runner, workflow name, workflow ref, event type, and audience. P32 receives no database password and no Supabase service-role secret.

### Offline private-key boundary

The encrypted P31 artifacts are intentionally encrypted to the offline THIEPN recovery certificate. The matching private key remains outside GitHub and Supabase.

P32 does **not** upload that private key to GitHub to make the exercise more automated. A true encrypted-artifact recovery therefore includes an operator key ceremony followed by `scripts/p31-decrypt-backup.sh`; after decryption the same P32 cold-restore path can be used.

This boundary is reported explicitly as `encryptedArtifactDecryptedInAutomation=false` rather than hidden.

## Fresh-install production-schema parity

The first production P32 exercise intentionally failed before restore because the repository's reconstructed `20260908_micro_arcade_base.sql` fresh-install baseline did not encode several constraints and indexes that already existed in hosted production.

P32 treats that as a recovery defect rather than ignoring the mismatch. The fresh-install baseline is therefore permanently required to reproduce the current production physical schema for the protected Arcade tables, including:

- unique guest credential hashes;
- the two-letter country-code check;
- production foreign-key delete behavior;
- positive best-score submission counts;
- session/submission/ranking indexes used by the deployed schema.

This reconciliation changes only how a **new** database is created from the repository. It does not rewrite the existing production tables.

The P32 static contract now pins those markers so a future cleanup cannot silently make cold restores diverge from production again.

## Cold database reconstruction

`scripts/p32-cold-restore.mjs` has a hard safety guard: it refuses database hosts other than `localhost`/`127.0.0.1` and requires the database name to contain `p32` or `recovery`.

It then:

1. creates only the local Supabase-compatible database roles needed by the migrations;
2. applies every repository SQL migration in lexical order to a fresh database;
3. compares the fresh target's P31 protected-schema SHA-256 to the source backup;
4. truncates only the disposable cold target;
5. restores all nine protected P31 tables in dependency order;
6. restores leaderboard review identity values explicitly;
7. leaves rate-limit state empty;
8. takes a new P31 `restore_drill` snapshot on the cold target;
9. requires the restored payload SHA-256 to equal the source payload SHA-256 exactly;
10. requires exact row-count, relationship, and historical-session-scope verification.

Any schema drift, missing parent, unexpected row, transient-state resurrection, or payload mismatch fails the exercise before an API is started.

## Cold API

`scripts/p32-cold-api.mjs` imports the same `createLeaderboardHandler` used by the production Supabase Edge Function.

It supplies a localhost PostgreSQL store for the two RPCs needed by the recovery exercise:

- `micro_arcade_rate_limit`;
- `micro_arcade_lb_board`.

The API is started in `readOnly=true` failover mode. It exposes health and leaderboard reads but does not permit guest creation, sessions, score submission, rename, or any other write endpoint.

No production Supabase URL or service-role secret is used by the cold API.

## Real frontend and browser certification

The actual application is rebuilt with:

`VITE_LEADERBOARD_API_URL=http://127.0.0.1:8787/micro-arcade-leaderboards`

Chromium then verifies:

- the Micro Arcade shell loads;
- the Global Leaderboards control is present;
- opening the real leaderboard UI sends a request to the cold API;
- overall leaderboard response is valid;
- weekly leaderboard response is valid;
- health endpoint is valid from the browser origin, proving CORS;
- the production policy ID is preserved;
- a real game (`orbit`) mounts its normal `.game-shell` while the backend remains read-only.

That final point proves the failover candidate supports playable local gameplay while leaderboard writes are intentionally fenced.

## Production isolation

The P32 workflow has:

- `contents: read`;
- `actions: read`;
- `id-token: write` for GitHub OIDC only;
- `issues: write` for readiness alerting.

It does **not** have:

- `pages: write`;
- `contents: write`;
- `deployments: write`.

The exercise therefore cannot publish the cold frontend or switch real traffic.

Production P27 is required to be healthy immediately before and after the isolated exercise. P32 reports `productionTrafficSwitched=false` and `productionDurableDataMutated=false`.

## Recovery-time measurement

`scripts/p32-timing.mjs` records ordered timestamps and durations for:

1. production precheck;
2. retained off-site artifact verification;
3. fresh recovery export;
4. cold database restore;
5. cold API readiness;
6. frontend build/readiness;
7. browser certification;
8. production postcheck.

The final report records:

- latest encrypted artifact age;
- fresh snapshot age when cold restore begins;
- cold restore → API-ready elapsed time;
- cold restore → browser-certified elapsed time;
- total exercise elapsed time.

These are measured observations, **not a contractual RTO or RPO guarantee**. The first successful production P32 exercise establishes an empirical baseline.

## Scheduled drill

`.github/workflows/p32-cold-recovery.yml` runs:

- when P32 recovery implementation changes reach `main`;
- weekly on Sunday at 06:19 UTC;
- manually through workflow dispatch.

Only non-sensitive reports are retained for 90 days. The plaintext recovery export is shredded/removed and never uploaded as an artifact. The disposable PostgreSQL service is destroyed with the GitHub runner.

## Readiness issue

P32 owns one deduplicated GitHub issue marked `p32-fullstack-recovery-readiness`.

If the full certification report is missing or failed, the issue opens or updates. A later fully certified exercise closes it with a recovery note.

A P32 readiness failure means the disaster-recovery path is impaired. It does not by itself mean production is unavailable.

## PR certification

Before P32 reaches `main`, CI runs a second local database exercise:

- the existing P31 PostgreSQL test creates a verified recovery package;
- `tests/p32-cold-restore-postgres.mjs` creates a new database from zero;
- P32 applies all migrations and performs the exact restore;
- schema hash, payload hash, counts, transient exclusion, overall board, and weekly board must pass.

This prevents the production P32 workflow from being the first execution of the cold restore code.

## What P32 does not claim

P32 does not claim:

- real production traffic has been failed over;
- an encrypted artifact was automatically decrypted;
- the offline private key is stored in automation;
- Supabase Free provides paid backup/PITR guarantees;
- a measured drill duration is a guaranteed RTO;
- the cold GitHub runner is itself a production-grade replacement hosting platform.

## Exit criteria

P32 implementation is complete when:

- P32 static/deterministic gates pass;
- real PostgreSQL cold-restore CI passes;
- the narrowed P31/P32 OIDC exporter is deployed;
- the P32 workflow is merged;
- the first real exercise verifies the latest encrypted artifact;
- a fresh production recovery payload restores exactly into a cold database;
- cold API health/overall/weekly reads pass;
- the real frontend/browser/game shell pass against the restored backend;
- production P27 is healthy before and after;
- measured timing evidence is retained;
- no P32 readiness issue remains open.
