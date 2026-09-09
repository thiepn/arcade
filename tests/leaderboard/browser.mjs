/** Browser interaction and failure tests use a controlled API; PostgreSQL tests exercise the real backend. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {chromium} from '@playwright/test';
import {POLICY_ID,AP_SCALE,apMicros,contributionMicros,weekBounds} from '../../shared/leaderboard/domain.ts';
const port=4186,base=`http://127.0.0.1:${port}`,player='11111111-1111-4111-8111-111111111111',credential=player+'.'+'a'.repeat(43);
const env={protocolVersion:3,scoreVersion:2,policyId:POLICY_ID};
const server=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{env:{...process.env,VITE_BASE_PATH:'/',VITE_LEADERBOARD_API_URL:base+'/test-api'},stdio:'pipe'});
let logs='';server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);let browser;let assertions=0;
const check=(v,m)=>{assertions++;assert.ok(v,m)};
const state={sessions:new Map(),runs:new Map(),uploads:[],offlineUpload:false,dropResponse:false,requests:[],failures:[]};
const ids=Array.from({length:45},(_,i)=>i===44?player:`22222222-2222-4222-8222-${String(i).padStart(12,'0')}`);
async function api(route){
 const req=route.request(),url=new URL(req.url()),path=url.pathname.replace('/test-api','');state.requests.push(path);let body;try{body=req.postDataJSON();}catch{}
 let data,status=200;
 if(path==='/v3/guest'){data={...env,credential};status=201;}
 else if(path==='/v3/me'){data={...env,player:{id:player,name:'Jonathan Longname',countryCode:'XX',createdAt:1},activity:{submissions:state.runs.size,rankedGames:1}};}
 else if(path==='/v3/me/runs')data={...env,entries:[],total:0};
 else if(path==='/v3/sessions'){
  let s=[...state.sessions.values()].find(s=>s.requestId===body.requestId);if(!s){const issuedAt=Date.now();s={id:crypto.randomUUID(),playerId:player,requestId:body.requestId,gameId:body.gameId,modeId:body.modeId,policyId:POLICY_ID,issuedAt,expiresAt:issuedAt+21600000,uploadExpiresAt:issuedAt+21600000+604800000};state.sessions.set(s.id,s)}data={...env,session:s};status=201;
 }else if(path==='/v3/scores'){
  state.uploads.push(body);if(state.offlineUpload){await route.abort('failed');return;}
  const s=state.sessions.get(body.sessionId);if(!s)throw Error('unknown fixture session');
  let r=state.runs.get(s.id);if(!r){const units=apMicros(s.gameId,body.rawScore,body.modeId);r={...env,accepted:true,status:'ranked',sessionId:s.id,gameId:s.gameId,modeId:s.modeId,rawScore:body.rawScore,apMicros:units,arcadePoints:Math.floor(units/AP_SCALE),contributionMicros:contributionMicros(s.gameId,units,s.modeId),completedAt:Date.now(),code:'ok'};state.runs.set(s.id,r)}
  if(state.dropResponse){state.dropResponse=false;await route.abort('failed');return;}data=r;
 }else if(path.includes('/result')){data=state.runs.get(path.split('/')[3]);}
 else if(path.includes('/contributions'))data={...env,contributions:[{gameId:'stack',modeId:'standard',rawScore:45,apMicros:3000*AP_SCALE,contributionMicros:3000*AP_SCALE,completedAt:Date.now()-5000}]};
 else if(path.includes('/leaderboards/')){
  const isGame=!/(overall|weekly)$/.test(path),weekly=path.endsWith('/weekly'),offset=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??20),asOf=Number(url.searchParams.get('asOf')??Date.now());
  const mode=url.searchParams.get('mode')==='all'?'standard':url.searchParams.get('mode')??'standard';
  const rows=ids.map((id,i)=>({id,name:i===44?'Jonathan Longname':i===0?'ABCDEFGHIJKLMNOPQRST':`Player ${i+1}`,country_code:'XX',rank:i+1,ap_micros:(6000-i)*AP_SCALE,contribution_micros:(6000-i)*AP_SCALE,raw_score:isGame?45000:undefined,mode_id:isGame?mode:undefined,source_version:2,achieved_at:asOf-5000,last_achieved_at:asOf-5000,games_played:1}));
  const bounds=weekBounds(asOf);data={...env,entries:rows.slice(offset,offset+limit),userEntry:rows[44],totalCompetitors:45,asOf,offset,nextOffset:offset+limit<45?offset+limit:null,contributions:[],weekStart:weekly?bounds.start:null,weekEnd:weekly?bounds.end:null};
 }else {status=404;data={...env,code:'not_found'}}
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
}
try{
 for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));if(i===99)throw Error(logs);}
 browser=await chromium.launch({executablePath:process.env.SCORING_CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox']});mkdirSync('balance-report/leaderboard',{recursive:true});
 for(const width of [320,390,768,1280]){
  const ctx=await browser.newContext({viewport:{width,height:width===320?568:844},reducedMotion:'reduce'});await ctx.addInitScript(({credential})=>localStorage.setItem('micro_arcade_guest_credential_v1',credential),{credential});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/test-api/**',api);await p.goto(base);await p.locator('#header-leaderboards-pill-btn').click();
  const panel=p.locator('[data-leaderboard-v3]');await panel.locator('[data-leaderboard-player]').first().waitFor();
  check(await panel.locator('[data-leaderboard-player]').count()===21,'top 20 plus pinned self');
  const longName=panel.getByRole('button',{name:'Show contributions for ABCDEFGHIJKLMNOPQRST'});check(await longName.textContent()==='ABCDEFGHIJKLMNOPQRST','full long name retained');
  check(await longName.evaluate(e=>getComputedStyle(e).textOverflow!=='ellipsis'&&e.scrollWidth<=e.clientWidth+1),'mobile name wraps, not clips');
  check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'no page horizontal overflow');
  await longName.click();await panel.getByText('3,000 rating',{exact:true}).waitFor();check(await panel.getByText('Standard · Score 45').count()===1,'contribution matches native mode context');
  await panel.getByRole('button',{name:'Load more players'}).click();await p.waitForFunction(()=>document.querySelectorAll('[data-leaderboard-player]').length===41);
  await panel.getByRole('button',{name:'Load more players'}).click();await p.waitForFunction(()=>document.querySelectorAll('[data-leaderboard-player]').length===45);
  check(await panel.locator(`[data-leaderboard-player="${player}"]`).count()===1,'self deduplicated after pagination');
  await panel.getByRole('button',{name:'By game',exact:true}).click();await panel.getByRole('combobox',{name:'Leaderboard game'}).selectOption('rhythm');await panel.getByRole('combobox',{name:'Leaderboard mode'}).selectOption('hypernova');
  await panel.getByText(/Score 45,000 · Hypernova · Hard/).first().waitFor();check(true,'mode filter and raw-score context');
  await panel.getByRole('button',{name:'Weekly',exact:true}).click();await panel.getByText(/Resets Monday 00:00 UTC/).waitFor();check(true,'weekly view');
  await p.screenshot({path:`balance-report/leaderboard/mobile-${width}.png`,fullPage:true});
  await p.getByRole('button',{name:'Close leaderboards'}).click();check(!await panel.count(),'dialog closes');
  await p.locator('#stats-open-btn').click();await p.locator('#tab-leaderboards-btn').click();await p.locator('[data-leaderboard-v3]').waitFor();check(true,'statistics entry uses same leaderboard component');
  await p.locator('#close-stats-modal-btn').click();check(errors.length===0,errors.join('\n'));await ctx.close();
 }
 // Commit reached the server, response lost, then a reload. Exact original payload must retry.
 const ctx=await browser.newContext();await ctx.addInitScript(({credential})=>localStorage.setItem('micro_arcade_guest_credential_v1',credential),{credential});const p=await ctx.newPage();p.on('requestfailed',r=>state.failures.push({url:r.url(),error:r.failure()?.errorText}));p.on('pageerror',e=>state.failures.push({error:e.message}));await p.route('**/test-api/**',api);
 await p.goto(base+'/tests/scoring.html');await p.waitForFunction(()=>window.scoreFixture?.finish&&window.scoreFixture?.outbox);await p.waitForTimeout(700);
 state.dropResponse=true;const before=state.runs.size;await p.evaluate(()=>{window.scoreFixture.emit(45,'standard');window.scoreFixture.finish(45,'standard')});
 await p.waitForFunction(async()=> (await window.scoreFixture.outbox()).some(r=>r.status==='pending'&&r.attempts>0));const saved=await p.evaluate(async()=> (await window.scoreFixture.outbox()).find(r=>r.status==='pending'));check(state.runs.size===before+1,'server committed before disconnect: '+JSON.stringify({before,runs:state.runs.size,saved,requests:state.requests.slice(-12),uploads:state.uploads,failures:state.failures}));
 state.offlineUpload=true;await p.reload();await p.waitForFunction(()=>window.scoreFixture?.flush);check((await p.evaluate(async()=> (await window.scoreFixture.outbox()).find(r=>r.status==='pending'))).id===saved.id,'IndexedDB survives reload');
 state.offlineUpload=false;await p.evaluate(()=>window.scoreFixture.flush(true));await p.waitForFunction(async()=> (await window.scoreFixture.outbox()).some(r=>r.status==='accepted'));
 check(state.runs.size===before+1,'lost response retry creates no second record');const sent=state.uploads.filter(r=>r.sessionId===saved.id);check(sent.every(r=>JSON.stringify(r)===JSON.stringify(sent[0])),'raw score, mode and completion duration immutable across reload/retry');
 // A stale callback from the old mode cannot end the new run.
 await p.evaluate(()=>{window.oldFinish=window.scoreFixture.finish;window.scoreFixture.mode('standard')});await p.evaluate(()=>window.scoreFixture.select('rhythm'));await p.waitForSelector('[data-fixture-game="rhythm"]');await p.waitForTimeout(200);
 await p.evaluate(()=>{window.oldFinish=window.scoreFixture.finish;window.scoreFixture.mode('hypernova')});await p.waitForTimeout(200);await p.evaluate(()=>window.oldFinish(12345,'cyber_odyssey'));check(await p.locator('[data-result-raw-score]').count()===0,'old-mode callback ignored');
 await ctx.close();console.log(`Leaderboard browser PASS: ${assertions} UI/failure assertions, 4 responsive widths, pagination, mode context, IndexedDB reload and lost-response recovery.`);
}finally{await browser?.close();server.kill('SIGTERM');}
