import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const out = 'ui-report';
await fs.mkdir(out, { recursive: true });
const profiles = [[320,568],[360,640],[390,844],[480,600],[568,320],[667,375],[844,390],[768,1024],[1024,600],[1280,720],[1440,900]];
const all = [];
function measure() {
  const rect = e => { const r=e.getBoundingClientRect(); return { x:r.x,y:r.y,w:r.width,h:r.height,r:r.right,b:r.bottom }; };
  const shown = e => { const r=e.getBoundingClientRect(),s=getComputedStyle(e); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!e.closest('[inert]'); };
  const toolbar=document.querySelector('.game-shell>header')||document.querySelector('.p19-home-header');
  const stage=document.querySelector('.game-shell main'), frame=stage?.firstElementChild;
  const root=frame&&[...frame.children].find(e=>!e.classList.contains('absolute')&&!e.id.includes('gamepad')&&!e.classList.contains('p22-promotion-hud'));
  const controls=[...toolbar.querySelectorAll('button')].filter(shown).map(e=>{ const r=rect(e),svg=e.querySelector('svg'),s=svg&&rect(svg); return {id:e.id,r,svg:s,display:getComputedStyle(e).display,delta:s?[s.x+s.w/2-r.x-r.w/2,s.y+s.h/2-r.y-r.h/2]:null}; });
  const bad=frame?[...frame.querySelectorAll('button,select,input')].filter(shown).filter(e=>{const r=rect(e),f=rect(frame);return r.x<f.x-1||r.r>f.r+1||r.y<f.y-1||r.b>f.b+1;}).map(e=>({id:e.id,txt:e.textContent.slice(0,70),r:rect(e)})):[];
  const overflow=[...(root?[root,...root.querySelectorAll('*')]:[])].filter(e=>shown(e)&&!['svg','path','circle'].includes(e.tagName)).filter(e=>{ const r=rect(e),f=rect(frame);return r.w>10&&(r.x<f.x-3||r.r>f.r+3||r.y<f.y-3||r.b>f.b+3); }).slice(0,10).map(e=>({tag:e.tagName,id:e.id,cls:typeof e.className==='string'?e.className.slice(0,120):'',txt:e.children.length?'':e.textContent.slice(0,60),r:rect(e)}));
  return {viewport:[innerWidth,innerHeight],docOverflow:document.documentElement.scrollWidth-innerWidth,toolbar:rect(toolbar),controls,stage:stage&&rect(stage),root:root&&{id:root.id,r:rect(root)},canvases:[...document.querySelectorAll('.game-shell canvas')].map(e=>({css:rect(e),back:[e.width,e.height]})),bad,overflow};
}
try {
  for (const [width,height] of profiles) {
    const context=await browser.newContext({viewport:{width,height},isMobile:width<1024,hasTouch:width<1024,deviceScaleFactor:2,reducedMotion:'reduce',serviceWorkers:'block'});
    const page=await context.newPage(); page.setDefaultTimeout(10000);
    page.on('pageerror',e=>all.push({profile:[width,height],error:e.message}));
    await page.goto('http://127.0.0.1:4173'); await page.locator('#play-btn-stack').waitFor(); await page.waitForTimeout(150);
    all.push({profile:[width,height],game:'home',...await page.evaluate(measure)});
    if ([360,568,1280].includes(width)) await page.screenshot({path:`${out}/home-${width}x${height}.png`});
    const ids=await page.locator('[id^="play-btn-"]').evaluateAll(es=>es.map(e=>e.id.slice(9)));
    for (const id of ids) {
      await page.locator('#play-btn-'+id).click();
      await page.waitForFunction(id=>document.querySelector('.game-shell')?.getAttribute('data-p18-game')===id,id);
      await page.waitForTimeout(130);
      all.push({profile:[width,height],game:id,...await page.evaluate(measure)});
      if ([360,568,1280].includes(width)&&['matrix','merge','rhythm','blockdrop','airhockey','snake','orbit','typerush','chain'].includes(id)) await page.screenshot({path:`${out}/${id}-${width}x${height}.png`});
      await page.locator('#game-back-btn').click(); await page.locator('.game-shell').waitFor({state:'detached'});
    }
    for (const [id,label] of [['header-leaderboards-pill-btn','Overall leaderboards'],['header-rank-badge-btn','Player profile'],['stats-open-btn','Arcade statistics']]) {
      await page.locator('#'+id).click(); await page.waitForTimeout(200);
      if ([360,568,1280].includes(width)) await page.screenshot({path:`${out}/${id}-${width}x${height}.png`});
      await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    }
    await context.close(); console.log('SCANNED',width,height);
  }
} finally {
  await fs.writeFile(`${out}/geometry.json`,JSON.stringify(all,null,2)); await browser.close();
}
console.log('Geometry and screenshots captured. This is evidence collection, not release certification.');
