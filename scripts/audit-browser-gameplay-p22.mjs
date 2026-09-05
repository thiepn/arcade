import { chromium } from '@playwright/test';

const BASE_URL = process.env.P22_BASE_URL || 'http://127.0.0.1:4173';
const CHROME_PATH = process.env.P22_CHROME_PATH || undefined;

const gameIds = ['snake', 'orbit', 'neonrail', 'slingshot', 'bubblebuster', 'matrix', 'knifetarget', 'roadcross'];
const profiles = [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, reducedMotion: 'no-preference' },
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' },
  { name: 'small-mobile', viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' },
];

const expectedTitles = {
  snake: 'PHASE THREAD CHAPTER',
  orbit: 'CONSTELLATION',
  neonrail: 'RAIL SEQUENCE',
  slingshot: 'MISSION ARC',
  bubblebuster: 'SALVO PLAN',
  matrix: 'PROTOCOL SUITE',
  knifetarget: 'RAZOR ROUTE',
  roadcross: 'DISTRICT ROUTE',
};

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
    return shell?.getAttribute('data-p18-game') === gameId
      && shell?.getAttribute('data-p19-shell') === 'canonical'
      && document.documentElement.dataset.p22Promotion === 'ready';
  }, id, { timeout: 5000 });
  await page.locator(`[data-p22-promotion="${id}"]`).waitFor({ state: 'visible', timeout: 5000 });
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

const assertCandidateMarker = async (page, id) => {
  const hud = page.locator(`[data-p22-promotion="${id}"]`);
  await hud.waitFor({ state: 'visible', timeout: 5000 });
  const title = (await hud.locator('.p22-hud-title').innerText()).trim().toUpperCase();
  assert(title === expectedTitles[id], `${id} P22 HUD title mismatch: ${title}`);
  assert((await hud.getAttribute('data-p22-structure'))?.length > 0, `${id} P22 structure marker is empty`);
  assert((await hud.getAttribute('data-p22-step'))?.length > 0, `${id} P22 step marker is empty`);

  if (id === 'snake') {
    await page.locator('.game-shell canvas').waitFor({ state: 'visible', timeout: 5000 });
  } else if (id === 'orbit') {
    await page.locator('.game-shell canvas').waitFor({ state: 'visible', timeout: 5000 });
  } else if (id === 'neonrail') {
    await waitForShellText(page, ['SURGE'], 'Neon Rail missing existing Surge mastery landmark');
  } else if (id === 'slingshot') {
    await waitForShellText(page, ['SECTOR', 'NAV'], 'Orbital Slingshot missing sector/navigation landmarks');
  } else if (id === 'bubblebuster') {
    await waitForShellText(page, ['NEXT ORB', 'BURST', 'SWAP'], 'Orb Cannon missing chamber/Burst landmarks');
  } else if (id === 'matrix') {
    await waitForShellText(page, ['PROTOCOL', 'OVERCLOCK'], 'Memory Matrix missing protocol/Overclock landmarks');
  } else if (id === 'knifetarget') {
    await waitForShellText(page, ['STAGE'], 'Knife Target missing stage landmark');
  } else if (id === 'roadcross') {
    await waitForShellText(page, ['ROW:', 'NEON SUBURB'], 'Cyber Crosser missing row/district landmarks');
  }
};

