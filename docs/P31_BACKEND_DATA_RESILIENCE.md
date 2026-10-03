# P31 — Backend Data Resilience, Backup Verification, Restore Readiness & Supabase Disaster Recovery

Date: 2026-10-03. Canonical Supabase project: `hycegznamzjhwinegaai` (THIEPN Account).

## Current platform boundary

The shared THIEPN Account organization is on the Supabase Free plan. P31 therefore does not claim paid daily-backup retention, downloadable managed backups, Restore-to-New-Project, or Point-in-Time Recovery.

Supabase recommends that Free-plan projects maintain their own logical/off-site backups. P31 implements that for Arcade without storing a database password or service-role key in GitHub.

## Recovery layers

P31 uses two independent layers:

1. **Private in-database recovery snapshots** for accidental Arcade data corruption while the canonical project remains available.
2. **Encrypted GitHub Actions artifacts** for loss/unavailability of the canonical Supabase database.

The in-database layer is not called an off-site backup because it shares the same failure domain as production.

## Protected Arcade data

The backup payload contains nine tables:

- `micro_arcade_players`
- `micro_arcade_play_sessions` — only rows referenced by a preserved score submission
- `micro_arcade_score_submissions`
- `micro_arcade_best_scores`
- `micro_arcade_scoring_profiles`
- `micro_arcade_lb_policy`
- `micro_arcade_lb_sessions` — only rows referenced by a preserved leaderboard run
- `micro_arcade_lb_runs`
- `micro_arcade_lb_reviews`

The payload deliberately excludes:

- `micro_arcade_rate_limits`;
- unused one-time `micro_arcade_play_sessions`;
- unused one-time `micro_arcade_lb_sessions`.

This preserves durable identity, score history, moderation evidence, scoring policy/configuration, and the session parents needed by historical foreign keys without resurrecting unused submission tokens or stale throttling state.

## Live baseline before P31

The live pre-P31 audit found:

- 98 players;
- 10 legacy/v2 score submissions;
- 8 legacy/v2 best-score rows;
- 136 v3 leaderboard runs;
- 5 review records;
- 32 scoring profiles;
- one v3 leaderboard policy;
- zero orphan score/player, score/session, best/player, run/player, run/session, or review/run relationships.

P31 does not rewrite this data.

## In-database snapshots

`private.micro_arcade_recovery_snapshots` stores verified snapshots in a non-exposed schema.

Every snapshot records:

- source and UTC capture time;
- SHA-256 schema fingerprint;
- SHA-256 payload fingerprint;
- exact per-table row counts;
- payload byte count;
- verification evidence;
- the durable recovery payload.

Browser roles have no schema/table/function access.

### Snapshot verification

Before a snapshot can be exported, PostgreSQL verifies:

- the exact protected table-key set;
- per-table row counts;
- current schema fingerprint;
- payload hash;
- all preserved player/session/run/review relationships;
- that every preserved play session is submission-backed;
- that every preserved leaderboard session is run-backed.

## Snapshot retention

When `pg_cron` is available:

- daily snapshot: 03:17 UTC, 35-day in-database retention;
- monthly snapshot: 03:47 UTC on day 1, 370-day in-database retention.

Additional retention:

- off-site source snapshots: 100 days;
- restore-drill snapshots: 14 days;
- post-restore snapshots: 90 days;
- manual and pre-restore snapshots: retained until explicitly handled by an operator.

## Non-destructive restore drill

`micro_arcade_p31_restore_drill(snapshot_id)` never truncates or overwrites production.

It:

1. requires a verified snapshot;
2. creates transaction-scoped temporary tables with the current live column types;
3. parses every backed-up row into those types;
4. reconstructs all nine protected tables in temporary space;
5. compares exact row counts;
6. validates parent/child relationships again;
7. returns `productionMutated=false`.

The real PostgreSQL CI test also changes a live fixture row before the drill and proves that value remains unchanged afterwards.

## Off-site backup authentication

The public Edge Function `micro-arcade-p31-backup-export` has `verify_jwt=false` intentionally because it does not use Supabase user JWTs.

Instead, POST access requires a short-lived GitHub Actions OIDC token. The function verifies:

- GitHub's RS256 signature through the issuer JWKS;
- issuer and audience `arcade-p31-backup`;
- repository `thiepn/arcade` and repository ID `1347223890`;
- owner `thiepn` and owner ID `229373572`;
- public repository visibility;
- `refs/heads/main`;
- exact workflow ref `.github/workflows/p31-offsite-backup.yml@refs/heads/main`;
- workflow name `P31 Encrypted Offsite Backup`;
- GitHub-hosted runner;
- permitted event type;
- current token timing.

