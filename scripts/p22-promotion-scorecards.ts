export type P22Category = 'core' | 'agency' | 'progression' | 'replay' | 'feel' | 'fairnessUx';

export interface P22Scorecard {
  core: number;
  agency: number;
  progression: number;
  replay: number;
  feel: number;
  fairnessUx: number;
}

export interface P22PromotionRecord {
  id: 'snake' | 'orbit' | 'neonrail' | 'slingshot' | 'bubblebuster' | 'matrix' | 'knifetarget' | 'roadcross';
  title: string;
  historical: P22Scorecard;
  preP22: P22Scorecard;
  final: P22Scorecard;
  evidence: Partial<Record<P22Category, readonly string[]>>;
  adversarialReview: readonly string[];
}

export const P22_S_THRESHOLD = 55;

export const p22Total = (score: P22Scorecard) =>
  score.core + score.agency + score.progression + score.replay + score.feel + score.fairnessUx;

export const P22_PROMOTIONS: readonly P22PromotionRecord[] = [
  {
    id: 'snake',
    title: 'Cyber Serpent',
    historical: { core: 8, agency: 9, progression: 9, replay: 9, feel: 7, fairnessUx: 8 },
    preP22: { core: 8, agency: 9, progression: 9, replay: 9, feel: 8, fairnessUx: 9 },
    final: { core: 9, agency: 9, progression: 10, replay: 10, feel: 8, fairnessUx: 9 },
    evidence: {
      core: [
        'P22 makes the existing Ghost Phase and Phase Thread relationship visible as a named chapter objective instead of leaving the strongest mastery beat as an isolated bonus.',
        'Chapter completion returns only score through the existing Phase Thread scoring function; the snake, portal, firewall and collision loop remains authoritative.',
      ],
      progression: [
        'Five authored Phase Thread Chapters move from two-cell introductory threading to six-cell late mastery while requiring progressively developed firewall stages.',
        'Chapter rotation is run-local and never changes the certified Ghost Phase duration cap or ordinary survival route.',
      ],
      replay: [
        'Chapter order gives repeated runs recognizable tactical targets within the existing portal/firewall vocabulary rather than adding a new mode.',
        'The same chapter can resolve through different physical firewall cells because the existing unique-cell Phase Thread tracker remains the source of truth.',
      ],
      feel: [
        'P17 already upgraded Serpent success/failure hierarchy while preserving game-native snake/firewall feedback and reduced-motion meaning.',
        'P22 deliberately leaves Feel at 8 rather than manufacturing another point from the chapter HUD.',
      ],
      fairnessUx: [
        'P18 clarifies firewall, Ghost Phase and control meaning across keyboard/touch play, and P16 preserves bounded run pacing.',
        'P22 keeps the three-cell extension cadence, six-tick extension and 90-tick Ghost Phase cap exactly unchanged.',
      ],
    },
    adversarialReview: [
      'Agency remains 9 because P22 changes tactical composition rather than adding a new input or a new moment-to-moment action.',
      'Feel remains 8: the chapter panel is information, not evidence of flagship tactile richness.',
      'Core, Progression and Replay rise separately only because P22 integrates existing mastery into the identity, creates an authored run arc, and adds repeatable tactical targets without altering survival fairness.',
    ],
  },
  {
    id: 'orbit',
    title: 'Orbit',
    historical: { core: 8, agency: 9, progression: 9, replay: 8, feel: 8, fairnessUx: 8 },
    preP22: { core: 8, agency: 9, progression: 9, replay: 8, feel: 9, fairnessUx: 9 },
    final: { core: 9, agency: 9, progression: 10, replay: 9, feel: 9, fairnessUx: 9 },
    evidence: {
      core: [
        'P22 binds the existing crystal-route and threat-formation systems into one named Constellation objective, making collection, lane control and threat reading reinforce the same core loop.',
        'Constellations select only the four existing route names and four existing safe-lane formation definitions.',
      ],
      progression: [
        'Six authored Constellations deliberately pair route identities with formations rather than letting the two systems remain parallel and independently cycling.',
        'The composition becomes visible in the run HUD while the existing formation cadence, warning, resolve and grace windows remain unchanged.',
      ],
      replay: [
        'A route can map to more than one legal formation pairing, so recognizable constellation identities still vary across repeated runs.',
        'Repeated play asks the player to connect route execution with a subsequent formation read without introducing another mode or persistent system.',
      ],
      feel: [
        'P17 differentiates route, graze, formation and failure events while retaining Orbit-specific feedback and compact movement vocabulary.',
        'The score remains 9 rather than 10 because P22 does not pretend composition alone changes raw control feel.',
      ],
      fairnessUx: [
        'P16/P18 certify controls, hazard readability and lane parity; each original threat formation advertises exactly one safe lane.',
        'P22 preserves the 1.2-second warning, 7.2-second cooldown, 1.7-second resolve and 2.0-second grace values.',
      ],
    },
    adversarialReview: [
      'Agency stays 9 because the player still uses the same Pulse/lane/reversal vocabulary.',
      'Replay rises only one point: six pairings improve variation, but Orbit remains intentionally compact rather than becoming an expansive mode-based game.',
      'No promotion point comes from making formations faster or less readable.',
    ],
  },
  {
    id: 'neonrail',
    title: 'Neon Rail Shift',
    historical: { core: 8, agency: 9, progression: 9, replay: 8, feel: 8, fairnessUx: 8 },
    preP22: { core: 8, agency: 9, progression: 9, replay: 8, feel: 9, fairnessUx: 9 },
    final: { core: 9, agency: 9, progression: 10, replay: 9, feel: 9, fairnessUx: 9 },
    evidence: {
      core: [
        'P22 turns the existing safe-lane phrases, Phase opportunities and Surge mastery into one visible Rail Sequence rhythm rather than isolated pattern rewards.',
        'The sequence remains entirely composed from SWITCHBACK, SLALOM, HOLD_BREAK and CENTER_CUT phrase builders.',
      ],
      progression: [
        'Six authored three-phrase sequences create eighteen-row tactical sentences with establish, weave, hold and finale structure.',
        'Sequence completion is cashed only through the existing Route Mastery milestone, keeping the run arc inside the original combo/Surge economy.',
      ],
      replay: [
        'Six sequence identities reuse the existing lane-relative phrase geometry, so the same learned structure adapts naturally to different starting safe lanes.',
        'Repeated runs gain recognizable composition without a second mode or permanent unlock loop.',
      ],
      feel: [
        'P17 already strengthens core, Phase, mastery, Surge and collision hierarchy without hiding lanes at speed.',
        'P22 leaves Feel at 9 because authored sequencing is not double-counted as tactile polish.',
      ],
      fairnessUx: [
        'P16 guarantees adjacent reachable safe lanes, bounded obstacle density and controlled speed/spawn escalation.',
        'P22 keeps two Surge charges, five-second duration, 1.18 speed multiplier, 2x score multiplier and the existing Phase opportunity rules unchanged.',
      ],
    },
    adversarialReview: [
      'Agency remains 9: Phase and Surge already existed before P22.',
      'The three P22 points are limited to identity integration, authored run progression and repeated sequence variation.',
      'No point is earned by tightening reaction windows or increasing Surge risk.',
    ],
  },
  {
    id: 'slingshot',
    title: 'Orbital Slingshot',
    historical: { core: 8, agency: 8, progression: 9, replay: 9, feel: 8, fairnessUx: 8 },
    preP22: { core: 8, agency: 8, progression: 9, replay: 9, feel: 9, fairnessUx: 9 },
    final: { core: 9, agency: 8, progression: 10, replay: 10, feel: 9, fairnessUx: 9 },
    evidence: {
      core: [
        'P22 connects the existing sector Navigation Missions into named two-sector Mission Arcs, so lock-on timing, stardust routes and capture quality now form a coherent traversal identity.',
        'Mission Arc rewards return through the existing mission reward path and never alter launch or gravity physics.',
      ],
      progression: [
        'The original four-sector mission schedule is preserved while adjacent mission pairs receive an explicit multi-sector arc and completion beat.',
        'Arc completion requires clearing the first mission before the second, producing a longer authored run objective without gating sector warps.',
      ],
      replay: [
        'Four rotating arc labels make successive two-sector chunks feel intentional while the underlying launch/capture outcomes remain physically variable.',
        'The arc streak is score-only and contained within the current run rather than adding retention infrastructure.',
      ],
      feel: [
        'P17 improves launch, capture, mission and failure hierarchy while preserving the game-native orbital motion and haptics.',
        'P22 keeps Feel at 9 and does not count an extra HUD as another point.',
      ],
      fairnessUx: [
        'P16/P18 preserve fixed-step orbital/free-flight timing, pause-safe launch controls, resize continuity and failure explanation.',
        'P22 retains the exact four mission target values and does not change gravity wells, launch speed or life rules.',
      ],
    },
    adversarialReview: [
      'Agency intentionally stays 8; P22 does not invent another steering/action input just to close the score gap.',
      'Replay reaches 10 only because the already-strong mission/physics variation now has a repeatable multi-sector composition layer, not because a new replay system exists.',
      'Ordinary sector completion remains fully valid when the Mission Arc is ignored.',
    ],
  },
  {
    id: 'bubblebuster',
    title: 'Orb Cannon',
    historical: { core: 8, agency: 9, progression: 8, replay: 8, feel: 8, fairnessUx: 8 },
    preP22: { core: 8, agency: 9, progression: 8, replay: 8, feel: 9, fairnessUx: 9 },
    final: { core: 9, agency: 10, progression: 9, replay: 9, feel: 9, fairnessUx: 9 },
    evidence: {
      core: [
        'P22 makes current/next chamber planning, one-swap decisions, drops and Burst usage part of rotating Salvo Plans instead of separate tactical conveniences.',
        'Plan resolution uses real successful swap, Burst-arm and match/drop events from the existing Orb Cannon loop.',
      ],
      agency: [
        'Six Salvo Plans make the existing decision to swap, preserve a chamber, bank/spend Burst, or pursue a drop consequential to an explicit short-term objective.',
        'No new input is added: Q swap, earned Burst and the same shot control remain the complete action vocabulary.',
      ],
      progression: [
        'Plans progress from simple chamber reading and drops into combo/Burst/swap combinations, creating a deliberate run-local tactical sequence.',
        'Plan completion adds score only and never grants colors, clears the board, slows ceiling pressure or awards extra Burst charges.',
      ],
      replay: [
        'The six-plan cycle changes which existing board opportunity is most valuable without changing board legality or manufacturing solutions.',
        'Repeated runs therefore ask different tactical questions from genuinely different generated boards.',
      ],
      feel: [
        'P17 already distinguishes normal matches, cascades, power events and failure while preserving fast cannon response.',
        'P22 keeps Feel at 9 and uses the existing P17 mastery channel for plan completion.',
      ],
      fairnessUx: [
        'P16 preserves ceiling/resource economy and P18 teaches next chamber, swap, Burst and failure state.',
        'P22 keeps max Burst charges 2, starting charges 1, earn combo 4, earn drop count 4, one swap per turn and no swap/arm while a bubble is flying.',
      ],
    },
    adversarialReview: [
      'Agency reaches 10 only because the plans repeatedly alter the consequence of already-available chamber/Burst decisions; no point is awarded for simply exposing another label.',
      'Progression and Replay remain 9 rather than 10 because the board and plan vocabulary are intentionally bounded.',
      'No Salvo Plan may manipulate the color queue or survival pressure to guarantee itself.',
    ],
  },
  {
    id: 'matrix',
    title: 'Memory Matrix',
    historical: { core: 8, agency: 9, progression: 9, replay: 8, feel: 7, fairnessUx: 8 },
    preP22: { core: 8, agency: 9, progression: 9, replay: 8, feel: 8, fairnessUx: 9 },
    final: { core: 9, agency: 10, progression: 10, replay: 9, feel: 8, fairnessUx: 9 },
    evidence: {
      core: [
        'P22 turns the four existing transform protocols and optional Overclock into one visible Protocol Suite identity.',
        'Rounds 1–8 retain the original two-round protocol foundation before the authored suite cycle begins.',
      ],
      agency: [
        'The HUD exposes the current and next protocol, making the existing O-key Overclock decision meaningfully contextual rather than blind risk taking.',
        'Consecutive successful Overclock clears raise only the score-only suite completion payoff; ordinary clears remain valid.',
      ],
      progression: [
        'Six four-round suites compose only FORWARD, REVERSE, MIRROR and REVERSE_MIRROR into contrast, alternation and synthesis arcs.',
        'The original first eight rounds remain unchanged, creating foundation followed by authored mastery suites.',
      ],
      replay: [
        'Suite cycling creates learnable higher-level patterns over random underlying node sequences, so repeated runs vary at both sequence and protocol-composition levels.',
        'No fifth transform or separate mode is introduced.',
      ],
      feel: [
        'P17 raises the historical presentation-energy weakness from 7 to 8 while the grid remains intentionally cognitive rather than spectacle-driven.',
        'P22 explicitly leaves Feel at 8.',
      ],
      fairnessUx: [
        'P18 clarifies protocol and Overclock controls while the existing playback speed floor remains 140 ms.',
        'P22 keeps Overclock at +2 nodes, 0.78 playback scale, 1.5x step score, 1.8x clear score and manual pattern replay disabled only while active.',
      ],
    },
    adversarialReview: [
      'Feel stays 8: Protocol Suites are structure, not sensory polish.',
      'Agency reaches 10 because next-protocol knowledge changes when the existing Overclock action is rational; no new input is counted.',
      'Progression and Replay are separated: authored suite ordering is progression, while random node sequences inside rotating suites support replay variation.',
    ],
  },
  {
    id: 'knifetarget',
    title: 'Knife Target',
    historical: { core: 8, agency: 8, progression: 9, replay: 8, feel: 8, fairnessUx: 8 },
    preP22: { core: 8, agency: 8, progression: 9, replay: 8, feel: 9, fairnessUx: 9 },
    final: { core: 9, agency: 9, progression: 10, replay: 9, feel: 9, fairnessUx: 9 },
    evidence: {
      core: [
        'P22 connects six authored stage identities and the existing Razor Mark precision system into a named six-stage Razor Route arc.',
        'Route selection occurs inside the same safe Razor window instead of adding a separate control or game mode.',
      ],
      agency: [
        'The first Razor hit of a six-stage cycle uses the hit side within the certified tolerance to commit to PRECISION TRACE or TEMPO TRACE.',
        'Both routes use the same throw action and safe target geometry, so player precision—not a menu—selects the tactical objective.',
      ],
      progression: [
        'Each route spans selected stages of the established STEADY/BACKSPIN/PULSE/SHIELD/PRECISION/BOSS six-stage cycle and culminates at the Boss Core.',
        'The route never changes stage speed, knife count, shield count, collision rules or life economy.',
      ],
      replay: [
        'Two route variants make the same six-stage cycle reward different precision timing while the existing generated target geometry still varies per run.',
        'Missed route marks remove only the optional score opportunity; ordinary safe throws remain valid.',
      ],
      feel: [
        'P17 already improves stick, crystal, Razor, rush and failure hierarchy around a strong direct aiming model.',
        'P22 leaves Feel at 9 instead of double-counting route completion feedback.',
      ],
      fairnessUx: [
        'The existing Razor target finder guarantees blade/shield clearance and P18 explains aiming/failure across pointer and keyboard play.',
        'P22 preserves the 0.09-radian tolerance floor, 5.2 speed cap, 14-knife cap and five-preblade cap.',
      ],
    },
    adversarialReview: [
      'Agency rises only 8→9; two route notches deepen intent but do not create an entirely new control vocabulary.',
      'No precision target is moved outside the original safe target or original tolerance.',
      'The stage arc remains the core progression authority; P22 merely connects its existing mastery beats.',
    ],
  },
  {
    id: 'roadcross',
    title: 'Cyber Crosser',
    historical: { core: 8, agency: 8, progression: 9, replay: 8, feel: 8, fairnessUx: 8 },
    preP22: { core: 8, agency: 8, progression: 9, replay: 8, feel: 9, fairnessUx: 9 },
    final: { core: 9, agency: 9, progression: 10, replay: 9, feel: 9, fairnessUx: 9 },
    evidence: {
      core: [
        'P22 makes horizontal lane choice part of each district identity through optional three-waypoint District Routes instead of leaving lateral movement mostly reactive.',
        'Routes coexist with the original traffic, train, river, checkpoint and forward-distance loop.',
      ],
      agency: [
        'The same directional movement now has an optional route-planning consequence: reaching the first left/right waypoint commits the current district route.',
        'No route-selection button, immunity, traffic freeze or spawn manipulation is introduced.',
      ],
      progression: [
        'Each of the four existing eight-row district identities now supplies two mirrored route profiles and a checkpoint completion payoff.',
        'Route streaks are bounded, score-only and reset when a district route is missed.',
      ],
      replay: [
        'Mirrored district routes make repeated authored districts ask for different lateral positioning while procedural traffic/log timing remains intact.',
        'Ignoring a route leaves ordinary distance/checkpoint progression unchanged.',
      ],
      feel: [
        'P17 already strengthens hop, checkpoint, collision and district-transition hierarchy while retaining direct grid movement.',
        'P22 leaves Feel at 9 rather than claiming waypoint labels change raw movement response.',
      ],
      fairnessUx: [
        'P16/P6 certify district reaction windows, 9-column mobile geometry and non-farmable collision immunity.',
        'P22 advances route state only when the existing canAcceptRoadCrossMove gate accepts a real move.',
      ],
    },
    adversarialReview: [
      'Agency reaches only 9 because lateral route planning deepens existing choices but does not add a new action.',
      'Route waypoints are optional score goals; they never control traffic, trains, logs or survival.',
      'Progression and Replay points come from district-authored waypoint arcs and mirrored repeat variation, not from generic shell polish.',
    ],
  },
] as const;
