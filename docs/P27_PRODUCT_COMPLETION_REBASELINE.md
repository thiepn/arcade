# P27 — Product Completion Rebaseline & Replayability Roadmap

Date: 2026-10-05.

## Why this phase exists

Arcade reached a strong product baseline at P26. P27–P37 then drifted into an operations/governance program that was disproportionate to the product: burn-in evidence, SLO issue automation, continuity drills, encrypted-backup certification, cold-recovery exercises, offline-key ceremonies, security-control crosswalks, audit evidence epochs and remediation orchestration.

That work has been removed from the active product baseline.

P27 resets the roadmap around one question:

> What directly makes Arcade more fun, more inviting, easier to return to, and more complete as a product?

Infrastructure is now allowed only when a concrete product/reliability problem requires it.

## Restored P26 product baseline

The restored product already has:

- 32 production games with the P24/P25/P26 balance and quality work intact;
- keyboard, touch, pointer and gamepad support;
- strong mobile/responsive behavior and accessibility;
- PWA installation and complete offline gameplay;
- local high scores, raw scores and Arcade Points;
- favorites and recently played;
- search and category filtering;
- random play;
- stats and per-game play history;
- a mature achievement catalog;
- XP derived from achievements and a 15-level progression ladder;
- anonymous player profiles;
- per-game global leaderboards;
- permanent and weekly overall leaderboards;
- themes, sound and haptics;
- polished pause/results/replay flows;
- normal CI, production deployment and P26 production smoke certification.

These are product features, not backlog items.

## What was removed

The active codebase no longer includes P27–P37:

- recurring production burn-in evidence;
- rolling SLO/incident issue automation;
- operational incident-control planes;
- automated continuity/rollback certification;
- encrypted off-site backup certification machinery;
- full-stack cold-recovery drills;
- offline-key ceremony workflows;
- NIST/SOC-style internal control mapping;
- 30-day operating-effectiveness evidence epochs;
- control-plane fingerprints/checkpoint chains;
- remediation/first-epoch orchestration.

The historical P31 database migration file remains in the migration directory because it was already applied and removing an applied migration from history can create schema-history divergence. It is not part of the product roadmap or a release gate.

## Actual gaps after P26

### 1. Return loop — highest priority

Arcade is excellent at launching a game, but weak at answering:

> Why should I come back tomorrow?

There is no authored daily challenge, daily streak or rotating objective layer.

The next product feature should use the existing games, AP system and local stats rather than add another backend. A deterministic UTC daily challenge can work completely offline and remain identical for every player for a given date.

### 2. Existing progression is buried

Arcade already has a mature achievement catalog, XP and 15 player levels, but most of that value lives inside the statistics modal.

The home screen should surface:

- current player level;
- progress to the next level;
- newly unlocked achievements;
- one or two near-complete achievement goals;
- a direct path into progression.

This is primarily information architecture and presentation, not a new progression system.

### 3. Discovery should become goal-aware

Favorites, recent play, categories, search and random play already exist.

What is missing is useful recommendation context:

- improve a personal best;
- continue a recently played game;
- try an unplayed cabinet;
- finish a nearly completed achievement;
- play today's challenge.

Recommendations should be deterministic and explain why each game is suggested. No AI or recommendation backend is necessary.

### 4. Replay feedback can become more rewarding

Results already support replay/back/random/leaderboard actions. The next quality pass should make successful sessions feed the wider arcade more visibly:

- PB improvement;
- achievement unlocked;
- level progress;
- daily challenge completion;
- rank movement when available.

This should be concise and celebratory without turning every run into modal spam.

### 5. Final visual/audio pass should happen after the loop exists

P17–P26 already did extensive visual, interaction and game-feel hardening. Another broad redesign now would mostly churn finished work.

A final visual pass should instead target the newly added home/progression/challenge surfaces plus any inconsistencies found during real-device use.

## Recovered roadmap

### P27 — Product Completion Rebaseline & Replayability Roadmap

This phase. Remove the operational detour, restore P26 as the release baseline, inventory the real product, and freeze the remaining roadmap.

### P28 — Daily Challenge, Streak & Return Loop

Add a deterministic offline-first daily cabinet challenge, lightweight streak tracking, completion state, clear rewards/progress feedback and a prominent but non-intrusive home entry point.

No new server, cron job or account dependency.

### P29 — Progression Surfacing & Goal-Aware Home

Bring the existing level/XP/achievement system onto the home experience. Add near-goal suggestions and explainable "Play next" recommendations using existing local data. **Implemented in P29.**

### P30 — Results-to-Meta Integration & Replay Motivation

Connect each result to PB, achievement, level, challenge and leaderboard movement. Improve next-action recommendations and celebration hierarchy without changing core game scoring.

### P31 — Final Product UX, Motion, Audio & Real-Device Pass

Audit the complete arcade on phone/tablet/desktop. Polish only visible inconsistencies, motion, sound/haptic feedback, loading/error states and performance issues that remain after P28–P30.

### P32 — Final Release Closure & Maintenance Mode

Run the existing product CI/P26 production certification, fix real defects, update release documentation and stop phase-driven development. After P32, new work should require a concrete feature request or observed defect rather than another automatically invented phase.

## Explicit non-goals

Unless a real requirement appears, Arcade does not need:

- SOC 2/NIST/ISO readiness work;
- audit evidence periods;
- recovery-key ceremonies;
- bespoke DR certification;
- additional scheduled reliability workflows;
- enterprise change-control machinery;
- AI recommendations;
- a new backend for daily challenges;
- another wholesale game-scoring rebalance;
- a new 30+ phase roadmap.

## P27 exit criteria

P27 is complete when:

- P27–P37 operational machinery is removed from active CI/deployment/product code;
- P26 and earlier product/release gates still pass;
- ordinary production deployment remains intact;
- the applied P31 migration record is retained only for schema-history safety;
- stale operational readiness issues are retired;
- the remaining roadmap is limited to P28–P32 above.
