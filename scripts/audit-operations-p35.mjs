import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root=resolve(process.cwd());
const errors=[];
const assert=(condition,message)=>{if(!condition)errors.push(message);};
const read=path=>readFileSync(join(root,path),'utf8');

const policy=JSON.parse(read('ops/p35-operating-effectiveness-policy.json'));
assert(policy.phase==='P35','policy phase must be P35');
assert(policy.observation?.consecutiveDays===30,'P35 observation period must be 30 consecutive days');
assert(policy.observation?.minimumCleanDailyCheckpoints===28,'P35 must require at least 28 clean daily checkpoints');
assert(policy.observation?.maximumCheckpointGapHours===50,'P35 checkpoint gap ceiling must be 50 hours');
assert(Array.isArray(policy.remediation)&&policy.remediation.length===2,'P35 must define the two current baseline remediations');
assert(policy.remediation.some(item=>item.controlId==='SC-01'),'P35 must map SC-01 remediation');
assert(policy.remediation.some(item=>item.controlId==='SC-13'),'P35 must map SC-13 remediation');
assert(Array.isArray(policy.workflowPopulations)&&policy.workflowPopulations.length===10,'P35 must define ten operating populations');
assert(/not a SOC 2 report/i.test(policy.assuranceBoundary),'P35 assurance boundary is missing');

for(const item of policy.workflowPopulations){
  assert(existsSync(join(root,'.github/workflows',item.workflow)),'P35 workflow population missing '+item.workflow);
}
for(const path of [
  'scripts/p35-effectiveness-core.mjs',
  'scripts/test-operating-effectiveness-p35.mjs',
  'scripts/p35-operating-effectiveness.mjs',
  'docs/P35_OPERATING_EFFECTIVENESS.md',
  '.github/workflows/p35-operating-effectiveness.yml',
])assert(existsSync(join(root,path)),'P35 artifact missing '+path);

const source=read('scripts/p35-operating-effectiveness.mjs');
for(const marker of ['p35-operating-effectiveness-ledger','p35-audit-dry-run-readiness','p35-checkpoint:','REMEDIATION_REQUIRED','OBSERVATION_WARMING','INTERNAL_DRY_RUN_PASS']){
  assert(source.includes(marker),'P35 engine missing '+marker);
}
assert(source.includes("mainProtected")&&source.includes("p33-long-term-assurance.yml")&&source.includes("p34-continuous-assurance.yml"),'P35 baseline verification is incomplete');
assert(!/SUPABASE_SERVICE_ROLE_KEY|privateKeyPem|recoveryPrivateKey|DATABASE_URL/i.test(source),'P35 must not ingest backend or recovery secrets');

const workflow=read('.github/workflows/p35-operating-effectiveness.yml');
assert(workflow.includes("cron: '47 6 * * *'"),'P35 schedule is missing');
assert(workflow.includes('contents: read')&&workflow.includes('actions: read')&&workflow.includes('issues: write'),'P35 permissions are not explicit/minimal');
assert(!workflow.includes('write-all'),'P35 workflow must not request write-all');
assert(workflow.includes('retention-days: 90'),'P35 evidence retention must be 90 days');
assert(workflow.includes('actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'),'P35 checkout must be immutable');
assert(workflow.includes('oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6'),'P35 setup-bun must be immutable');
assert(workflow.includes('actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02'),'P35 upload-artifact must be immutable');

const doc=read('docs/P35_OPERATING_EFFECTIVENESS.md');
assert(/does not constitute external certification/i.test(doc),'P35 documentation must deny external certification');
assert(/30 consecutive days/i.test(doc),'P35 documentation must define the observation period');
assert(/does not start while either condition remains unresolved/i.test(doc),'P35 documentation must forbid premature observation');

const pkg=JSON.parse(read('package.json'));
assert(pkg.scripts?.['quality:gameplay-p35']?.includes('audit-operations-p35.mjs'),'quality:gameplay-p35 is missing');
assert(pkg.scripts?.['quality:gameplay-p35']?.includes('test-operating-effectiveness-p35.mjs'),'P35 deterministic tests are missing from quality gate');

const ci=read('.github/workflows/ci.yml');
assert(ci.includes('bun run quality:gameplay-p35'),'CI does not enforce P35');

if(errors.length){
  console.error('P35 OPERATING-EFFECTIVENESS / AUDIT DRY-RUN AUDIT — FAIL');
  for(const error of errors)console.error('- '+error);
  process.exit(1);
}
console.log('P35 OPERATING-EFFECTIVENESS / AUDIT DRY-RUN AUDIT — PASS');
console.log('Remediation gating, 30-day epoch policy, deterministic sampling, evidence retention and external-assurance boundary are permanently enforced.');
