import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const dist = process.env.P26_DIST || 'dist';
const expectedBase = process.env.P26_EXPECT_BASE || '/';
const errors = [];
const fail = (message) => errors.push(message);
const full = (relative) => join(root, dist, relative);
const readBuilt = (relative) => readFileSync(full(relative), 'utf8');

for (const required of ['index.html', 'asset-manifest.json', 'manifest.webmanifest', 'sw.js']) {
  if (!existsSync(full(required))) fail(`${dist}: missing ${required}`);
}

let manifest = {};
if (existsSync(full('asset-manifest.json'))) {
  try {
    manifest = JSON.parse(readBuilt('asset-manifest.json'));
  } catch (error) {
    fail(`${dist}: invalid asset-manifest.json: ${error}`);
  }
}

const keys = Object.keys(manifest);
const gameEntries = keys.filter((key) => key.startsWith('src/games/') && key.endsWith('.tsx'));
if (gameEntries.length !== 32) fail(`${dist}: expected exactly 32 shipped game chunks, found ${gameEntries.length}`);

const vectorEntries = gameEntries.filter((key) => key.endsWith('/VectorGolf.tsx'));
const hexEntries = gameEntries.filter((key) => key.endsWith('/HexCapture.tsx'));
const retiredEntries = gameEntries.filter((key) =>
  key.endsWith('/GravityGame.tsx') || key.endsWith('/AstroBlasterGame.tsx'));
if (vectorEntries.length !== 1) fail(`${dist}: Vector Golf production chunk count is ${vectorEntries.length}, expected 1`);
if (hexEntries.length !== 1) fail(`${dist}: Hex Capture production chunk count is ${hexEntries.length}, expected 1`);
if (retiredEntries.length !== 0) fail(`${dist}: retired Gravity/Astro engines are still shipped: ${retiredEntries.join(', ')}`);

for (const [key, entry] of Object.entries(manifest)) {
  if (!entry || typeof entry !== 'object') {
    fail(`${dist}: malformed manifest record ${key}`);
    continue;
  }
  if (typeof entry.file !== 'string' || !entry.file) {
    fail(`${dist}: manifest record ${key} has no output file`);
    continue;
  }
  if (!existsSync(full(entry.file))) fail(`${dist}: manifest output missing for ${key}: ${entry.file}`);
  for (const css of entry.css || []) if (!existsSync(full(css))) fail(`${dist}: CSS output missing for ${key}: ${css}`);
  for (const asset of entry.assets || []) if (!existsSync(full(asset))) fail(`${dist}: asset output missing for ${key}: ${asset}`);
  for (const dependency of entry.imports || []) if (!Object.hasOwn(manifest, dependency)) fail(`${dist}: manifest import ${dependency} referenced by ${key} is missing`);
  for (const dependency of entry.dynamicImports || []) if (!Object.hasOwn(manifest, dependency)) fail(`${dist}: manifest dynamic import ${dependency} referenced by ${key} is missing`);
}

const entryKey = keys.find((key) => manifest[key]?.isEntry === true);
if (!entryKey) fail(`${dist}: application entry record missing`);

if (existsSync(full('index.html'))) {
  const html = readBuilt('index.html');
  if (expectedBase === '/') {
    if (!html.includes('/assets/')) fail(`${dist}: root build does not reference /assets/`);
  } else if (!html.includes(`${expectedBase}assets/`)) {
    fail(`${dist}: expected built asset base ${expectedBase}`);
  }
  if (!html.includes('manifest.webmanifest')) fail(`${dist}: built index lost the PWA manifest`);
}

if (existsSync(full('sw.js'))) {
  const sw = readBuilt('sw.js');
  if (sw.includes('__ARCADE_BUILD_ID__')) fail(`${dist}: service worker still contains the build-id placeholder`);
  if (!/micro-arcade-shell-/.test(sw)) fail(`${dist}: versioned service-worker cache prefix missing`);
  if (!sw.includes("scopeUrl('asset-manifest.json')") || !sw.includes('discoverManifestAssets')) {
    fail(`${dist}: service worker does not discover the complete lazy chunk graph`);
  }
}

for (const key of gameEntries) {
  const entry = manifest[key];
  if (!entry?.file || !existsSync(full(entry.file))) continue;
  const size = statSync(full(entry.file)).size;
  if (size <= 0) fail(`${dist}: empty production game chunk for ${key}`);
  if (size > 350_000) fail(`${dist}: production game chunk exceeds 350 KB for ${key}: ${size}`);
}

if (errors.length) {
  console.error('P26 PRODUCTION ARTIFACT CERTIFICATION — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P26 PRODUCTION ARTIFACT CERTIFICATION — PASS');
console.log(`32 shipped game chunks verified in ${dist}; Vector Golf and Hex Capture are present, retired Gravity/Astro engines are absent, and the complete versioned PWA artifact graph resolves at ${expectedBase}.`);
