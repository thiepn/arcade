import { PRODUCTION_WORKFLOWS } from './p30-recovery-core.mjs';

async function deployJobSucceeded(github, run) {
  if (run?.conclusion === 'success') return true;
  if (!run?.id) return false;
  const body = await github('/repos/' + run.repository_full_name + '/actions/runs/' + run.id + '/jobs?per_page=100');
  const jobs = Array.isArray(body?.jobs) ? body.jobs : [];
  return jobs.some((job) => job.name === 'deploy' && job.conclusion === 'success');
}

export async function resolveProductionDeploymentRuns({
  repo,
  github,
  workflowRuns,
}) {
  const sets = await Promise.all(PRODUCTION_WORKFLOWS.map(async (file) => {
    const runs = await workflowRuns(file);
    return runs.map((run) => ({ ...run, repository_full_name: repo }));
  }));

  const candidates = sets.flat();
  const resolved = [];
  for (const run of candidates) {
    if (run?.conclusion === 'skipped' || run?.conclusion === 'cancelled') continue;
    if (await deployJobSucceeded(github, run)) {
      resolved.push({
        ...run,
        workflow_conclusion: run.conclusion,
        conclusion: 'success',
      });
    }
  }
  return resolved;
}
