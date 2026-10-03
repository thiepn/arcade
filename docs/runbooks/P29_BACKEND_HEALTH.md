# P29 Runbook — Backend Health / Protocol Failure

Use for `api-health` failures.

## First response

1. Inspect `/v3/health` independently.
2. Verify `ok=true`, backend `supabase`, protocol version 3, and the deployed scoring-policy hash.
3. Correlate the failure with recent production and backend changes.
4. Inspect Supabase Function availability/logs before changing client behavior.
5. If health is restored, verify overall and weekly leaderboard reads too.

## Do not do first

Do not change the policy hash to match a broken deployment. Do not mutate score history or rotate credentials without evidence that credentials are the failure source.

## Recovery proof

A restored health endpoint alone is insufficient. P29 requires the complete independent production verification and scheduled recovery streak.
