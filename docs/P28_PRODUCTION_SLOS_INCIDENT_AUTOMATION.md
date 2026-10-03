# P28 — Production SLOs, Alerting, Incident Automation & Long-Term Maintenance Reliability

P28 extends P27's synthetic production sentinel into a durable operations control layer. It does not change gameplay, scoring, AP anchors, compatibility ids, leaderboard data, deployment behavior, or production application state.

## Reliability boundary

All P28 evidence is synthetic and GitHub-native. There is **no player telemetry**, browser analytics, cookies, fingerprinting, session replay, gameplay-event upload, or client-side monitoring SDK.

P28 observes two things: a fresh P27 production contract probe and the retained GitHub Actions history of scheduled P27 checkpoints. GitHub-hosted runner measurements are an operational proxy, not a claim about individual player availability or latency.

## 30-day synthetic checkpoint SLO

The rolling production-control window is **30-day** with a target of **99%** successful scheduled P27 checkpoints. Only P27 runs triggered by the six-hour schedule enter the rolling SLO denominator; manual runs do not inflate it.

The SLO remains in a **warming** state until at least **12 checkpoints** exist. This matches the P27 72-hour qualification boundary and prevents a tiny sample from being presented as mature reliability evidence.

For an observed window with `N` scheduled checkpoints, the checkpoint error budget is `floor(N × (1 - 0.99))`. P28 reports successful checkpoints, failed checkpoints, success percentage, allowed failures and remaining error budget.

This is deliberately named a **synthetic checkpoint SLO**. A GitHub Actions failure can include control-plane or runner failure, so the metric is conservative and must not be presented as measured end-user uptime.

## Fresh production signal

Each P28 control run executes one fresh `quality:production-p27` sample before evaluating history. The P27 probe remains the authority for live shell, build manifest, service worker, webmanifest, CORS, backend health, scoring-policy hash, overall leaderboard and weekly leaderboard contracts.

A fresh P27 `unhealthy` result is an immediate incident condition even while the rolling SLO is still warming. A P27 `degraded` result remains visible but does not by itself consume the hard availability budget because recovered requests and runner-latency excursions are observational.

## Deployment correlation

P28 reads the successful `pages.yml` workflow history and attaches the latest successful production workflow SHA, run URL and completion time to every reliability report and automated incident. This provides deployment-health correlation without modifying the deployment pipeline.

## Alerting and incident automation

`.github/workflows/p28-reliability-control.yml` runs after every completed **P27 Production Burn-In**, once daily as a backstop, and manually when needed.

The workflow has `contents: read`, `actions: read` and `issues: write`. It has no Pages, deployment, repository-content or production-data write permission.

When the fresh production probe is unhealthy, or when an established 30-day synthetic checkpoint SLO falls below 99%, P28 opens one GitHub issue carrying the stable marker `p28-production-slo-incident`. If that issue is already open, P28 updates it instead of creating duplicates.

The incident records the current probe result, failure class, rolling checkpoint counts, error budget and latest successful deployment SHA. This creates an actionable alert while avoiding comment spam every six hours.

## Recovery automation

P28 does not close an incident after one isolated green probe. Recovery requires:

1. the fresh P27 probe to be healthy;
2. no active rolling SLO breach; and
3. the latest **two successful** scheduled P27 checkpoints to satisfy the configured two-checkpoint recovery streak.

At that point P28 marks the incident **ready for P29 verification** but does not close it. P29 performs an independent three-sample production verification plus control-plane/deployment checks before adding the recovery note and closing the issue. Until P29 verifies recovery, the incident remains open.

## What P28 will not do

P28 **does not redeploy** the application, rotate credentials, modify Supabase, rewrite leaderboard data, change scoring policy, reset player state, create rollback commits, or automatically alter production configuration.

Incident automation is intentionally limited to evidence, classification, alerting and issue lifecycle. Remediation remains a deliberate engineering action informed by the failing P27 probe and the correlated deployment SHA.

## Long-term evidence

Each P28 run uploads both the fresh P27 input and the P28 reliability report for **90 days**. The report contains the rolling SLO state, error budget, recovery state, deployment correlation and incident action. P27 continues retaining its own detailed six-hour telemetry artifacts.

Latency remains diagnostic rather than a hard long-term SLO because GitHub runner region and network path are not representative of all users. This avoids false precision while retaining trend evidence.

## Permanent CI contract

`quality:operations-p28` and `quality:gameplay-p28` are source-level CI gates. They verify that the SLO controller, workflow permissions, P27 trigger, 30-day/99%/12-checkpoint policy, two-checkpoint recovery rule, 90-day evidence retention, deployment correlation, incident marker and no-player-telemetry boundary remain wired.

The static CI gate also verifies that the original P27 burn-in workflow stays read-only and does not gain issue-write permission; incident mutation is isolated in P28.

## Exit criteria

P28 implementation is complete when the source contract passes, the reliability-control workflow exists on `main`, its fresh P27 probe and rolling evaluator can run with GitHub-native permissions, and production deployment remains unchanged.

Long-term SLO attainment is time-based evidence, not something implementation can manufacture immediately. Until 12 scheduled P27 checkpoints have accumulated, the rolling SLO must be reported as warming rather than certified. Final automated incident closure is delegated to the independent P29 recovery verifier.
