import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GAME_IDS = [
  'orbit','stack','reaction','dodge','pulse','merge','typerush','oneline','breakout','perfectstop',
  'chain','gravity','blade','pinball','chrono','matrix','drift','vanguard','slingshot','snake',
  'rhythm','tower','pacmaze','flappyaero','roadcross','bubblebuster','astroblaster','laserrope','blockdrop','knifetarget','airhockey','neonrail',
] as const;

type GameRule = { maxScore: number; minDurationMs: number; maxDurationMs: number };
const GAME_RULES: Record<string, GameRule> = Object.fromEntries(
  GAME_IDS.map((id) => [id, { maxScore: 100_000_000, minDurationMs: 250, maxDurationMs: 30 * 60 * 1000 }]),
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

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_BODY_BYTES = 4096;
const MAX_LEADERBOARD_LIMIT = 50;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ALLOWED_ORIGINS = new Set([
  'https://thiepn.dev',
  'https://thiepn.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);
const encoder = new TextEncoder();

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = {
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
    'access-control-max-age': '86400',
    'vary': 'Origin',
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers['access-control-allow-origin'] = origin;
  return headers;
}

function secureHeaders(): Record<string, string> {
  return { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
}

function json(request: Request, data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(request), ...secureHeaders(), ...headers },
  });
}

function apiPath(request: Request): string {
  const pathname = new URL(request.url).pathname;
  const marker = '/micro-arcade-leaderboards';
  const index = pathname.indexOf(marker);
  return index >= 0 ? pathname.slice(index + marker.length) || '/' : pathname;
}

async function readJson<T>(request: Request): Promise<T> {
  const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') throw new ApiError(415, 'invalid_content_type', 'Expected application/json');
  const declared = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new ApiError(413, 'payload_too_large', 'Request too large');
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_BODY_BYTES) throw new ApiError(413, 'payload_too_large', 'Request too large');
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not object');
    return value as T;
  } catch {
    throw new ApiError(400, 'invalid_json', 'Expected a JSON object');
  }
}

function dbHeaders(extra: HeadersInit = {}): Headers {
  if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error('Supabase service environment unavailable');
  const headers = new Headers(extra);
  headers.set('apikey', SERVICE_ROLE);
  headers.set('authorization', `Bearer ${SERVICE_ROLE}`);
  return headers;
}

async function dbFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return await fetch(`${SUPABASE_URL}${path}`, { ...init, headers: dbHeaders(init.headers) });
}

