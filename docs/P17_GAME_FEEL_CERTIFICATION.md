# P17 — Game Feel & Feedback Excellence

Baseline: `cc1b52c5c997ca61dfae5073007ac99b8e50fc98` (post-P16 production)

## Purpose

P17 is a roster-wide quality phase for all 32 shipped games. It does not add currencies, progression systems, difficulty reductions, or unrelated mechanics. It preserves the P16 pacing/fairness envelopes and raises the presentation layer around existing input, success, mastery, warning, failure, transition, mobile, and reduced-motion states.

P17 also preserves the P15 grading baseline. The roster remains **5 S / 20 A / 7 B** until a later independent re-audit; P17 does not award letter-grade promotions.

## Shared implementation contract

The P17 runtime adds one bounded presentation layer to the common game shell:

- exactly **8 pooled feedback nodes** per active shell; no unbounded particle/DOM growth;
- immediate pointer and keyboard acknowledgement without delaying simulation input;
- semantic hierarchy for ordinary success, strong success, mastery, warning, failure, and major transition;
- score/PB HUD emphasis that never changes scoring;
- no gameplay-coordinate transforms, collision changes, invulnerability, or difficulty changes;
- effects are `pointer-events: none` and clipped to the game stage;
- explicit full-motion and reduced-motion branches;
- reduced motion replaces travel/scale emphasis with bounded contrast, outlines, and static flashes;
- smaller global effects for the nine high-speed readability games;
- cleanup removes the feedback layer and disconnects per-shell observers after exit;
- game-specific identity is retained through one explicit feel profile per game rather than one generic effect language.

The existing synthetic Web Audio system and throttled haptic engine remain authoritative. P17 does not add long-lived media loops or heavy assets.

## 32-game certification matrix

