export interface TypeRushWave {
  index: number;
  label: 'BOOT' | 'SURGE' | 'OVERCLOCK' | 'REDLINE';
  startsAtSeconds: number;
  maxWords: number;
  spawnIntervalMs: number;
  speedMultiplier: number;
  scoreMultiplier: number;
  words: readonly string[];
}

const BOOT_WORDS = [
  'CODE', 'BYTE', 'GRID', 'FLOW', 'NEO', 'WAVE', 'CHIP', 'PING', 'NODE', 'LINK', 'PORT', 'LOOP',
] as const;

const SURGE_WORDS = [
  'CYBER', 'LASER', 'PULSE', 'ORBIT', 'VECTOR', 'MATRIX', 'SHADOW', 'SPARK', 'DRIFT', 'SONIC', 'DRIVE', 'RADAR',
] as const;

const OVERCLOCK_WORDS = [
  'QUANTUM', 'FIREWALL', 'PROTOCOL', 'STARDUST', 'OVERDRIVE', 'TERMINAL', 'CIRCUIT', 'NEBULA', 'REACTOR', 'VELOCITY', 'PHOTON', 'NETWORK',
] as const;

const REDLINE_WORDS = [
  'SYNCHRONIZE', 'HYPERDRIVE', 'MAINFRAME', 'ALGORITHM', 'TELEMETRY', 'AFTERBURN', 'STARLIGHT', 'THROTTLE', 'OVERCLOCK', 'CYBERNETIC', 'VECTORIZE', 'TRANSFORM',
] as const;

export const TYPE_RUSH_WAVES: readonly TypeRushWave[] = [
  {
    index: 0,
    label: 'BOOT',
    startsAtSeconds: 0,
    maxWords: 3,
    spawnIntervalMs: 2300,
    speedMultiplier: 0.9,
    scoreMultiplier: 1,
    words: BOOT_WORDS,
  },
  {
    index: 1,
    label: 'SURGE',
    startsAtSeconds: 25,
    maxWords: 4,
    spawnIntervalMs: 1900,
    speedMultiplier: 1,
    scoreMultiplier: 1.15,
    words: SURGE_WORDS,
  },
  {
    index: 2,
    label: 'OVERCLOCK',
    startsAtSeconds: 50,
    maxWords: 4,
    spawnIntervalMs: 1550,
    speedMultiplier: 1.08,
    scoreMultiplier: 1.3,
    words: OVERCLOCK_WORDS,
  },
  {
    index: 3,
    label: 'REDLINE',
    startsAtSeconds: 80,
    maxWords: 5,
    spawnIntervalMs: 1250,
    speedMultiplier: 1.16,
    scoreMultiplier: 1.5,
    words: REDLINE_WORDS,
  },
] as const;

export const getTypeRushWave = (elapsedSeconds: number): TypeRushWave => {
  const elapsed = Math.max(0, elapsedSeconds);
  let wave = TYPE_RUSH_WAVES[0];
  for (const candidate of TYPE_RUSH_WAVES) {
    if (elapsed >= candidate.startsAtSeconds) wave = candidate;
  }
  return wave;
};

export const chooseTypeRushWord = (
  wave: TypeRushWave,
  activeWords: readonly string[],
  randomValue: number,
): string => {
  const active = new Set(activeWords);
  const available = wave.words.filter((word) => !active.has(word));
  const pool = available.length > 0 ? available : wave.words;
  const normalized = Math.max(0, Math.min(0.999999, randomValue));
  return pool[Math.floor(normalized * pool.length)] ?? wave.words[0];
};
