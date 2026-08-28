import type { LaserRopeArenaMetrics, LaserRopeMode } from './laserRopePresentation';

export const LASER_ROPE_PHASE_B_VERSION = 'phase-b-1';

export type LaserRopeFeedbackKind =
  | 'success'
  | 'near-miss'
  | 'shield'
  | 'collision';

export interface LaserRopeFeedbackBurst {
  id: number;
  x: number;
  y: number;
  color: string;
  life: number;
  maxLife: number;
  strength: number;
  kind: LaserRopeFeedbackKind;
}

export interface LaserRopeFeedbackBanner {
  title: string;
  detail: string;
  color: string;
  life: number;
  maxLife: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const shortestAngleDistance = (a: number, b: number) =>
  Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

export const getLaserRopeApproachIntensity = (
  beamAngles: readonly number[],
): number => {
  const targetAngle = Math.PI / 2;
  let nearest = Math.PI;
  for (const angle of beamAngles) {
    nearest = Math.min(nearest, shortestAngleDistance(angle, targetAngle));
  }
  return clamp01((0.72 - nearest) / 0.72);
};

export const isLaserRopeNearMiss = (
  mode: LaserRopeMode,
  playerY: number,
  isSliding: boolean,
  slideTimer: number,
): boolean => {
  if (mode === 'HIGH') {
    return isSliding && slideTimer > 0 && slideTimer <= 0.2;
  }
  return playerY > 24 && playerY <= 42;
};

export const drawLaserRopeSweepTelegraph = (
  ctx: CanvasRenderingContext2D,
  metrics: LaserRopeArenaMetrics,
  mode: LaserRopeMode,
  intensity: number,
  time: number,
): void => {
  const level = clamp01(intensity);
  if (level <= 0.02) return;

  const color = mode === 'HIGH' ? '#C084FC' : '#F43F5E';
  const pulse = 0.75 + Math.sin(time * 14) * 0.25;
  const alpha = level * (0.32 + pulse * 0.34);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18 * level;
  ctx.lineWidth = 2 + level * 2;
  ctx.setLineDash([7, 7]);
  ctx.lineDashOffset = -time * 34;
  ctx.beginPath();
  ctx.ellipse(
    0,
    metrics.radiusY * 0.54,
    metrics.radiusX * (0.16 + level * 0.05),
    metrics.radiusY * (0.15 + level * 0.05),
    0,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.setLineDash([]);

  const warningY = mode === 'HIGH' ? -32 : 7;
  ctx.globalAlpha = alpha * 0.9;
  ctx.lineWidth = 1.5;
  for (const direction of [-1, 1]) {
    const x = direction * metrics.radiusX * 0.24;
    ctx.beginPath();
    ctx.moveTo(x, warningY - 7);
    ctx.lineTo(x + direction * 10, warningY);
    ctx.lineTo(x, warningY + 7);
    ctx.stroke();
  }
  ctx.restore();
};

export const drawLaserRopeSpawnTelegraph = (
  ctx: CanvasRenderingContext2D,
  metrics: LaserRopeArenaMetrics,
  mode: LaserRopeMode,
  progress: number,
  time: number,
): void => {
  const level = clamp01(progress);
  const color = mode === 'HIGH' ? '#A855F7' : mode === 'DUAL' ? '#F43F5E' : '#EF4444';
  const pulse = 0.6 + Math.sin(time * 17) * 0.4;

  ctx.save();
  ctx.globalAlpha = 0.22 + level * 0.48;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.lineWidth = 2 + level * 1.5;
  ctx.setLineDash([12, 8]);
  ctx.lineDashOffset = time * 42;
  ctx.beginPath();
  ctx.ellipse(
    0,
    0,
    metrics.radiusX * (0.72 + level * 0.2),
    metrics.radiusY * (0.72 + level * 0.2),
    0,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.globalAlpha = (0.14 + level * 0.24) * (0.7 + pulse * 0.3);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, metrics.radiusY * 0.55, metrics.radiusX * 0.22, metrics.radiusY * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

export const drawLaserRopeFeedbackBursts = (
  ctx: CanvasRenderingContext2D,
  bursts: readonly LaserRopeFeedbackBurst[],
  time: number,
): void => {
  for (const burst of bursts) {
    const remaining = clamp01(burst.life / Math.max(0.001, burst.maxLife));
    const progress = 1 - remaining;
    const radius = 10 + progress * 58 * burst.strength;
    const shardCount = burst.kind === 'collision' ? 12 : burst.kind === 'near-miss' ? 8 : 6;

    ctx.save();
    ctx.translate(burst.x, burst.y);
    ctx.globalAlpha = remaining * 0.9;
    ctx.strokeStyle = burst.color;
    ctx.shadowColor = burst.color;
    ctx.shadowBlur = 16 * remaining;
    ctx.lineWidth = 2.5 * remaining + 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = remaining * 0.7;
    ctx.lineWidth = 1.5;
    for (let index = 0; index < shardCount; index++) {
      const seedAngle = ((burst.id * 0.73 + index * 1.91) % (Math.PI * 2)) + time * 0.08;
      const inner = radius * 0.45;
      const outer = radius * (0.78 + (index % 3) * 0.1);
      ctx.beginPath();
      ctx.moveTo(Math.cos(seedAngle) * inner, Math.sin(seedAngle) * inner);
      ctx.lineTo(Math.cos(seedAngle) * outer, Math.sin(seedAngle) * outer);
      ctx.stroke();
    }
    ctx.restore();
  }
};

export const drawLaserRopeFeedbackBanner = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  banner: LaserRopeFeedbackBanner | null,
): void => {
  if (!banner || banner.life <= 0) return;

  const remaining = clamp01(banner.life / Math.max(0.001, banner.maxLife));
  const progress = 1 - remaining;
  const fadeIn = clamp01(progress / 0.16);
  const fadeOut = clamp01(remaining / 0.28);
  const alpha = Math.min(fadeIn, fadeOut);
  const scale = 0.92 + Math.min(1, progress * 5) * 0.08;
  const panelWidth = Math.min(280, Math.max(190, width - 44));
  const panelHeight = 52;
  const x = width / 2;
  const y = Math.max(74, height * 0.19);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(3,7,18,0.82)';
  ctx.strokeStyle = banner.color;
  ctx.shadowColor = banner.color;
  ctx.shadowBlur = 18;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 14);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.textAlign = 'center';
  ctx.fillStyle = banner.color;
  ctx.font = '900 13px ui-monospace, monospace';
  ctx.fillText(banner.title, 0, -3);
  ctx.fillStyle = 'rgba(226,232,240,0.88)';
  ctx.font = '700 9px ui-monospace, monospace';
  ctx.fillText(banner.detail, 0, 14);
  ctx.restore();
};

export const drawLaserRopeScreenFlash = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string,
  alpha: number,
): void => {
  const level = clamp01(alpha);
  if (level <= 0.005) return;
  ctx.save();
  ctx.globalAlpha = level;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};
