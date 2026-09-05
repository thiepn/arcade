# P22 — Mid-A Promotion Certification

Production baseline: `62d27842d1cc6f05a23169cad5d693328ac802a8` (P21 production-certified main).

## Purpose

P22 promotes the eight remaining A-rank Micro Arcade games by composing mechanics that already existed into clearer per-run structures. It does **not** add a replay recorder/player, run history, XP/currency, permanent progression, daily/weekly challenge system, new achievements, or P23 work.

The unchanged P15 rubric remains Core / Agency / Progression / Replay / Feel / Fairness-UX, each 1–10, with S beginning at 55/60. `docs/P15_ROSTER_AUDIT.md` remains immutable historical evidence.

## Immutable P15 baseline

| Game | Core | Agency | Progression | Replay | Feel | Fairness/UX | Total | Grade |
|---|---:|---:|---:|---:|---:|---:|---:|:---:|
| Cyber Serpent | 8 | 9 | 9 | 9 | 7 | 8 | 50 | A |
| Orbit | 8 | 9 | 9 | 8 | 8 | 8 | 50 | A |
| Neon Rail Shift | 8 | 9 | 9 | 8 | 8 | 8 | 50 | A |
| Orbital Slingshot | 8 | 8 | 9 | 9 | 8 | 8 | 50 | A |
| Orb Cannon | 8 | 9 | 8 | 8 | 8 | 8 | 49 | A |
| Memory Matrix | 8 | 9 | 9 | 8 | 7 | 8 | 49 | A |
| Knife Target | 8 | 8 | 9 | 8 | 8 | 8 | 49 | A |
| Cyber Crosser | 8 | 8 | 9 | 8 | 8 | 8 | 49 | A |

Historical P15 distribution remains **5 S / 20 A / 7 B**.

## Pre-P22 re-audit

P17 and P18 shipped game-specific feedback and clarity/fairness improvements after P15. P22 records those as current evidence rather than rewriting history:

| Game | Pre-P22 score | Existing evidence carried forward |
|---|---:|---|
| Cyber Serpent | 52 | P17 feel hierarchy + P18 firewall/Ghost Phase clarity and control parity |
| Orbit | 52 | P17 route/formation feel + P18 safe-lane/failure clarity |
| Neon Rail Shift | 52 | P17 phrase/Surge feedback + P18 high-speed teaching/readability |
| Orbital Slingshot | 52 | P17 launch/capture feedback + P18 transfer/failure teaching |
| Orb Cannon | 51 | P17 match/cascade/Burst feedback + P18 chamber/ceiling clarity |
| Memory Matrix | 51 | P17 protocol/clear feedback + P18 transformed-recall teaching |
| Knife Target | 51 | P17 Razor/stage feedback + P18 aiming/failure clarity |
| Cyber Crosser | 51 | P17 hop/checkpoint feedback + P18 district/hazard clarity |

Shared shell polish is not counted as Core, Agency, Progression, or Replay evidence.

## Implemented P22 structures

### Cyber Serpent — Phase Thread Chapters

Five run-local chapters (`GHOST IGNITION`, `FIREWALL WEAVE`, `PHASE LADDER`, `DEEP THREAD`, `NOVA THREAD`) turn existing unique-cell Phase Thread play into an authored escalation. Chapter completion returns score through the existing Phase Thread reward path. The certified 3-cell extension cadence, +6-tick extension, and 90-tick Ghost Phase cap remain unchanged.

### Orbit — Constellations

Six Constellations connect the existing crystal routes (`TRIAD`, `SWITCHBACK`, `SLINGSHOT`, `CROSSWIND`) to the existing safe-lane threat formations (`SWEEP`, `PINCH`, `INNER BREAK`, `CROSSWIND`). No new hazard/lane exists. Warning 1.2 s, cooldown 7.2 s, resolve 1.7 s, and grace 2.0 s remain unchanged.

### Neon Rail Shift — Rail Sequences

Six authored sequences concatenate three existing legal phrase units into 18-row tactical sentences. The four phrase identities remain unchanged. Completion is score-only and is cashed through the next existing Route Mastery milestone. Surge remains capped at two charges, five seconds, 1.18x speed, and 2x score.

