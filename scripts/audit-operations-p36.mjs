import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildControlPlaneManifest } from './p36-control-plane-core.mjs';

const root=resolve(process.cwd());
const errors=[];
const assert=(condition,message)=>{if(!condition)errors.push(message);};
const read=path=>readFileSync(join(root,path),'utf8');

const policy=JSON.parse(read('ops/p36-observation-integrity-policy.json'));
assert(policy.phase==='P36','P36 policy phase must be P36');
assert(policy.hashAlgorithm==='sha256','P36 control plane must use SHA-256');
assert(policy.rules?.bindControlPlaneAtEpochStart===true,'P36 must bind the control plane at epoch start');
assert(policy.rules?.invalidateEpochOnControlPlaneDrift===true,'P36 must invalidate an epoch on control-plane drift');
assert(policy.rules?.allowNonControlPlaneProductChanges===true,'P36 must allow non-control-plane product changes');
assert(policy.rules?.requireSuccessfulCurrentHeadCiBeforeEpochStart===true,'P36 must require current-head CI before epoch start');
assert(policy.rules?.forbidSameRunRestartAfterDetectedDrift===true,'P36 must forbid same-run restart after drift');
assert(policy.rules?.requireFingerprintOnP35Checkpoints===true,'P36 must bind P35 checkpoints to the fingerprint');
assert(policy.rules?.evidenceRetentionDays===90,'P36 evidence retention must be 90 days');
assert(/does not make the P35 evidence period an independent audit/i.test(policy.assuranceBoundary),'P36 assurance boundary is missing');
assert(Array.isArray(policy.controlPlanePaths)&&policy.controlPlanePaths.length>=70,'P36 control plane is unexpectedly small');
assert(new Set(policy.controlPlanePaths).size===policy.controlPlanePaths.length,'P36 control-plane paths must be unique');

for(const required of [
  '.github/workflows/ci.yml',
  '.github/workflows/pages.yml',
  '.github/workflows/p35-operating-effectiveness.yml',
  '.github/workflows/p36-observation-integrity.yml',
  'ops/p34-security-controls.json',
  'ops/p35-operating-effectiveness-policy.json',
  'ops/p36-observation-integrity-policy.json',
  'scripts/p34-control-assurance.mjs',
  'scripts/p35-operating-effectiveness.mjs',
  'scripts/p36-control-plane-core.mjs',
  'scripts/p36-observation-integrity.mjs',
  'scripts/audit-operations-p36.mjs',
  'scripts/test-observation-integrity-p36.mjs',
  'shared/scoringProtocol.ts',
  'worker/src/index.ts',
  'supabase/functions/micro-arcade-leaderboards/index.ts',
  'supabase/functions/micro-arcade-p31-backup-export/index.ts',
]){
  assert(policy.controlPlanePaths.includes(required),'P36 control plane missing required path '+required);
}
for(const path of policy.controlPlanePaths)assert(existsSync(join(root,path)),'P36 control-plane file missing '+path);

const manifest=buildControlPlaneManifest(root,policy.controlPlanePaths);
assert(manifest.missing.length===0,'P36 manifest contains missing files: '+manifest.missing.join(', '));
assert(/^[a-f0-9]{64}$/.test(manifest.fingerprint),'P36 aggregate fingerprint is invalid');
assert(manifest.files.every(file=>file.exists&&/^[a-f0-9]{64}$/.test(file.sha256||'')),'P36 per-file hashes are invalid');

const core=read('scripts/p36-control-plane-core.mjs');
for(const marker of ['buildControlPlaneManifest','diffControlPlaneManifests','checkpointChain','GENESIS']){
  assert(core.includes(marker),'P36 core missing '+marker);
}

const engine=read('scripts/p36-observation-integrity.mjs');
for(const marker of ['WAITING_FOR_EPOCH','OBSERVING_STABLE_BASELINE','EVIDENCE_INTEGRITY_DEFICIENT','DRIFT_DETECTED','EPOCH_CERTIFIED_STABLE','p36-observation-integrity-readiness']){
  assert(engine.includes(marker),'P36 live engine missing '+marker);
}
assert(!/SUPABASE_SERVICE_ROLE_KEY|privateKeyPem|recoveryPrivateKey|DATABASE_URL/i.test(engine),'P36 must not ingest backend or recovery secrets');

