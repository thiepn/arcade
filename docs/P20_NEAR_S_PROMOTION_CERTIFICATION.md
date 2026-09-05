# P20 — Near-S Promotion Certification

Baseline: `a10722cc46b3fa45a7c5db29fdbba7f4dfd353c8` (production-certified P19)

## Purpose

P20 is the first explicit promotion phase. It keeps the P15 rubric and 55/60 S threshold unchanged, re-audits the six near-S games after P16–P19, changes gameplay only where a real blocker remains, and records every proposed score increase with game-specific evidence.

P20 does **not** rewrite `docs/P15_ROSTER_AUDIT.md`. P15 remains the historical post-P14 snapshot: **S 5 / A 20 / B 7**.

P20 also does not add gameplay replay/playback, run history, currencies, XP, daily/weekly challenges, unlock economies, or a new statistics platform.

## Frozen rubric

Each category remains 1–10:

1. Core
2. Agency
3. Progression
4. Replay (replayability, not playback)
5. Feel
6. Fairness / UX

S remains **55–60**.

## Historical scorecards

| Game | Core | Agency | Progression | Replay | Feel | Fairness/UX | Total | Grade |
|---|---:|---:|---:|---:|---:|---:|---:|:---:|
| Gravity | 9 | 10 | 10 | 9 | 8 | 8 | 54 | A |
| Chain | 9 | 10 | 9 | 9 | 8 | 9 | 54 | A |
| Merge | 9 | 10 | 9 | 9 | 8 | 9 | 54 | A |
| Cyber Drift | 9 | 9 | 9 | 9 | 9 | 8 | 53 | A |
| Dodge | 9 | 9 | 9 | 9 | 9 | 8 | 53 | A |
| Laser Blade | 9 | 9 | 8 | 9 | 10 | 8 | 53 | A |

## Current pre-P20 re-audit

The current production implementation includes material P16–P19 work that did not exist in the P15 scoring snapshot. The re-audit counts only changes that map directly to the rubric category in question.

| Game | Core | Agency | Progression | Replay | Feel | Fairness/UX | Total | Pre-P20 decision |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Gravity | 9 | 10 | 10 | 9 | 9 | 9 | 56 | Already clears S after P16–P18 evidence |
| Chain | 9 | 10 | 9 | 9 | 9 | 9 | 55 | Already clears S after P17 evidence |
| Merge | 9 | 10 | 9 | 9 | 9 | 9 | 55 | Already clears S after P17 evidence |
| Cyber Drift | 9 | 9 | 9 | 9 | 10 | 9 | 55 | Already clears S after P16–P18 evidence |
| Dodge | 9 | 9 | 9 | 9 | 10 | 9 | 55 | Already clears S after P16–P18 evidence |
| Laser Blade | 9 | 9 | 8 | 9 | 10 | 9 | 54 | P20 progression change required |

This is intentionally not a blanket “P17/P18 = +1” rule. Each increase is defended below and encoded in `scripts/p20-promotion-scorecards.ts`.

## Gravity evidence

### Feel 8 → 9

- P17 explicitly elevates Flight Contract and sector completion above routine star collection.
- The game-native HUD exposes the active contract, requirement, streak, and boost/flip/recall usage.
- Steering, boost, polarity flip, star collection and sector completion retain distinct native feedback instead of collapsing into one generic effect.

### Fairness / UX 8 → 9

- P16 certifies the five authored sectors and deterministic 60 Hz Newtonian stepping.
- Flight Contracts remain optional and cannot narrow the legal ordinary clear route.
- P18 preserves accurate control teaching, contract discoverability, touch support, failure explanation and reduced-motion information.

### Adversarial review

No Core, Agency, Progression or Replay point is raised. The promotion does not depend on P19 shell polish and requires no new Gravity mechanic in P20.

**PROMOTE TO S — 56/60.**

## Chain evidence

### Feel 8 → 9

- Plasma, Tesla and Cryo have genuinely different anticipation, cast and resolution behavior.
- Tool purpose is exposed in the native HUD.
- Resonance order/progress is visible and P17 gives Resonance and large cascades a stronger hierarchy than routine reactions.
- Cascade causality is already staged through explosions, lightning arcs, floating texts, wave-completion evaluation and separate board-wipe/wave-clear payoff.

### Adversarial review

Fairness / UX is intentionally held at 9 because dense late boards remain demanding. No Agency or Replay point is awarded for mechanics that already existed at P15.

