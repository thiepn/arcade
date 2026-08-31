export type KnifeStageMode = 'STEADY' | 'BACKSPIN' | 'PULSE' | 'SHIELD' | 'PRECISION' | 'BOSS';

export interface KnifeStageConfig {
  mode: KnifeStageMode;
  label: string;
  baseSpeed: number;
  knifeCount: number;
  preBladeCount: number;
  appleCount: number;
  shieldCount: number;
  shieldSpan: number;
  reverseInterval: number;
  pulseAmplitude: number;
}

const BASE_CONFIGS: readonly Omit<KnifeStageConfig, 'baseSpeed' | 'knifeCount' | 'preBladeCount'>[] = [
  {
    mode: 'STEADY',
    label: 'STEADY CORE',
    appleCount: 1,
    shieldCount: 0,
    shieldSpan: 0,
    reverseInterval: 0,
    pulseAmplitude: 0,
  },
  {
    mode: 'BACKSPIN',
    label: 'BACKSPIN',
    appleCount: 1,
    shieldCount: 0,
    shieldSpan: 0,
    reverseInterval: 2.4,
    pulseAmplitude: 0,
  },
  {
    mode: 'PULSE',
    label: 'PULSE DRIVE',
    appleCount: 2,
    shieldCount: 0,
    shieldSpan: 0,
    reverseInterval: 0,
    pulseAmplitude: 0.38,
  },
  {
    mode: 'SHIELD',
    label: 'SHIELD WALL',
    appleCount: 1,
    shieldCount: 1,
    shieldSpan: 0.78,
    reverseInterval: 0,
    pulseAmplitude: 0,
  },
  {
    mode: 'PRECISION',
    label: 'PRECISION RING',
    appleCount: 2,
    shieldCount: 0,
    shieldSpan: 0,
    reverseInterval: 0,
    pulseAmplitude: 0,
  },
  {
    mode: 'BOSS',
    label: 'BOSS CORE',
    appleCount: 2,
    shieldCount: 2,
    shieldSpan: 0.56,
    reverseInterval: 1.8,
    pulseAmplitude: 0.3,
  },
] as const;

export const getKnifeStageConfig = (stage: number): KnifeStageConfig => {
  const safeStage = Math.max(1, Math.floor(stage));
  const cycleIndex = (safeStage - 1) % BASE_CONFIGS.length;
  const tier = Math.floor((safeStage - 1) / BASE_CONFIGS.length);
  const base = BASE_CONFIGS[cycleIndex];
  const speedByMode = [2.1, 2.4, 2.65, 2.8, 3.0, 3.2][cycleIndex];
  const preBladeByMode = [0, 1, 1, 2, 3, 3][cycleIndex];

  return {
    ...base,
    baseSpeed: Math.min(5.2, speedByMode + tier * 0.28),
    knifeCount: Math.min(14, 8 + cycleIndex + Math.min(2, tier)),
    preBladeCount: Math.min(5, preBladeByMode + tier),
  };
};

export const getKnifeStageRotationSpeed = (
  config: KnifeStageConfig,
  elapsedSeconds: number,
  direction: -1 | 1,
): number => {
  const elapsed = Math.max(0, elapsedSeconds);
  const pulse = config.pulseAmplitude > 0
    ? 1 + Math.sin(elapsed * 3.1) * config.pulseAmplitude
    : 1;
  return direction * config.baseSpeed * pulse;
};
