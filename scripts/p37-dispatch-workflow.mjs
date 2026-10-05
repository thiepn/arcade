const repo=process.env.GITHUB_REPOSITORY||'thiepn/arcade';
const token=process.env.GITHUB_TOKEN||'';
const workflow=process.argv[2];
const ref=process.argv[3]||'main';
const timeoutMs=Number(process.env.P37_DISPATCH_TIMEOUT_MS||600000);
const pollMs=Number(process.env.P37_DISPATCH_POLL_MS||5000);

if(!workflow)throw new Error('Usage: bun scripts/p37-dispatch-workflow.mjs <workflow-file> [ref]');
if(!token)throw new Error('P37 workflow dispatch requires GITHUB_TOKEN');

async function github(path,init={}){
  const response=await fetch('https://api.github.com'+path,{
    ...init,
    headers:{
      Accept:'application/vnd.github+json',
      Authorization:'Bearer '+token,
      'X-GitHub-Api-Version':'2022-11-28',
      'Content-Type':'application/json',
      ...(init.headers||{}),
    },
  });
  const text=await response.text();
  if(!response.ok)throw new Error('GitHub API '+response.status+' '+path+': '+text.slice(0,500));
  return text?JSON.parse(text):null;
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

const before=await github('/repos/'+repo+'/actions/workflows/'+encodeURIComponent(workflow)+'/runs?branch='+encodeURIComponent(ref)+'&event=workflow_dispatch&per_page=30');
const known=new Set((before.workflow_runs||[]).map(run=>run.id));
const dispatchedAt=Date.now();

await github('/repos/'+repo+'/actions/workflows/'+encodeURIComponent(workflow)+'/dispatches',{
  method:'POST',
  body:JSON.stringify({ref}),
});

let run=null;
while(Date.now()-dispatchedAt<timeoutMs){
  const body=await github('/repos/'+repo+'/actions/workflows/'+encodeURIComponent(workflow)+'/runs?branch='+encodeURIComponent(ref)+'&event=workflow_dispatch&per_page=30');
  run=(body.workflow_runs||[]).find(item=>!known.has(item.id)&&Date.parse(item.created_at)>=dispatchedAt-10000)||null;
  if(run)break;
  await sleep(pollMs);
}
if(!run)throw new Error('Timed out waiting for dispatched '+workflow+' run to appear.');

console.log('P37 dispatched '+workflow+' as run '+run.id+'.');

while(Date.now()-dispatchedAt<timeoutMs){
  run=await github('/repos/'+repo+'/actions/runs/'+run.id);
  if(run.status==='completed')break;
  await sleep(pollMs);
}
if(run.status!=='completed')throw new Error('Timed out waiting for '+workflow+' run '+run.id+' to complete.');
if(run.conclusion!=='success')throw new Error(workflow+' run '+run.id+' completed with '+run.conclusion+'.');

if(process.env.GITHUB_OUTPUT){
  const { appendFile }=await import('node:fs/promises');
  await appendFile(process.env.GITHUB_OUTPUT,'run_id='+run.id+'\nworkflow='+workflow+'\n');
}
console.log('P37 verified '+workflow+' run '+run.id+' — SUCCESS');
