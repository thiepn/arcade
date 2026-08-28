from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    target = Path(path)
    source = target.read_text(encoding='utf-8')
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    target.write_text(source.replace(old, new, 1), encoding='utf-8')

replace_once(
    'src/games/BreakoutGame.tsx',
    """    laserTimeRemaining: 0,
    shake: 0,""",
    """    laserTimeRemaining: 0,
    laserCooldown: 0,
    wideTimeRemaining: 0,
    fireballTimeRemaining: 0,
    shake: 0,""",
    'Breakout state fields',
)
replace_once(
    'src/games/BreakoutGame.tsx',
    """    state.laserTimeRemaining = 0;
    state.balls = [""",
    """    state.laserTimeRemaining = 0;
    state.laserCooldown = 0;
    state.wideTimeRemaining = 0;
    state.fireballTimeRemaining = 0;
    state.balls = [""",
    'Breakout state reset',
)
replace_once(
    'src/games/SnakeGame.tsx',
    """          life: 1.0,
          color: '#38BDF8',
          size: Math.random() * 3 + 2,""",
    """          life: 1,
          maxLife: 18,
          color: '#38BDF8',
          size: Math.random() * 3 + 2,""",
    'Snake warp particle lifetime',
)

print('Latent game-state type contracts repaired')
