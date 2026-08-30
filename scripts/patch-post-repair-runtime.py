from pathlib import Path
import json

root = Path('.')

def read(path):
    return (root / path).read_text()

def write(path, text):
    (root / path).write_text(text)

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing marker: {label}')
    return text.replace(old, new, 1)

# 1. Chain Reaction: do not permanently stop the shared RAF loop during the
# temporary between-wave isFinished transition. The timeout resets this flag
# and the next wave must continue on the same mounted game loop.
p = 'src/games/ChainGame.tsx'
s = read(p)
s = replace_once(s, '      return !state.isFinished;\n', '      return true;\n', 'chain transient loop termination')
write(p, s)

# 2. All game roots must be allowed to shrink inside the shared visual viewport.
# Fixed pixel minimums force overflow/clipping on short mobile/landscape stages.
min_height_files = {
    'src/games/AstroBlasterGame.tsx': 'min-h-[440px]',
    'src/games/BladeGame.tsx': 'min-h-[440px]',
    'src/games/BubbleBusterGame.tsx': 'min-h-[440px]',
    'src/games/FlappyAeroGame.tsx': 'min-h-[440px]',
    'src/games/PacMazeGame.tsx': 'min-h-[440px]',
    'src/games/RhythmGame.tsx': 'min-h-[440px]',
    'src/games/SlingshotGame.tsx': 'min-h-[420px]',
    'src/games/TowerGame.tsx': 'min-h-[440px]',
    'src/games/VanguardGame.tsx': 'min-h-[420px]',
}
for path, token in min_height_files.items():
    s = read(path)
    if token not in s:
        raise SystemExit(f'missing fixed min-height marker: {path} {token}')
    s = s.replace(token, 'min-h-0')
    write(path, s)

# 3. Permanent regression audit for lifecycle continuity + shrink-safe game roots.
# Terminal flags such as Pinball's gameOverReported are allowed to stop a loop;
# transient transition flags that are later reset are not.
audit = '''import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};
const read = (path: string) => readFileSync(path, 'utf8');
const gameFiles = readdirSync('src/games').filter((file) => file.endsWith('Game.tsx')).sort();

assert(gameFiles.length === 32, `expected 32 game modules, found ${gameFiles.length}`);

const transientStopPattern = /return\\s+!state\\.(?:isFinished|isTransitioning|roundTransition|waveTransition)\\s*;/;
for (const file of gameFiles) {
  const source = read(join('src/games', file));
  assert(
    !/min-h-\\[(?:\\d+(?:\\.\\d+)?)(?:px|rem|vh)\\]/.test(source),
    `${file} restores a fixed minimum game height that can overflow a short mobile/landscape stage`,
  );
  assert(
    !transientStopPattern.test(source),
    `${file} stops the shared RAF loop from a transient transition flag`,
  );
}

const chain = read('src/games/ChainGame.tsx');
assert(chain.includes('state.isFinished = true;'), 'Chain Reaction no longer marks its between-wave transition');
assert(chain.includes('state.isFinished = false;'), 'Chain Reaction no longer reopens the next wave after its transition');
assert(chain.includes('return true;'), 'Chain Reaction does not keep the mounted game loop alive through wave transitions');
assert(!chain.includes('return !state.isFinished;'), 'Chain Reaction still permanently stops after its first wave');

if (errors.length) {
  console.error('GAME LIFECYCLE / SHRINK-SAFE LAYOUT AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('GAME LIFECYCLE / SHRINK-SAFE LAYOUT AUDIT — PASS');
console.log('All 32 game roots can shrink with the shared viewport, and transient game-state transitions cannot terminate the RAF loop.');
'''
write('scripts/audit-game-lifecycle.ts', audit)

# 4. Package gate.
p = 'package.json'
data = json.loads(read(p))
scripts = data['scripts']
if 'quality:lifecycle' not in scripts:
    out = {}
    inserted = False
    for k, v in scripts.items():
        out[k] = v
        if k == 'quality:frame-rate':
            out['quality:lifecycle'] = 'bun scripts/audit-game-lifecycle.ts'
            inserted = True
    if not inserted:
        raise SystemExit('package quality:frame-rate marker missing')
    data['scripts'] = out
write(p, json.dumps(data, indent=2) + '\n')

# 5. Release certification requires the new gate and audit. The connector will
# add the CI workflow step after this bot commit so the bot never needs workflow
# write permission.
p = 'scripts/audit-release-32.ts'
s = read(p)
if "'quality:lifecycle'" not in s:
    s = replace_once(s, "  'quality:frame-rate',\n", "  'quality:frame-rate',\n  'quality:lifecycle',\n", 'release gate list')
if "'scripts/audit-game-lifecycle.ts'" not in s:
    s = replace_once(s, "  'scripts/audit-frame-rate-global.ts',\n", "  'scripts/audit-frame-rate-global.ts',\n  'scripts/audit-game-lifecycle.ts',\n", 'release audit list')
write(p, s)

print('Post-repair runtime/lifecycle patch applied.')
