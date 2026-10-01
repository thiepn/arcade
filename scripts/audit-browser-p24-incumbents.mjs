import { chromium } from '@playwright/test';

const BASE_URL = process.env.P24_BASE_URL || 'http://127.0.0.1:4173';
const CHROME_PATH = process.env.P24_CHROME_PATH || undefined;

const gameIds = ['pinball', 'vanguard', 'astroblaster', 'blockdrop', 'rhythm'];
const profiles = [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, reducedMotion: 'no-preference' },
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' },
  { name: 'small-mobile', viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' },
];

const failures = [];
let passes = 0;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const collectErrors = (page) => {
  const pageErrors = [];
  const consoleErrors = [];
  const onPageError = (error) => pageErrors.push(String(error?.message || error));
  const onConsole = (message) => {
    if (message.type() !== 'error') return;
    const value = message.text();
    if (/Failed to load resource|ERR_CONNECTION|favicon/i.test(value)) return;
    consoleErrors.push(value);
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
    return shell?.getAttribute('data-p18-game') === gameId
      && shell?.getAttribute('data-p19-shell') === 'canonical';
  }, id, { timeout: 5000 });
};

const exerciseIncumbent = async (page, id) => {
  if (id === 'pinball') {
    const left = page.locator('button[aria-label="Left flipper"]');
    const right = page.locator('button[aria-label="Right flipper"]');
    assert(await left.getAttribute('aria-keyshortcuts') === 'A ArrowLeft Space', 'Pinball left flipper shortcut contract missing');
    assert(await right.getAttribute('aria-keyshortcuts') === 'D ArrowRight Space', 'Pinball right flipper shortcut contract missing');
    assert(await left.getAttribute('aria-pressed') === 'false', 'Pinball left flipper should begin released');
    await page.keyboard.down('a');
    await page.waitForFunction(() => document.querySelector('button[aria-label="Left flipper"]')?.getAttribute('aria-pressed') === 'true', null, { timeout: 1000 });
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForFunction(() => document.querySelector('button[aria-label="Left flipper"]')?.getAttribute('aria-pressed') === 'false', null, { timeout: 1000 });
    await page.keyboard.up('a');
  } else if (id === 'vanguard') {
    const bomb = page.locator('button[aria-label^="Nova EMP,"]');
    assert(await bomb.getAttribute('aria-keyshortcuts') === 'Space E B', 'Vanguard Nova shortcut contract missing');
    assert((await bomb.getAttribute('aria-label'))?.includes('2 bombs remaining'), 'Vanguard should begin with two Nova bombs');
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', repeat: true, bubbles: true })));
    await page.waitForTimeout(40);
    assert((await bomb.getAttribute('aria-label'))?.includes('2 bombs remaining'), 'Vanguard repeated Space consumed a Nova bomb');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => document.querySelector('button[aria-label^="Nova EMP,"]')?.getAttribute('aria-label')?.includes('1 bomb remaining'), null, { timeout: 1000 });
  } else if (id === 'astroblaster') {
    await page.locator('[data-replacement-game="hex-capture"]').waitFor({ state: 'visible', timeout: 3000 });
    const capture = page.getByRole('button', { name: 'Arm capture route' });
    assert(await capture.getAttribute('aria-keyshortcuts') === 'Space', 'Hex Capture arm control does not expose Space');
    assert(await capture.getAttribute('aria-pressed') === 'false', 'Hex Capture should begin with capture disarmed');
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', repeat: true, bubbles: true })));
    await page.waitForTimeout(40);
    assert(await capture.getAttribute('aria-pressed') === 'false', 'Hex Capture repeated Space toggled capture state');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => document.querySelector('button[aria-label="Arm capture route"]')?.getAttribute('aria-pressed') === 'true', null, { timeout: 1000 });
    const left = page.getByRole('button', { name: 'Move left' });
    assert(await left.getAttribute('aria-keyshortcuts') === 'A ArrowLeft', 'Hex Capture left control shortcut contract missing');
    assert(await left.getAttribute('aria-pressed') === 'false', 'Hex Capture left control should begin released');
    await page.keyboard.down('ArrowLeft');
    await page.waitForFunction(() => document.querySelector('button[aria-label="Move left"]')?.getAttribute('aria-pressed') === 'true', null, { timeout: 1000 });
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForFunction(() => document.querySelector('button[aria-label="Move left"]')?.getAttribute('aria-pressed') === 'false', null, { timeout: 1000 });
    await page.keyboard.up('ArrowLeft');
  } else if (id === 'blockdrop') {
    const hold = page.locator('button[aria-label="Hold or swap piece"]');
    assert(await hold.getAttribute('aria-keyshortcuts') === 'C Shift', 'Block Drop Hold shortcut contract missing');
    assert(await hold.isEnabled(), 'Block Drop Hold should begin available');
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', code: 'KeyC', repeat: true, bubbles: true })));
    await page.waitForTimeout(40);
    assert(await hold.isEnabled(), 'Block Drop repeated C consumed Hold');
    await page.keyboard.press('c');
    await page.waitForFunction(() => {
      const button = document.querySelector('button[aria-label="Hold or swap piece"]');
      return button instanceof HTMLButtonElement && button.disabled;
    }, null, { timeout: 1000 });
  } else if (id === 'rhythm') {
    const lane = page.locator('button[aria-label="Rhythm lane D"]');
    assert(await lane.getAttribute('aria-keyshortcuts') === 'D 1 ArrowLeft', 'Rhythm lane D shortcut contract missing');
    assert(await lane.getAttribute('aria-pressed') === 'false', 'Rhythm lane D should begin released');
    await page.keyboard.down('d');
    await page.waitForFunction(() => document.querySelector('button[aria-label="Rhythm lane D"]')?.getAttribute('aria-pressed') === 'true', null, { timeout: 1000 });
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForFunction(() => document.querySelector('button[aria-label="Rhythm lane D"]')?.getAttribute('aria-pressed') === 'false', null, { timeout: 1000 });
    await page.keyboard.up('d');
  }
};

