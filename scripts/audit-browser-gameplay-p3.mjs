import { chromium } from '@playwright/test';

const BASE_URL = process.env.P3_BASE_URL || 'http://127.0.0.1:4173';
const CHROME_PATH = process.env.P3_CHROME_PATH || undefined;
const QUICK = process.env.P3_QUICK === '1';

const games = [
  ['orbit', ['Space', 'ArrowUp', 'KeyA']],
  ['stack', ['Space']],
  ['reaction', ['Space']],
  ['dodge', ['ArrowLeft', 'ArrowRight']],
  ['pulse', ['Space']],
  ['merge', ['Digit1', 'Digit2']],
  ['typerush', ['KeyC', 'KeyO', 'KeyD', 'KeyE']],
  ['oneline', []],
  ['breakout', ['ArrowLeft', 'ArrowRight']],
  ['perfectstop', ['Space']],
  ['chain', []],
  ['gravity', ['KeyA', 'KeyG']],
  ['blade', []],
  ['pinball', ['KeyA', 'KeyD']],
  ['chrono', ['KeyA', 'Space']],
  ['matrix', ['KeyQ', 'KeyW']],
  ['drift', ['KeyA', 'Space']],
  ['vanguard', ['ArrowLeft', 'Space']],
  ['slingshot', ['Space']],
  ['snake', ['ArrowUp', 'ArrowRight']],
  ['rhythm', ['KeyD', 'KeyF', 'KeyJ', 'KeyK']],
  ['tower', ['KeyA', 'Space']],
  ['pacmaze', ['ArrowLeft', 'ArrowUp']],
  ['flappyaero', ['Space']],
  ['roadcross', ['ArrowUp', 'ArrowRight']],
  ['bubblebuster', ['KeyA', 'Space']],
  ['astroblaster', ['ArrowLeft', 'KeyW', 'Space', 'ShiftLeft']],
  ['laserrope', ['Space', 'ArrowDown']],
  ['blockdrop', ['ArrowLeft', 'ArrowUp', 'Space', 'KeyC']],
  ['knifetarget', ['Space']],
  ['airhockey', ['KeyA', 'KeyW']],
  ['neonrail', ['ArrowLeft', 'Space']],
];

const profiles = QUICK
  ? [{ name: 'desktop', viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false }]
  : [
      { name: 'desktop', viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false },
      { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    ];

const failures = [];
const results = [];

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sampleRaf = async (page) => page.evaluate(async () => {
  const frames = [];
  const start = performance.now();
  let previous = start;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('requestAnimationFrame stalled')), 2800);
    const tick = (now) => {
      frames.push(now - previous);
      previous = now;
      if (frames.length >= 24) {
        clearTimeout(timeout);
        resolve();
      } else {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });
  const elapsed = performance.now() - start;
  return {
    elapsed,
    avgGap: frames.reduce((sum, value) => sum + value, 0) / frames.length,
    maxGap: Math.max(...frames),
  };
});

const canvasSignal = async (page) => page.evaluate(() => {
  const canvas = document.querySelector('.game-shell main canvas');
  if (!(canvas instanceof HTMLCanvasElement)) return { present: false };
  const rect = canvas.getBoundingClientRect();
  let nonTransparent = 0;
  let sampled = 0;
  try {
    const ctx = canvas.getContext('2d');
    if (ctx && canvas.width > 0 && canvas.height > 0) {
      const xs = [0.15, 0.35, 0.5, 0.65, 0.85];
      const ys = [0.15, 0.35, 0.5, 0.65, 0.85];
      for (const xp of xs) {
        for (const yp of ys) {
          const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(canvas.width * xp)));
          const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(canvas.height * yp)));
          const data = ctx.getImageData(x, y, 1, 1).data;
          sampled++;
          if (data[3] > 0 || data[0] + data[1] + data[2] > 0) nonTransparent++;
        }
      }
    }
  } catch {}
  return {
    present: true,
    cssWidth: rect.width,
    cssHeight: rect.height,
    backingWidth: canvas.width,
    backingHeight: canvas.height,
    nonTransparent,
    sampled,
  };
});

