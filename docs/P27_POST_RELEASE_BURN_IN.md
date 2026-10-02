# P27 — Post-Release Burn-In, Production Telemetry & Operational Reliability

P27 starts from the fully green P26 production chain deployed from `main` commit `c80b4915cea7a6db2cf2ae1c0c7d15da6e47579e`. It adds operational evidence around the released system without changing gameplay, raw score formulas, AP anchors, policy id, scoring version, compatibility ids, leaderboard semantics, or the P24/P25/P26 certification history.

## Boundary: synthetic operations telemetry only

P27 deliberately uses **synthetic** probes from GitHub Actions. There is **no player telemetry**, no gameplay-event stream, no cookies, no fingerprinting, no browser-storage harvesting, no session replay, and no client-side analytics upload.

The telemetry answers only operational questions:

- is the production arcade reachable?
- does the deployed artifact still contain the exact 32 production game chunks?
- are Vector Golf and Hex Capture present while retired Gravity/Astro engines remain absent?
- is the versioned service worker intact?
- does the PWA manifest still resolve correctly?
- does the production leaderboard CORS contract still allow the intended origin?
- does `/v3/health` still report the expected Supabase backend, protocol version and scoring-policy hash?
- do global and weekly leaderboard reads still return structurally valid data?
- what latency did those synthetic requests observe from the GitHub-hosted runner?

Latency is recorded as operational evidence. By default, a latency-budget excursion marks the run **degraded** but does not fail a release because GitHub-hosted runner geography and transient network conditions are not the same thing as end-user latency. Contract, availability, CORS, policy-hash and artifact failures are hard failures. `P27_STRICT_LATENCY=1` is available for an explicitly strict run.

## Production probe

`quality:production-p27` runs `scripts/audit-production-p27.mjs` and checks eight production surfaces:

1. arcade HTML shell;
2. Vite asset manifest;
3. versioned service worker;
4. web app manifest;
5. leaderboard CORS preflight;
6. leaderboard health endpoint;
7. overall leaderboard read;
8. weekly leaderboard read.

Each request has a bounded timeout and up to two attempts by default. A recovered second attempt remains visible as a warning rather than being silently hidden.

Every run writes:

- `p27-report/production-telemetry.json` — machine-readable observations, attempts, response status, latency and findings;
- `p27-report/summary.md` — human-readable status and latency table;
- the same summary to the GitHub Actions job summary when `GITHUB_STEP_SUMMARY` is available.

## Scheduled burn-in

`.github/workflows/p27-production-burnin.yml` runs **every six hours** and can also be triggered manually. Each scheduled run collects three synthetic samples and retains its report artifact for 30 days.

The workflow has read-only repository permission. It does not mutate production, redeploy the application, alter leaderboard data, open issues, or write back telemetry into the repository.

The initial post-release burn-in window is **72-hour** continuous observation. At a six-hour cadence that yields 12 scheduled checkpoints. The window is considered clean when all 12 checkpoints complete without a hard production-contract failure. Recovered requests and latency-budget excursions remain reviewable in the retained reports and Actions history.

After the initial 72-hour window, the same workflow remains a low-frequency production sentinel rather than being deleted after certification.

## Deployment integration

P26 already proves the built artifact and then runs a live high-DPR smoke after GitHub Pages deployment. P27 extends that exact release chain rather than creating a second deployment path.

After `certify-live` finishes the P3 responsive/live-leaderboard checks and the P26 replacement-engine browser smoke, it runs one P27 synthetic production sample against the exact `page_url` returned by the deployment job. This means a new deployment is not considered operationally certified if its shell, artifact manifest, service worker, PWA manifest, CORS, health contract or leaderboard reads are broken.

## Permanent CI contract

`quality:operations-p27` / `quality:gameplay-p27` is a source-level contract gate. It verifies that:

- the P27 production probe remains registered;
- the scheduled burn-in remains present at the six-hour cadence;
- the scheduled workflow retains read-only repository permissions;
- the deployed Pages certification still invokes P27;
- the probe remains synthetic-only and does not introduce browser/session tracking primitives;
- this document keeps the P26 continuity and 72-hour burn-in boundary explicit.

This static gate runs in ordinary CI and therefore does not make pull requests depend on production internet availability.

## Operational classification

P27 uses three run states:

- **healthy** — all hard contracts pass, no recovered request, all observational latency budgets pass;
- **degraded** — hard contracts pass, but at least one request needed recovery or exceeded an observational latency budget;
- **unhealthy** — any required surface is unavailable after retries, returns an invalid contract, ships the wrong production roster, loses PWA/service-worker integrity, rejects the production CORS origin, or reports the wrong backend/protocol/policy hash.

Only `unhealthy` is a default hard failure. This keeps the sentinel sensitive to real regressions without turning internet jitter into release churn.

## Incident response rule

When a P27 run is unhealthy, use the failing probe to narrow the first response:

- `site-root`, `asset-manifest`, `service-worker`, `webmanifest`: inspect the Pages deployment and exact deployed SHA/artifact chain;
- `api-cors`: inspect production-origin allowlisting before touching client code;
- `api-health`: inspect Supabase Function availability, protocol version and policy hash before changing scoring/client contracts;
- `api-overall`, `api-weekly`: inspect database/read-path health and backend logs before attempting data repair.

Do not rotate credentials, reset production data, change scoring policy, or redeploy blindly as a first response. P27 is diagnostic evidence, not permission for autonomous mutation.

## Exit criteria

P27 implementation is complete when:

1. `quality:operations-p27` passes in CI;
2. `quality:production-p27` is part of the deployed Pages certification chain;
3. the six-hour scheduled burn-in workflow is active with read-only permissions and 30-day report retention;
4. production reports contain contract, availability, recovery and latency evidence without collecting player data;
5. all P26 release/build/browser guarantees remain unchanged.

The time-based burn-in qualification is separate from implementation completion: the first 72-hour window must accumulate 12 clean scheduled checkpoints before it can be described as a completed 72-hour burn-in.
