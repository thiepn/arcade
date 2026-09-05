# P21 — Strong-A Promotion Certification

Baseline: `3a6b2f19bd71f7a7a8947b7de3da9fc9b3d553ff` (production-certified P20)

## Purpose

P21 promotes the six strongest remaining A-rank games only when the unchanged P15 six-category rubric supports a score of at least 55/60. It is not a roster-wide feature phase and does not add replay recording/playback, currencies, XP, daily systems, permanent unlocks, or retention mechanics.

The governing rule is **finish the existing game identity rather than make the game larger**.

## Historical P15 scorecards

The P21 planning draft contained several copied score errors. This document uses immutable `docs/P15_ROSTER_AUDIT.md` as the authority.

| Game | Core | Agency | Progression | Replay | Feel | Fairness/UX | Total | Grade |
|---|---:|---:|---:|---:|---:|---:|---:|:---:|
| Breakout Mini | 9 | 9 | 9 | 9 | 8 | 8 | 52 | A |
| Neon Puck Smash | 9 | 9 | 8 | 9 | 9 | 8 | 52 | A |
| Gravity Tower Jumper | 9 | 9 | 9 | 8 | 9 | 8 | 52 | A |
| Cyber Pac-Runner | 9 | 9 | 9 | 8 | 8 | 8 | 51 | A |
| One Line | 9 | 10 | 9 | 8 | 7 | 8 | 51 | A |
| Chrono Wave | 9 | 9 | 9 | 8 | 8 | 8 | 51 | A |

Historical P15 remains permanently:

- **S: 5**
- **A: 20**
- **B: 7**

## Current pre-P21 re-audit

P16–P20 materially changed or certified game-specific quality after P15. The re-audit awards only changes supported by actual game/runtime evidence and deliberately does not treat shared shell polish as Core/Agency/Progression/Replay improvement.

| Game | Core | Agency | Progression | Replay | Feel | Fairness/UX | Pre-P21 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Breakout Mini | 9 | 9 | 9 | 9 | 9 | 9 | 54 |
| Neon Puck Smash | 9 | 9 | 8 | 9 | 10 | 9 | 54 |
| Gravity Tower Jumper | 9 | 9 | 9 | 8 | 10 | 9 | 54 |
| Cyber Pac-Runner | 9 | 9 | 9 | 8 | 9 | 9 | 53 |
| One Line | 9 | 10 | 9 | 8 | 8 | 9 | 53 |
| Chrono Wave | 9 | 9 | 9 | 8 | 9 | 9 | 53 |

### Pre-P21 evidence boundary

- **Feel:** P17 may raise a historical Feel score only where the game has game-native feedback that the bounded shared hierarchy reinforces. One Line remains 8 rather than being promoted straight from 7 to 9.
- **Fairness/UX:** P16 quantitative bounds plus P18 teaching/control/failure work can justify one point where the specific game now has stronger objective trust guarantees.
- **P19:** canonical shell/navigation behavior supports UX continuity only; it does not raise gameplay depth categories.
- **P20:** promotion infrastructure changes audit discipline, not these six games' scores.

## Remaining blockers found by P21

### Breakout Mini

The underlying round escalation was strong, but the four rotating contracts repeated without a sufficiently explicit authored session arc.

### Neon Puck Smash

The fair 60-second match and Power Play were already strong. The remaining Progression gap was that successive Power goals did not form a strong enough conversion ladder inside the earned four-second window.

### Gravity Tower Jumper

Apex Drive rewarded precision, but the replay objective stopped at earning charges. Sustaining a longer center-landing route needed a distinct payoff without changing survival.

### Cyber Pac-Runner

The classic maze, ghost personalities and Hunt Rush were strong, but successive level clears primarily tightened timings. More authored tactical rhythm was needed without replacing the maze.

### One Line

Ten procedural archetypes and Master Routes already created variation, but later stages did not materially deepen the optional optimization target.

### Chrono Wave

Reachability was excellent, but safe wall transitions were locally planned rather than composed into recognizable short phrases, limiting session texture.

## Implemented improvements

### Breakout Mini — authored eight-round contract arc

P21 adds eight `BREAKOUT_ROUND_IDENTITIES` over the unchanged four base contract kinds:

1. Control Read
2. Power Window
3. Armor Test
4. Special Route
5. Pressure Return
6. Power Conversion
7. Armor Master
8. Special Finale

The four contract kinds, ordinary brick clear, paddle physics and temporary powerups remain unchanged. Late identities tighten only existing optional contract targets and retain the target ceiling of 6.

### Neon Puck Smash — Power conversion ladder

The existing Power Play remains earned from defense/goal events, lasts exactly four seconds, and does not modify AI limits or the puck cap. P21 changes only successive Power-goal score conversion to four bounded tiers:

