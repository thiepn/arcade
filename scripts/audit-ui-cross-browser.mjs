import { firefox, webkit } from '@playwright/test';
import { runUIAudit } from './audit-ui-geometry.mjs';

const engine = process.env.UI_BROWSER;
if (engine !== 'firefox' && engine !== 'webkit') throw new Error('UI_BROWSER must be firefox or webkit');
const browser = await ({ firefox, webkit })[engine].launch();
try {
  // Firefox supports viewport/touch testing, but not Playwright's mobile-layout
  // emulation switch. Do not represent this as a physical Android/iOS test.
  const auditBrowser = engine === 'firefox' ? {
    newContext: ({ isMobile, ...options }) => browser.newContext(options),
  } : browser;
  await runUIAudit({
    browser: auditBrowser,
    profiles: [[320, 480], [390, 844], [568, 320], [1280, 720]],
    visit: page => page.goto(process.env.UI_BASE_URL || 'http://127.0.0.1:4173', { waitUntil: 'domcontentloaded' }),
    out: process.env.UI_OUT || `ui-report-${engine}`,
    screenshots: true,
  });
} finally {
  await browser.close();
}
