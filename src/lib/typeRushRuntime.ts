export const TYPE_RUSH_WORD_RENDER_HZ = 30;
export const TYPE_RUSH_WORD_RENDER_INTERVAL_MS = 1000 / TYPE_RUSH_WORD_RENDER_HZ;
export const TYPE_RUSH_WPM_RENDER_INTERVAL_MS = 250;

export const shouldSyncTypeRushUi = (
  currentTimeMs: number,
  lastSyncTimeMs: number,
  intervalMs: number,
) => currentTimeMs - lastSyncTimeMs >= intervalMs;