`0.50 → 0.75 → 1.05 → 1.35 × base goal points`

This creates a clearer earned-pressure/conversion phase inside the existing match rather than adding a mode.

### Gravity Tower Jumper — five-center Apex route

The existing center-landing streak already earns Apex charges every three precision landings. P21 adds a score-only route completion beat every five consecutive center landings: +900 points. It grants no shield, movement help, extra duration, or additional safety.

### Cyber Pac-Runner — six authored level protocols

P21 adds six cycling tactical protocols:

1. Orientation
2. Corner Read
3. Target Mix
4. Switchback
5. Pursuit
6. Endurance

Each uses the existing Chase/Scatter system with bounded differences in scatter time, chase time, ghost speed pressure and frightened duration. Later cycles add only small bounded pressure. The maze, four ghost personalities, Hunt Rush, normal speed cap 5.6 and frightened-time floor 4.5 seconds remain intact.

### One Line — tiered Master Routes

The original three mastery identities remain exactly:

- Star Route
- Ink Saver
- Master Line

Every three stages now advances one mastery tier. Later tiers tighten only the optional ink-efficiency requirement by two percentage points per tier, capped at 40%, and modestly increase mastery rewards. The portal remains the ordinary clear condition; stars remain optional; there is still no timer.

### Chrono Wave — bounded gap phrase grammar

P21 composes the existing legal transition vocabulary into four short phrase families:

- Orientation
- Weave
- Reversal
- Compression

Every phrase offset remains `-1`, `0`, or `+1` sector. Small bounded mirroring creates variation inside the phrases. Existing impact ordering, two-sector openings, one-sector maximum shift, safe stage-transition openings, EMP and optional Focus Wager remain authoritative.

## Evidence ledger

| Game | Changed category | P15 | P21 | Evidence |
|---|---|---:|---:|---|
| Breakout Mini | Progression | 9 | 10 | Eight authored round identities create a deliberate two-act contract arc while ordinary clears remain legal. |
| Breakout Mini | Feel | 8 | 9 | P17 hierarchy reinforces existing brick/paddle/contract feedback without changing simulation. |
| Breakout Mini | Fairness/UX | 8 | 9 | P16 bounded powerups/contracts + P18 controls/failure/touch clarity. |
| Neon Puck Smash | Progression | 8 | 9 | P21 adds a four-tier score-only Power conversion ladder inside the existing earned match window. |
| Neon Puck Smash | Feel | 9 | 10 | Native puck/mallet/goal/Power response plus P17 feedback remains immediate and bounded. |
| Neon Puck Smash | Fairness/UX | 8 | 9 | Certified player/puck caps, explicit AI reaction/prediction bounds and P18/P19 mobile/shell behavior. |
| Gravity Tower Jumper | Replay | 8 | 9 | Five consecutive precision centers now complete a repeatable score-only Apex route. |
| Gravity Tower Jumper | Feel | 9 | 10 | Native landing/spring/stomp/Apex response plus P17 hierarchy. |
| Gravity Tower Jumper | Fairness/UX | 8 | 9 | 60 Hz physics, voluntary Apex and P18/P19 responsive hazard/control clarity. |
| Cyber Pac-Runner | Progression | 9 | 10 | Six authored level protocols create intentional tactical escalation across clears. |
| Cyber Pac-Runner | Replay | 8 | 9 | Protocol cycling makes the same classic maze demand different route timing across runs/levels. |
| Cyber Pac-Runner | Feel | 8 | 9 | Certified buffered turns/reversals/tunnels plus P17 outcome hierarchy. |
| Cyber Pac-Runner | Fairness/UX | 8 | 9 | Speed/duration caps, Hunt optionality and P18 touch/failure teaching. |
| One Line | Progression | 9 | 10 | Later three-stage mastery tiers tighten optional efficiency goals and rewards. |
| One Line | Replay | 8 | 9 | Procedural layouts now sit beneath a progressively stronger optimization ladder. |
| One Line | Feel | 7 | 8 | P17 improves portal/mastery result hierarchy but does not justify flagship-level Feel 9. |
| One Line | Fairness/UX | 8 | 9 | 240 Hz player-paced physics, ordinary clears, ink/touch/failure clarity remain certified. |
| Chrono Wave | Progression | 9 | 10 | Legal gap transitions are now composed into four recognizable phrase families. |
| Chrono Wave | Replay | 8 | 9 | Bounded mirroring varies learnable phrases without destroying reachability. |
| Chrono Wave | Feel | 8 | 9 | P17 separates pass/shard/Focus/EMP/collision feedback without hiding the next wall. |
| Chrono Wave | Fairness/UX | 8 | 9 | Reachability planner + P18/P19 controls/failure/mobile contracts remain intact. |