async function dbJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await dbFetch(path, init);
  if (!res.ok) {
    console.error(JSON.stringify({ event: 'micro_arcade_db_error', status: res.status, route: path.split('?')[0] }));
    throw new Error('Database request failed');
  }
  return await res.json() as T;
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  return await dbJson<T>(`/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
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
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function credentialHash(secret: string): Promise<string> {
  return sha256(`${SERVICE_ROLE}:${secret}`);
}

function displayNameFor(id: string): string {
  return `Player-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

function countryCode(request: Request): string {
  const raw = (request.headers.get('cf-ipcountry') || request.headers.get('x-country-code') || 'XX').toUpperCase();
  return /^[A-Z]{2}$/.test(raw) ? raw : 'XX';
}

function clientIp(request: Request): string {
  return (request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
}

function parseLimit(request: Request, fallback: number): number {
  const parsed = Number(new URL(request.url).searchParams.get('limit') || fallback);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(1, Math.min(MAX_LEADERBOARD_LIMIT, parsed));
}

function utcWeekBounds(now = Date.now()): { start: number; end: number } {
  const d = new Date(now);
  const offset = (d.getUTCDay() + 6) % 7;
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - offset, 0, 0, 0, 0);
  return { start, end: start + WEEK_MS };
}

async function allowRate(scope: string, key: string, limit: number): Promise<void> {
  const ok = await rpc<boolean>('micro_arcade_rate_limit', { p_scope: scope, p_key: key, p_limit: limit, p_now: Date.now() });
  if (!ok) throw new ApiError(429, 'rate_limited', 'Too many requests');
}

type Player = { id: string; display_name: string; country_code: string; created_at: number };
async function authenticate(request: Request, optional = false): Promise<Player | null> {
  const header = request.headers.get('authorization');
  if (!header) {
    if (optional) return null;
    throw new ApiError(401, 'unauthorized', 'Unauthorized');
  }
  const match = /^Bearer\s+([0-9a-f-]{36})\.([A-Za-z0-9_-]{20,128})$/i.exec(header);
  if (!match) {
    if (optional) return null;
    throw new ApiError(401, 'unauthorized', 'Unauthorized');
  }
  const [, id, secret] = match;
  const hash = await credentialHash(secret);
  const rows = await dbJson<Player[]>(`/rest/v1/micro_arcade_players?id=eq.${encodeURIComponent(id)}&credential_hash=eq.${hash}&select=id,display_name,country_code,created_at&limit=1`);
  const player = rows[0] || null;
  if (!player) {
    if (optional) return null;
    throw new ApiError(401, 'unauthorized', 'Unauthorized');
  }
  if (request.method !== 'GET') {
    const res = await dbFetch(`/rest/v1/micro_arcade_players?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', prefer: 'return=minimal' }, body: JSON.stringify({ last_seen_at: Date.now() }),
    });
    if (!res.ok) throw new Error('Failed to update player activity');
  }
  return player;
}

async function createGuest(request: Request): Promise<Response> {
  await allowRate('guest', clientIp(request), 10);
  await readJson<Record<string, unknown>>(request);
  const now = Date.now();
  const id = crypto.randomUUID();
  const secret = randomSecret();
  const hash = await credentialHash(secret);
  const name = displayNameFor(id);
  const country = countryCode(request);
  const res = await dbFetch('/rest/v1/micro_arcade_players', {
    method: 'POST', headers: { 'content-type': 'application/json', prefer: 'return=minimal' },
    body: JSON.stringify({ id, credential_hash: hash, display_name: name, country_code: country, created_at: now, last_seen_at: now }),
  });
  if (!res.ok) throw new Error('Failed to create guest');
  return json(request, { credential: `${id}.${secret}`, player: { id, name, countryCode: country, createdAt: now } }, 201);
}

async function getMe(request: Request): Promise<Response> {
  const player = await authenticate(request);
  const activity = await rpc<{ submissions: number; rankedGames: number }>('micro_arcade_profile_activity', { p_player_id: player!.id });
  return json(request, {
    player: { id: player!.id, name: player!.display_name, countryCode: player!.country_code, createdAt: player!.created_at },
    activity,
  });
}

async function updateMe(request: Request): Promise<Response> {
  const player = await authenticate(request);
  await allowRate('session', player!.id, 60);
  const body = await readJson<{ name?: string }>(request);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!/^[A-Za-z0-9 _.-]{3,20}$/.test(name)) return json(request, { error: 'Name must be 3-20 characters using letters, numbers, spaces, _ . or -.' }, 400);
  const res = await dbFetch(`/rest/v1/micro_arcade_players?id=eq.${encodeURIComponent(player!.id)}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json', prefer: 'return=minimal' }, body: JSON.stringify({ display_name: name, last_seen_at: Date.now() }),
  });
  if (!res.ok) throw new Error('Failed to update profile');
  return json(request, { player: { id: player!.id, name, countryCode: player!.country_code, createdAt: player!.created_at } });
}

async function createSession(request: Request): Promise<Response> {
  const player = await authenticate(request);
  await allowRate('session', player!.id, 60);
  const body = await readJson<{ gameId?: string }>(request);
  const gameId = typeof body.gameId === 'string' ? body.gameId : '';
  if (!Object.hasOwn(GAME_RULES, gameId)) return json(request, { error: 'Unknown game', code: 'unknown_game' }, 400);
  const now = Date.now();
  const id = crypto.randomUUID();
  const expiresAt = now + SESSION_TTL_MS;
  const res = await dbFetch('/rest/v1/micro_arcade_play_sessions', {
    method: 'POST', headers: { 'content-type': 'application/json', prefer: 'return=minimal' },
    body: JSON.stringify({ id, player_id: player!.id, game_id: gameId, issued_at: now, expires_at: expiresAt }),
  });
  if (!res.ok) throw new Error('Failed to create play session');
  return json(request, { session: { id, gameId, issuedAt: now, expiresAt } }, 201);
}

type SessionRow = { id: string; player_id: string; game_id: string; issued_at: number; expires_at: number; used_at: number | null };
async function submitScore(request: Request): Promise<Response> {
  const player = await authenticate(request);
  await allowRate('score', player!.id, 30);
  const body = await readJson<{ sessionId?: string; score?: number; durationMs?: number }>(request);
  const { sessionId, score, durationMs } = body;
  if (typeof sessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(sessionId) || typeof score !== 'number' || !Number.isSafeInteger(score) || score < 0 || typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) {
    return json(request, { error: 'Invalid score submission' }, 400);
  }
  const rows = await dbJson<SessionRow[]>(`/rest/v1/micro_arcade_play_sessions?id=eq.${encodeURIComponent(sessionId)}&player_id=eq.${encodeURIComponent(player!.id)}&select=id,player_id,game_id,issued_at,expires_at,used_at&limit=1`);
  const session = rows[0];
  if (!session) return json(request, { error: 'Unknown play session' }, 404);
  if (session.used_at !== null) return json(request, { error: 'Play session already used' }, 409);
  const now = Date.now();
  if (now > session.expires_at) return json(request, { error: 'Play session expired' }, 410);
  const rule = GAME_RULES[session.game_id];
  const elapsed = now - session.issued_at;
  if (!rule || score > rule.maxScore) return json(request, { error: 'Score outside accepted range' }, 422);
  if (elapsed < rule.minDurationMs || elapsed > rule.maxDurationMs) return json(request, { error: 'Session duration outside accepted range' }, 422);
  if (Math.abs(elapsed - durationMs) > 90_000) return json(request, { error: 'Session timing mismatch' }, 422);
  const result = await rpc<{ ok: boolean; code?: string; gameId?: string; bestScore?: number }>('micro_arcade_consume_score', {
    p_player_id: player!.id, p_session_id: session.id, p_score: score, p_duration_ms: Math.round(durationMs), p_now: now,
  });
  if (!result.ok) return json(request, { error: 'Play session already used', code: result.code || 'session_used' }, 409);
  return json(request, { accepted: true, gameId: result.gameId, bestScore: result.bestScore ?? score });
}

async function gameLeaderboard(request: Request, gameId: string): Promise<Response> {
  if (!Object.hasOwn(GAME_RULES, gameId)) return json(request, { error: 'Unknown game', code: 'unknown_game' }, 404);
  const player = await authenticate(request, true);
  const data = await rpc<Record<string, unknown>>('micro_arcade_game_leaderboard', { p_game_id: gameId, p_player_id: player?.id ?? null, p_limit: parseLimit(request, 10) });
  return json(request, data);
}

async function overallLeaderboard(request: Request): Promise<Response> {
  const player = await authenticate(request, true);
  const data = await rpc<Record<string, unknown>>('micro_arcade_overall_leaderboard', { p_player_id: player?.id ?? null, p_limit: parseLimit(request, 20) });
  return json(request, data);
}

async function weeklyLeaderboard(request: Request): Promise<Response> {
  const player = await authenticate(request, true);
  const { start, end } = utcWeekBounds();
  const data = await rpc<Record<string, unknown>>('micro_arcade_weekly_leaderboard', {
    p_player_id: player?.id ?? null, p_limit: parseLimit(request, 20), p_week_start: start, p_week_end: end,
  });
  return json(request, data);
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(request, { error: 'Origin not allowed', code: 'origin_not_allowed' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...corsHeaders(request), ...secureHeaders() } });
  const path = apiPath(request);
  try {
    if (path === '/v1/health' && request.method === 'GET') return json(request, { ok: true, service: 'micro-arcade-leaderboards', backend: 'supabase' });
    if (path === '/v1/guest' && request.method === 'POST') return await createGuest(request);
    if (path === '/v1/me' && request.method === 'GET') return await getMe(request);
    if (path === '/v1/me' && request.method === 'PATCH') return await updateMe(request);
    if (path === '/v1/sessions' && request.method === 'POST') return await createSession(request);
    if (path === '/v1/scores' && request.method === 'POST') return await submitScore(request);
    if (path === '/v1/leaderboards/overall' && request.method === 'GET') return await overallLeaderboard(request);
    if (path === '/v1/leaderboards/weekly' && request.method === 'GET') return await weeklyLeaderboard(request);
    const game = /^\/v1\/leaderboards\/([a-z0-9-]+)$/.exec(path);
    if (game && request.method === 'GET') return await gameLeaderboard(request, game[1]);
    return json(request, { error: 'Not found' }, 404);
  } catch (error) {
    if (error instanceof ApiError) {
      return json(request, { error: error.message, code: error.code }, error.status, error.status === 429 ? { 'retry-after': '60' } : {});
    }
    console.error(JSON.stringify({ event: 'micro_arcade_request_failed', method: request.method, path, errorType: error instanceof Error ? error.name : 'unknown' }));
    return json(request, { error: 'Internal server error', code: 'internal_error' }, 500);
  }
});
