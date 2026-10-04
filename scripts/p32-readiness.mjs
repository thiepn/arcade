import { existsSync, readFileSync } from 'node:fs';

const repo=process.env.GITHUB_REPOSITORY||'thiepn/arcade';
const apiBase=process.env.GITHUB_API_URL||'https://api.github.com';
const token=process.env.GITHUB_TOKEN||'';
const reportPath=process.env.P32_CERTIFICATION||'p32-report/certification.json';
const marker='<!-- p32-fullstack-recovery-readiness -->';
const title='P32 Full-Stack Recovery Readiness';

async function github(path,init={}){
  if(!token)throw new Error('P32 readiness requires GITHUB_TOKEN');
  const response=await fetch(apiBase+path,{...init,headers:{
    Accept:'application/vnd.github+json',Authorization:'Bearer '+token,
    'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json',...(init.headers||{})
  }});
  const text=await response.text();const body=text?JSON.parse(text):null;
  if(!response.ok)throw new Error('GitHub API '+response.status+': '+text.slice(0,500));
  return body;
}
async function findIssue(){
  const issues=await github('/repos/'+repo+'/issues?state=open&per_page=100');
  return (Array.isArray(issues)?issues:[]).find(i=>!i.pull_request&&typeof i.body==='string'&&i.body.includes(marker))||null;
}
let report=null;
if(existsSync(reportPath)){try{report=JSON.parse(readFileSync(reportPath,'utf8'));}catch{}}
const healthy=report?.phase==='P32'&&report?.certified===true&&report?.failoverCandidateCertified===true&&report?.productionTrafficSwitched===false;
const existing=await findIssue();
if(!healthy){
  const body=[
    marker,
    '# Full-stack recovery readiness failure',
    '',
    'The latest P32 isolated cold-recovery exercise did not complete the full data → database → API → frontend certification.',
    '',
    '- Certification report: **'+(report?'present':'missing')+'**',
    '- Production traffic switched by drill: **no**',
    '- Automated destructive production restore: **not performed**',
    '',
    'Runbook: docs/P32_FULL_STACK_DISASTER_RECOVERY.md',
  ].join('\n');
  if(existing){
    await github('/repos/'+repo+'/issues/'+existing.number,{method:'PATCH',body:JSON.stringify({title,body})});
    console.error('P32 RECOVERY READINESS — NOT READY (issue updated #'+existing.number+')');
  }else{
    const created=await github('/repos/'+repo+'/issues',{method:'POST',body:JSON.stringify({title,body})});
    console.error('P32 RECOVERY READINESS — NOT READY (issue opened #'+created.number+')');
  }
  process.exit(1);
}
if(existing){
  await github('/repos/'+repo+'/issues/'+existing.number+'/comments',{method:'POST',body:JSON.stringify({
    body:'P32 recovery readiness recovered: isolated data restore, cold API, real frontend browser certification, production before/after probes, and encrypted-artifact integrity are all green. Closing this readiness issue.'
  })});
  await github('/repos/'+repo+'/issues/'+existing.number,{method:'PATCH',body:JSON.stringify({state:'closed',state_reason:'completed'})});
  console.log('P32 RECOVERY READINESS — READY (closed #'+existing.number+')');
}else console.log('P32 RECOVERY READINESS — READY');
