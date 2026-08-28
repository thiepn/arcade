## Summary

Describe the change and why it is needed.

## Validation

- [ ] `bun install --frozen-lockfile` succeeds.
- [ ] `bun run quality:release32` passes.
- [ ] The complete CI workflow is green before merge.
- [ ] User-facing/runtime changes were tested at relevant desktop and mobile sizes.
- [ ] Controls documented in `src/data/games.ts` still match the implementation.
- [ ] No credentials, tokens, private keys, `.dev.vars`, or production secrets are committed.
- [ ] Changelog/release notes are updated when behavior visible to users changes.
- [ ] Temporary migration, patch, or diagnostic files have been removed.

## Release impact

- [ ] No release impact.
- [ ] Patch-level fix.
- [ ] Minor feature/change.
- [ ] Requires explicit migration/deployment notes.
