# P29 Runbook — Pages / Artifact Failure

Use for `site-root`, `asset-manifest`, `service-worker` or `webmanifest` failures.

## First response

1. Record the failing P27/P29 run and exact production deployment SHA.
2. Inspect the latest `Deploy Production` build, deploy and `certify-live` jobs.
3. Compare the live shell, `asset-manifest.json`, `sw.js` and `manifest.webmanifest` as one deployed artifact set.
4. Verify the manifest still contains exactly 32 game chunks and the production replacement engines expected by P26.
5. Check whether the failure is deployment-adjacent; treat that only as correlation.

## Do not do first

Do not change scoring, Supabase, leaderboard data, credentials, or game balance. Do not clear production data to solve a Pages artifact mismatch.

## Recovery proof

Recovery needs the normal P29 closure contract: three healthy independent samples, two green scheduled P27 checkpoints, green P28 and deployment state, and fresh monitoring evidence.
