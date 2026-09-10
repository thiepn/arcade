import assert from 'node:assert/strict';
import {
  getStoredStats,
  recordGamePlay,
  recordScore,
  toggleFavoriteGame,
  clearAllStats,
  isProgressSaved,
  getStorageStatus,
  retryStoragePersistence,
} from '../src/lib/storage.ts';
import { requestLeaderboardJson } from '../src/lib/leaderboardRequest.ts';

const localValues = new Map();
const sessionValues = new Map();
let localReadDenied = false;
let localWriteDenied = false;
let v3WriteDenied = false;
let sessionDenied = false;
globalThis.window = new EventTarget();
globalThis.localStorage = {
  getItem(key) {
    if (localReadDenied) throw new DOMException('Storage blocked', 'SecurityError');
    return localValues.get(key) ?? null;
  },
  setItem(key, value) {
    if (v3WriteDenied && key === 'micro_arcade_stats_v3') throw new DOMException('Quota exceeded', 'QuotaExceededError');
    if (localWriteDenied) throw new DOMException('Quota exceeded', 'QuotaExceededError');
    localValues.set(key, value);
  },
  removeItem(key) {
    if (localWriteDenied) throw new DOMException('Storage blocked', 'SecurityError');
    localValues.delete(key);
  },
};
globalThis.sessionStorage = {
  getItem(key) {
    if (sessionDenied) throw new DOMException('Session storage blocked', 'SecurityError');
    return sessionValues.get(key) ?? null;
  },
  setItem(key, value) {
    if (sessionDenied) throw new DOMException('Session storage blocked', 'SecurityError');
    sessionValues.set(key, value);
  },
  removeItem(key) {
    if (sessionDenied) throw new DOMException('Session storage blocked', 'SecurityError');
    sessionValues.delete(key);
  },
};

const key = 'micro_arcade_stats_v3';
const previousKey = 'micro_arcade_stats_v2';
const sessionKey = 'micro_arcade_stats_v3_session_fallback';
const sessionReplaceKey = 'micro_arcade_stats_v3_session_replace';
for (const malformed of ['null', '[]', 'true', '42', '"old"', '{broken']) {
  clearAllStats();
  localValues.set(key, malformed);
  assert.deepEqual(getStoredStats().highScores, {});
  assert.doesNotThrow(() => toggleFavoriteGame('orbit'));
}

localValues.set(key, JSON.stringify({ highScores: { orbit: 450, stack: 'oops', bad: -1 }, playCounts: 'bad', favorites: ['orbit', {}, 'orbit'], recentlyPlayed: [1, 'stack'], soundEnabled: 'false', volume: 100 }));
assert.deepEqual(getStoredStats().highScores, { orbit: 300 });
assert.deepEqual(getStoredStats().legacyHighScores, { orbit: 450 });
assert.equal(getStoredStats().scoreVersion, 2);
assert.deepEqual(getStoredStats().favorites, ['orbit']);
assert.deepEqual(getStoredStats().recentlyPlayed, ['stack']);
assert.equal(getStoredStats().volume, 1);
assert.equal(getStoredStats().soundEnabled, true);
for (const score of [NaN, Infinity, -1]) assert.equal(recordScore('orbit', score).stats.highScores.orbit, 300);
recordGamePlay('orbit');

// Migration must never delete the only durable older schema merely to make room
// for v3. Simulate a quota error that blocks only the v3 write while deletion is
// otherwise allowed: v2 stays intact until v3 is actually durable.
clearAllStats();
localValues.delete(key);
localValues.set(previousKey, JSON.stringify({ scoreVersion: 2, highScores: { orbit: 321 }, rawHighScores: { orbit: 481 }, favorites: ['orbit'] }));
v3WriteDenied = true;
const migrationFallback = getStoredStats();
assert.equal(migrationFallback.highScores.orbit, 321);
assert.deepEqual(migrationFallback.favorites, ['orbit']);
assert(localValues.has(previousKey), 'Migration source was deleted before v3 became durable');
assert.equal(getStorageStatus().mode, 'session');
assert(sessionValues.has(sessionKey), 'Migration should fall back to a session snapshot');
v3WriteDenied = false;
assert.equal(retryStoragePersistence(), true);
assert.equal(getStorageStatus().mode, 'persistent');
assert.equal(JSON.parse(localValues.get(key)).highScores.orbit, 321);
assert.equal(localValues.has(previousKey), false, 'Obsolete v2 source should be removed only after v3 succeeds');

