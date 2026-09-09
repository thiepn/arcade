import { toArcadePoints } from '../shared/scoring.ts';
import assert from 'node:assert/strict';
const base = process.env.LEADERBOARD_SMOKE_URL || 'http://127.0.0.1:8787';
const origin = process.env.LEADERBOARD_SMOKE_ORIGIN || 'https://thiepn.dev';
let credential;
async function request(path, method = 'GET', body, headers = {}) {
  return fetch(`${base}${path}`, { method, headers: { origin, ...(credential ? { authorization: `Bearer ${credential}` } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
}
async function status(response, expected) {
  assert.equal(response.status, expected, `Expected ${expected}, received ${response.status}: ${await response.clone().text()}`);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const json = await response.json();
  if (expected >= 400) assert.equal(typeof json.error, 'string');
  return json;
}
const preflight = await fetch(`${base}/v1/guest`, {
  method: 'OPTIONS',
  headers: {
    origin,
    'access-control-request-method': 'POST',
    'access-control-request-headers': 'content-type',
  },
  signal: AbortSignal.timeout(10000),
});
assert.equal(preflight.status, 204, 'Production guest preflight must be accepted');
assert.equal(preflight.headers.get('access-control-allow-origin'), origin, 'Production origin must receive Access-Control-Allow-Origin');
assert.match(preflight.headers.get('access-control-allow-methods') || '', /POST/);
await status(await request('/v1/me'), 401);
await status(await request('/v1/guest', 'POST', {}, { origin: 'https://untrusted.invalid' }), 403);
await status(await request('/v1/guest', 'POST', '{broken'), 400);
await status(await request('/v1/guest', 'POST', 'null'), 400);
await status(await request('/v1/guest', 'POST', '{}', { 'content-type': 'text/plain' }), 415);
await status(await request('/v1/guest', 'POST', JSON.stringify({ large: 'x'.repeat(5000) })), 413);
credential = (await status(await request('/v1/guest', 'POST', {}), 201)).credential;
for (const gameId of ['constructor', '__proto__', 'unknown', {}, 3]) {
  await status(await request('/v1/sessions', 'POST', { gameId }), 400);
}
await status(await request('/v1/me', 'PATCH', { name: 123 }), 400);
await status(await request('/v1/me', 'PATCH', { name: '<script>alert(1)</script>' }), 400);
const session = (await status(await request('/v1/sessions', 'POST', { gameId: 'stack' }), 201)).session;
const started = Date.now();
for (const score of ['100', null, true, -1, 1.5]) {
  await status(await request('/v1/scores', 'POST', { sessionId: session.id, score, durationMs: 500 }), 400);
}
await new Promise(resolve => setTimeout(resolve, 350));
await status(await request('/v1/scores', 'POST', { sessionId: session.id, score: 100, durationMs: '500' }), 400);
const submissions = await Promise.all([1, 2].map(() => request('/v1/scores', 'POST', { sessionId: session.id, score: 100, durationMs: Date.now() - started })));
assert.deepEqual(submissions.map(r => r.status).sort(), [200, 409], 'A play session must be consumed once under concurrency');
const profile = await status(await request('/v1/me'), 200);
assert.equal(profile.activity.submissions, 1);
assert.equal(profile.activity.rankedGames, 1);
const board = await status(await request('/v1/leaderboards/stack'), 200);
assert.equal(board.userEntry.score, toArcadePoints('stack',100,undefined,1));
await status(await request('/v1/leaderboards/constructor'), 404);
console.log('RC Worker regression passed: production CORS preflight, JSON errors, payload bounds, strict types, game allowlist, display names, concurrent replay, ranking integrity.');
