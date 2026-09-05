import { chromium } from '@playwright/test';

const BASE_URL = process.env.P21_BASE_URL || 'http://127.0.0.1:4173';
const CHROME_PATH = process.env.P21_CHROME_PATH || undefined;

const gameIds = ['breakout', 'airhockey', 'tower', 'pacmaze', 'oneline', 'chrono'];
const profiles = [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, reducedMotion: 'no-preference' },
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' },
  { name: 'small-mobile', viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' },
];

const failures = [];
let passes = 0;
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const collectErrors = (page) => {
  const pageErrors = [];
  const consoleErrors = [];
  const onPageError = (error) => pageErrors.push(String(error?.message || error));
  const onConsole = (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/Failed to load resource|ERR_CONNECTION|favicon/i.test(text)) return;
    consoleErrors.push(text);
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  return {
    pageErrors,
    consoleErrors,
    cleanup: () => {
      page.off('pageerror', onPageError);
      page.off('console', onConsole);
    },
  };
};

const waitForHome = async (page) => {
  await page.waitForFunction(() => document.documentElement.dataset.p19Cohesion === 'ready', null, { timeout: 5000 });
  await page.locator('main#library-section').waitFor({ state: 'visible', timeout: 8000 });
};

const launch = async (page, id) => {
  await page.locator(`#play-btn-${id}`).click({ timeout: 8000 });
  await page.locator('.game-shell').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForFunction((gameId) => {
    const shell = document.querySelector('.game-shell');
    return shell?.getAttribute('data-p18-game') === gameId && shell?.getAttribute('data-p19-shell') === 'canonical';
  }, id, { timeout: 5000 });
};

const waitForShellText = async (page, required, failureMessage) => {
  try {
    await page.waitForFunction((needles) => {
      const text = document.querySelector('.game-shell')?.textContent?.toUpperCase() ?? '';
      return needles.every((needle) => text.includes(needle));
    }, required.map((value) => value.toUpperCase()), { timeout: 5000 });
  } catch {
    throw new Error(failureMessage);
  }
};

const puckMasterControl = (page) => page.locator('#air-hockey-container button').filter({ hasText: /^MASTER(?:\s|$)/i });

const assertCandidateMarker = async (page, id) => {
  if (id === 'breakout') {
    await page.locator('.game-shell canvas').waitFor({ state: 'visible', timeout: 5000 });
  } else if (id === 'airhockey') {
    await waitForShellText(page, ['POWER', 'TIME:', 'CASUAL', 'PRO', 'MASTER'], 'Neon Puck Smash missing Power/time/difficulty landmarks');
    assert(await puckMasterControl(page).count() === 1, 'Neon Puck Smash missing MASTER difficulty control');
  } else if (id === 'tower') {
    await waitForShellText(page, ['LASER:', 'APEX'], 'Gravity Tower missing laser/Apex landmarks');
    assert(await page.getByRole('button', { name: /Activate Apex Drive/i }).count() === 1, 'Gravity Tower missing Apex control');
  } else if (id === 'pacmaze') {
    await waitForShellText(page, ['LEVEL 1', 'SCATTER', 'DOTS:'], 'Cyber Pac-Runner missing level/mode/dot landmarks');
  } else if (id === 'oneline') {
    await waitForShellText(page, ['MASTER ROUTE', 'INK:', 'RANDOM', 'CLEAR'], 'One Line missing mastery/ink controls');
  } else if (id === 'chrono') {
    await waitForShellText(page, ['STAGE 1', 'FOCUS', 'ROTATE LEFT', 'ROTATE RIGHT'], 'Chrono Wave missing stage/focus/rotation landmarks');
  }
};

const exerciseCandidateInput = async (page, id) => {
  if (id === 'breakout') {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(80);
  } else if (id === 'airhockey') {
    await puckMasterControl(page).click();
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(80);
    await waitForShellText(page, ['MASTER', 'POWER'], 'Puck difficulty/power state disappeared after input');
  } else if (id === 'tower') {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(80);
  } else if (id === 'pacmaze') {
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(80);
  } else if (id === 'oneline') {
    const canvas = page.locator('.game-shell canvas');
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.18, box.y + box.height * 0.25);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.65, { steps: 8 });
      await page.mouse.up();
    }
    await page.waitForTimeout(80);
  } else if (id === 'chrono') {
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(60);
    await page.keyboard.up('ArrowRight');
  }
};

const assertPauseMastery = (id, pauseText) => {
  const upper = pauseText.toUpperCase();
  if (id === 'breakout') assert(upper.includes('ROUND CONTRACT'), 'Breakout pause lost Round Contract teaching');
  if (id === 'airhockey') assert(upper.includes('POWER'), 'Puck pause lost Power Play teaching');
  if (id === 'tower') assert(upper.includes('APEX'), 'Tower pause lost Apex teaching');
  if (id === 'pacmaze') assert(upper.includes('HUNT'), 'Pac pause lost Hunt teaching');
  if (id === 'oneline') assert(upper.includes('MASTER ROUTE'), 'One Line pause lost Master Route teaching');
  if (id === 'chrono') assert(upper.includes('FOCUS'), 'Chrono pause lost Focus teaching');
};

