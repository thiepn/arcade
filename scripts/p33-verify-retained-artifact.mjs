import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const attestationPath=process.env.P33_ATTESTATION||'p33-attestation.json';
const sourceDir=process.env.P33_SOURCE_DIR||'p33-source';
const outputDir=process.env.P33_REPORT_DIR||'p33-report';
const attestation=JSON.parse(await readFile(attestationPath,'utf8'));
const manifest=JSON.parse(await readFile(sourceDir+'/manifest.json','utf8'));
const cms=(await readdir(sourceDir)).filter(x=>x.endsWith('.cms'));
if(cms.length!==1)throw new Error('P33 retained source must contain exactly one CMS artifact');
const hash=createHash('sha256').update(await readFile(sourceDir+'/'+cms[0])).digest('hex');
const failures=[];
const check=(condition,message)=>{if(!condition)failures.push(message);};
check(manifest.format==='arcade-p31-offsite-evidence-v1','manifest format');
check(manifest.verification_ok===true,'P31 verification flag');
check(Number(manifest.run_id)===attestation.sourceRunId,'source run id');
check(manifest.ciphertext_sha256===attestation.ciphertextSha256,'ciphertext hash attestation');
check(hash===manifest.ciphertext_sha256,'retained ciphertext bytes');
check(manifest.payload_sha256===attestation.sourcePayloadSha256,'payload hash');
check(manifest.schema_sha256===attestation.sourceSchemaSha256,'schema hash');
check(Number(manifest.total_rows)===attestation.sourceTotalRows,'total rows');
check(manifest.captured_at===attestation.sourceCapturedAt,'capture timestamp');

if(process.env.GITHUB_TOKEN){
  const repo=process.env.GITHUB_REPOSITORY||'thiepn/arcade';
  const api=process.env.GITHUB_API_URL||'https://api.github.com';
  const response=await fetch(api+'/repos/'+repo+'/actions/runs/'+attestation.sourceRunId,{
    headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+process.env.GITHUB_TOKEN,'X-GitHub-Api-Version':'2022-11-28'}
  });
  if(!response.ok)failures.push('source workflow run lookup');
  else{
    const run=await response.json();
    check(run.name==='P31 Encrypted Offsite Backup','source workflow name');
    check(run.conclusion==='success','source workflow success');
    check(run.head_branch==='main','source workflow main branch');
  }
}
if(failures.length)throw new Error('P33 retained artifact verification failed: '+failures.join('; '));
const report={schemaVersion:1,phase:'P33',ok:true,sourceRunId:attestation.sourceRunId,ciphertextSha256:hash,payloadSha256:manifest.payload_sha256,schemaSha256:manifest.schema_sha256,totalRows:manifest.total_rows,capturedAt:manifest.captured_at};
await mkdir(outputDir,{recursive:true});
await writeFile(outputDir+'/retained-artifact.json',JSON.stringify(report,null,2)+'\n');
console.log('P33 RETAINED ENCRYPTED ARTIFACT — VERIFIED');
console.log('P31 run '+report.sourceRunId+'; '+report.totalRows+' rows; ciphertext hash exact.');
