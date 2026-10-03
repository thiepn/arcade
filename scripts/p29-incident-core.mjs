export const RUNBOOKS = Object.freeze({
  'pages-artifact': {
    path: 'docs/runbooks/P29_PAGES_ARTIFACT.md',
    owner: 'Pages / release artifact',
    firstActions: [
      'Compare the failing production probe with the latest successful Deploy Production SHA.',
      'Inspect the Pages build/deploy/certify-live jobs before changing application code.',
      'Verify asset-manifest.json, sw.js and manifest.webmanifest are from the same deployed build.',
    ],
  },
  cors: {
    path: 'docs/runbooks/P29_CORS.md',
    owner: 'Leaderboard edge / CORS contract',
    firstActions: [
      'Confirm the failing Origin and Access-Control-Allow-Origin values from the synthetic probe.',
      'Inspect production-origin allowlisting and Function response headers.',
      'Do not rotate credentials or change scoring policy for a CORS-only failure.',
    ],
  },
  'backend-health': {
    path: 'docs/runbooks/P29_BACKEND_HEALTH.md',
    owner: 'Supabase Function / protocol health',
    firstActions: [
      'Inspect /v3/health availability, backend, protocolVersion and policy hash independently.',
      'Correlate the failure with the latest successful deployment and backend changes.',
      'Keep scoring and leaderboard data unchanged until the health contract is understood.',
    ],
  },
  'leaderboard-read-path': {
    path: 'docs/runbooks/P29_LEADERBOARD_READ_PATH.md',
    owner: 'Leaderboard read path / database',
    firstActions: [
      'Separate overall and weekly endpoint failures and inspect their response contracts.',
      'Verify database/read-path health before any data repair.',
      'Preserve immutable score history and avoid destructive resets.',
    ],
  },
  'control-plane-stale': {
    path: 'docs/runbooks/P29_CONTROL_PLANE.md',
    owner: 'GitHub Actions monitoring control plane',
    firstActions: [
      'Inspect the latest P27 and P28 scheduled workflow conclusions and timestamps.',
      'Confirm the scheduled workflows still exist on main and are not disabled or permission-blocked.',
      'Restore monitoring evidence before declaring application recovery.',
    ],
  },
  'unknown-production-contract': {
    path: 'docs/runbooks/P29_UNKNOWN_CONTRACT.md',
    owner: 'Unclassified production contract',
    firstActions: [
      'Preserve the P27/P28/P29 evidence bundle before making changes.',
      'Reproduce the failing production request with the same origin and contract expectations.',
      'Classify the failure before attempting remediation.',
    ],
  },
});

export function classifyFailures(failures = []) {
  const categories = new Set();
  for (const failure of failures) {
    if (/site-root|asset-manifest|service-worker|webmanifest/.test(failure)) categories.add('pages-artifact');
    if (/api-cors/.test(failure)) categories.add('cors');
    if (/api-health/.test(failure)) categories.add('backend-health');
    if (/api-overall|api-weekly/.test(failure)) categories.add('leaderboard-read-path');
  }
  if (!categories.size && failures.length) categories.add('unknown-production-contract');
  return [...categories];
}

export function runTimestamp(run) {
  return Date.parse(run?.completed_at || run?.updated_at || run?.created_at || '');
}

