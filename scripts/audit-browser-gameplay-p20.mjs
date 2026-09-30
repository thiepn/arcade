import { chromium } from '@playwright/test';

const BASE_URL = process.env.P20_BASE_URL || 'http://127.0.0.1:4173';
const CHROME_PATH = process.env.P20_CHROME_PATH || undefined;

const gameIds = ['gravity', 'chain', 'merge', 'drift', 'dodge', 'blade'];
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

const assertCandidateMarker = async (page, id) => {
  // GameShell/P18/P19 can mount before a lazy game chunk has completed rendering.
  // Wait for the actual game-native landmarks instead of sampling immediately.
  if (id === 'gravity') {
    await waitForShellText(page, ['FLIGHT CONTRACT'], 'Gravity missing FLIGHT CONTRACT promotion landmark');
  } else if (id === 'chain') {
    await waitForShellText(
      page,
      ['RESONANCE', 'PLASMA BLAST', 'TESLA ARC', 'CRYO VORTEX', 'CHARGES'],
      'Chain missing Resonance or three-tool promotion landmarks',
    );
  } else if (id === 'merge') {
    await waitForShellText(page, ['CONTRACT', 'QUEUE'], 'Merge missing CONTRACT/QUEUE information hierarchy');
  } else if (id === 'drift') {
    await waitForShellText(page, ['STYLE ROUTE', 'NITRO BOOST', 'KM/H'], 'Cyber Drift missing Style Route/Nitro/speed promotion landmarks');
  } else if (id === 'dodge') {
    await waitForShellText(page, ['WARP DASH'], 'Dodge missing WARP DASH state landmark');
  } else if (id === 'blade') {
    const phrase = page.locator('[data-p20-blade-phrase]');
    await phrase.waitFor({ state: 'visible', timeout: 5000 });
    const label = await phrase.getAttribute('data-p20-blade-phrase');
    const text = await phrase.innerText();
    assert(label === 'CLEAN CUTS' && text.includes('PHRASE') && text.includes('STEP 1/3'), `Laser Blade authored phrase HUD invalid: ${label} / ${text}`);
  }
};

const assertFlagshipControlSemantics = async (page, id, phase = 'before') => {
  if (id === 'gravity') {
    const flip = page.getByRole('button', { name: /Set gravity field/i });
    assert(await flip.getAttribute('aria-keyshortcuts') === 'G', 'Gravity flip control does not expose G');
    assert(['true', 'false'].includes(await flip.getAttribute('aria-pressed')), 'Gravity flip control does not expose state');
    const recall = page.getByRole('button', { name: /Re-aim probe/i }).first();
    assert(await recall.getAttribute('aria-keyshortcuts') === 'Q', 'Gravity recall control does not expose Q');
    if (phase === 'after') assert(await flip.getAttribute('aria-pressed') === 'true', 'Gravity G input did not flip the semantic polarity state');
  } else if (id === 'chain') {
    const plasma = page.getByRole('button', { name: /Select Plasma Blast/i });
    const tesla = page.getByRole('button', { name: /Select Tesla Arc/i });
    assert(Boolean(await page.getByRole('group', { name: 'Detonator tool' }).count()), 'Chain tool selector is not a named control group');
    if (phase === 'before') {
      assert(await plasma.getAttribute('aria-pressed') === 'true' && await tesla.getAttribute('aria-pressed') === 'false', 'Chain initial tool state is not semantically exposed');
    } else {
      assert(await plasma.getAttribute('aria-pressed') === 'false' && await tesla.getAttribute('aria-pressed') === 'true', 'Chain tool selection did not update semantic state');
    }
  } else if (id === 'merge') {
    const hammer = page.getByRole('button', { name: /Hammer:/i });
    assert(['true', 'false'].includes(await hammer.getAttribute('aria-pressed')), 'Merge hammer state is not semantically exposed');
    assert(await page.getByRole('button', { name: /Drop tile in column 1/i }).count() === 1, 'Merge board columns are not keyboard-addressable controls');
  } else if (id === 'drift') {
    const nitro = page.getByRole('button', { name: /Nitro boost/i });
    assert(await nitro.getAttribute('aria-keyshortcuts') === 'Space', 'Cyber Drift Nitro does not expose Space');
    const left = page.getByRole('button', { name: 'Steer left' });
    const right = page.getByRole('button', { name: 'Steer right' });
    assert(['true', 'false'].includes(await left.getAttribute('aria-pressed')) && ['true', 'false'].includes(await right.getAttribute('aria-pressed')), 'Cyber Drift steering state is not semantically exposed');
    if (phase === 'after') {
      assert(await left.getAttribute('aria-pressed') === 'false' && await right.getAttribute('aria-pressed') === 'false', 'Cyber Drift blur cleanup left steering active');
    }
  } else if (id === 'dodge') {
    const dash = page.getByRole('button', { name: /Warp Dash/i });
    assert(await dash.getAttribute('aria-keyshortcuts') === 'Space', 'Dodge Warp Dash does not expose Space');
    const label = await dash.getAttribute('aria-label') || '';
    if (phase === 'before') assert(/2 charges remaining/i.test(label), `Dodge initial dash state is wrong: ${label}`);
    else assert(/1 charge remaining/i.test(label), `Dodge keyboard dash did not consume exactly one charge: ${label}`);
  } else if (id === 'blade') {
    const phrase = page.locator('[data-p20-blade-phrase]');
    const label = await phrase.getAttribute('aria-label') || '';
    assert(/Blade phrase CLEAN CUTS, step 1 of 3/i.test(label), `Laser Blade phrase semantics invalid: ${label}`);
  }
};