const dispatchPointerGesture = async (page, profileName, gameId) => {
  const stage = page.locator('.game-shell main');
  const box = await stage.boundingBox();
  if (!box) throw new Error('game stage has no bounding box');

  const centerX = box.x + box.width * 0.5;
  const centerY = box.y + box.height * 0.56;
  const startX = box.x + box.width * 0.28;
  const endX = box.x + box.width * 0.72;
  const startY = box.y + box.height * 0.68;
  const endY = box.y + box.height * 0.34;

  const dragGames = new Set(['oneline', 'gravity', 'blade', 'airhockey', 'breakout']);
  if (dragGames.has(gameId)) {
    if (profileName === 'mobile') {
      await page.evaluate(({ sx, sy, ex, ey }) => {
        const target = document.querySelector('.game-shell main');
        if (!target) return;
        const make = (type, x, y, buttons) => new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 11,
          pointerType: 'touch',
          isPrimary: true,
          clientX: x,
          clientY: y,
          buttons,
        });
        target.dispatchEvent(make('pointerdown', sx, sy, 1));
        target.dispatchEvent(make('pointermove', (sx + ex) / 2, (sy + ey) / 2, 1));
        target.dispatchEvent(make('pointermove', ex, ey, 1));
        target.dispatchEvent(make('pointerup', ex, ey, 0));
      }, { sx: startX, sy: startY, ex: endX, ey: endY });
    } else {
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(endX, endY, { steps: 5 });
      await page.mouse.up();
    }
  } else if (profileName === 'mobile') {
    await page.evaluate(({ x, y }) => {
      const target = document.querySelector('.game-shell main');
      if (!target) return;
      target.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 7,
        pointerType: 'touch',
        isPrimary: true,
        clientX: x,
        clientY: y,
        buttons: 1,
      }));
      target.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 7,
        pointerType: 'touch',
        isPrimary: true,
        clientX: x,
        clientY: y,
        buttons: 0,
      }));
    }, { x: centerX, y: centerY });
  } else {
    await page.mouse.click(centerX, centerY);
  }
};

