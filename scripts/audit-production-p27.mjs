import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const siteUrl = new URL(process.env.P27_SITE_URL || 'https://thiepn.dev/arcade/');
const apiBase = (process.env.P27_API_URL || 'https://hycegznamzjhwinegaai.supabase.co/functions/v1/micro-arcade-leaderboards').replace(/\/$/, '');
const productionOrigin = process.env.P27_PRODUCTION_ORIGIN || 'https://thiepn.dev';
const expectedPolicyHash = process.env.P27_POLICY_HASH || 'b467b52542b31e2a942c7af0dfe11eb4598cbf56c50096278a8be1b1a1a79057';
const samples = clampInteger(process.env.P27_SAMPLES, 1, 20, 1);
const sampleDelayMs = clampInteger(process.env.P27_SAMPLE_DELAY_MS, 0, 60_000, 0);
const timeoutMs = clampInteger(process.env.P27_TIMEOUT_MS, 1_000, 30_000, 8_000);
const maxAttempts = clampInteger(process.env.P27_ATTEMPTS, 1, 3, 2);
const strictLatency = process.env.P27_STRICT_LATENCY === '1';
const outputDir = process.env.P27_REPORT_DIR || 'p27-report';

const latencyBudgets = {
  'site-root': 3_000,
  'asset-manifest': 3_000,
  'service-worker': 3_000,
  'webmanifest': 3_000,
  'api-cors': 3_000,
  'api-health': 3_000,
  'api-overall': 4_000,
  'api-weekly': 4_000,
};

const observations = [];
const failures = [];
const warnings = [];

function clampInteger(raw, min, max, fallback) {
  const value = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function headerValue(response, name) {
  return response.headers.get(name) || '';
}

function parseJson(label, text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label}: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function requestProbe({ name, url, init, validate }) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = performance.now();
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        cache: 'no-store',
        ...init,
        signal: controller.signal,
      });
      const body = await response.text();
      const latencyMs = Math.round((performance.now() - started) * 10) / 10;
      if (!response.ok && response.status !== 204) {
        throw new Error(`${name}: HTTP ${response.status}`);
      }
      await validate(response, body);
      const recovered = attempt > 1;
      observations.push({ name, url: String(url), status: response.status, latencyMs, attempt, recovered });
      if (recovered) warnings.push(`${name}: recovered on attempt ${attempt}`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) await sleep(Math.min(1_500, 400 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  failures.push(lastError instanceof Error ? lastError.message : `${name}: ${String(lastError)}`);
}

function siteAsset(path) {
  return new URL(path, siteUrl);
}

async function runSample(sampleNumber) {
  await requestProbe({
    name: 'site-root',
    url: siteUrl,
    validate(_response, body) {
      assert(/<html[\s>]/i.test(body), 'site-root: response is not HTML');
      assert(body.includes('manifest.webmanifest'), 'site-root: PWA manifest link missing');
      assert(body.length >= 500, `site-root: HTML payload unexpectedly small (${body.length} bytes)`);
    },
  });

  await requestProbe({
    name: 'asset-manifest',
    url: siteAsset('asset-manifest.json'),
    validate(_response, body) {
      const manifest = parseJson('asset-manifest', body);
      const keys = Object.keys(manifest);
      const games = keys.filter((key) => key.startsWith('src/games/') && key.endsWith('.tsx'));
      assert(games.length === 32, `asset-manifest: expected 32 game chunks, found ${games.length}`);
      assert(games.filter((key) => key.endsWith('/VectorGolf.tsx')).length === 1, 'asset-manifest: Vector Golf chunk missing');
      assert(games.filter((key) => key.endsWith('/HexCapture.tsx')).length === 1, 'asset-manifest: Hex Capture chunk missing');
      assert(!games.some((key) => key.endsWith('/GravityGame.tsx') || key.endsWith('/AstroBlasterGame.tsx')), 'asset-manifest: retired Gravity/Astro engine shipped');
    },
  });

  await requestProbe({
    name: 'service-worker',
    url: siteAsset('sw.js'),
    validate(_response, body) {
      assert(body.includes('micro-arcade-shell-'), 'service-worker: versioned cache prefix missing');
      assert(!body.includes('__ARCADE_BUILD_ID__'), 'service-worker: unresolved build id placeholder');
      assert(body.includes('discoverManifestAssets'), 'service-worker: manifest-driven lazy asset discovery missing');
    },
  });

  await requestProbe({
    name: 'webmanifest',
    url: siteAsset('manifest.webmanifest'),
    validate(_response, body) {
      const manifest = parseJson('webmanifest', body);
      assert(manifest.name === 'Micro Arcade', `webmanifest: unexpected app name ${JSON.stringify(manifest.name)}`);
      assert(manifest.start_url === './', `webmanifest: unexpected start_url ${JSON.stringify(manifest.start_url)}`);
      assert(manifest.scope === './', `webmanifest: unexpected scope ${JSON.stringify(manifest.scope)}`);
    },
  });

  await requestProbe({
    name: 'api-cors',
    url: `${apiBase}/v3/guest`,
    init: {
      method: 'OPTIONS',
      headers: {
        Origin: productionOrigin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    },
    validate(response) {
      assert(response.status === 204, `api-cors: expected HTTP 204, got ${response.status}`);
      const allowed = headerValue(response, 'access-control-allow-origin');
      assert(allowed === productionOrigin || allowed === '*', `api-cors: production origin not allowed (${JSON.stringify(allowed)})`);
    },
  });

  await requestProbe({
    name: 'api-health',
    url: `${apiBase}/v3/health`,
    init: { headers: { Origin: productionOrigin } },
    validate(_response, body) {
      const health = parseJson('api-health', body);
      assert(health.ok === true, 'api-health: backend did not report ok=true');
      assert(health.backend === 'supabase', `api-health: unexpected backend ${JSON.stringify(health.backend)}`);
      assert(health.protocolVersion === 3, `api-health: unexpected protocolVersion ${JSON.stringify(health.protocolVersion)}`);
      const serialized = JSON.stringify(health);
      assert(serialized.includes(expectedPolicyHash), 'api-health: deployed scoring policy hash drifted');
    },
  });

  await requestProbe({
    name: 'api-overall',
    url: `${apiBase}/v3/leaderboards/overall?limit=1`,
    init: { headers: { Origin: productionOrigin } },
    validate(_response, body) {
      const payload = parseJson('api-overall', body);
      assert(Array.isArray(payload.entries), 'api-overall: entries is not an array');
      assert(Number.isFinite(payload.totalCompetitors), 'api-overall: totalCompetitors is missing/non-numeric');
    },
  });

  await requestProbe({
    name: 'api-weekly',
    url: `${apiBase}/v3/leaderboards/weekly?limit=1`,
    init: { headers: { Origin: productionOrigin } },
    validate(_response, body) {
      const payload = parseJson('api-weekly', body);
      assert(Array.isArray(payload.entries), 'api-weekly: entries is not an array');
      assert(Number.isFinite(payload.totalCompetitors), 'api-weekly: totalCompetitors is missing/non-numeric');
      assert(Number.isFinite(payload.weekStart), 'api-weekly: weekStart missing/non-numeric');
      assert(Number.isFinite(payload.weekEnd), 'api-weekly: weekEnd missing/non-numeric');
      assert(payload.weekEnd > payload.weekStart, 'api-weekly: weekEnd must be after weekStart');
      assert(payload.weekEnd - payload.weekStart === 604_800_000, 'api-weekly: weekly window must span exactly seven days');
    },
  });

  if (sampleNumber < samples && sampleDelayMs > 0) await sleep(sampleDelayMs);
}

function percentile(values, ratio) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function summarize() {
  const byProbe = new Map();
  for (const observation of observations) {
    const bucket = byProbe.get(observation.name) || [];
    bucket.push(observation.latencyMs);
    byProbe.set(observation.name, bucket);
  }
  return [...byProbe.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, values]) => {
    const p50 = percentile(values, 0.5);
    const p95 = percentile(values, 0.95);
    const max = Math.max(...values);
    const budgetMs = latencyBudgets[name] ?? 4_000;
    const withinBudget = p95 !== null && p95 <= budgetMs;
    if (!withinBudget) warnings.push(`${name}: p95 ${p95} ms exceeds observational budget ${budgetMs} ms`);
    return { name, samples: values.length, p50Ms: p50, p95Ms: p95, maxMs: max, budgetMs, withinBudget };
  });
}

