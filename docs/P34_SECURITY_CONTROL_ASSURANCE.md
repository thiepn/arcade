# P34 — Security Control Mapping, Continuous Assurance & External Audit Readiness

Date: 2026-10-04.

## Purpose

P27–P33 already produce substantial production, incident, rollback, backup and recovery evidence. P34 turns those separate safeguards into one inspectable assurance layer so the repository can answer four questions consistently:

1. Which security/availability controls exist?
2. What repository or operational evidence supports each control?
3. Is the evidence current, missing or contradicted by an open readiness incident?
4. What can be handed to a future independent reviewer without overstating what Arcade has proven?

P34 is deliberately governance/evidence work. It changes no gameplay, scoring, leaderboard policy, backup contents, production traffic routing or recovery mechanics.

## Control catalog

`ops/p34-security-controls.json` defines **18 internal controls** across:

- protected-main/change governance, CI/CD least privilege and immutable action provenance;
- reproducible dependency installation and regression gates;
- release/prod verification;
- synthetic monitoring, SLOs and incident response;
- rollback/continuity;
- encrypted backups and full-stack recovery;
- offline recovery-key assurance and key separation;
- recovery data minimization;
- server-side authorization/scoring trust boundaries;
- security/runbook documentation;
- continuous evidence review and deficiency tracking.

Each control has an objective, operating mode, repository evidence, optional live workflow-freshness requirements, mapped blocking issue markers, and readiness crosswalks to selected NIST CSF 2.0 categories and SOC 2 Trust Services Criteria references.

## Important assurance boundary

This work **does not constitute external certification**.

The NIST CSF and SOC 2 references are readiness crosswalks only. P34 does not claim:

- NIST certification;
- SOC 2 Type I or Type II completion;
- ISO 27001 certification;
- a penetration test;
- legal/regulatory compliance;
- an independent audit opinion.

An external assessor would still need to determine scope, sampling, operating periods, evidence sufficiency, management assertions and any compensating controls.

## Static certification

`scripts/audit-operations-p34.mjs` runs in normal CI and permanently enforces:

- exactly 18 contiguous control IDs;
- non-empty NIST and SOC 2 readiness mappings;
- existence of every mapped repository evidence file;
- existence of every mapped workflow;
- explicit P34 non-certification language;
- minimal P34 workflow permissions;
- immutable action SHAs;
- 90-day evidence retention;
- P34 package/CI wiring;
- absence of backend service-role or recovery-private-key ingestion by P34.

CI also runs P34 assurance in static mode. Static mode proves the control design and repository evidence exist; it does not pretend to prove current production operation.

## Continuous live assurance

`P34 Continuous Security Assurance` runs daily at 06:29 UTC, on P34 control changes, and manually.

The live assessment does not make SC-18 depend on a previously successful P34 run; doing so would create a false deficiency during first-run/bootstrap execution. The current run itself produces the SC-18 evidence pack.

The live assessment:

- verifies every repository evidence path;
- reads GitHub's live `main.protected` state for SC-01;
- fetches the newest successful run for mapped P27–P34 workflows;
- applies explicit freshness ceilings;
- reads open GitHub issues for mapped P28/P30/P31/P32/P33/P34 deficiency markers;
- marks each control OPERATING or DEFICIENT;
- emits a machine-readable snapshot and deficiency register;
- emits a human-readable evidence pack;
- maintains one deduplicated `P34 Security Assurance Deficiency` issue.

The P34 issue is an internal control-readiness signal. It is not automatically a production outage and it is not an external non-compliance finding.

## Evidence pack

Every live run uploads for 90 days:

- `snapshot.json` — control-by-control status, mappings and evidence;
- `deficiencies.json` — only currently detected deficiencies;
- `evidence-pack.md` — review-oriented summary with the assurance boundary;
- `issue-action.json` — what happened to the deduplicated P34 deficiency issue.

The pack contains repository paths, workflow metadata and issue metadata. It does not copy player records, backup plaintext, credentials, recovery private keys or Supabase service-role secrets.

## Deficiency interpretation

A control becomes DEFICIENT when one or more of these are true:

- mapped repository evidence is missing;
- required successful workflow evidence is absent or older than its maximum age;
- a mapped readiness/incident issue remains open.

Existing repository-governance deficiencies are also mapped. In particular, issue #20 remains a blocking SC-01 deficiency until GitHub reports `main` protected by branch protection or an equivalent ruleset.\n\nThe source control remains owned by its underlying phase. P34 does not “repair” P27–P33. It records the deficiency and points back to the source control so remediation stays within the existing operational boundary.

## External-audit readiness

For a future reviewer, P34 provides:

- a stable control inventory;
- objectives and implementation evidence;
- framework crosswalks;
- recurring operating evidence;
- explicit deficiency history;
- retained evidence packs;
- clear separation between internal evidence and an independent attestation.

This reduces evidence-gathering work later without paying the complexity cost of pretending a personal browser arcade needs enterprise compliance machinery today.

## Exit criteria

P34 implementation is complete when:

- the 18-control catalog is merged;
- the static audit passes in CI;
- the live assurance workflow is merged;
- a live evidence pack can be generated;
- deficiencies are tracked in one deduplicated issue;
- P34 is included in the final 32-game release/regression contract;
- all documentation continues to state that P34 is readiness evidence, not external certification.
