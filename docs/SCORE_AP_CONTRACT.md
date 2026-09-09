# Score vs Arcade Points contract

Micro Arcade has two intentionally different score domains.

## Score

`Score` is the native value produced by an individual game's own rules. It belongs to that game only. A score of 20 in Stack and 20,000 in Reaction are not expected to represent comparable performance, and raw scores from different games must never be added together for global ranking.

The game HUD and result screen preserve this native score so each cabinet keeps its own scoring identity.

## Arcade Points (AP)

`AP` is derived from the native Score through the versioned per-game/per-mode calibration in `shared/scoring.ts` and `shared/scoringProfiles.json`. AP exists specifically to make competitive performance comparable across different cabinets and modes.

Per-game and global leaderboard ranking uses AP. The global rating uses each cabinet's best normalized AP contribution, subject to the overall-rating contribution cap; it never sums raw Score across different games.

## Boundary rule

Game engines emit native Score only. They do not format or replace their HUD Score with AP. The shared arcade shell, persistence layer, and leaderboard boundary derive AP from the raw Score and keep both values separate.

Personal bests are therefore also separate:

- **Best Score:** highest native score earned in that cabinet.
- **Best AP:** highest normalized competitive result for that cabinet.

Changing AP calibration in a future scoring version must not rewrite a game's native Score economy unless the game itself is deliberately being rebalanced.