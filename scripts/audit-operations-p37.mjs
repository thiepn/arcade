import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root=resolve(process.cwd());
const errors=[];
const assert=(condition,message)=>{if(!condition)errors.push(message);};
const read=path=>readFileSync(join(root,path),'utf8');

const policy=JSON.parse(read('ops/p37-remediation-activation-policy.json'));
assert(policy.phase==='P37','P37 policy phase must be P37');
assert(policy.mainProtection?.requireActiveRuleset===true,'P37 must require an active ruleset');
assert(policy.mainProtection?.operatorMustAvoidBypassActors===true,'P37 operator contract must forbid bypass actors');
assert(policy.mainProtection?.machineVerifiableBypassActors===false,'P37 must not falsely claim Actions can inspect bypass actors');
assert(policy.mainProtection?.requiredStatusCheck==='build','P37 must require the build status check');
assert(policy.mainProtection?.requireStrictStatusChecks===true,'P37 must require strict/up-to-date status checks');
assert(policy.mainProtection?.requireReviewThreadResolution===true,'P37 must require review-thread resolution');
assert(policy.p33?.attestationMaxAgeHours===2160,'P37 P33 attestation ceiling must remain 90 days');
assert(policy.p33?.assuranceMaxAgeHours===30,'P37 P33 assurance freshness must remain 30 hours');
assert(policy.p34?.assuranceMaxAgeHours===30,'P37 P34 assurance freshness must remain 30 hours');
assert(Array.isArray(policy.workflowChain)&&policy.workflowChain.join(',')==='p33-long-term-assurance.yml,p34-continuous-assurance.yml,p35-operating-effectiveness.yml,p36-observation-integrity.yml','P37 workflow chain is incorrect');
assert(policy.evidenceRetentionDays===90,'P37 evidence retention must remain 90 days');
assert(/cannot create the offline recovery-key proof or repository administration policy itself/i.test(policy.assuranceBoundary),'P37 assurance boundary is missing');

for(const path of [
  'scripts/p37-remediation-core.mjs',
  'scripts/p37-remediation-qualification.mjs',
  'scripts/p37-dispatch-workflow.mjs',
  'scripts/test-remediation-activation-p37.mjs',
  'docs/P37_REMEDIATION_ACTIVATION.md',
  '.github/workflows/p37-remediation-activation.yml',
])assert(existsSync(join(root,path)),'P37 artifact missing '+path);

const core=read('scripts/p37-remediation-core.mjs');
for(const marker of ['WAITING_MAIN_PROTECTION','WAITING_OFFLINE_CEREMONY','WAITING_P33_RECONCILIATION','WAITING_P34_RECONCILIATION','WAITING_CURRENT_HEAD_CI','CONTROL_PLANE_DEFICIENT','ACTIVATION_READY','FIRST_EPOCH_ACTIVATED']){
  assert(core.includes(marker),'P37 state machine missing '+marker);
}
assert(core.includes("required_review_thread_resolution"),'P37 ruleset check must verify review-thread resolution');
assert(core.includes("strict_required_status_checks_policy"),'P37 ruleset check must verify strict status checks');
assert(core.includes('evaluateEffectiveMainRules'),'P37 must evaluate the effective rules applied to main');
assert(core.includes("non_fast_forward")&&core.includes("deletion")&&core.includes("pull_request")&&core.includes("required_status_checks"),'P37 ruleset check is incomplete');

const qualification=read('scripts/p37-remediation-qualification.mjs');
for(const marker of ['p33-offline-attestation.yml','p33-long-term-assurance.yml','p34-continuous-assurance.yml','ci.yml','rulesets','/rules/branches/main']){
  assert(qualification.includes(marker),'P37 qualification missing '+marker);
}
assert(policy.p35?.ledgerMarker==='<!-- p35-operating-effectiveness-ledger -->','P37 policy must bind the canonical P35 ledger marker');
assert(qualification.includes('p35LedgerMarker'),'P37 qualification must consume the P35 ledger marker from policy');
assert(qualification.includes('state_reason')&&qualification.includes('mainProtectionIssue'),'P37 must close the SC-01 tracker only after verification');
assert(qualification.includes('P37_REQUIRE_EPOCH'),'P37 must fail if attempted activation creates no epoch');
assert(!/SUPABASE_SERVICE_ROLE_KEY|privateKeyPem|recoveryPrivateKey|DATABASE_URL/i.test(qualification),'P37 qualification must not ingest backend or recovery secrets');

