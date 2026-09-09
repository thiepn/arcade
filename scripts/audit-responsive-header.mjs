import { chromium } from '@playwright/test';

const BASE_URL = process.env.HEADER_BASE_URL || 'http://127.0.0.1:4173';
const CHROME_PATH = process.env.HEADER_CHROME_PATH || undefined;
const EXPECT_LIVE_LEADERBOARD = process.env.HEADER_EXPECT_LIVE_LEADERBOARD === '1';

const profiles = [
  { name: 'mobile-320', width: 320, height: 568, isMobile: true, hasTouch: true },
  { name: 'mobile-360', width: 360, height: 800, isMobile: true, hasTouch: true },
  { name: 'mobile-375', width: 375, height: 812, isMobile: true, hasTouch: true },
  { name: 'mobile-390', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'mobile-412', width: 412, height: 915, isMobile: true, hasTouch: true },
  { name: 'mobile-430', width: 430, height: 932, isMobile: true, hasTouch: true },
  { name: 'tablet-768', width: 768, height: 1024, isMobile: true, hasTouch: true },
  { name: 'desktop-1024', width: 1024, height: 768, isMobile: false, hasTouch: false },
  { name: 'desktop-1280', width: 1280, height: 800, isMobile: false, hasTouch: false },
  { name: 'desktop-1440', width: 1440, height: 900, isMobile: false, hasTouch: false },
];

const actionIds = [
  'header-leaderboards-pill-btn',
  'header-rank-badge-btn',
  'search-toggle-btn',
  'sound-toggle-btn',
  'stats-open-btn',
];

const failures = [];
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const launchOptions = { headless: true, args: ['--disable-dev-shm-usage', '--no-sandbox'] };
if (CHROME_PATH) launchOptions.executablePath = CHROME_PATH;
else launchOptions.channel = 'chrome';

