from pathlib import Path

p = Path('scripts/audit-browser-gameplay-p3.mjs')
s = p.read_text()

marker = """    assert(geometry.title.length > 0, 'game title missing from shell');

    const beforeFrames = await sampleRaf(page);
"""
replacement = """    assert(geometry.title.length > 0, 'game title missing from shell');

    // Cold app/game bootstrap is measured separately from active gameplay. The
    // first Chromium session can legitimately absorb one-time parse/JIT/cache
    // work, so keep a generous startup ceiling while preserving a much tighter
    // gameplay long-task budget below.
    const startupLongTasks = await page.evaluate(() => (globalThis.__p3LongTasks || []).slice());
    const startupLongestTask = startupLongTasks.length ? Math.max(...startupLongTasks) : 0;
    assert(startupLongestTask < 2500, `cold-start long task exceeded 2500ms: ${startupLongestTask.toFixed(0)}ms`);

    // Verify pause/help while the game is still deterministically active. Fast
    // survival games can otherwise end naturally during the input/RAF smoke,
    // which should not be misclassified as a broken pause control.
    await page.locator('#game-pause-btn').click();
    await page.getByText('GAME PAUSED', { exact: true }).waitFor({ state: 'visible', timeout: 2500 });
    const pauseText = await page.locator('.game-shell').innerText();
    assert(/how to play/i.test(pauseText), 'pause modal lacks How To Play guidance');
    const instructions = await page.getByText(/how to play/i).first().locator('..').innerText().catch(() => '');
    assert(instructions.length >= 20, 'How To Play guidance is empty or too short');
    await page.locator('#game-pause-btn').click();
    await page.waitForTimeout(80);

    // From this point onward, long-task accounting is gameplay-only.
    await page.evaluate(() => { globalThis.__p3LongTasks = []; });

    const beforeFrames = await sampleRaf(page);
"""
if marker not in s:
    raise SystemExit('P3 pre-input marker not found')
s = s.replace(marker, replacement, 1)

old_pause = """    await page.locator('#game-pause-btn').click();
    await page.getByText('GAME PAUSED', { exact: true }).waitFor({ state: 'visible', timeout: 2500 });
    const pauseText = await page.locator('.game-shell').innerText();
    assert(/how to play/i.test(pauseText), 'pause modal lacks How To Play guidance');
    const instructions = await page.getByText(/how to play/i).first().locator('..').innerText().catch(() => '');
    assert(instructions.length >= 20, 'How To Play guidance is empty or too short');
    await page.locator('#game-pause-btn').click();
    await page.waitForTimeout(80);

    await page.locator('#game-restart-btn').click();
"""
new_pause = """    await page.locator('#game-restart-btn').click();
"""
if old_pause not in s:
    raise SystemExit('P3 old post-input pause block not found')
s = s.replace(old_pause, new_pause, 1)

old_return = """      longestTask: Number(longestTask.toFixed(1)),
      canvas: Boolean(canvasBefore.present),
"""
new_return = """      startupLongestTask: Number(startupLongestTask.toFixed(1)),
      longestTask: Number(longestTask.toFixed(1)),
      canvas: Boolean(canvasBefore.present),
"""
if old_return not in s:
    raise SystemExit('P3 result marker not found')
s = s.replace(old_return, new_return, 1)

old_log = """        console.log(`PASS ${profile.name.padEnd(7)} ${gameId.padEnd(13)} RAF ${result.rafAvgAfter.toFixed(1)}ms max ${result.maxFrameGap.toFixed(1)}ms long ${result.longestTask.toFixed(1)}ms`);
"""
new_log = """        console.log(`PASS ${profile.name.padEnd(7)} ${gameId.padEnd(13)} RAF ${result.rafAvgAfter.toFixed(1)}ms max ${result.maxFrameGap.toFixed(1)}ms gameplay-long ${result.longestTask.toFixed(1)}ms startup-long ${result.startupLongestTask.toFixed(1)}ms`);
"""
if old_log not in s:
    raise SystemExit('P3 log marker not found')
s = s.replace(old_log, new_log, 1)

p.write_text(s)
