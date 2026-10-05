# P35 — Control Remediation, Operating-Effectiveness Evidence Period & Audit Dry-Run Certification

Date: 2026-10-05.

## Purpose

P34 established that Arcade has an inspectable control catalog and recurring assurance. P35 addresses the next question: **do those controls remain effective over a defensible observation period, and can the resulting evidence survive a structured internal audit dry-run?**

P35 adds three layers:

1. verified remediation tracking for P34 deficiencies;
2. a consecutive 30-day operating-effectiveness epoch with daily clean checkpoints and control-specific evidence populations;
3. an internal audit dry-run package with deterministic samples, exceptions, a request list, and an explicit pass/not-issued result.

It changes no gameplay, scoring, leaderboard policy, production traffic, backup contents, player data or recovery mechanics.

## Current starting state

P35 begins in **REMEDIATION_REQUIRED**.

The two current blockers are:

- SC-01: GitHub reports `main.protected = false`; issue #20 remains the remediation tracker.
- SC-13: P33 is still waiting for the first real offline recovery-key ceremony; issue #104 remains open.

The observation clock does **not** start while either condition remains unresolved.

## Remediation boundary

P35 verifies remediation; it does not fabricate it.

For SC-01, the repository owner must enable branch protection or an equivalent ruleset. The current connector can verify the resulting `main.protected` state but cannot enable repository administration policy. Once GitHub reports the branch protected, P35 may close the old tracking issue because the underlying condition is directly verified.

For SC-13, the offline-key operator must perform the real P33 ceremony. The recovery private key remains outside GitHub and P35. P35 accepts remediation only after P33 itself has a recent successful assurance run and its P33 assurance issue is closed.

Any other open P34 deficiency also blocks the observation epoch.

## Observation epoch

A P35 epoch starts only when all of these are simultaneously true:

- `main.protected = true`;
- P33 long-term assurance has succeeded within 30 hours;
- the P33 assurance issue is closed;
- P34 has a successful assurance run within 30 hours;
- the P34 deficiency issue is closed.

The epoch lasts **30 consecutive days**.

P35 creates a durable GitHub issue ledger containing the current epoch identifier and start timestamp. Each clean daily P35 run writes at most one checkpoint comment for that UTC date.

If a blocking P34 condition appears during the epoch, P35 invalidates the epoch. The previous epoch remains documented, but a new 30-day period starts only after remediation is verified again. P35 never backdates a replacement epoch.

## Evidence populations

P35 evaluates the population of real GitHub Actions runs inside the epoch.

- CI and production deployment are change-driven populations. An empty period is acceptable because P35 does not require artificial production changes solely to manufacture samples. If change runs occur, terminal failures are exceptions.
- P27, P28 and P29 require at least 108 successful runs over 30 days and no gap above 10 hours.
- P30 requires at least 4 successful continuity drills and no gap above 216 hours.
- P31 requires at least 27 successful encrypted backups and no gap above 50 hours.
- P32 requires at least 4 successful cold-recovery exercises and no gap above 216 hours.
- P33 requires at least 27 successful long-term assurance runs and no gap above 50 hours.
- P34 requires at least 27 successful control-assurance runs and no gap above 50 hours.
- P35 requires at least 28 clean daily checkpoints with no gap above 50 hours.

Terminal workflow conclusions such as failure, timed-out, action-required or startup-failure are recorded as exceptions and block the internal dry-run pass for the epoch.

## Sampling

P35 never selects only favorable runs. For each successful workflow population it deterministically selects the first, middle and last successful occurrence in the period. The complete population counts and exceptions remain in machine-readable evidence.

This is an internal sampling convention for review efficiency, not an external auditor's sampling methodology.

## Audit dry-run package

Each P35 run produces a non-sensitive package containing:

- `operating-effectiveness.json` — current state, epoch and population assessments;
- `remediation.json` — remediation status and direct verification evidence;
- `sample-register.json` — deterministic workflow samples;
- `exceptions.json` — current workflow/control exceptions;
- `audit-dry-run.md` — reviewer-oriented narrative;
- `request-list.md` — a simulated evidence-request checklist;
- `internal-dry-run-certification.json` — either `NOT_ISSUED` or `INTERNAL_DRY_RUN_PASS`.

Artifacts are retained for 90 days.

## State model

P35 reports one of five states:

- `REMEDIATION_REQUIRED` — one or more baseline blockers remain;
- `OBSERVATION_STARTING` — baseline is clean and a new epoch is being established;
- `OBSERVATION_WARMING` — the valid epoch is less than 30 days old;
- `OBSERVATION_INSUFFICIENT` — 30 days elapsed but sampling/frequency/exception criteria are not satisfied;
- `INTERNAL_DRY_RUN_PASS` — the full 30-day period and all internal dry-run criteria pass.

Static CI reports `DESIGN_READY`; it cannot substitute for live operating evidence.

## Assurance boundary

P35 **does not constitute external certification**. An `INTERNAL_DRY_RUN_PASS` is not a SOC 2 report, NIST certification, ISO 27001 certification, regulatory attestation, penetration test, or independent audit opinion.

An external reviewer remains free to choose a different scope, period, sample, materiality threshold and evidence standard.

## Exit criteria

P35 implementation is complete when:

- remediation policy and operating-effectiveness policy are committed;
- deterministic state/population tests pass;
- CI permanently enforces P35;
- the daily live P35 workflow is active;
- the remediation/readiness issue is accurate;
- observation epochs cannot start while P34 is deficient;
- a control breach invalidates an active epoch;
- the audit dry-run package is generated without sensitive data;
- final release certification includes P35.

P35 **operating-effectiveness certification is intentionally not complete today**. It can become `INTERNAL_DRY_RUN_PASS` only after the blockers are remediated and a clean 30-day epoch actually elapses.