export function computeSlo(runs, nowMs, {
  windowDays = 30,
  targetPct = 99,
  minCheckpoints = 12,
  recoveryStreakRequired = 2,
} = {}) {
  const cutoff = nowMs - windowDays * 86_400_000;
  const scheduled = (runs || [])
    .filter((run) => run.event === 'schedule' && Number.isFinite(runTimestamp(run)) && runTimestamp(run) >= cutoff)
    .sort((a, b) => runTimestamp(b) - runTimestamp(a));
  const successfulCheckpoints = scheduled.filter((run) => run.conclusion === 'success').length;
  const failedCheckpoints = scheduled.length - successfulCheckpoints;
  const successPct = scheduled.length ? Math.round((successfulCheckpoints / scheduled.length) * 10000) / 100 : null;
  const established = scheduled.length >= minCheckpoints;
  const breach = established && successPct !== null && successPct < targetPct;
  const allowedFailureFraction = 1 - targetPct / 100;
  const errorBudgetAllowed = Math.max(0, Math.floor(scheduled.length * allowedFailureFraction + 1e-9));
  const errorBudgetRemaining = Math.max(0, errorBudgetAllowed - failedCheckpoints);
  const recoverySlice = scheduled.slice(0, recoveryStreakRequired);
  const scheduledRecovery = recoverySlice.length >= recoveryStreakRequired && recoverySlice.every((run) => run.conclusion === 'success');
  return {
    windowDays,
    targetPct,
    minCheckpoints,
    recoveryStreakRequired,
    scheduled,
    totalCheckpoints: scheduled.length,
    successfulCheckpoints,
    failedCheckpoints,
    successPct,
    established,
    breach,
    errorBudgetAllowed,
    errorBudgetRemaining,
    scheduledRecovery,
    recoveryConclusions: recoverySlice.map((run) => run.conclusion),
  };
}

export function latestRun(runs, predicate = () => true) {
  return [...(runs || [])]
    .filter(predicate)
    .sort((a, b) => runTimestamp(b) - runTimestamp(a))[0] || null;
}

export function deploymentCorrelation(probeGeneratedAt, deploymentRuns, thresholdMs = 2 * 60 * 60 * 1000) {
  const probeMs = Date.parse(probeGeneratedAt || '');
  const deployments = (deploymentRuns || [])
    .filter((run) => Number.isFinite(runTimestamp(run)) && runTimestamp(run) <= probeMs)
    .sort((a, b) => runTimestamp(b) - runTimestamp(a));
  const latest = deployments[0] || null;
  const ageMs = latest && Number.isFinite(probeMs) ? Math.max(0, probeMs - runTimestamp(latest)) : null;
  return {
    latestDeployment: latest,
    ageMs,
    deploymentAdjacent: ageMs !== null && ageMs <= thresholdMs,
    thresholdMs,
  };
}

export function assessControlPlaneFreshness({ nowMs, p27Runs, p28Runs, maxAgeMs = 8 * 60 * 60 * 1000 }) {
  const latestP27 = latestRun(p27Runs, (run) => run.event === 'schedule');
  const latestP28 = latestRun(p28Runs);
  const p27AgeMs = latestP27 ? nowMs - runTimestamp(latestP27) : null;
  const p28AgeMs = latestP28 ? nowMs - runTimestamp(latestP28) : null;
  return {
    maxAgeMs,
    latestP27,
    latestP28,
    p27AgeMs,
    p28AgeMs,
    p27Fresh: p27AgeMs !== null && p27AgeMs >= 0 && p27AgeMs <= maxAgeMs,
    p28Fresh: p28AgeMs !== null && p28AgeMs >= 0 && p28AgeMs <= maxAgeMs,
  };
}

export function assessRecovery({
  openIncident,
  independentProbe,
  slo,
  latestP28,
  latestDeployment,
  controlPlaneFresh = true,
}) {
  const probeHealthy =
    independentProbe?.phase === 'P27' &&
    independentProbe?.syntheticOnly === true &&
    independentProbe?.status === 'healthy' &&
    Number(independentProbe?.sampleCount) >= 3 &&
    (independentProbe?.failures || []).length === 0 &&
    (independentProbe?.warnings || []).length === 0;

  const verified = Boolean(
    openIncident &&
    probeHealthy &&
    slo &&
    !slo.breach &&
    slo.scheduledRecovery &&
    latestP28?.conclusion === 'success' &&
    latestDeployment?.conclusion === 'success' &&
    controlPlaneFresh
  );

  return {
    verified,
    probeHealthy,
    noRollingBreach: Boolean(slo && !slo.breach),
    scheduledRecovery: Boolean(slo?.scheduledRecovery),
    latestP28Healthy: latestP28?.conclusion === 'success',
    latestDeploymentHealthy: latestDeployment?.conclusion === 'success',
    controlPlaneFresh: Boolean(controlPlaneFresh),
  };
}
