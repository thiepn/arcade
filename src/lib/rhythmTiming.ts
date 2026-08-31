export const RHYTHM_HIT_WINDOWS_MS = Object.freeze({
  perfect: 70,
  great: 125,
  good: 190,
});

export const RHYTHM_MISS_WINDOW_MS = 230;
export const RHYTHM_LATENCY_MIN_MS = -200;
export const RHYTHM_LATENCY_MAX_MS = 200;
export const RHYTHM_LATENCY_STEP_MS = 10;
export const RHYTHM_LATENCY_STORAGE_KEY = 'micro-arcade-rhythm-latency-ms';

export const clampRhythmLatencyOffset = (value: number) =>
  Math.max(RHYTHM_LATENCY_MIN_MS, Math.min(RHYTHM_LATENCY_MAX_MS, Math.round(value)));

export const beatsToMilliseconds = (beats: number, bpm: number) =>
  bpm > 0 ? (beats * 60_000) / bpm : 0;

export const millisecondsToBeats = (milliseconds: number, bpm: number) =>
  bpm > 0 ? (milliseconds * bpm) / 60_000 : 0;

/**
 * Positive compensation means the audible output arrives late, so rendering and
 * judgement intentionally use an earlier song beat to meet the delayed sound.
 */
export const getLatencyCompensatedBeat = (
  currentBeat: number,
  bpm: number,
  latencyOffsetMs: number,
) => currentBeat - millisecondsToBeats(clampRhythmLatencyOffset(latencyOffsetMs), bpm);

/** Positive values mean the player's judged input is late; negative means early. */
export const getSignedTimingErrorMs = (
  noteBeat: number,
  judgementBeat: number,
  bpm: number,
) => beatsToMilliseconds(judgementBeat - noteBeat, bpm);
