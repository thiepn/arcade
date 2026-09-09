import assert from 'node:assert/strict';
import { getStoredStats, recordGamePlay, recordScore, toggleFavoriteGame, clearAllStats, isProgressSaved } from '../src/lib/storage.ts';
import { requestLeaderboardJson } from '../src/lib/leaderboardRequest.ts';

const values = new Map();
let denied = false;
globalThis.window = new EventTarget();
globalThis.localStorage = {
  getItem(key) { if (denied) throw new Error('Storage denied'); return values.get(key) ?? null; },
  setItem(key, value) { if (denied) throw new Error('Quota exceeded'); values.set(key, value); },
  removeItem(key) { values.delete(key); },
};
const key = 'micro_arcade_stats_v2';
for (const malformed of ['null', '[]', 'true', '42', '"old"', '{broken']) {
  clearAllStats(); values.set(key, malformed);
  assert.deepEqual(getStoredStats().highScores, {});
  assert.doesNotThrow(() => toggleFavoriteGame('orbit'));
}
values.set(key, JSON.stringify({ highScores: { orbit: 450, stack: 'oops', bad: -1 }, playCounts: 'bad', favorites: ['orbit', {}, 'orbit'], recentlyPlayed: [1, 'stack'], soundEnabled: 'false', volume: 100 }));
assert.deepEqual(getStoredStats().highScores, { orbit: 300 });
assert.deepEqual(getStoredStats().legacyHighScores, { orbit: 450 });
assert.equal(getStoredStats().scoreVersion, 2);
assert.deepEqual(getStoredStats().favorites, ['orbit']);
assert.deepEqual(getStoredStats().recentlyPlayed, ['stack']);
assert.equal(getStoredStats().volume, 1);
assert.equal(getStoredStats().soundEnabled, true);
for (const score of [NaN, Infinity, -1]) assert.equal(recordScore('orbit', score).stats.highScores.orbit, 300);
recordGamePlay('orbit');
denied = true;
recordScore('orbit', 900);
toggleFavoriteGame('stack');
assert.equal(getStoredStats().highScores.orbit, 900);
assert.deepEqual(getStoredStats().favorites, ['orbit', 'stack']);
assert.equal(isProgressSaved(), false);
denied = false;
recordGamePlay('orbit');
assert.equal(isProgressSaved(), true);
assert.equal(JSON.parse(values.get(key)).highScores.orbit, 900);
const defaults = clearAllStats(); defaults.favorites.push('orbit');
assert.deepEqual(getStoredStats().favorites, []);

globalThis.fetch = async (_url, init) => new Promise((_, reject) => {
  init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
});
await assert.rejects(requestLeaderboardJson('https://example.invalid', {}, 20), error => error.code === 'timeout');
globalThis.fetch = async () => new Response('{}', { status: 429 });
await assert.rejects(requestLeaderboardJson('https://example.invalid'), error => error.code === 'rate_limited');
globalThis.fetch = async () => new Response('{broken');
await assert.rejects(requestLeaderboardJson('https://example.invalid'), error => error.code === 'unavailable');
globalThis.fetch = async () => Response.json({ ok: true });
assert.deepEqual(await requestLeaderboardJson('https://example.invalid'), { ok: true });
console.log('RC storage/request regression passed: corrupt schemas, existing records, invalid scores, storage denial/recovery, bounded requests, typed errors.');
