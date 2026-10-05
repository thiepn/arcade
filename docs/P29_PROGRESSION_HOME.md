# P29 — Progression Surfacing & Goal-Aware Home

## Goal

Make the progression system Arcade already has visible and useful during normal play.

P29 does not invent another progression economy. It surfaces the existing achievement-derived XP, 15-level ladder, favorites, recent play, play counts and AP records.

## Home progression surface

The home screen now shows:

- current player level and title;
- total XP;
- XP remaining to the next level;
- semantic level progress;
- unlocked badge count against the live achievement registry;
- two nearest non-competitive goals;
- each goal's current progress and XP reward;
- a direct route to the full achievements view.

The badge count is intentionally dynamic. P29 does not hard-code an achievement total.

## Goal-aware Play next

The home screen also offers up to three explainable cabinet recommendations.

Priority is:

1. an actionable near-complete achievement;
2. an unplayed cabinet while catalog exploration remains incomplete;
3. a favorite whose personal best can be improved;
4. a recently played cabinet;
5. a familiar cabinet suitable for another PB attempt;
6. deterministic catalog fallback.

Recommendations are unique and may exclude today's P28 daily cabinet so the page does not tell the player to launch the same game twice.

Every recommendation includes a visible reason such as **Closest badge**, **Explore**, **Favorite**, **Continue**, or **Personal best**.

## Achievement routing

Where a locked achievement clearly maps to play, P29 can route directly into the relevant cabinet:

- game-specific feat achievements;
- Reflex / Physics / Puzzle / Strategy / Timing skill targets;
- Type Rush skill target;
- all-game 2,500 / 6,000 / 10,000 / 25,000 AP coverage goals;
- catalog exploration goals;
- multi-game play-count goals.

Achievements that do not have one honest next cabinet remain visible as progression goals but open the achievements view rather than pretending a specific game is the solution.

## Local-first boundary

The home recommendation model:

- makes no network request;
- uses no AI;
- stores no new recommendation state;
- creates no server profile;
- does not modify XP;
- does not create daily rewards or currencies.

Competitive achievements are excluded from near-goal ranking so the core home progression experience remains useful offline and is not distorted by leaderboard availability.

## P29 validation

`quality:gameplay-p29` certifies:

- existing achievement registry reuse;
- near-goal selection;
- local-only recommendation logic;
- unique recommendations;
- daily-cabinet exclusion;
- game-specific achievement routing;
- cross-cabinet score-target routing;
- semantic level progress;
- dynamic badge counts;
- home integration;
- CI and release32 ownership.
