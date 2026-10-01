import { chromium } from '@playwright/test';

const BASE_URL = process.env.P26_BASE_URL || 'http://127.0.0.1:4173';
const CHROME_PATH = process.env.P26_CHROME_PATH || undefined;
const QUICK = process.env.P26_QUICK === '1';
const LOCAL_RUN = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/i.test(BASE_URL);
const MAX_CANVAS_PIXELS = 8_388_608;

const allGameIds = [
  'orbit', 'stack', 'reaction', 'dodge', 'pulse', 'merge', 'typerush', 'oneline',
  'breakout', 'perfectstop', 'chain', 'gravity', 'blade', 'pinball', 'chrono',
  'matrix', 'drift', 'vanguard', 'slingshot', 'snake', 'rhythm', 'tower',
  'pacmaze', 'flappyaero', 'roadcross', 'bubblebuster', 'astroblaster',
  'laserrope', 'blockdrop', 'knifetarget', 'airhockey', 'neonrail',
];
const replacementIds = ['gravity', 'astroblaster'];

const profiles = [
  {
    name: 'high-dpr-landscape',
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
    gameIds: QUICK ? replacementIds : allGameIds,
  },
  {
    name: 'high-dpr-portrait',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
    gameIds: replacementIds,
  },
  {
    name: 'tablet-touch',
    viewport: { width: 820, height: 1180 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
    gameIds: replacementIds,
  },
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
    const value = message.text();
    if (/favicon/i.test(value)) return;
    if (LOCAL_RUN && /Failed to load resource|ERR_CONNECTION|leaderboard/i.test(value)) return;
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
  await page.waitForFunction(
    () => document.documentElement.dataset.p19Cohesion === 'ready',
    null,
    { timeout: 6000 },
  );
  await page.locator('main#library-section').waitFor({ state: 'visible', timeout: 8000 });
};

const launch = async (page, id) => {
  await page.locator(`#play-btn-${id}`).click({ timeout: 8000 });
  await page.locator('.game-shell').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForFunction((gameId) => {
    const shell = document.querySelector('.game-shell');
    return shell?.getAttribute('data-p18-game') === gameId
      && shell?.getAttribute('data-p19-shell') === 'canonical'
      && shell?.getAttribute('data-p18-clarity') === 'ready';
  }, id, { timeout: 6000 });

  if (id === 'gravity') {
    await page.locator('[data-replacement-game="vector-golf"]').waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForFunction(
      () => document.querySelector('.game-shell h1 > span')?.textContent?.trim() === 'Vector Golf',
      null,
      { timeout: 3000 },
    );
  }
  if (id === 'astroblaster') {
    await page.locator('[data-replacement-game="hex-capture"]').waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForFunction(
      () => document.querySelector('.game-shell h1 > span')?.textContent?.trim() === 'Hex Capture',
      null,
      { timeout: 3000 },
    );
  }
};

const assertDeviceGeometry = async (page, id, profile) => {
  const geometry = await page.evaluate((maxPixels) => {
    const shell = document.querySelector('.game-shell');
    const stage = shell?.querySelector('[data-p18-stage]');
    const stageRect = stage?.getBoundingClientRect();
    const cssHeight = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--arcade-viewport-height'),
    );
    const visualHeight = window.visualViewport?.height ?? window.innerHeight;
    const canvases = Array.from(shell?.querySelectorAll('canvas') ?? []).map((canvas) => {
      const rect = canvas.getBoundingClientRect();
      return {
        backingWidth: canvas.width,
        backingHeight: canvas.height,
        pixels: canvas.width * canvas.height,
        width: rect.width,
        height: rect.height,
        effectiveDprX: rect.width > 0 ? canvas.width / rect.width : 0,
        effectiveDprY: rect.height > 0 ? canvas.height / rect.height : 0,
        withinBudget: canvas.width * canvas.height <= maxPixels,
      };
    });
    return {
      shellOverflowX: shell ? shell.scrollWidth - shell.clientWidth : 999,
      stageVisible: Boolean(stageRect && stageRect.width > 40 && stageRect.height > 80),
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      cssHeight,
      visualHeight,
      canvases,
    };
  }, MAX_CANVAS_PIXELS);

  assert(geometry.shellOverflowX <= 2, `${id}/${profile.name} horizontal overflow ${geometry.shellOverflowX}px`);
  assert(geometry.stageVisible, `${id}/${profile.name} gameplay stage is not visible`);
  assert(geometry.reduced, `${id}/${profile.name} reduced-motion profile not active`);
  assert(
    Number.isFinite(geometry.cssHeight) && Math.abs(geometry.cssHeight - geometry.visualHeight) <= 4,
    `${id}/${profile.name} dynamic viewport height drift: ${geometry.cssHeight} vs ${geometry.visualHeight}`,
  );
  for (const canvas of geometry.canvases) {
    assert(canvas.width > 20 && canvas.height > 20, `${id}/${profile.name} canvas rendered too small`);
    assert(canvas.withinBudget, `${id}/${profile.name} canvas backing store exceeds ${MAX_CANVAS_PIXELS} pixels`);
  }

  if (replacementIds.includes(id)) {
    assert(geometry.canvases.length >= 1, `${id}/${profile.name} replacement canvas missing`);
    for (const canvas of geometry.canvases) {
      assert(canvas.effectiveDprX <= 2.05 && canvas.effectiveDprY <= 2.05,
        `${id}/${profile.name} replacement canvas escaped the safe DPR cap`);
    }
  }
};

