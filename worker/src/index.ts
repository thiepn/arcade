type D1RunResult = { success: boolean; meta?: { changes?: number }; results?: unknown[] };
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<D1RunResult>;
}
interface D1Database {
  prepare(query: string): D1Statement;
  batch(statements: D1Statement[]): Promise<D1RunResult[]>;
}
interface RateLimitBinding {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}
interface Env {
  DB: D1Database;
  CREDENTIAL_PEPPER: string;
  ALLOWED_ORIGINS: string;
  GUEST_RATE_LIMITER: RateLimitBinding;
  SESSION_RATE_LIMITER: RateLimitBinding;
  SCORE_RATE_LIMITER: RateLimitBinding;
}

type GameRule = { maxScore: number; minDurationMs: number; maxDurationMs: number };

const GAME_RULES: Record<string, GameRule> = Object.fromEntries(
  [
    'orbit','stack','reaction','dodge','pulse','merge','typerush','oneline','breakout','perfectstop',
    'chain','gravity','blade','pinball','chrono','matrix','drift','vanguard','slingshot','snake',
    'rhythm','tower','pacmaze','flappyaero','roadcross','bubblebuster','astroblaster','laserrope','blockdrop','knifetarget','airhockey',
  ].map((id) => [id, { maxScore: 100_000_000, minDurationMs: 250, maxDurationMs: 30 * 60 * 1000 }])
);

Object.assign(GAME_RULES, {
  orbit: { maxScore: 1_000_000, minDurationMs: 250, maxDurationMs: 30 * 60 * 1000 },
  stack: { maxScore: 100_000, minDurationMs: 250, maxDurationMs: 30 * 60 * 1000 },
  reaction: { maxScore: 10_000, minDurationMs: 750, maxDurationMs: 10 * 60 * 1000 },
  pulse: { maxScore: 1_000_000, minDurationMs: 250, maxDurationMs: 30 * 60 * 1000 },
  typerush: { maxScore: 100_000, minDurationMs: 500, maxDurationMs: 30 * 60 * 1000 },
  oneline: { maxScore: 100_000, minDurationMs: 250, maxDurationMs: 30 * 60 * 1000 },
  perfectstop: { maxScore: 100_000, minDurationMs: 250, maxDurationMs: 30 * 60 * 1000 },
  chain: { maxScore: 1_000_000, minDurationMs: 250, maxDurationMs: 10 * 60 * 1000 },
  matrix: { maxScore: 1_000_000, minDurationMs: 500, maxDurationMs: 30 * 60 * 1000 },
  knifetarget: { maxScore: 10_000_000, minDurationMs: 500, maxDurationMs: 30 * 60 * 1000 },
  airhockey: { maxScore: 1_000_000, minDurationMs: 250, maxDurationMs: 30 * 60 * 1000 },
});

const encoder = new TextEncoder();
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_LEADERBOARD_LIMIT = 50;

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('origin');
  const allowed = env.ALLOWED_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean);
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

async function readJson<T>(request: Request): Promise<T> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new Error('Expected application/json');
  return request.json() as Promise<T>;
}

interface PlayerRow {
  id: string;
  display_name: string;
  country_code: string;
}

async function authenticate(request: Request, env: Env, optional = false): Promise<PlayerRow | null> {
  const header = request.headers.get('authorization');
  if (!header) {
    if (optional) return null;
    throw new Response('Unauthorized', { status: 401 });
  }
  const match = /^Bearer\s+([0-9a-f-]{36})\.([A-Za-z0-9_-]{20,})$/i.exec(header);
  if (!match) throw new Response('Unauthorized', { status: 401 });
  const [, playerId, secret] = match;
  const hash = await credentialHash(env, secret);
  const player = await env.DB.prepare(
    'SELECT id, display_name, country_code FROM players WHERE id = ? AND credential_hash = ?'
  ).bind(playerId, hash).first<PlayerRow>();
  if (!player) throw new Response('Unauthorized', { status: 401 });
  void env.DB.prepare('UPDATE players SET last_seen_at = ? WHERE id = ?').bind(Date.now(), player.id).run();
  return player;
}

async function rateLimit(binding: RateLimitBinding, key: string): Promise<void> {
  const result = await binding.limit({ key });
  if (!result.success) throw new Response('Too Many Requests', { status: 429 });
}

async function createGuest(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  await rateLimit(env.GUEST_RATE_LIMITER, `${ip}:${request.headers.get('user-agent') || ''}`);
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
    player: { id, name, countryCode: country },
  }, 201);
}

