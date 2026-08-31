from pathlib import Path

ROOT = Path('.')

def read(path: str) -> str:
    return (ROOT / path).read_text()

def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text)

def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing marker: {label}')
    return text.replace(old, new, 1)

# Registry copy now describes the actual P1 mechanics.
p = 'src/data/games.ts'
s = read(p)
s = replace_once(
    s,
    "    tagline: 'Test your raw reflex speed in milliseconds.',\n    description: 'Wait for the electric green signal. Tap the exact millisecond it flashes.',\n    category: 'Reflex',\n    sessionLength: '1 min',\n",
    "    tagline: 'Survive a mixed reflex gauntlet of speed, choice, and restraint.',\n    description: 'Eight escalating rounds mix green-light reactions, left/right decisions, no-go decoys, and combined inhibition challenges.',\n    category: 'Reflex',\n    sessionLength: '1–2 min',\n",
    'Reaction registry summary',
)
s = replace_once(
    s,
    "    instructions: 'Wait for green, then tap as fast as possible. Avoid false starts.',\n    controlsHint: 'Click / Tap / Space',\n",
    "    instructions: 'React only to the valid signal. Choice rounds require the shown left/right response; red HOLD signals are decoys.',\n    controlsHint: 'Tap / Space • Choice: A/D or Left/Right',\n",
    'Reaction registry controls',
)
s = replace_once(
    s,
    "    tagline: 'Stop the rapid indicator at exactly 100%.',\n    description: 'A velocity slider sweeps back and forth. Tap to lock it dead-center for bullseye streaks.',\n",
    "    tagline: 'Master seven escalating precision sectors.',\n    description: 'Lock a sweeping marker onto shifting targets through speed gates, micro-zones, moving beacons, timed reversals, and a final chaos sector.',\n",
    'Perfect Stop registry summary',
)
s = replace_once(
    s,
    "    instructions: 'Tap or press Space to freeze the slider on the center marker.',\n",
    "    instructions: 'Tap or press Space to lock the moving marker inside each sector target. Targets and sweep behavior change every round.',\n",
    'Perfect Stop registry instructions',
)
write(p, s)

# Permanent package command.
p = 'package.json'
s = read(p)
s = replace_once(
    s,
    '    "quality:gameplay-p0": "bun scripts/audit-gameplay-p0.ts",\n',
    '    "quality:gameplay-p0": "bun scripts/audit-gameplay-p0.ts",\n    "quality:gameplay-p1": "bun scripts/audit-gameplay-p1.ts",\n',
    'package P1 gate',
)
write(p, s)

# Permanent CI enforcement.
p = '.github/workflows/ci.yml'
s = read(p)
s = replace_once(
    s,
    '      - run: bun run quality:gameplay-p0\n',
    '      - run: bun run quality:gameplay-p0\n      - run: bun run quality:gameplay-p1\n',
    'CI P1 gate',
)
write(p, s)

# Final release certification requires the P1 command and audit file.
p = 'scripts/audit-release-32.ts'
s = read(p)
s = replace_once(
    s,
    "  'quality:gameplay-p0',\n",
    "  'quality:gameplay-p0',\n  'quality:gameplay-p1',\n",
    'release P1 gate',
)
s = replace_once(
    s,
    "  'scripts/audit-gameplay-p0.ts',\n",
    "  'scripts/audit-gameplay-p0.ts',\n  'scripts/audit-gameplay-p1.ts',\n",
    'release P1 audit file',
)
write(p, s)