No category rises more than one point from P15.

## Final P21 scorecards

| Game | Core | Agency | Progression | Replay | Feel | Fairness/UX | Total | Grade |
|---|---:|---:|---:|---:|---:|---:|---:|:---:|
| Breakout Mini | 9 | 9 | 10 | 9 | 9 | 9 | **55** | **S** |
| Neon Puck Smash | 9 | 9 | 9 | 9 | 10 | 9 | **55** | **S** |
| Gravity Tower Jumper | 9 | 9 | 9 | 9 | 10 | 9 | **55** | **S** |
| Cyber Pac-Runner | 9 | 9 | 10 | 9 | 9 | 9 | **55** | **S** |
| One Line | 9 | 10 | 10 | 9 | 8 | 9 | **55** | **S** |
| Chrono Wave | 9 | 9 | 10 | 9 | 9 | 9 | **55** | **S** |

Promotion decisions:

- **BREAKOUT MINI — PROMOTE TO S — 55/60**
- **NEON PUCK SMASH — PROMOTE TO S — 55/60**
- **GRAVITY TOWER JUMPER — PROMOTE TO S — 55/60**
- **CYBER PAC-RUNNER — PROMOTE TO S — 55/60**
- **ONE LINE — PROMOTE TO S — 55/60**
- **CHRONO WAVE — PROMOTE TO S — 55/60**

Current distribution after P21:

- **S: 17**
- **A: 8**
- **B: 7**

This does not alter historical P15 or the separately recorded P20 state.

## Adversarial promotion review

### Breakout Mini

The new arc does not earn a Replay point because contracts already supplied replayability. Progression reaches 10 only because the round sequence now deliberately introduces, develops and recombines the existing contract vocabulary. No ordinary clear is gated by a contract.

### Neon Puck Smash

The P21 Power ladder changes only scoring. It does not make the AI faster, shorten reaction delay, raise puck speed or create a survival resource. Progression rises only 8→9; Replay remains 9 because difficulty modes and Power existed before P21.

### Gravity Tower Jumper

The five-center route changes player intent during repeated climbs but supplies no survival advantage. Progression remains 9. Replay alone rises because precision streak preservation now has a distinct repeatable completion beat.

### Cyber Pac-Runner

The maze itself intentionally remains classic. Core and Agency stay 9. Progression and Replay rise separately because the six protocols alter level sequencing and repeated route timing, while speed/frightened caps remain intact.

### One Line

Feel remains only 8 even after P17. P21 does not claim the minimal drawing interface is a 9/10 tactile showcase. The promotion instead comes from actual tiered optimization behavior layered over the existing ten-archetype puzzle loop.

### Chrono Wave

No point comes from higher speed or decorative effects. Both new points are tied to actual planner structure: authored phrase sequencing for Progression and bounded phrase variation for Replay. Existing reachability remains the release authority.

## Automated certification boundary

`quality:gameplay-p21` objectively verifies:

- exact six-game cohort;
- immutable P15 score rows;
- unchanged 55/60 threshold;
- ≤+1 category deltas;
- evidence/adversarial coverage;
- Breakout eight-round identity arc beneath four base contracts;
- Puck four-tier score-only Power ladder and frozen physics/AI bounds;
- Tower five-center route and frozen Apex economy;
- Pac six protocols plus frightened/speed caps;
- One Line three-goal identity, tier cadence and 40% mastery ceiling;
- Chrono phrase offsets under the reachability envelope;
- P16–P20 continuity;
- no replay recorder/playback or retention metagame;
- permanent CI/release wiring.

`quality:browser-p21` covers all six candidates at:

- 1280×800 desktop;
- 390×844 reduced-motion mobile;
- 320×568 reduced-motion small mobile.

It verifies launch, candidate-native landmarks, input, P18/P19 shell/pause/focus behavior, restart cleanup, responsive overflow, reduced-motion state and runtime/console cleanliness.

Automation cannot prove “fun”, “beautiful”, “addictive”, or the subjective truth of S rank.

## Manual acceptance boundary

Manual promotion acceptance remains required editorial evidence for:

- first-run completeness;
- skilled mastery value;
- late/high-pressure readability;
- mobile touch confidence;
- perceived fairness;
- whether a fresh run is intrinsically desirable;
- comparative credibility beside the existing S cohort.

P21 documentation records those questions rather than pretending CI can answer them.

## Regression / release contract

P21 permanently extends the browser chain to:

`P3 → P17 → P18 → P19 → P20 → P21`

and extends `release32` through `quality:gameplay-p21` and `quality:browser-p21`.

Final production closure additionally requires TypeScript, Worker smoke/typecheck/dry-run, production build, root MA3/MA4, Pages build, `/arcade/` MA3/MA4, deployment and live smoke of all 32 games.
