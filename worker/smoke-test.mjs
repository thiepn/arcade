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
const me = await meResponse.json();
assert(me.player?.id, 'profile player id missing');
assert(Number.isFinite(me.player?.createdAt), 'profile creation timestamp missing');
assert(me.activity?.submissions === 0, 'new profile should start with zero submissions');

const renameResponse = await request('/v1/me', {
  method: 'PATCH',
  headers: auth,
  body: JSON.stringify({ name: 'Smoke Player' }),
});
assert(renameResponse.ok, `profile rename failed: ${renameResponse.status}`);

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
assert(overall.userEntry?.total_score === 500, 'overall score should use best score');

const weeklyResponse = await request('/v1/leaderboards/weekly?limit=10', { headers: auth });
assert(weeklyResponse.ok, `weekly leaderboard failed: ${weeklyResponse.status}`);
const weekly = await weeklyResponse.json();
assert(weekly.userEntry?.rank === 1, 'weekly authenticated user should rank first');
assert(weekly.userEntry?.total_score === 500, 'weekly combined score should include weekly best score');
assert(weekly.entries?.length === 1, 'weekly leaderboard should contain one overall player row');
assert(Number.isFinite(weekly.weekStart) && Number.isFinite(weekly.weekEnd), 'weekly boundary metadata missing');
assert(weekly.weekEnd - weekly.weekStart === 7 * 24 * 60 * 60 * 1000, 'weekly window should be seven days');

const invalidWeeklyGameResponse = await request('/v1/leaderboards/weekly/reaction', { headers: auth });
assert(invalidWeeklyGameResponse.status === 404, 'per-game weekly leaderboard endpoint must not exist');

const meAfterResponse = await request('/v1/me', { headers: auth });
assert(meAfterResponse.ok, `updated profile failed: ${meAfterResponse.status}`);
const meAfter = await meAfterResponse.json();
assert(meAfter.player?.name === 'Smoke Player', 'profile rename did not persist');
assert(meAfter.activity?.submissions === 1, 'profile submission count should reflect accepted run');
assert(meAfter.activity?.rankedGames === 1, 'profile ranked game count should reflect accepted run');

console.log('Cloudflare leaderboard + MA2 weekly/profile API smoke test passed');
