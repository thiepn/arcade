import assert from 'node:assert/strict';
import worker from '../src/index';

const keys: string[] = [];
const deny = { limit: async ({ key }: { key: string }) => { keys.push(key); return { success: false }; } };
const allow = { limit: async () => ({ success: true }) };
const databaseFailure = { prepare: () => { throw new Error('private SQL and credential detail'); } };
const env = { ALLOWED_ORIGINS: 'https://thiepn.github.io', CREDENTIAL_PEPPER: 'test-only', DB: databaseFailure, GUEST_RATE_LIMITER: deny, SESSION_RATE_LIMITER: allow, SCORE_RATE_LIMITER: allow } as unknown as Env;
const request = (body = '{}', headers: Record<string, string> = {}) => new Request('https://arcade.invalid/v1/guest', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.1', ...headers }, body });
for (const userAgent of ['browser-one', 'browser-two']) {
  const response = await worker.fetch(request('{}', { 'user-agent': userAgent }), env);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
  assert.equal((await response.json() as { code: string }).code, 'rate_limited');
}
assert.equal(keys[0], keys[1], 'Changing user-agent must not bypass per-IP guest limits');
env.GUEST_RATE_LIMITER = allow as RateLimit;
const oversized = await worker.fetch(request(JSON.stringify({ large: 'x'.repeat(5000) }), { 'content-length': '1' }), env);
assert.equal(oversized.status, 413, 'Limit actual streamed bytes, not only Content-Length');
const logs: string[] = [];
const originalError = console.error;
try {
  console.error = (...items) => { logs.push(items.join(' ')); };
  const response = await worker.fetch(request(), env);
  assert.equal(response.status, 500);
  const body = await response.text();
  assert.match(body, /internal_error/);
  assert(!body.includes('private SQL'));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert(logs.length === 1 && !logs[0].includes('private SQL'));
} finally { console.error = originalError; }
console.log('PASS rate-limit JSON/Retry-After, stable IP key, streamed payload bound, safe D1 outage response/log');
