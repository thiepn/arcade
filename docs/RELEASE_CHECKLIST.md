# Production Release Checklist

Use this checklist for every production release or material gameplay rollout.

## Before merge

- Pull request is based on the current `main`.
- Full CI is green, including `quality:release32`.
- Targeted game/system regression audits are green.
- For P17-or-later gameplay releases, `quality:gameplay-p17` and `quality:browser-p17` are green and the 32-game feel certification remains complete.
- For P18-or-later gameplay releases, `quality:gameplay-p18` and `quality:browser-p18` are green; the 32-game clarity matrix and terminology registry remain complete; desktop, 390px mobile, and 320px small-mobile teaching/focus paths are certified.
- For P19-or-later product releases, `quality:gameplay-p19` and `quality:browser-p19` are green; all 32 games retain the canonical shell/card/pause/result contract; home-card, navigation-stress, settings-persistence and orientation-recovery checks pass; no replay, challenge, currency or new retention platform has been introduced.
- TypeScript, D1 local migrations, Worker smoke test, Worker dry run, root build, Pages build, MA3, and MA4 pass.
- Runtime/gameplay changes have desktop and mobile interaction verification.
- Reduced-motion behavior preserves warnings, success/failure information, and timing-critical cues.
- With sound muted and haptics disabled, essential objectives, controls, danger, success/failure, and mastery availability remain visually understandable.
- Shell controls retain accessible names, visible keyboard focus, and reachable touch targets; pause/result dialogs retain focus containment and focus restoration.
- Product-level modals use one overlay/panel/focus grammar and do not expose multiple simultaneously interactive modal surfaces.
- At 320px and 390px widths, the home grid, shell toolbar, pause/result actions, app modals and loading/error states remain reachable without horizontal overflow.
- On a physical touch device, spot-check input latency, audio hierarchy, haptic restraint, high-speed readability, restart/exit cleanup, and game switching before experiential sign-off.
- For P18 experiential sign-off, have an unfamiliar tester play representative priority games and answer: objective, main controls, failure cause, score/progress cause, advanced mechanic noticed, and what to try next. Do not treat CI as proof of subjective learnability or full accessibility.
- For P19 visual sign-off, inspect the 32-card home grid plus several unrelated game shells, pause/result surfaces and app-level modals; the product frame should be recognizably shared while the gameplay regions remain visually distinct. Do not treat CI as proof of aesthetic cohesion.
- `CHANGELOG.md` describes user-visible changes.
- Package/release version metadata is internally consistent when publishing a numbered release.
- No temporary migration, patch, debug, or one-shot workflow files remain.
- No secrets, `.dev.vars`, access tokens, generated private data, or production credentials are committed.

## After merge

- Confirm the exact merge commit is the new `main` head.
- Confirm `main` CI passes on that exact merge commit.
- Confirm GitHub Pages deployment passes on that exact merge commit.
- Confirm the production site serves the new build and can launch the arcade shell.
- Confirm the live 32-game smoke certification passes for the deployed commit.
- For release tags, tag only the certified `main` commit.

## Repository protection target

The GitHub-side `main` protection/ruleset should enforce:

- changes enter through pull requests rather than direct development pushes;
- the CI `build` check is required and the branch must be current before merge;
- force pushes are blocked;
- branch deletion is blocked;
- administrators do not routinely bypass required checks;
- unresolved review conversations block merge when review threads are used.

The repository-side `quality:hardening` audit verifies the version-controlled half of these controls. GitHub server-side branch protection remains a repository setting rather than a source-controlled file.
