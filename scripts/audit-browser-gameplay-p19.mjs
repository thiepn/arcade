import { chromium } from '@playwright/test';

const BASE_URL = process.env.P19_BASE_URL || 'http://127.0.0.1:4173';
const CHROME_PATH = process.env.P19_CHROME_PATH || undefined;

const gameIds = [
  'orbit','stack','reaction','dodge','pulse','merge','typerush','oneline','breakout','perfectstop',
  'chain','gravity','blade','pinball','chrono','matrix','drift','vanguard','slingshot','snake',
  'rhythm','tower','pacmaze','flappyaero','roadcross','bubblebuster','astroblaster','laserrope',
  'blockdrop','knifetarget','airhockey','neonrail',
];

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
  await page.waitForFunction(() => document.querySelectorAll('[data-p19-game-card]').length === 32, null, { timeout: 5000 });
};

const certifyHome = async (page, profile) => {
  await waitForHome(page);
  const result = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[data-p19-game-card]'));
    const brand = document.getElementById('brand-logo-btn');
    const grid = document.querySelector('.p19-game-grid');
    const cardData = cards.map((card) => ({
      id: card.getAttribute('data-p19-game-card'),
      height: card.getBoundingClientRect().height,
      play: card.querySelectorAll('[id^="play-btn-"]').length,
      favorite: card.querySelectorAll('[id^="fav-btn-"]').length,
      title: card.querySelector('h3')?.textContent?.trim() || '',
      category: card.querySelector('span')?.textContent?.trim() || '',
    }));
    return {
      ready: document.documentElement.dataset.p19Cohesion,
      brandTag: brand?.tagName || '',
      brandLabel: brand?.getAttribute('aria-label') || '',
      grid: Boolean(grid),
      cards: cardData,
      libraryLandmarks: document.querySelectorAll('#library-section').length,
      libraryTag: document.getElementById('library-section')?.tagName || '',
      filterControls: Boolean(document.getElementById('library-controls')),
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  assert(result.ready === 'ready', 'P19 runtime is not ready on home');
  assert(result.brandTag === 'BUTTON' && result.brandLabel.toLowerCase().includes('micro arcade'), 'home brand is not a named native button');
  assert(result.libraryLandmarks === 1 && result.libraryTag === 'MAIN' && result.filterControls, `home library landmark is not unique/semantic: ${JSON.stringify(result)}`);
  assert(result.grid && result.cards.length === 32, `home card contract expected 32 canonical cards, found ${result.cards.length}`);
  assert(result.cards.every((card) => card.id && card.play === 1 && card.favorite === 1 && card.title.length > 0 && card.height >= 190), 'home card contract has incomplete/inconsistent card structure');
  assert(result.overflowX <= 2, `home has horizontal overflow: ${result.overflowX}px`);

  await page.locator('#brand-logo-btn').focus();
  assert(await page.locator('#brand-logo-btn').evaluate((node) => document.activeElement === node), 'home brand cannot receive keyboard focus');

  if (profile.hasTouch) {
    const favorite = page.locator('#fav-btn-orbit');
    const box = await favorite.boundingBox();
    assert(Boolean(box && box.width >= 40 && box.height >= 40), `home favorite touch target too small: ${box?.width}×${box?.height}`);
  }
};

const launch = async (page, id) => {
  await page.locator(`#play-btn-${id}`).click({ timeout: 8000 });
  const shell = page.locator('.game-shell');
  await shell.waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForFunction((gameId) => {
    const node = document.querySelector('.game-shell');
    return node?.getAttribute('data-p19-shell') === 'canonical' && node?.getAttribute('data-p18-game') === gameId;
  }, id, { timeout: 5000 });
};

const exitToHome = async (page) => {
  await page.locator('#game-back-btn').click();
  await page.waitForFunction(() => !document.querySelector('.game-shell'), null, { timeout: 4000 });
  await waitForHome(page);
  const leaked = await page.evaluate(() => document.querySelectorAll('[data-p19-shell], [data-p19-dialog]').length);
  assert(leaked === 0, `exit leaked P19 shell/dialog state: ${leaked}`);
};

const runGame = async (page, profile, gameId) => {
  const errors = collectErrors(page);
  try {
    await launch(page, gameId);

    const shellState = await page.evaluate((id) => {
      const shell = document.querySelector('.game-shell');
      const title = shell?.querySelector('h1 > span')?.textContent?.trim() || '';
      const toolbar = shell?.querySelector('header');
      const stage = shell?.querySelector('main');
      const controls = ['game-back-btn','game-restart-btn','game-pause-btn','game-sound-btn','game-fullscreen-btn']
        .map((controlId) => {
          const element = document.getElementById(controlId);
          const rect = element?.getBoundingClientRect();
          return {
            id: controlId,
            exists: Boolean(element),
            canonical: Boolean(element?.classList.contains(controlId === 'game-back-btn' ? 'p19-nav-button' : 'p19-icon-button')),
            label: element?.getAttribute('aria-label') || '',
            width: rect?.width || 0,
            height: rect?.height || 0,
          };
        });
      return {
        identity: shell?.getAttribute('data-p18-game'),
        canonical: shell?.getAttribute('data-p19-shell'),
        title,
        toolbar: Boolean(toolbar?.classList.contains('p19-shell-toolbar')),
        stage: Boolean(stage?.classList.contains('p19-shell-stage')),
        controls,
        overflowX: shell ? shell.scrollWidth - shell.clientWidth : 999,
        loadingCount: document.querySelectorAll('.p19-loading-state').length,
      };
    }, gameId);

    assert(shellState.identity === gameId && shellState.canonical === 'canonical', `P19 shell identity mismatch ${shellState.identity}/${shellState.canonical}`);
    assert(shellState.title.length > 0 && shellState.toolbar && shellState.stage, 'canonical shell/title/toolbar/stage contract missing');
    assert(shellState.controls.every((control) => control.exists && control.canonical && control.label.length >= 6), `canonical toolbar path missing: ${JSON.stringify(shellState.controls)}`);
    assert(shellState.overflowX <= 2, `shell has horizontal overflow: ${shellState.overflowX}px`);
    if (profile.hasTouch) {
      assert(shellState.controls.every((control) => control.width >= 40 && control.height >= 40), `touch toolbar target below floor: ${JSON.stringify(shellState.controls)}`);
    }

    await page.locator('#game-pause-btn').click();
    await page.waitForFunction(() => Boolean(document.querySelector('[data-p18-dialog="pause"][data-p19-dialog="pause"]')), null, { timeout: 3000 });
    await page.waitForFunction(() => {
      const overlay = document.querySelector('[data-p19-dialog="pause"]');
      return Boolean(overlay && document.activeElement && overlay.contains(document.activeElement));
    }, null, { timeout: 2000 });
    const pause = await page.evaluate(() => {
      const overlay = document.querySelector('[data-p19-dialog="pause"]');
      const panel = overlay?.querySelector('[data-p19-panel="pause"]');
      const labels = Array.from(overlay?.querySelectorAll('button') || []).map((button) => button.textContent?.replace(/\s+/g, ' ').trim() || '');
      const rect = panel?.getBoundingClientRect();
      return {
        p18: Boolean(overlay?.querySelector('[data-p18-clarity-panel="true"]')),
        panel: Boolean(panel?.classList.contains('p19-pause-panel')),
        labels,
        activeInside: Boolean(overlay && document.activeElement && overlay.contains(document.activeElement)),
        inViewport: Boolean(rect && rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1),
        overflowX: overlay ? overlay.scrollWidth - overlay.clientWidth : 999,
      };
    });
    assert(pause.p18 && pause.panel, 'P19 pause cohesion displaced P18 structured teaching');
    assert(pause.labels.some((label) => label === 'BACK TO ARCADE'), `pause terminology is not canonical: ${pause.labels.join(' | ')}`);
    assert(pause.activeInside, 'pause focus is not initialized inside the modal');
    assert(pause.inViewport && pause.overflowX <= 2, 'pause cohesion is not viewport-safe');

    await page.locator('[data-p19-dialog="pause"]').getByRole('button', { name: /^RESUME \(ESC\)$/i }).click();
    await page.waitForFunction(() => !document.querySelector('[data-p19-dialog="pause"]'), null, { timeout: 2000 });

    await page.locator('#game-restart-btn').click();
    await page.waitForTimeout(80);
    const afterRestart = await page.evaluate((id) => ({
      shells: document.querySelectorAll('.game-shell[data-p19-shell="canonical"]').length,
      identity: document.querySelector('.game-shell')?.getAttribute('data-p18-game'),
      staleDialogs: document.querySelectorAll('[data-p19-dialog]').length,
      overflowX: (() => {
        const shell = document.querySelector('.game-shell');
        return shell ? shell.scrollWidth - shell.clientWidth : 999;
      })(),
    }), gameId);
    assert(afterRestart.shells === 1 && afterRestart.identity === gameId, 'restart lost/duplicated canonical shell');
    assert(afterRestart.staleDialogs === 0, 'restart retained stale P19 dialog');
    assert(afterRestart.overflowX <= 2, 'restart created shell overflow');

    if (gameId === 'orbit') {
      // orientation recovery: product shell must recover without retaining stale geometry.
      const alternate = profile.viewport.width < profile.viewport.height
        ? { width: Math.max(568, profile.viewport.height), height: Math.min(430, profile.viewport.width + 40) }
        : { width: 390, height: 844 };
      await page.setViewportSize(alternate);
      await page.waitForTimeout(80);
      const changedOverflow = await page.locator('.game-shell').evaluate((node) => node.scrollWidth - node.clientWidth);
      assert(changedOverflow <= 2, `orientation recovery overflow after resize: ${changedOverflow}px`);
      await page.setViewportSize(profile.viewport);
      await page.waitForTimeout(80);
      const restoredOverflow = await page.locator('.game-shell').evaluate((node) => node.scrollWidth - node.clientWidth);
      assert(restoredOverflow <= 2, `orientation recovery overflow after restore: ${restoredOverflow}px`);
    }

    assert(errors.pageErrors.length === 0, `page errors: ${errors.pageErrors.join(' | ')}`);
    assert(errors.consoleErrors.length === 0, `console errors: ${errors.consoleErrors.join(' | ')}`);
    await exitToHome(page);
  } finally {
    errors.cleanup();
  }
};

const certifySettingsPersistence = async (page) => {
  // settings persistence: global sound state must survive home → Game A → home → Game B.
  await waitForHome(page);
  const homeSound = page.locator('#sound-toggle-btn');
  const initialLabel = await homeSound.getAttribute('aria-label');
  await homeSound.click();
  const toggledLabel = await homeSound.getAttribute('aria-label');
  assert(initialLabel !== toggledLabel, 'settings persistence precondition: home sound state did not toggle');

  await launch(page, 'orbit');
  const orbitLabel = await page.locator('#game-sound-btn').getAttribute('aria-label');
  assert(Boolean(orbitLabel && toggledLabel && orbitLabel.toLowerCase().startsWith(toggledLabel.split(' ')[0].toLowerCase())), `settings persistence did not reach Orbit: home=${toggledLabel} shell=${orbitLabel}`);
  await exitToHome(page);
  assert(await homeSound.getAttribute('aria-label') === toggledLabel, 'settings persistence lost after first game exit');

  await launch(page, 'stack');
  const stackLabel = await page.locator('#game-sound-btn').getAttribute('aria-label');
  assert(stackLabel === orbitLabel, `settings persistence differs across games: Orbit=${orbitLabel} Stack=${stackLabel}`);
  await exitToHome(page);

  await homeSound.click();
  assert(await homeSound.getAttribute('aria-label') === initialLabel, 'settings persistence cleanup could not restore initial sound state');
};

const certifyNavigationStress = async (page) => {
  // navigation stress: repeated arcade → game → arcade switches must leave one clean product surface.
  for (const id of ['orbit', 'chain', 'neonrail']) {
    await launch(page, id);
    await exitToHome(page);
  }
  const state = await page.evaluate(() => ({
    shells: document.querySelectorAll('.game-shell').length,
    dialogs: document.querySelectorAll('[data-p19-dialog]').length,
    cards: document.querySelectorAll('[data-p19-game-card]').length,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  assert(state.shells === 0 && state.dialogs === 0 && state.cards === 32, `navigation stress leaked product state: ${JSON.stringify(state)}`);
  assert(state.overflowX <= 2, 'navigation stress created home overflow');
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

    try {
      await certifyHome(page, profile);
      await certifySettingsPersistence(page);
      await certifyNavigationStress(page);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${profile.name}/home: ${message}`);
      console.error(`FAIL ${profile.name}/home: ${message}`);
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    }

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
        await waitForHome(page).catch(() => {});
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

const expected = gameIds.length * profiles.length;
console.log(`\nP19 BROWSER ARCADE COHESION CERTIFICATION — ${failures.length ? 'FAIL' : 'PASS'}`);
console.log(`${passes}/${expected} game/profile sessions certified plus home, navigation, settings and orientation cohesion checks.`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
