# Contributing

## Development workflow

Create changes on a branch and merge through a pull request. Do not use `main` as a development branch and do not intentionally bypass a failing CI result.

Before opening or merging a pull request:

1. Run `bun install --frozen-lockfile`.
2. Run the relevant targeted quality gate for the changed game/system.
3. Run `bun run quality:release32` for roster/release-sensitive changes.
4. Run `bunx tsc --noEmit` for TypeScript changes.
5. For runtime/gameplay changes, verify the affected interaction at representative desktop and mobile sizes.

The complete GitHub Actions CI workflow is the merge authority for automated certification.

## Game changes

Every game must remain registered in `src/data/games.ts`, accepted by the Worker game-rule list, and compatible with the shared pause, score, and game-over contracts. Control hints must describe controls that actually exist.

New or materially repaired mechanics should receive a permanent regression audit when a stable structural or simulation-based assertion can prevent recurrence.

## Security and secrets

Never commit production credentials, Cloudflare secrets, GitHub tokens, `.dev.vars`, or private user data. Follow `SECURITY.md` for vulnerability disclosure.

## Release discipline

User-visible changes belong in `CHANGELOG.md`. Temporary migration/patch workflows and scripts must be removed before release. Production release candidates must pass root and GitHub Pages builds plus the MA3/MA4 and release32 gates.
