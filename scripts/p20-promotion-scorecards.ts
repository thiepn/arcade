export type P20Category = 'core' | 'agency' | 'progression' | 'replay' | 'feel' | 'fairnessUx';

export interface P20Scorecard {
  core: number;
  agency: number;
  progression: number;
  replay: number;
  feel: number;
  fairnessUx: number;
}

export interface P20PromotionRecord {
  id: 'gravity' | 'chain' | 'merge' | 'drift' | 'dodge' | 'blade';
  title: string;
  historical: P20Scorecard;
  preP20: P20Scorecard;
  final: P20Scorecard;
  evidence: Partial<Record<P20Category, readonly string[]>>;
  adversarialReview: readonly string[];
}

export const P20_S_THRESHOLD = 55;

export const p20Total = (score: P20Scorecard) =>
  score.core + score.agency + score.progression + score.replay + score.feel + score.fairnessUx;

export const P20_PROMOTIONS: readonly P20PromotionRecord[] = [
  {
    id: 'gravity',
    title: 'Gravity',
    historical: { core: 9, agency: 10, progression: 10, replay: 9, feel: 8, fairnessUx: 8 },
    preP20: { core: 9, agency: 10, progression: 10, replay: 9, feel: 9, fairnessUx: 9 },
    final: { core: 9, agency: 10, progression: 10, replay: 9, feel: 9, fairnessUx: 9 },
    evidence: {
      feel: [
        'P17 makes Flight Contract and sector completion outrank routine collection while retaining distinct steering, boost and polarity feedback.',
        'The game-native contract HUD exposes label, requirement, streak and boost/flip/recall usage without changing physics.',
      ],
      fairnessUx: [
        'P16 certifies five authored sectors, deterministic 60 Hz Newtonian stepping and optional contracts that never narrow the ordinary clear route.',
        'P18 preserves contract/control teaching, failure explanation, touch support and reduced-motion meaning.',
      ],
    },
    adversarialReview: [
      'No Core, Agency, Progression or Replay point is claimed from shared polish.',
      'The promotion survives because both historical 8s now have game-specific P16-P18 evidence; no new Gravity mechanic is required in P20.',
    ],
  },
  {
    id: 'chain',
    title: 'Chain',
    historical: { core: 9, agency: 10, progression: 9, replay: 9, feel: 8, fairnessUx: 9 },
    preP20: { core: 9, agency: 10, progression: 9, replay: 9, feel: 9, fairnessUx: 9 },
    final: { core: 9, agency: 10, progression: 9, replay: 9, feel: 9, fairnessUx: 9 },
    evidence: {
      feel: [
        'Plasma, Tesla and Cryo already have distinct anticipation, resolution, audio and board consequences instead of one generic cast response.',
        'P17 gives Resonance and large cascades stronger hierarchy, while the native HUD exposes selected-tool purpose, chain target and Resonance order.',
      ],
    },
    adversarialReview: [
      'Late-board density remains a real constraint, so Fairness/UX is intentionally held at 9 rather than inflated to 10.',
      'Only Feel rises: the existing three-tool economy and Resonance system are not double-counted as new Agency or Replay gains.',
    ],
  },
  {
    id: 'merge',
    title: 'Merge',
    historical: { core: 9, agency: 10, progression: 9, replay: 9, feel: 8, fairnessUx: 9 },
    preP20: { core: 9, agency: 10, progression: 9, replay: 9, feel: 9, fairnessUx: 9 },
    final: { core: 9, agency: 10, progression: 9, replay: 9, feel: 9, fairnessUx: 9 },
    evidence: {
      feel: [
        'Game-native haptics distinguish placement, merge and multi-step cascade outcomes; contract completion has separate success feedback and resource payoff.',
        'P17 reinforces cascade/contract hierarchy without changing the deterministic resolver, three-tile queue or board legality.',
      ],
    },
    adversarialReview: [
      'P18 teaching reduces cognitive friction but is not counted as a second score increase because Fairness/UX was already 9.',
      'No timer, new tool, alternate board or meta-system is added merely to create promotion evidence.',
    ],
  },
  {
    id: 'drift',
    title: 'Cyber Drift',
    historical: { core: 9, agency: 9, progression: 9, replay: 9, feel: 9, fairnessUx: 8 },
    preP20: { core: 9, agency: 9, progression: 9, replay: 9, feel: 10, fairnessUx: 9 },
    final: { core: 9, agency: 9, progression: 9, replay: 9, feel: 10, fairnessUx: 9 },
    evidence: {
      feel: [
        'The native loop combines fixed-step steering, drift angle, skidmarks, nitro flames, speed lines, tiered drift feedback, score popups, audio and haptics with immediate control response.',
        'P17 adds Style Route completion hierarchy and deliberately reduces global feedback in this high-speed game so effects remain subordinate to driving.',
      ],
      fairnessUx: [
        'P16 certifies fixed event cadence and bounded Nitro speed so spawn frequency and velocity do not multiply into an uncontrolled difficulty cliff.',
        'P18 preserves hazard/collision explanation, touch steering, reduced-motion readability and high-speed silhouette priority.',
      ],
    },
    adversarialReview: [
      'Feel reaches 10 only because the underlying car-specific feedback was already 9-caliber before P17; the shared layer alone would not justify a 10.',
      'Fairness/UX remains 9 rather than 10 because procedural traffic can still create variable pressure even inside the certified bounds.',
    ],
  },
  {
    id: 'dodge',
    title: 'Dodge',
    historical: { core: 9, agency: 9, progression: 9, replay: 9, feel: 9, fairnessUx: 8 },
    preP20: { core: 9, agency: 9, progression: 9, replay: 9, feel: 10, fairnessUx: 9 },
    final: { core: 9, agency: 9, progression: 9, replay: 9, feel: 10, fairnessUx: 9 },
    evidence: {
      feel: [
        'Warp Dash has a dedicated ghost trail, particle burst and state change; Phase Cuts create game-native particles, recharge rewards and success audio rather than passive invulnerability.',
        'P17 preserves hazard silhouettes by shrinking global effects at high speed while maintaining failure and mastery hierarchy.',
      ],
      fairnessUx: [
        'Laser warnings provide a 1.2 second visual telegraph before a 0.5 second active beam, while hazard silhouettes differ by geometry as well as color.',
        'P16 preserves bounded dash rules and P18 certifies high-speed readability, touch movement, failure explanation and reduced-motion information.',
      ],
    },
    adversarialReview: [
      'Agency and Replay remain 9: Phase Cut existed before P15 and is not counted twice.',
      'Fairness/UX remains 9 because procedural mixed hazards are intentionally demanding; the evidence supports trust, not perfection.',
    ],
  },
  {
    id: 'blade',
    title: 'Laser Blade',
    historical: { core: 9, agency: 9, progression: 8, replay: 9, feel: 10, fairnessUx: 8 },
    preP20: { core: 9, agency: 9, progression: 8, replay: 9, feel: 10, fairnessUx: 9 },
    final: { core: 9, agency: 9, progression: 9, replay: 9, feel: 10, fairnessUx: 9 },
    evidence: {
      progression: [
        'P20 replaces unstructured composition with seven authored wave phrases: Clean Cuts, Crosscut Angles, Armor Break, Red Zone, Razor Window, Mixed Mastery and Neon Finale.',
        'Each phrase keeps bounded procedural variation, 2-4 targets, and at most one bomb; late play rotates the three mastery phrases rather than freezing into one terminal pattern.',
        'A live phrase/step HUD makes the authored run arc visible without adding a mode, currency or progression metagame.',
      ],
      fairnessUx: [
        'P16 trajectory certification already guarantees playable launch arcs and refresh-rate invariance; P18 preserves bomb/target clarity and mobile swipe teaching.',
        'P20 phrase rules prevent bombs in the early teaching phrases and cap bomb pressure at one per eligible wave without weakening bomb consequences.',
      ],
    },
    adversarialReview: [
      'Feel stays at the historical 10; P20 does not award points for extra slash effects.',
      'Replay remains 9 because authored structure reorders existing vocabulary rather than adding a new mode or retention system.',
      'Progression rises only one point after the source-level composition model becomes intentionally authored while preserving bounded variation.',
    ],
  },
] as const;
