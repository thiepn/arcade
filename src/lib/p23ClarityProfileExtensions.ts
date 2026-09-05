import { P18_GAME_CLARITY_BY_ID, type P18GameClarityProfile } from './gameClarityProfiles';

export type P23GameId = 'typerush' | 'perfectstop' | 'reaction' | 'pulse' | 'laserrope' | 'flappyaero' | 'stack';

export interface P23ClarityExtension {
  id: P23GameId;
  masteryName: string;
  mastery: string;
  benefit: string;
  danger: string;
  nextTry: string;
  sourceControls?: string;
}

export const P23_CLARITY_EXTENSIONS: readonly P23ClarityExtension[] = [
  { id: 'typerush', masteryName: 'Directive Relay', mastery: 'Completed words now form short CONTROL or VOLATILE relay branches using the same urgent, special and risk-weighted targets.', benefit: 'Relay completion adds score while making target selection matter across each authored typing wave.', danger: 'A relay never auto-types, freezes danger, or guarantees the word category it asks you to prioritize.', nextTry: 'Choose the first relay target deliberately, then keep enough attention on the danger line to finish the branch safely.' },
  { id: 'perfectstop', masteryName: 'Beacon Route', mastery: 'Core sectors show the normal beacon plus an optional precision beacon; the target you hit commits a short Calibration or Edge route.', benefit: 'Precision hits can accelerate Master Encore qualification and completed routes add score.', danger: 'The normal beacon remains the ordinary clear path and precision beacons never widen the certified timing windows.', nextTry: 'Read marker speed first, then decide whether the precision beacon is worth the harder timing line.' },
  { id: 'reaction', masteryName: 'Reaction Circuit', mastery: 'Between safe result screens, choose SPEED or CONTROL to change the order of the next two existing cue families.', benefit: 'Clean two-round circuits add score and route choice makes repeated gauntlets structurally different.', danger: 'Circuit choice never appears during a live reaction cue and does not shorten the certified wait or inhibition floors.', nextTry: 'Choose a circuit only after the result, then classify the next cue before trying to be fast.' },
  { id: 'pulse', masteryName: 'Groove Path', mastery: 'Four-beat paths compose the six existing groove patterns; queue the next branch with A/Left or D/Right outside the beat tap.', benefit: 'Path completion adds score and makes Sync Wager timing more strategic without changing normal judgement.', danger: 'Path choice never changes the 8/18/28px windows or the 155 BPM cap.', nextTry: 'Queue the next path early, then return attention to the pulse ring before the active beat reaches the target.', sourceControls: 'Click / Tap / Space • A/D or Left/Right: Next Groove Path • F / Shift: Sync Wager' },
  { id: 'laserrope', masteryName: 'Choreography', mastery: 'LOW, HIGH and DUAL sweeps now form authored multi-step choreographies while the same jump/slide actions clear each beat.', benefit: 'Reading the sequence improves anticipation; Redline can be saved for a known high-value choreography window.', danger: 'HIGH/DUAL unlock thresholds, collision rules and the 0.38s mode-change warning floor remain unchanged.', nextTry: 'Read the next choreography step before committing Redline so extra speed is a deliberate risk.' },
  { id: 'flappyaero', masteryName: 'Flight Line', mastery: 'Three consecutive gates form an authored line with optional HIGH, CENTER and LOW traces inside the ordinary safe gaps.', benefit: 'Holding one trace through all three gates adds score and makes Flow Boost timing more consequential.', danger: 'Trace markers never narrow the physical gap or make an otherwise legal gate clear invalid.', nextTry: 'Choose a trace at the first gate and adjust altitude gradually rather than chasing the marker at the last moment.' },
  { id: 'stack', masteryName: 'Tower Blueprint', mastery: 'Real placement geometry now drives short optional blueprints such as Centerline, Offset, Bridge, Focus Spire and Skyline.', benefit: 'Blueprints reward deliberate offsets, recovery and Focus-perfect placement without changing ordinary stack physics.', danger: 'Missing a blueprint only resets mastery; block overlap, width loss, speed and game-over rules are unchanged.', nextTry: 'Read the requested placement relationship before the moving block reaches the tower, then use Focus only when the blueprint calls for precision.' },
] as const;

export const P23_CLARITY_EXTENSION_BY_ID = Object.freeze(
  Object.fromEntries(P23_CLARITY_EXTENSIONS.map((extension) => [extension.id, extension])) as Record<P23GameId, P23ClarityExtension>,
);

export const getP23ExtendedClarityProfile = (id: P23GameId): P18GameClarityProfile => {
  const base = P18_GAME_CLARITY_BY_ID[id];
  const extension = P23_CLARITY_EXTENSION_BY_ID[id];
  if (!base) throw new Error(`Missing P18 clarity profile for P23 candidate ${id}`);
  return {
    ...base,
    masteryName: extension.masteryName,
    mastery: extension.mastery,
    benefit: extension.benefit,
    danger: extension.danger,
    nextTry: extension.nextTry,
    sourceControls: extension.sourceControls ?? base.sourceControls,
  };
};