**PROMOTE TO S — 55/60.**

## Merge evidence

### Feel 8 → 9

- Native haptics distinguish ordinary placement, merge and multi-step cascade outcomes.
- Combo audio scales with merge streak.
- Contract completion has separate success feedback plus bounded hammer/swap replenishment.
- P17 reinforces cascade/contract hierarchy without changing the deterministic merge resolver.

### Adversarial review

P18 teaching is not double-counted as another Fairness/UX point because that category was already 9. No timer, extra tool, alternate board or meta-system is added.

**PROMOTE TO S — 55/60.**

## Cyber Drift evidence

### Feel 9 → 10

This is not awarded for a generic shared effect. The game already had a 9-caliber native feel layer: fixed-step steering, drift angle, dual skidmarks, nitro flames, speed lines, drift tiers, score popups, audio and haptics. P17 adds Style Route mastery hierarchy while deliberately shrinking global high-speed feedback so road decisions remain primary.

### Fairness / UX 8 → 9

- P16 certifies the fixed event cadence and bounded Nitro speed so spawn frequency and velocity cannot multiply into an uncontrolled pressure cliff.
- Rival, oil and EMP hazards have different geometry/labels and distinct failure responses.
- P18 certifies high-speed readability, touch steering, failure explanation and reduced-motion continuity.

### Adversarial review

Fairness / UX remains 9, not 10, because procedural traffic can still create variable pressure. Feel reaches 10 only because the underlying game-native feedback was already strong before P17.

**PROMOTE TO S — 55/60.**

## Dodge evidence

### Feel 9 → 10

- Warp Dash has a dedicated state change, particle burst and ghost trail.
- Phase Cut is active mastery rather than passive invulnerability: qualified cuts award score/recharge, native particles and success audio.
- P17 keeps failure/mastery hierarchy while reducing global effects for high-speed readability.

### Fairness / UX 8 → 9

- Laser hazards provide a 1.2 s warning before a 0.5 s active beam.
- Meteor, shuriken and homing hazards differ by silhouette and motion, not color alone.
- P16 preserves bounded dash/Phase Cut rules and P18 certifies high-speed readability, touch movement and reduced-motion meaning.

### Adversarial review

Agency and Replay remain 9 because Warp Dash/Phase Cut existed before P15 and are not counted twice. Fairness remains 9 rather than claiming procedural mixed hazards are perfect.

**PROMOTE TO S — 55/60.**

## Laser Blade — P20 implementation

Laser Blade is the only candidate that remained below 55 in the pre-P20 re-audit. Its unresolved historical blocker was **Progression 8**: the score tiers increased pressure, but wave composition remained largely unstructured random selection.

P20 adds `src/lib/bladeWavePhrases.ts` and converts composition into seven authored phrase families while retaining procedural variation inside each phrase:

1. **Clean Cuts** — readable single-hit targets establish the slice rhythm.
2. **Crosscut Angles** — mixed target values encourage deliberate multi-target paths.
3. **Armor Break** — two-hit pineapples and bounded shield opportunities introduce commitment.
4. **Red Zone** — the first controlled bomb-pressure phrase.
5. **Razor Window** — high-value clean targets emphasize optional center-cut precision.
6. **Mixed Mastery** — armor, precision and bounded bomb pressure combine.
7. **Neon Finale** — the full vocabulary appears in a high-pressure authored phrase.

Each phrase lasts three waves. After the opening arc, late play rotates the three mastery phrases instead of freezing into one terminal composition. Eligible bomb phrases permit **at most one bomb per wave**; early teaching phrases contain no bomb. Target count stays bounded at 2–4. Existing trajectory generation, gravity, combo timing, slice collision, lives, shield consequences and Razor geometry are unchanged.

The active phrase and its 1–3 step are visible in the gameplay HUD. Phrase entry receives a concise non-modal popup rather than a start screen or tutorial interruption.

### Progression 8 → 9

The run now has an intentional authored composition arc rather than only score-driven cadence escalation, while still keeping random target selection inside each phrase for replayability.

### Fairness / UX 8 → 9

This point is supported primarily by pre-existing P16/P18 work: launch trajectories are permanently playability-audited and mobile/reduced-motion teaching is certified. P20 strengthens the evidence by keeping bombs out of the introductory phrases and capping eligible waves at one bomb without weakening bomb consequences.

### Adversarial review

