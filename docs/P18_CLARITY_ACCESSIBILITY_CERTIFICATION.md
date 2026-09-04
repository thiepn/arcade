# P18 — Clarity, Teaching & Accessibility Excellence

Baseline: `4068a027ad4896444335aa602a0fa5e1581e201e` (post-P17 production)

## Purpose

P18 makes the complete 32-game roster easier to understand without making it easier to master. It adds structured teaching, accessible shell semantics, selective first-run micro-hints, responsive pause/result guidance, and permanent source/browser certification while preserving P0–P17 gameplay contracts.

P18 does not add mechanics, widen timing windows, slow hazards, grant invulnerability, expose exact puzzle solutions, or re-grade the roster.

## Shared teaching contract

Every shipped game has one explicit P18 clarity profile containing:

- one concise core objective;
- essential controls separated from secondary controls;
- a canonical mastery term and short mastery explanation;
- explicit danger, benefit, failure-rule, and next-attempt guidance;
- the authoritative existing `controlsHint` string for drift detection;
- a non-color visual redundancy note;
- an optional first-run micro-hint only where the core interaction genuinely benefits from one;
- priority and high-speed readability classification.

The shared runtime decorates the existing game shell rather than coupling individual simulations to P18. Pause becomes the richer learning surface; active gameplay receives only selective, pointer-transparent micro-hints. Result panels gain concise failure-rule and next-attempt guidance without inventing unsupported run statistics.

## 32-game certification matrix

