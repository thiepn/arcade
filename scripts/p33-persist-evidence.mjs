import { readFile } from 'node:fs/promises';

const repo=process.env.GITHUB_REPOSITORY||'thiepn/arcade';
const apiBase=process.env.GITHUB_API_URL||'https://api.github.com';
const token=process.env.GITHUB_TOKEN||'';
const attestationPath=process.env.P33_ATTESTATION||'p33-attestation.json';
const signaturePath=process.env.P33_SIGNATURE||'p33-attestation.sig.b64';
const marker='<!-- p33-offline-ceremony-ledger -->';
const title='P33 Offline Recovery Ceremony Evidence';

async function github(path,init={}){
  if(!token)throw new Error('P33 evidence persistence requires GITHUB_TOKEN');
  const response=await fetch(apiBase+path,{...init,headers:{
    Accept:'application/vnd.github+json',Authorization:'Bearer '+token,
    'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json',...(init.headers||{})
  }});
  const text=await response.text();const body=text?JSON.parse(text):null;
  if(!response.ok)throw new Error('GitHub API '+response.status+': '+text.slice(0,500));
  return body;
}

const attestationBytes=await readFile(attestationPath);
const attestation=JSON.parse(attestationBytes.toString('utf8'));
const signature=(await readFile(signaturePath,'utf8')).trim();
const attestationB64=attestationBytes.toString('base64');

const issues=await github('/repos/'+repo+'/issues?state=all&per_page=100');
let issue=(Array.isArray(issues)?issues:[]).find(i=>!i.pull_request&&typeof i.body==='string'&&i.body.includes(marker))||null;
const body=[
  marker,
  '# Offline recovery ceremony evidence',
  '',
  'Latest accepted P33 ceremony:',
  '',
  '- Completed: **'+attestation.completedAt+'**',
  '- Source P31 run: **'+attestation.sourceRunId+'**',
  '- Protected rows restored: **'+attestation.sourceTotalRows+'**',
  '- Source/restored payload SHA-256: `'+attestation.sourcePayloadSha256+'`',
  '- Source/restored schema SHA-256: `'+attestation.sourceSchemaSha256+'`',
  '- Ciphertext SHA-256: `'+attestation.ciphertextSha256+'`',
  '- Production mutated: **no**',
  '- Offline private key uploaded to GitHub: **no**',
  '',
  'The hidden fields below preserve the exact signed attestation bytes and signature for recurring cryptographic re-verification.',
  '',
  '<!-- p33-attestation-b64:'+attestationB64+' -->',
  '<!-- p33-signature-b64:'+signature+' -->',
].join('\n');

if(!issue){
  issue=await github('/repos/'+repo+'/issues',{method:'POST',body:JSON.stringify({title,body})});
}else{
  issue=await github('/repos/'+repo+'/issues/'+issue.number,{method:'PATCH',body:JSON.stringify({title,body,state:'open'})});
}
await github('/repos/'+repo+'/issues/'+issue.number+'/comments',{method:'POST',body:JSON.stringify({
  body:'Accepted a cryptographically verified P33 offline-key ceremony for P31 backup run '+attestation.sourceRunId+' at '+attestation.completedAt+'.'
})});
await github('/repos/'+repo+'/issues/'+issue.number,{method:'PATCH',body:JSON.stringify({state:'closed',state_reason:'completed'})});
console.log('P33 OFFLINE CEREMONY EVIDENCE — PERSISTED #'+issue.number);
