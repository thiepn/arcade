import { chromium } from '@playwright/test';

const BASE_URL = process.env.P17_BASE_URL || 'http://127.0.0.1:4173';
const CHROME_PATH = process.env.P17_CHROME_PATH || undefined;

const gameIds = [
  'orbit','stack','reaction','dodge','pulse','merge','typerush','oneline','breakout','perfectstop',
  'chain','gravity','blade','pinball','chrono','matrix','drift','vanguard','slingshot','snake',
  'rhythm','tower','pacmaze','flappyaero','roadcross','bubblebuster','astroblaster','laserrope',
  'blockdrop','knifetarget','airhockey','neonrail',
];

const profiles = [
  { name: 'desktop-full', viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, reducedMotion: 'no-preference' },
  { name: 'mobile-reduced', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' },
];

const failures = [];
let passes = 0;
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const runGame = async (page, profile, gameId) => {
  const pageErrors = [];
  const onPageError = (error) => pageErrors.push(String(error?.message || error));
  page.on('pageerror', onPageError);
  try {
    const play = page.locator(`#play-btn-${gameId}`);
    await play.click({ timeout: 8000 });
    const shell = page.locator('.game-shell');
    await shell.waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForFunction((id) => document.querySelector('.game-shell')?.getAttribute('data-p17-game') === id, gameId, { timeout: 4000 });

    const initial = await page.evaluate(({ id, expectedMotion }) => {
      const shell = document.querySelector('.game-shell');
      const stage = shell?.querySelector('main > div') || shell?.querySelector('main');
      const layer = stage?.querySelector('[data-p17-feedback-layer="true"]');
      const bursts = layer ? Array.from(layer.querySelectorAll('.p17-feedback-burst')) : [];
      const rect = layer?.getBoundingClientRect();
      return {
        id: shell?.getAttribute('data-p17-game'),
        ready: shell?.getAttribute('data-p17-feel'),
        layerCount: document.querySelectorAll('.p17-feedback-layer').length,
        burstCount: bursts.length,
        pointerEvents: layer ? getComputedStyle(layer).pointerEvents : '',
        layerWidth: rect?.width || 0,
        layerHeight: rect?.height || 0,
        motion: document.documentElement.getAttribute('data-p17-motion'),
        expectedMotion,
        expectedId: id,
      };
    }, { id: gameId, expectedMotion: profile.reducedMotion === 'reduce' ? 'reduced' : 'full' });

    assert(initial.id === gameId, `P17 shell identity mismatch: ${initial.id}`);
    assert(initial.ready === 'ready', 'P17 shell runtime not ready');
    assert(initial.layerCount === 1, `expected one feedback layer, found ${initial.layerCount}`);
    assert(initial.burstCount === 8, `expected eight pooled feedback nodes, found ${initial.burstCount}`);
    assert(initial.pointerEvents === 'none', 'feedback layer intercepts pointer input');
    assert(initial.layerWidth > 100 && initial.layerHeight > 100, 'feedback layer collapsed');
    assert(initial.motion === initial.expectedMotion, `motion preference mismatch: ${initial.motion}`);

    const box = await page.locator('.game-shell main').boundingBox();
    assert(box, 'game stage missing');
    const inputState = await page.evaluate(({ x, y, pointerType }) => {
      const target = document.querySelector('.game-shell main > div') || document.querySelector('.game-shell main');
      if (!target) return { active: false };
      target.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 17,
        pointerType,
        isPrimary: true,
        clientX: x,
        clientY: y,
        buttons: 1,
      }));
      const active = Boolean(document.querySelector('.p17-feedback-burst.is-active[data-p17-kind="input"]'));
      target.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 17,
        pointerType,
        isPrimary: true,
        clientX: x,
        clientY: y,
        buttons: 0,
      }));
      return { active };
    }, {
      x: box.x + box.width * 0.5,
      y: box.y + box.height * 0.55,
      pointerType: profile.isMobile ? 'touch' : 'mouse',
    });
    assert(inputState.active, 'pointer input did not receive immediate P17 acknowledgement');

    const masteryState = await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('arcade:p17-feedback', { detail: { kind: 'mastery' } }));
      return {
        burst: Boolean(document.querySelector('.p17-feedback-burst.is-active[data-p17-kind="mastery"]')),
        stage: Boolean(document.querySelector('.game-shell main > div.p17-stage-mastery')),
      };
    });
    assert(masteryState.burst, 'mastery feedback did not activate');
    assert(masteryState.stage, 'mastery hierarchy did not reach the stage');

    const failureState = await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('arcade:p17-feedback', { detail: { kind: 'failure' } }));
      return {
        burst: Boolean(document.querySelector('.p17-feedback-burst.is-active[data-p17-kind="failure"]')),
        stage: Boolean(document.querySelector('.game-shell main > div.p17-stage-failure')),
      };
    });
    assert(failureState.burst, 'failure feedback did not activate');
    assert(failureState.stage, 'failure hierarchy did not reach the stage');

    const overflow = await page.evaluate(() => {
      const shell = document.querySelector('.game-shell');
      return shell ? { x: shell.scrollWidth - shell.clientWidth, y: shell.scrollHeight - shell.clientHeight } : { x: 999, y: 999 };
    });
    assert(overflow.x <= 2 && overflow.y <= 2, `P17 feedback created shell overflow ${overflow.x}/${overflow.y}`);

    await page.locator('#game-restart-btn').click();
    await page.waitForTimeout(80);
    const afterRestart = await page.evaluate(() => ({
      layers: document.querySelectorAll('.p17-feedback-layer').length,
      nodes: document.querySelectorAll('.p17-feedback-layer .p17-feedback-burst').length,
    }));
    assert(afterRestart.layers === 1 && afterRestart.nodes === 8, `restart leaked feedback DOM ${afterRestart.layers}/${afterRestart.nodes}`);
    assert(pageErrors.length === 0, `page errors: ${pageErrors.join(' | ')}`);

    await page.locator('#game-back-btn').click();
    await play.waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForFunction(() => document.querySelectorAll('.p17-feedback-layer').length === 0, null, { timeout: 2000 });
    const afterExit = await page.evaluate(() => ({
      shells: document.querySelectorAll('.game-shell').length,
      layers: document.querySelectorAll('.p17-feedback-layer').length,
    }));
    assert(afterExit.shells === 0 && afterExit.layers === 0, `exit leaked P17 shell/layer ${afterExit.shells}/${afterExit.layers}`);
  } finally {
    page.off('pageerror', onPageError);
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

    for (const gameId of gameIds) {
      try {
        await runGame(page, profile, gameId);
        passes++;
        console.log(`PASS ${profile.name.padEnd(14)} ${gameId}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${profile.name}/${gameId}: ${message}`);
        console.error(`FAIL ${profile.name}/${gameId}: ${message}`);
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

const expected = gameIds.length * profiles.length;
console.log(`\nP17 BROWSER FEEL CERTIFICATION — ${failures.length ? 'FAIL' : 'PASS'}`);
console.log(`${passes}/${expected} game/profile sessions certified; full-motion desktop + reduced-motion touch mobile.`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
