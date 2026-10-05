# P37 — Remediation Execution, Clean-Baseline Qualification & First Evidence-Epoch Activation

Date: 2026-10-05.

## Purpose

P37 turns the two remaining human-controlled P35 blockers into a deterministic activation procedure.

P37 does **not** weaken or bypass either blocker. It waits until:

1. GitHub applies an inspectable active ruleset to `main`;
2. the real offline recovery key has completed and submitted the P33 ceremony;
3. P33, P34 and current-head CI are clean;
4. the P36 control plane has no missing files.

Only then may P37 launch the **first** P35 operating-effectiveness epoch and immediately verify it with P36.

After the first epoch has ever been created, P37 permanently hands ongoing epoch management back to P35/P36 and does not act as an automatic epoch-restart loop.

## Manual remediation 1 — protect `main`

The preferred and machine-verifiable route is a GitHub **branch ruleset** rather than classic branch protection.

In the repository UI, open **Settings → Rules → Rulesets** and create an active branch ruleset targeting the default branch / `main`.

Configure all of the following:

- no bypass actors;
- restrict branch deletion;
- block non-fast-forward updates / force pushes;
- require a pull request before merging;
- require review-thread resolution;
- require status checks;
- require the `build` status check;
- require branches/status checks to be up to date before merge.

Approval count may remain zero for a single-owner repository; the control objective is that changes enter `main` through the PR/CI path, not that another human must approve every change.

P37 machine-verifies that GitHub reports `main.protected = true`, that at least one active repository ruleset exists, and that the **effective rules applied to `main`** contain the PR, deletion, non-fast-forward, review-thread-resolution, strict status-check and `build` requirements. GitHub intentionally withholds `bypass_actors` from tokens that do not have ruleset write access, so the normal Actions token cannot prove the bypass list. **No bypass actors remains an explicit operator requirement and P37 does not claim to have observed that field.**

Once those conditions are verified, P37 closes issue #20 automatically.

## Manual remediation 2 — real P33 offline-key ceremony

The recovery private key must remain outside GitHub.

On the trusted operator machine:

```bash
scripts/p33-prepare-ceremony.sh p33-ceremony-kit
```

Then run the command documented in `p33-ceremony-kit/README.md`, supplying:

- the real offline recovery private key;
- a disposable localhost recovery PostgreSQL database;
- the encrypted P31 artifact already downloaded into the kit.

Example shape:

```bash
scripts/p33-offline-ceremony.sh \
  p33-ceremony-kit/source/<backup>.cms \
  p33-ceremony-kit/source/manifest.json \
  /secure/offline/shared-recovery-private-key.pem \
  'postgres://postgres:...@127.0.0.1:55433/arcade_p33_recovery' \
  p33-ceremony-kit/evidence
```

Then execute:

```bash
bash p33-ceremony-kit/evidence/submit-command.txt
```

That command submits only the non-sensitive signed attestation and signature. It does not upload the recovery private key or decrypted backup.

## Scheduler-evidence calibration

GitHub scheduled workflows are best-effort and recent successful P27 intervals have approached nine hours despite a nominal six-hour cadence. Before the first P35 epoch, P37 standardizes P29/P34/P35 monitoring-evidence freshness and gap ceilings at **12 hours**.

This is an evidence-scheduler tolerance only. The P27 live production checks, P28 99% rolling SLO, P35 minimum run counts, and recovery controls are unchanged. A monitoring interruption beyond 12 hours remains deficient.

## Automated reconciliation chain

After the operator completes the two manual remediations, P37 automatically performs the remaining sequence.

### 1. P33 reconciliation

If a successful recent `P33 Offline Ceremony Attestation` exists but P33 long-term assurance has not yet recovered, P37 dispatches `P33 Long-Term DR Assurance` and waits for it to succeed.

The P33 workflow remains authoritative. P37 does not close the P33 assurance issue itself.

### 2. P34 reconciliation

When P33 is READY and the ruleset is qualified, P37 dispatches `P34 Continuous Security Assurance` and waits for it to complete.

P34 must close its own deficiency issue before P37 can proceed.

### 3. Clean-baseline qualification

P37 then requires all of these simultaneously:

- active qualifying `main` ruleset and effective main rules;
- `main.protected = true`;
- recent successful P33 signed-attestation workflow;
- durable P33 signed-evidence ledger;
- recent successful P33 long-term assurance and no open P33 assurance issue;
- recent successful P34 assurance and no open P34 deficiency issue;
- successful CI for the exact current `main` SHA;
- complete P36 control-plane manifest;
- no P35 epoch has ever been created.

Only this state is `ACTIVATION_READY`.

### 4. First P35 epoch activation

P37 dispatches the canonical `P35 Operating Effectiveness` workflow and waits for success.

P37 does not create or edit the epoch itself. The existing P35 engine must create the ledger and freeze:

- epoch ID/start time;
- current `main` SHA;
- qualifying CI run;
- P36 control-plane fingerprint;
- P36 per-file manifest.

### 5. Immediate P36 verification

After P35 completes, P37 dispatches `P36 Observation Integrity` and waits for success.

The final P37 qualification must see a P35 current/history epoch. If activation was attempted but no epoch exists, P37 fails instead of claiming success.

## P37 states

- `WAITING_MAIN_PROTECTION`
- `WAITING_OFFLINE_CEREMONY`
- `WAITING_P33_RECONCILIATION`
- `WAITING_P34_RECONCILIATION`
- `WAITING_CURRENT_HEAD_CI`
- `CONTROL_PLANE_DEFICIENT`
- `ACTIVATION_READY`
- `FIRST_EPOCH_ACTIVATED`

A single GitHub issue mirrors the current state and exact failed checks.

## Triggering

P37 runs:

- every six hours;
- after the current main CI completes, so exact-head qualification is refreshed immediately;
- after the P33 offline-attestation workflow completes;
- on relevant P37/control-plane changes;
- manually through `workflow_dispatch`.

After configuring the ruleset and completing the offline ceremony, manually running **P37 Remediation Qualification & Activation** gives the fastest activation path; the scheduled run provides a fallback.

## Assurance boundary

P37 **does not constitute external certification**. It verifies and sequences internal remediation evidence. It cannot create the real offline-key evidence, and it cannot change GitHub repository administration settings with the current integration.
