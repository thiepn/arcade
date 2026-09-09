import {POLICY_ID,apMicros,contributionMicros} from '../shared/leaderboard/domain.ts';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { SCORING_PROFILES, RHYTHM_MODES, defaultScoreMode, toArcadePoints } from '../shared/scoring.ts';
const port=Number(process.env.SCORING_TEST_PORT||4174),base=`http://127.0.0.1:${port}`;
const server=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{env:{...process.env,VITE_BASE_PATH:'/',VITE_LEADERBOARD_API_URL:base+'/test-api'},stdio:['ignore','pipe','pipe']});
let log='';server.stdout.on('data',d=>{log+=d;});server.stderr.on('data',d=>{log+=d;});
let browser;let cases=0;
try {
 let ready=false;
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(log);try{if((await fetch(base+'/tests/scoring.html',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 assert.ok(ready,'Fixture server did not start: '+log);
 console.log('Scoring fixture server ready:',log.trim());
 browser=await chromium.launch({executablePath:process.env.SCORING_CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 for(const viewport of [{width:320,height:480},{width:390,height:844},{width:1280,height:800}]){
  const ctx=await browser.newContext({viewport});const page=await ctx.newPage();const errors=[];const submissions=[];const sessions=[];const reserved=new Map();const player='11111111-1111-4111-8111-111111111111';const envelope={protocolVersion:3,scoreVersion:2,policyId:POLICY_ID};
  page.on('pageerror',err=>errors.push(err.message));
  await page.route('**/test-api/**',async route=>{
   const url=new URL(route.request().url());const body=route.request().postDataJSON();let data;
   if(url.pathname.endsWith('/guest'))data={...envelope,credential:player+'.'+'a'.repeat(43)};
   else if(url.pathname.endsWith('/sessions')){sessions.push(body);const issuedAt=Date.now();const session={id:crypto.randomUUID(),playerId:player,gameId:body.gameId,modeId:body.modeId,policyId:POLICY_ID,issuedAt,expiresAt:issuedAt+21600000,uploadExpiresAt:issuedAt+21600000+604800000};reserved.set(session.id,session);data={...envelope,session};}
   else if(url.pathname.endsWith('/scores')){submissions.push(body);const session=reserved.get(body.sessionId);const units=apMicros(session.gameId,body.rawScore,body.modeId);data={...envelope,status:'ranked',accepted:true,sessionId:body.sessionId,gameId:session.gameId,modeId:body.modeId,rawScore:body.rawScore,apMicros:units,arcadePoints:Math.floor(units/1000000),contributionMicros:contributionMicros(session.gameId,units,body.modeId),completedAt:Date.now(),code:'ok'};}
   else if(url.pathname.endsWith('/me'))data={...envelope,player:{id:player,name:'Fixture',countryCode:'XX',createdAt:0},activity:{submissions:0,rankedGames:0}};
   else data={...envelope,entries:[],userEntry:null,totalCompetitors:0,asOf:Date.now(),offset:0,nextOffset:null,contributions:[],weekStart:Date.now(),weekEnd:Date.now()+604800000};
   await route.fulfill({contentType:'application/json',body:JSON.stringify(data),status:url.pathname.endsWith('/sessions')?201:200});
  });
  await page.goto(base+'/tests/scoring.html');await page.waitForFunction(()=>window.scoreFixture?.emit&&window.scoreFixture?.select);
  for(const [id,p] of Object.entries(SCORING_PROFILES)){
   await page.evaluate(id=>window.scoreFixture.select(id),id);
   await page.waitForSelector(`[data-fixture-game="${id}"] [data-test-engine]`);
   await page.waitForFunction(()=>!!document.querySelector('[data-arcade-points]'));
   const modes=id==='rhythm'?Object.keys(RHYTHM_MODES):id==='airhockey'?['EASY','MEDIUM','HARD']:[defaultScoreMode(id)];
   console.log(`CASE ${viewport.width} ${id}`);
   for(const mode of modes){
    if(mode!==defaultScoreMode(id))await page.evaluate(mode=>window.scoreFixture.mode(mode),mode);
    else if(modes.length>1)await page.evaluate(mode=>window.scoreFixture.mode(mode),mode);
    await page.waitForTimeout(50);
    const raw=(id==='rhythm'?RHYTHM_MODES[mode].anchors:p.anchors)[1];
    await page.evaluate(({raw,mode})=>window.scoreFixture.emit(raw,mode),{raw,mode});
    await page.waitForFunction(expected=>document.querySelector('[data-arcade-points]')?.getAttribute('data-arcade-points')===String(expected),toArcadePoints(id,raw,mode));
    const before=submissions.length;
    await page.evaluate(({raw,mode})=>{window.scoreFixture.finish(raw,mode);window.scoreFixture.finish(raw,mode);},{raw,mode});
    await page.waitForSelector('[data-score-submission="accepted"]');
    assert.equal(submissions.length,before+1,'exactly one remote record for duplicate game-over callback');
    assert.equal(submissions.at(-1).rawScore,raw,'network sends native counter, not already-converted AP');
    assert.equal(submissions.at(-1).modeId,mode);assert.equal(submissions.at(-1).scoreVersion,2);
    const saved=await page.evaluate(()=>window.scoreFixture.saved.at(-1));
    assert.equal(saved.points,toArcadePoints(id,raw,mode));assert.equal(saved.details.rawScore,raw);assert.equal(saved.details.modeId,mode);
    await page.locator('[data-scoring-details] summary').click();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,'mobile points/result panel has no page-wide overflow');
    await page.getByRole('button',{name:/PLAY AGAIN/i}).click();
    await page.waitForFunction(()=>document.querySelector('[data-arcade-points]')?.getAttribute('data-arcade-points')==='0');
    cases++;
   }
  }
  assert.deepEqual(errors,[],'no browser exceptions');await ctx.close();
 }
 console.log(`Scoring browser PASS: ${cases} game/mode/viewport boundary cases; HUD/result/persistence/API parity, duplicate finish, restart, mode binding, and expandable result overflow.`);
} finally {await browser?.close();server.kill('SIGTERM');}
