import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { createGameResizeInfo, type GameResizeInfo } from '../lib/gameCoordinates';

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

    const measureCanvas = () => {
      resizeFrameId = 0;
      const rect = parent.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width || parent.clientWidth));
      const height = Math.max(1, Math.round(rect.height || parent.clientHeight));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const backingWidth = Math.max(1, Math.round(width * dpr));
      const backingHeight = Math.max(1, Math.round(height * dpr));
      const previous = dimensionsRef.current;
      const sizeChanged = previous.width !== width || previous.height !== height;
      const backingChanged =
        canvas.width !== backingWidth ||
        canvas.height !== backingHeight ||
        previous.dpr !== dpr;

      if (!sizeChanged && !backingChanged) return;

      if (backingChanged) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }

      dimensionsRef.current = { width, height, dpr };
      hasDrawnPaused.current = false;

      if (sizeChanged) {
        onResizeRef.current(
          width,
          height,
          createGameResizeInfo(previous.width, previous.height, width, height),
        );
      }
    };

    const scheduleMeasure = () => {
      if (resizeFrameId) cancelAnimationFrame(resizeFrameId);
      resizeFrameId = requestAnimationFrame(measureCanvas);
    };

    measureCanvas();
    scheduleMeasure();

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleMeasure);
    resizeObserver?.observe(parent);
    window.addEventListener('resize', scheduleMeasure);

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
      if (width <= 0 || height <= 0) {
        scheduleMeasure();
        animationFrameId = requestAnimationFrame(loop);
        return;
      }

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const shouldContinue = onUpdateRef.current(ctx, dt, width, height);
      ctx.restore();

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