const assertTouchTargets = async (page, selectors, label) => {
  for (const selector of selectors) {
    const target = page.locator(selector);
    await target.waitFor({ state: 'visible', timeout: 3000 });
    const box = await target.boundingBox();
    assert(box && box.width >= 36 && box.height >= 36, `${label} touch target is below 36px: ${selector}`);
  }
};

const exerciseVectorGolf = async (page, profile) => {
  const guide = page.getByRole('button', { name: 'Aim guide' });
  assert(await guide.getAttribute('aria-keyshortcuts') === 'G', `Vector/${profile.name} guide shortcut missing`);
  assert(await guide.getAttribute('aria-pressed') === 'true', `Vector/${profile.name} guide should start enabled`);
  await assertTouchTargets(page, ['button[aria-label="Aim guide"]'], `Vector/${profile.name}`);

  await page.keyboard.press('g');
  await page.waitForFunction(
    () => document.querySelector('button[aria-label="Aim guide"]')?.getAttribute('aria-pressed') === 'false',
    null,
    { timeout: 1000 },
  );

  // Start a real drag on the opening ball, interrupt ownership, then release.
  // A stale drag would incorrectly fire a shot and increment STROKES.
  const canvas = page.locator('canvas[aria-label="Vector Golf course"]');
  const box = await canvas.boundingBox();
  assert(box, `Vector/${profile.name} canvas has no box`);
  const ballX = box.x + box.width * (90 / 900);
  const ballY = box.y + box.height * (455 / 560);
  await page.mouse.move(ballX, ballY);
  await page.mouse.down();
  await page.mouse.move(ballX + Math.min(35, box.width * 0.08), ballY - Math.min(35, box.height * 0.08));
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.up();
  await page.waitForTimeout(60);
  const afterBlur = await page.locator('.game-shell').innerText();
  assert(/STROKES\s*0/i.test(afterBlur), `Vector/${profile.name} blur-completed a stale drag shot`);

  await page.keyboard.press('Space');
  await page.waitForFunction(
    () => /STROKES\s*1/i.test(document.querySelector('.game-shell')?.textContent ?? ''),
    null,
    { timeout: 1000 },
  );
};

const exerciseHexCapture = async (page, profile) => {
  const capture = page.getByRole('button', { name: 'Arm capture route' });
  assert(await capture.getAttribute('aria-keyshortcuts') === 'Space', `Hex/${profile.name} capture shortcut missing`);
  assert(await capture.getAttribute('aria-pressed') === 'false', `Hex/${profile.name} capture should start disarmed`);

  await assertTouchTargets(
    page,
    [
      'button[aria-label="Move up"]',
      'button[aria-label="Move left"]',
      'button[aria-label="Move down"]',
      'button[aria-label="Move right"]',
      'button[aria-label="Arm capture route"]',
    ],
    `Hex/${profile.name}`,
  );

  await page.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: ' ',
      code: 'Space',
      repeat: true,
      bubbles: true,
    })),
  );
  await page.waitForTimeout(40);
  assert(await capture.getAttribute('aria-pressed') === 'false', `Hex/${profile.name} key repeat toggled capture`);

  await page.keyboard.press('Space');
  await page.waitForFunction(
    () => document.querySelector('button[aria-label="Arm capture route"]')?.getAttribute('aria-pressed') === 'true',
    null,
    { timeout: 1000 },
  );

  const left = page.getByRole('button', { name: 'Move left' });
  assert(await left.getAttribute('aria-keyshortcuts') === 'A ArrowLeft', `Hex/${profile.name} left shortcut missing`);
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(
    () => document.querySelector('button[aria-label="Move left"]')?.getAttribute('aria-pressed') === 'true',
    null,
    { timeout: 1000 },
  );
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(
    () => document.querySelector('button[aria-label="Move left"]')?.getAttribute('aria-pressed') === 'false',
    null,
    { timeout: 1000 },
  );
  await page.keyboard.up('ArrowLeft');
};