| ID | Game | Core understood | Controls | Teaching | Mastery clarity | Failure clarity | Color redundancy | Touch | Keyboard/UI | Reduced motion | High-pressure readability | P18 |
|---|---|---|---|---|---|---|---|---|---|---|---|:---:|
| orbit | Orbit | Survive safe lanes and follow crystal routes | Pulse/lane/reverse separated | SAFE-lane concept stated first | Route/graze/formation mastery named | Collision means unsafe lane/timing | Position + SAFE text + hazard silhouette | Pulse/touch path retained | Shell controls named/focusable | SAFE text survives motion reduction | Formation telegraph remains primary | PASS |
| stack | Stack | Place moving block with overlap | Place first; Focus secondary | One-line placement hint only | Focus explains three-perfect earn + 2px wager | Cut edge/no-overlap rule explicit | Geometry + cut edge + PERFECT/Focus text | Coarse targets remain reachable | Shell labels/focus visible | Hint becomes static | Minimal scene stays uncluttered | PASS |
| reaction | Reaction | Act only on valid cues | Neutral response vs directional response separated | HOLD restraint taught before speed | Inhibition + overtime explained | FALSE START/WRONG/TIMEOUT differentiated | Words/directions supplement cue color | Tap response unchanged | No focus shortcut collision | Cue meaning does not depend on motion | Interface adds no reaction-time clutter | PASS |
| dodge | Dodge | Survive hazard field | Steering first; Warp secondary | Phase state described after base loop | Phase Cut intent explicit | Colliding hazard is named as cause | Silhouette + phase effect + pickup shapes | Drag path unchanged | Shell keys remain separate | Static state still identifies phase | Smaller P17 effects remain subordinate | PASS |
| pulse | Pulse | Tap at timing target | Beat input first; wager secondary | Target-ring hint teaches timing | Sync Wager earning/arming stated | MISS/wager failure distinguished | Geometry + judgement words supplement color | Tap path unchanged | Shell focus does not own Space | Timing target remains static-readable | Beat surface remains sparse | PASS |
| merge | Merge | Build merges and contracts | Placement first | Queue-first planning explained | Contracts/cascades/tools grouped | Blocked board framed as planning failure | Values/queue/position supplement color | Column taps unchanged | Numeric keys remain gameplay-owned | No teaching relies on animation | Dense board not covered by overlays | PASS |
| typerush | Type Rush | Type words before danger line | Typing only as essential input | First-run line explains threat | Prioritization/directives explained | Escaped word/lane is failure source | Text/progress/lane/line supplement color | On-screen keypad retained | Physical typing unaffected | All essential information textual/static | Target guidance stays outside word field | PASS |
| oneline | One Line | Draw one ramp to portal | Drag-only essential control | Hint explains draw then simulate | Master Route separated from ordinary clear | Last contact/motion explains route breakdown | Line/stars/portal geometry supplement color | Touch draw unchanged | Shell focus outside drawing surface | Physics meaning independent of decoration | No trajectory solution overlay added | PASS |
| breakout | Breakout Mini | Keep ball alive, clear bricks | Paddle movement only essential | Powerups/contracts are secondary | Round Contracts explained as optional | Drain rule explicit | Brick durability/power marks/geometry | Touch paddle retained | Shell controls named | Hit/drain meaning static-readable | No teaching obscures ball path | PASS |
| perfectstop | Perfect Stop | Stop marker near target center | Single stop action | Target-center hint only | Master Encore qualification stated | Marker remains against target to show error | Target boundaries + position + judgement text | Tap unchanged | Space stays gameplay-owned | Precision read survives reduced motion | No scoring window changes | PASS |
| chain | Chain | Spend three tactical detonations | Tool selection then placement | Tool/charge hint introduces loop | Resonance Order named and explained | Remaining charges/target explain failure | Icons/labels/count/board structure | Arena tap unchanged | Buttons remain semantic | Order/target text survives reduced motion | Dense board gets no extra active overlays | PASS |
| gravity | Gravity | Reach warp using gravity | Launch/steer essential; boost/flip secondary | Slingshot hint teaches base physics | Flight Contracts separated from core clear | Collision/recall rule explained | Body/star/beacon/contract/polarity cues | Drag/touch steering retained | Shell controls named | Contract/polarity info does not require shake | P17 orbital feedback preserved | PASS |
| blade | Laser Blade | Slice targets, avoid bombs | Swipe only essential | Center cuts taught after safe slicing | Razor center-cut chain named | Bomb/miss differs from valid cut | Bomb/target silhouettes + center geometry | Swipe unchanged | Shell focus separate from canvas | Target identity remains static-readable | No overlay crosses target field | PASS |
| pinball | Neon Pinball | Keep ball alive and score | Flippers essential | Drop-target path is secondary | Table Control/Multiball relationship explained | Drain/ball-save rule explicit | Physical table geometry + target states | Tap sides retained | A/D and arrows stay gameplay-owned | Table state stays physical/static | No teaching overlays active table | PASS |
| chrono | Chrono Wave | Rotate through open wall gaps | Rotation essential; EMP/Focus secondary | Gap-read concept first | Focus Wager explained as optional tighter pass | Wall impact points to missed opening | Open-gap geometry + shard/Focus text | Touch controls retained | Shortcuts remain game-owned | Open gap remains visible without motion effects | P17 effects remain compact | PASS |
| matrix | Memory Matrix | Watch then reproduce sequence | Grid input essential; O secondary | WATCH FIRST hint clarifies playback/input split | Overclock next-round risk stated before use | Wrong node/life loss separated from playback | Grid position/order/protocol labels | Grid taps retained | Keyboard matrix mappings preserved | Node identity survives motion reduction | Playback gets no competing teaching motion | PASS |
| drift | Cyber Drift | Stay on road and chain driving events | Steering first; Nitro secondary | Style goals introduced after base driving | Style Routes named consistently | Collision source remains spatial | Road/vehicle/hazard geometry + event text | On-screen controls retained | Shell R/M/Esc remain isolated | Route/event meaning static-readable | High-speed scene receives no active tutorial card | PASS |
| vanguard | Galaxy Vanguard | Survive waves and destroy threats | Move essential; Nova secondary | Combat routing explained in pause | Nova/threat-priority mastery stated | Damage/lethal source remains visible | Ship/enemy/bullet/pickup silhouettes | Touch movement retained | Shell shortcuts stay separate | Threat identity independent of shake | No teaching obscures bullets/bosses | PASS |
| slingshot | Orbital Slingshot | Release into next gravity well | Release is sole essential action | Tangential-release hint explains model | Navigation Missions grouped clearly | Overshoot/collision/failed capture distinguished | Orbit/well/capture/trail + mission text | Tap release unchanged | Space stays gameplay-owned | Transfer geometry remains readable | No exact trajectory prediction added | PASS |
| snake | Cyber Serpent | Grow while avoiding lethal collisions | Directional steering essential | Firewall/portal rules in pause | Phase Thread explained during Ghost Phase | Wall/self/firewall causes separated | Head/body/portal/firewall geometry + text | Swipe/D-pad retained | Arrow/WASD ownership preserved | Grid state remains static-readable | Dense body/firewall state remains legible | PASS |
| rhythm | Neon Rhythm Tapper | Hit heads; hold full tails | Lane keys/touch essential | Hold rule separated from tap rule | Timing & Overdrive relationship stated | MISS/HOLD BREAK differentiated | Lane position/note-tail geometry/judgement text | Lane taps retained | D/F/J/K remain game-owned | Timing line and hold tail remain visible | Certified 70/125/190/230ms windows unchanged | PASS |
| tower | Gravity Tower Jumper | Land upward without lethal miss | Steering essential; micro-boost/Apex secondary | Center-landing concept explained | Apex Drive charge/use stated | Laser vs missed-platform failure separated | Platform/laser/avatar/height/Apex meter | Touch halves retained | Gameplay keys preserved | Hazard/platform meaning static-readable | No teaching overlay covers ascent lane | PASS |
| pacmaze | Cyber Pac-Runner | Clear pellets, avoid dangerous ghosts | Movement essential; Hunt secondary | Power-pellet state introduced first | Hunt Rush risk/reward explained | Ghost collision/frightened expiry clear | Maze/ghost/pellet silhouettes + state behavior | Swipe retained | Arrow/WASD keys preserved | Frightened state has non-motion cues | Maze remains free of active teaching cards | PASS |
| flappyaero | Aero Pulse | Thrust through openings | Single thrust essential; Flow secondary | TAP TO THRUST hint only | Flow Boost earn/use explicit | Contacted gate edge is failure source | Opening geometry/craft/graze/charge text | Tap unchanged | Space stays gameplay-owned | Hint static under reduced motion | Gate opening stays dominant at peak speed | PASS |
| roadcross | Cyber Crosser | Cross rows to checkpoint | Hop directions essential | Safe rows/barges taught in pause | District routing framed as advanced play | Vehicle/train/water causes distinct | Lane/vehicle/train/barge/checkpoint geometry | Tap/swipe retained | Arrow/WASD keys preserved | Lane types remain readable | No extra active HUD competes with traffic | PASS |
| bubblebuster | Orb Cannon | Match 3 and control ceiling | Aim/shoot essential; swap/Burst secondary | Chamber/ceiling rules grouped | Burst & cascade planning stated | Ceiling pressure explains terminal state | Orb position/count/chamber/ceiling labels | Aim/touch retained | A-D/Q/F/Space remain gameplay-owned | Board meaning static-readable | Teaching stays out of active board | PASS |
| astroblaster | Astro Blaster 360 | Control inertia and destroy threats | Rotate/thrust/fire essential; Warp secondary | Newtonian control concept concise | Newtonian Combat framed as skill path | Impact source remains visible | Orientation/trajectory/silhouette/HUD cues | Existing mobile controls retained | Keys preserved | Meaning independent of camera motion | No teaching obscures 360° threats | PASS |
| laserrope | Laser Rope Reflex | Match LOW/HIGH/DUAL with body response | Jump vs slide explicitly separated | Mode equation first-run hint | Redline earn/use explained | Beam contact + mode identifies wrong response | Mode text + beam height/body state | Jump/slide buttons unchanged | Keys remain gameplay-owned | Mode words survive motion reduction | P16 0.38s warning floor preserved | PASS |
| blockdrop | Cyber Block Drop | Complete lines without lockout | Move/rotate/drop essential; Hold secondary | Hold/Next planning in pause | Tetris & B2B hierarchy stated | Lockout board remains visible | Piece/ghost/board/Hold/Next/text cues | Existing touch controls retained | Keyboard bindings preserved | Board state remains static-readable | No teaching overlays active board | PASS |
| knifetarget | Knife Target | Throw into open arcs | Single throw action essential | Open-arc rule first | Razor Marks optional precision explained | Collision point explains unsafe throw | Blade/core/mark geometry + stage text | Tap unchanged | Space remains gameplay-owned | Core state static-readable | No trajectory solution added | PASS |
| airhockey | Neon Puck Smash | Defend goal and outscore AI | Mallet movement essential; Power secondary | Defense-before-offense guidance | Power Play earn/use named | Conceded goal spatially distinct | Goal/mallet/puck/score/timer/Power cues | Touch mallet retained | WASD/Space/F preserved | Goal/Power meaning static-readable | No teaching overlays puck field | PASS |
| neonrail | Neon Rail Shift | Follow safe rail phrases | Shift essential; Phase/Surge secondary | One-phrase-ahead guidance in pause | Phase & Surge names consistent | Blocked route stays visible on hit | Rail/blocker/phrase/core/text geometry | Tap lane retained | A/D/arrows/Space/Shift preserved | Phrase structure survives reduced motion | P17 smaller effects preserve route readability | PASS |

