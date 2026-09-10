import { chromium } from '@playwright/test';

const BASE_URL = process.env.STORAGE_BASE_URL || 'http://127.0.0.1:4173';
const CHROME_PATH = process.env.STORAGE_CHROME_PATH || undefined;
const PUBLIC_GAME_COUNT = 30;
const launchOptions = { headless: true, args: ['--disable-dev-shm-usage', '--no-sandbox'] };
if (CHROME_PATH) launchOptions.executablePath = CHROME_PATH;
else launchOptions.channel = 'chrome';

const browser = await chromium.launch(launchOptions);
try {
  // Recoverable primary-store failure: sessionStorage must preserve the snapshot,
  // the scary memory-only warning must stay hidden, survive a reload, and heal.
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
    await page.waitForFunction((count) => document.querySelectorAll('[id^="play-btn-"]').length === count, PUBLIC_GAME_COUNT, { timeout: 8000 });
    await page.locator('#play-btn-orbit').click();
    await page.locator('.game-shell').waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => Boolean(sessionStorage.getItem('micro_arcade_stats_v3_session_fallback')), null, { timeout: 3000 });
    let warningCount = await page.getByText(/Persistent browser storage is unavailable|Browser storage is blocked|Browser storage is full/i).count();
    if (warningCount !== 0) throw new Error('Recoverable session fallback displayed a persistent-storage warning');

    // Reloading the tab must keep the fallback snapshot and must not manufacture
    // the old permanent warning while localStorage is still unwritable.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction((count) => document.querySelectorAll('[id^="play-btn-"]').length === count, PUBLIC_GAME_COUNT, { timeout: 8000 });
    await page.waitForFunction(() => {
      const raw = sessionStorage.getItem('micro_arcade_stats_v3_session_fallback');
      if (!raw) return false;
      return (JSON.parse(raw).playCounts?.orbit ?? 0) >= 1;
    }, null, { timeout: 3000 });
    warningCount = await page.getByText(/Persistent browser storage is unavailable|Browser storage is blocked|Browser storage is full/i).count();
    if (warningCount !== 0) throw new Error('Session fallback displayed a warning after reload');

    await page.evaluate(() => {
      window.__allowArcadePersistentStorage = true;
      window.dispatchEvent(new Event('focus'));
    });
    await page.waitForFunction(() => Boolean(localStorage.getItem('micro_arcade_stats_v3')) && !sessionStorage.getItem('micro_arcade_stats_v3_session_fallback'), null, { timeout: 3000 });
    const healed = await page.evaluate(() => JSON.parse(localStorage.getItem('micro_arcade_stats_v3')));
    if ((healed.playCounts?.orbit ?? 0) < 1) throw new Error('Recovered persistent snapshot lost session progress');
    await context.close();
    console.log('PASS recoverable localStorage failure survives reload without the permanent warning and heals automatically');
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
        'micro_arcade_stats_v3_session_replace',
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
    await page.waitForFunction((count) => document.querySelectorAll('[id^="play-btn-"]').length === count, PUBLIC_GAME_COUNT, { timeout: 8000 });
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