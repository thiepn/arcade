import { chromium } from '@playwright/test';

const BASE_URL = process.env.CONTROLS_BASE_URL || 'http://127.0.0.1:4173';
const CHROME_PATH = process.env.CONTROLS_CHROME_PATH || undefined;
const failures = [];
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const launchOptions = { headless: true, args: ['--disable-dev-shm-usage', '--no-sandbox'] };
if (CHROME_PATH) launchOptions.executablePath = CHROME_PATH;
else launchOptions.channel = 'chrome';

const browser = await chromium.launch(launchOptions);
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  const page = await context.newPage();
  page.on('pageerror', error => failures.push(`page error: ${error.message}`));

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() => document.documentElement.dataset.p19Cohesion === 'ready', null, { timeout: 5000 });

  // The compatibility slot remains astroblaster internally, but Hex Capture is
  // the mounted engine. This is exactly the listener that previously stole Space
  // from the result screen.
  await page.locator('#play-btn-astroblaster').click({ timeout: 8000 });
  await page.locator('[data-replacement-game="hex-capture"]').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForFunction(() => Boolean(document.querySelector('[data-p18-stage="astroblaster"]')), null, { timeout: 5000 });

  await page.evaluate(() => {
    window.__replacementReplayClicks = 0;
    const shell = document.querySelector('.game-shell');
    if (!(shell instanceof HTMLElement)) throw new Error('Missing Hex Capture shell');

    const overlay = document.createElement('div');
    overlay.id = 'replacement-result-fixture';
    overlay.className = 'absolute inset-0';
    const dialog = document.createElement('div');
    const marker = document.createElement('span');
    marker.textContent = 'SESSION COMPLETE';
    const heading = document.createElement('h2');
    heading.textContent = 'RUN COMPLETE';
    const actions = document.createElement('div');
    const playAgain = document.createElement('button');
    playAgain.type = 'button';
    playAgain.id = 'btn-play-again';
    playAgain.textContent = 'PLAY AGAIN (Space)';
    playAgain.addEventListener('click', () => {
      window.__replacementReplayClicks += 1;
      overlay.remove();
    });
    actions.append(playAgain);
    dialog.append(marker, heading, actions);
    overlay.append(dialog);
    shell.append(overlay);
  });

  await page.waitForFunction(() => {
    const overlay = document.querySelector('#replacement-result-fixture');
    return overlay?.getAttribute('data-p18-dialog') === 'result' && document.activeElement?.id === 'btn-play-again';
  }, null, { timeout: 2500 });

  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__replacementReplayClicks === 1, null, { timeout: 2500 });
  const replay = await page.evaluate(() => ({
    clicks: window.__replacementReplayClicks,
    open: Boolean(document.querySelector('#replacement-result-fixture')),
  }));
  assert(replay.clicks === 1, `Hex Capture stole result-screen Space: ${JSON.stringify(replay)}`);
  assert(!replay.open, `Hex Capture prevented native Play Again activation: ${JSON.stringify(replay)}`);

  // After result dismissal, focus returns to gameplay rather than a stale control.
  await page.waitForFunction(() => {
    const active = document.activeElement;
    return active instanceof HTMLElement && active.dataset.arcadeInputOwner === 'gameplay';
  }, null, { timeout: 2500 });

  assert(failures.length === 0, failures.join(' | '));
  console.log('REPLACEMENT GAME KEYBOARD OWNERSHIP AUDIT — PASS');
  console.log('Hex Capture cannot steal Space from Play Again while its gameplay listener remains mounted.');
  await context.close();
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
  console.error('REPLACEMENT GAME KEYBOARD OWNERSHIP AUDIT — FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
