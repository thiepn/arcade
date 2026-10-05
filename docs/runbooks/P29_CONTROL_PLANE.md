# P29 Runbook — Monitoring Control Plane Stale

Use when scheduled P27 or P28 evidence is older than the twelve-hour readiness guardrail.

## First response

1. Inspect the latest P27 Production Burn-In and P28 Reliability Control run timestamps/conclusions.
2. Confirm both workflow files still exist on `main` and their schedules remain enabled.
3. Inspect GitHub Actions permission, quota, disabled-workflow, concurrency, or platform failures.
4. Confirm P27 can still produce its telemetry artifact and P28 can still read Actions history.
5. Restore scheduled evidence before claiming production reliability or closing an incident.

## Do not do first

Do not infer an application outage solely from stale monitoring. Conversely, do not declare recovery merely because a one-off manual request succeeds while scheduled monitoring remains broken.

## Recovery proof

P29 requires both P27 and P28 evidence to fall back inside the freshness guardrail in addition to the ordinary recovery contract.
