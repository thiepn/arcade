# P24 — Definitive 32/32 S-Rank Certification

Baseline: `994bcab64950c452bd887ed42fcef5486fe0665b` (original P24 certification baseline).

Current hardening baseline: `72adc8101ff0db19c2927ed56e2896adcb434139` (2026-10-01 hardened P23).

## Purpose

P24 remains the final **certification-only** scoring phase of the P15→P24 quality program: it awards no new rating points and adds no mechanics, modes, content, progression, replay infrastructure, retention systems, scoring changes, Worker/API/D1 behavior, dependencies, or presentation runtime. During the current-source re-audit, however, certification blockers were found in input ownership and control semantics for several of the five games that were already S in P15. Those defects are corrected as pre-certification hardening; they do not alter the rubric or score ledger. P24's job remains to prove that the current 32-game roster is represented by one internally consistent ledger in which every game clears the unchanged P15 S threshold and every phase that earned those scores remains permanently enforced.

The definitive current target is **32 S / 0 A / 0 B**.

`docs/P15_ROSTER_AUDIT.md` remains immutable historical evidence. Its historical distribution remains **5 S / 20 A / 7 B**.

## Frozen rubric and epistemic boundary

P24 keeps the P15 rubric unchanged:

1. Core
2. Agency
3. Progression
4. Replay — replayability inside the game, not recorded playback
5. Feel
6. Fairness / UX

Each category remains 1–10 and S remains **55–60**.

P24 does not award a single new category point. The five games that were already S in P15 keep their P15 scorecards. Every other game copies the exact `final` scorecard from the promotion phase that earned its current S status: P20, P21, P22 or P23.

Automation cannot prove that a game is fun, beautiful, addictive, or subjectively S-rank. It can prove score-ledger integrity, provenance, roster parity, frozen thresholds, permanent regression gates, browser behavior, build integrity and deployment identity. S rank remains an editorial judgment backed by the accumulated objective evidence and manual review boundaries of P15–P23.

## Definitive current roster ledger

| Game | Source | Core | Agency | Progression | Replay | Feel | Fairness/UX | Total | Current grade |
|---|:---:|---:|---:|---:|---:|---:|---:|---:|:---:|
| Neon Pinball | P15 | 10 | 10 | 9 | 10 | 10 | 9 | **58** | **S** |
| Galaxy Vanguard | P15 | 10 | 9 | 10 | 9 | 10 | 9 | **57** | **S** |
| Astro Blaster 360 | P15 | 10 | 10 | 9 | 9 | 10 | 9 | **57** | **S** |
| Cyber Block Drop | P15 | 10 | 10 | 9 | 10 | 8 | 9 | **56** | **S** |
| Neon Rhythm Tapper | P15 | 9 | 9 | 9 | 10 | 9 | 9 | **55** | **S** |
| Gravity | P20 | 9 | 10 | 10 | 9 | 9 | 9 | **56** | **S** |
| Chain | P20 | 9 | 10 | 9 | 9 | 9 | 9 | **55** | **S** |
| Merge | P20 | 9 | 10 | 9 | 9 | 9 | 9 | **55** | **S** |
| Cyber Drift | P20 | 9 | 9 | 9 | 9 | 10 | 9 | **55** | **S** |
| Dodge | P20 | 9 | 9 | 9 | 9 | 10 | 9 | **55** | **S** |
| Laser Blade | P20 | 9 | 9 | 9 | 9 | 10 | 9 | **55** | **S** |
| Breakout Mini | P21 | 9 | 9 | 10 | 9 | 9 | 9 | **55** | **S** |
| Neon Puck Smash | P21 | 9 | 9 | 9 | 9 | 10 | 9 | **55** | **S** |
| Gravity Tower Jumper | P21 | 9 | 9 | 9 | 9 | 10 | 9 | **55** | **S** |
| Cyber Pac-Runner | P21 | 9 | 9 | 10 | 9 | 9 | 9 | **55** | **S** |
| One Line | P21 | 9 | 10 | 10 | 9 | 8 | 9 | **55** | **S** |
| Chrono Wave | P21 | 9 | 9 | 10 | 9 | 9 | 9 | **55** | **S** |
| Cyber Serpent | P22 | 9 | 9 | 10 | 10 | 8 | 9 | **55** | **S** |
| Orbit | P22 | 9 | 9 | 10 | 9 | 9 | 9 | **55** | **S** |
| Neon Rail Shift | P22 | 9 | 9 | 10 | 9 | 9 | 9 | **55** | **S** |
| Orbital Slingshot | P22 | 9 | 8 | 10 | 10 | 9 | 9 | **55** | **S** |
| Orb Cannon | P22 | 9 | 10 | 9 | 9 | 9 | 9 | **55** | **S** |
| Memory Matrix | P22 | 9 | 10 | 10 | 9 | 8 | 9 | **55** | **S** |
| Knife Target | P22 | 9 | 9 | 10 | 9 | 9 | 9 | **55** | **S** |
| Cyber Crosser | P22 | 9 | 9 | 10 | 9 | 9 | 9 | **55** | **S** |
| Type Rush | P23 | 9 | 9 | 10 | 9 | 9 | 9 | **55** | **S** |
| Perfect Stop | P23 | 9 | 9 | 10 | 9 | 9 | 9 | **55** | **S** |
| Reaction | P23 | 9 | 9 | 10 | 9 | 9 | 9 | **55** | **S** |
| Pulse | P23 | 9 | 9 | 10 | 9 | 9 | 9 | **55** | **S** |
| Laser Rope Reflex | P23 | 9 | 9 | 10 | 9 | 9 | 9 | **55** | **S** |
| Aero Pulse | P23 | 9 | 9 | 10 | 9 | 9 | 9 | **55** | **S** |
| Stack | P23 | 9 | 9 | 9 | 9 | 10 | 9 | **55** | **S** |

