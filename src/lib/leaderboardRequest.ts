export class LeaderboardError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 0) {
    super(message);
    this.name = 'LeaderboardError';
  }
}

/** Includes reading the body in the deadline; a server can stall after sending headers. */
export async function requestLeaderboardJson<T>(url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new LeaderboardError('offline', 'Offline. Your score stays on this device.');
  }
  const controller = new AbortController();
  const abort = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) abort();
  else init.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const code = response.status === 429 ? 'rate_limited' : response.status === 401 ? 'unauthorized' : response.status >= 500 ? 'unavailable' : 'rejected';
      throw new LeaderboardError(code, response.status === 429 ? 'Too many requests. Try again shortly.' : 'Global leaderboard unavailable. Your local progress is kept.', response.status);
    }
    return await response.json() as T;
  } catch (error) {
    if (error instanceof LeaderboardError) throw error;
    throw new LeaderboardError(controller.signal.aborted ? 'timeout' : 'unavailable', 'Global leaderboard unavailable. Your local progress is kept.');
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', abort);
  }
}