const runGame = async (page, profile, gameId, keys) => {
  const jsErrors = [];
  const consoleErrors = [];
  const onPageError = (error) => jsErrors.push(String(error?.message || error));
  const onConsole = (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/Failed to load resource|ERR_CONNECTION|favicon/i.test(text)) return;
    consoleErrors.push(text);
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.locator(`#play-btn-${gameId}`).click({ timeout: 8000 });
    const shell = page.locator('.game-shell');
    await shell.waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForTimeout(180);

    const shellBox = await shell.boundingBox();
    const stageBox = await page.locator('.game-shell main').boundingBox();
    assert(shellBox, 'game shell has no layout box');
    assert(stageBox, 'game stage has no layout box');
    assert(stageBox.width >= (profile.name === 'mobile' ? 300 : 500), `game stage too narrow: ${stageBox.width.toFixed(1)}px`);
    assert(stageBox.height >= 220, `game stage too short: ${stageBox.height.toFixed(1)}px`);

    const geometry = await page.evaluate(() => {
      const shell = document.querySelector('.game-shell');
      const required = ['game-back-btn', 'game-restart-btn', 'game-pause-btn', 'game-sound-btn'];
      const controls = required.map((id) => {
        const el = document.getElementById(id);
        if (!el) return { id, visible: false, inViewport: false };
        const rect = el.getBoundingClientRect();
        return {
          id,
          visible: rect.width > 0 && rect.height > 0,
          inViewport: rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1,
        };
      });
      return {
        shellOverflowX: shell ? shell.scrollWidth - shell.clientWidth : 999,
        shellOverflowY: shell ? shell.scrollHeight - shell.clientHeight : 999,
        controls,
        title: document.querySelector('.game-shell h1')?.textContent?.trim() || '',
      };
    });
    assert(geometry.shellOverflowX <= 2, `horizontal shell overflow: ${geometry.shellOverflowX}px`);
    for (const control of geometry.controls) {
      assert(control.visible && control.inViewport, `${control.id} is not fully reachable`);
    }
    assert(geometry.title.length > 0, 'game title missing from shell');

    const beforeFrames = await sampleRaf(page);
    assert(beforeFrames.elapsed < 2500, `RAF liveness too slow before input: ${beforeFrames.elapsed.toFixed(0)}ms`);
    assert(beforeFrames.maxGap < 700, `severe pre-input frame gap: ${beforeFrames.maxGap.toFixed(0)}ms`);

    const canvasBefore = await canvasSignal(page);
    if (canvasBefore.present) {
      assert(canvasBefore.cssWidth > 100 && canvasBefore.cssHeight > 100, 'canvas has collapsed CSS size');
      assert(canvasBefore.backingWidth > 0 && canvasBefore.backingHeight > 0, 'canvas backing store is empty');
      assert(canvasBefore.sampled === 0 || canvasBefore.nonTransparent > 0, 'canvas appears completely blank');
    }

    await dispatchPointerGesture(page, profile.name, gameId);
    for (const key of keys) {
      await page.keyboard.press(key).catch(() => {});
      await page.waitForTimeout(20);
    }
    await page.waitForTimeout(120);

    const afterFrames = await sampleRaf(page);
    assert(afterFrames.elapsed < 2500, `RAF liveness too slow after input: ${afterFrames.elapsed.toFixed(0)}ms`);
    assert(afterFrames.maxGap < 700, `severe post-input frame gap: ${afterFrames.maxGap.toFixed(0)}ms`);

    await page.locator('#game-pause-btn').click();
    await page.getByText('GAME PAUSED', { exact: true }).waitFor({ state: 'visible', timeout: 2500 });
    const pauseText = await page.locator('.game-shell').innerText();
    assert(pauseText.includes('How To Play'), 'pause modal lacks How To Play guidance');
    const instructions = await page.locator('.game-shell').locator('text=How To Play').locator('..').innerText().catch(() => '');
    assert(instructions.length >= 20, 'How To Play guidance is empty or too short');
    await page.locator('#game-pause-btn').click();
    await page.waitForTimeout(80);

    await page.locator('#game-restart-btn').click();
    await page.waitForTimeout(120);
    assert(await shell.isVisible(), 'game shell disappeared after restart');

    const longTasks = await page.evaluate(() => (globalThis.__p3LongTasks || []).slice());
    const longestTask = longTasks.length ? Math.max(...longTasks) : 0;
    assert(longestTask < 900, `main-thread long task exceeded 900ms: ${longestTask.toFixed(0)}ms`);

    assert(jsErrors.length === 0, `page errors: ${jsErrors.join(' | ')}`);
    assert(consoleErrors.length === 0, `console errors: ${consoleErrors.join(' | ')}`);
    const errorBoundaryVisible = await page.getByText(/something went wrong|render failed|game crashed/i).count();
    assert(errorBoundaryVisible === 0, 'error boundary/crash message became visible');

    await page.locator('#game-back-btn').click();
    await page.locator(`#play-btn-${gameId}`).waitFor({ state: 'visible', timeout: 4000 });

    return {
      gameId,
      profile: profile.name,
      rafAvgBefore: Number(beforeFrames.avgGap.toFixed(1)),
      rafAvgAfter: Number(afterFrames.avgGap.toFixed(1)),
      maxFrameGap: Number(Math.max(beforeFrames.maxGap, afterFrames.maxGap).toFixed(1)),
      longestTask: Number(longestTask.toFixed(1)),
      canvas: Boolean(canvasBefore.present),
    };
  } finally {
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
  }
};

const launchOptions = {
  headless: true,
  args: ['--disable-dev-shm-usage', '--no-sandbox'],
};
if (CHROME_PATH) launchOptions.executablePath = CHROME_PATH;
else launchOptions.channel = 'chrome';

const browser = await chromium.launch(launchOptions);
try {
  for (const profile of profiles) {
    const context = await browser.newContext({
      viewport: profile.viewport,
      isMobile: profile.isMobile,
      hasTouch: profile.hasTouch,
      reducedMotion: 'reduce',
      colorScheme: 'dark',
    });
    await context.addInitScript(() => {
      globalThis.__p3LongTasks = [];
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) globalThis.__p3LongTasks.push(entry.duration);
        });
        observer.observe({ entryTypes: ['longtask'] });
      } catch {}
    });
    const page = await context.newPage();

    for (const [gameId, keys] of games) {
      try {
        await page.evaluate(() => { globalThis.__p3LongTasks = []; }).catch(() => {});
        const result = await runGame(page, profile, gameId, keys);
        results.push(result);
        console.log(`PASS ${profile.name.padEnd(7)} ${gameId.padEnd(13)} RAF ${result.rafAvgAfter.toFixed(1)}ms max ${result.maxFrameGap.toFixed(1)}ms long ${result.longestTask.toFixed(1)}ms`);
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

const expectedRuns = games.length * profiles.length;
console.log(`\nP3 BROWSER GAMEPLAY CERTIFICATION — ${failures.length ? 'FAIL' : 'PASS'}`);
console.log(`${results.length}/${expectedRuns} game/profile sessions certified across ${games.length} games.`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
