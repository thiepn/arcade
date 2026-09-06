import { P20_PROMOTIONS } from './p20-promotion-scorecards';
import { P21_PROMOTIONS } from './p21-promotion-scorecards';
import { P22_PROMOTIONS } from './p22-promotion-scorecards';
import { P23_PROMOTIONS } from './p23-promotion-scorecards';

export type P24Category = 'core' | 'agency' | 'progression' | 'replay' | 'feel' | 'fairnessUx';
export type P24Provenance = 'P15' | 'P20' | 'P21' | 'P22' | 'P23';

export interface P24Scorecard {
  core: number;
  agency: number;
  progression: number;
  replay: number;
  feel: number;
  fairnessUx: number;
}

export interface P24ScorecardRecord {
  id: string;
  title: string;
  provenance: P24Provenance;
  score: P24Scorecard;
}

export const P24_S_THRESHOLD = 55;

export const p24Total = (score: P24Scorecard) =>
  score.core + score.agency + score.progression + score.replay + score.feel + score.fairnessUx;

export const P24_EXPECTED_GAME_IDS = [
  'orbit','stack','reaction','dodge','pulse','merge','typerush','oneline','breakout','perfectstop',
  'chain','gravity','blade','pinball','chrono','matrix','drift','vanguard','slingshot','snake',
  'rhythm','tower','pacmaze','flappyaero','roadcross','bubblebuster','astroblaster','laserrope',
  'blockdrop','knifetarget','airhockey','neonrail',
] as const;

// The five games that were already S in immutable P15 remain conservatively at their
// historical P15 scores. P24 does not manufacture additional points for later polish.
export const P24_P15_S_BASELINE: readonly P24ScorecardRecord[] = [
  { id: 'pinball', title: 'Neon Pinball', provenance: 'P15', score: { core: 10, agency: 10, progression: 9, replay: 10, feel: 10, fairnessUx: 9 } },
  { id: 'vanguard', title: 'Galaxy Vanguard', provenance: 'P15', score: { core: 10, agency: 9, progression: 10, replay: 9, feel: 10, fairnessUx: 9 } },
  { id: 'astroblaster', title: 'Astro Blaster 360', provenance: 'P15', score: { core: 10, agency: 10, progression: 9, replay: 9, feel: 10, fairnessUx: 9 } },
  { id: 'blockdrop', title: 'Cyber Block Drop', provenance: 'P15', score: { core: 10, agency: 10, progression: 9, replay: 10, feel: 8, fairnessUx: 9 } },
  { id: 'rhythm', title: 'Neon Rhythm Tapper', provenance: 'P15', score: { core: 9, agency: 9, progression: 9, replay: 10, feel: 9, fairnessUx: 9 } },
];

const promoted = (
  records: readonly { id: string; title: string; final: P24Scorecard }[],
  provenance: Exclude<P24Provenance, 'P15'>,
): P24ScorecardRecord[] => records.map((record) => ({
  id: record.id,
  title: record.title,
  provenance,
  score: { ...record.final },
}));

// P24 is a composition ledger, not a new scoring pass. Every non-P15 record is copied
// from the final scorecard of the phase that actually earned its promotion.
export const P24_CURRENT_SCORECARDS: readonly P24ScorecardRecord[] = [
  ...P24_P15_S_BASELINE,
  ...promoted(P20_PROMOTIONS, 'P20'),
  ...promoted(P21_PROMOTIONS, 'P21'),
  ...promoted(P22_PROMOTIONS, 'P22'),
  ...promoted(P23_PROMOTIONS, 'P23'),
];
