import { chromium } from '@playwright/test';

const BASE_URL = process.env.P23_BASE_URL || 'http://127.0.0.1:4173';
const CHROME_PATH = process.env.P23_CHROME_PATH || undefined;

const gameIds = ['typerush', 'perfectstop', 'reaction', 'pulse', 'laserrope', 'flappyaero', 'stack'];
const profiles = [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, reducedMotion: 'no-preference' },
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' },
  { name: 'small-mobile', viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' },
];

const transforms = {
  typerush: 'DIRECTIVE RELAY',
  perfectstop: 'BEACON ROUTE',
  reaction: 'REACTION CIRCUIT',
  pulse: 'GROOVE PATH',
  laserrope: 'CHOREOGRAPHY',
  flappyaero: 'FLIGHT LINE',
  stack: 'TOWER BLUEPRINT',
};

const resetLandmarks = {
  typerush: 'CHOOSE CONTROL OR VOLATILE TARGET',
  perfectstop: 'BEACON ROUTE • CHOOSE TARGET',
  reaction: 'CALIBRATION CIRCUIT',
  pulse: 'FLOW PATH • 1/4',
  laserrope: 'CROSS STEP • 1/4',
  flappyaero: 'RISE LINE • 1/3',
  stack: 'CENTERLINE • 1/3',
};

const failures = [];
let passes = 0;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

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
      && shell?.getAttribute('data-p19-shell') === 'canonical';
  }, id, { timeout: 5000 });
};

const marker = (page, id) => page.locator(`[data-p23-transform="${transforms[id]}"]`);

const waitForNativeReady = async (page, id) => {
  if (id === 'typerush') {
    await page.getByText('DEVICE KEYBOARD ACTIVE', { exact: true }).waitFor({ state: 'visible', timeout: 5000 });
  } else if (id === 'perfectstop') {
    await page.getByText('TAP OR SPACE TO LOCK', { exact: true }).waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('[aria-label="Precision beacon"]').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.game-shell main [tabindex="0"]').first().waitFor({ state: 'visible', timeout: 5000 });
  } else if (id === 'reaction') {
    await page.getByText('WAIT FOR THE SIGNAL', { exact: true }).waitFor({ state: 'visible', timeout: 5000 });
  } else if (id === 'pulse') {
    await page.getByText(/SYNC WAGER/, { exact: false }).first().waitFor({ state: 'visible', timeout: 5000 });
    await page.getByRole('button', { name: 'Queue right Groove Path' }).waitFor({ state: 'visible', timeout: 5000 });
  } else if (id === 'laserrope') {
    await page.getByRole('button', { name: 'Jump / Double Jump' }).waitFor({ state: 'visible', timeout: 5000 });
    await page.getByRole('button', { name: /^Redline,/i }).waitFor({ state: 'visible', timeout: 5000 });
  } else if (id === 'flappyaero') {
    await page.locator('#flappy-aero-container canvas').waitFor({ state: 'visible', timeout: 5000 });
    await page.getByRole('button', { name: /^Flow Boost,/i }).waitFor({ state: 'visible', timeout: 5000 });
  } else if (id === 'stack') {
    await page.locator('.game-shell canvas').waitFor({ state: 'visible', timeout: 5000 });
    await page.getByRole('button', { name: /^Focus,/i }).waitFor({ state: 'visible', timeout: 5000 });
  }
  await marker(page, id).waitFor({ state: 'visible', timeout: 5000 });
};