const exerciseCandidateInput = async (page, id) => {
  if (id === 'snake') {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(90);
  } else if (id === 'orbit') {
    await page.keyboard.press('Space');
    await page.waitForTimeout(90);
  } else if (id === 'neonrail') {
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
  } else if (id === 'slingshot') {
    await page.keyboard.press('Space');
    await page.waitForTimeout(120);
  } else if (id === 'bubblebuster') {
    const hud = page.locator('[data-p22-promotion="bubblebuster"]');
    const swap = page.locator('#bubble-buster-container button').filter({ hasText: 'SWAP' });
    const before = await hud.getAttribute('data-p22-step');
    assert(String(before).includes('SWAP'), `Orb Cannon CHAMBER READ did not begin on SWAP: ${before}`);
    assert(await swap.isEnabled(), 'Orb Cannon SWAP control was not initially available');
    await page.keyboard.press('KeyQ');
    await page.waitForFunction(() => {
      const control = Array.from(document.querySelectorAll('#bubble-buster-container button'))
        .find((button) => button.textContent?.includes('SWAP'));
      return control instanceof HTMLButtonElement && control.disabled;
    }, null, { timeout: 1200 });
    await page.waitForFunction(() => {
      const step = document.querySelector('[data-p22-promotion="bubblebuster"]')?.getAttribute('data-p22-step') ?? '';
      return step.includes('COMBO 1+');
    }, null, { timeout: 1200 });
    const after = await hud.getAttribute('data-p22-step');
    assert(before !== after && String(after).includes('COMBO 1+'), `Orb Cannon committed SWAP did not advance CHAMBER READ to its COMBO 1+ resolve step: ${after}`);
  } else if (id === 'matrix') {
    const overclock = page.locator('.game-shell button').filter({ hasText: 'OVERCLOCK NEXT' });
    assert(await overclock.count() === 1, 'Memory Matrix missing unique existing Overclock control');
    assert(await overclock.isEnabled(), 'Memory Matrix Overclock control was unexpectedly disabled');
    // Matrix owns this shortcut through KeyboardEvent.key, not KeyboardEvent.code.
    await page.keyboard.press('o');
    await page.waitForFunction(() => {
      const control = Array.from(document.querySelectorAll('.game-shell button'))
        .find((button) => button.textContent?.includes('OVERCLOCK'));
      return control?.textContent?.includes('OVERCLOCK ARMED') ?? false;
    }, null, { timeout: 1200 });
    await waitForShellText(page, ['OVERCLOCK ARMED'], 'Matrix O key-value input did not arm existing Overclock decision');
  } else if (id === 'knifetarget') {
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
  } else if (id === 'roadcross') {
    for (const key of ['ArrowLeft', 'ArrowLeft', 'ArrowUp', 'ArrowUp']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(180);
    }
    const structure = await page.locator('[data-p22-promotion="roadcross"]').getAttribute('data-p22-structure');
    assert(String(structure).includes('LEFT TRACE'), `Crosser real accepted moves did not select LEFT TRACE route: ${structure}`);
  }
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
        p22: document.documentElement.dataset.p22Promotion,
      };
    });
    assert(shellState.shell === 'canonical' && shellState.p18 === 'ready' && shellState.p22 === 'ready', `P18/P19/P22 shell contract missing for ${id}`);
    assert(shellState.title.length > 0 && shellState.stageVisible, `candidate shell/stage not visible for ${id}`);
    assert(shellState.overflowX <= 2, `${id} shell horizontal overflow: ${shellState.overflowX}px`);
    if (profile.reducedMotion === 'reduce') assert(shellState.reduced, `${id} reduced-motion profile not active`);

    await exerciseCandidateInput(page, id);
    await assertCandidateMarker(page, id);

    await page.locator('#game-pause-btn').click();
    await page.waitForFunction(() => Boolean(document.querySelector('[data-p18-dialog="pause"][data-p19-dialog="pause"]')), null, { timeout: 3000 });
    await page.locator(`[data-p22-teaching="${id}"]`).waitFor({ state: 'visible', timeout: 3000 });
    await page.waitForFunction(() => {
      const overlay = document.querySelector('[data-p19-dialog="pause"]');
      return Boolean(overlay && document.activeElement && overlay.contains(document.activeElement));
    }, null, { timeout: 2000 });
    const pauseText = (await page.locator('[data-p19-dialog="pause"]').innerText()).toUpperCase();
    assert(pauseText.includes('OBJECTIVE') && pauseText.includes('BACK TO ARCADE'), `${id} pause lost P18/P19 teaching/navigation`);
    assert(pauseText.includes(expectedTitles[id]), `${id} pause is missing P22 mastery teaching`);
    await page.locator('[data-p19-dialog="pause"]').getByRole('button', { name: /^RESUME \(ESC\)$/i }).click();

    await page.locator('#game-restart-btn').click();
    await page.waitForTimeout(180);
    await assertCandidateMarker(page, id);
    await page.waitForFunction((gameId) => {
      const hud = document.querySelector(`[data-p22-promotion="${gameId}"]`);
      return hud?.getAttribute('data-p22-bonus') === '0';
    }, id, { timeout: 3000 });
    const afterRestart = await page.evaluate((gameId) => ({
      shells: document.querySelectorAll('.game-shell[data-p19-shell="canonical"]').length,
      identity: document.querySelector('.game-shell')?.getAttribute('data-p18-game'),
      dialogs: document.querySelectorAll('[data-p19-dialog]').length,
      p22Hud: document.querySelectorAll(`[data-p22-promotion="${gameId}"]`).length,
      p22Bonus: document.querySelector(`[data-p22-promotion="${gameId}"]`)?.getAttribute('data-p22-bonus'),
    }), id);
    assert(afterRestart.shells === 1 && afterRestart.identity === id && afterRestart.dialogs === 0, `${id} restart did not cleanly reset candidate state`);
    assert(afterRestart.p22Hud === 1 && afterRestart.p22Bonus === '0', `${id} restart retained stale P22 run state`);

    assert(errors.pageErrors.length === 0, `${id} page errors: ${errors.pageErrors.join(' | ')}`);
    assert(errors.consoleErrors.length === 0, `${id} console errors: ${errors.consoleErrors.join(' | ')}`);

    await page.locator('#game-back-btn').click();
    await page.waitForFunction(() => !document.querySelector('.game-shell') && !document.querySelector('[data-p22-promotion]'), null, { timeout: 4000 });
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
  console.error('\nP22 BROWSER MID-A PROMOTION CERTIFICATION — FAIL');
  console.error(`${passes}/24 candidate/profile sessions passed.`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('\nP22 BROWSER MID-A PROMOTION CERTIFICATION — PASS');
console.log('24/24 candidate/profile sessions certified across Cyber Serpent, Orbit, Neon Rail Shift, Orbital Slingshot, Orb Cannon, Memory Matrix, Knife Target and Cyber Crosser.');
console.log('Desktop, reduced-motion mobile and reduced-motion small-mobile paths remain responsive, accessible and error-free.');