function markdownReport(report) {
  const rows = report.probes.map((probe) => `| ${probe.name} | ${probe.samples} | ${probe.p50Ms ?? 'n/a'} | ${probe.p95Ms ?? 'n/a'} | ${probe.maxMs ?? 'n/a'} | ${probe.budgetMs} | ${probe.withinBudget ? 'yes' : 'no'} |`).join('\n');
  const issueLines = [...report.failures.map((item) => `- FAIL: ${item}`), ...report.warnings.map((item) => `- WARN: ${item}`)];
  return `# P27 production burn-in telemetry\n\n- Status: **${report.status.toUpperCase()}**\n- Captured: ${report.generatedAt}\n- Site: ${report.siteUrl}\n- API: ${report.apiBase}\n- Samples: ${report.sampleCount}\n- Synthetic only: no player/session telemetry collected\n\n| Probe | n | p50 ms | p95 ms | max ms | budget ms | within budget |\n| --- | ---: | ---: | ---: | ---: | ---: | :---: |\n${rows}\n\n## Findings\n\n${issueLines.length ? issueLines.join('\n') : '- No contract, availability, recovery, or latency-budget findings.'}\n`;
}

for (let sample = 1; sample <= samples; sample += 1) await runSample(sample);

const probes = summarize();
const latencyViolation = probes.some((probe) => !probe.withinBudget);
const status = failures.length > 0 ? 'unhealthy' : warnings.length > 0 ? 'degraded' : 'healthy';
const report = {
  schemaVersion: 1,
  phase: 'P27',
  generatedAt: new Date().toISOString(),
  siteUrl: siteUrl.toString(),
  apiBase,
  productionOrigin,
  sampleCount: samples,
  timeoutMs,
  maxAttempts,
  strictLatency,
  status,
  syntheticOnly: true,
  observations,
  probes,
  failures,
  warnings,
};

await mkdir(outputDir, { recursive: true });
await writeFile(`${outputDir}/production-telemetry.json`, `${JSON.stringify(report, null, 2)}\n`);
const markdown = markdownReport(report);
await writeFile(`${outputDir}/summary.md`, markdown);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, `\n${markdown}`, { flag: 'a' });

if (failures.length) {
  console.error('P27 POST-RELEASE BURN-IN — FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

if (strictLatency && latencyViolation) {
  console.error('P27 POST-RELEASE BURN-IN — FAIL (STRICT LATENCY)');
  for (const warning of warnings) console.error(`- ${warning}`);
  process.exit(1);
}

console.log(`P27 POST-RELEASE BURN-IN — ${status.toUpperCase()}`);
console.log(`Synthetic production contracts passed across ${samples} sample(s); ${warnings.length} warning(s).`);
