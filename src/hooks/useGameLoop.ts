import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { createGameResizeInfo, type GameResizeInfo } from '../lib/gameCoordinates';
import { getSafeCanvasDpr } from '../lib/mobileRuntime';

function useLatestCallback<T extends (...args: any[]) => any>(callback: T) {
  const ref = useRef<T>(callback);
  useLayoutEffect(() => {
    ref.current = callback;
  });
  return ref;
}

interface UseGameLoopProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  isPaused: boolean;
  onUpdate: (ctx: CanvasRenderingContext2D, dt: number, width: number, height: number) => void | boolean;
  onResize?: (width: number, height: number, resize: GameResizeInfo) => void;
}

const MIN_RENDER_DIMENSION = 4;

export const useGameLoop = ({ canvasRef, isPaused, onUpdate, onResize }: UseGameLoopProps) => {
  const isPausedRef = useRef(isPaused);
  const hasDrawnPaused = useRef(false);
  const lastTimeRef = useRef<number>(performance.now());
  const dimensionsRef = useRef({ width: 0, height: 0, dpr: 1 });

  const onUpdateRef = useLatestCallback(onUpdate);
  const onResizeRef = useLatestCallback(onResize ?? (() => {}));

  useEffect(() => {
    isPausedRef.current = isPaused;
    if (!isPaused) {
      hasDrawnPaused.current = false;
      lastTimeRef.current = performance.now();
    }
  }, [isPaused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const parent = canvas.parentElement;
    if (!ctx || !parent) return;

    let animationFrameId = 0;
    let resizeFrameId = 0;
    let isRunning = true;
    let fatalErrorReported = false;

    const drawFatalFrame = (error: unknown) => {
      const { width, height, dpr } = dimensionsRef.current;
      if (width < MIN_RENDER_DIMENSION || height < MIN_RENDER_DIMENSION) return;

      // Reset any unbalanced context state left by the failing frame.
      const backingWidth = canvas.width;
      canvas.width = backingWidth;

      const message = error instanceof Error ? error.message : String(error);
      ctx.save();
      try {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#09090B';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#18181B';
        ctx.strokeStyle = '#F43F5E';
        ctx.lineWidth = 2;
        const panelWidth = Math.min(360, Math.max(220, width - 32));
        const panelHeight = 132;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;
        ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
        ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px ui-monospace, monospace';
        ctx.fillText('GAME RENDER ERROR', width / 2, panelY + 34);
        ctx.fillStyle = '#A1A1AA';
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillText('Restart the game or update the browser.', width / 2, panelY + 62);
        if (message) {
          const compactMessage = message.length > 58 ? `${message.slice(0, 55)}…` : message;
          ctx.fillStyle = '#71717A';
          ctx.font = '10px ui-monospace, monospace';
          ctx.fillText(compactMessage, width / 2, panelY + 94);
        }
      } finally {
        ctx.restore();
      }
    };

    const reportFatalError = (error: unknown) => {
      if (fatalErrorReported) return;
      fatalErrorReported = true;
      isRunning = false;
      console.error('Micro Arcade game-loop failure:', error);
      drawFatalFrame(error);
      window.dispatchEvent(
        new CustomEvent('arcade:game-loop-error', {
          detail: {
            message: error instanceof Error ? error.message : String(error),
          },
        }),
      );
    };

    const measureCanvas = () => {
      resizeFrameId = 0;
      const rect = parent.getBoundingClientRect();
      const measuredWidth = Math.round(rect.width || parent.clientWidth || canvas.clientWidth);
      const measuredHeight = Math.round(rect.height || parent.clientHeight || canvas.clientHeight);

      // Mobile flex layouts can briefly report zero while browser chrome settles.
      // Defer initialization rather than creating a 1×1 logical game world.
      if (
        measuredWidth < MIN_RENDER_DIMENSION ||
        measuredHeight < MIN_RENDER_DIMENSION
      ) {
        if (isRunning) scheduleMeasure();
        return;
      }

      const width = measuredWidth;
      const height = measuredHeight;
      const dpr = getSafeCanvasDpr(width, height, window.devicePixelRatio || 1);
      const backingWidth = Math.max(1, Math.round(width * dpr));
      const backingHeight = Math.max(1, Math.round(height * dpr));
      const previous = dimensionsRef.current;
      const sizeChanged = previous.width !== width || previous.height !== height;
      const backingChanged =
        canvas.width !== backingWidth ||
        canvas.height !== backingHeight ||
        Math.abs(previous.dpr - dpr) > 0.001;

      if (!sizeChanged && !backingChanged) return;

      if (backingChanged) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }

      dimensionsRef.current = { width, height, dpr };
      hasDrawnPaused.current = false;

      if (sizeChanged) {
        try {
          onResizeRef.current(
            width,
            height,
            createGameResizeInfo(previous.width, previous.height, width, height),
          );
        } catch (error) {
          reportFatalError(error);
        }
      }
    };

    function scheduleMeasure() {
      if (!isRunning) return;
      if (resizeFrameId) cancelAnimationFrame(resizeFrameId);
      resizeFrameId = requestAnimationFrame(measureCanvas);
    }

    measureCanvas();
    scheduleMeasure();

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleMeasure);
    resizeObserver?.observe(parent);
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('orientationchange', scheduleMeasure);
    window.visualViewport?.addEventListener('resize', scheduleMeasure);
    window.visualViewport?.addEventListener('scroll', scheduleMeasure);

    const loop = (time: number) => {
      if (!isRunning) return;

      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = time;

      if (isPausedRef.current) {
        if (hasDrawnPaused.current) {
          animationFrameId = requestAnimationFrame(loop);
          return;
        }
        hasDrawnPaused.current = true;
      }

      const { width, height, dpr } = dimensionsRef.current;
      if (width < MIN_RENDER_DIMENSION || height < MIN_RENDER_DIMENSION) {
        scheduleMeasure();
        animationFrameId = requestAnimationFrame(loop);
        return;
      }

      let shouldContinue: void | boolean;
      ctx.save();
      try {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        shouldContinue = onUpdateRef.current(ctx, dt, width, height);
      } catch (error) {
        reportFatalError(error);
        return;
      } finally {
        try {
          ctx.restore();
        } catch {
          // The fatal-frame renderer resets the entire context if a game left an
          // invalid save stack, so cleanup failure must not hide the original error.
        }
      }

      if (shouldContinue === false) {
        isRunning = false;
      } else {
        animationFrameId = requestAnimationFrame(loop);
      }
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      isRunning = false;
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('orientationchange', scheduleMeasure);
      window.visualViewport?.removeEventListener('resize', scheduleMeasure);
      window.visualViewport?.removeEventListener('scroll', scheduleMeasure);
      if (resizeFrameId) cancelAnimationFrame(resizeFrameId);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [canvasRef]);
};

export const useSafeTimeout = () => {
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      timeouts.current.forEach(clearTimeout);
    };
  }, []);

  const setSafeTimeout = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(() => {
      timeouts.current = timeouts.current.filter((timeoutId) => timeoutId !== id);
      fn();
    }, delay);
    timeouts.current.push(id);
    return id;
  }, []);

  return setSafeTimeout;
};

export const useSafeInterval = () => {
  const intervals = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(() => {
    return () => {
      intervals.current.forEach(clearInterval);
    };
  }, []);

  const setSafeInterval = useCallback((fn: () => void, delay: number) => {
    const id = setInterval(fn, delay);
    intervals.current.push(id);
    return id;
  }, []);

  return setSafeInterval;
};