async function getMe(request: Request, env: Env): Promise<Response> {
  const player = await authenticate(request, env);
  return response(request, env, {
    player: { id: player!.id, name: player!.display_name, countryCode: player!.country_code },
  });
}

async function updateMe(request: Request, env: Env): Promise<Response> {
  const player = await authenticate(request, env);
  const body = await readJson<{ name?: string }>(request);
  const name = (body.name || '').trim();
  if (!/^[A-Za-z0-9 _.-]{3,20}$/.test(name)) {
    return response(request, env, { error: 'Name must be 3-20 characters using letters, numbers, spaces, _ . or -.' }, 400);
  }
  await env.DB.prepare('UPDATE players SET display_name = ?, last_seen_at = ? WHERE id = ?')
    .bind(name, Date.now(), player!.id).run();
  return response(request, env, { player: { id: player!.id, name, countryCode: player!.country_code } });
}

async function createSession(request: Request, env: Env): Promise<Response> {
  const player = await authenticate(request, env);
  await rateLimit(env.SESSION_RATE_LIMITER, player!.id);
  const body = await readJson<{ gameId?: string }>(request);
  const gameId = body.gameId || '';
  if (!GAME_RULES[gameId]) return response(request, env, { error: 'Unknown game' }, 400);
  const now = Date.now();
  const id = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO play_sessions (id, player_id, game_id, issued_at, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, player!.id, gameId, now, now + SESSION_TTL_MS).run();
  return response(request, env, { session: { id, gameId, issuedAt: now, expiresAt: now + SESSION_TTL_MS } }, 201);
}

interface SessionRow {
  id: string;
  player_id: string;
  game_id: string;
  issued_at: number;
  expires_at: number;
  used_at: number | null;
}