## Color and contrast

P18 does not remove the neon palette. Instead, the teaching profiles explicitly document the non-color cues already carrying critical meaning: geometry, position, silhouettes, labels, judgement words, meters, lane structure, and state text. The structured pause/result layer uses high-contrast text and borders and never becomes the sole carrier of gameplay state.

The priority color-sensitive cases are deliberately redundant: Reaction uses HOLD/directional text; Laser Rope uses LOW/HIGH/DUAL words plus beam height; Pulse and Rhythm use judgement words plus timing geometry; Stack uses placement geometry/cut edges plus PERFECT/Focus text; Memory Matrix uses fixed grid position/order; Gravity uses body/beacon/contract geometry/text; Cyber Serpent uses grid/head/body/firewall structure.

## Touch, keyboard and modal focus

P18 adds explicit accessible names to the shell's Back, Restart, Pause/Resume, Sound, Fullscreen, and Haptics controls. Coarse-pointer shell targets receive a 42px floor while pause/result actions retain a 44px minimum. The smaller shell floor is intentional to avoid making the 320px toolbar unusable while still approaching common mobile target guidance.

Pause and result overlays are promoted to modal dialog semantics with labelled headings, initial focus, bounded Tab trapping, and cleanup. Closing Pause restores focus to the Pause control. Gameplay-owned keyboard bindings remain untouched.

