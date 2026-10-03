import {
  assessContinuity,
  hasSuccessfulCi,
  selectRollbackCandidate,
  uniqueDeploymentHistory,
  validateRollbackAuthorization,
} from './p30-recovery-core.mjs';

const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const now = Date.parse('2026-10-03T08:00:00Z');
const shaA = 'a'.repeat(40);
const shaB = 'b'.repeat(40);
const shaC = 'c'.repeat(40);
const run = (sha, minutesAgo, conclusion = 'success', name = 'Deploy Production') => ({
  head_sha: sha,
  conclusion,
  name,
  completed_at: new Date(now - minutesAgo * 60_000).toISOString(),
});

const deployments = [
  run(shaA, 5),
  run(shaA, 10, 'success', 'P30 Guarded Rollback'),
  run(shaB, 60),
  run(shaC, 120, 'failure'),
];
const selected = selectRollbackCandidate(deployments);
assert(selected.current?.head_sha === shaA, 'latest successful deployment must be current production');
assert(selected.candidate?.head_sha === shaB, 'candidate must be previous distinct successful production SHA');
assert(uniqueDeploymentHistory(deployments).length === 2, 'duplicate SHA deployments and failed runs must not inflate history');

const ciRuns = [
  { head_sha: shaA, event: 'push', conclusion: 'success' },
  { head_sha: shaB, event: 'push', conclusion: 'success' },
];
assert(hasSuccessfulCi(ciRuns, shaB), 'known-good rollback candidate must retain successful push CI evidence');

const auth = validateRollbackAuthorization({
  targetSha: shaB,
  confirmSha: shaB,
  deploymentRuns: deployments,
  ciRuns,
});
assert(auth.authorized, 'previous successful production SHA with CI and exact confirmation must authorize');

const mismatch = validateRollbackAuthorization({
  targetSha: shaB,
  confirmSha: shaA,
  deploymentRuns: deployments,
  ciRuns,
});
assert(!mismatch.authorized, 'confirmation mismatch must reject rollback');

const currentTarget = validateRollbackAuthorization({
  targetSha: shaA,
  confirmSha: shaA,
  deploymentRuns: deployments,
  ciRuns,
});
assert(!currentTarget.authorized, 'currently deployed SHA must not be redeployed as a rollback');

const unknownTarget = validateRollbackAuthorization({
  targetSha: 'd'.repeat(40),
  confirmSha: 'd'.repeat(40),
  deploymentRuns: deployments,
  ciRuns,
});
assert(!unknownTarget.authorized, 'unseen production SHA must never be accepted as a rollback target');

const probe = { phase: 'P27', syntheticOnly: true, status: 'healthy', sampleCount: 3, failures: [], warnings: [] };
const continuity = assessContinuity({
  selection: selected,
  candidateBuildOutcome: 'success',
  liveProbe: probe,
  latestP29: { conclusion: 'success' },
});
assert(continuity.ready, 'known-good candidate + certified build + healthy live + healthy P29 must establish continuity readiness');

const failedBuild = assessContinuity({
  selection: selected,
  candidateBuildOutcome: 'failure',
  liveProbe: probe,
  latestP29: { conclusion: 'success' },
});
assert(!failedBuild.ready, 'failed rollback-candidate build must fail continuity readiness');

const warningProbe = assessContinuity({
  selection: selected,
  candidateBuildOutcome: 'success',
  liveProbe: { ...probe, warnings: ['retry'], status: 'degraded' },
  latestP29: { conclusion: 'success' },
});
assert(!warningProbe.ready, 'degraded live evidence must fail a continuity drill');

if (errors.length) {
  console.error('P30 DISASTER RECOVERY CORE TEST — FAIL');
  for (const error of errors) console.error('- ' + error);
  process.exit(1);
}
console.log('P30 DISASTER RECOVERY CORE TEST — PASS');
console.log('Known-good rollback selection, exact authorization and continuity-readiness decisions are deterministic.');