Only after those checks does the Edge Function use the Supabase runtime service role internally to call the service-role-only export RPC.

No Supabase database password or service-role key is stored in GitHub.

## Encrypted off-site artifact

The daily workflow runs at 04:37 UTC.

The export RPC takes a fresh `offsite` snapshot and runs the database restore drill in the same request. The GitHub runner then:

1. validates the plaintext structure and relationships without printing private rows;
2. rejects stale, malformed, oversized, or transient-contaminated payloads;
3. computes transport evidence;
4. encrypts the JSON using OpenSSL CMS AES-256-GCM;
5. encrypts to the committed recovery certificate;
6. validates the CMS envelope;
7. deletes/shreds the plaintext file;
8. uploads only the encrypted `.cms` file and a non-sensitive manifest;
9. retains the encrypted artifact for 90 days.

The repository is public, so plaintext backup files must never be uploaded as Actions artifacts.

## Recovery key

P31 intentionally reuses the existing offline THIEPN recovery keypair already established for Diet P15.

Only the public X.509 certificate is committed. The corresponding private key remains outside GitHub and Supabase.

Certificate SHA-256 fingerprint:

`98:9E:71:79:15:B9:0B:67:7B:87:BF:FE:71:40:73:46:40:37:9F:18:C0:F8:EF:E5:59:F6:DE:01:81:6D:67:97`

Losing the private key makes the encrypted off-site artifacts unrecoverable. Compromise of that private key exposes any backup encrypted to the shared certificate, so it must remain offline.

## Readiness alert

The backup workflow owns one deduplicated issue marked `p31-backend-backup-readiness`.

It opens or updates the issue if export, verification, encryption, or evidence creation fails. A later fully successful backup closes the issue with a recovery note.

This issue means backup readiness is impaired; it is not itself proof that production is unavailable.

## Full disaster recovery runbook

For loss of the canonical database:

1. Fence Arcade writes / place the leaderboard service in read-only or maintenance mode.
2. Select the newest encrypted artifact whose manifest and ciphertext hash verify.
3. Decrypt locally with:
   `scripts/p31-decrypt-backup.sh backup.cms /secure/path/shared-recovery-private-key.pem restored.json`
4. Run `scripts/p31-verify-offsite.py restored.json`.
5. Provision or recover a Supabase/Postgres target under explicit operator control.
6. Apply the repository migrations through P31.
7. Stage the decrypted payload before touching canonical tables.
8. Re-run relationship/count checks.
9. Restore in dependency order: players → historical sessions → submissions/runs → derived/current score tables → policy/profiles → reviews.
10. Do not restore rate-limit buckets or unused one-time sessions.
11. Verify Edge Function configuration and redeploy `micro-arcade-leaderboards` plus the P31 exporter.
12. Run P27 production probes, P29 operational readiness, and P31 snapshot/restore verification.
13. Resume writes only after those checks pass.

P31 contains no automated destructive production-restore endpoint.

## RPO / RTO interpretation

Operational targets while both schedules remain healthy:

- private daily snapshot target RPO: ≤ 24 hours;
- encrypted off-site target RPO: approximately ≤ 26 hours;
- encrypted artifact retention: 90 days;
- monthly in-database historical retention: 370 days.

These are workflow targets, not guarantees from the Free Supabase plan.

P31 does not claim a fixed RTO. Restore duration depends on target provisioning, database size, GitHub/Supabase availability, migration application, and operator verification.

## Paid-plan upgrade path

If the shared project later moves to a paid plan, Supabase-managed daily backups or PITR can become an additional layer. P31's encrypted logical backup should remain useful as an independent failure domain even then.

Supabase-managed database backups do not include Storage objects. Arcade currently has no recovery requirement for Supabase Storage objects; if Arcade adds a bucket later, object backup must be added explicitly.

## Exit criteria

P31 is complete when:

- the migration passes real PostgreSQL 17 integration tests;
- production receives the P31 migration;
- the OIDC exporter is deployed;
- a production snapshot verifies;
- a transaction-scoped production restore drill passes;
- the encrypted off-site workflow produces a valid ciphertext artifact;
- no plaintext artifact is retained;
- the readiness issue is clear;
- P27/P29 production health remains green after backend changes.
