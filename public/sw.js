/* Micro Arcade MA3 service worker — offline shell + explicit updates. */
const CACHE_PREFIX = 'micro-arcade-shell-';
const CACHE_NAME = `${CACHE_PREFIX}ma3-v1`;

function scopeUrl(path = './') {
  return new URL(path, self.registration.scope).href;
}

function isCacheable(url) {
  const parsed = new URL(url);
  const scope = new URL(self.registration.scope);
  return parsed.origin === scope.origin && parsed.href.startsWith(scope.href);
}

function discoverShellAssets(html) {
  const urls = new Set([
    scopeUrl('./'),
    scopeUrl('manifest.webmanifest'),
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
  return [...urls];
}

async function fetchAndCache(cache, url) {
  const response = await fetch(url, { cache: 'reload' });
  if (!response.ok) throw new Error(`Unable to cache ${url}: ${response.status}`);
  await cache.put(url, response.clone());
  return response;
}

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  const rootResponse = await fetchAndCache(cache, scopeUrl('./'));
  const html = await rootResponse.clone().text();
  const assets = discoverShellAssets(html).filter((url) => url !== scopeUrl('./'));
  await Promise.all(assets.map(async (url) => {
    try {
      await fetchAndCache(cache, url);
    } catch (error) {
      console.warn('[Micro Arcade SW] Optional precache failed:', url, error);
    }
  }));
}

self.addEventListener('install', (event) => {
  // Do not call skipWaiting here. MA3 updates are activated only after the UI asks.
  event.waitUntil(precacheShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function navigationResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const network = await fetch(request);
    if (network.ok) {
      await cache.put(scopeUrl('./'), network.clone());
    }
    return network;
  } catch {
    return (await cache.match(scopeUrl('./'))) || Response.error();
  }
}

async function assetResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    // Revalidate without delaying the current response.
    void fetch(request).then((network) => {
      if (network.ok) return cache.put(request, network.clone());
    }).catch(() => {});
    return cached;
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

  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request));
    return;
  }

  event.respondWith(assetResponse(request));
});
