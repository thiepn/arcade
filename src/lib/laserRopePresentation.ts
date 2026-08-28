export type LaserRopeMode = 'LOW' | 'HIGH' | 'DUAL';

export interface LaserRopeArenaMetrics {
  centerX: number;
  groundY: number;
  radiusX: number;
  radiusY: number;
  beamRadius: number;
  frameHalfWidth: number;
  frameTop: number;
  frameBottom: number;
}

export interface LaserRopePlayerPresentation {
  playerY: number;
  isSliding: boolean;
  isGrounded: boolean;
  jumpCount: number;
  hasShield: boolean;
  isFeverActive: boolean;
  time: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const LASER_ROPE_PHASE_A_VERSION = 'phase-a-1';

export const getLaserRopeArenaMetrics = (
  width: number,
  height: number,
): LaserRopeArenaMetrics => {
  const safeWidth = Math.max(240, width);
  const safeHeight = Math.max(300, height);
  const centerX = width / 2;
  const groundY = height * (height < 520 ? 0.69 : 0.72);
  const widthLimit = Math.max(112, safeWidth / 2 - 28);
  const radiusX = Math.min(
    widthLimit,
    clamp(Math.min(safeWidth * 0.34, safeHeight * 0.42), 122, 320),
  );
  const radiusY = clamp(radiusX * 0.34, 42, 96);
  const frameHalfWidth = Math.min(safeWidth / 2 - 12, radiusX + 28);
  const frameTop = -clamp(safeHeight * 0.37, 165, 250);
  const availableBottom = Math.max(54, height - groundY - 68);
  const frameBottom = Math.min(radiusY + 28, availableBottom);

  return {
    centerX,
    groundY,
    radiusX,
    radiusY,
    beamRadius: radiusX * 0.93,
    frameHalfWidth,
    frameTop,
    frameBottom,
  };
};

export const getLaserRopeBeamColor = (
  mode: LaserRopeMode,
  isFeverActive: boolean,
): string => {
  if (isFeverActive) return '#FACC15';
  if (mode === 'HIGH') return '#A855F7';
  if (mode === 'DUAL') return '#F43F5E';
  return '#EF4444';
};

export const drawLaserRopeBackground = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  isFeverActive: boolean,
): void => {
  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, isFeverActive ? '#120D05' : '#030712');
  background.addColorStop(0.55, '#070A14');
  background.addColorStop(1, '#020308');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const arenaGlow = ctx.createRadialGradient(
    width / 2,
    height * 0.57,
    20,
    width / 2,
    height * 0.57,
    Math.max(width, height) * 0.68,
  );
  arenaGlow.addColorStop(
    0,
    isFeverActive ? 'rgba(250,204,21,0.13)' : 'rgba(56,189,248,0.12)',
  );
  arenaGlow.addColorStop(0.46, 'rgba(168,85,247,0.055)');
  arenaGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = arenaGlow;
  ctx.fillRect(0, 0, width, height);

  const horizonY = clamp(height * 0.25, 72, 190);
  const floorBottom = height + 20;
  ctx.save();
  ctx.strokeStyle = isFeverActive
    ? 'rgba(250,204,21,0.13)'
    : 'rgba(56,189,248,0.11)';
  ctx.lineWidth = 1;

  for (let index = 0; index <= 14; index++) {
    const bottomX = (width / 14) * index;
    ctx.beginPath();
    ctx.moveTo(width / 2, horizonY);
    ctx.lineTo(bottomX, floorBottom);
    ctx.stroke();
  }

  for (let index = 0; index < 13; index++) {
    const t = index / 12;
    const y = horizonY + (height - horizonY) * t * t;
    ctx.globalAlpha = 0.25 + t * 0.75;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  for (let index = 0; index < 24; index++) {
    const speed = 5 + (index % 5) * 1.7;
    const rawY = (index * 79.31 + time * speed * 12) % (height + 80);
    const y = rawY - 40;
    const xBase = (index * 127.13) % Math.max(1, width);
    const x = (xBase + Math.sin(time * 0.55 + index * 1.7) * 18 + width) % width;
    const radius = 0.7 + (index % 3) * 0.65;
    ctx.globalAlpha = 0.12 + (index % 4) * 0.045;
    ctx.fillStyle = index % 3 === 0 ? '#F43F5E' : '#38BDF8';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.16,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.72,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.48)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
};

