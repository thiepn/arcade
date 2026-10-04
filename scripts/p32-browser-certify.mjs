import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { POLICY_ID } from '../shared/leaderboard/domain.ts';

const frontend=process.env.P32_FRONTEND_URL||'http://127.0.0.1:3000';
const apiBase=process.env.P32_API_URL||'http://127.0.0.1:8787/micro-arcade-leaderboards';
const outputDir=process.env.P32_REPORT_DIR||'p32-report';
const startedAt=new Date().toISOString();
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const consoleErrors=[];
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().slice(0,300));});
  await page.goto(frontend,{waitUntil:'networkidle',timeout:30000});
  await page.locator('#brand-logo-btn').waitFor({state:'visible',timeout:10000});

  const appConfigured=await page.evaluate(()=>Boolean(document.querySelector('#header-leaderboards-pill-btn')));
  if(!appConfigured)throw new Error('leaderboard entrypoint missing from restored frontend');

  const coldRequests=[];
  page.on('request',req=>{if(req.url().startsWith(apiBase))coldRequests.push(req.url());});

  const overallResponsePromise=page.waitForResponse(
    r=>r.url().startsWith(apiBase+'/v3/leaderboards/overall')&&r.request().method()==='GET',
    {timeout:15000},
  );
  await page.locator('#header-leaderboards-pill-btn').click();
  const overallResponse=await overallResponsePromise;
  const overall=await overallResponse.json();
  if(overallResponse.status()!==200||overall.policyId!==POLICY_ID||!Array.isArray(overall.entries))throw new Error('frontend overall leaderboard did not use certified cold API');

  const browserReads=await page.evaluate(async(base)=>{
    const read=async(path)=>{
      const response=await fetch(base+path,{cache:'no-store'});
      const body=await response.json();
      return {status:response.status,body,contentType:response.headers.get('content-type')};
    };
    return {
      health:await read('/v3/health'),
      weekly:await read('/v3/leaderboards/weekly?limit=20&offset=0'),
    };
  },apiBase);

  const health=browserReads.health;
  const weekly=browserReads.weekly;
  if(health.status!==200||health.body?.ok!==true||health.body?.backend!=='supabase'||health.body?.policyId!==POLICY_ID)throw new Error('cold API health contract failed in browser origin');
  if(weekly.status!==200||weekly.body?.policyId!==POLICY_ID||!Array.isArray(weekly.body?.entries))throw new Error('cold weekly leaderboard contract failed in browser origin');
  if(!coldRequests.some(u=>u.includes('/v3/leaderboards/overall')))throw new Error('application did not issue leaderboard request to cold API');

  const report={
    schemaVersion:1,
    phase:'P32',
    startedAt,
    completedAt:new Date().toISOString(),
    frontend:{
      shell:true,
      brandVisible:true,
      leaderboardEntrypoint:true,
      leaderboardRequestObserved:true,
      coldApiRequestCount:coldRequests.length,
    },
    api:{
      health:true,
      overall:true,
      weekly:true,
      policyId:POLICY_ID,
      overallCompetitors:overall.totalCompetitors,
      weeklyCompetitors:weekly.body.totalCompetitors,
    },
    consoleErrors,
  };
  await mkdir(outputDir,{recursive:true});
  await writeFile(outputDir+'/browser.json',JSON.stringify(report,null,2)+'\n');
  console.log('P32 COLD FULL-STACK BROWSER CERTIFICATION — PASS');
  console.log('Cold API observed by application; overall competitors '+report.api.overallCompetitors+', weekly '+report.api.weeklyCompetitors+'.');
}finally{
  await browser.close();
}
