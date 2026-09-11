import { type RefObject, useLayoutEffect } from 'react';
import { getSafeCanvasDpr } from '../lib/mobileRuntime';

/**
 * Keeps a canvas backing store aligned with its rendered box while preserving a
 * stable logical simulation coordinate system. Ownership is component-scoped:
 * every observer/listener/rAF is removed when the game unmounts.
 */
export function useLogicalCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  logicalWidth: number,
  logicalHeight: number,
): void {
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === 'undefined') return;

    let frame = 0;
    const resize = () => {
      frame = 0;
      if (!canvas.isConnected) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) return;

      const dpr = getSafeCanvasDpr(rect.width, rect.height, window.devicePixelRatio || 1);
      const backingWidth = Math.max(1, Math.round(rect.width * dpr));
      const backingHeight = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== backingWidth) canvas.width = backingWidth;
      if (canvas.height !== backingHeight) canvas.height = backingHeight;
      canvas.getContext('2d')?.setTransform(
        backingWidth / logicalWidth,
        0,
        0,
        backingHeight / logicalHeight,
        0,
        0,
      );
    };

    const schedule = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(resize);
    };

    // Do this synchronously before paint. WebKit can defer ResizeObserver/rAF
    // callbacks long enough for the first frame to expose a stretched bitmap.
    resize();

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(canvas);
    window.addEventListener('resize', schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', schedule, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, [canvasRef, logicalHeight, logicalWidth]);
}
