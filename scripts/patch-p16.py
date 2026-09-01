from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected marker once, found {count}: {old[:80]!r}')
    p.write_text(text.replace(old, new, 1))


# Reaction: overtime scheduling must use the same combined lookup as rendering/scoring.
replace_once(
    'src/games/ReactionGame.tsx',
    '    const config = REACTION_ROUNDS[index];',
    '    const config = getSessionRound(index);',
)

# Laser Rope: add the P16 geometric warning guard.
replace_once(
    'src/games/LaserRopeGame.tsx',
    "} from '../lib/laserRopeRedline';\n",
    "} from '../lib/laserRopeRedline';\nimport { canApplyLaserRopeModeChange } from '../lib/laserRopeBalance';\n",
)

rope_path = Path('src/games/LaserRopeGame.tsx')
rope = rope_path.read_text()
pattern = re.compile(
    r"        // Mode change \(Low jump vs High slide vs Dual\)\n"
    r"        state\.modeChangeTimer -= dt;\n"
    r"        if \(state\.modeChangeTimer <= 0\) \{.*?\n"
    r"        \}\n\n"
    r"        const effectiveSpeed",
    re.S,
)
replacement = """        // Mode change (Low jump vs High slide vs Dual). P16 keeps the existing\n        // difficulty curve, but does not allow a newly announced mode to become\n        // relevant immediately before its next bottom crossing.\n        state.modeChangeTimer -= dt;\n        if (state.modeChangeTimer <= 0) {\n          let nextMode: 'LOW' | 'HIGH' | 'DUAL' = 'LOW';\n          if (state.jumpStreak > 6 && Math.random() < 0.4) {\n            nextMode = 'HIGH';\n          } else if (state.jumpStreak >= 12 && Math.random() < 0.35) {\n            nextMode = 'DUAL';\n          }\n\n          const candidateBeamsCount = nextMode === 'DUAL' ? 2 : 1;\n          const transitionBaseSpeed = state.isFeverActive ? state.sweepSpeed * 0.75 : state.sweepSpeed;\n          const transitionSpeed = getLaserRopeRedlineSpeed(\n            transitionBaseSpeed,\n            state.redlineActive,\n          );\n\n          if (canApplyLaserRopeModeChange(\n            state.sweepAngle,\n            state.direction,\n            transitionSpeed,\n            candidateBeamsCount,\n          )) {\n            state.modeChangeTimer = Math.random() * 4.5 + 4.0;\n            state.laserMode = nextMode;\n            state.beamsCount = candidateBeamsCount;\n\n            if (nextMode === 'HIGH') {\n              state.popups.push({\n                id: state.nextId++,\n                x: centerX,\n                y: groundY - 150,\n                text: '⚠️ HIGH BEAM - SLIDE / DUCK!',\n                color: '#A855F7',\n                life: 1.2,\n              });\n            } else if (nextMode === 'DUAL') {\n              state.popups.push({\n                id: state.nextId++,\n                x: centerX,\n                y: groundY - 150,\n                text: '⚠️ DUAL BEAM - JUMP!',\n                color: '#F43F5E',\n                life: 1.0,\n              });\n            }\n          } else {\n            // Retry soon without lowering sweep speed or granting invulnerability.\n            state.modeChangeTimer = 0.08;\n          }\n        }\n\n        const effectiveSpeed"""
rope, count = pattern.subn(replacement, rope, count=1)
if count != 1:
    raise SystemExit(f'LaserRopeGame.tsx: expected one mode-change block, replaced {count}')
rope_path.write_text(rope)

# Permanent package command.
replace_once(
    'package.json',
    '    "quality:gameplay-p15": "bun scripts/audit-gameplay-p15.ts"\n  },',
    '    "quality:gameplay-p15": "bun scripts/audit-gameplay-p15.ts",\n    "quality:gameplay-p16": "bun scripts/audit-gameplay-p16.ts"\n  },',
)

# Permanent release32 wiring.
replace_once(
    'scripts/audit-release-32.ts',
    "  'quality:gameplay-p15',\n  'quality:browser-p3',",
    "  'quality:gameplay-p15',\n  'quality:gameplay-p16',\n  'quality:browser-p3',",
)
replace_once(
    'scripts/audit-release-32.ts',
    "  'scripts/audit-gameplay-p15.ts',\n  'scripts/audit-browser-gameplay-p3.mjs',",
    "  'scripts/audit-gameplay-p15.ts',\n  'scripts/audit-gameplay-p16.ts',\n  'scripts/audit-browser-gameplay-p3.mjs',",
)

# CI marker is patched only in the runner working tree so the new audit can test\n# its expected final topology. The workflow file is committed separately through\n# the GitHub connector after this targeted source run succeeds.
replace_once(
    '.github/workflows/ci.yml',
    '      - run: bun run quality:gameplay-p15\n      - run: bun run quality:lifecycle',
    '      - run: bun run quality:gameplay-p15\n      - run: bun run quality:gameplay-p16\n      - run: bun run quality:lifecycle',
)

print('P16 patch applied')