export const drawLaserRopeArenaFrame = (
  ctx: CanvasRenderingContext2D,
  metrics: LaserRopeArenaMetrics,
  time: number,
  isFeverActive: boolean,
  mode: LaserRopeMode,
): void => {
  const frameColor = isFeverActive
    ? '#FACC15'
    : mode === 'HIGH'
      ? '#A855F7'
      : '#38BDF8';
  const { frameHalfWidth, frameTop, frameBottom, radiusX, radiusY } = metrics;
  const frameWidth = frameHalfWidth * 2;
  const frameHeight = frameBottom - frameTop;

  ctx.save();

  const panelGradient = ctx.createLinearGradient(0, frameTop, 0, frameBottom);
  panelGradient.addColorStop(0, 'rgba(15,23,42,0.18)');
  panelGradient.addColorStop(0.55, 'rgba(8,12,22,0.09)');
  panelGradient.addColorStop(1, 'rgba(15,23,42,0.32)');
  ctx.fillStyle = panelGradient;
  ctx.beginPath();
  ctx.roundRect(-frameHalfWidth, frameTop, frameWidth, frameHeight, 24);
  ctx.fill();

  ctx.globalAlpha = 0.68;
  ctx.strokeStyle = frameColor;
  ctx.shadowColor = frameColor;
  ctx.shadowBlur = 18;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-frameHalfWidth, frameTop, frameWidth, frameHeight, 24);
  ctx.stroke();

  ctx.globalAlpha = 0.24;
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(
    -frameHalfWidth + 7,
    frameTop + 7,
    frameWidth - 14,
    frameHeight - 14,
    18,
  );
  ctx.stroke();
  ctx.globalAlpha = 1;

  const corner = 22 + Math.sin(time * 2.2) * 2.2;
  const cornerPoints = [
    { x: -frameHalfWidth, y: frameTop, sx: 1, sy: 1 },
    { x: frameHalfWidth, y: frameTop, sx: -1, sy: 1 },
    { x: -frameHalfWidth, y: frameBottom, sx: 1, sy: -1 },
    { x: frameHalfWidth, y: frameBottom, sx: -1, sy: -1 },
  ];
  ctx.strokeStyle = mode === 'HIGH' ? '#C084FC' : '#F43F5E';
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = 12;
  ctx.lineWidth = 3;
  for (const point of cornerPoints) {
    ctx.beginPath();
    ctx.moveTo(point.x, point.y + point.sy * corner);
    ctx.lineTo(point.x, point.y);
    ctx.lineTo(point.x + point.sx * corner, point.y);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  const floorGradient = ctx.createRadialGradient(0, -8, 8, 0, 0, radiusX);
  floorGradient.addColorStop(0, 'rgba(30,41,59,0.82)');
  floorGradient.addColorStop(0.5, 'rgba(15,23,42,0.7)');
  floorGradient.addColorStop(1, 'rgba(2,6,23,0.88)');
  ctx.fillStyle = floorGradient;
  ctx.strokeStyle = 'rgba(100,116,139,0.7)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = isFeverActive
    ? 'rgba(250,204,21,0.74)'
    : 'rgba(56,189,248,0.58)';
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = 10;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, radiusX * 0.57, radiusY * 0.57, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = mode === 'HIGH'
    ? 'rgba(192,132,252,0.68)'
    : 'rgba(244,63,94,0.58)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, radiusY * 0.55, radiusX * 0.18, radiusY * 0.17, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(148,163,184,0.24)';
  ctx.lineWidth = 1;
  for (let index = 0; index < 24; index++) {
    const angle = (Math.PI * 2 * index) / 24;
    const innerX = Math.cos(angle) * radiusX * 0.79;
    const innerY = Math.sin(angle) * radiusY * 0.79;
    const outerX = Math.cos(angle) * radiusX * 0.92;
    const outerY = Math.sin(angle) * radiusY * 0.92;
    ctx.beginPath();
    ctx.moveTo(innerX, innerY);
    ctx.lineTo(outerX, outerY);
    ctx.stroke();
  }

  ctx.restore();
};

const quadraticPoint = (
  startX: number,
  startY: number,
  controlX: number,
  controlY: number,
  endX: number,
  endY: number,
  t: number,
) => {
  const inverse = 1 - t;
  return {
    x: inverse * inverse * startX + 2 * inverse * t * controlX + t * t * endX,
    y: inverse * inverse * startY + 2 * inverse * t * controlY + t * t * endY,
  };
};