| ID | Game | Input / ordinary feedback | Mastery hierarchy | Failure clarity | Audio / haptics | High-speed readability | Mobile | Reduced motion | P17 |
|---|---|---|---|---|---|---|---|---|:---:|
| orbit | Orbit | Lane pulse/crystal acknowledgement stays local and immediate | Route, graze and safe-formation clears rise above routine pulses | Collision/unsafe-lane state remains identifiable | Existing orbital synth cues; shell haptics remain bounded | N/A | Touch pulse path receives the same acknowledgement | Static burst/outline replacement | PASS |
| stack | Stack | Placement contact and cut events are reinforced without changing one-button timing | PERFECT and Focus success receive the strongest geometric emphasis | Insufficient overlap is emphasized before reset | Existing placement sounds; score haptics remain throttled | N/A | Tap path shares pointer acknowledgement | No scale dependency for essential state | PASS |
| reaction | Reaction | Valid response acknowledgement is immediate and cue-clean | Inhibition/overtime success is stronger than a basic response | FALSE START, wrong cue and TIMEOUT classify as failure | Existing reaction sounds plus bounded error haptic path | N/A | Touch response uses the common input path | Contrast/outline replaces motion emphasis | PASS |
| dodge | Dodge | Steering/pickup feedback remains attached to player action | Phase Cut chains receive mastery hierarchy without hiding threats | Impact state is elevated at collision | Existing combat cues; haptics remain event-bounded | Smaller global bursts protect hazard silhouettes | Drag/touch path certified by runtime browser pass | Static flash only for global emphasis | PASS |
| pulse | Pulse | GOOD, GREAT and PERFECT retain ascending semantic hierarchy | Fever and Sync Wager success receive strong/mastery treatment | MISS and wager failure remain beat-readable | Existing rhythm synth cues; bounded score/mastery haptics | N/A | Tap input gets immediate acknowledgement | Beat information retained without travel effects | PASS |
| merge | Merge | Drop/merge/cascade feedback remains sequential and restrained | Contract/tool/cascade milestones outrank normal merges | Weak/blocked board state remains visible | Existing puzzle audio retained; haptics do not change legality | N/A | Column taps share input acknowledgement | Static metric/semantic emphasis | PASS |
| typerush | Type Rush | Target lock and typed-word actions receive immediate key acknowledgement | Urgent/special high-value clears rise above routine words | Escaped/danger-line word state remains legible | Existing typing cues retained | N/A | On-screen keypad uses pointer acknowledgement | No essential cue depends on animation | PASS |
| oneline | One Line | Drawing, ink use and contact feedback remain tactile without physics changes | Portal and Master Route completion receive elevated payoff | Failed trajectory can be visually emphasized without path prediction | Existing physics cues retained | N/A | Pointer/touch drawing path remains direct | Contact/result information preserved statically | PASS |
| breakout | Breakout Mini | Paddle/brick/armor contact remain distinct | Contract, powerup and multiball events outrank routine hits | Drain state remains clear | Existing kinetic synth sounds and bounded impacts | N/A | Touch/drag path shares immediate input acknowledgement | Essential hit/drain cues remain visible | PASS |
| perfectstop | Perfect Stop | Stop input receives immediate acknowledgement at the interaction | Near/PERFECT/Encore hierarchy communicates result tier | Poor stop remains positionally diagnosable | Existing timing cues retained | N/A | Tap input parity retained | Result tier uses static contrast when reduced | PASS |
| chain | Chain | Tool cast and cascade resolution stay visually staged | Resonance/large cascade events rise above ordinary detonations | Spent charge/unmet target remains readable | Existing tactical energy cues retained | N/A | Arena taps receive common acknowledgement | Static hierarchy preserves tool meaning | PASS |
| gravity | Gravity | Star, boost and polarity actions remain individually readable | Flight Contract/sector completion outranks ordinary collection | Recall/collision state remains clear | Existing orbital cues/haptics retained | N/A | Slingshot/touch steering path remains direct | Static flashes replace global movement | PASS |
| blade | Laser Blade | Swipe and hit stay tightly coupled | Razor chains/rush milestones receive mastery treatment | Bomb/miss state remains distinct from slice success | Existing slash/impact audio retained | N/A | Swipe path is pointer-native | Essential target state remains motion-independent | PASS |
| pinball | Neon Pinball | Flipper/bumper/target contact retain physical separation | Multiball/drop-target completion outranks normal table hits | Drain/ball-save state stays legible | Existing pinball-specific synth cues retained | N/A | Side-touch controls retain immediate acknowledgement | State feedback survives reduced motion | PASS |
| chrono | Chrono Wave | Gap pass and EMP interaction remain compact | Focus success/stage transition receive elevated temporal emphasis | Wall collision highlights the failed opening | Existing chrono cues retained | N/A | Touch controls retain parity | Static warning/success treatment | PASS |
| matrix | Memory Matrix | Playback and player input remain visually distinct | Overclock activation/success receives mastery emphasis | Wrong node/life loss is clear without contaminating playback | Existing per-node musical tones retained | N/A | Touch node input receives immediate acknowledgement | Playback information is preserved | PASS |
| drift | Cyber Drift | Steering/drift/nitro feedback remains car-local | Style Route completion/positive events rise above routine driving | Collision remains readable through speed effects | Existing skid/nitro audio retained | Smaller global bursts and flashes protect road readability | Touch path remains bounded to stage | No motion-heavy global effect required | PASS |
| vanguard | Galaxy Vanguard | Shot/hit/pickup/enemy-destruction layers remain distinct | Boss/Nova/major-wave events receive strongest hierarchy | Damage/lethal threat remains readable under density | Existing combat audio retained | Reduced global effect size protects bullets/enemies | Mobile control path retains immediate acknowledgement | Static failure/mastery flash | PASS |
| slingshot | Orbital Slingshot | Release/acceleration/capture feedback communicates energy transfer | Perfect capture/mission/warp receive increasing hierarchy | Overshoot, collision and failed capture are explicitly separated in profile | Existing slingshot/capture audio retained | N/A | Drag/release touch path remains direct | Failure information does not require camera motion | PASS |
| snake | Cyber Serpent | Growth/portal/firewall interactions retain separate state reads | Ghost Phase Thread milestones are elevated | Wall/self/firewall failure remains semantically distinct | Existing synth cues retained | N/A | Swipe/key control acknowledgement retained | Grid state remains static-readable | PASS |
| rhythm | Neon Rhythm Tapper | Lane input feedback remains separate from timing judgement | PERFECT, hold clear, combo and Overdrive receive stronger hierarchy | MISS/HOLD BREAK remains lane/note specific | Existing musical lane synthesis retained | N/A | Touch lane path receives immediate acknowledgement | Timing cue semantics remain intact | PASS |
| tower | Gravity Tower Jumper | Bounce/landing/pickup feedback follows avatar | Precision/Apex success receives stronger vertical emphasis | Laser versus missed-platform death remains distinct | Existing bounce/impact audio retained | Smaller global effects preserve platforms/laser | Touch controls retain parity | Static edge/semantic flashes | PASS |
| pacmaze | Cyber Pac-Runner | Pellet/turn/frightened states remain clean | Hunt Rush captures rise above ordinary collection | Ghost collision/frightened expiry stays readable | Existing maze cues retained | N/A | Touch direction controls retain immediate acknowledgement | Essential maze states remain static-readable | PASS |
| flappyaero | Aero Pulse | Flap/gate/star/graze feedback stays lightweight | Flow Boost/graze streak milestones receive elevated hierarchy | Gate collision remains visually local | Existing flap/score cues retained | Smaller feedback protects gate geometry | Tap input parity retained | Static state contrast replaces motion-heavy emphasis | PASS |
| roadcross | Cyber Crosser | Step/checkpoint feedback remains player-local | District/checkpoint milestones outrank row movement | Vehicle/train/water failure source remains clear | Existing crossing cues retained | Smaller global effects protect traffic silhouettes | Touch direction input retains parity | Static failure cue remains visible | PASS |
| bubblebuster | Orb Cannon | Shot/snap/match/drop resolve in readable order | Burst/large cascade events receive board-wide mastery emphasis | Ceiling-pressure terminal state remains obvious | Existing cannon/cascade cues retained | N/A | Aim/touch path remains direct | Board state remains readable without motion emphasis | PASS |
| astroblaster | Astro Blaster 360 | Thrust/fire/split feedback preserves directionality | UFO/special-wave/high-value combat events receive mastery hierarchy | Ship impact remains visible through effects | Existing combat synth cues retained | Smaller global effect footprint protects threats | Mobile control path retains parity | Static flashes replace movement-heavy emphasis | PASS |
| laserrope | Laser Rope Reflex | Jump/slide input feedback never changes beam phase | Redline/evasion streak events rise above routine movement | Beam contact and current LOW/HIGH/DUAL mode remain clear | Existing laser/action cues retained | Smaller effects preserve beam crossings and P16 warning floor | Touch jump/slide path retained | Static warning/failure emphasis | PASS |
| blockdrop | Cyber Block Drop | Placement/drop/hold feedback stays restrained | Tetris, B2B and clear-chain terms classify above single/double clears | Lockout/game over remains board-readable | Existing placement/clear cues retained | N/A | Touch control path retains immediate acknowledgement | Clear hierarchy survives without scale motion | PASS |
| knifetarget | Knife Target | Throw/embed contact remains immediate | Razor Mark chains/rushes receive mastery hierarchy | Unsafe blade collision remains distinct | Existing throw/impact audio retained | N/A | Touch throw path shares acknowledgement | Static target emphasis remains informative | PASS |
| airhockey | Neon Puck Smash | Mallet/puck/goal contact retains physical clarity | Power Play goal/streak events receive stronger hierarchy | Conceded goal stays distinct from neutral collision | Existing puck/impact cues retained | N/A | Touch mallet path remains direct | Goal/result state remains static-readable | PASS |
| neonrail | Neon Rail Shift | Lane shift/core pickup feedback remains route-local | Phase/Surge/mastery streak events rise above routine collection | Blocked-route collision remains legible at late speed | Existing rail cues retained | Smaller feedback preserves late phrase recognition | Touch lane/Surge path retains parity | Static phase/failure cues replace motion emphasis | PASS |

