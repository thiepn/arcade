# P30 — Results-to-Meta Integration & Replay Motivation

## Goal

Make every completed run explain what changed beyond the raw score.

P30 connects the existing game result screen to Arcade-wide progression without adding a reward currency, another persistence model, or popup-heavy celebration system.

## Result contract

A finished run is evaluated against one explicit pre-run baseline. The result delta can surface:

- personal-best improvement;
- newly unlocked local achievements;
- XP earned from those achievements;
- level progression and level-up;
- daily challenge progress/completion and streak;
- global rank entry or upward movement when a published leaderboard refresh succeeds;
- one deterministic, explainable next-cabinet recommendation.

The baseline is captured before the launch play-count mutation so achievements caused by that session are credited to the result. After score save, the baseline advances to the current state so replaying the same cabinet cannot re-announce the same unlock.

## Celebration hierarchy

P30 uses one result panel rather than independent modal/toast spam.

Priority is:

1. level up;
2. daily challenge completion;
3. achievement unlock;
4. personal best;
5. ordinary session completion.

The existing result overlay remains the only completion surface.

## Progression summary

The compact Run progress section can show:

- PB gain;
- XP gained;
- newly unlocked badges;
- new level/title;
- daily target and streak;
- refreshed global rank;
- one Play next action.

Achievement details are capped in the panel, with excess unlocks summarized rather than producing repeated overlays.

## Leaderboard movement

Rank feedback is best-effort and never blocks local results.

After a run is accepted for publication, Arcade refreshes that game's overall leaderboard and compares the cached pre-submit rank with the new rank. If either network or leaderboard data is unavailable, the local progression summary remains complete and no fabricated rank is shown.

## Replay motivation

P30 reuses the P29 recommendation engine. The finished cabinet and today's daily cabinet are excluded, preventing redundant calls to action.

The existing Play again, Global leaderboard, Next random and Back to Arcade controls remain available.

## Explicit non-goals

P30 does not add:

- coins, gems, tickets or login rewards;
- new XP sources;
- new achievement persistence;
- server-authoritative progression;
- AI recommendations;
- forced navigation after a result;
- a toast for every changed metric;
- speculative leaderboard movement.

## Validation

`quality:gameplay-p30` certifies:

- deterministic before/after result deltas;
- PB gain attribution;
- badge/XP and level-up attribution;
- daily challenge completion;
- recommendation exclusion;
- result-panel semantic integration;
- accepted-run leaderboard refresh;
- CI and release32 ownership.
