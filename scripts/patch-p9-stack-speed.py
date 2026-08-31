from pathlib import Path

path = Path('src/games/StackGame.tsx')
source = path.read_text()
old = 'state.score * 0.08'
count = source.count(old)
if count < 1:
    raise SystemExit(f'expected Stack score-based speed marker, found {count}')
source = source.replace(old, 'Math.max(0, state.blocks.length - 1) * 0.08')
path.write_text(source)
print(f'patched {count} Stack speed progression marker(s)')