async function submitScore(request: Request, env: Env): Promise<Response> {
  const player = await authenticate(request, env);
  await rateLimit(env.SCORE_RATE_LIMITER, player!.id);
  const body = await readJson<{ sessionId?: string; score?: number; durationMs?: number }>(request);
  const sessionId = body.sessionId || '';
  const score = Number(body.score);
  const durationMs = Number(body.durationMs);
  if (!sessionId || !Number.isSafeInteger(score) || score < 0 || !Number.isFinite(durationMs) || durationMs < 0) {
    return response(request, env, { error: 'Invalid score submission' }, 400);
  }
  const session = await env.DB.prepare(
    'SELECT id, player_id, game_id, issued_at, expires_at, used_at FROM play_sessions WHERE id = ? AND player_id = ?'
  ).bind(sessionId, player!.id).first<SessionRow>();
  if (!session) return response(request, env, { error: 'Unknown play session' }, 404);
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

  const submissionId = crypto.randomUUID();
  const statements = [
    env.DB.prepare(
      'INSERT INTO score_submissions (id, session_id, player_id, game_id, score, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(submissionId, session.id, player!.id, session.game_id, score, Math.round(durationMs), now),
    env.DB.prepare(
      `INSERT INTO best_scores (game_id, player_id, score, achieved_at, submissions)
       VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(game_id, player_id) DO UPDATE SET
         score = CASE WHEN excluded.score > best_scores.score THEN excluded.score ELSE best_scores.score END,
         achieved_at = CASE WHEN excluded.score > best_scores.score THEN excluded.achieved_at ELSE best_scores.achieved_at END,
         submissions = best_scores.submissions + 1`
    ).bind(session.game_id, player!.id, score, now),
    env.DB.prepare('UPDATE play_sessions SET used_at = ? WHERE id = ? AND used_at IS NULL').bind(now, session.id),
  ];
  await env.DB.batch(statements);
  const best = await env.DB.prepare('SELECT score, achieved_at FROM best_scores WHERE game_id = ? AND player_id = ?')
    .bind(session.game_id, player!.id).first<{ score: number; achieved_at: number }>();
  return response(request, env, { accepted: true, gameId: session.game_id, bestScore: best?.score ?? score });
}

interface GameLeaderboardRow {
  id: string;
  name: string;
  country_code: string;
  score: number;
  achieved_at: number;
}

async function gameLeaderboard(request: Request, env: Env, gameId: string, url: URL): Promise<Response> {
  if (!GAME_RULES[gameId]) return response(request, env, { error: 'Unknown game' }, 404);
  const player = await authenticate(request, env, true);
  const limit = parseLimit(url);
  const rows = await env.DB.prepare(
    `SELECT bs.player_id AS id, p.display_name AS name, p.country_code, bs.score, bs.achieved_at
     FROM best_scores bs JOIN players p ON p.id = bs.player_id
     WHERE bs.game_id = ?
     ORDER BY bs.score DESC, bs.achieved_at ASC
     LIMIT ?`
  ).bind(gameId, limit).all<GameLeaderboardRow>();
  const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM best_scores WHERE game_id = ?')
    .bind(gameId).first<{ count: number }>();
  let userEntry: (GameLeaderboardRow & { rank: number }) | null = null;
  if (player) {
    const own = await env.DB.prepare(
      `SELECT bs.player_id AS id, p.display_name AS name, p.country_code, bs.score, bs.achieved_at
       FROM best_scores bs JOIN players p ON p.id = bs.player_id
       WHERE bs.game_id = ? AND bs.player_id = ?`
    ).bind(gameId, player.id).first<GameLeaderboardRow>();
    if (own) {
      const rankRow = await env.DB.prepare(
        `SELECT 1 + COUNT(*) AS rank FROM best_scores
         WHERE game_id = ? AND (score > ? OR (score = ? AND achieved_at < ?))`
      ).bind(gameId, own.score, own.score, own.achieved_at).first<{ rank: number }>();
      userEntry = { ...own, rank: rankRow?.rank ?? 1 };
    }
  }
  const entries = rows.results.map((row, index) => ({ ...row, rank: index + 1, isUser: row.id === player?.id }));
  return response(request, env, { gameId, entries, userEntry, totalCompetitors: count?.count ?? 0 });
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
         COUNT(*) AS games_played,
         MAX(bs.achieved_at) AS last_achieved_at
  FROM players p JOIN best_scores bs ON bs.player_id = p.id
  GROUP BY p.id
), rated AS (
  SELECT *, games_played * 1000 + MIN(CAST(total_score / 10000 AS INTEGER), 999) AS rating_score
  FROM totals
), ranked AS (
  SELECT *, ROW_NUMBER() OVER (ORDER BY rating_score DESC, total_score DESC, last_achieved_at ASC) AS rank
  FROM rated
)`;

async function overallLeaderboard(request: Request, env: Env, url: URL): Promise<Response> {
  const player = await authenticate(request, env, true);
  const limit = parseLimit(url);
  const rows = await env.DB.prepare(
    `${OVERALL_CTE} SELECT id, name, country_code, total_score, games_played, rating_score, last_achieved_at, rank
     FROM ranked ORDER BY rank LIMIT ?`
  ).bind(limit).all<OverallRow>();
  const count = await env.DB.prepare('SELECT COUNT(DISTINCT player_id) AS count FROM best_scores')
    .first<{ count: number }>();
  let userEntry: OverallRow | null = null;
  if (player) {
    userEntry = await env.DB.prepare(
      `${OVERALL_CTE} SELECT id, name, country_code, total_score, games_played, rating_score, last_achieved_at, rank
       FROM ranked WHERE id = ?`
    ).bind(player.id).first<OverallRow>();
  }
  return response(request, env, {
    entries: rows.results.map((row) => ({ ...row, isUser: row.id === player?.id })),
    userEntry,
    totalCompetitors: count?.count ?? 0,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    const url = new URL(request.url);
    try {
      if (url.pathname === '/v1/health' && request.method === 'GET') {
        return response(request, env, { ok: true, service: 'micro-arcade-leaderboards' });
      }
      if (url.pathname === '/v1/guest' && request.method === 'POST') return createGuest(request, env);
      if (url.pathname === '/v1/me' && request.method === 'GET') return getMe(request, env);
      if (url.pathname === '/v1/me' && request.method === 'PATCH') return updateMe(request, env);
      if (url.pathname === '/v1/sessions' && request.method === 'POST') return createSession(request, env);
      if (url.pathname === '/v1/scores' && request.method === 'POST') return submitScore(request, env);
      if (url.pathname === '/v1/leaderboards/overall' && request.method === 'GET') return overallLeaderboard(request, env, url);
      const gameMatch = /^\/v1\/leaderboards\/([a-z0-9-]+)$/.exec(url.pathname);
      if (gameMatch && request.method === 'GET') return gameLeaderboard(request, env, gameMatch[1], url);
      return response(request, env, { error: 'Not found' }, 404);
    } catch (error) {
      if (error instanceof Response) {
        return new Response(error.body, { status: error.status, headers: { ...corsHeaders(request, env), ...secureHeaders() } });
      }
      console.error(error);
      return response(request, env, { error: 'Internal server error' }, 500);
    }
  },
};