const p35=read('scripts/p35-operating-effectiveness.mjs');
assert(p35.includes("from './p36-control-plane-core.mjs'"),'P35 does not consume P36 control-plane core');
assert(p35.includes("ops/p36-observation-integrity-policy.json"),'P35 does not load the P36 policy');
assert(p35.includes('controlPlaneFingerprint:currentControlPlane.fingerprint'),'P35 epoch does not freeze the P36 fingerprint');
assert(p35.includes('controlPlaneManifest:currentControlPlane'),'P35 epoch does not freeze the P36 manifest');
assert(p35.includes('P36 control-plane fingerprint changed during observation'),'P35 does not invalidate on P36 drift');
assert(p35.includes('currentHeadCiReady'),'P35 does not verify current-head CI before epoch start');
assert(p35.includes('baseline.startReady'),'P35 does not gate epoch start on the qualified baseline');
assert(p35.includes('Control-plane fingerprint: '),'P35 checkpoints do not bind the P36 fingerprint');

const p35Workflow=read('.github/workflows/p35-operating-effectiveness.yml');
assert(p35Workflow.includes("'.github/workflows/**'"),'P35 does not rerun on control-plane workflow changes');
assert(p35Workflow.includes("'ops/p36-observation-integrity-policy.json'"),'P35 does not rerun on P36 policy changes');
assert(p35Workflow.includes("'scripts/p36-*'"),'P35 does not rerun on P36 implementation changes');
assert(p35Workflow.includes("'shared/scoringProtocol.ts'"),'P35 does not rerun on scoring trust-boundary changes');
assert(p35Workflow.includes("'worker/src/index.ts'"),'P35 does not rerun on Worker trust-boundary changes');

const workflow=read('.github/workflows/p36-observation-integrity.yml');
assert(workflow.includes("cron: '3 7 * * *'"),'P36 daily schedule is missing');
assert(workflow.includes('contents: read')&&workflow.includes('actions: read')&&workflow.includes('issues: write'),'P36 permissions are not explicit/minimal');
assert(!workflow.includes('write-all'),'P36 workflow must not request write-all');
assert(workflow.includes('retention-days: 90'),'P36 evidence retention must be 90 days');
assert(workflow.includes('actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'),'P36 checkout must be immutable');
assert(workflow.includes('oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6'),'P36 setup-bun must be immutable');
assert(workflow.includes('actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02'),'P36 upload-artifact must be immutable');

const doc=read('docs/P36_OBSERVATION_INTEGRITY.md');
assert(/does not constitute external certification/i.test(doc),'P36 documentation must deny external certification');
assert(/cryptographic fingerprint/i.test(doc),'P36 documentation must describe the baseline fingerprint');
assert(/does not start a replacement epoch in the same run/i.test(doc),'P36 documentation must forbid same-run restart after drift');

const pkg=JSON.parse(read('package.json'));
assert(pkg.scripts?.['quality:gameplay-p36']?.includes('audit-operations-p36.mjs'),'quality:gameplay-p36 is missing');
assert(pkg.scripts?.['quality:gameplay-p36']?.includes('test-observation-integrity-p36.mjs'),'P36 deterministic tests are missing from quality gate');

const ci=read('.github/workflows/ci.yml');
assert(ci.includes('bun run quality:gameplay-p36'),'CI does not enforce P36');

if(errors.length){
  console.error('P36 OBSERVATION-INTEGRITY / CHANGE-CONTROL AUDIT — FAIL');
  for(const error of errors)console.error('- '+error);
  process.exit(1);
}
console.log('P36 OBSERVATION-INTEGRITY / CHANGE-CONTROL AUDIT — PASS');
console.log('Frozen control-plane baselines, drift invalidation, current-head CI qualification and checkpoint fingerprint binding are permanently enforced.');
