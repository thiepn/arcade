import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

export const UI_PROFILES = [
  [320,480], [320,568], [360,640], [390,844], [412,915], [480,600],
  [568,320], [667,375], [844,390], [768,1024], [1024,600],
  [1280,720], [1440,900], [1920,1080],
];
const SPECIAL = new Set(['merge','matrix','rhythm','airhockey','oneline','typerush']);
export function measureUI() {
  const box = e => { const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}; };
  const visible = e => { const s=getComputedStyle(e),r=box(e); return r.w>0 && r.h>0 && s.display!=='none' && s.visibility!=='hidden' && Number(s.opacity)!==0 && !e.closest('[inert], [aria-hidden="true"]'); };
  const toolbar=document.querySelector('.game-shell>header') || document.querySelector('.p19-home-header');
  const frame=document.querySelector('.game-shell main>div');
  const root=frame && [...frame.children].find(e=>!['absolute','fixed'].includes(getComputedStyle(e).position));
  const controls=[...toolbar.querySelectorAll('button')].filter(visible).map(e=>{
    const svg=e.querySelector('svg');
    return {id:e.id,rect:box(e),icon:svg&&box(svg),iconOnly:!e.textContent.trim(),label:e.getAttribute('aria-label')||e.getAttribute('title')||e.textContent.trim()};
  });
  const inside=(r,f)=>r.x>=f.x-1 && r.y>=f.y-1 && r.right<=f.right+1 && r.bottom<=f.bottom+1;
  const clipped=root ? [...root.querySelectorAll('button,select,input,[role="button"]')].filter(visible).filter(e=>!inside(box(e),box(root))).map(e=>e.id || e.getAttribute('aria-label') || e.textContent.trim()) : [];
  const boards=[...document.querySelectorAll('.merge-board,.matrix-board')].map(e=>({rect:box(e),root:box(root)}));
  const canvases=[...document.querySelectorAll('.game-shell canvas')].map(e=>({rect:box(e),parent:box(e.parentElement),width:e.width,height:e.height}));
  const status=document.querySelector('.arcade-game-status');
  const stripChildren=status?[...status.querySelectorAll('.p18-first-run-hint,.p22-promotion-hud')].map(e=>({rect:box(e),parent:box(status)})):[];
  const hudRects = ['.snake-toolbar > div', '.gravity-toolbar, .gravity-actions', '.oneline-arena, .oneline-help']
    .map(selector => [...document.querySelectorAll(selector)].filter(visible).map(box));
  // Stress the real score/title layout without fabricating a submitted score.
  const scoreNodes=[...document.querySelectorAll('.arcade-game-score > div > span:last-child')];
  const originalScores=scoreNodes.map(e=>e.textContent);
  scoreNodes.forEach(e=>{e.textContent='100,000,000';});
  const score=document.querySelector('.arcade-game-score');
  const title=document.querySelector('.arcade-game-title h1 > span:first-child');
  const highScoreLayout=score&&title?{score:box(score),title:box(title)}:null;
  scoreNodes.forEach((e,i)=>{e.textContent=originalScores[i];});
  return {highScoreLayout,hudRects,width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth-innerWidth,toolbar:box(toolbar),controls,frame:frame&&box(frame),root:root&&box(root),clipped,boards,canvases,stripChildren,renderErrors:window.__uiRenderErrors||[]};
}
function contained(r,f) { return r.x>=f.x-2 && r.y>=f.y-2 && r.right<=f.right+2 && r.bottom<=f.bottom+2; }
function overlap(a,b) { return Math.min(a.right,b.right)-Math.max(a.x,b.x)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1; }
export function assertGeometry(m,label,touch) {
  const viewport={x:0,y:0,right:m.width,bottom:m.height};
  assert(m.overflow<=2,`${label}: horizontal page overflow ${m.overflow}`);
  assert(contained(m.toolbar,viewport),`${label}: toolbar escaped viewport`);
  for(const c of m.controls) {
    assert(c.label,`${label}: unnamed toolbar control ${c.id}`);
    assert(contained(c.rect,viewport),`${label}: offscreen control ${c.id}`);
    assert(c.rect.w>=40 && c.rect.h>=40,`${label}: small control ${c.id}`);
    if(touch) assert(c.rect.w>=44 && c.rect.h>=44,`${label}: touch control under 44px ${c.id}`);
    if(c.iconOnly && c.icon) {
      assert(Math.abs(c.icon.x+c.icon.w/2-c.rect.x-c.rect.w/2)<1.5,`${label}: horizontally misaligned icon ${c.id}`);
      assert(Math.abs(c.icon.y+c.icon.h/2-c.rect.y-c.rect.h/2)<1.5,`${label}: vertically misaligned icon ${c.id}`);
    }
  }
  for(let i=0;i<m.controls.length;i++) for(let j=i+1;j<m.controls.length;j++) assert(!overlap(m.controls[i].rect,m.controls[j].rect),`${label}: overlapping controls ${m.controls[i].id}/${m.controls[j].id}`);
  if(m.frame) {
    assert(m.root && m.root.w>100 && m.root.h>80,`${label}: loaded game root has no usable area`);
    assert(contained(m.root,m.frame),`${label}: game root clipped`);
    assert.deepEqual(m.clipped,[],`${label}: clipped game controls`);
    for(const c of m.canvases) {
      assert(c.rect.w>80 && c.rect.h>60 && c.width>0 && c.height>0,`${label}: collapsed canvas`);
      assert(contained(c.rect,m.frame),`${label}: clipped canvas`);
      assert(Math.abs(c.width/c.height-c.rect.w/c.rect.h)<0.035,`${label}: stretched canvas backing store`);
    }
    for(const b of m.boards) assert(contained(b.rect,b.root),`${label}: fixed-size board clipped`);
    for(const b of m.stripChildren) { assert(contained(b.rect,b.parent),`${label}: status strip clipped`);assert(!overlap(b.rect,m.root),`${label}: teaching/mastery HUD covers gameplay`); }
  }
  for (const group of m.hudRects) for (let i=0;i<group.length;i++) for (let j=i+1;j<group.length;j++) {
    assert(!overlap(group[i],group[j]),`${label}: overlapping HUD regions`);
  }
  if(m.highScoreLayout) {
    assert(contained(m.highScoreLayout.score,viewport),`${label}: large score escaped viewport`);
    assert(!overlap(m.highScoreLayout.score,m.highScoreLayout.title),`${label}: large score covers game title`);
  }
  assert.deepEqual(m.renderErrors,[],`${label}: canvas runtime error`);
}
async function loaded(page,id) {
  await page.waitForFunction(gameId=>{
    const shell=document.querySelector('.game-shell');
    if(shell?.dataset.p18Game!==gameId) return false;
    const frame=shell.querySelector('main>div');
    // A shell and loading skeleton are not a loaded game.
    if(!frame || [...frame.querySelectorAll('[role="status"]')].some(e=>e.textContent.includes('Loading '))) return false;
    return [...frame.children].some(e=>!['absolute','fixed'].includes(getComputedStyle(e).position) && !e.textContent.includes('Loading '));
  },id,{timeout:10000});
  await page.waitForTimeout(100);
}
async function checkDialog(page, opener, name, close, screenshots, label) {
  await page.locator(opener).click();
  const dialog=page.getByRole('dialog',{name,exact:true});
  await dialog.waitFor({state:'visible'});
  await page.waitForTimeout(60);
  const geometry=await dialog.evaluate(e=>{
    const p=e.id==='stats-modal-container'?e:e.firstElementChild,r=p.getBoundingClientRect();
    return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,overflow:p.scrollWidth-p.clientWidth};
  });
  const v=page.viewportSize();
  assert(geometry.x>=-1 && geometry.y>=-1 && geometry.right<=v.width+1 && geometry.bottom<=v.height+1,`${label}: ${name} panel outside viewport`);
  assert(geometry.overflow<=2,`${label}: ${name} horizontal panel overflow ${geometry.overflow}`);
  await page.keyboard.press('Tab');
  assert(await dialog.evaluate(e=>e.contains(document.activeElement)),`${label}: ${name} focus escaped`);
  if(screenshots) await page.screenshot({path:path.join(screenshots,`${label}-${name.replaceAll(' ','-')}.png`)});
  await dialog.locator(close).click();
  await dialog.waitFor({state:'detached'});
}
export async function runUIAudit({browser,visit,profiles=UI_PROFILES,out='ui-report',screenshots=false}) {
  await fs.mkdir(out,{recursive:true});
  const rows=[],failures=[];
  let index=0;
  async function worker() {
    for(;;) {
      const profile=profiles[index++]; if(!profile) return;
      const [width,height]=profile,label=`${width}x${height}`,touch=width<1024;
      const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch,deviceScaleFactor:touch?2:1,reducedMotion:'reduce',serviceWorkers:'block'});
      const p=await context.newPage();p.setDefaultTimeout(10000);
      const errors=[];p.on('pageerror',e=>errors.push(e.message));
      try {
        await visit(p);await p.locator('#play-btn-stack').waitFor();
        await p.evaluate(()=>{window.__uiRenderErrors=[];window.addEventListener('arcade:game-loop-error',e=>window.__uiRenderErrors.push(e.detail?.message||'render failure'));});
        assertGeometry(await p.evaluate(measureUI),`${label}/home`,touch);
        const ids=await p.locator('[id^="play-btn-"]').evaluateAll(es=>es.map(e=>e.id.slice(9)));
        assert.equal(ids.length,32,'Roster must have 32 games');
        const search=p.locator('#search-toggle-btn');await search.click();await p.waitForFunction(()=>document.querySelector('#search-toggle-btn').getAttribute('aria-expanded')==='true');
        await search.click();await p.waitForFunction(()=>document.querySelector('#search-toggle-btn').getAttribute('aria-expanded')==='false');
        const sound=p.locator('#sound-toggle-btn'),before=await sound.getAttribute('aria-pressed');await sound.click();await p.waitForFunction(value=>document.querySelector('#sound-toggle-btn').getAttribute('aria-pressed')!==value,before);
        for(const id of ids) {
          try {
            await p.locator('#play-btn-'+id).click();await loaded(p,id);
            const m=await p.evaluate(measureUI);assertGeometry(m,`${label}/${id}`,touch);
            if(screenshots && (SPECIAL.has(id)||width===568)) await p.screenshot({path:path.join(out,`${label}-${id}.png`)});
            if(SPECIAL.has(id)) {
              // Resizing an existing run must not remount its game or lose its controls.
              await p.locator('#game-pause-btn').click();
              const pause=p.locator('[data-p18-dialog="pause"]');await pause.waitFor({state:'visible'});
              await p.evaluate(()=>{window.__uiGameNode=document.querySelector('.game-shell canvas,.merge-board,.matrix-board');});
              const next={width:height,height:width};await p.setViewportSize(next);await p.waitForTimeout(120);
              const pausePanel=pause.locator('.p18-pause-dialog');
              const containedPause=await pausePanel.evaluate(e=>{const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return r.top>=p.top-1 && r.bottom<=p.bottom+1 && r.left>=p.left-1 && r.right<=p.right+1;});
              assert(containedPause,`${label}/${id}: rotated pause panel clipped`);
              const resume=pause.getByRole('button',{name:/RESUME/});await resume.scrollIntoViewIfNeeded();await resume.click();await pause.waitFor({state:'detached'});
              assert(await p.evaluate(()=>window.__uiGameNode===document.querySelector('.game-shell canvas,.merge-board,.matrix-board')),`${label}/${id}: rotation reset game`);
              assertGeometry(await p.evaluate(measureUI),`${label}/${id}/rotated`,touch);
              await p.setViewportSize({width,height});await p.waitForTimeout(100);
            }
            rows.push({viewport:label,game:id,pass:true});
          } catch(e) {
            console.error(`FAIL ${label}/${id}: ${e.message}`);failures.push(`${label}/${id}: ${e.message}`);rows.push({viewport:label,game:id,pass:false,error:e.message});
            await p.screenshot({path:path.join(out,`${label}-${id}-failure.png`)}).catch(()=>{});
          } finally {
            await p.setViewportSize({width,height});
            // Never click through an overlay or swallow a failure to close it.
            const back=p.locator('#game-back-btn');
            if(await back.count()) { await back.click();await p.locator('.game-shell').waitFor({state:'detached'}); }
          }
        }
        await checkDialog(p,'#header-leaderboards-pill-btn','Overall leaderboards','[aria-label="Close leaderboards"]',screenshots?out:null,label);
        await checkDialog(p,'#header-rank-badge-btn','Player profile','[aria-label="Close profile"]',screenshots?out:null,label);
        await checkDialog(p,'#stats-open-btn','Arcade statistics, achievements, leaderboards and settings','#close-stats-modal-btn',screenshots?out:null,label);
        assert.deepEqual(errors,[],`${label}: uncaught browser errors`);
        console.log(`SCANNED ${label}: 32 games, six live rotations, header and three dialogs`);
      } catch(e) { failures.push(`${label}: ${e.message}`);await p.screenshot({path:path.join(out,`${label}-exception.png`)}).catch(()=>{}); }
      finally { await context.close(); }
    }
  }
  await Promise.all([worker(),worker(),worker()]);
  await fs.writeFile(path.join(out,'results.json'),JSON.stringify({profiles:profiles.length,gameChecks:rows.length,passed:rows.filter(r=>r.pass).length,failures,rows},null,2));
  for(const failure of failures)console.error(failure);
  assert.equal(failures.length,0,`${failures.length} responsive regressions; see ${out}/results.json`);
  assert.equal(rows.length,profiles.length*32,'Incomplete game matrix');
  console.log(`PASS ${rows.length}/${rows.length} game/viewport checks; ${profiles.length*6} live rotation checks; ${profiles.length*3} app dialogs.`);
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const browser=await chromium.launch({...(process.env.UI_CHROME_PATH?{executablePath:process.env.UI_CHROME_PATH}:{channel:'chrome'}),args:['--no-sandbox','--disable-dev-shm-usage']});
  try { await runUIAudit({browser,visit:p=>p.goto(process.env.UI_BASE_URL||'http://127.0.0.1:4173',{waitUntil:'domcontentloaded'}),out:process.env.UI_OUT||'ui-report',screenshots:process.env.UI_SCREENSHOTS==='1'}); }
  finally { await browser.close(); }
}
