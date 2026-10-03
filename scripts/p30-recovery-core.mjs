export const PRODUCTION_WORKFLOWS = Object.freeze(['pages.yml', 'p30-guarded-rollback.yml']);

export function runTimestamp(run) {
  return Date.parse(run?.completed_at || run?.updated_at || run?.created_at || '');
}

export function successfulDeployments(runs = []) {
  return runs
    .filter((run) =>
      run &&
      run.conclusion === 'success' &&
      typeof run.head_sha === 'string' &&
      /^[0-9a-f]{40}$/i.test(run.head_sha) &&
      Number.isFinite(runTimestamp(run))
    )
    .sort((a, b) => runTimestamp(b) - runTimestamp(a));
}

export function uniqueDeploymentHistory(runs = []) {
  const seen = new Set();
  return successfulDeployments(runs).filter((run) => {
    const sha = run.head_sha.toLowerCase();
    if (seen.has(sha)) return false;
    seen.add(sha);
    return true;
  });
}

export function selectRollbackCandidate(runs = []) {
  const history = uniqueDeploymentHistory(runs);
  const current = history[0] || null;
  const candidate = history.find((run) => run.head_sha !== current?.head_sha) || null;
  return { current, candidate, history };
}

export function hasSuccessfulCi(ciRuns = [], sha) {
  return ciRuns.some((run) =>
    run?.conclusion === 'success' &&
    run?.head_sha === sha &&
    run?.event === 'push'
  );
}

export function validateRollbackAuthorization({
  targetSha,
  confirmSha,
  deploymentRuns,
  ciRuns,
}) {
  const errors = [];
  const normalizedTarget = String(targetSha || '').trim().toLowerCase();
  const normalizedConfirm = String(confirmSha || '').trim().toLowerCase();

  if (!/^[0-9a-f]{40}$/.test(normalizedTarget)) errors.push('target SHA must be an exact 40-character Git commit SHA');
  if (normalizedConfirm !== normalizedTarget) errors.push('confirmation SHA must exactly equal the target SHA');

  const history = uniqueDeploymentHistory(deploymentRuns);
  const current = history[0] || null;
  const target = history.find((run) => run.head_sha.toLowerCase() === normalizedTarget) || null;

  if (!current) errors.push('no successful production deployment history is available');
  if (current?.head_sha.toLowerCase() === normalizedTarget) errors.push('target SHA is already the currently deployed production SHA');
  if (!target) errors.push('target SHA is not present in successful production deployment history');
  if (target && !hasSuccessfulCi(ciRuns, target.head_sha)) errors.push('target SHA has no successful main push CI evidence');

  return {
    authorized: errors.length === 0,
    errors,
    targetSha: normalizedTarget || null,
    currentSha: current?.head_sha || null,
    targetRun: target,
    currentRun: current,
  };
}

export function assessContinuity({
  selection,
  candidateBuildOutcome,
  liveProbe,
  latestP29,
}) {
  const candidateSelected = Boolean(selection?.candidate?.head_sha);
  const candidateDistinct = candidateSelected && selection?.candidate?.head_sha !== selection?.current?.head_sha;
  const candidateBuilt = candidateBuildOutcome === 'success';
  const liveHealthy =
    liveProbe?.phase === 'P27' &&
    liveProbe?.syntheticOnly === true &&
    liveProbe?.status === 'healthy' &&
    Number(liveProbe?.sampleCount) >= 3 &&
    (liveProbe?.failures || []).length === 0 &&
    (liveProbe?.warnings || []).length === 0;
  const operationsHealthy = latestP29?.conclusion === 'success';

  return {
    ready: Boolean(candidateSelected && candidateDistinct && candidateBuilt && liveHealthy && operationsHealthy),
    candidateSelected,
    candidateDistinct,
    candidateBuilt,
    liveHealthy,
    operationsHealthy,
  };
}