const assertTransformationControlSemantics = async (page, id) => {
  if (id === 'perfectstop') {
    const root = page.locator('.game-shell main [aria-keyshortcuts="Space Enter"]').first();
    assert(await root.count() === 1, 'Perfect Stop does not expose Space/Enter timing controls');
  } else if (id === 'pulse') {
    assert(await page.getByRole('button', { name: 'Queue left Groove Path' }).getAttribute('aria-keyshortcuts') === 'A ArrowLeft', 'Pulse left path shortcuts missing');
    assert(await page.getByRole('button', { name: 'Queue right Groove Path' }).getAttribute('aria-keyshortcuts') === 'D ArrowRight', 'Pulse right path shortcuts missing');
    const wager = page.getByRole('button', { name: /^Sync Wager,/i });
    assert(await wager.getAttribute('aria-keyshortcuts') === 'F Shift', 'Pulse Sync Wager shortcuts missing');
    assert(['true','false'].includes(await wager.getAttribute('aria-pressed')), 'Pulse Sync Wager state missing');
  } else if (id === 'laserrope') {
    const redline = page.getByRole('button', { name: /^Redline,/i });
    assert(await redline.getAttribute('aria-keyshortcuts') === 'F Shift', 'Laser Redline shortcuts missing');
    assert(['true','false'].includes(await redline.getAttribute('aria-pressed')), 'Laser Redline state missing');
    assert(await page.getByRole('button', { name: 'Jump / Double Jump' }).getAttribute('aria-keyshortcuts') === 'Space ArrowUp W', 'Laser jump shortcuts missing');
    assert(await page.getByRole('button', { name: 'Slide / Duck' }).getAttribute('aria-keyshortcuts') === 'ArrowDown S', 'Laser slide shortcuts missing');
  } else if (id === 'flappyaero') {
    const flow = page.getByRole('button', { name: /^Flow Boost,/i });
    assert(await flow.getAttribute('aria-keyshortcuts') === 'F Shift', 'Aero Flow shortcuts missing');
    assert(['true','false'].includes(await flow.getAttribute('aria-pressed')), 'Aero Flow state missing');
  } else if (id === 'stack') {
    const focus = page.getByRole('button', { name: /^Focus,/i });
    assert(await focus.getAttribute('aria-keyshortcuts') === 'F Shift', 'Stack Focus shortcuts missing');
    assert(['true','false'].includes(await focus.getAttribute('aria-pressed')), 'Stack Focus state missing');
  }
};