const browser = await chromium.launch(launchOptions);
try {
  for (const profile of profiles) {
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      isMobile: profile.isMobile,
      hasTouch: profile.hasTouch,
      colorScheme: 'dark',
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();

    try {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForFunction(() => document.documentElement.dataset.p19Cohesion === 'ready', null, { timeout: 5000 });
      await page.locator('#brand-logo-btn').waitFor({ state: 'visible', timeout: 8000 });
      await page.locator('#nav-all-games-btn').waitFor({ state: 'visible', timeout: 8000 });

      const state = await page.evaluate((ids) => {
        const rectFor = (element) => {
          const rect = element?.getBoundingClientRect();
          if (!rect) return null;
          return {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          };
        };
        const visible = (element) => {
          if (!element) return false;
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };

        const header = document.querySelector('.p19-home-header');
        const brand = document.getElementById('brand-logo-btn');
        const nav = document.querySelector('.p19-library-nav');
        const actions = ids.map((id) => {
          const element = document.getElementById(id);
          return {
            id,
            rect: rectFor(element),
            label: element?.getAttribute('aria-label') || '',
            visible: visible(element),
          };
        });
        const leaderboard = document.getElementById('header-leaderboards-pill-btn');
        const rank = document.getElementById('header-rank-badge-btn');
        const leaderboardLabelVisible = Array.from(leaderboard?.querySelectorAll('span') || []).some(visible);
        const rankCompact = rank?.lastElementChild || null;

        return {
          viewportWidth: innerWidth,
          docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          bodyOverflowX: document.body.scrollWidth - document.body.clientWidth,
          header: rectFor(header),
          brand: rectFor(brand),
          nav: rectFor(nav),
          actions,
          leaderboardLabelVisible,
          rankCompactVisible: visible(rankCompact),
          scrollX,
        };
      }, actionIds);

      const inViewport = (rect) => Boolean(
        rect &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.left >= -1 &&
        rect.right <= state.viewportWidth + 1,
      );

      assert(state.docOverflowX <= 2 && state.bodyOverflowX <= 2, `${profile.name}: horizontal overflow doc=${state.docOverflowX}px body=${state.bodyOverflowX}px`);
      assert(state.scrollX === 0, `${profile.name}: page opened horizontally scrolled (${state.scrollX}px)`);
      assert(inViewport(state.header) && inViewport(state.brand) && inViewport(state.nav), `${profile.name}: header/brand/nav escaped viewport: ${JSON.stringify(state)}`);
      assert(state.actions.every((action) => action.visible && action.label && inViewport(action.rect)), `${profile.name}: action escaped viewport or lost accessible name: ${JSON.stringify(state.actions)}`);

      const sorted = state.actions.map((action) => action.rect).filter(Boolean).sort((a, b) => a.left - b.left);
      for (let index = 1; index < sorted.length; index++) {
        assert(sorted[index - 1].right <= sorted[index].left + 0.5, `${profile.name}: header action buttons overlap`);
      }

      if (profile.width < 480) {
        assert(!state.leaderboardLabelVisible, `${profile.name}: leaderboard text must collapse to icon-only below 480px`);
        assert(!state.rankCompactVisible, `${profile.name}: compact rank text must collapse to orb-only below 480px`);
        const leader = state.actions.find((action) => action.id === 'header-leaderboards-pill-btn')?.rect;
        const rank = state.actions.find((action) => action.id === 'header-rank-badge-btn')?.rect;
        assert(Boolean(leader && leader.width <= 46 && rank && rank.width <= 46), `${profile.name}: compact controls are still too wide`);
      }

      if (profile.hasTouch) {
        assert(state.actions.every((action) => action.rect && action.rect.width >= 40 && action.rect.height >= 40), `${profile.name}: touch target below 40px floor`);
      }

      if (profile.width >= 1280) {
        assert(Boolean(state.header && state.header.height <= 80), `${profile.name}: desktop header unexpectedly wrapped (${state.header?.height}px)`);
      } else {
        assert(Boolean(state.header && state.header.height <= 140), `${profile.name}: responsive header became excessively tall (${state.header?.height}px)`);
      }

      const search = page.locator('#search-toggle-btn');
      await search.click();
      assert(await search.getAttribute('aria-expanded') === 'true', `${profile.name}: search icon did not open search`);
      const openOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert(openOverflow <= 2, `${profile.name}: opening search introduced ${openOverflow}px horizontal overflow`);
      await search.click();
      assert(await search.getAttribute('aria-expanded') === 'false', `${profile.name}: search icon did not close search`);

      const sound = page.locator('#sound-toggle-btn');
      const beforeSound = await sound.getAttribute('aria-pressed');
      await sound.click();
      const afterSound = await sound.getAttribute('aria-pressed');
      assert(beforeSound !== afterSound, `${profile.name}: sound icon did not toggle`);

      if (EXPECT_LIVE_LEADERBOARD && profile.name === 'mobile-390') {
        await page.locator('#header-leaderboards-pill-btn').click();
        const leaderboardDialog = page.getByRole('dialog', { name: 'Overall leaderboards' });
        await leaderboardDialog.waitFor({ state: 'visible', timeout: 8000 });
        await page.waitForFunction(() => {
          const dialog = document.querySelector('[role="dialog"][aria-label="Overall leaderboards"]');
          const text = dialog?.textContent || '';
          return !text.includes('Loading rankings…');
        }, null, { timeout: 10000 });
        const leaderboardText = await leaderboardDialog.innerText();
        assert(!leaderboardText.includes('Global leaderboard unavailable. Your local progress is kept.'), 'live leaderboard modal surfaced the generic unavailable fallback');
        assert(!leaderboardText.includes('not connected'), 'live leaderboard modal thinks the production API is unconfigured');
        assert(leaderboardText.includes('Published competitors'), 'live leaderboard modal did not render the global board');
        await leaderboardDialog.getByRole('button', { name: 'Close leaderboards' }).click();

        await page.locator('#header-rank-badge-btn').click();
        const profileDialog = page.getByRole('dialog', { name: 'Player profile' });
        await profileDialog.waitFor({ state: 'visible', timeout: 8000 });
        await page.waitForFunction(() => {
          const dialog = document.querySelector('[role="dialog"][aria-label="Player profile"]');
          const text = dialog?.textContent || '';
          return text.includes('Player-') || text.includes('Global leaderboard unavailable. Your local progress is kept.');
        }, null, { timeout: 10000 });
        const profileText = await profileDialog.innerText();
        assert(!profileText.includes('Global leaderboard unavailable. Your local progress is kept.'), 'live player profile surfaced the generic unavailable fallback');
        assert(!profileText.includes('Local Player'), 'live player profile did not establish the persistent guest identity');
        assert(profileText.includes('Player-'), 'live player profile did not receive a Supabase guest profile');
        await profileDialog.getByRole('button', { name: 'Close profile' }).click();
      }

      console.log(`PASS ${profile.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(message);
      console.error(`FAIL ${message}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log(`\nRESPONSIVE HEADER CERTIFICATION — ${failures.length ? 'FAIL' : 'PASS'}`);
console.log(`${profiles.length - failures.length}/${profiles.length} mobile/tablet/desktop viewport profiles passed.`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
