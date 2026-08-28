# Production Release Checklist

Use this checklist for every production release or material gameplay rollout.

## Before merge

- Pull request is based on the current `main`.
- Full CI is green, including `quality:release32`.
- Targeted game/system regression audits are green.
- TypeScript, D1 local migrations, Worker smoke test, Worker dry run, root build, Pages build, MA3, and MA4 pass.
- Runtime/gameplay changes have desktop and mobile interaction verification.
- `CHANGELOG.md` describes user-visible changes.
- Package/release version metadata is internally consistent when publishing a numbered release.
- No temporary migration, patch, debug, or one-shot workflow files remain.
- No secrets, `.dev.vars`, access tokens, generated private data, or production credentials are committed.

## After merge

- Confirm the exact merge commit is the new `main` head.
- Confirm `main` CI passes on that exact merge commit.
- Confirm GitHub Pages deployment passes on that exact merge commit.
- Confirm the production site serves the new build and can launch the arcade shell.
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