const exercise = async (page, id) => {
  const hud = marker(page, id);
  const before = (await hud.innerText()).trim();

  if (id === 'typerush') {
    const target = page.locator('button[aria-label^="Target "]').first();
    await target.waitFor({ state: 'visible', timeout: 6000 });
    const label = await target.getAttribute('aria-label');
    const word = String(label || '').replace(/^Target\s+/, '').trim();
    assert(word.length > 0, 'Type Rush target word missing from aria-label');
    await target.click();
    const typedBefore = await target.locator('span > span').first().innerText();
    await page.evaluate((key) => window.dispatchEvent(new KeyboardEvent('keydown', { key, code: `Key${key.toUpperCase()}`, repeat: true, bubbles: true })), word[0]);
    await page.waitForTimeout(30);
    assert(await target.locator('span > span').first().innerText() === typedBefore, 'Type Rush held-letter repeat advanced typing progress');
    await page.keyboard.type(word);
    await page.waitForFunction((oldText) => {
      const node = document.querySelector('[data-p23-transform="DIRECTIVE RELAY"]');
      return node && node.textContent !== oldText;
    }, before, { timeout: 1800 });
  } else if (id === 'perfectstop') {
    const gameRoot = page.locator('.game-shell main [tabindex="0"]').first();
    await page.waitForTimeout(250);
    await gameRoot.evaluate((root) => root.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', repeat: true, bubbles: true })));
    await page.waitForTimeout(30);
    assert(await gameRoot.getByText(/^(PERFECT|GREAT|GOOD|MISS)\s*•\s*\+/).count() === 0, 'Perfect Stop repeated Space prematurely stopped the marker');
    await gameRoot.click({ position: { x: 12, y: 12 } });
    await gameRoot.getByText(/^(PERFECT|GREAT|GOOD|MISS)\s*•\s*\+/).waitFor({ state: 'visible', timeout: 2500 });
    await gameRoot.getByText(/^TAP FOR\s+/).waitFor({ state: 'visible', timeout: 2500 });
    const sectorBeforeRepeat = (await gameRoot.getByText(/^SECTOR\s+/).innerText()).trim();
    await gameRoot.evaluate((root) => root.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', repeat: true, bubbles: true })));
    await page.waitForTimeout(30);
    assert((await gameRoot.getByText(/^SECTOR\s+/).innerText()).trim() === sectorBeforeRepeat, 'Perfect Stop repeated Space auto-advanced the result screen');
  } else if (id === 'reaction') {
    await page.keyboard.press('Space');
    await page.getByText('FALSE START', { exact: true }).waitFor({ state: 'visible', timeout: 2500 });
    await page.keyboard.press('Space');
    await page.getByText('WAIT FOR THE SIGNAL', { exact: true }).waitFor({ state: 'visible', timeout: 2500 });
    await page.keyboard.press('Space');
    await page.getByText('FALSE START', { exact: true }).waitFor({ state: 'visible', timeout: 2500 });
    const circuitGroup = page.getByRole('group', { name: 'Choose Reaction Circuit' });
    await circuitGroup.waitFor({ state: 'visible', timeout: 2500 });
    const speedChoice = page.getByRole('button', { name: 'Choose Speed Circuit' });
    const controlChoice = page.getByRole('button', { name: 'Choose Control Circuit' });
    assert(await speedChoice.getAttribute('aria-keyshortcuts') === 'ArrowLeft A 1', 'Reaction Speed Circuit shortcut metadata is missing');
    assert(await controlChoice.getAttribute('aria-keyshortcuts') === 'ArrowRight D 2', 'Reaction Control Circuit shortcut metadata is missing');
    await speedChoice.click();
    await page.waitForFunction(() => document.querySelector('[data-p23-transform="REACTION CIRCUIT"]')?.textContent?.includes('SPEED CIRCUIT 1/3'), null, { timeout: 1200 });
  } else if (id === 'pulse') {
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', repeat: true, bubbles: true })));
    await page.waitForTimeout(30);
    assert((await hud.innerText()).trim() === before, 'Pulse repeated path key changed Groove Path state');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction((oldText) => {
      const node = document.querySelector('[data-p23-transform="GROOVE PATH"]');
      const text = node?.textContent ?? '';
      return text !== oldText && text.includes('NEXT:');
    }, before, { timeout: 1200 });
    const wager = page.getByRole('button', { name: /^Sync Wager,/i });
    await page.keyboard.press('f');
    await page.waitForFunction(() => document.querySelector('button[aria-label^="Sync Wager,"]')?.getAttribute('aria-pressed') === 'true', null, { timeout: 1200 });
    assert(await wager.getAttribute('aria-pressed') === 'true', 'Pulse real F input did not arm Sync Wager');
  } else if (id === 'laserrope') {
    const redline = page.getByRole('button', { name: /^Redline,/i });
    await page.keyboard.press('f');
    await page.waitForFunction(() => document.querySelector('button[aria-label^="Redline,"]')?.getAttribute('aria-pressed') === 'true', null, { timeout: 1200 });
    assert(await redline.getAttribute('aria-pressed') === 'true', 'Laser real F input did not activate Redline');
    await page.keyboard.press('Space');
  } else if (id === 'flappyaero') {
    const flow = page.getByRole('button', { name: /^Flow Boost,/i });
    await page.keyboard.press('f');
    await page.waitForFunction(() => document.querySelector('button[aria-label^="Flow Boost,"]')?.getAttribute('aria-pressed') === 'true', null, { timeout: 1200 });
    assert(await flow.getAttribute('aria-pressed') === 'true', 'Aero real F input did not activate Flow Boost');
    await page.keyboard.press('Space');
  } else if (id === 'stack') {
    const focus = page.getByRole('button', { name: /^Focus,/i });
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', code: 'KeyF', repeat: true, bubbles: true })));
    await page.waitForTimeout(30);
    assert(await focus.getAttribute('aria-pressed') === 'false', 'Stack repeated F key armed Focus');
    await page.keyboard.press('f');
    await page.waitForFunction(() => document.querySelector('button[aria-label^="Focus,"]')?.getAttribute('aria-pressed') === 'true', null, { timeout: 1200 });
    assert(await focus.getAttribute('aria-pressed') === 'true', 'Stack real F input did not arm Focus');
    await page.keyboard.press('Space');
    await page.waitForTimeout(120);
  }

  assert((await hud.innerText()).trim().length > 0, `${id} P23 marker disappeared after real input`);
};

const runCandidate = async (page, profile, id) => {
  const errors = collectErrors(page);
  try {
    await launch(page, id);
    await waitForNativeReady(page, id);
    await assertTransformationControlSemantics(page, id);

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
    assert(shellState.title.length > 0 && shellState.stageVisible, `${id} shell/stage not visible`);
    assert(shellState.overflowX <= 2, `${id} shell horizontal overflow: ${shellState.overflowX}px`);
    if (profile.reducedMotion === 'reduce') assert(shellState.reduced, `${id} reduced-motion profile not active`);

    const initialText = (await marker(page, id).innerText()).toUpperCase();
    assert(initialText.includes(transforms[id]), `${id} P23 transformation title missing: ${initialText}`);

    await exercise(page, id);

    await page.locator('#game-pause-btn').click();
    await page.waitForFunction(() => Boolean(document.querySelector('[data-p18-dialog="pause"][data-p19-dialog="pause"]')), null, { timeout: 3000 });
    await page.locator(`[data-p23-teaching="${id}"]`).waitFor({ state: 'visible', timeout: 3000 });
    await page.waitForFunction(() => {
      const overlay = document.querySelector('[data-p19-dialog="pause"]');
      return Boolean(overlay && document.activeElement && overlay.contains(document.activeElement));
    }, null, { timeout: 2000 });
    const pauseText = (await page.locator('[data-p19-dialog="pause"]').innerText()).toUpperCase();
    assert(pauseText.includes('OBJECTIVE') && pauseText.includes('BACK TO ARCADE'), `${id} pause lost P18/P19 navigation`);
    assert(pauseText.includes(transforms[id]), `${id} pause missing P23 transformation teaching`);
    if (id === 'pulse') assert(pauseText.includes('A/D') && pauseText.includes('SYNC WAGER'), 'Pulse pause missing new path-choice/source control parity');
    await page.locator('[data-p19-dialog="pause"]').getByRole('button', { name: /^RESUME \(ESC\)$/i }).click();
    await page.waitForFunction(() => {
      const stage = document.querySelector('[data-p18-stage]');
      const textEntry = stage?.querySelector('input[type="text"], input:not([type]), textarea, [contenteditable="true"], [contenteditable=""]');
      const preferred = textEntry ?? stage;
      return Boolean(preferred && document.activeElement === preferred);
    }, null, { timeout: 1500 });

    await page.locator('#game-restart-btn').click();
    await page.waitForTimeout(180);
    await waitForNativeReady(page, id);
    const afterRestart = (await marker(page, id).innerText()).toUpperCase();
    assert(afterRestart.includes(resetLandmarks[id]), `${id} restart retained stale P23 state: ${afterRestart}`);

    const restartState = await page.evaluate((gameId) => ({
      shells: document.querySelectorAll('.game-shell[data-p19-shell="canonical"]').length,
      identity: document.querySelector('.game-shell')?.getAttribute('data-p18-game'),
      dialogs: document.querySelectorAll('[data-p19-dialog]').length,
      p23Markers: document.querySelectorAll('[data-p23-transform]').length,
    }), id);
    assert(restartState.shells === 1 && restartState.identity === id && restartState.dialogs === 0, `${id} restart did not cleanly reset shell/dialog state`);
    assert(restartState.p23Markers === 1, `${id} restart duplicated P23 transformation marker`);

    assert(errors.pageErrors.length === 0, `${id} page errors: ${errors.pageErrors.join(' | ')}`);
    assert(errors.consoleErrors.length === 0, `${id} console errors: ${errors.consoleErrors.join(' | ')}`);

    await page.locator('#game-back-btn').click();
    await page.waitForFunction(() => !document.querySelector('.game-shell') && !document.querySelector('[data-p23-transform]'), null, { timeout: 4000 });
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
  console.error('\nP23 BROWSER B-RANK TRANSFORMATION CERTIFICATION — FAIL');
  console.error(`${passes}/21 candidate/profile sessions passed.`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('\nP23 BROWSER B-RANK TRANSFORMATION CERTIFICATION — PASS');
console.log('21/21 candidate/profile sessions certified across Type Rush, Perfect Stop, Reaction, Pulse, Laser Rope Reflex, Aero Pulse and Stack.');
console.log('Desktop, reduced-motion mobile and reduced-motion small-mobile paths remain responsive, accessible and error-free.');
