import { mkdir, readFile, writeFile } from 'node:fs/promises';
const [,,command,stage] = process.argv;
if (!['start','end'].includes(command) || !stage) throw new Error('Usage: p32-timing.mjs <start|end> <stage>');
const path=process.env.P32_TIMINGS || 'p32-report/timings.json';
await mkdir(path.split('/').slice(0,-1).join('/')||'.',{recursive:true});
let data={schemaVersion:1,phase:'P32',startedAt:null,completedAt:null,stages:{}};
try{data=JSON.parse(await readFile(path,'utf8'));}catch{}
const now=new Date().toISOString();
if(command==='start'){
  if(!data.startedAt)data.startedAt=now;
  data.stages[stage]={...(data.stages[stage]||{}),startedAt:now};
}else{
  if(!data.stages[stage]?.startedAt)throw new Error('stage was not started: '+stage);
  data.stages[stage].completedAt=now;
  data.stages[stage].durationMs=Date.parse(now)-Date.parse(data.stages[stage].startedAt);
  if(stage==='production-postcheck')data.completedAt=now;
}
await writeFile(path,JSON.stringify(data,null,2)+'\n');
console.log('P32 timing '+command+': '+stage+' @ '+now);