const exerciseCandidateInput = async (page, id) => {
  if (id === 'gravity') {
    await page.keyboard.press('g');
    await page.waitForTimeout(50);
  } else if (id === 'chain') {
    await page.getByRole('button', { name: /TESLA ARC/i }).click();
    const canvas = page.locator('.game-shell canvas');
    const box = await canvas.boundingBox();
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  } else if (id === 'merge') {
    await page.keyboard.press('2');
    await page.waitForTimeout(80);
  } else if (id === 'drift') {
    const nitro = page.getByRole('button', { name: /Nitro boost/i });
    if (await nitro.isEnabled()) await nitro.click();
    await page.keyboard.down('ArrowLeft');
    await page.waitForFunction(() => document.querySelector('button[aria-label="Steer left"]')?.getAttribute('aria-pressed') === 'true', null, { timeout: 1000 });
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForFunction(() => document.querySelector('button[aria-label="Steer left"]')?.getAttribute('aria-pressed') === 'false', null, { timeout: 1000 });
    await page.keyboard.up('ArrowLeft');
  } else if (id === 'dodge') {
    await page.keyboard.press('Space');
    await page.waitForFunction(() => /1 charge remaining/i.test(document.querySelector('button[aria-keyshortcuts="Space"][aria-label^="Warp Dash"]')?.getAttribute('aria-label') || ''), null, { timeout: 1000 });
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForTimeout(60);
  } else if (id === 'blade') {
    const canvas = page.locator('#laser-blade-container canvas');
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.65);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.35, { steps: 6 });
      await page.mouse.up();
    }
  }
};

const runCandidate = async (page, profile, id) => {
  const errors = collectErrors(page);
  try {
    await launch(page, id);
    await assertCandidateMarker(page, id);
    await assertFlagshipControlSemantics(page, id, 'before');

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
    await page.waitForTimeout(80);
    await assertCandidateMarker(page, id);
    await assertFlagshipControlSemantics(page, id, 'after');

    await page.locator('#game-pause-btn').click();
    await page.waitForFunction(() => Boolean(document.querySelector('[data-p18-dialog="pause"][data-p19-dialog="pause"]')), null, { timeout: 3000 });
    await page.waitForFunction(() => {
      const overlay = document.querySelector('[data-p19-dialog="pause"]');
      return Boolean(overlay && document.activeElement && overlay.contains(document.activeElement));
    }, null, { timeout: 2000 });
    const pauseText = await page.locator('[data-p19-dialog="pause"]').innerText();
    assert(pauseText.includes('OBJECTIVE') && pauseText.includes('BACK TO ARCADE'), `${id} pause lost P18/P19 teaching/navigation`);
    await page.locator('[data-p19-dialog="pause"]').getByRole('button', { name: /^RESUME \(ESC\)$/i }).click();
    await page.waitForFunction(() => {
      const stage = document.querySelector('[data-p18-stage]');
      return Boolean(stage && document.activeElement === stage);
    }, null, { timeout: 1500 });

    await page.locator('#game-restart-btn').click();
    await page.waitForTimeout(100);
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
  console.error('\nP20 BROWSER NEAR-S PROMOTION CERTIFICATION — FAIL');
  console.error(`${passes}/18 candidate/profile sessions passed.`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('\nP20 BROWSER NEAR-S PROMOTION CERTIFICATION — PASS');
console.log('18/18 candidate/profile sessions certified across Gravity, Chain, Merge, Cyber Drift, Dodge and Laser Blade.');
console.log('Desktop, reduced-motion mobile and reduced-motion small-mobile promotion paths remain responsive and error-free.');
