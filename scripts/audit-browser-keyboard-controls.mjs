import { chromium } from '@playwright/test';

const BASE_URL = process.env.CONTROLS_BASE_URL || 'http://127.0.0.1:4173';
const CHROME_PATH = process.env.CONTROLS_CHROME_PATH || undefined;
const failures = [];

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const launchOptions = { headless: true, args: ['--disable-dev-shm-usage', '--no-sandbox'] };
if (CHROME_PATH) launchOptions.executablePath = CHROME_PATH;
else launchOptions.channel = 'chrome';

const waitForGameplayFocus = async (page, label) => {
  await page.waitForFunction(() => {
    const active = document.activeElement;
    return active instanceof HTMLElement && active.dataset.arcadeInputOwner === 'gameplay';
  }, null, { timeout: 2500 });

  const state = await page.evaluate(() => {
    const active = document.activeElement;
    return {
      activeId: active?.id || '',
      owner: active instanceof HTMLElement ? active.dataset.arcadeInputOwner || '' : '',
      tag: active?.tagName || '',
      pauseOpen: Boolean(document.querySelector('[data-p18-dialog="pause"]')),
      resultOpen: Boolean(document.querySelector('[data-p18-dialog="result"]')),
    };
  });
  assert(state.owner === 'gameplay', `${label}: gameplay did not own focus: ${JSON.stringify(state)}`);
  assert(!state.pauseOpen && !state.resultOpen, `${label}: a game dialog was unexpectedly open`);
};

const assertSpaceDoesNotReactivateChrome = async (page, label) => {
  await page.keyboard.press('Space');
  await page.waitForTimeout(80);
  const state = await page.evaluate(() => ({
    pauseOpen: Boolean(document.querySelector('[data-p18-dialog="pause"]')),
    activeId: document.activeElement?.id || '',
    owner: document.activeElement instanceof HTMLElement ? document.activeElement.dataset.arcadeInputOwner || '' : '',
  }));
  assert(!state.pauseOpen, `${label}: Space reactivated Pause instead of reaching gameplay: ${JSON.stringify(state)}`);
};