Current distribution: **32 S / 0 A / 0 B**.

Historical P15 distribution: **5 S / 20 A / 7 B**.

## Provenance partition

The 32 records partition exactly into:

- **5** immutable P15 S scorecards;
- **6** P20 Near-S promotions;
- **6** P21 Strong-A promotions;
- **8** P22 Mid-A promotions;
- **7** P23 B-rank transformations.

`p24-definitive-scorecards.ts` composes these existing authorities directly. It intentionally has no fallback score, no manual override map and no P24-only promotion value.

## Static certification

`quality:gameplay-p24` verifies:

- unchanged 55/60 S threshold in P20, P21, P22, P23 and P24;
- exactly 32 unique canonical game IDs;
- exact registry/ledger parity;
- the five original P15 S scorecards against immutable P15 rows;
- exact equality between all 27 promoted P24 records and their P20–P23 `final` scorecards;
- every category remains an integer 1–10;
- every current total is 55–60;
- current distribution is exactly 32 S;
- historical P15 distribution remains 5 S / 20 A / 7 B;
- permanent package/CI wiring for P24;
- continued presence of the hardened P20–P23 promotion certifications;
- explicit source contracts for the five original P15 S incumbents;
- current non-scoring 32-game deep-polish continuity;
- P24 documentation, incumbent sentinel and browser-gate boundaries.

A failure in any source promotion ledger invalidates P24 rather than being papered over locally.

## Browser certification

`quality:browser-p24` reruns the mature P19 whole-product browser contract for all 32 games and then runs a P24-native sentinel for the five original P15 S incumbents. The candidate-specific P20, P21, P22 and P23 browser gates remain separate permanent prerequisites, so every provenance group has current browser evidence.

The canonical P24 rerun covers:

- desktop 1280×800, normal motion;
- mobile 390×844, touch + reduced motion;
- small mobile 320×568, touch + reduced motion.

That is **96 game/profile sessions** across all 32 games, plus **15 P15-incumbent/profile sentinel sessions** across Neon Pinball, Galaxy Vanguard, Astro Blaster 360, Cyber Block Drop and Neon Rhythm Tapper. The combined P24 gate also retains whole-arcade home/library checks, settings persistence, navigation stress, canonical shell controls, pause/focus behavior, restart/exit cleanup, responsive containment and runtime/console cleanliness.

The permanent browser chain becomes:

```text
P3 → P17 → P18 → P19 → P20 → P21 → P22 → P23 → P24
```

## Regression contract

P24 is valid only while all prior contracts remain green. CI therefore continues to require:

