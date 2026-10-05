# P30 — Disaster Recovery, Rollback Certification & Production Continuity Drills

P30 adds a recoverability layer above P27 production probes, P28 reliability control, and P29 incident/recovery verification. It provides a repeatable non-destructive continuity drill and a tightly guarded manual GitHub Pages rollback path.

## Scope

P30 can recover the **static GitHub Pages application artifact** to a previously successful production SHA.

P30 **does not restore Supabase** databases, rewrite leaderboard history, rotate credentials, recreate deleted backend data, change scoring policy, or automatically repair backend incidents. A frontend rollback and a database restore are different procedures.

All continuity evidence is synthetic and operational. P30 collects **no player/session telemetry**.

## Failure domains

P30 treats recovery as separate failure domains:

1. **Pages/static artifact** — recoverable through the guarded rollback workflow when a previous compatible production artifact is known good.
2. **Leaderboard backend / Supabase** — diagnosed by P27/P29, but not restored by P30.
3. **GitHub Actions / deployment control plane** — if Actions itself is unavailable, the automated rollback path is unavailable and the incident remains a manual platform/control-plane problem.
4. **Monitoring evidence** — P29 must remain healthy/fresh before recovery can be considered operationally verified.

## Known-good rollback candidate

The continuity drill does not choose an arbitrary Git commit.

`scripts/select-rollback-candidate-p30.mjs` reads successful production deployment history from both:

- normal `Deploy Production` runs; and
- prior `P30 Guarded Rollback` runs.

It deduplicates deployed SHAs and selects the **previous known-good**, distinct successful production SHA. That candidate must also retain successful `main` push CI evidence.

For manual rollback, `scripts/authorize-rollback-p30.mjs` applies the same provenance requirement to the exact user-supplied target SHA.

## Non-destructive continuity drill

`.github/workflows/p30-continuity-drill.yml` runs:

- after a successful normal production deployment;
- after a successful guarded rollback;
- weekly as an independent continuity exercise; and
- manually when needed.

The drill:

1. identifies current production and the previous known-good candidate;
2. checks out the candidate into a separate working directory;
3. rebuilds it without touching production;
4. reruns scoring and leaderboard contract checks;
5. builds the `/arcade/` Pages artifact;
6. certifies the artifact with P26, MA3 and MA4;
7. independently verifies current production with three P27 samples;
8. requires the latest P29 operational-readiness run to be green;
9. records a 90-day evidence bundle.

The continuity workflow has no `pages: write` or deployment permission. It cannot publish the candidate.

If the drill fails, P30 opens or updates one dedicated **Disaster Recovery Readiness** issue. This issue means the rollback path is not currently certifiable; it does not by itself mean production is down.

## Guarded production rollback

`.github/workflows/p30-guarded-rollback.yml` is **manual-only**. It has no schedule and no workflow-run trigger.

A rollback requires two workflow inputs:

- `target_sha`: exact 40-character SHA;
- `confirm_sha`: the exact same SHA entered again.

Authorization fails unless:

- both values are exact and identical;
- the target is not already the currently deployed production SHA;
- the target is present in successful production deployment history; and
- the target retains successful `main` push CI evidence.

The authorization is therefore **double-confirmed**. There is no automatic rollback from an alert and no production write that merely means “latest minus one.”

## Re-certification before deployment

Even a historically successful target is rebuilt again before deployment.

The rollback workflow requires the historical source to contain the modern P26/P27 production-certification generation and reruns:

- scoring audits;
- leaderboard contract audits;
- Pages build;
- P26 production artifact certification;
- MA3;
- MA4.

Only a newly rebuilt and re-certified artifact can reach `actions/deploy-pages`.

This intentionally rejects very old production SHAs that cannot satisfy the current recovery contract.

## Live verification after rollback

After Pages deployment, P30 checks out current `main` operational tooling and verifies the rolled-back production with:

- quick P3 browser smoke;
- P26 device-profile/production browser smoke;
- **three P27 production samples**.

The rollback workflow does not automatically roll forward if this verification fails. A failed rollback certification remains visible as an incident/recovery problem; blind chained redeployments are intentionally avoided.

P29 also runs automatically after `P30 Guarded Rollback` completes.

## Actual deployed SHA tracking

A manual workflow run's GitHub Actions `head_sha` points at the workflow definition on `main`, not necessarily the artifact being deployed.

P30 therefore sets `P30 Rollback → <target_sha>` as the workflow run name.

The shared recovery core parses that target and exposes the **actual deployed SHA**. P28 and P29 use this value when correlating reliability state, incident diagnostics and deployment history.

## Forward recovery

After a rollback, the same guarded workflow can later deploy another previously successful production SHA, including the newer `main` release that was live before the rollback, provided it remains in successful production history and still passes re-certification.

This makes rollback and **forward recovery** the same controlled mechanism rather than two unrelated emergency paths.

## Data preservation boundary

The rollback workflow contains no Supabase write/delete operations and no data migration step.

Its data-preservation objective is structural: **a frontend rollback must not mutate backend leaderboard/player data**.

P30 does not claim that a frontend rollback can prevent data loss caused by a separate backend/database disaster.

## Recovery-time interpretation

The guarded rollback jobs have bounded workflow timeouts:

- authorization: 10 minutes;
- historical rebuild/certification: 15 minutes;
- Pages deployment: 15 minutes;
- live verification: 15 minutes.

These are procedural budgets, **not a guaranteed RTO**. GitHub runner queues, GitHub Pages propagation and external platform outages can add delay.

P30 records drill/runtime evidence rather than inventing a recovery-time guarantee that the architecture cannot enforce.

## Incident integration

P28 and P29 merge normal production deployment history with P30 rollback history.

P29 is triggered after a guarded rollback and continues to own final incident recovery closure. P30 does not close reliability incidents.

A rollback is evidence of a deployment action, not proof that the root cause was the previous deployment.

## Safety rules

P30 must never:

- automatically rollback because a probe failed;
- accept an arbitrary unproven Git SHA;
- deploy when the two SHA confirmation inputs differ;
- use a rollback to reset leaderboard data;
- change scoring/AP/policy identifiers as an incident workaround;
- rotate credentials as a generic recovery action;
- claim a continuity drill actually deployed production;
- claim a successful frontend rollback proves the backend is restored.

## Exit criteria

P30 implementation is complete when:

- deterministic rollback-selection/authorization tests pass;
- the continuity drill can rebuild and certify a previous known-good production SHA without Pages write permission;
- the manual rollback workflow is provenance-gated and double-confirmed;
- P28/P29 correlate the actual rolled-back SHA;
- release32 permanently enforces the P30 contracts; and
- a real continuity drill succeeds against production after deployment.

**No real production rollback is required** to complete P30. Performing an outage-style rollback simply to prove the workflow would create unnecessary production risk.


## Automatic readiness reconciliation

The continuity drill also runs after a successful **P29 Operational Readiness** workflow. This is intentional: P30 consumes the latest P29 conclusion as part of its readiness decision, so a stale P30 failure must be re-evaluated automatically when P29 recovers.

This trigger does not deploy a rollback. It performs the same non-destructive rollback-candidate certification, live production probe, and readiness evaluation. If P29 and the remaining continuity checks are green, the existing P30 readiness issue is closed automatically.
