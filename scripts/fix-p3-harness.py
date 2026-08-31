from pathlib import Path
import re

p = Path('scripts/audit-browser-gameplay-p3.mjs')
s = p.read_text()

old_canvas = """      const xs = [0.15, 0.35, 0.5, 0.65, 0.85];
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
"""
new_canvas = """      const probe = document.createElement('canvas');
      probe.width = 64;
      probe.height = 64;
      const probeCtx = probe.getContext('2d');
      if (probeCtx) {
        probeCtx.drawImage(canvas, 0, 0, probe.width, probe.height);
        const data = probeCtx.getImageData(0, 0, probe.width, probe.height).data;
        sampled = probe.width * probe.height;
        for (let index = 0; index < data.length; index += 4) {
          if (data[index + 3] > 0 || data[index] + data[index + 1] + data[index + 2] > 0) {
            nonTransparent++;
          }
        }
      }
"""
if old_canvas not in s:
    raise SystemExit('old sparse canvas sampler not found')
s = s.replace(old_canvas, new_canvas, 1)

old_pause = """    const pauseText = await page.locator('.game-shell').innerText();
    assert(pauseText.includes('How To Play'), 'pause modal lacks How To Play guidance');
    const instructions = await page.locator('.game-shell').locator('text=How To Play').locator('..').innerText().catch(() => '');
"""
new_pause = """    const pauseText = await page.locator('.game-shell').innerText();
    assert(/how to play/i.test(pauseText), 'pause modal lacks How To Play guidance');
    const instructions = await page.getByText(/how to play/i).first().locator('..').innerText().catch(() => '');
"""
if old_pause not in s:
    raise SystemExit('old case-sensitive pause assertion not found')
s = s.replace(old_pause, new_pause, 1)

p.write_text(s)
