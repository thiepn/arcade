# P29 — Incident Runbooks, Automated Diagnostics, Recovery Verification & Operational Readiness

P29 is the operational response layer above P27 synthetic production telemetry and P28 SLO/incident control. It adds deterministic diagnostics, runbook routing, control-plane freshness checks, deployment/CI timelines, and an independent recovery verifier.

## Safety boundary

P29 is diagnostic and incident-lifecycle automation only. It does **not** redeploy production, rotate credentials, modify Supabase data, change scoring/AP policy, rewrite leaderboard history, reset users, or apply rollback commits.

All production evidence is synthetic. P29 collects **no player telemetry**, cookies, browser storage, fingerprints, session replay, or gameplay-event streams.

## Response flow

1. P27 detects production contract state.
2. P28 evaluates the rolling synthetic checkpoint SLO and opens/updates one incident issue when required.
3. P29 runs an independent three-sample P27 verification.
4. P29 gathers recent P27, P28, deployment and CI history.
5. Failures are routed to the smallest matching runbook.
6. P29 posts a diagnostic comment only when its diagnostic fingerprint changes.
7. Recovery remains open until P29 independently verifies all recovery gates.
8. Only then may P29 close the automated incident.

## Failure routing

| Classification | Scope | Runbook |
| --- | --- | --- |
| `pages-artifact` | Pages shell, manifest, service worker or built game artifact | `docs/runbooks/P29_PAGES_ARTIFACT.md` |
| `cors` | production-origin CORS contract | `docs/runbooks/P29_CORS.md` |
| `backend-health` | Supabase Function health/protocol/policy contract | `docs/runbooks/P29_BACKEND_HEALTH.md` |
| `leaderboard-read-path` | overall/weekly leaderboard read contract | `docs/runbooks/P29_LEADERBOARD_READ_PATH.md` |
| `control-plane-stale` | P27/P28 monitoring evidence is older than the readiness guardrail | `docs/runbooks/P29_CONTROL_PLANE.md` |
| `unknown-production-contract` | hard failure that cannot yet be safely classified | `docs/runbooks/P29_UNKNOWN_CONTRACT.md` |

A deployment-adjacent flag means only that a production deployment completed within the configured correlation window before the diagnostic probe. It is **not** a claim that the deployment caused the incident.

## Recovery verification

P28 no longer closes its own incident when it becomes recovery-ready. It delegates final closure to P29.

P29 requires all of the following before automated closure:

- an open automated production incident;
- an independent P27 probe that is `healthy` across at least **3 samples**;
- zero independent-probe failures;
- zero independent-probe warnings;
- no active rolling 30-day / 99% synthetic SLO breach;
- the latest **2 scheduled P27 checkpoints** are successful;
- the latest P28 control run completed successfully;
- the latest production deployment workflow completed successfully;
- both P27 and P28 control-plane evidence remain within the **8-hour** freshness guardrail.

A single green request is therefore insufficient to close an incident.

## Diagnostic evidence

Every P29 run records:

- independent P27 production evidence;
- rolling SLO/error-budget state;
- P27/P28 control-plane freshness;
- recent scheduled P27 checkpoints;
- recent P28 runs;
- recent production deployment runs;
- recent CI runs;
- current failure classification and runbook routing;
- deployment-adjacent correlation;
- incident action and recovery-verification result.

P29 evidence is retained for 90 days by its workflow.

## Operational readiness

`.github/workflows/p29-operational-readiness.yml` runs after each completed P28 control run, weekly as an independent backstop, and manually when required.

A control-plane freshness failure is treated as an incident condition because monitoring that silently stops cannot establish production reliability. The guardrail is eight hours, intentionally wider than the six-hour P27 cadence.

## Incident communication

P29 does not create a new diagnostic comment every run. It hashes the meaningful diagnostic state and comments only when that fingerprint changes. This keeps one incident useful instead of turning it into a six-hour log stream.

If P28 failed to create the incident issue but P29 independently detects a hard condition, P29 can create the same single incident control surface as a backstop.

## Exit criteria

P29 implementation is complete when its deterministic core tests, static operations contract and release32 contract pass; the operational-readiness workflow is on `main`; P28 delegates closure to P29; and a healthy production run proves P29 can execute against real GitHub Actions history without mutating production.
