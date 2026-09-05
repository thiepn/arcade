export const P23_S_THRESHOLD = 55;

export type P23Category = 'core' | 'agency' | 'progression' | 'replay' | 'feel' | 'fairnessUx';
export type P23GameId = 'typerush' | 'perfectstop' | 'reaction' | 'pulse' | 'laserrope' | 'flappyaero' | 'stack';

export interface P23Scorecard {
  core: number;
  agency: number;
  progression: number;
  replay: number;
  feel: number;
  fairnessUx: number;
}

export interface P23PromotionRecord {
  id: P23GameId;
  title: string;
  historical: P23Scorecard;
  preP23: P23Scorecard;
  final: P23Scorecard;
  priorEvidence: Partial<Record<P23Category, readonly string[]>>;
  p23Evidence: Partial<Record<P23Category, readonly string[]>>;
  adversarialReview: readonly string[];
}

export const p23Total = (score: P23Scorecard) =>
  score.core + score.agency + score.progression + score.replay + score.feel + score.fairnessUx;

export const P23_PROMOTIONS: readonly P23PromotionRecord[] = [
  {
    id: 'typerush',
    title: 'Type Rush',
    historical: { core: 8, agency: 8, progression: 9, replay: 8, feel: 7, fairnessUx: 8 },
    preP23: { core: 8, agency: 8, progression: 9, replay: 8, feel: 8, fairnessUx: 9 },
    final: { core: 9, agency: 9, progression: 10, replay: 9, feel: 9, fairnessUx: 9 },
    priorEvidence: {
      feel: ['P17 gives typing actions immediate acknowledgement and elevates urgent/special high-value clears above routine words.'],
      fairnessUx: ['P16 certifies the four-wave 2300→1250ms spawn, 3→5 word ceiling and 0.90→1.16 speed envelope; P18 teaches danger-line prioritization and keyboard/touch typing.'],
    },
    p23Evidence: {
      core: ['Directive Relays connect target selection, urgent position and special-word identity into one coherent typing/priority loop.'],
      agency: ['The first real completed target commits CONTROL versus VOLATILE routing, so selecting which visible word to finish has consequences across several clears.'],
      progression: ['BOOT, SURGE, OVERCLOCK and REDLINE retain their certified pace while using wave-specific authored relay identities and escalating mixed requirements.'],
      replay: ['Two relay identities per wave plus CONTROL/VOLATILE branches vary fresh runs without changing word legality or wave pacing.'],
      feel: ['Real relay steps and completions now produce game-native score/audio hierarchy on top of P17 ordinary typing feedback.'],
    },
    adversarialReview: [
      'No new typing control or auto-complete path was added; ordinary typing remains sufficient.',
      'Relay requirements observe actual completed words and danger position rather than synthetic checklist state.',
      'Fairness/UX stays 9 rather than 10 because physical keyboard variance and high-density reading remain real experiential constraints.',
    ],
  },
  {
    id: 'perfectstop',
    title: 'Perfect Stop',
    historical: { core: 8, agency: 7, progression: 9, replay: 8, feel: 8, fairnessUx: 8 },
    preP23: { core: 8, agency: 7, progression: 9, replay: 8, feel: 9, fairnessUx: 9 },
    final: { core: 9, agency: 9, progression: 10, replay: 9, feel: 9, fairnessUx: 9 },
    priorEvidence: {
      feel: ['P17 differentiates stop input, near/PERFECT/Encore results and poor-stop diagnosis without changing timing.'],
      fairnessUx: ['P16 certifies seven authored sectors and qualified optional Encore; P18 leaves the stopped marker against the target so error direction remains visible.'],
    },
    p23Evidence: {
      core: ['Dual-beacon sectors deepen the same single precision-stop action instead of adding a second mode.'],
      agency: ['Each core stop can deliberately pursue the normal beacon or harder precision beacon through timing alone.','Precision-beacon success changes route identity and can accelerate existing Master Encore qualification, so the target choice affects later run structure.'],
      progression: ['Two-stop Beacon Routes connect core sectors into an authored mastery arc while preserving all seven core and three Encore patterns.'],
      replay: ['Calibration versus Edge routing changes target intent across fresh runs without randomizing the certified sector grammar.'],
    },
    adversarialReview: [
      'Agency 9 is earned by target choice plus downstream Encore consequence; a score-only second target would not have justified the second point.',
      'Normal beacons remain the ordinary route and the helper explicitly prevents overlapping scoring windows.',
      'Feel remains 9 because P23 does not claim the timing action itself became flagship-10 tactile quality.',
    ],
  },
  {
    id: 'reaction',
    title: 'Reaction',
    historical: { core: 8, agency: 8, progression: 9, replay: 7, feel: 7, fairnessUx: 8 },
    preP23: { core: 8, agency: 8, progression: 9, replay: 7, feel: 8, fairnessUx: 9 },
    final: { core: 9, agency: 9, progression: 10, replay: 9, feel: 9, fairnessUx: 9 },
    priorEvidence: {
      feel: ['P17 makes valid response, inhibition/overtime success and FALSE START/wrong/TIMEOUT feedback semantically distinct.'],
      fairnessUx: ['P16 fixes the combined core+overtime scheduler and preserves 260ms launch and 320ms inhibition floors; P18 separates cue classification from speed.'],
    },
    p23Evidence: {
      core: ['Reaction Circuits compose simple, choice, inhibition and mixed cues into a deliberate read/choose/control gauntlet.'],
      agency: ['SPEED versus CONTROL is selected only on safe result screens and determines the ordering of the next existing cue pair.'],
      progression: ['Three player-selected circuit blocks bridge the eight core rounds into the already-qualified overtime finale.'],
      replay: ['Circuit pair ordering creates authored structural variation across runs.','The player chooses SPEED or CONTROL for each pair, making fresh-run variation intentional rather than purely random wait timing.'],
      feel: ['Clean two-round circuit completion receives a distinct score/audio payoff above ordinary correct responses.'],
    },
    adversarialReview: [
      'Circuit choice is never active during WAITING, DECOY or READY, so it cannot contaminate reaction timing.',
      'All eight original core configurations still appear exactly once; P23 only changes pair order.',
      'Overtime remains qualification-gated and uses the P16-correct combined session lookup.',
    ],
  },
  {
    id: 'pulse',
    title: 'Pulse',
    historical: { core: 8, agency: 7, progression: 8, replay: 7, feel: 9, fairnessUx: 8 },
    preP23: { core: 8, agency: 7, progression: 8, replay: 7, feel: 9, fairnessUx: 9 },
    final: { core: 9, agency: 9, progression: 10, replay: 9, feel: 9, fairnessUx: 9 },
    priorEvidence: {
      fairnessUx: ['P16 preserves six groove patterns, 155 BPM cap and 8/18/28px judgement; P18 makes ordinary timing and Sync Wager state explicit.'],
    },
    p23Evidence: {
      core: ['Groove Paths turn the six existing pulse patterns into recognizable multi-beat phrases while keeping one timed hit as the core action.'],
      agency: ['A/D or Left/Right queues the next path at a separate decision channel from the beat tap.','Path selection interacts with the independently earned Sync Wager decision, creating two consequential but bounded risk choices without changing judgement legality.'],
      progression: ['Four-beat authored phrases introduce and combine outward, inward, syncopated and double-time patterns.','Path completion advances through FLOW, DRIVE, ECHO and REDLINE families instead of relying only on rising combo BPM.'],
      replay: ['Left/right path branching changes the next authored phrase.','Sync Wager timing within different path compositions creates fresh-run strategic texture on top of the branch choice.'],
    },
    adversarialReview: [
      'Feel remains the historical 9; P23 intentionally does not award presentation points to a game that already had strong timing feel.',
      'Path controls do not alter the 8/18/28px judgement windows or 155 BPM cap.',
      'The path choice has touch buttons and keyboard parity and is visually separated from the central beat action.',
    ],
  },
  {
    id: 'laserrope',
    title: 'Laser Rope Reflex',
    historical: { core: 8, agency: 7, progression: 8, replay: 7, feel: 8, fairnessUx: 8 },
    preP23: { core: 8, agency: 7, progression: 8, replay: 7, feel: 9, fairnessUx: 9 },
    final: { core: 9, agency: 9, progression: 10, replay: 9, feel: 9, fairnessUx: 9 },
    priorEvidence: {
      feel: ['P17 strengthens jump/slide, Redline/evasion and beam-contact hierarchy while keeping beam phase untouched.'],
      fairnessUx: ['P16 permanently enforces a geometric 0.38s minimum warning before LOW/HIGH/DUAL mode changes can become relevant.'],
    },
    p23Evidence: {
      core: ['Laser Choreographies make the existing jump/slide reading vocabulary form recognizable multi-step sequences.'],
      agency: ['Known upcoming choreography steps let the player plan jump versus slide rather than treating each mode as isolated.','Redline can now be deliberately spent inside a known choreography for score/risk while remaining unnecessary for ordinary survival.'],
      progression: ['Four choreography families layer LOW/HIGH/DUAL grammar while preserving the existing HIGH and DUAL streak eligibility.','Progression now comes from sequence composition as well as the already-certified sweep-speed curve.'],
      replay: ['Distinct authored choreography orders vary fresh runs.','Direction reversals, Fever and optional Redline change how the same learned choreography must be executed.'],
    },
    adversarialReview: [
      'No fourth beam mode, projectile, lane or combat mechanic was added.',
      'HIGH remains gated beyond streak 6 and DUAL at streak 12; ineligible desired steps wait rather than bypassing progression.',
      'Every applied mode change still calls the unchanged geometric warning guard.',
    ],
  },
  {
    id: 'flappyaero',
    title: 'Aero Pulse',
    historical: { core: 8, agency: 7, progression: 8, replay: 7, feel: 8, fairnessUx: 8 },
    preP23: { core: 8, agency: 7, progression: 8, replay: 7, feel: 9, fairnessUx: 9 },
    final: { core: 9, agency: 9, progression: 10, replay: 9, feel: 9, fairnessUx: 9 },
    priorEvidence: {
      feel: ['P17 elevates flap/gate/star/graze and Flow milestones while protecting high-speed gate geometry.'],
      fairnessUx: ['P16 bounds base speed at 280, gap at >=90px, spacing at 200–240px and makes Flow x1.18 explicitly voluntary.'],
    },
    p23Evidence: {
      core: ['Flight Lines make three ordinary gates read as one spatial flight phrase without changing the flap mechanic.'],
      agency: ['The player selects HIGH, CENTER or LOW mastery traces through ordinary altitude control.','Flow Boost timing becomes a deliberate score/risk decision around known line geometry while remaining optional for every legal gate clear.'],
      progression: ['RISE, FALL, WEAVE and LEVEL lines create authored multi-gate spatial development.','Mirrored line cycles combine the same legal geometry into later mastery variation rather than only shrinking gaps.'],
      replay: ['Trace choice provides three optional lines through each authored gate phrase.','Line rotation/mirroring plus optional Flow timing gives fresh-run variation without adding obstacle families.'],
    },
    adversarialReview: [
      'Trace markers sit inside the ordinary safe gap and never narrow collision geometry.',
      'Moving gates move their trace markers by the exact same vertical delta as the gap.',
      'A deterministic helper bounds authored line center deltas, while P16 speed/gap/spacing constants remain unchanged.',
    ],
  },
  {
    id: 'stack',
    title: 'Stack',
    historical: { core: 8, agency: 7, progression: 7, replay: 7, feel: 8, fairnessUx: 8 },
    preP23: { core: 8, agency: 7, progression: 7, replay: 7, feel: 9, fairnessUx: 9 },
    final: { core: 9, agency: 9, progression: 9, replay: 9, feel: 10, fairnessUx: 9 },
    priorEvidence: {
      feel: ['P17 differentiates placement contact, cuts, PERFECT, Focus and failure while preserving one-button timing.'],
      fairnessUx: ['P16 ties speed only to physical block count with +0.08/block and a +4.5 cap; Focus score cannot accelerate the game.'],
    },
    p23Evidence: {
      core: ['Tower Blueprints extract deliberate geometry from the same one-tap overlap placement rather than adding another action system.'],
      agency: ['Real left/right offset on the first qualifying placement commits mirrored blueprint direction.','The existing Focus resource becomes a deliberate blueprint-precision decision while ordinary sliced placements remain legal.'],
      progression: ['CENTERLINE, OFFSET, BRIDGE, FOCUS SPIRE and SKYLINE form an authored tower mastery arc.','Blueprint reward difficulty scales through real changing tower width/altitude while base speed remains the P16 physical-block curve.'],
      replay: ['Mirrored blueprint branches change desired placement relationships across runs.','Changing tower geometry, recovery after cuts and optional Focus timing make the same blueprint demand context-sensitive execution.'],
      feel: ['Blueprint step/completion feedback adds a distinct geometric mastery tier above P17 ordinary/perfect placement.','Focus-perfect, blueprint completion, tower milestone and failure now have separate bounded audio/haptic/visual hierarchy without a second feedback framework.'],
    },
    adversarialReview: [
      'Stack remains one-tap placement plus the already-existing optional Focus control; no steering, rotation, inventory or powerups were introduced.',
      'A missed blueprint only resets mastery and never changes width loss, speed or game-over rules.',
      'Feel 10 is reserved for Stack because P17 tactile placement hierarchy plus P23 geometry-specific mastery creates a uniquely complete feedback ladder; no other P23 game receives a speculative 10.',
    ],
  },
] as const;