const pauseResume = async (page, id, profile) => {
  await page.locator('#game-pause-btn').click();
  await page.waitForFunction(
    () => Boolean(document.querySelector('[data-p18-dialog="pause"][data-p19-dialog="pause"]')),
    null,
    { timeout: 2500 },
  );
  await page.locator('[data-p19-dialog="pause"]')
    .getByRole('button', { name: /^RESUME \(ESC\)$/i })
    .click();
  await page.waitForFunction(
    () => document.activeElement === document.querySelector('[data-p18-stage]'),
    null,
    { timeout: 3000 },
  );
  assert(
    await page.locator('.game-shell').getAttribute('data-p18-game') === id,
    `${id}/${profile.name} identity changed across pause/resume`,
  );
};

const runGame = async (page, id, profile) => {
  const errors = collectErrors(page);
  try {
    await launch(page, id);
    await page.waitForTimeout(80);
    await assertDeviceGeometry(page, id, profile);

    if (id === 'gravity') await exerciseVectorGolf(page, profile);
    if (id === 'astroblaster') await exerciseHexCapture(page, profile);

    await pauseResume(page, id, profile);

    if (replacementIds.includes(id)) {
      // Repeated restarts stress component-owned observers/listeners without
      // waiting for an artificial wall-clock "long run".
      for (let cycle = 0; cycle < 3; cycle++) {
        await page.locator('#game-restart-btn').click();
        await page.waitForTimeout(80);
        await launchReplacementReady(page, id);
        const clean = await page.evaluate((gameId) => ({
          shells: document.querySelectorAll('.game-shell[data-p19-shell="canonical"]').length,
          identity: document.querySelector('.game-shell')?.getAttribute('data-p18-game'),
          vector: document.querySelectorAll('[data-replacement-game="vector-golf"]').length,
          hex: document.querySelectorAll('[data-replacement-game="hex-capture"]').length,
        }), id);
        assert(clean.shells === 1 && clean.identity === id, `${id}/${profile.name} restart leaked shell ownership`);
        assert((id === 'gravity' ? clean.vector : clean.hex) === 1, `${id}/${profile.name} restart duplicated replacement engine`);
      }
    }

    assert(errors.pageErrors.length === 0, `${id}/${profile.name} page errors: ${errors.pageErrors.join(' | ')}`);
    assert(errors.consoleErrors.length === 0, `${id}/${profile.name} console errors: ${errors.consoleErrors.join(' | ')}`);

    await page.locator('#game-back-btn').click();
    await page.waitForFunction(() => !document.querySelector('.game-shell'), null, { timeout: 4000 });
    await waitForHome(page);
  } finally {
    errors.cleanup();
  }
};

const launchReplacementReady = async (page, id) => {
  if (id === 'gravity') {
    await page.locator('[data-replacement-game="vector-golf"]').waitFor({ state: 'visible', timeout: 4000 });
    await page.waitForFunction(
      () => document.querySelector('.game-shell h1 > span')?.textContent?.trim() === 'Vector Golf',
      null,
      { timeout: 2500 },
    );
  } else if (id === 'astroblaster') {
    await page.locator('[data-replacement-game="hex-capture"]').waitFor({ state: 'visible', timeout: 4000 });
    await page.waitForFunction(
      () => document.querySelector('.game-shell h1 > span')?.textContent?.trim() === 'Hex Capture',
      null,
      { timeout: 2500 },
    );
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
      deviceScaleFactor: profile.deviceScaleFactor,
      isMobile: profile.isMobile,
      hasTouch: profile.hasTouch,
      reducedMotion: profile.reducedMotion,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForHome(page);

    for (const id of profile.gameIds) {
      try {
        await runGame(page, id, profile);
        passes++;
        console.log(`PASS ${profile.name.padEnd(18)} ${id}`);
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

const expectedPasses = QUICK ? 6 : 36;
if (failures.length || passes !== expectedPasses) {
  console.error('\nP26 DEVICE-PROFILE / PRODUCTION BROWSER CERTIFICATION — FAIL');
  console.error(`${passes}/${expectedPasses} sessions passed.`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('\nP26 DEVICE-PROFILE / PRODUCTION BROWSER CERTIFICATION — PASS');
console.log(`${passes}/${expectedPasses} browser device-profile sessions passed.`);
console.log('Full mode covers all 32 shipped slots in high-DPR landscape plus deep Vector Golf / Hex Capture portrait and tablet qualification.');
console.log('These browser device profiles are hardware proxies; they do not constitute physical-device thermal, GPU, touch-latency or OS-browser signoff.');
