import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.P31_BASE_URL || 'http://127.0.0.1:4173/';
const CHROME_PATH = process.env.P31_CHROME_PATH || undefined;
const SCREENSHOTS = process.env.P31_SCREENSHOTS === '1';

const profiles = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, reducedMotion: 'no-preference' },
  { name: 'phone-portrait', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'reduce' },
  { name: 'phone-landscape', viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'reduce' },
  { name: 'tablet-portrait', viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' },
];

const failures = [];
let assertions = 0;
const check = (condition, message) => {
  assertions += 1;
  if (!condition) throw new Error(message);
};
const url = (path = '') => new URL(path, BASE_URL.endsWith('/') ? BASE_URL : BASE_URL + '/').toString();

const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
try {
  if (SCREENSHOTS) mkdirSync('ui-report', { recursive: true });

  for (const profile of profiles) {
    const context = await browser.newContext({
      viewport: profile.viewport,
      deviceScaleFactor: profile.deviceScaleFactor,
      isMobile: profile.isMobile,
      hasTouch: profile.hasTouch,
      reducedMotion: profile.reducedMotion,
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error?.message || error)));

    await page.goto(url(), { waitUntil: 'domcontentloaded' });
    await page.locator('main#library-section').waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator('[aria-label="Daily challenge"]').waitFor({ state: 'visible', timeout: 8_000 });
    await page.locator('[aria-label="Arcade progression"]').waitFor({ state: 'visible', timeout: 8_000 });

    const home = await page.evaluate(() => {
      const rects = Array.from(document.querySelectorAll('[aria-label="Daily challenge"] button, [aria-label="Arcade progression"] button'))
        .map((node) => {
          const r = node.getBoundingClientRect();
          return { label: node.textContent?.replace(/\s+/g, ' ').trim() || '', width: r.width, height: r.height };
        });
      const p31 = Array.from(document.querySelectorAll('[data-p31-motion]'))
        .map((node) => node.getAttribute('data-p31-motion'));
      return {
        reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
        motionStates: p31,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        touchTargets: rects,
        daily: Boolean(document.querySelector('[aria-label="Daily challenge"]')),
        progression: Boolean(document.querySelector('[aria-label="Arcade progression"]')),
      };
    });

    check(home.daily && home.progression, `${profile.name}: return/progression surfaces missing`);
    check(home.overflowX <= 2, `${profile.name}: home horizontal overflow ${home.overflowX}px`);
    if (profile.reducedMotion === 'reduce') {
      check(home.reduced, `${profile.name}: reduced-motion media query not active`);
      check(home.motionStates.length >= 4 && home.motionStates.every((state) => state === 'reduced'), `${profile.name}: JS motion surfaces did not all enter reduced mode: ${home.motionStates}`);
    } else {
      check(!home.reduced && home.motionStates.includes('full'), `${profile.name}: full-motion state not exposed`);
    }
    if (profile.hasTouch) {
      check(home.touchTargets.length >= 5, `${profile.name}: expected P28/P29 touch actions`);
      check(home.touchTargets.every((target) => target.width >= 40 && target.height >= 40), `${profile.name}: small P28/P29 touch target ${JSON.stringify(home.touchTargets)}`);
    }

    await page.locator('#sound-toggle-btn').click();
    await page.locator('#sound-toggle-btn').click();

    if (SCREENSHOTS) {
      await page.screenshot({ path: `ui-report/p31-${profile.name}-home.png`, fullPage: true });
    }

    await page.locator('[aria-label="Daily challenge"] button').click();
    await page.locator('.game-shell').waitFor({ state: 'visible', timeout: 10_000 });
    const shell = await page.locator('.game-shell').evaluate((node) => ({
      overflowX: node.scrollWidth - node.clientWidth,
      width: node.getBoundingClientRect().width,
      height: node.getBoundingClientRect().height,
    }));
    check(shell.overflowX <= 2, `${profile.name}: game shell horizontal overflow ${shell.overflowX}px`);
    check(shell.width <= profile.viewport.width + 2 && shell.height <= profile.viewport.height + 2, `${profile.name}: game shell escapes viewport ${JSON.stringify(shell)}`);
    await page.locator('#game-back-btn').click();
    await page.locator('main#library-section').waitFor({ state: 'visible', timeout: 8_000 });

    check(pageErrors.length === 0, `${profile.name}: page errors: ${pageErrors.join(' | ')}`);
    await context.close();
  }

  const resultContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  const resultPage = await resultContext.newPage();
  const resultErrors = [];
  resultPage.on('pageerror', (error) => resultErrors.push(String(error?.message || error)));
  await resultPage.goto(url('tests/scoring.html'), { waitUntil: 'domcontentloaded' });
  await resultPage.waitForFunction(() => window.scoreFixture?.finish && window.scoreFixture?.emit, null, { timeout: 10_000 });
  await resultPage.evaluate(() => {
    window.scoreFixture.emit(120, 'standard');
    window.scoreFixture.finish(120, 'standard');
  });
  await resultPage.locator('[data-result-meta]').waitFor({ state: 'visible', timeout: 8_000 });
  const resultState = await resultPage.evaluate(() => {
    const shell = document.querySelector('.game-shell');
    const replay = document.getElementById('btn-play-again');
    const next = document.querySelector('[data-result-next-recommendation]');
    const replayRect = replay?.getBoundingClientRect();
    const nextRect = next?.getBoundingClientRect();
    return {
      overflowX: shell ? shell.scrollWidth - shell.clientWidth : 999,
      documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      replay: replayRect ? { width: replayRect.width, height: replayRect.height } : null,
      next: nextRect ? { width: nextRect.width, height: nextRect.height } : null,
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  });
  check(resultState.reduced, 'result fixture did not retain reduced-motion media preference');
  check(resultState.overflowX <= 2 && resultState.documentOverflowX <= 2, `result panel overflow: ${JSON.stringify(resultState)}`);
  check(Boolean(resultState.replay && resultState.replay.height >= 40), `result replay target too small: ${JSON.stringify(resultState.replay)}`);
  if (resultState.next) check(resultState.next.height >= 40, `result recommendation target too small: ${JSON.stringify(resultState.next)}`);
  check(resultErrors.length === 0, `result fixture page errors: ${resultErrors.join(' | ')}`);
  if (SCREENSHOTS) await resultPage.screenshot({ path: 'ui-report/p31-phone-result.png', fullPage: false });
  await resultContext.close();

  console.log(`P31 DEVICE-CLASS BROWSER ACCEPTANCE — PASS (${assertions} assertions)`);
  console.log('Desktop, phone portrait/landscape, tablet, reduced-motion, touch targets, launch/back and result-panel containment certified.');
} finally {
  await browser.close();
}