export const drawLaserRopeBeam = (
  ctx: CanvasRenderingContext2D,
  endX: number,
  endY: number,
  heightOffset: number,
  color: string,
  time: number,
  intensity = 1,
): void => {
  const startX = 0;
  const startY = -8 + heightOffset;
  const controlX = endX * 0.5;
  const controlY = endY * 0.5 + 6;
  const drawPath = () => {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(controlX, controlY, endX, endY);
    ctx.stroke();
  };

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.globalAlpha = 0.18 * intensity;
  ctx.strokeStyle = color;
  ctx.lineWidth = 18;
  ctx.shadowColor = color;
  ctx.shadowBlur = 26;
  drawPath();

  ctx.globalAlpha = 0.86 * intensity;
  ctx.lineWidth = 7.5;
  ctx.shadowBlur = 14;
  drawPath();

  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2.1;
  ctx.shadowColor = '#FFFFFF';
  ctx.shadowBlur = 7;
  drawPath();
  ctx.shadowBlur = 0;

  for (let index = 0; index < 3; index++) {
    const pulseT = (time * 0.72 + index * 0.31) % 1;
    const point = quadraticPoint(
      startX,
      startY,
      controlX,
      controlY,
      endX,
      endY,
      pulseT,
    );
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 2.5 + index * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 14;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(endX, endY, 8.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.arc(endX, endY, 4.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

export const drawLaserRopeHub = (
  ctx: CanvasRenderingContext2D,
  time: number,
  color: string,
  isFeverActive: boolean,
): void => {
  ctx.save();

  const bodyGradient = ctx.createLinearGradient(-13, -45, 13, 2);
  bodyGradient.addColorStop(0, '#0F172A');
  bodyGradient.addColorStop(0.5, '#334155');
  bodyGradient.addColorStop(1, '#0B1120');
  ctx.fillStyle = bodyGradient;
  ctx.strokeStyle = 'rgba(148,163,184,0.48)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(-13, -45, 26, 45, 8);
  ctx.fill();
  ctx.stroke();

  const pulse = 1 + Math.sin(time * 5.1) * 0.08;
  ctx.fillStyle = isFeverActive ? '#FFF7AE' : '#FFFFFF';
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.arc(0, -44, 9 * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -44, 17, 7, time * 0.9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = color;
  ctx.shadowBlur = 8;
  ctx.fillRect(-4, -30, 8, 18);
  ctx.shadowBlur = 0;

  ctx.restore();
};

export const drawLaserRopePlayerNode = (
  ctx: CanvasRenderingContext2D,
  presentation: LaserRopePlayerPresentation,
): void => {
  const {
    playerY,
    isSliding,
    isGrounded,
    jumpCount,
    hasShield,
    isFeverActive,
    time,
  } = presentation;
  const nodeY = -playerY + (isSliding ? 20 : 10);
  const shadowScale = Math.max(0.28, 1 - playerY / 150);
  const primary = isFeverActive ? '#FACC15' : isSliding ? '#34D399' : '#38BDF8';
  const secondary = isSliding ? '#10B981' : '#F43F5E';
  const corePulse = 1 + Math.sin(time * 6.4) * 0.055;

  ctx.save();

  ctx.fillStyle = 'rgba(0,0,0,0.54)';
  ctx.beginPath();
  ctx.ellipse(
    0,
    28,
    (isSliding ? 27 : 19) * shadowScale,
    7.5 * shadowScale,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.translate(0, nodeY);
  if (isSliding) ctx.scale(1.38, 0.72);

  const aura = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
  aura.addColorStop(0, 'rgba(255,255,255,0.2)');
  aura.addColorStop(0.42, `${primary}44`);
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.fill();

  if (hasShield) {
    ctx.strokeStyle = '#C084FC';
    ctx.shadowColor = '#A855F7';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 2.2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, 28, time * 0.7, time * 0.7 + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
  }

  ctx.strokeStyle = primary;
  ctx.shadowColor = primary;
  ctx.shadowBlur = 16;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, 0, 20 * corePulse, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = secondary;
  ctx.globalAlpha = 0.72;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 25, time * -0.8, time * -0.8 + Math.PI * 1.45);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const shellRadius = 14 * corePulse;
  const shellGradient = ctx.createRadialGradient(-4, -5, 1, 0, 0, shellRadius + 4);
  shellGradient.addColorStop(0, '#FFFFFF');
  shellGradient.addColorStop(0.26, '#E0F2FE');
  shellGradient.addColorStop(0.58, primary);
  shellGradient.addColorStop(1, '#0F172A');
  ctx.fillStyle = shellGradient;
  ctx.shadowColor = primary;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  for (let index = 0; index < 6; index++) {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / 6;
    const x = Math.cos(angle) * shellRadius;
    const y = Math.sin(angle) * shellRadius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-7, -2);
  ctx.lineTo(8, -2);
  ctx.stroke();

  for (let index = 0; index < 3; index++) {
    const orbitAngle = time * 1.8 + (Math.PI * 2 * index) / 3;
    const orbitX = Math.cos(orbitAngle) * 24;
    const orbitY = Math.sin(orbitAngle) * 11;
    ctx.fillStyle = index === 1 ? secondary : primary;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(orbitX, orbitY, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  if (!isGrounded) {
    const thrust = jumpCount >= 2 ? '#F43F5E' : '#FACC15';
    ctx.fillStyle = thrust;
    ctx.shadowColor = thrust;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(-8, 14);
    ctx.lineTo(-4, 25 + Math.sin(time * 14) * 3);
    ctx.lineTo(0, 14);
    ctx.moveTo(1, 14);
    ctx.lineTo(5, 25 + Math.cos(time * 13) * 3);
    ctx.lineTo(9, 14);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
};

export const drawLaserRopeOrb = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  pulse: number,
): void => {
  const scale = 1 + Math.sin(pulse) * 0.08;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.64;
  ctx.beginPath();
  ctx.arc(x, y, 11 * scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const gradient = ctx.createRadialGradient(x - 2, y - 3, 1, x, y, 8 * scale);
  gradient.addColorStop(0, '#FFFFFF');
  gradient.addColorStop(0.35, color);
  gradient.addColorStop(1, '#0F172A');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, 7.5 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};
