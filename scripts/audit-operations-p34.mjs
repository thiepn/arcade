import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root=resolve(process.cwd());
const errors=[];
const assert=(condition,message)=>{if(!condition) errors.push(message);};
const read=(path)=>readFileSync(join(root,path),'utf8');

const catalog=JSON.parse(read('ops/p34-security-controls.json'));
const ids=catalog.controls.map(control=>control.id);
assert(catalog.phase==='P34','control catalog phase must be P34');
assert(catalog.controls.length===18,'P34 must define exactly 18 controls');
assert(new Set(ids).size===18,'P34 control IDs must be unique');
assert(ids.every((id,index)=>id==='SC-'+String(index+1).padStart(2,'0')),'P34 control IDs must be contiguous SC-01..SC-18');
assert(/does not certify compliance/i.test(catalog.assuranceBoundary),'catalog must explicitly deny external certification claims');

for(const control of catalog.controls){
  assert(Array.isArray(control.nist)&&control.nist.length>0,control.id+' missing NIST readiness mapping');
  assert(Array.isArray(control.soc2)&&control.soc2.length>0,control.id+' missing SOC 2 readiness mapping');
  assert(Array.isArray(control.evidence)&&control.evidence.length>0,control.id+' missing evidence mappings');
  for(const path of control.evidence) assert(existsSync(join(root,path)),control.id+' missing evidence file '+path);
  for(const requirement of control.workflowEvidence||[]) assert(existsSync(join(root,'.github/workflows',requirement.workflow)),control.id+' missing workflow '+requirement.workflow);
}

const workflow=read('.github/workflows/p34-continuous-assurance.yml');
assert(workflow.includes('contents: read')&&workflow.includes('actions: read')&&workflow.includes('issues: write'),'P34 workflow permissions are not explicit/minimal');
assert(!workflow.includes('write-all'),'P34 workflow must not request write-all');
assert(workflow.includes("cron: '29 6 * * *'"),'P34 daily schedule is missing');
assert(workflow.includes('bun scripts/p34-control-assurance.mjs'),'P34 live assurance command is missing');
assert(workflow.includes('retention-days: 90'),'P34 evidence retention must be 90 days');
assert(workflow.includes('actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'),'checkout must remain immutable');
assert(workflow.includes('oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6'),'setup-bun must remain immutable');
assert(workflow.includes('actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02'),'upload-artifact must remain immutable');

const assurance=read('scripts/p34-control-assurance.mjs');
assert(assurance.includes('p34-security-assurance-deficiency'),'P34 deficiency marker is missing');
assert(assurance.includes('does not constitute a SOC 2 report'),'P34 audit pack disclaimer is missing');
assert(!/SUPABASE_SERVICE_ROLE_KEY|privateKeyPem|recoveryPrivateKey/i.test(assurance),'P34 must not ingest backend or recovery private-key secrets');

const doc=read('docs/P34_SECURITY_CONTROL_ASSURANCE.md');
assert(/does not constitute external certification/i.test(doc),'P34 documentation must distinguish readiness evidence from external certification');
assert(/18 internal controls/i.test(doc),'P34 documentation must describe the 18-control catalog');

const pkg=JSON.parse(read('package.json'));
assert(pkg.scripts?.['quality:gameplay-p34']?.includes('audit-operations-p34.mjs'),'quality:gameplay-p34 is missing');
assert(pkg.scripts?.['quality:assurance-p34']?.includes('p34-control-assurance.mjs'),'quality:assurance-p34 is missing');

const ci=read('.github/workflows/ci.yml');
assert(ci.includes('bun run quality:gameplay-p34'),'CI does not enforce P34');

if(errors.length){
  console.error('P34 SECURITY CONTROL / ASSURANCE AUDIT — FAIL');
  for(const error of errors) console.error('- '+error);
  process.exit(1);
}
console.log('P34 SECURITY CONTROL / ASSURANCE AUDIT — PASS');
console.log('18 controls, framework-readiness mappings, evidence paths, live assurance workflow, deficiency ledger and non-certification boundary are permanently enforced.');