The game shell already scopes `touch-action: none` and `overscroll-behavior: none` to the active stage; P18 does not disable browser zoom globally.

## Reduced motion, muted audio and haptics

P17 remains the authoritative reduced-motion implementation. P18's micro-hints have an explicit static reduced-motion branch, and all P18 teaching information is text/shape/position based rather than motion-dependent.

The P18 teaching runtime has no dependency on Web Audio or `navigator.vibrate`. Objectives, controls, mastery, danger, failure rules, and next-attempt guidance therefore remain present with sound muted or haptics unavailable/disabled. Existing P17 audio/haptic safety contracts continue to run independently.

## Manual new-player protocol

Automation cannot prove that a human understands a game. For a tester unfamiliar with a game, play one short attempt and record answers to:

1. What was the objective?
2. What were the main controls?
3. What killed or stopped you?
4. What increased your score or progress?
5. Did you notice an advanced mechanic?
6. Could you tell what to try next?

A game does not receive experiential P18 sign-off if the tester fundamentally misunderstands the core loop despite the objective, first-run hint (where present), and pause teaching surface.

## Expert readability protocol

At later P16-certified pressure, verify manually:

- hazards remain parseable;
- telegraphs arrive before decisions;
- mastery UI does not dominate the playfield;
- score/time state remains readable without forcing eye travel;
- warnings remain distinct;
- P17 polish remains subordinate to gameplay information.

High-speed games receive no new persistent active-play teaching panels.

## Accessibility boundary

P18 improves semantic shell controls, modal focus, teaching structure, target sizing, reduced-motion continuity, and non-color redundancy. It **does not claim full WCAG conformance**, and it does not claim that realtime canvas games have become fully screen-reader playable. That would require fundamentally different interaction models for several games.

Menus, shell controls, pause teaching, result guidance, settings, and game names are the practical semantic boundary improved here. Canvas gameplay remains primarily visual/realtime where that is intrinsic to the mechanic.

## No grade inflation

P18 preserves the P15 historical distribution:

- **S: 5**
- **A: 20**
- **B: 7**
- **C/D/F: 0**

P18 produces clarity/accessibility evidence for later promotion phases; it does not award ranks.

## Exit decision

**P18 source/runtime certification passes only when `quality:gameplay-p18`, `quality:browser-p18`, every P0–P17 gate, P3/P17 browser matrices, TypeScript, Worker checks, production/Pages builds, MA3, and MA4 all pass.**

The browser audit covers all 32 games at desktop 1280×800, mobile 390×844 with reduced motion, and small-mobile 320×568 with reduced motion. Subjective new-player comprehension, expert readability, real-device touch comfort, and full accessibility remain explicit manual acceptance activities rather than fake automated scores.
