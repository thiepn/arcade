export const MAX_CANVAS_BACKING_PIXELS = 8_388_608;

const MIN_CANVAS_DPR = 1;
const MAX_CANVAS_DPR = 2;

export const getSafeCanvasDpr = (
  width: number,
  height: number,
  devicePixelRatio: number,
  maxBackingPixels = MAX_CANVAS_BACKING_PIXELS,
): number => {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const requestedDpr = Number.isFinite(devicePixelRatio)
    ? Math.max(MIN_CANVAS_DPR, Math.min(MAX_CANVAS_DPR, devicePixelRatio))
    : MIN_CANVAS_DPR;
  const areaLimitedDpr = Math.sqrt(
    Math.max(1, maxBackingPixels) / (safeWidth * safeHeight),
  );

  return Math.max(
    MIN_CANVAS_DPR,
    Math.min(requestedDpr, areaLimitedDpr),
  );
};

type RoundRectRadius = number | DOMPointInit;
type RoundRectRadii = RoundRectRadius | readonly RoundRectRadius[];

const radiusValue = (radius: RoundRectRadius | undefined): number => {
  if (typeof radius === 'number') return Math.max(0, radius);
  if (!radius) return 0;
  return Math.max(0, Math.max(radius.x ?? 0, radius.y ?? 0));
};

const normalizeRadii = (radii: RoundRectRadii): [number, number, number, number] => {
  const values = (Array.isArray(radii) ? radii : [radii]).map(radiusValue);
  if (values.length === 0) return [0, 0, 0, 0];
  if (values.length === 1) return [values[0], values[0], values[0], values[0]];
  if (values.length === 2) return [values[0], values[1], values[0], values[1]];
  if (values.length === 3) return [values[0], values[1], values[2], values[1]];
  return [values[0], values[1], values[2], values[3]];
};

export const appendRoundedRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radii: RoundRectRadii = 0,
): CanvasRenderingContext2D => {
  const left = Math.min(x, x + width);
  const right = Math.max(x, x + width);
  const top = Math.min(y, y + height);
  const bottom = Math.max(y, y + height);
  const maxRadius = Math.min((right - left) / 2, (bottom - top) / 2);
  const [rawTopLeft, rawTopRight, rawBottomRight, rawBottomLeft] = normalizeRadii(radii);
  const topLeft = Math.min(rawTopLeft, maxRadius);
  const topRight = Math.min(rawTopRight, maxRadius);
  const bottomRight = Math.min(rawBottomRight, maxRadius);
  const bottomLeft = Math.min(rawBottomLeft, maxRadius);

  ctx.moveTo(left + topLeft, top);
  ctx.lineTo(right - topRight, top);
  ctx.quadraticCurveTo(right, top, right, top + topRight);
  ctx.lineTo(right, bottom - bottomRight);
  ctx.quadraticCurveTo(right, bottom, right - bottomRight, bottom);
  ctx.lineTo(left + bottomLeft, bottom);
  ctx.quadraticCurveTo(left, bottom, left, bottom - bottomLeft);
  ctx.lineTo(left, top + topLeft);
  ctx.quadraticCurveTo(left, top, left + topLeft, top);
  ctx.closePath();
  return ctx;
};

const installRoundRectPolyfill = (): void => {
  if (typeof CanvasRenderingContext2D === 'undefined') return;
  const prototype = CanvasRenderingContext2D.prototype;
  if (typeof prototype.roundRect === 'function') return;

  Object.defineProperty(prototype, 'roundRect', {
    configurable: true,
    writable: true,
    value: function roundRectPolyfill(
      this: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
      radii: RoundRectRadii = 0,
    ): CanvasRenderingContext2D {
      return appendRoundedRectPath(this, x, y, width, height, radii);
    },
  });
};

let mobileRuntimeInstalled = false;

const syncViewportHeight = (): void => {
  const height = Math.max(
    1,
    Math.round(window.visualViewport?.height ?? window.innerHeight),
  );
  document.documentElement.style.setProperty(
    '--arcade-viewport-height',
    `${height}px`,
  );
};

export const installMobileRuntimeCompatibility = (): void => {
  if (
    mobileRuntimeInstalled ||
    typeof window === 'undefined' ||
    typeof document === 'undefined'
  ) {
    return;
  }

  mobileRuntimeInstalled = true;
  installRoundRectPolyfill();
  syncViewportHeight();

  const scheduleViewportSync = () => requestAnimationFrame(syncViewportHeight);
  window.addEventListener('resize', scheduleViewportSync, { passive: true });
  window.addEventListener('orientationchange', scheduleViewportSync, { passive: true });
  window.visualViewport?.addEventListener('resize', scheduleViewportSync, {
    passive: true,
  });
  window.visualViewport?.addEventListener('scroll', scheduleViewportSync, {
    passive: true,
  });
};
