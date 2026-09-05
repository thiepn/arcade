export type P21Category = 'core' | 'agency' | 'progression' | 'replay' | 'feel' | 'fairnessUx';

export interface P21Scorecard {
  core: number;
  agency: number;
  progression: number;
  replay: number;
  feel: number;
  fairnessUx: number;
}

export interface P21PromotionRecord {
  id: 'breakout' | 'airhockey' | 'tower' | 'pacmaze' | 'oneline' | 'chrono';
  title: string;
  historical: P21Scorecard;
  preP21: P21Scorecard;
  final: P21Scorecard;
  evidence: Partial<Record<P21Category, readonly string[]>>;
  adversarialReview: readonly string[];
}

export const P21_S_THRESHOLD = 55;

export const p21Total = (score: P21Scorecard) =>
  score.core + score.agency + score.progression + score.replay + score.feel + score.fairnessUx;

export const P21_PROMOTIONS: readonly P21PromotionRecord[] = [
  {
    id: 'breakout',
    title: 'Breakout Mini',
    historical: { core: 9, agency: 9, progression: 9, replay: 9, feel: 8, fairnessUx: 8 },
    preP21: { core: 9, agency: 9, progression: 9, replay: 9, feel: 9, fairnessUx: 9 },
    final: { core: 9, agency: 9, progression: 10, replay: 9, feel: 9, fairnessUx: 9 },
    evidence: {
      progression: [
        'P21 layers eight authored round identities over the unchanged four-contract rotation, creating a deliberate control→power→armor→special two-act arc.',
        'Later identities tighten only existing optional contract targets while ordinary brick-field clears, paddle physics and temporary powerups remain valid.',
      ],
      feel: [
        'P17 differentiates routine brick hits, stronger clears and mastery events while retaining game-native paddle/ball response.',
        'The bounded shared feel layer is reduced-motion safe and does not alter ball simulation or collision outcomes.',
      ],
      fairnessUx: [
        'P16 certifies bounded temporary powerups and optional contracts that never block ordinary round clears.',
        'P18 adds accurate controls, failure explanation, touch teaching and color-independent brick/ball/contract cues.',
      ],
    },
    adversarialReview: [
      'Replay stays 9 because the new authored arc reorganizes existing contracts rather than adding a new mode or retention loop.',
      'Progression reaches 10 only after the round sequence gains intentional identities; shared P17/P18 polish is not counted toward that point.',
    ],
  },
  {
    id: 'airhockey',
    title: 'Neon Puck Smash',
    historical: { core: 9, agency: 9, progression: 8, replay: 9, feel: 9, fairnessUx: 8 },
    preP21: { core: 9, agency: 9, progression: 8, replay: 9, feel: 10, fairnessUx: 9 },
    final: { core: 9, agency: 9, progression: 9, replay: 9, feel: 10, fairnessUx: 9 },
    evidence: {
      progression: [
        'P21 strengthens the existing earned Power Play into a four-tier conversion ladder: successive power goals now rise through bounded 0.50/0.75/1.05/1.35 score scales.',
        'The 60-second match, three certified difficulty tiers, earned meter and four-second Power window now form a clearer opening→pressure→conversion match arc without changing physics.',
      ],
      feel: [
        'Game-native puck trail, mallet impacts, goal bursts and Power feedback combine with P17 hierarchy without obscuring the table.',
        'Pointer/keyboard mallet movement stays velocity-bounded and immediately responsive across desktop and touch layouts.',
      ],
      fairnessUx: [
        'P16 preserves player/puck velocity caps and explicitly bounded AI speed, prediction, reaction delay and aim error across all three difficulties.',
        'P18/P19 preserve touch containment, pause/result consistency, reduced-motion meaning and recovery/navigation behavior.',
      ],
    },
    adversarialReview: [
      'Replay remains 9: difficulty choice and Power Play existed before P21 and are not double-counted as a new replay system.',
      'The P21 point is Progression only; the changed reward ladder does not make AI stronger or alter collision trust.',
    ],
  },
  {
    id: 'tower',
    title: 'Gravity Tower Jumper',
    historical: { core: 9, agency: 9, progression: 9, replay: 8, feel: 9, fairnessUx: 8 },
    preP21: { core: 9, agency: 9, progression: 9, replay: 8, feel: 10, fairnessUx: 9 },
    final: { core: 9, agency: 9, progression: 9, replay: 9, feel: 10, fairnessUx: 9 },
    evidence: {
      replay: [
        'P21 turns the existing precision-center streak into a five-landing Apex route with a score-only 900-point completion beat.',
        'The route resets naturally when precision breaks, while the existing three-center charge cadence, 4.5-second voluntary Apex window and ordinary ascent remain unchanged.',
      ],
      feel: [
        'P17 reinforces landing, spring, stomp, boost and Apex events while preserving the game-native squash/stretch, particles and audio hierarchy.',
        'Reduced motion suppresses camera shake without removing landing/mastery state information.',
      ],
      fairnessUx: [
        'P16 certifies 60 Hz fixed-step physics and treats Apex as voluntary rather than survival-required.',
        'P18/P19 preserve readable laser danger, touch steering, canonical shell controls and 320px containment.',
      ],
    },
    adversarialReview: [
      'Progression remains 9 because P21 adds no new altitude system or content layer.',
      'The Replay point comes from an optional repeatable precision objective that changes player intent, not from a metagame or permanent reward.',
    ],
  },
  {
    id: 'pacmaze',
    title: 'Cyber Pac-Runner',
    historical: { core: 9, agency: 9, progression: 9, replay: 8, feel: 8, fairnessUx: 8 },
    preP21: { core: 9, agency: 9, progression: 9, replay: 8, feel: 9, fairnessUx: 9 },
    final: { core: 9, agency: 9, progression: 10, replay: 9, feel: 9, fairnessUx: 9 },
    evidence: {
      progression: [
        'P21 adds six authored level protocols—Orientation, Corner Read, Target Mix, Switchback, Pursuit and Endurance—using different bounded chase/scatter emphases and frightened windows.',
        'Later protocol cycles add small bounded pressure while retaining the same maze, ghost personalities, Hunt rules and 4.5-second frightened-time floor.',
      ],
      replay: [
        'Successive clears now ask the player to reinterpret the same classic maze under different pursuit rhythms rather than repeating one timing profile with only raw speed escalation.',
        'The six-protocol cycle preserves Hunt Rush as optional mastery and creates adaptation without adding another mode or persistent progression.',
      ],
      feel: [
        'P17 adds stronger semantic success/failure hierarchy while the certified buffered-turn, reversal, wall-stop and tunnel controls remain game-native.',
        'Movement remains tile-center based and immediate rather than being replaced with smoothing or auto-steering.',
      ],
      fairnessUx: [
        'P16 caps ghost speed and frightened pressure, and P18 teaches chase/scatter, Hunt and failure state across keyboard/touch play.',
        'The new protocols keep every duration and speed bounded; Hunt stays optional and slower than ordinary chase speed.',
      ],
    },
    adversarialReview: [
      'Core and Agency stay 9: the maze and control vocabulary are intentionally classic and are not inflated by the new protocol schedule.',
      'Progression and Replay rise separately because one concerns authored level arc and the other concerns run-to-run tactical reinterpretation; both are backed by actual helper behavior.',
    ],
  },
  {
    id: 'oneline',
    title: 'One Line',
    historical: { core: 9, agency: 10, progression: 9, replay: 8, feel: 7, fairnessUx: 8 },
    preP21: { core: 9, agency: 10, progression: 9, replay: 8, feel: 8, fairnessUx: 9 },
    final: { core: 9, agency: 10, progression: 10, replay: 9, feel: 8, fairnessUx: 9 },
    evidence: {
      progression: [
        'P21 preserves the three existing Master Route identities but tightens their optional ink-efficiency targets across later three-stage tiers with a hard 40% ceiling.',
        'Mastery rewards now scale modestly with tier in addition to level/streak, making later optimization goals materially distinct while ordinary portal clears stay unchanged.',
      ],
      replay: [
        'The existing ten procedural archetype selection and Random reroll now sit beneath a tiered optimization ladder, giving repeated layouts a progressively stronger efficiency objective.',
        'Random still breaks mastery streaks, preventing free reroll farming and keeping replay motivation inside the physics/drawing challenge.',
      ],
      feel: [
        'P17 improves success/failure hierarchy around portal clears and mastery results while preserving direct 10px-decimated drawing and fixed-step physics.',
        'The score deliberately stops at Feel 8 because drawing remains intentionally minimal rather than claiming flagship-level tactile richness.',
      ],
      fairnessUx: [
        'P16 preserves player-paced 240 Hz physics, limited ink, three attempts and ordinary portal clears without mastery requirements.',
        'P18 clarifies line/portal failure, touch drawing, ink state and non-color cues without hidden trajectory assistance.',
      ],
    },
    adversarialReview: [
      'Feel rises only 7→8 despite P17; P21 does not manufacture another feel point from the same feedback work.',
      'Progression and Replay are tied to actual tiered mastery thresholds/rewards; Agency remains the historical 10 and is not used as promotion slack.',
    ],
  },
  {
    id: 'chrono',
    title: 'Chrono Wave',
    historical: { core: 9, agency: 9, progression: 9, replay: 8, feel: 8, fairnessUx: 8 },
    preP21: { core: 9, agency: 9, progression: 9, replay: 8, feel: 9, fairnessUx: 9 },
    final: { core: 9, agency: 9, progression: 10, replay: 9, feel: 9, fairnessUx: 9 },
    evidence: {
      progression: [
        'P21 composes the already-certified ±1 gap vocabulary into four short phrase families—Orientation, Weave, Reversal and Compression—rather than leaving every transition independently random.',
        'Phrase offsets remain inside the existing two-sector-gap, one-sector-shift and impact-spacing planner, so authored structure is added without weakening the stage curve.',
      ],
      replay: [
        'Bounded mirroring introduces variation inside the phrase grammar, producing learnable but non-identical wall-reading sequences across runs.',
        'EMP and Focus remain optional tactical responses layered over the phrase patterns rather than being required to survive them.',
      ],
      feel: [
        'P17 separates clean passes, shards, Focus, EMP and collision feedback while preserving gap visibility and reduced-motion-safe meaning.',
        'The score remains 9 rather than 10 because the core visual vocabulary is intentionally compact.',
      ],
      fairnessUx: [
        'The permanent reachability planner still guarantees two-sector openings, ≤1-sector transitions, ordered impacts and forced safe stage-transition openings.',
        'P18/P19 preserve control teaching, pause/navigation, 320px shell behavior and readable failure without making Focus or EMP mandatory.',
      ],
    },
    adversarialReview: [
      'The phrase grammar uses only existing legal offsets; no score point is awarded for simply making the walls faster or more decorative.',
      'Progression and Replay each rise one point only because the source now contains both authored sequencing and bounded intra-phrase variation.',
    ],
  },
] as const;
