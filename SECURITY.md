# Security Policy

## Supported versions

Security fixes are applied to the current production release on `main`. Older release snapshots are not maintained as separate supported branches.

## Reporting a vulnerability

Do not open a public issue for a suspected security vulnerability, leaked credential, authentication weakness, leaderboard abuse path, or other report that could put users or infrastructure at risk.

Use GitHub's **Report a vulnerability** / private security-advisory flow for this repository. Include the affected surface, reproduction steps, expected impact, and any safe proof-of-concept details needed to verify the report.

Do not include real credentials, access tokens, production secrets, or personal data in a report. Use redacted or synthetic values.

## Scope

Security-sensitive surfaces include the Cloudflare Worker and D1 leaderboard API, guest credentials and play sessions, score validation, PWA/service-worker behavior, dependency supply chain, GitHub Actions workflows, and any code path that handles externally supplied data.

## Release handling

Security fixes must pass the normal CI and `quality:release32` gates. A security fix that changes production behavior should also receive an appropriate changelog entry before release.
