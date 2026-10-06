# P32 — Final Release Closure & Maintenance Mode

Date: 2026-10-06.

## Purpose

P32 closes the P27–P32 product-completion roadmap. It is a release/documentation/qualification phase, not a new product-feature phase.

Arcade enters P32 from a deployed green P31 baseline:

- P31 merge commit on main: `056665ff5113527c0b0f6ea2bea02de232677d85`;
- post-merge main CI #824: success;
- production deployment #335: success;
- P31 PR qualification CI #823: success.

Those runs establish the pre-P32 product baseline. P32 still has to pass its own PR/main/deployment gates before closure is final.

## Release identity

P32 freezes the completed product as **Micro Arcade 1.2.0**.

The minor version reflects the product additions completed after the 1.1.1 baseline:

- P28 daily challenge and streak return loop;
- P29 surfaced progression and goal-aware home;
- P30 results-to-meta/replay motivation;
- P31 final motion/audio/device UX pass;
- P32 final release closure.

The 32-game roster, scoring v2 economy and leaderboard v3 protocol remain unchanged by P32.

## Production backend truth

Production competitive services use **Supabase Edge Functions + PostgreSQL** under leaderboard protocol v3.

The retained Cloudflare Worker/D1 implementation is legacy reference/regression code. It remains useful for historical parity and compatibility tests, but it is not the production leaderboard deployment target. P32 removes README wording that could imply otherwise.

## Final production certification

The production Pages workflow already gates deployment on:

- successful `main` CI for the exact commit;
- live Supabase health/CORS/database reads;
- Pages build of that exact CI-certified commit;
- P26 production artifact certification;
- MA3 PWA/offline/mobile certification;
- MA4 release/accessibility/code-splitting certification;
- live responsive/header smoke;
- live P3 gameplay smoke;
- live P26 32-game/replacement smoke.

P32 adds the P31 device-class browser matrix to the **live deployed Pages URL**, covering desktop, phone portrait, phone landscape and tablet with reduced-motion/touch checks.

## Maintenance mode

After P32 merges and its exact main commit passes CI and production deployment, the phase roadmap is closed.

Future work should enter only through one of these reasons:

1. a reproducible defect;
2. a security/reliability issue affecting the shipped product;
3. a dependency/platform compatibility requirement;
4. a concrete requested product feature with clear user value;
5. a deliberate scoring/leaderboard version change with its own migration/versioning plan.

Do not create P33 merely because P32 is complete. Do not restart the earlier operational-governance detour without a concrete requirement.

## Maintenance rules

- Keep existing permanent regression gates unless they are replaced by stronger equivalent coverage.
- Prefer small defect/feature PRs over new numbered phases.
- Do not silently change scoring v2, leaderboard protocol v3, rating policy IDs or historical certification ledgers.
- Do not deploy the legacy Cloudflare/D1 leaderboard as the production v3 service.
- Preserve local/offline gameplay when live competition services are unavailable.
- Production deployment continues only from successful `main` CI through the existing Pages workflow.

## P32 exit criteria

P32 is complete only when:

- package/release documentation identifies version 1.2.0;
- README backend/deployment guidance matches the actual Supabase v3 production architecture;
- P32 structural closure audit is a permanent CI/release32 gate;
- live deployment runs the P31 device-class acceptance against the deployed URL;
- full PR CI passes;
- the exact merged main commit passes CI;
- the exact merged main commit passes production deployment/live certification;
- the P27–P32 roadmap is marked closed and maintenance mode is documented.

No P33 is scheduled.