## Rhythm timing preservation

P17 does not alter timing judgement. The certified values remain:

- PERFECT: 70 ms
- GREAT: 125 ms
- GOOD: 190 ms
- MISS: 230 ms
- calibration range: -200 ms to +200 ms

Animations are presentation-only and never determine judgement.

## High-speed readability set

The runtime applies smaller global feedback to exactly these games:

- Dodge
- Cyber Drift
- Galaxy Vanguard
- Gravity Tower Jumper
- Aero Pulse
- Cyber Crosser
- Astro Blaster 360
- Laser Rope Reflex
- Neon Rail Shift

This preserves player/hazard silhouettes at the maximum pressure already certified by P16.

## Performance, mobile and cleanup

P17 uses a fixed pool rather than allocating feedback elements per event. The browser audit verifies for every game on desktop/full-motion and touch-mobile/reduced-motion that:

- exactly one feedback layer exists while the shell is active;
- exactly eight pooled nodes exist;
- the layer cannot intercept pointer input;
- input, mastery and failure feedback can activate;
- feedback does not create shell overflow;
- restart does not duplicate the layer or nodes;
- exit removes the shell and P17 layer;
- no page error is produced by the runtime.

The pre-existing 32-game browser gameplay matrix remains mandatory in CI in addition to the P17-specific runtime pass.

## Audio and haptics

P17 deliberately reuses the existing lightweight Web Audio and haptic infrastructure instead of introducing asset-heavy audio or continuous vibration. The haptic engine already rate-limits ordinary score vibration and reserves larger patterns for combo/high-score/game-over events. The audio engine uses generated short-form cues and continues to obey the global mute setting.

P17 does not claim that automation can measure subjective loudness balance or tactile preference. Those remain part of the manual acceptance checklist below.

## Human-experience acceptance checklist

Before treating a release as experiential sign-off on real hardware, play each game and answer:

1. **Input** — does keyboard/mouse/touch acknowledge the action immediately?
2. **Ordinary success** — is normal success satisfying without visual/audio excess?
3. **Exceptional success** — is mastery clearly stronger than routine success?
4. **Failure** — is the cause immediately understandable?
5. **Danger** — are warnings still readable at late-game pressure?
6. **Audio** — do sounds reinforce rather than mask the mechanic?
7. **Haptics** — are vibrations sparse, useful, and nonessential to understanding?
8. **Mobile** — do touch controls feel intentional and unobstructed?
9. **Reduced motion** — does all essential information remain available?

The permanent automated audit intentionally certifies only objective source/runtime invariants. It does **not** convert these subjective questions into fake automated “fun” scores.

## No grade inflation

P17 does not edit the P15 grade table. The authoritative pre-promotion distribution remains:

- **S: 5**
- **A: 20**
- **B: 7**
- **C/D/F: 0**

A later independent phase must re-score games against the unchanged 55/60 S-rank threshold.

## Exit decision

**P17 source/runtime certification: PASS when `quality:gameplay-p17`, `quality:browser-p17`, P0–P16 regression gates, TypeScript, root/Pages builds and the existing 32-game browser matrix all pass.**

The implementation covers all 32 games and deliberately changes presentation infrastructure rather than gameplay rules. Physical-device subjective feel remains a release acceptance activity, not something CI can honestly certify.