const runCandidate = async (page, profile, id) => {
  const errors = collectErrors(page);
  try {
    await launch(page, id);
    await assertCandidateMarker(page, id);

    const shellState = await page.evaluate(() => {
      const shell = document.querySelector('.game-shell');
      const stage = shell?.querySelector('main');
      const rect = stage?.getBoundingClientRect();
      return {
        shell: shell?.getAttribute('data-p19-shell'),
        p18: shell?.getAttribute('data-p18-clarity'),
        title: shell?.querySelector('h1 > span')?.textContent?.trim() || '',
        overflowX: shell ? shell.scrollWidth - shell.clientWidth : 999,
        stageVisible: Boolean(rect && rect.width > 40 && rect.height > 80),
        reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      };
    });
    assert(shellState.shell === 'canonical' && shellState.p18 === 'ready', `P18/P19 shell contract missing for ${id}`);
    assert(shellState.title.length > 0 && shellState.stageVisible, `candidate shell/stage not visible for ${id}`);
    assert(shellState.overflowX <= 2, `${id} shell horizontal overflow: ${shellState.overflowX}px`);
    if (profile.reducedMotion === 'reduce') assert(shellState.reduced, `${id} reduced-motion profile not active`);

    await exerciseCandidateInput(page, id);
    await assertCandidateMarker(page, id);

    await page.locator('#game-pause-btn').click();
    await page.waitForFunction(() => Boolean(document.querySelector('[data-p18-dialog="pause"][data-p19-dialog="pause"]')), null, { timeout: 3000 });
    await page.waitForFunction(() => {
      const overlay = document.querySelector('[data-p19-dialog="pause"]');
      return Boolean(overlay && document.activeElement && overlay.contains(document.activeElement));
    }, null, { timeout: 2000 });
    const pauseText = await page.locator('[data-p19-dialog="pause"]').innerText();
    assert(pauseText.includes('OBJECTIVE') && pauseText.includes('BACK TO ARCADE'), `${id} pause lost P18/P19 teaching/navigation`);
    assertPauseMastery(id, pauseText);
    await page.locator('[data-p19-dialog="pause"]').getByRole('button', { name: /^RESUME \(ESC\)$/i }).click();

    await page.locator('#game-restart-btn').click();
    await page.waitForTimeout(120);
    await assertCandidateMarker(page, id);
    const afterRestart = await page.evaluate((gameId) => ({
      shells: document.querySelectorAll('.game-shell[data-p19-shell="canonical"]').length,
      identity: document.querySelector('.game-shell')?.getAttribute('data-p18-game'),
      dialogs: document.querySelectorAll('[data-p19-dialog]').length,
    }), id);
    assert(afterRestart.shells === 1 && afterRestart.identity === id && afterRestart.dialogs === 0, `${id} restart did not cleanly reset candidate state`);

    assert(errors.pageErrors.length === 0, `${id} page errors: ${errors.pageErrors.join(' | ')}`);
    assert(errors.consoleErrors.length === 0, `${id} console errors: ${errors.consoleErrors.join(' | ')}`);

    await page.locator('#game-back-btn').click();
    await page.waitForFunction(() => !document.querySelector('.game-shell'), null, { timeout: 4000 });
    await waitForHome(page);
  } finally {
    errors.cleanup();
  }
};

const launchOptions = { headless: true, args: ['--disable-dev-shm-usage', '--no-sandbox'] };
if (CHROME_PATH) launchOptions.executablePath = CHROME_PATH;
else launchOptions.channel = 'chrome';

const browser = await chromium.launch(launchOptions);
try {
  for (const profile of profiles) {
    const context = await browser.newContext({
      viewport: profile.viewport,
      isMobile: profile.isMobile,
      hasTouch: profile.hasTouch,
      reducedMotion: profile.reducedMotion,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForHome(page);

    for (const id of gameIds) {
      try {
        await runCandidate(page, profile, id);
        passes++;
        console.log(`PASS ${profile.name.padEnd(12)} ${id}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${profile.name}/${id}: ${message}`);
        console.error(`FAIL ${profile.name}/${id}: ${message}`);
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
        await waitForHome(page).catch(() => {});
      }
    }

    await context.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error('\nP21 BROWSER STRONG-A PROMOTION CERTIFICATION — FAIL');
  console.error(`${passes}/18 candidate/profile sessions passed.`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('\nP21 BROWSER STRONG-A PROMOTION CERTIFICATION — PASS');
console.log('18/18 candidate/profile sessions certified across Breakout Mini, Neon Puck Smash, Gravity Tower Jumper, Cyber Pac-Runner, One Line and Chrono Wave.');
console.log('Desktop, reduced-motion mobile and reduced-motion small-mobile promotion paths remain responsive, accessible and error-free.');