const browser = await chromium.launch(launchOptions);
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => failures.push(`page error: ${error.message}`));

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() => document.documentElement.dataset.p19Cohesion === 'ready', null, { timeout: 5000 });
  await page.locator('#play-btn-orbit').click({ timeout: 8000 });
  await page.locator('.game-shell').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForFunction(() => Boolean(document.querySelector('[data-p18-stage]')), null, { timeout: 5000 });

  // Entering a game should immediately transfer keyboard ownership from the
  // library launch button to gameplay.
  await waitForGameplayFocus(page, 'launch');

  // Regression 1: clicking Restart used to leave the button focused. Space then
  // clicked Restart again instead of reaching the mini-game.
  await page.locator('#game-restart-btn').click();
  await waitForGameplayFocus(page, 'pointer restart');
  assert(await page.locator('#game-restart-btn').evaluate((node) => document.activeElement !== node), 'pointer restart left Restart focused');
  await assertSpaceDoesNotReactivateChrome(page, 'pointer restart → Space');

  // Regression 2: Pause focus is intentionally moved into the modal, but after
  // Resume the old P18 cleanup used to restore focus to the Pause toolbar button.
  await page.locator('#game-pause-btn').click();
  await page.waitForFunction(() => Boolean(document.querySelector('[data-p18-dialog="pause"]')), null, { timeout: 2500 });
  await page.locator('[data-p18-dialog="pause"]').getByRole('button', { name: /^RESUME \(ESC\)$/i }).click();
  await page.waitForFunction(() => !document.querySelector('[data-p18-dialog="pause"]'), null, { timeout: 2500 });
  await waitForGameplayFocus(page, 'pointer pause → resume');
  assert(await page.locator('#game-pause-btn').evaluate((node) => document.activeElement !== node), 'resume restored focus to Pause');
  await assertSpaceDoesNotReactivateChrome(page, 'pause → resume → Space');

  // The same handoff must work when both pause and resume are keyboard-driven.
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => Boolean(document.querySelector('[data-p18-dialog="pause"]')), null, { timeout: 2500 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('[data-p18-dialog="pause"]'), null, { timeout: 2500 });
  await waitForGameplayFocus(page, 'Escape pause → Escape resume');
  await assertSpaceDoesNotReactivateChrome(page, 'Escape resume → Space');

  // Persistent settings controls are also chrome, not gameplay. Pointer use must
  // hand Space back to the game rather than toggling the same setting again.
  const sound = page.locator('#game-sound-btn');
  await sound.click();
  const soundStateAfterClick = await sound.getAttribute('aria-pressed');
  await waitForGameplayFocus(page, 'sound pointer use');
  await assertSpaceDoesNotReactivateChrome(page, 'sound → Space');
  const soundStateAfterSpace = await sound.getAttribute('aria-pressed');
  assert(soundStateAfterSpace === soundStateAfterClick, `Space toggled Sound again: ${soundStateAfterClick} -> ${soundStateAfterSpace}`);

  // Text-entry games are a deliberate exception to generic stage focus. Type Rush
  // must keep its hidden keyboard input active on launch and regain it after pause.
  await page.locator('#game-back-btn').click();
  await page.waitForFunction(() => !document.querySelector('.game-shell'), null, { timeout: 3000 });
  await page.locator('#play-btn-typerush').click({ timeout: 8000 });
  await page.locator('.game-shell').waitFor({ state: 'visible', timeout: 8000 });
  const typeInput = page.getByRole('textbox', { name: 'Type Rush Keyboard Input' });
  await typeInput.waitFor({ state: 'attached', timeout: 4000 });
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Type Rush Keyboard Input', null, { timeout: 2500 });
  assert(await typeInput.evaluate((node) => document.activeElement === node), 'Type Rush launch focus was stolen from its text input');

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => Boolean(document.querySelector('[data-p18-dialog="pause"]')), null, { timeout: 2500 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('[data-p18-dialog="pause"]'), null, { timeout: 2500 });
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Type Rush Keyboard Input', null, { timeout: 2500 });
  assert(await typeInput.evaluate((node) => document.activeElement === node), 'Type Rush did not regain its text input after pause/resume');

  // Regression 3: when Game Over appears, Play Again must become the initial
  // focus owner even if an upload-retry button is earlier in DOM order. Native
  // Space activation then does exactly what the result screen advertises.
  const installResultFixture = async () => page.evaluate(() => {
    const shell = document.querySelector('.game-shell');
    if (!(shell instanceof HTMLElement)) throw new Error('Missing game shell for result shortcut fixture');

    window.__keyboardReplayClicks = 0;
    window.__keyboardRetryClicks = 0;

    const overlay = document.createElement('div');
    overlay.id = 'keyboard-result-fixture';
    overlay.className = 'absolute inset-0';

    const dialog = document.createElement('div');
    const marker = document.createElement('span');
    marker.textContent = 'SESSION COMPLETE';
    const heading = document.createElement('h2');
    heading.textContent = 'RUN COMPLETE';
    const actions = document.createElement('div');

    const retry = document.createElement('button');
    retry.type = 'button';
    retry.id = 'keyboard-retry-fixture';
    retry.textContent = 'Retry upload now';
    retry.addEventListener('click', () => { window.__keyboardRetryClicks += 1; });

    const playAgain = document.createElement('button');
    playAgain.type = 'button';
    playAgain.id = 'btn-play-again';
    playAgain.textContent = 'PLAY AGAIN (Space)';
    playAgain.addEventListener('click', () => {
      window.__keyboardReplayClicks += 1;
      overlay.remove();
    });

    actions.append(retry, playAgain);
    dialog.append(marker, heading, actions);
    overlay.append(dialog);
    shell.append(overlay);
  });

  await installResultFixture();
  await page.waitForFunction(() => {
    const result = document.querySelector('#keyboard-result-fixture');
    return result?.getAttribute('data-p18-dialog') === 'result' && document.activeElement?.id === 'btn-play-again';
  }, null, { timeout: 2500 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__keyboardReplayClicks === 1, null, { timeout: 2500 });
  let resultShortcut = await page.evaluate(() => ({
    replayClicks: window.__keyboardReplayClicks,
    retryClicks: window.__keyboardRetryClicks,
    resultStillOpen: Boolean(document.querySelector('#keyboard-result-fixture')),
  }));
  assert(resultShortcut.replayClicks === 1, `Default result Space did not trigger Play Again: ${JSON.stringify(resultShortcut)}`);
  assert(resultShortcut.retryClicks === 0, `Default result Space activated Retry instead of Play Again: ${JSON.stringify(resultShortcut)}`);
  assert(!resultShortcut.resultStillOpen, `Default result Space left the replay fixture open: ${JSON.stringify(resultShortcut)}`);
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Type Rush Keyboard Input', null, { timeout: 2500 });

  // Keyboard navigation remains normal: if the player intentionally focuses a
  // different result action, Space activates that action rather than being stolen
  // by a global replay shortcut.
  await installResultFixture();
  await page.waitForFunction(() => document.activeElement?.id === 'btn-play-again', null, { timeout: 2500 });
  await page.locator('#keyboard-retry-fixture').focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(80);
  resultShortcut = await page.evaluate(() => ({
    replayClicks: window.__keyboardReplayClicks,
    retryClicks: window.__keyboardRetryClicks,
    resultStillOpen: Boolean(document.querySelector('#keyboard-result-fixture')),
  }));
  assert(resultShortcut.replayClicks === 0, `Focused Retry Space was stolen by Play Again: ${JSON.stringify(resultShortcut)}`);
  assert(resultShortcut.retryClicks === 1, `Focused Retry did not retain native Space activation: ${JSON.stringify(resultShortcut)}`);
  assert(resultShortcut.resultStillOpen, `Focused Retry unexpectedly closed the result fixture: ${JSON.stringify(resultShortcut)}`);
  await page.locator('#keyboard-result-fixture').evaluate((node) => node.remove());
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Type Rush Keyboard Input', null, { timeout: 2500 });

  assert(failures.length === 0, failures.join(' | '));
  console.log('GAME SHELL KEYBOARD OWNERSHIP AUDIT — PASS');
  console.log('Space stays gameplay-owned after shell actions; result dialogs default to Play Again without stealing Space from intentionally focused controls; Type Rush retains text-entry focus.');

  await context.close();
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
  console.error('GAME SHELL KEYBOARD OWNERSHIP AUDIT — FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
