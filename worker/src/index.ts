import { SCORE_VERSION, toArcadePoints } from '../../shared/scoring.ts';
import { GAME_RULES, SESSION_TTL_MS, scoreContext } from '../../shared/scoringProtocol.ts';

const encoder = new TextEncoder();
const MAX_LEADERBOARD_LIMIT = 50;
const MAX_BODY_BYTES = 4096;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('origin');
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
  const headers: Record<string, string> = {
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
    'access-control-max-age': '86400',
    'vary': 'Origin',
  };
  if (origin && allowed.includes(origin)) headers['access-control-allow-origin'] = origin;
  return headers;
}

function secureHeaders(): Record<string, string> {
  return {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  };
}

function response(request: Request, env: Env, data: unknown, status = 200): Response {
  return json(data, status, { ...corsHeaders(request, env), ...secureHeaders() });
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomSecret(size = 32): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function credentialHash(env: Env, secret: string): Promise<string> {
  if (!env.CREDENTIAL_PEPPER) throw new Error('CREDENTIAL_PEPPER is not configured');
  return sha256(`${env.CREDENTIAL_PEPPER}:${secret}`);
}

function countryCode(request: Request): string {
  const cf = (request as Request & { cf?: { country?: string } }).cf;
  const code = cf?.country?.toUpperCase() || 'XX';
  return /^[A-Z]{2}$/.test(code) ? code : 'XX';
}

function displayNameFor(id: string): string {
  return `Player-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

function parseLimit(url: URL): number {
  const parsed = Number(url.searchParams.get('limit') || '10');
  if (!Number.isInteger(parsed)) return 10;
  return Math.max(1, Math.min(MAX_LEADERBOARD_LIMIT, parsed));
}

function utcWeekBounds(now = Date.now()): { start: number; end: number } {
  const date = new Date(now);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - mondayOffset, 0, 0, 0, 0);
  return { start, end: start + WEEK_MS };
}

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

async function readJson<T>(request: Request): Promise<T> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.split(';')[0].trim().toLowerCase() !== 'application/json') throw new ApiError(415, 'invalid_content_type', 'Expected application/json');
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) throw new ApiError(413, 'payload_too_large', 'Request too large');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'invalid_json', 'Expected a JSON object');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new ApiError(413, 'payload_too_large', 'Request too large');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Not an object');
    return data as T;
  } catch { throw new ApiError(400, 'invalid_json', 'Expected a JSON object'); }
}

interface PlayerRow {
  id: string;
  display_name: string;
  country_code: string;
  created_at: number;
}

async function authenticate(request: Request, env: Env, optional = false): Promise<PlayerRow | null> {
  const header = request.headers.get('authorization');
  if (!header) {
    if (optional) return null;
    throw new Response('Unauthorized', { status: 401 });
  }
  const match = /^Bearer\s+([0-9a-f-]{36})\.([A-Za-z0-9_-]{20,128})$/i.exec(header);
  if (!match) throw new Response('Unauthorized', { status: 401 });
  const [, playerId, secret] = match;
  const hash = await credentialHash(env, secret);
  const player = await env.DB.prepare(
    'SELECT id, display_name, country_code, created_at FROM players WHERE id = ? AND credential_hash = ?'
  ).bind(playerId, hash).first<PlayerRow>();
  if (!player) throw new Response('Unauthorized', { status: 401 });
  if (request.method !== 'GET') {
    await env.DB.prepare('UPDATE players SET last_seen_at = ? WHERE id = ?').bind(Date.now(), player.id).run();
  }
  return player;
}

async function rateLimit(binding: RateLimit, key: string): Promise<void> {
  const result = await binding.limit({ key });
  if (!result.success) throw new Response('Too Many Requests', { status: 429 });
}

async function createGuest(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  await rateLimit(env.GUEST_RATE_LIMITER, ip);
  await readJson<Record<string, unknown>>(request);
  const now = Date.now();
  const id = crypto.randomUUID();
  const secret = randomSecret();
  const hash = await credentialHash(env, secret);
  const name = displayNameFor(id);
  const country = countryCode(request);
  await env.DB.prepare(
    'INSERT INTO players (id, credential_hash, display_name, country_code, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, hash, name, country, now, now).run();
  return response(request, env, {
    credential: `${id}.${secret}`,
    player: { id, name, countryCode: country, createdAt: now },
  }, 201);
}

async function getMe(request: Request, env: Env): Promise<Response> {
  const player = await authenticate(request, env);
  const activity = await env.DB.prepare(
    `SELECT COUNT(*) AS submissions, COUNT(DISTINCT game_id) AS ranked_games
     FROM score_submissions WHERE player_id = ?`
  ).bind(player!.id).first<{ submissions: number; ranked_games: number }>();
  return response(request, env, {
    player: {
      id: player!.id,
      name: player!.display_name,
      countryCode: player!.country_code,
      createdAt: player!.created_at,
    },
    activity: {
      submissions: activity?.submissions ?? 0,
      rankedGames: activity?.ranked_games ?? 0,
    },
  });
}

async function updateMe(request: Request, env: Env): Promise<Response> {
  const player = await authenticate(request, env);
  await rateLimit(env.SESSION_RATE_LIMITER, player!.id);
  const body = await readJson<{ name?: string }>(request);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!/^[A-Za-z0-9 _.-]{3,20}$/.test(name)) {
    return response(request, env, { error: 'Name must be 3-20 characters using letters, numbers, spaces, _ . or -.' }, 400);
  }
  await env.DB.prepare('UPDATE players SET display_name = ?, last_seen_at = ? WHERE id = ?')
    .bind(name, Date.now(), player!.id).run();
  return response(request, env, {
    player: { id: player!.id, name, countryCode: player!.country_code, createdAt: player!.created_at },
  });
}

async function createSession(request: Request, env: Env): Promise<Response> {
  const player = await authenticate(request, env);
  await rateLimit(env.SESSION_RATE_LIMITER, player!.id);
  const body = await readJson<{ gameId?: string; scoreVersion?: number; modeId?: string }>(request);
  const gameId = typeof body.gameId === 'string' ? body.gameId : '';
  if (!Object.hasOwn(GAME_RULES, gameId)) return response(request, env, { error: 'Unknown game', code: 'unknown_game' }, 400);
  const context = scoreContext(gameId, body.scoreVersion, body.modeId);
  if (!context) return response(request, env, { error: 'Unsupported scoring version or mode', code: 'invalid_score_context' }, 400);
  const now = Date.now();
  const id = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO play_sessions (id, player_id, game_id, issued_at, expires_at, score_version, mode_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, player!.id, gameId, now, now + SESSION_TTL_MS, context.scoreVersion, context.modeId).run();
  return response(request, env, { scoreVersion: SCORE_VERSION, session: { id, gameId, issuedAt: now, expiresAt: now + SESSION_TTL_MS, ...context } }, 201);
}

interface SessionRow {
  id: string;
  player_id: string;
  game_id: string;
  issued_at: number;
  expires_at: number;
  used_at: number | null;
  score_version: number;
  mode_id: string;
}

async function submitScore(request: Request, env: Env): Promise<Response> {
  const player = await authenticate(request, env);
  await rateLimit(env.SCORE_RATE_LIMITER, player!.id);
  const body = await readJson<{ sessionId?: string; score?: number; durationMs?: number; scoreVersion?: number; modeId?: string }>(request);
  const { sessionId, score, durationMs } = body;
  if (typeof sessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(sessionId) || typeof score !== 'number' || !Number.isSafeInteger(score) || score < 0 || typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) {
    return response(request, env, { error: 'Invalid score submission' }, 400);
  }
  const session = await env.DB.prepare(
    'SELECT id, player_id, game_id, issued_at, expires_at, used_at, score_version, mode_id FROM play_sessions WHERE id = ? AND player_id = ?'
  ).bind(sessionId, player!.id).first<SessionRow>();
  if (!session) return response(request, env, { error: 'Unknown play session' }, 404);
  const context = scoreContext(session.game_id, body.scoreVersion, body.modeId);
  if (!context || context.scoreVersion !== session.score_version || context.modeId !== session.mode_id) return response(request, env, { error: 'Session scoring mode/version mismatch', code: 'score_context_mismatch' }, 422);
  if (session.used_at !== null) return response(request, env, { error: 'Play session already used' }, 409);
  const now = Date.now();
  if (now > session.expires_at) return response(request, env, { error: 'Play session expired' }, 410);
  const rule = GAME_RULES[session.game_id];
  const serverElapsed = now - session.issued_at;
  if (!rule || score > rule.maxScore) return response(request, env, { error: 'Score outside accepted range' }, 422);
  if (serverElapsed < rule.minDurationMs || serverElapsed > rule.maxDurationMs) {
    return response(request, env, { error: 'Session duration outside accepted range' }, 422);
  }
  if (Math.abs(serverElapsed - durationMs) > 90_000) {
    return response(request, env, { error: 'Session timing mismatch' }, 422);
  }

  const points = toArcadePoints(session.game_id, score, context.modeId, context.scoreVersion);
  const submissionId = crypto.randomUUID();
  const statements = [
    env.DB.prepare(
      'INSERT INTO score_submissions (id, session_id, player_id, game_id, score, duration_ms, created_at, raw_score, source_version, mode_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(submissionId, session.id, player!.id, session.game_id, points, Math.round(durationMs), now, score, context.scoreVersion, context.modeId),
    env.DB.prepare(
      `INSERT INTO best_scores (game_id, player_id, score, achieved_at, submissions, raw_score, source_version, mode_id)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)
       ON CONFLICT(game_id, player_id) DO UPDATE SET
         raw_score = CASE WHEN excluded.score > best_scores.score THEN excluded.raw_score ELSE best_scores.raw_score END,
         source_version = CASE WHEN excluded.score > best_scores.score THEN excluded.source_version ELSE best_scores.source_version END,
         mode_id = CASE WHEN excluded.score > best_scores.score THEN excluded.mode_id ELSE best_scores.mode_id END,
         score = CASE WHEN excluded.score > best_scores.score THEN excluded.score ELSE best_scores.score END,
         achieved_at = CASE WHEN excluded.score > best_scores.score THEN excluded.achieved_at ELSE best_scores.achieved_at END,
         submissions = best_scores.submissions + 1`
    ).bind(session.game_id, player!.id, points, now, score, context.scoreVersion, context.modeId),
    env.DB.prepare('UPDATE play_sessions SET used_at = ? WHERE id = ? AND used_at IS NULL').bind(now, session.id),
  ];
  try {
    await env.DB.batch(statements);
  } catch (error) {
    // A concurrent request can consume the token after the initial read. The unique
    // session_id constraint rolls the whole D1 batch back; report the replay safely.
    const consumed = await env.DB.prepare('SELECT used_at FROM play_sessions WHERE id = ?').bind(session.id).first<{ used_at: number | null }>();
    if (consumed?.used_at != null) return response(request, env, { error: 'Play session already used', code: 'session_used' }, 409);
    throw error;
  }
  const best = await env.DB.prepare('SELECT score, achieved_at FROM best_scores WHERE game_id = ? AND player_id = ?')
    .bind(session.game_id, player!.id).first<{ score: number; achieved_at: number }>();
  return response(request, env, { accepted: true, scoreVersion: SCORE_VERSION, gameId: session.game_id, score: points, bestScore: best?.score ?? points });
}

interface GameLeaderboardRow {
  id: string;
  name: string;
  country_code: string;
  score: number;
  raw_score: number;
  source_version: number;
  mode_id: string;
  achieved_at: number;
}

async function gameLeaderboard(request: Request, env: Env, gameId: string, url: URL): Promise<Response> {
  if (!Object.hasOwn(GAME_RULES, gameId)) return response(request, env, { error: 'Unknown game', code: 'unknown_game' }, 404);
  const player = await authenticate(request, env, true);
  const limit = parseLimit(url);
  const rows = await env.DB.prepare(
    `SELECT bs.player_id AS id, p.display_name AS name, p.country_code, bs.score, bs.raw_score, bs.source_version, bs.mode_id, bs.achieved_at
     FROM best_scores bs JOIN players p ON p.id = bs.player_id
     WHERE bs.score > 0 AND bs.game_id = ?
     ORDER BY bs.score DESC, bs.achieved_at ASC, bs.player_id ASC
     LIMIT ?`
  ).bind(gameId, limit).all<GameLeaderboardRow>();
  const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM best_scores WHERE score > 0 AND game_id = ?')
    .bind(gameId).first<{ count: number }>();
  let userEntry: (GameLeaderboardRow & { rank: number }) | null = null;
  if (player) {
    const own = await env.DB.prepare(
      `SELECT bs.player_id AS id, p.display_name AS name, p.country_code, bs.score, bs.raw_score, bs.source_version, bs.mode_id, bs.achieved_at
       FROM best_scores bs JOIN players p ON p.id = bs.player_id
       WHERE bs.score > 0 AND bs.game_id = ? AND bs.player_id = ?`
    ).bind(gameId, player.id).first<GameLeaderboardRow>();
    if (own) {
      const rankRow = await env.DB.prepare(
        `SELECT 1 + COUNT(*) AS rank FROM best_scores
         WHERE game_id = ? AND (score > ? OR (score = ? AND (achieved_at < ? OR (achieved_at = ? AND player_id < ?))))`
      ).bind(gameId, own.score, own.score, own.achieved_at, own.achieved_at, own.id).first<{ rank: number }>();
      userEntry = { ...own, rank: rankRow?.rank ?? 1 };
    }
  }
  const entries = rows.results.map((row, index) => ({ ...row, rank: index + 1, isUser: row.id === player?.id }));
  return response(request, env, { scoreVersion: SCORE_VERSION, gameId, entries, userEntry, totalCompetitors: count?.count ?? 0 });
}

interface OverallRow {
  id: string;
  name: string;
  country_code: string;
  total_score: number;
  games_played: number;
  rating_score: number;
  last_achieved_at: number;
  rank: number;
}

const OVERALL_CTE = `WITH totals AS (
  SELECT p.id, p.display_name AS name, p.country_code,
         SUM(bs.score) AS total_score,
         SUM(MIN(bs.score, 10000)) AS rating_score,
         COUNT(*) AS games_played,
         MAX(bs.achieved_at) AS last_achieved_at
  FROM players p JOIN best_scores bs ON bs.player_id = p.id
  WHERE bs.score > 0
  GROUP BY p.id
), rated AS (
  SELECT * FROM totals
), ranked AS (
  SELECT *, ROW_NUMBER() OVER (ORDER BY rating_score DESC, total_score DESC, last_achieved_at ASC, id ASC) AS rank
  FROM rated
)`;

const WEEKLY_OVERALL_CTE = `WITH ranked_weekly_submissions AS (
  SELECT player_id, game_id, score, created_at,
         ROW_NUMBER() OVER (PARTITION BY player_id, game_id ORDER BY score DESC, created_at ASC) AS game_rank
  FROM score_submissions
  WHERE score > 0 AND created_at >= ? AND created_at < ?
), weekly_best AS (
  SELECT player_id, game_id, score, created_at AS achieved_at
  FROM ranked_weekly_submissions
  WHERE game_rank = 1
), totals AS (
  SELECT p.id, p.display_name AS name, p.country_code,
         SUM(wb.score) AS total_score,
         SUM(MIN(wb.score, 10000)) AS rating_score,
         COUNT(*) AS games_played,
         MAX(wb.achieved_at) AS last_achieved_at
  FROM players p JOIN weekly_best wb ON wb.player_id = p.id
  GROUP BY p.id
), rated AS (
  SELECT * FROM totals
), ranked AS (
  SELECT *, ROW_NUMBER() OVER (ORDER BY rating_score DESC, total_score DESC, last_achieved_at ASC, id ASC) AS rank
  FROM rated
)`;

async function overallLeaderboard(request: Request, env: Env, url: URL): Promise<Response> {
  const player = await authenticate(request, env, true);
  const limit = parseLimit(url);
  const rows = await env.DB.prepare(
    `${OVERALL_CTE} SELECT id, name, country_code, total_score, games_played, rating_score, last_achieved_at, rank
     FROM ranked ORDER BY rank LIMIT ?`
  ).bind(limit).all<OverallRow>();
  const count = await env.DB.prepare('SELECT COUNT(DISTINCT player_id) AS count FROM best_scores WHERE score > 0')
    .first<{ count: number }>();
  let userEntry: OverallRow | null = null;
  if (player) {
    userEntry = await env.DB.prepare(
      `${OVERALL_CTE} SELECT id, name, country_code, total_score, games_played, rating_score, last_achieved_at, rank
       FROM ranked WHERE id = ?`
    ).bind(player.id).first<OverallRow>();
  }
  return response(request, env, {
    scoreVersion: SCORE_VERSION,
    entries: rows.results.map((row) => ({ ...row, isUser: row.id === player?.id })),
    userEntry,
    totalCompetitors: count?.count ?? 0,
  });
}

async function weeklyOverallLeaderboard(request: Request, env: Env, url: URL): Promise<Response> {
  const player = await authenticate(request, env, true);
  const limit = parseLimit(url);
  const { start, end } = utcWeekBounds();
  const rows = await env.DB.prepare(
    `${WEEKLY_OVERALL_CTE} SELECT id, name, country_code, total_score, games_played, rating_score, last_achieved_at, rank
     FROM ranked ORDER BY rank LIMIT ?`
  ).bind(start, end, limit).all<OverallRow>();
  const count = await env.DB.prepare(
    'SELECT COUNT(DISTINCT player_id) AS count FROM score_submissions WHERE score > 0 AND created_at >= ? AND created_at < ?'
  ).bind(start, end).first<{ count: number }>();
  let userEntry: OverallRow | null = null;
  if (player) {
    userEntry = await env.DB.prepare(
      `${WEEKLY_OVERALL_CTE} SELECT id, name, country_code, total_score, games_played, rating_score, last_achieved_at, rank
       FROM ranked WHERE id = ?`
    ).bind(start, end, player.id).first<OverallRow>();
  }
  return response(request, env, {
    scoreVersion: SCORE_VERSION,
    entries: rows.results.map((row) => ({ ...row, isUser: row.id === player?.id })),
    userEntry,
    totalCompetitors: count?.count ?? 0,
    weekStart: start,
    weekEnd: end,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('origin');
    if (origin && !(env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).includes(origin)) {
      return response(request, env, { error: 'Origin not allowed', code: 'origin_not_allowed' }, 403);
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    const url = new URL(request.url);
    try {
      if (url.pathname === '/v1/health' && request.method === 'GET') {
        return response(request, env, { ok: true, service: 'micro-arcade-leaderboards', scoreVersion: SCORE_VERSION });
      }
      if (url.pathname === '/v1/guest' && request.method === 'POST') return await createGuest(request, env);
      if (url.pathname === '/v1/me' && request.method === 'GET') return await getMe(request, env);
      if (url.pathname === '/v1/me' && request.method === 'PATCH') return await updateMe(request, env);
      if (url.pathname === '/v1/sessions' && request.method === 'POST') return await createSession(request, env);
      if (url.pathname === '/v1/scores' && request.method === 'POST') return await submitScore(request, env);
      if (url.pathname === '/v1/leaderboards/overall' && request.method === 'GET') return await overallLeaderboard(request, env, url);
      if (url.pathname === '/v1/leaderboards/weekly' && request.method === 'GET') return await weeklyOverallLeaderboard(request, env, url);
      const gameMatch = /^\/v1\/leaderboards\/([a-z0-9-]+)$/.exec(url.pathname);
      if (gameMatch && request.method === 'GET') return await gameLeaderboard(request, env, gameMatch[1], url);
      return response(request, env, { error: 'Not found' }, 404);
    } catch (error) {
      if (error instanceof ApiError) return response(request, env, { error: error.message, code: error.code }, error.status);
      if (error instanceof Response) {
        const code = error.status === 401 ? 'unauthorized' : error.status === 429 ? 'rate_limited' : 'request_failed';
        return json({ error: error.status === 401 ? 'Unauthorized' : error.status === 429 ? 'Too many requests' : 'Request failed', code }, error.status, {
          ...corsHeaders(request, env), ...secureHeaders(), ...(error.status === 429 ? { 'retry-after': '60' } : {}),
        });
      }
      console.error(JSON.stringify({ event: 'leaderboard_request_failed', method: request.method, path: url.pathname, errorType: error instanceof Error ? error.name : 'unknown' }));
      return response(request, env, { error: 'Internal server error', code: 'internal_error' }, 500);
    }
  },
};
