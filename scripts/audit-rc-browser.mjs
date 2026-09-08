import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { chromium } from '@playwright/test';

// Exercise real built service workers on an isolated origin, including failed updates.
const dist = path.resolve('dist');
const source = await fs.readFile(path.join(dist, 'sw.js'), 'utf8');
assert(!source.includes('__ARCADE_BUILD_ID__'), 'Production worker needs a content-derived build ID');
let generation = 1;
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const target = path.resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!target.startsWith(dist + path.sep)) { response.writeHead(403).end(); return; }
    if (generation === 3 && pathname.includes('/assets/StackGame-')) { response.writeHead(503).end('Simulated failed release asset'); return; }
    const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
    response.setHeader('content-type', mime[path.extname(target)] || 'application/octet-stream');
    response.setHeader('cache-control', 'no-store');
    response.end(pathname === '/sw.js' ? source.replace(/(CACHE_PREFIX\}\s*)[a-f0-9]{20}/, `$1rc-test-${generation}`) : await fs.readFile(target));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const executablePath = process.env.RC_CHROME_PATH || process.env.P3_CHROME_PATH;
const browser = await chromium.launch(executablePath ? { executablePath } : { channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
const errors = [];
try {
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.waitForFunction(() => document.querySelectorAll('[id^="play-btn-"]').length === 32);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  const ids = await page.locator('[id^="play-btn-"]').evaluateAll(nodes => nodes.map(node => node.id.slice(9)));
  const artifacts = process.env.RC_ARTIFACT_DIR;
  if (artifacts) await fs.mkdir(artifacts, { recursive: true });
  for (const width of [320, 360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 2, null, { timeout: 3000 });
    await page.waitForFunction(() => {
      const brand = document.getElementById('brand-logo-btn').getBoundingClientRect();
      const search = document.getElementById('search-toggle-btn').getBoundingClientRect();
      return Math.abs(brand.y + brand.height / 2 - search.y - search.height / 2) < 2;
    }, null, { timeout: 3000 });
    const overlaps = await page.locator('.p19-home-header button').evaluateAll(buttons => {
      const rects = buttons.map(button => ({ id: button.id, rect: button.getBoundingClientRect() })).filter(({rect}) => rect.width && rect.height);
      return rects.flatMap((a, i) => rects.slice(i + 1).filter(b => Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left) > 1 && Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top) > 1).map(b => `${a.id}/${b.id}`));
    });
    assert.deepEqual(overlaps, [], `Header control overlap at ${width}px`);
    if (artifacts) await page.screenshot({ path: path.join(artifacts, `arcade-home-${width}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await context.setOffline(true);
  await page.reload();
  for (const id of ids) {
    await page.locator(`#play-btn-${id}`).click();
    await page.waitForFunction(gameId => document.querySelector('.game-shell')?.getAttribute('data-p18-game') === gameId, id);
    await page.locator('#game-back-btn').click();
    await page.locator('.game-shell').waitFor({ state: 'detached' });
  }
  console.log('PASS all 32 games launch after offline reload; seven responsive widths');
  await page.locator('#play-btn-flappyaero').click();
  await page.locator('#btn-play-again').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#btn-view-leaderboard').focus();
  await page.keyboard.press('Space');
  await page.locator('#close-stats-modal-btn').waitFor({ state: 'visible' });
  assert(await page.locator('.game-shell').getAttribute('inert') !== null, 'Covered game must be inert');
  await page.keyboard.press('r');
  await page.keyboard.press('Escape');
  await page.locator('#close-stats-modal-btn').waitFor({ state: 'detached' });
  assert(await page.locator('#btn-play-again').isVisible(), 'Leaderboard shortcuts must not restart the covered game');
  assert.match(await page.locator('[data-score-submission]').innerText(), /local only/);
  await page.locator('#btn-play-again').click();
  await page.locator('#btn-play-again').waitFor({ state: 'detached' });
  await page.locator('#game-back-btn').click();
  console.log('PASS natural game over, truthful local status, keyboard leaderboard, replay');

  await context.setOffline(false);
  const second = await context.newPage();
  await second.goto(base);
  await page.locator('#play-btn-stack').click();
  const documentMarker = await page.evaluate(() => performance.timeOrigin);
  generation = 2;
  await second.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await second.getByRole('button', { name: 'UPDATE NOW', exact: true }).waitFor({ timeout: 20000 });
  await second.getByRole('button', { name: 'UPDATE NOW', exact: true }).click();
  await second.waitForFunction(async () => !(await navigator.serviceWorker.getRegistration()).waiting);
  await page.waitForFunction(async () => (await caches.keys()).some(key => key.endsWith('rc-test-2')));
  assert.equal(await page.evaluate(() => performance.timeOrigin), documentMarker, 'Another tab update reloaded an active run');
  assert(await page.locator('.game-shell').isVisible());
  assert.equal((await page.evaluate(() => caches.keys())).filter(key => key.startsWith('micro-arcade-shell-')).length, 2);
  console.log('PASS explicit update retains prior cache and does not reload another active tab');

  generation = 3;
  await second.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Failed update did not settle')), 20000);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'redundant') { clearTimeout(timeout); resolve(); }
        });
      }, { once: true });
      await registration.update();
    });
  });
  assert(!(await page.evaluate(() => caches.keys())).some(key => key.endsWith('rc-test-3')), 'Incomplete release cache was retained');
  await context.setOffline(true);
  await second.reload();
  await second.locator('#play-btn-stack').click();
  await second.locator('.game-shell').waitFor({ state: 'visible' });
  console.log('PASS incomplete update discarded; previous complete arcade still works offline');
  assert.deepEqual(errors, [], 'Unexpected page exceptions');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
