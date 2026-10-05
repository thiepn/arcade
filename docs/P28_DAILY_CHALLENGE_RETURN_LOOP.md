# P28 — Daily Challenge, Streak & Return Loop

## Goal

Give Arcade a simple reason to return each day without adding a backend, cron job, account requirement or notification system.

## Product contract

Every UTC day has exactly one deterministic daily cabinet and one normalized Arcade Point target.

- The cabinet rotation covers all 32 scoring-profile games once per 32-day cycle.
- Consecutive days cannot select the same game.
- Daily targets rotate between 2,000, 2,500 and 3,000 AP.
- AP is already normalized across games, so the target is materially more comparable than raw engine scores.
- The challenge works fully offline.
- A run only advances the challenge when it is played in today's selected cabinet.
- The best AP earned in that cabinet is retained for the day.
- Crossing the target completes the day once; replaying can improve the daily best but cannot duplicate completion.
- Daily state resets at 00:00 UTC.
- An open tab checks for UTC rollover without requiring a reload.

## Streak rules

A completed UTC day contributes one streak day.

- Completing today extends the streak immediately.
- If today is not complete yet, yesterday's streak remains visible throughout the current day.
- Missing an entire UTC day breaks the current streak.
- Best streak remains historical.
- Daily history is bounded to 400 entries.

The streak is derived from completion history instead of maintained as a separate mutable counter, preventing double increments and most clock/order bugs.

## Persistence

Daily progress is stored inside the existing resilient `UserStats` record and participates in the same persistent → session → memory fallback behavior as scores and settings.

Storage recovery merges daily histories rather than discarding the newer or older snapshot.

No network request is needed to choose, play, complete or display a daily challenge.

## Home experience

The challenge card sits between the hero and Continue Playing shelf.

It shows:

- today's game;
- target AP;
- best daily AP;
- semantic progress bar;
- completion state;
- current streak;
- historical best streak when relevant;
- Start / Continue / Play again action;
- explicit UTC reset and offline behavior.

The card uses the selected game's existing accent system rather than introducing a separate visual language.

## Explicit non-goals

P28 does not add:

- push notifications;
- daily login rewards;
- a reward currency;
- extra XP outside the existing achievement model;
- server-authoritative streaks;
- friend/social challenges;
- a daily leaderboard;
- a new account or sync system.

Those would only be justified by a later concrete product need.

## Validation

`quality:gameplay-p28` certifies:

- a complete non-repeating 32-day cabinet cycle;
- the allowed AP target set;
- non-daily games cannot mutate progress;
- partial/complete/replay semantics;
- consecutive-day streak behavior;
- gap reset behavior;
- malformed-history normalization;
- bounded local history;
- home-card accessibility/wiring;
- offline/network independence;
- CI and release32 enforcement.
