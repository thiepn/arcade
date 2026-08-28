const baseUrl = process.env.LEADERBOARD_SMOKE_URL || 'http://127.0.0.1:8787';
const origin = 'http://localhost:3000';

async function request(path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('origin', origin);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const health = await request('/v1/health');
assert(health.ok, `health failed: ${health.status}`);
assert(health.headers.get('access-control-allow-origin') === origin, 'expected allowed CORS origin');

const guestResponse = await request('/v1/guest', { method: 'POST', body: '{}' });
assert(guestResponse.status === 201, `guest creation failed: ${guestResponse.status}`);
const guest = await guestResponse.json();
assert(typeof guest.credential === 'string' && guest.credential.includes('.'), 'guest credential missing');
const auth = { authorization: `Bearer ${guest.credential}` };

const meResponse = await request('/v1/me', { headers: auth });
assert(meResponse.ok, `me failed: ${meResponse.status}`);

const sessionStartedAt = Date.now();
const sessionResponse = await request('/v1/sessions', {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ gameId: 'reaction' }),
});
assert(sessionResponse.status === 201, `session failed: ${sessionResponse.status}`);
const sessionData = await sessionResponse.json();
assert(sessionData.session?.id, 'session id missing');

await new Promise((resolve) => setTimeout(resolve, 900));
const durationMs = Date.now() - sessionStartedAt;
const scoreResponse = await request('/v1/scores', {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ sessionId: sessionData.session.id, score: 500, durationMs }),
});
assert(scoreResponse.ok, `score submission failed: ${scoreResponse.status} ${await scoreResponse.text()}`);

const leaderboardResponse = await request('/v1/leaderboards/reaction?limit=10', { headers: auth });
assert(leaderboardResponse.ok, `leaderboard failed: ${leaderboardResponse.status}`);
const leaderboard = await leaderboardResponse.json();
assert(leaderboard.totalCompetitors === 1, 'expected exactly one ranked competitor');
assert(leaderboard.userEntry?.score === 500, 'authenticated user score missing from leaderboard');
assert(leaderboard.userEntry?.rank === 1, 'authenticated user should rank first');

const replayResponse = await request('/v1/scores', {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ sessionId: sessionData.session.id, score: 600, durationMs: durationMs + 50 }),
});
assert(replayResponse.status === 409, `replay should be rejected with 409, got ${replayResponse.status}`);

const overallResponse = await request('/v1/leaderboards/overall?limit=10', { headers: auth });
assert(overallResponse.ok, `overall leaderboard failed: ${overallResponse.status}`);
const overall = await overallResponse.json();
assert(overall.userEntry?.rank === 1, 'overall authenticated user should rank first');

console.log('Cloudflare leaderboard API smoke test passed');
