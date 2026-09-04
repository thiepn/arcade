import { chromium } from '@playwright/test';

const BASE_URL = process.env.P18_BASE_URL || 'http://127.0.0.1:4173';
const CHROME_PATH = process.env.P18_CHROME_PATH || undefined;

const gameIds = [
  'orbit','stack','reaction','dodge','pulse','merge','typerush','oneline','breakout','perfectstop',
  'chain','gravity','blade','pinball','chrono','matrix','drift','vanguard','slingshot','snake',
  'rhythm','tower','pacmaze','flappyaero','roadcross','bubblebuster','astroblaster','laserrope',
  'blockdrop','knifetarget','airhockey','neonrail',
];

const hintGames = new Set(['stack','reaction','pulse','typerush','oneline','perfectstop','chain','gravity','matrix','slingshot','flappyaero','laserrope']);

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

const runGame = async (page, profile, gameId) => {
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

  try {
    const play = page.locator(`#play-btn-${gameId}`);
    await play.click({ timeout: 8000 });
    const shell = page.locator('.game-shell');
    await shell.waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForFunction((id) => {
      const shell = document.querySelector('.game-shell');
      return shell?.getAttribute('data-p18-game') === id && shell?.getAttribute('data-p18-clarity') === 'ready';
    }, gameId, { timeout: 4000 });

    // accessible shell labels
    const initial = await page.evaluate(({ id }) => {
      const shell = document.querySelector('.game-shell');
      const stage = shell?.querySelector('[data-p18-stage]');
      const labels = ['game-back-btn','game-restart-btn','game-pause-btn','game-sound-btn','game-fullscreen-btn']
        .map((buttonId) => ({
          id: buttonId,
          label: document.getElementById(buttonId)?.getAttribute('aria-label') || '',
          width: document.getElementById(buttonId)?.getBoundingClientRect().width || 0,
          height: document.getElementById(buttonId)?.getBoundingClientRect().height || 0,
        }));
      return {
        id: shell?.getAttribute('data-p18-game'),
        ready: shell?.getAttribute('data-p18-clarity'),
        stageLabel: stage?.getAttribute('aria-label') || '',
        stageRole: stage?.getAttribute('role') || '',
        labels,
        shellOverflowX: shell ? shell.scrollWidth - shell.clientWidth : 999,
        hintCount: document.querySelectorAll(`[data-p18-first-run-hint="${id}"]`).length,
        hintPointerEvents: (() => {
          const hint = document.querySelector(`[data-p18-first-run-hint="${id}"]`);
          return hint ? getComputedStyle(hint).pointerEvents : '';
        })(),
      };
    }, { id: gameId });

    assert(initial.id === gameId && initial.ready === 'ready', `P18 shell identity/readiness mismatch ${initial.id}/${initial.ready}`);
    assert(initial.stageRole === 'region' && initial.stageLabel.toLowerCase().includes('gameplay area'), 'P18 gameplay region lacks objective semantics');
    assert(initial.labels.every((item) => item.label.length >= 6), `accessible shell labels missing: ${JSON.stringify(initial.labels)}`);
    assert(initial.shellOverflowX <= 2, `P18 shell has horizontal overflow: ${initial.shellOverflowX}px`);
    if (profile.isMobile) {
      for (const item of initial.labels.filter((entry) => entry.id !== 'game-back-btn')) {
        assert(item.width >= 40 && item.height >= 40, `${item.id} touch target too small: ${item.width.toFixed(1)}×${item.height.toFixed(1)}`);
      }
    }

    if (hintGames.has(gameId)) {
      assert(initial.hintCount === 1, `expected one selective first-run hint, found ${initial.hintCount}`);
      assert(initial.hintPointerEvents === 'none', 'first-run hint intercepts gameplay input');
      await page.evaluate(() => {
        const stage = document.querySelector('[data-p18-stage]');
        if (!stage) return;
        const rect = stage.getBoundingClientRect();
        stage.dispatchEvent(new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          pointerId: 18,
          pointerType: 'touch',
          isPrimary: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          buttons: 1,
        }));
      });
      await page.waitForFunction((id) => !document.querySelector(`[data-p18-first-run-hint="${id}"]`), gameId, { timeout: 1000 });
    } else {
      assert(initial.hintCount === 0, 'P18 over-tutors a game that has no selective micro-hint contract');
    }

    await page.locator('#game-pause-btn').click();
    await page.waitForFunction(() => Boolean(document.querySelector('[data-p18-dialog="pause"] [data-p18-clarity-panel="true"]')), null, { timeout: 3000 });
    await page.waitForTimeout(60);

    // pause teaching panel
    const pause = await page.evaluate(() => {
      const dialog = document.querySelector('[data-p18-dialog="pause"]');
      const panel = dialog?.querySelector('[data-p18-clarity-panel="true"]');
      const active = document.activeElement;
      const buttons = dialog ? Array.from(dialog.querySelectorAll('button')) : [];
      const rect = dialog?.getBoundingClientRect();
      return {
        role: dialog?.getAttribute('role') || '',
        modal: dialog?.getAttribute('aria-modal') || '',
        labelled: Boolean(dialog?.getAttribute('aria-labelledby') || dialog?.getAttribute('aria-label')),
        objective: panel?.querySelector('.p18-objective p')?.textContent?.trim() || '',
        essentials: panel?.querySelectorAll('.p18-teaching-group').length || 0,
        mastery: panel?.querySelector('.p18-mastery p')?.textContent?.trim() || '',
        watch: panel?.querySelector('.p18-watch p')?.textContent?.trim() || '',
        legacyHidden: Boolean(dialog?.querySelector('[data-p18-legacy-instructions="true"][hidden]')),
        activeInside: Boolean(active && dialog?.contains(active)),
        buttonCount: buttons.length,
        overflowX: dialog ? dialog.scrollWidth - dialog.clientWidth : 999,
        inViewport: Boolean(rect && rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1),
      };
    });

    assert(pause.role === 'dialog' && pause.modal === 'true' && pause.labelled, 'pause dialog lacks modal accessible semantics');
    assert(pause.objective.length >= 20, 'pause teaching panel lacks concise objective');
    assert(pause.essentials >= 1, 'pause teaching panel lacks essential controls');
    assert(pause.mastery.length >= 20, 'pause teaching panel lacks mastery explanation');
    assert(pause.watch.length >= 12, 'pause teaching panel lacks danger explanation');
    assert(pause.legacyHidden, 'legacy instruction paragraph remains duplicated beside structured teaching');
    assert(pause.activeInside && pause.buttonCount >= 3, 'pause modal focus is not contained/initialized');
    assert(pause.overflowX <= 2, `pause dialog has horizontal overflow: ${pause.overflowX}px`);
    assert(pause.inViewport, 'pause dialog extends outside the viewport');

    await page.keyboard.press('Tab');
    const tabInside = await page.evaluate(() => {
      const dialog = document.querySelector('[data-p18-dialog="pause"]');
      return Boolean(dialog && document.activeElement && dialog.contains(document.activeElement));
    });
    assert(tabInside, 'Tab escaped the pause dialog');

    const pauseDialog = page.locator('[data-p18-dialog="pause"]');
    await pauseDialog.getByRole('button', { name: /^RESUME \(ESC\)$/i }).click();
    await page.waitForFunction(() => !document.querySelector('[data-p18-dialog="pause"]'), null, { timeout: 2000 });
    await page.waitForFunction(() => document.activeElement?.id === 'game-pause-btn', null, { timeout: 1500 });

    await page.locator('#game-restart-btn').click();
    await page.waitForTimeout(100);
    const afterRestart = await page.evaluate((id) => ({
      shells: document.querySelectorAll('.game-shell').length,
      stages: document.querySelectorAll(`[data-p18-stage="${id}"]`).length,
      panels: document.querySelectorAll('[data-p18-clarity-panel="true"]').length,
      hints: document.querySelectorAll(`[data-p18-first-run-hint="${id}"]`).length,
      overflowX: (() => {
        const shell = document.querySelector('.game-shell');
        return shell ? shell.scrollWidth - shell.clientWidth : 999;
      })(),
    }), gameId);
    assert(afterRestart.shells === 1 && afterRestart.stages === 1, `restart duplicated/lost P18 shell stage ${afterRestart.shells}/${afterRestart.stages}`);
    assert(afterRestart.panels === 0, 'restart retained stale pause teaching UI');
    assert(afterRestart.hints === 0, 'restart repeated a dismissed first-run hint');
    assert(afterRestart.overflowX <= 2, `restart created horizontal overflow: ${afterRestart.overflowX}px`);

    assert(pageErrors.length === 0, `page errors: ${pageErrors.join(' | ')}`);
    assert(consoleErrors.length === 0, `console errors: ${consoleErrors.join(' | ')}`);

    await page.locator('#game-back-btn').click();
    await play.waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForFunction(() => {
      return !document.querySelector('.game-shell') &&
        !document.querySelector('[data-p18-clarity-panel="true"]') &&
        !document.querySelector('[data-p18-first-run-hint]');
    }, null, { timeout: 2000 });
    const leaked = await page.evaluate(() => document.querySelectorAll('[data-p18-stage], [data-p18-dialog], [data-p18-clarity-panel], [data-p18-first-run-hint]').length);
    assert(leaked === 0, `exit leaked P18 DOM/state markers: ${leaked}`);
  } finally {
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
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
        console.log(`PASS ${profile.name.padEnd(12)} ${gameId}`);
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
console.log(`\nP18 BROWSER CLARITY CERTIFICATION — ${failures.length ? 'FAIL' : 'PASS'}`);
console.log(`${passes}/${expected} game/profile sessions certified across desktop, mobile and small-mobile.`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
