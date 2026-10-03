# P29 Runbook — Leaderboard Read Path Failure

Use for `api-overall` or `api-weekly` failures.

## First response

1. Identify whether overall, weekly, or both read paths fail.
2. Preserve HTTP/JSON contract evidence from the synthetic probe.
3. Inspect Function/database read-path health and relevant backend logs.
4. For weekly failures, verify numeric epoch-millisecond `weekStart`/`weekEnd` values and the exact seven-day interval.
5. Confirm immutable score history before considering any data operation.

## Do not do first

Do not reset, rewrite or delete leaderboard data. Do not loosen response validation merely to make the synthetic probe green.

## Recovery proof

Both overall and weekly read contracts must pass as part of P29's healthy three-sample independent verification.