- Feel remains the historical 10; P20 does not claim another point for extra slash effects.
- Replay remains 9; authored phrase structure uses existing vocabulary and does not add a mode or retention loop.
- Progression rises only one point.
- Razor remains optional and bonus-only.

**PROMOTE TO S — 55/60.**

## Final P20 scorecards

| Game | Core | Agency | Progression | Replay | Feel | Fairness/UX | Total | Grade |
|---|---:|---:|---:|---:|---:|---:|---:|:---:|
| Gravity | 9 | 10 | 10 | 9 | 9 | 9 | 56 | S |
| Chain | 9 | 10 | 9 | 9 | 9 | 9 | 55 | S |
| Merge | 9 | 10 | 9 | 9 | 9 | 9 | 55 | S |
| Cyber Drift | 9 | 9 | 9 | 9 | 10 | 9 | 55 | S |
| Dodge | 9 | 9 | 9 | 9 | 10 | 9 | 55 | S |
| Laser Blade | 9 | 9 | 9 | 9 | 10 | 9 | 55 | S |

## Point-change ledger

| Game | Changed category | P15 | P20 | Evidence |
|---|---|---:|---:|---|
| Gravity | Feel | 8 | 9 | Contract/sector hierarchy plus distinct native control feedback |
| Gravity | Fairness/UX | 8 | 9 | P16 deterministic/optional-contract guarantees + P18 clarity/accessibility |
| Chain | Feel | 8 | 9 | Distinct three-tool resolution, cascade staging and Resonance hierarchy |
| Merge | Feel | 8 | 9 | Native placement/merge/cascade/contract feedback hierarchy |
| Cyber Drift | Feel | 9 | 10 | Exceptional game-native drift/nitro feedback completed by P17 high-speed hierarchy |
| Cyber Drift | Fairness/UX | 8 | 9 | P16 bounded cadence/speed + P18 high-speed readability/touch/failure clarity |
| Dodge | Feel | 9 | 10 | Dedicated Dash/Phase Cut state, ghost trail, particles and mastery reward hierarchy |
| Dodge | Fairness/UX | 8 | 9 | Laser telegraph + geometric hazard language + P16/P18 high-speed contracts |
| Laser Blade | Progression | 8 | 9 | Seven authored composition phrases with bounded procedural variation |
| Laser Blade | Fairness/UX | 8 | 9 | P16 trajectories/P18 clarity plus P20 bomb-free teaching phrases and one-bomb cap |

No unchanged category is raised merely because the total needed another point.

## Current distribution after P20

If the P20 source/browser/regression gates and manual promotion review pass, the current grading state becomes:

- **S: 11**
- **A: 14**
- **B: 7**
- **C/D/F: 0**

P15 remains unchanged as historical evidence.

## Automated certification boundary

`quality:gameplay-p20` can verify source contracts, frozen scorecard arithmetic, evidence presence, phrase composition rules, prior phase preservation, CI/release wiring and prohibited-system absence.

`quality:browser-p20` can verify the six games across desktop/mobile/small-mobile for launch, shell, pause/restart/exit, responsive containment, candidate-specific HUD/mechanic landmarks, reduced motion, input paths and console cleanliness.

Automation cannot prove “fun”, “beautiful”, “addictive”, or the subjective truth of S rank. The scorecards are editorial judgments supported by objective evidence, not generated by CI arithmetic.

## Manual promotion acceptance

For each candidate, manually test:

- first-run comprehension and control trust;
- skilled use of the mastery mechanic;
- late/high-pressure readability and failure trust;
- muted play and haptics-off play;
- reduced motion;
- 320 px mobile and desktop;
- whether a fresh run remains appealing for game-specific mastery rather than retention rewards.

For Laser Blade specifically, verify that the seven phrase identities are perceptible, Red Zone introduces bomb pressure without surprise overlap, Razor Window genuinely changes the desired swipe discipline, and Neon Finale feels like a culmination without degrading swipe responsiveness.

## Regression contract

P20 must keep all P0–P19 gates, P3/P17/P18/P19 browser matrices, specialist audits, TypeScript, Worker smoke/dry-run, production/Pages builds and MA3/MA4 intact. `release32` must require P20 permanently.

## Exit decision

P20 closes only when all six promotion records remain ≥55 under the unchanged rubric, `quality:gameplay-p20` and `quality:browser-p20` pass, full regression is green, the exact PR head is certified, the merge commit passes `main` CI, Pages deploys that same commit, and live smoke passes all 32 games.