const runCandidate = async (page, profile, id) => {
  const errors = collectErrors(page);
  try {
    await launch(page, id);

    const shell = await page.evaluate(() => {
      const node = document.querySelector('.game-shell');
      const stage = node?.querySelector('main');
      const rect = stage?.getBoundingClientRect();
      return {
        p18: node?.getAttribute('data-p18-clarity'),
        p19: node?.getAttribute('data-p19-shell'),
        overflowX: node ? node.scrollWidth - node.clientWidth : 999,
        stageVisible: Boolean(rect && rect.width > 40 && rect.height > 80),
        reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      };
    });
    assert(shell.p18 === 'ready' && shell.p19 === 'canonical', `${id} lost P18/P19 shell continuity`);
    assert(shell.overflowX <= 2 && shell.stageVisible, `${id} incumbent shell is not responsively contained`);
    if (profile.reducedMotion === 'reduce') assert(shell.reduced, `${id} reduced motion profile is not active`);

    await exerciseIncumbent(page, id);

    await page.locator('#game-pause-btn').click();
    await page.waitForFunction(() => Boolean(document.querySelector('[data-p18-dialog="pause"][data-p19-dialog="pause"]')), null, { timeout: 2500 });
    await page.locator('[data-p19-dialog="pause"]').getByRole('button', { name: /^RESUME \(ESC\)$/i }).click();
    await page.waitForFunction(() => document.activeElement === document.querySelector('[data-p18-stage]'), null, { timeout: 1500 });

    await page.locator('#game-restart-btn').click();
    await page.waitForTimeout(180);
    await page.waitForFunction((gameId) => document.querySelector('.game-shell')?.getAttribute('data-p18-game') === gameId, id, { timeout: 2500 });
    const restart = await page.evaluate((gameId) => ({
      shells: document.querySelectorAll('.game-shell[data-p19-shell="canonical"]').length,
      identity: document.querySelector('.game-shell')?.getAttribute('data-p18-game'),
      dialogs: document.querySelectorAll('[data-p19-dialog]').length,
    }), id);
    assert(restart.shells === 1 && restart.identity === id && restart.dialogs === 0, `${id} restart did not restore one clean incumbent shell`);

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
  console.error('\nP24 P15-INCUMBENT BROWSER SENTINEL — FAIL');
  console.error(`${passes}/15 candidate/profile sessions passed.`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('\nP24 P15-INCUMBENT BROWSER SENTINEL — PASS');
console.log('15/15 incumbent-slot/profile sessions certified across Neon Pinball, Galaxy Vanguard, the astroblaster compatibility slot (Hex Capture in production), Cyber Block Drop and Neon Rhythm Tapper.');
console.log('Focus-loss ownership, discrete high-value actions, shortcut semantics, pause/resume focus, restart cleanup and responsive containment are covered.');