// A primary write failure is no longer treated as total data loss. The complete
// snapshot falls back to sessionStorage and can be recovered automatically.
localWriteDenied = true;
recordScore('orbit', 900);
toggleFavoriteGame('stack');
assert.equal(getStoredStats().highScores.orbit, 900);
assert.deepEqual(getStoredStats().favorites, ['orbit', 'stack']);
assert.equal(getStorageStatus().mode, 'session');
assert.equal(getStorageStatus().warning, false);
assert.equal(isProgressSaved(), true);
assert(sessionValues.has(sessionKey), 'Expected a session fallback snapshot');

localWriteDenied = false;
assert.equal(retryStoragePersistence(), true);
assert.equal(getStorageStatus().mode, 'persistent');
assert.equal(getStorageStatus().consecutivePersistentFailures, 0);
assert.equal(sessionValues.has(sessionKey), false, 'Recovered session snapshot should be removed');
assert.equal(JSON.parse(localValues.get(key)).highScores.orbit, 900);

// Quota-style writes can fail while reads still work. If sessionStorage also
// fails, the newer dirty in-memory snapshot must remain authoritative instead of
// being replaced by the older readable localStorage record.
localWriteDenied = true;
sessionDenied = true;
recordScore('orbit', 1100);
assert.equal(getStorageStatus().mode, 'memory');
assert.equal(getStoredStats().highScores.orbit, 1100);
assert.equal(JSON.parse(localValues.get(key)).highScores.orbit, 900);
localWriteDenied = false;
sessionDenied = false;
assert.equal(retryStoragePersistence(), true);
assert.equal(JSON.parse(localValues.get(key)).highScores.orbit, 1100);

// If both browser stores really are blocked, memory fallback remains loss-safe
// for the current visit, but only repeated confirmed failure raises a warning.
localReadDenied = true;
localWriteDenied = true;
sessionDenied = true;
recordScore('orbit', 1200);
const blockedStatus = getStorageStatus();
assert.equal(blockedStatus.mode, 'memory');
assert.equal(blockedStatus.warning, true);
assert(blockedStatus.consecutivePersistentFailures >= 2);
assert.equal(isProgressSaved(), false);
assert.equal(getStoredStats().highScores.orbit, 1200);

// Restoring browser storage must heal the current snapshot without losing the
// score earned while persistence was unavailable.
localReadDenied = false;
localWriteDenied = false;
sessionDenied = false;
assert.equal(retryStoragePersistence(), true);
assert.equal(getStorageStatus().mode, 'persistent');
assert.equal(getStorageStatus().warning, false);
assert.equal(JSON.parse(localValues.get(key)).highScores.orbit, 1200);

// Destructive reset is authoritative even when it has to use session fallback;
// old durable scores must not reappear when primary storage becomes writable.
localWriteDenied = true;
const clearedWhileDegraded = clearAllStats();
assert.deepEqual(clearedWhileDegraded.highScores, {});
assert.equal(getStorageStatus().mode, 'session');
assert.equal(sessionValues.get(sessionReplaceKey), '1');
assert.equal(JSON.parse(localValues.get(key)).highScores.orbit, 1200);
localWriteDenied = false;
assert.equal(retryStoragePersistence(), true);
assert.deepEqual(JSON.parse(localValues.get(key)).highScores, {});
assert.equal(sessionValues.has(sessionReplaceKey), false);

const defaults = clearAllStats();
defaults.favorites.push('orbit');
assert.deepEqual(getStoredStats().favorites, []);

globalThis.fetch = async (_url, init) => new Promise((_, reject) => {
  init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
});
await assert.rejects(requestLeaderboardJson('https://example.invalid', {}, 20), error => error.code === 'timeout');
globalThis.fetch = async () => new Response('{}', { status: 429 });
await assert.rejects(requestLeaderboardJson('https://example.invalid'), error => error.code === 'rate_limited');
globalThis.fetch = async () => new Response('{broken');
await assert.rejects(requestLeaderboardJson('https://example.invalid'), error => error.code === 'invalid_response');
globalThis.fetch = async () => Response.json({ ok: true });
assert.deepEqual(await requestLeaderboardJson('https://example.invalid'), { ok: true });
console.log('RC storage/request regression passed: corrupt schemas, safe migration fallback, session fallback, dirty-memory preservation, reset authority, confirmed hard failure, automatic recovery, bounded requests, typed errors.');
