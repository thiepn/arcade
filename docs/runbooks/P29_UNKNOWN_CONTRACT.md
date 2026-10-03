# P29 Runbook — Unknown Production Contract Failure

Use when P29 detects a hard production condition that cannot be assigned safely to another class.

## First response

1. Preserve P27, P28 and P29 artifacts and the recent CI/deployment timeline.
2. Reproduce the exact failing production request without changing production state.
3. Determine whether the failure belongs to Pages/artifact, CORS, backend health, leaderboard read path, or monitoring control plane.
4. Route to the narrower runbook once evidence supports the classification.
5. Keep the incident open while classification is unresolved.

## Do not do first

Do not use broad destructive actions such as credential rotation, data reset, policy changes, rollback commits or blind redeployment as diagnosis.

## Recovery proof

Unknown failures use the same strict P29 recovery contract. Lack of classification does not reduce the required evidence.
