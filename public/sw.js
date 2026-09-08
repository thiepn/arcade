/* Micro Arcade MA4 service worker — complete offline arcade + explicit updates. */
const CACHE_PREFIX = `micro-arcade-shell-${new URL(self.registration.scope).pathname}-`;
const CACHE_NAME = `${CACHE_PREFIX}__ARCADE_BUILD_ID__`;

function scopeUrl(path = './') {
  return new URL(path, self.registration.scope).href;
}

function isCacheable(url) {
  const parsed = new URL(url);
  const scope = new URL(self.registration.scope);
  return parsed.origin === scope.origin && parsed.href.startsWith(scope.href);
}

function discoverHtmlAssets(html) {
  const urls = new Set([
    scopeUrl('./'),
    scopeUrl('manifest.webmanifest'),
    scopeUrl('asset-manifest.json'),
    scopeUrl('icons/icon-192.png'),
    scopeUrl('icons/icon-512.png'),
    scopeUrl('icons/apple-touch-icon.png'),
  ]);
  const attrPattern = /(?:src|href)=["']([^"']+)["']/gi;
  let match;
  while ((match = attrPattern.exec(html))) {
    try {
      const resolved = new URL(match[1], scopeUrl('./')).href;
      if (isCacheable(resolved)) urls.add(resolved);
    } catch {}
  }
  return urls;
}

function discoverManifestAssets(manifest) {
  const urls = new Set();
  for (const entry of Object.values(manifest || {})) {
    for (const value of [entry?.file, ...(entry?.css || []), ...(entry?.assets || [])]) {
      if (!value) continue;
      const resolved = scopeUrl(value);
      if (isCacheable(resolved)) urls.add(resolved);
    }
  }
  return urls;
}

async function fetchAndCache(cache, url) {
  const response = await fetch(url, { cache: 'reload' });
  if (!response.ok) throw new Error(`Unable to cache ${url}: ${response.status}`);
  await cache.put(url, response.clone());
  return response;
}

async function precacheArcade() {
  const cache = await caches.open(CACHE_NAME);
  const rootResponse = await fetchAndCache(cache, scopeUrl('./'));
  const html = await rootResponse.clone().text();
  const urls = discoverHtmlAssets(html);

  const manifestResponse = await fetchAndCache(cache, scopeUrl('asset-manifest.json'));
  const manifest = await manifestResponse.clone().json();
  for (const url of discoverManifestAssets(manifest)) urls.add(url);

  urls.delete(scopeUrl('./'));
  urls.delete(scopeUrl('asset-manifest.json'));
  const results = await Promise.allSettled([...urls].map(url => fetchAndCache(cache, url)));
  if (results.some(result => result.status === 'rejected')) throw new Error('Arcade download incomplete');
}

self.addEventListener('install', (event) => {
  // Do not call skipWaiting here. Updates activate only after explicit player consent.
  event.waitUntil(precacheArcade().catch(async error => {
    await caches.delete(CACHE_NAME);
    throw error;
  }));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // Keep the previous complete build for tabs still running its lazy chunks.
    const previous = keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).slice(-1)[0];
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME && key !== previous)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function navigationResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const shell = await cache.match(scopeUrl('./'));
  if (shell) return shell;
  try {
    const network = await fetch(request);
    return network;
  } catch {
    return (await cache.match(scopeUrl('./'))) || Response.error();
  }
}

async function assetResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  for (const key of await caches.keys()) {
    if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) {
      const previous = await (await caches.open(key)).match(request);
      if (previous) return previous;
    }
  }
  const network = await fetch(request);
  if (network.ok) await cache.put(request, network.clone());
  return network;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!isCacheable(url.href)) return; // Never intercept the leaderboard/API origin.
  if (url.pathname.startsWith(new URL('v1/', self.registration.scope).pathname) || url.pathname.startsWith('/v1/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request));
    return;
  }
  event.respondWith(assetResponse(request));
});