### Orbital Slingshot — Mission Arcs

The original four navigation missions and targets remain unchanged. P22 groups adjacent sectors into two-sector Mission Arcs and awards a score-only payoff only when both missions clear in order. Launch/gravity physics and ordinary sector warps are untouched.

### Orb Cannon — Salvo Plans

Six short tactical Salvo Plans use genuine current/next chamber, one-swap, combo/drop, and earned Burst events. Plans never grant colors, extra Burst charges, slower ceiling pressure, immunity, or guaranteed matches. The existing Burst 2-charge cap, one starting charge, combo-4/drop-4 earning cadence, one swap, and no-flight guards remain authoritative.

### Memory Matrix — Protocol Suites

Rounds 1–8 retain the exact historical FORWARD/FORWARD, REVERSE/REVERSE, MIRROR/MIRROR, REVERSE_MIRROR/REVERSE_MIRROR foundation. From round 9, six four-round suites compose only those four transforms. The current/next protocol contextualizes the existing Overclock decision. Overclock remains +2 nodes, 0.78 playback scale, 1.5x step score, 1.8x clear score, with the 140 ms playback floor and manual pattern replay disabled only while Overclock is active.

### Knife Target — Razor Routes

The existing safe Razor target is divided into two directional notches inside the same certified tolerance, committing each six-stage cycle to `PRECISION TRACE` or `TEMPO TRACE`. Routes use existing safe target geometry and culminate at stage 6. No shield/blade clearance, life, collision, speed, knife-count, or pre-blade rule changes.

### Cyber Crosser — District Routes

Each existing district has two optional three-waypoint route profiles driven by normal accepted movement. The initial district route origin is normalized to row 0; later district starts remain 12/20/28… under the existing eight-row district structure. Route completion adds score only at the normal checkpoint. Traffic, train, river, immunity, hop and spawn behavior do not change.

## P18 clarity integration

`src/lib/p22ClarityProfileExtensions.ts` extends the eight existing P18 profiles with P22 mastery name, mastery explanation, payoff, boundary/danger and next-try advice. The base P18 objective, essential controls, secondary controls, `sourceControls`, priority tier, high-speed designation and visual-redundancy contracts are inherited unchanged.

The canonical vocabulary is:

- Cyber Serpent — **Phase Thread Chapter**
- Orbit — **Constellation**
- Neon Rail Shift — **Rail Sequence**
- Orbital Slingshot — **Mission Arc**
- Orb Cannon — **Salvo Plan**
- Memory Matrix — **Protocol Suite**
- Knife Target — **Razor Route**
- Cyber Crosser — **District Route**

Advanced P22 teaching is appended inside the existing P18 pause Mastery surface; P22 does not create a new modal framework.

## Final scorecards

| Game | Core | Agency | Progression | Replay | Feel | Fairness/UX | Total | Decision |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Cyber Serpent | 9 | 9 | 10 | 10 | 8 | 9 | **55** | PROMOTE TO S |
| Orbit | 9 | 9 | 10 | 9 | 9 | 9 | **55** | PROMOTE TO S |
| Neon Rail Shift | 9 | 9 | 10 | 9 | 9 | 9 | **55** | PROMOTE TO S |
| Orbital Slingshot | 9 | 8 | 10 | 10 | 9 | 9 | **55** | PROMOTE TO S |
| Orb Cannon | 9 | 10 | 9 | 9 | 9 | 9 | **55** | PROMOTE TO S |
| Memory Matrix | 9 | 10 | 10 | 9 | 8 | 9 | **55** | PROMOTE TO S |
| Knife Target | 9 | 9 | 10 | 9 | 9 | 9 | **55** | PROMOTE TO S |
| Cyber Crosser | 9 | 9 | 10 | 9 | 9 | 9 | **55** | PROMOTE TO S |

Every final category is at most +1 above immutable P15. Detailed evidence and adversarial reviews are source-controlled in `scripts/p22-promotion-scorecards.ts`.

