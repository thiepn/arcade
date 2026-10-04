import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { assessLongTermAssurance, verifyAttestationSignature } from './p33-recovery-core.mjs';

const repo=process.env.GITHUB_REPOSITORY||'thiepn/arcade';
const apiBase=process.env.GITHUB_API_URL||'https://api.github.com';
const token=process.env.GITHUB_TOKEN||'';
const outputDir=process.env.P33_REPORT_DIR||'p33-report';
const certPem=await readFile(process.env.P33_RECOVERY_CERT||'ops/p31-backup-recovery-cert.pem','utf8');
const assuranceMarker='<!-- p33-long-term-dr-assurance -->';
const evidenceMarker='<!-- p33-offline-ceremony-ledger -->';

async function github(path,init={}){
  if(!token)throw new Error('P33 assurance requires GITHUB_TOKEN');
  const response=await fetch(apiBase+path,{...init,headers:{
    Accept:'application/vnd.github+json',Authorization:'Bearer '+token,
    'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json',...(init.headers||{})
  }});
  const text=await response.text();const body=text?JSON.parse(text):null;
  if(!response.ok)throw new Error('GitHub API '+response.status+': '+text.slice(0,500));
  return body;
}
async function latestSuccess(file){
  const body=await github('/repos/'+repo+'/actions/workflows/'+encodeURIComponent(file)+'/runs?status=completed&per_page=100');
  return (body.workflow_runs||[])
    .filter(r=>r.conclusion==='success'&&r.head_branch==='main')
    .sort((a,b)=>Date.parse(b.completed_at||b.updated_at||b.created_at)-Date.parse(a.completed_at||a.updated_at||a.created_at))[0]||null;
}

const [latestP31,latestP32,latestP33,issues]=await Promise.all([
  latestSuccess('p31-offsite-backup.yml'),
  latestSuccess('p32-cold-recovery.yml'),
  latestSuccess('p33-offline-attestation.yml'),
  github('/repos/'+repo+'/issues?state=all&per_page=100'),
]);

const evidenceIssue=(Array.isArray(issues)?issues:[]).find(i=>!i.pull_request&&typeof i.body==='string'&&i.body.includes(evidenceMarker))||null;
let attestation=null,signatureValid=false;
if(evidenceIssue){
  const a=evidenceIssue.body.match(/<!-- p33-attestation-b64:([A-Za-z0-9+/=]+) -->/);
  const s=evidenceIssue.body.match(/<!-- p33-signature-b64:([A-Za-z0-9+/=]+) -->/);
  if(a&&s){
    try{
      const bytes=Buffer.from(a[1],'base64');
      attestation=JSON.parse(bytes.toString('utf8'));
      signatureValid=verifyAttestationSignature(bytes,Buffer.from(s[1],'base64'),certPem);
    }catch{}
  }
}

const assessment=assessLongTermAssurance({latestP31,latestP32,latestP33,attestation,signatureValid,certPem});
const report={
  schemaVersion:1,phase:'P33',generatedAt:new Date().toISOString(),status:assessment.status,ready:assessment.ready,
  checks:assessment.checks,ages:assessment.ages,certValidUntil:assessment.certValidUntil,certRemainingMs:assessment.certRemainingMs,
  attestationErrors:assessment.attestationErrors,
  evidence:attestation?{
    completedAt:attestation.completedAt,sourceRunId:attestation.sourceRunId,sourceTotalRows:attestation.sourceTotalRows,
    payloadSha256:attestation.sourcePayloadSha256,schemaSha256:attestation.sourceSchemaSha256,ciphertextSha256:attestation.ciphertextSha256
  }:null,
  latestRuns:{
    p31:latestP31?{id:latestP31.id,completedAt:latestP31.completed_at}:null,
    p32:latestP32?{id:latestP32.id,completedAt:latestP32.completed_at}:null,
    p33:latestP33?{id:latestP33.id,completedAt:latestP33.completed_at}:null,
  },
};
await mkdir(outputDir,{recursive:true});
await writeFile(outputDir+'/assurance.json',JSON.stringify(report,null,2)+'\n');
const summary=[
  '# P33 long-term DR assurance',
  '',
  '- State: **'+report.status+'**',
  '- P31 encrypted backup fresh: **'+report.checks.p31Fresh+'**',
  '- P32 full-stack drill fresh: **'+report.checks.p32Fresh+'**',
  '- P33 signed offline ceremony fresh: **'+(report.checks.ceremonyFresh&&report.checks.signatureValid&&report.checks.attestationValid)+'**',
  '- Recovery certificate healthy: **'+report.checks.certificateHealthy+'**',
  '',
  report.status==='PENDING_OFFLINE_CEREMONY'
    ? 'No real offline-key ceremony has been accepted yet. This is a recovery-readiness gap, not a production outage.'
    : 'Signed offline-key evidence is cryptographically re-verified on every assurance run.',
].join('\n')+'\n';
await writeFile(outputDir+'/summary.md',summary);
if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,'\n'+summary,{flag:'a'});

let assuranceIssue=(Array.isArray(issues)?issues:[]).find(i=>!i.pull_request&&typeof i.body==='string'&&i.body.includes(assuranceMarker))||null;
if(!assessment.ready){
  const body=[
    assuranceMarker,
    '# Long-term disaster-recovery assurance is not ready',
    '',
    '- State: **'+assessment.status+'**',
    '- P31 backup fresh: **'+assessment.checks.p31Fresh+'**',
    '- P32 cold recovery fresh: **'+assessment.checks.p32Fresh+'**',
    '- P33 offline ceremony fresh/valid: **'+(assessment.checks.ceremonyFresh&&assessment.checks.signatureValid&&assessment.checks.attestationValid)+'**',
    '- Recovery certificate healthy: **'+assessment.checks.certificateHealthy+'**',
    '',
    assessment.status==='PENDING_OFFLINE_CEREMONY'
      ? 'Action: perform the first offline-key recovery ceremony and submit its signed attestation.'
      : 'Action: refresh the failed or expired DR evidence layer.',
    '',
    'This issue is about recovery readiness; it does not imply that production is currently unavailable.',
    '',
    'Runbook: docs/P33_OFFLINE_KEY_RECOVERY.md',
  ].join('\n');
  if(assuranceIssue){
    await github('/repos/'+repo+'/issues/'+assuranceIssue.number,{method:'PATCH',body:JSON.stringify({title:'P33 Long-Term DR Assurance',body,state:'open'})});
    console.error('P33 LONG-TERM DR ASSURANCE — '+assessment.status+' (issue #'+assuranceIssue.number+')');
  }else{
    assuranceIssue=await github('/repos/'+repo+'/issues',{method:'POST',body:JSON.stringify({title:'P33 Long-Term DR Assurance',body})});
    console.error('P33 LONG-TERM DR ASSURANCE — '+assessment.status+' (issue #'+assuranceIssue.number+' opened)');
  }
  process.exit(1);
}
if(assuranceIssue&&assuranceIssue.state!=='closed'){
  await github('/repos/'+repo+'/issues/'+assuranceIssue.number+'/comments',{method:'POST',body:JSON.stringify({body:'P33 assurance recovered: P31 backup, P32 cold exercise, signed offline-key ceremony, and certificate-health checks are all current.'})});
  await github('/repos/'+repo+'/issues/'+assuranceIssue.number,{method:'PATCH',body:JSON.stringify({state:'closed',state_reason:'completed'})});
}
console.log('P33 LONG-TERM DR ASSURANCE — READY');
