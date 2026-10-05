# P36 — Observation Epoch Integrity, Baseline Freeze & Change-Control Governance

Date: 2026-10-05.

## Purpose

P35 defines a 30-day operating-effectiveness period. P36 closes a critical auditability gap: a 30-day period is not meaningful if the controls being observed can materially change during the period without the epoch noticing.

P36 therefore binds every future P35 epoch to a cryptographic fingerprint of the operational control plane.

## Control-plane boundary

`ops/p36-observation-integrity-policy.json` explicitly lists the files that define or materially implement P27–P36 production assurance, including:

- CI and production deployment workflows;
- P27–P36 assurance/recovery workflows;
- P34 and P35 policies;
- incident, continuity, backup and recovery engines;
- the offline recovery certificate;
- P34/P35/P36 audit and state-machine code;
- server-side leaderboard/scoring authorization boundaries;
- the P31 backup-export function.

The list intentionally excludes ordinary game components, presentation CSS, copy and other product code that does not change the assurance control plane.

## Cryptographic baseline

`scripts/p36-control-plane-core.mjs` computes a deterministic SHA-256 manifest:

1. paths are sorted;
2. every file receives its own SHA-256 and byte length;
3. the full path/digest/size set receives one aggregate SHA-256 fingerprint.

When a P35 epoch starts, the P35 ledger stores:

- the control-plane fingerprint;
- the per-file manifest;
- the main commit at epoch start;
- the successful CI run that qualified the starting baseline.

## Change-control rule

Normal product changes may continue during an epoch.

A change to any control-plane file is different:

- P35 detects the fingerprint mismatch;
- the active epoch is archived as `INVALIDATED`;
- changed paths are recorded;
- P35 does not start a replacement epoch in the same run;
- the replacement baseline must first have a successful CI run on the current main head;
- only a later clean P35 execution may establish a new 30-day epoch.

This prevents a material control change from being hidden inside one continuous observation period.

## Epoch-start CI requirement

Even after SC-01/SC-13/P34 remediation is clean, P35 may start an epoch only when the newest successful CI run is for the current `main` head.

This rule applies only to **starting or replacing** an epoch. A routine product commit with CI still in progress does not invalidate an already-active epoch as long as the control-plane fingerprint is unchanged.

## Checkpoint binding

Every new P35 clean checkpoint records the epoch's control-plane fingerprint. P36 reads those checkpoints and builds a deterministic SHA-256 hash chain from:

- previous chain hash;
- epoch ID;
- checkpoint date/time;
- control-plane fingerprint;
- P33 assurance run ID;
- P34 assurance run ID.

The chain is evidence-integrity metadata, not a blockchain and not immutable external storage. Its purpose is to make omissions, reordering and baseline mismatches visible across retained P36 evidence artifacts.

## P36 live states

P36 reports:

- `DESIGN_READY` in static CI;
- `WAITING_FOR_EPOCH` while P35 has no active observation epoch;
- `OBSERVING_STABLE_BASELINE` when the active P35 epoch matches its frozen control plane;
- `EVIDENCE_INTEGRITY_DEFICIENT` when checkpoint metadata is missing or mismatched;
- `DRIFT_DETECTED` when the current control plane differs from the P35 epoch baseline;
- `EPOCH_CERTIFIED_STABLE` when the P35 epoch is internally certified and its baseline/checkpoint evidence remains consistent.

P36 does not independently certify P35. It verifies the integrity of the baseline and evidence period P35 claims to observe.

## Evidence package

Each live run retains for 90 days:

- `control-plane-manifest.json`;
- `observation-integrity.json`;
- `checkpoint-chain.json`;
- `change-control-report.md`.

A single deduplicated P36 readiness issue mirrors the current live state.

## Current state

At implementation time P35 has no active epoch because SC-01 branch protection and the real SC-13 offline-key ceremony remain unresolved. Therefore the expected initial P36 state is `WAITING_FOR_EPOCH`.

P36 does not bypass those blockers and does not start the 30-day clock.

## Assurance boundary

P36 **does not constitute external certification**. It is internal change-control and observation-integrity evidence only. It is not a SOC 2 report, NIST certification, ISO 27001 certification, legal compliance opinion, penetration test, or independent audit opinion.