Expected current roster after successful certification: **25 S / 0 A / 7 B**. The historical P15 distribution remains unchanged.

## Promotion evidence summary

| Game | P22-raised categories | P22 evidence | Decision |
|---|---|---|---|
| Cyber Serpent | Core, Progression, Replay | Chapter identity + firewall-gated authored escalation + rotating unique-cell objectives | PROMOTE TO S |
| Orbit | Core, Progression, Replay | Route/formation integration + six authored pairings + route-bound legal variation | PROMOTE TO S |
| Neon Rail Shift | Core, Progression, Replay | Three-phrase composition + six sequence identities + lane-relative variation | PROMOTE TO S |
| Orbital Slingshot | Core, Progression, Replay | Existing missions connected into two-sector ordered arcs | PROMOTE TO S |
| Orb Cannon | Core, Agency, Progression, Replay | Chamber/swap/Burst choices become six rotating genuine-event tactical plans | PROMOTE TO S |
| Memory Matrix | Core, Agency, Progression, Replay | Four transforms become suites; next protocol makes existing Overclock timing contextual | PROMOTE TO S |
| Knife Target | Core, Agency, Progression, Replay | Existing safe Razor geometry selects one of two multi-stage route traces | PROMOTE TO S |
| Cyber Crosser | Core, Agency, Progression, Replay | Lateral movement becomes optional authored waypoint planning inside existing districts | PROMOTE TO S |

## Adversarial review

The promotion ledger deliberately holds several categories below 10: Serpent Agency/Feel, Orbit/Rail Agency, Slingshot Agency, Orb Cannon Progression/Replay, Matrix Feel, Knife Agency, and Crosser Agency. P22 does not use new UI alone as score evidence and does not treat shared P17/P18/P19 product polish as gameplay depth.

The most important failure mode would be a P22 objective that changes survival legality. Static and browser certification therefore preserve old timing/resource/geometry gates and require P22 structures to be optional score-only layers. Any prior gate failure invalidates P22 rather than being relaxed.

## Automated certification

Permanent commands:

```text
bun run quality:gameplay-p22
bun run quality:browser-p22
```

The browser matrix covers:

- desktop 1280×800, full motion;
- mobile 390×844, reduced motion/touch;
- small mobile 320×568, reduced motion/touch.

Eight games × three profiles = **24 candidate/profile sessions**.

P22 is appended after, not substituted for, the existing browser chain:

```text
P3 → P17 → P18 → P19 → P20 → P21 → P22
```

`release32` permanently requires P22.

## Manual / subjective acceptance boundary

Automation can verify identity, controls, real input paths, run-state reset, score-only contracts, responsive containment, reduced motion, pause teaching, cleanup, timings, caps and absence of runtime errors. It cannot objectively prove that a game is fun, beautiful, or physically satisfying on every device.

The intended manual acceptance checklist for each candidate is:

1. normal desktop play;
2. touch/mobile play;
3. first-run comprehension;
4. later progression;
5. base play while ignoring P22 mastery;
6. deliberate P22 mastery attempt;
7. restart during mastery;
8. pause/resume during mastery;
9. Back to Arcade during mastery;
10. editorial comparison against the existing S cohort.

Machine certification must not be represented as a physical-device human playtest. Any human/device reservation discovered later should remain documented rather than hidden behind the numeric score.

## Regression boundary

P22 preserves P0–P21, including:

- immutable P15 history;
- P16 difficulty/reaction envelopes;
- Reaction overtime correction;
- Laser Rope warning/fairness floor;
- P17 bounded shared feel runtime;
- P18 objective/control/accessibility model;
- P19 canonical shell/pause/result/recovery behavior;
- P20/P21 promotion scorecards;
- fixed Rhythm timing constants;
- 32 source modules / 32 lazy registry games / 32 Worker rules;
- no replay/run-history/XP/currency/daily-challenge platform.

## Exit decision

P22 may be marked **PRODUCTION CERTIFIED** only after the exact PR head passes the full source/browser/build matrix, the resulting exact `main` merge SHA independently passes the same CI matrix, GitHub Pages deploys from that same SHA, and the live 32-game smoke passes.