const dispatch=read('scripts/p37-dispatch-workflow.mjs');
assert(dispatch.includes('/dispatches'),'P37 sequencer must use workflow_dispatch');
assert(dispatch.includes("event=workflow_dispatch"),'P37 sequencer must bind to the dispatched run');
assert(dispatch.includes("run.conclusion!=='success'"),'P37 sequencer must require successful downstream workflows');
assert(!/SUPABASE_SERVICE_ROLE_KEY|privateKeyPem|recoveryPrivateKey|DATABASE_URL/i.test(dispatch),'P37 sequencer must not ingest backend or recovery secrets');

const workflow=read('.github/workflows/p37-remediation-activation.yml');
assert(workflow.includes("cron: '17 */6 * * *'"),'P37 six-hour fallback schedule is missing');
assert(workflow.includes('P33 Offline Ceremony Attestation'),'P37 must react to accepted ceremony workflow completion');
assert(workflow.includes('      - CI'),'P37 must requalify immediately after main CI completion');
assert(workflow.includes('contents: read')&&workflow.includes('actions: write')&&workflow.includes('issues: write'),'P37 permissions are not explicit');
assert(!workflow.includes('write-all'),'P37 workflow must not request write-all');
for(const name of [
  'Reconcile P33 long-term assurance',
  'Reconcile P34 security assurance',
  'Activate first P35 evidence epoch',
  'Verify first epoch with P36',
  'Publish final qualification and certify activation',
])assert(workflow.includes(name),'P37 workflow missing step '+name);
assert((workflow.match(/P37_MUTATE_ISSUES: '1'/g)||[]).length===1,'P37 readiness publishing must mutate issues exactly once per workflow run');
assert(workflow.includes('P37_REQUIRE_EPOCH: ${{ steps.activation.outputs.activation_ready }}'),'P37 final qualification must require an epoch only when activation was attempted');
assert(workflow.includes('retention-days: 90'),'P37 evidence retention must be 90 days');
assert(workflow.includes('actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'),'P37 checkout must remain immutable');
assert(workflow.includes('oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6'),'P37 setup-bun must remain immutable');
assert(workflow.includes('actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02'),'P37 upload-artifact must remain immutable');

const p36Policy=JSON.parse(read('ops/p36-observation-integrity-policy.json'));
for(const path of [
  '.github/workflows/p37-remediation-activation.yml',
  'ops/p37-remediation-activation-policy.json',
  'scripts/p37-remediation-core.mjs',
  'scripts/p37-remediation-qualification.mjs',
  'scripts/p37-dispatch-workflow.mjs',
  'scripts/audit-operations-p37.mjs',
  'scripts/test-remediation-activation-p37.mjs',
])assert(p36Policy.controlPlanePaths.includes(path),'P36 frozen control plane missing P37 path '+path);

const p35Workflow=read('.github/workflows/p35-operating-effectiveness.yml');
const p36Workflow=read('.github/workflows/p36-observation-integrity.yml');
for(const source of [p35Workflow,p36Workflow]){
  assert(source.includes("'ops/p37-remediation-activation-policy.json'"),'P35/P36 must react to P37 policy changes');
  assert(source.includes("'scripts/p37-*'"),'P35/P36 must react to P37 implementation changes');
}

const doc=read('docs/P37_REMEDIATION_ACTIVATION.md');
assert(/does \*\*not\*\* weaken or bypass/i.test(doc),'P37 documentation must forbid bypassing blockers');
assert(/first.*P35 operating-effectiveness epoch/i.test(doc),'P37 documentation must describe first-epoch activation');
assert(/does not constitute external certification/i.test(doc),'P37 documentation must deny external certification');

const pkg=JSON.parse(read('package.json'));
assert(pkg.scripts?.['quality:gameplay-p37']?.includes('audit-operations-p37.mjs'),'quality:gameplay-p37 is missing');
assert(pkg.scripts?.['quality:gameplay-p37']?.includes('test-remediation-activation-p37.mjs'),'P37 deterministic tests are missing from quality gate');

const ci=read('.github/workflows/ci.yml');
assert(ci.includes('bun run quality:gameplay-p37'),'CI does not enforce P37');

if(errors.length){
  console.error('P37 REMEDIATION / CLEAN-BASELINE / FIRST-EPOCH AUDIT — FAIL');
  for(const error of errors)console.error('- '+error);
  process.exit(1);
}
console.log('P37 REMEDIATION / CLEAN-BASELINE / FIRST-EPOCH AUDIT — PASS');
console.log('Ruleset qualification, P33/P34 reconciliation, exact-head CI gating, canonical P35 activation and P36 verification are permanently enforced.');
