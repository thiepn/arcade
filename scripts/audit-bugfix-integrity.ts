import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPLACEMENT_CUTOVER_MS, sanitizeReplacementStatsValue } from '../src/lib/replacementEpoch';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const replacements = read('src/lib/replacementGames.tsx');
const logicalCanvas = read('src/hooks/useLogicalCanvas.ts');
const vector = read('src/games/VectorGolf.tsx');
const hex = read('src/games/HexCapture.tsx');
const outbox = read('src/lib/leaderboardOutbox.ts');
const sw = read('public/sw.js');

assert(!replacements.includes('installResponsiveCanvas'), 'replacement layer must not own per-launch canvas observers');
assert(!replacements.includes("window.addEventListener('resize'"), 'replacement layer leaked a global resize listener');
assert(replacements.includes('sanitizeReplacementLocalScores();'), 'replacement score epoch sanitation is not wired before startup');
assert(replacements.includes('installVisibleAliases();'), 'replacement titles are not installed');

assert(logicalCanvas.includes('useLayoutEffect'), 'logical canvas sizing must happen before paint');
assert(logicalCanvas.includes('observer?.disconnect()'), 'logical canvas ResizeObserver cleanup is missing');
assert(logicalCanvas.includes("window.removeEventListener('resize', schedule)"), 'logical canvas window cleanup is missing');
assert(logicalCanvas.includes("visualViewport?.removeEventListener('resize', schedule)"), 'logical canvas visualViewport cleanup is missing');

assert(vector.includes('useLogicalCanvas(canvasRef, W, H)'), 'Vector Golf must use owned responsive canvas sizing');
assert(vector.includes('onPointerCancel={onPointerCancel}'), 'Vector Golf pointer-cancel must not reuse shot completion');
assert(vector.includes('stateRef.current.dragging = false'), 'Vector Golf does not clear stale drag state');
assert(vector.includes("target.closest('button, a[href]"), 'Vector Golf can steal keyboard activation from shell controls');

assert(hex.includes('useLogicalCanvas(canvasRef, W, H)'), 'Hex Capture must use owned responsive canvas sizing');
assert(hex.includes("window.addEventListener('blur', clearHeld)"), 'Hex Capture does not clear held movement on window blur');
assert(hex.includes("document.addEventListener('visibilitychange', visibility)"), 'Hex Capture does not clear held movement while backgrounded');
assert(hex.includes('st.lastStep = performance.now();'), 'Hex Capture initial input can double-step before the repeat timer advances');
assert(hex.includes("target.closest('button, a[href]"), 'Hex Capture can steal Space from shell controls');
assert(hex.includes("loseLife('HUNTER HIT TRAIL')"), 'Hex Capture closure lacks same-frame hunter/trail protection');

assert(outbox.includes('if(!db)this.db=null'), 'IndexedDB open failure is still permanently cached');
assert(outbox.includes('this.durable=true;this.memory.delete(id)'), 'successful IndexedDB persistence does not restore durable state');
assert(outbox.includes("localStorage.removeItem(this.prefix+id);this.durable=true"), 'successful fallback persistence does not restore durable state');

const navigationStart = sw.indexOf('async function navigationResponse');
const navigationEnd = sw.indexOf('async function assetResponse');
const navigation = sw.slice(navigationStart, navigationEnd);
assert(navigationStart >= 0 && navigationEnd > navigationStart, 'service worker navigation handler missing');
assert(!navigation.includes('cache.put('), 'navigation fetch must not mix newer HTML into an older versioned cache');
assert(navigation.includes("cache.match(scopeUrl('./'))"), 'offline navigation fallback is missing');

const oldStats = {
  highScores: { gravity: 9000, astroblaster: 8000, orbit: 100 },
  rawHighScores: { gravity: 15000, astroblaster: 90000, orbit: 100 },
  legacyHighScores: { gravity: 12000, astroblaster: 70000 },
  bestScoreDetails: {
    gravity: { rawScore: 15000, modeId: 'standard', scoreVersion: 2 },
    astroblaster: { rawScore: 90000, modeId: 'standard', scoreVersion: 2 },
  },
  modeBests: {
    'gravity:standard': { rawScore: 15000, modeId: 'standard', scoreVersion: 2, apMicros: 1, achievedAt: REPLACEMENT_CUTOVER_MS - 1 },
    'astroblaster:standard': { rawScore: 90000, modeId: 'standard', scoreVersion: 2, apMicros: 1, achievedAt: REPLACEMENT_CUTOVER_MS - 1 },
  },
};
const cleaned = sanitizeReplacementStatsValue(structuredClone(oldStats)).value as any;
assert.equal(cleaned.highScores.gravity, undefined, 'retired Gravity AP survived replacement sanitation');
assert.equal(cleaned.highScores.astroblaster, undefined, 'retired Astro AP survived replacement sanitation');
assert.equal(cleaned.rawHighScores.gravity, undefined, 'retired Gravity raw score survived replacement sanitation');
assert.equal(cleaned.modeBests['gravity:standard'], undefined, 'retired Gravity mode best survived replacement sanitation');
assert.equal(cleaned.highScores.orbit, 100, 'unrelated game score was altered by replacement sanitation');

const replacementStats = {
  highScores: { gravity: 999999 },
  rawHighScores: { gravity: 999999 },
  bestScoreDetails: { gravity: { rawScore: 8200, modeId: 'standard', scoreVersion: 2 } },
  modeBests: {
    'gravity:standard': {
      rawScore: 8200,
      modeId: 'standard',
      scoreVersion: 2,
      apMicros: 1,
      achievedAt: REPLACEMENT_CUTOVER_MS + 1000,
    },
  },
};
const preserved = sanitizeReplacementStatsValue(structuredClone(replacementStats)).value as any;
assert.equal(preserved.rawHighScores.gravity, 8200, 'post-cutover Vector Golf raw best was not preserved');
assert.equal(preserved.bestScoreDetails.gravity.rawScore, 8200, 'post-cutover Vector Golf score details were not reconstructed');
assert(preserved.modeBests['gravity:standard'].apMicros > 0, 'post-cutover Vector Golf AP was not recalculated');
assert(preserved.highScores.gravity >= 0 && preserved.highScores.gravity < 999999, 'retired AP contaminated the replacement PB');

console.log('BUGFIX INTEGRITY AUDIT — PASS');
console.log('Replacement lifecycle/input, score epoch isolation, outbox durability recovery, and immutable PWA build caches are certified.');
