export const RHYTHM_HOLD_RELEASE_GRACE_MS = 90;
export const RHYTHM_HOLD_COMPLETION_BASE_POINTS = 180;

export const getRhythmHoldEndBeat = (startBeat: number, holdBeats: number) =>
  startBeat + Math.max(0, holdBeats);

export const isRhythmHoldComplete = (
  judgementBeat: number,
  startBeat: number,
  holdBeats: number,
) => judgementBeat >= getRhythmHoldEndBeat(startBeat, holdBeats);

export const shouldBreakRhythmHold = ({
  judgementBeat,
  startBeat,
  holdBeats,
  bpm,
  laneHeld,
  releaseStartedBeat = startBeat,
}: {
  judgementBeat: number;
  startBeat: number;
  holdBeats: number;
  bpm: number;
  laneHeld: boolean;
  releaseStartedBeat?: number | null;
}) => {
  if (laneHeld || isRhythmHoldComplete(judgementBeat, startBeat, holdBeats)) return false;
  const releaseBeat = releaseStartedBeat ?? judgementBeat;
  const releasedForMs = Math.max(0, judgementBeat - releaseBeat) * (60_000 / bpm);
  return releasedForMs > RHYTHM_HOLD_RELEASE_GRACE_MS;
};

export const getRhythmHoldCompletionBonus = (
  holdBeats: number,
  multiplier: number,
) => {
  const durationBonus = Math.round(Math.max(0.5, holdBeats) * 90);
  return Math.round(
    (RHYTHM_HOLD_COMPLETION_BASE_POINTS + durationBonus) * Math.max(1, multiplier),
  );
};
