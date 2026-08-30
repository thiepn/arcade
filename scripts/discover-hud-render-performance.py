from pathlib import Path
import re

ROOT = Path('.')
GAMES = ROOT / 'src' / 'games'
REPORT = ROOT / 'hud-render-performance-report.txt'


def line_no(text: str, offset: int) -> int:
    return text.count('\n', 0, offset) + 1


def context(text: str, offset: int, radius: int = 2) -> str:
    lines = text.splitlines()
    line = line_no(text, offset)
    start = max(1, line - radius)
    end = min(len(lines), line + radius)
    out = []
    for n in range(start, end + 1):
        out.append(f'{n:4}: {lines[n - 1]}')
    return '\n'.join(out)


def matching_brace(text: str, open_index: int) -> int:
    depth = 0
    quote = None
    escape = False
    i = open_index
    while i < len(text):
        ch = text[i]
        if quote:
            if escape:
                escape = False
            elif ch == '\\':
                escape = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in "'\"`":
            quote = ch
            i += 1
            continue
        if text.startswith('//', i):
            j = text.find('\n', i)
            i = len(text) if j == -1 else j + 1
            continue
        if text.startswith('/*', i):
            j = text.find('*/', i + 2)
            i = len(text) if j == -1 else j + 2
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise RuntimeError(f'unmatched brace at {open_index}')


def callback_blocks(source: str, marker: str):
    blocks = []
    cursor = 0
    while True:
        at = source.find(marker, cursor)
        if at == -1:
            break
        arrow = source.find('=>', at)
        if arrow == -1:
            break
        open_brace = source.find('{', arrow)
        if open_brace == -1:
            break
        try:
            close_brace = matching_brace(source, open_brace)
        except RuntimeError:
            cursor = at + len(marker)
            continue
        blocks.append((open_brace + 1, close_brace))
        cursor = close_brace + 1
    return blocks


def enclosing_raf_blocks(source: str):
    blocks = []
    for m in re.finditer(r'requestAnimationFrame\s*\(', source):
        # Prefer the closest function/arrow body opening before the call.
        search_start = max(0, m.start() - 5000)
        prefix = source[search_start:m.start()]
        candidates = [p for p in (prefix.rfind('=> {'), prefix.rfind('function ')) if p >= 0]
        if not candidates:
            continue
        candidate = max(candidates)
        if prefix.startswith('=> {', candidate):
            open_brace = search_start + candidate + 3
        else:
            open_brace = source.find('{', search_start + candidate, m.start())
        if open_brace == -1:
            continue
        try:
            close_brace = matching_brace(source, open_brace)
        except RuntimeError:
            continue
        if open_brace < m.start() < close_brace:
            blocks.append((open_brace + 1, close_brace))
    # de-duplicate
    return sorted(set(blocks))


report = []
summary = []
all_game_files = sorted(GAMES.glob('*Game.tsx'))
report.append(f'HUD / RENDER PERFORMANCE DISCOVERY — {len(all_game_files)} games')
report.append('')

for path in all_game_files:
    source = path.read_text()
    setters = []
    for m in re.finditer(r'const\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\]\s*=\s*useState(?:<[^;=]+>)?\s*\(', source):
        setters.append((m.group(1), m.group(2)))

    hot_blocks = callback_blocks(source, 'onUpdate:')
    hot_blocks += enclosing_raf_blocks(source)
    hot_blocks = sorted(set(hot_blocks))

    hits = []
    for value_name, setter in setters:
        for start, end in hot_blocks:
            body = source[start:end]
            for call in re.finditer(rf'\b{re.escape(setter)}\s*\(', body):
                absolute = start + call.start()
                hits.append((absolute, f'React setter {setter} ({value_name})'))

    for start, end in hot_blocks:
        body = source[start:end]
        for call in re.finditer(r'\bonScoreUpdate\s*\(', body):
            absolute = start + call.start()
            hits.append((absolute, 'onScoreUpdate'))

    if hits:
        report.append(f'## {path.name}')
        report.append(f'useState setters: {", ".join(f"{v}/{s}" for v, s in setters) or "none"}')
        report.append(f'hot callback blocks: {len(hot_blocks)}')
        for absolute, label in sorted(hits):
            report.append(f'- line {line_no(source, absolute)}: {label}')
            report.append(context(source, absolute))
        report.append('')
        summary.append((path.name, len([h for h in hits if h[1].startswith('React setter')]), len([h for h in hits if h[1] == 'onScoreUpdate'])))

report.append('SUMMARY')
for name, setter_hits, score_hits in summary:
    report.append(f'{name}: react-setter-hot-calls={setter_hits}, score-hot-calls={score_hits}')
report.append('')
report.append(f'games-with-hot-calls={len(summary)}')

REPORT.write_text('\n'.join(report) + '\n')
print('\n'.join(report))
