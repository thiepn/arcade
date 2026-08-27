import React, { useEffect, useRef, useLayoutEffect, RefObject } from 'react';

// Polyfill for useEvent to keep callbacks fresh without triggering re-effects
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
  onResize?: (width: number, height: number) => void;
}

export const useGameLoop = ({ canvasRef, isPaused, onUpdate, onResize }: UseGameLoopProps) => {
  const isPausedRef = useRef(isPaused);
  const hasDrawnPaused = useRef(false);
  const lastTimeRef = useRef<number>(performance.now());
  const dimensionsRef = useRef({ width: 0, height: 0 });

  const onUpdateRef = useLatestCallback(onUpdate);
  const onResizeRef = onResize ? useLatestCallback(onResize) : null;

  useEffect(() => {
    isPausedRef.current = isPaused;
    if (!isPaused) {
      hasDrawnPaused.current = false;
      lastTimeRef.current = performance.now(); // Prevent large dt jump after unpausing
    }
  }, [isPaused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let isRunning = true;

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        dimensionsRef.current = { width: w, height: h };
        hasDrawnPaused.current = false; // Force redraw if resized while paused
        
        if (onResizeRef?.current) {
          onResizeRef.current(w, h);
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

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

      const { width, height } = dimensionsRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      
      ctx.save();
      ctx.scale(dpr, dpr);
      
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
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [canvasRef]); // Intentionally omitting refs to avoid re-triggering
};

export const useSafeTimeout = () => {
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      timeouts.current.forEach(clearTimeout);
    };
  }, []);

  const setSafeTimeout = (fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timeouts.current.push(id);
    return id;
  };

  return setSafeTimeout;
};

export const useSafeInterval = () => {
  const intervals = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(() => {
    return () => {
      intervals.current.forEach(clearInterval);
    };
  }, []);

  const setSafeInterval = (fn: () => void, delay: number) => {
    const id = setInterval(fn, delay);
    intervals.current.push(id);
    return id;
  };

  return setSafeInterval;
};