- all specialist game audits;
- gameplay audits P0, P1, P2 and P4–P24;
- browser audits P3 and P17–P24;
- P16 difficulty/fairness envelopes;
- P17 game-feel hierarchy;
- P18 clarity/accessibility;
- P19 arcade cohesion;
- P20–P23 promotion-specific evidence;
- lifecycle/mobile/runtime audits;
- `quality:release32` and repository hardening;
- TypeScript;
- local D1 migration and Worker smoke/typecheck/dry-run;
- production build;
- root MA3/MA4;
- Pages build;
- `/arcade/` MA3/MA4.

`quality:release32` is extended through P24 so the definitive certification remains a permanent release requirement.

## 2026-10-01 definitive current-source hardening

The original P24 ledger remains frozen. The current-source audit found certification blockers in the only provenance group without a later promotion-specific hardening pass: the five games that were already S in P15.

- **Neon Pinball:** keyboard flippers now ignore paused/modifier/composition input, release on window blur, and expose left/right pressed state plus A/D/Arrow/Space shortcuts.
- **Galaxy Vanguard:** a held Nova key can no longer spend multiple bombs through key repeat; keyboard movement state is released on blur; Nova exposes remaining bombs and Space/E/B.
- **Astro Blaster 360:** keyboard control cannot mutate steering/thrust while paused or dead, Hyperspace rejects held-key repeat, held input clears on blur, touch steering/thrust clears on pointer cancellation, and the mobile controls expose their keyboard equivalents.
- **Cyber Block Drop:** keyboard/game-loop audio now follows the live Sound preference rather than a mount-time value; mobile controls expose their keyboard equivalents.
- **Neon Rhythm Tapper:** its already-correct blur cleanup is now surfaced through explicit lane pressed state and lane shortcut metadata.

The dedicated P24 incumbent browser sentinel proves Pinball blur recovery, Vanguard repeat-safe Nova use, Block Drop repeat-safe Hold, Rhythm lane blur recovery, canonical pause/resume focus and clean restart behavior across desktop, mobile and small-mobile profiles.

The current repository also contains the later 32-game deep-polish source layer. P24 treats that layer as non-scoring evidence only: its audit must continue to cover all 32 games and explicitly preserve leaderboard score comparability.

No scorecard receives another point from this hardening pass. The definitive ledger remains **32 S / 0 A / 0 B**.

## Deliberate non-changes

P24 hardening changes only incumbent input ownership, live-setting reads and control semantics. It introduces no new game runtime or scoring system. It adds no:

- replay recorder/player or ghost run;
- run-history platform;
- XP, currency, unlock or permanent upgrade;
- daily/weekly challenge or login reward;
- achievement expansion;
- new analytics/statistics platform;
- Worker/API/D1 feature;
- dependency;
- scoring rule, physics rule, timing constant or difficulty envelope.

The current implementation—hardened P20–P23 evidence, the five repaired P15 incumbents, and the non-scoring deep-polish layer—is what the refreshed P24 gates certify.

## Manual review boundary

P20–P23 already define candidate-specific manual acceptance questions. P24 does not pretend to replace those with arithmetic. Final editorial review should compare the roster as a whole for:

1. immediate game identity;
2. first-run comprehension;
3. control trust on desktop and touch;
4. high-pressure readability;
5. meaningful mastery without retention mechanics;
6. restart/pause/exit consistency;
7. whether each title credibly stands alone as a polished microgame.

Any new human/device defect discovered later remains a defect even if all automated P24 gates pass.

## Production closure

P24 is **PRODUCTION CERTIFIED** only when all of the following are true for one exact commit chain:

1. the exact PR head passes full CI including `quality:gameplay-p24` and `quality:browser-p24`;
2. the PR is merged without weakening any gate;
3. the exact resulting `main` merge SHA independently passes full CI;
4. GitHub Pages builds and deploys from that same SHA;
5. the live Pages certification smoke passes all 32 games on that same SHA.

Until those conditions are recorded, the ledger is a certification candidate rather than a production declaration.

## Exit decision

P24 closes the P15→P24 roster-quality program when the exact production commit satisfies every condition above. At that point the defensible current editorial state is **32 S / 0 A / 0 B**, with immutable historical P15 preserved as **5 S / 20 A / 7 B** and every intermediate promotion phase still permanently auditable.
