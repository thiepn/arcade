import { chromium } from '@playwright/test';

const BASE_URL = process.env.STORAGE_BASE_URL || 'http://127.0.0.1:4173';
const CHROME_PATH = process.env.STORAGE_CHROME_PATH || undefined;
const launchOptions = { headless: true, args: ['--disable-dev-shm-usage', '--no-sandbox'] };
if (CHROME_PATH) launchOptions.executablePath = CHROME_PATH;
else launchOptions.channel = 'chrome';

const browser = await chromium.launch(launchOptions);
try {
  // Recoverable primary-store failure: sessionStorage must preserve the snapshot,
  // the scary memory-only warning must stay hidden, and focus retry must heal it.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(() => {
      window.__allowArcadePersistentStorage = false;
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (this === window.localStorage && key === 'micro_arcade_stats_v3' && !window.__allowArcadePersistentStorage) {
          throw new DOMException('Simulated quota pressure', 'QuotaExceededError');
        }
        return originalSetItem.call(this, key, value);
      };
    });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForFunction(() => document.querySelectorAll('[id^="play-btn-"]').length === 32, null, { timeout: 8000 });
    await page.locator('#play-btn-orbit').click();
    await page.locator('.game-shell').waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => Boolean(sessionStorage.getItem('micro_arcade_stats_v3_session_fallback')), null, { timeout: 3000 });
    const warningCount = await page.getByText(/Persistent browser storage is unavailable|Browser storage is blocked|Browser storage is full/i).count();
    if (warningCount !== 0) throw new Error('Recoverable session fallback displayed a persistent-storage warning');

    await page.evaluate(() => {
      window.__allowArcadePersistentStorage = true;
      window.dispatchEvent(new Event('focus'));
    });
    await page.waitForFunction(() => Boolean(localStorage.getItem('micro_arcade_stats_v3')) && !sessionStorage.getItem('micro_arcade_stats_v3_session_fallback'), null, { timeout: 3000 });
    const healed = await page.evaluate(() => JSON.parse(localStorage.getItem('micro_arcade_stats_v3')));
    if ((healed.playCounts?.orbit ?? 0) < 1) throw new Error('Recovered persistent snapshot lost session progress');
    await context.close();
    console.log('PASS recoverable localStorage failure uses session fallback without the permanent warning and heals automatically');
  }

  // Complete denial: warn only after confirmed failure, make the warning dismissible,
  // preserve memory progress, then recover that exact snapshot when storage returns.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(() => {
      window.__blockArcadeStorage = true;
      const originalGetItem = Storage.prototype.getItem;
      const originalSetItem = Storage.prototype.setItem;
      const blockedKeys = new Set([
        'micro_arcade_stats_v1',
        'micro_arcade_stats_v2',
        'micro_arcade_stats_v3',
        'micro_arcade_stats_v3_session_fallback',
      ]);
      Storage.prototype.getItem = function (key) {
        if (window.__blockArcadeStorage && blockedKeys.has(String(key))) {
          throw new DOMException('Simulated storage block', 'SecurityError');
        }
        return originalGetItem.call(this, key);
      };
      Storage.prototype.setItem = function (key, value) {
        if (window.__blockArcadeStorage && blockedKeys.has(String(key))) {
          throw new DOMException('Simulated storage block', 'SecurityError');
        }
        return originalSetItem.call(this, key, value);
      };
    });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForFunction(() => document.querySelectorAll('[id^="play-btn-"]').length === 32, null, { timeout: 8000 });
    await page.locator('#play-btn-stack').click();
    await page.getByText(/Browser storage is blocked/i).waitFor({ state: 'visible', timeout: 3000 });
    const dismiss = page.getByRole('button', { name: 'Dismiss storage warning' });
    await dismiss.click();
    await page.getByText(/Browser storage is blocked/i).waitFor({ state: 'detached', timeout: 2000 });

    await page.evaluate(() => {
      window.__blockArcadeStorage = false;
      window.dispatchEvent(new Event('focus'));
    });
    await page.waitForFunction(() => {
      const raw = localStorage.getItem('micro_arcade_stats_v3');
      if (!raw) return false;
      const stats = JSON.parse(raw);
      return (stats.playCounts?.stack ?? 0) >= 1;
    }, null, { timeout: 3000 });
    await context.close();
    console.log('PASS confirmed total denial is dismissible and recovers in-memory progress when browser storage returns');
  }

  console.log('ARCADE STORAGE RECOVERY BROWSER AUDIT — PASS');
} finally {
  await browser.close();
}
