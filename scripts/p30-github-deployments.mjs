import { PRODUCTION_WORKFLOWS, deploymentWasPublished } from './p30-recovery-core.mjs';

async function deployJobSucceeded(github, run) {
  if (deploymentWasPublished(run)) return true;
  if (!run?.id) return false;
  const body = await github('/repos/' + run.repository_full_name + '/actions/runs/' + run.id + '/jobs?per_page=100');
  const jobs = Array.isArray(body?.jobs) ? body.jobs : [];
  const deploy = jobs.find((job) => job.name === 'deploy');
  return deploymentWasPublished(run, deploy?.conclusion || null);
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
