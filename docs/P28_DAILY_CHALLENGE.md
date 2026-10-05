# P28 — Daily Challenge, Streak & Return Loop

## Product goal

Give Arcade a simple reason to return each day without turning the product into a live-service backend.

## Daily cabinet

Every UTC day selects one of the 32 existing games through a deterministic rotation.

- The roster is sorted before selection, so the same date resolves to the same game everywhere.
- Every cabinet appears once before the rotation repeats.
- The feature works offline.
- There is no cron job, account requirement, server state or leaderboard dependency.

## Completion

A daily challenge is completed when the player finishes the featured game with a positive Arcade Point result.

This deliberately makes the daily streak accessible. It rewards showing up and actually playing, rather than forcing every player to meet a high skill threshold.

A separate **3,000 AP Strong Run** target provides an optional skill goal. Reaching it does not change or gate the streak.

## Streaks

The local challenge record stores only compact aggregate state:

- today's best AP;
- whether today's challenge is complete;
- most recently completed UTC day;
- current streak;
- best streak;
- total daily challenges completed.

Completing consecutive UTC days extends the streak. Missing a UTC day resets the displayed/current streak on the next completion. Replaying the same daily challenge cannot increment completion totals or streak multiple times.

## Home experience

The Daily Challenge card sits directly below the hero and shows:

- today's featured cabinet;
- completion state;
- current streak;
- best streak;
- lifetime completed days;
- today's best AP;
- progress toward the 3,000 AP Strong Run;
- a direct Play Today / Play Again action.

The date refreshes at UTC midnight and when the tab regains focus.

## Result feedback

If the finished run is today's featured game, the result screen shows:

- daily completion feedback;
- current streak;
- today's best AP;
- Strong Run status.

A first daily completion gets celebratory feedback even when it was not also a personal best.

## Persistence and privacy

Daily progress uses the existing resilient local statistics store. It follows the same local/session/memory fallback as the rest of Arcade progress and adds no new identity or tracking surface.

## Non-goals

P28 does not add:

- daily XP currency;
- paid rewards;
- server-authoritative streaks;
- notifications;
- missions/battle passes;
- an additional backend;
- changes to game scoring or public rankings.

Those would add complexity without improving the core instant-play arcade enough to justify it.
