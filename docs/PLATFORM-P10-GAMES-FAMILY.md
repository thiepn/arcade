# Platform P10 — Games Family Consolidation

P10 promotes Games from a taxonomy placeholder into a real product family.

## Canonical modules

- `games/home` → Arcade home/progression surface
- `games/arcade` → the existing 32-game Micro Arcade cabinet
- `games/gomoku` → Gomoku
- `games/wordstrike` → WORDSTRIKE

The canonical Games launch surface is the existing Arcade deployment at `https://thiepn.dev/arcade/`.

## Provider ownership

Arcade may present family-level navigation and bounded progression summaries, but P10 does not turn it into a universal persistence backend.

- Arcade keeps Arcade saves, achievements, daily-challenge state, scoring and leaderboard contracts.
- Gomoku keeps its own game/learning/history/online state.
- WORDSTRIKE keeps campaign progress, records, typing statistics and its optional online leaderboard state.

No provider may directly mutate another game's authoritative store through the Games family contract.

## Compatibility

Existing URLs and project cards stay valid:

- `/arcade/`
- `/gomoku/`
- `/wordstrike/`

P10 adds canonical aliases rather than redirects or destructive route changes.

This phase intentionally does not absorb every historical THIEPN game. Additional games can join the family later through the same provider-owned module contract.
