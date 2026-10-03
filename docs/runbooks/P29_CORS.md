# P29 Runbook — CORS Contract Failure

Use for `api-cors` failures.

## First response

1. Preserve the failed preflight evidence, including Origin and returned CORS headers.
2. Confirm the expected production origin remains `https://thiepn.dev`.
3. Inspect the leaderboard Function CORS allowlist/response-header logic.
4. Separate a CORS-only failure from API health or database failures.
5. Verify both OPTIONS behavior and a normal read request after any deliberate fix.

## Do not do first

Do not rotate credentials, alter scoring policy, reset leaderboard data, or redeploy the frontend blindly for a CORS-only failure.

## Recovery proof

P29 must independently observe the production CORS contract inside a fully healthy three-sample P27 verification before incident closure.
