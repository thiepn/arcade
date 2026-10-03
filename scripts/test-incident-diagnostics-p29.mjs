import {
  RUNBOOKS,
  assessControlPlaneFreshness,
  assessRecovery,
  classifyFailures,
  computeSlo,
  deploymentCorrelation,
} from './p29-incident-core.mjs';

const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const now = Date.parse('2026-10-03T12:00:00Z');
const makeRun = (hoursAgo, conclusion = 'success', event = 'schedule') => ({
  event,
  conclusion,
  created_at: new Date(now - hoursAgo * 3_600_000).toISOString(),
  completed_at: new Date(now - hoursAgo * 3_600_000 + 60_000).toISOString(),
});

assert(classifyFailures(['site-root: HTTP 500']).includes('pages-artifact'), 'site-root must classify as pages-artifact');
assert(classifyFailures(['api-cors: origin rejected']).includes('cors'), 'api-cors must classify as cors');
assert(classifyFailures(['api-health: wrong policy']).includes('backend-health'), 'api-health must classify as backend-health');
assert(classifyFailures(['api-weekly: invalid JSON']).includes('leaderboard-read-path'), 'api-weekly must classify as leaderboard-read-path');
assert(classifyFailures(['mystery']).includes('unknown-production-contract'), 'unknown failure must remain classifiable');
assert(Object.values(RUNBOOKS).every((runbook) => runbook.path.startsWith('docs/runbooks/P29_')), 'all classifications must map to P29 runbooks');

const greenRuns = Array.from({ length: 12 }, (_, index) => makeRun(index * 6));
const greenSlo = computeSlo(greenRuns, now, { targetPct: 99, minCheckpoints: 12, recoveryStreakRequired: 2 });
assert(greenSlo.established, '12 scheduled checkpoints must establish the SLO');
assert(greenSlo.successPct === 100, 'all-green checkpoint history must be 100%');
assert(!greenSlo.breach, 'all-green checkpoint history must not breach');
assert(greenSlo.scheduledRecovery, 'two latest green checkpoints must satisfy recovery streak');

const oneFailureRuns = [...greenRuns];
oneFailureRuns[5] = makeRun(30, 'failure');
const failedSlo = computeSlo(oneFailureRuns, now, { targetPct: 99, minCheckpoints: 12, recoveryStreakRequired: 2 });
assert(failedSlo.breach, 'one failure in twelve must breach a 99% checkpoint SLO');
assert(failedSlo.errorBudgetRemaining === 0, 'small 99% window must not invent unused failure budget');

const warming = computeSlo(greenRuns.slice(0, 2), now, { targetPct: 99, minCheckpoints: 12, recoveryStreakRequired: 2 });
assert(!warming.established && !warming.breach, 'two checkpoints must remain warming rather than certified/breached');

const correlation = deploymentCorrelation(
  new Date(now).toISOString(),
  [{ conclusion: 'success', completed_at: new Date(now - 60 * 60 * 1000).toISOString() }],
);
assert(correlation.deploymentAdjacent, 'deployment one hour before probe should be marked adjacent correlation');

const freshness = assessControlPlaneFreshness({
  nowMs: now,
  p27Runs: [makeRun(6)],
  p28Runs: [{ conclusion: 'success', completed_at: new Date(now - 5 * 3_600_000).toISOString() }],
});
assert(freshness.p27Fresh && freshness.p28Fresh, 'six-hour control-plane evidence must be fresh inside eight-hour guardrail');

const probe = {
  phase: 'P27',
  syntheticOnly: true,
  status: 'healthy',
  sampleCount: 3,
  failures: [],
  warnings: [],
};
const recovery = assessRecovery({
  openIncident: { number: 42 },
  independentProbe: probe,
  slo: greenSlo,
  latestP28: { conclusion: 'success' },
  latestDeployment: { conclusion: 'success' },
  controlPlaneFresh: true,
});
assert(recovery.verified, 'healthy 3-sample probe + green streak + healthy controls must verify recovery');

const degradedRecovery = assessRecovery({
  openIncident: { number: 42 },
  independentProbe: { ...probe, status: 'degraded', warnings: ['retry'] },
  slo: greenSlo,
  latestP28: { conclusion: 'success' },
  latestDeployment: { conclusion: 'success' },
  controlPlaneFresh: true,
});
assert(!degradedRecovery.verified, 'degraded independent probe must not close an incident');

const staleRecovery = assessRecovery({
  openIncident: { number: 42 },
  independentProbe: probe,
  slo: greenSlo,
  latestP28: { conclusion: 'success' },
  latestDeployment: { conclusion: 'success' },
  controlPlaneFresh: false,
});
assert(!staleRecovery.verified, 'stale monitoring evidence must block automated recovery closure');

if (errors.length) {
  console.error('P29 INCIDENT DIAGNOSTIC CORE TEST — FAIL');
  for (const error of errors) console.error('- ' + error);
  process.exit(1);
}
console.log('P29 INCIDENT DIAGNOSTIC CORE TEST — PASS');
console.log('Classification, SLO math, deployment correlation, control-plane freshness and independent recovery verification are deterministic.');
