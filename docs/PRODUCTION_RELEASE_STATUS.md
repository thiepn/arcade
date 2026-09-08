# Micro Arcade production release status — 2026-09-08

## Release candidate

Final source commit: `6ba317a71ef0beeb239b5e327e4592b8645a487c` (`Finalize production release pipeline (#71)`).

Main CI run `34267353201` passed the complete release suite, including all static/gameplay gates, TypeScript, local D1 migrations, Worker API smoke, release-candidate storage/contracts, Worker dry-run, root build, full browser gameplay certification, and root/Pages PWA integrity checks.

## Production gate

Production workflow run `34268165287` correctly failed closed before publishing Pages because the deployed leaderboard Worker still rejects the production origin `https://thiepn.dev`.

The source configuration already contains the corrected production origin. The remaining action is operational, not a source-code fix: deploy the Worker from the current `main` configuration.

The production workflow now supports automatic Worker deployment when these GitHub Actions values are configured:

- Secret: `CLOUDFLARE_API_TOKEN`
- Secret or repository variable: `CLOUDFLARE_ACCOUNT_ID`

After credentials exist, rerun the failed `Deploy Production` workflow. It will:

1. deploy the leaderboard Worker;
2. require a successful `OPTIONS /v1/guest` preflight from `https://thiepn.dev`;
3. require a healthy `/v1/health` response;
4. build and publish GitHub Pages only after the Worker passes;
5. run the live 32-game browser smoke against the deployed site.

Do not rotate `CREDENTIAL_PEPPER`, recreate D1, or reset production data for this deployment.

## Definition of final

The release is final for its intended casual-browser-arcade scope when `Deploy Production` passes all four jobs: `deploy-worker`, `build`, `deploy`, and `certify-live`.

Repository branch protection remains tracked separately in issue #20 and is governance hardening rather than an application release blocker.
