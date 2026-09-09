import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { SCORING_PROFILES, RHYTHM_MODES, SCORE_VERSION, toArcadePoints, defaultScoreMode, isScoreMode, arcadeRating, arcadeTotal } from '../shared/scoring';
import { GAME_RULES, SESSION_TTL_MS, scoreContext } from '../shared/scoringProtocol';
import { chainOrbReward, matrixStepBase, driftTickReward, DRIFT_TIER_TICKS, pulsePerfectReward, rhythmComboMultiplier } from '../src/lib/scoringEconomy';
import { GAMES_REGISTRY } from '../src/data/games';
import { RHYTHM_SONGS } from '../src/lib/rhythmSongs';
import { getRhythmHoldCompletionBonus } from '../src/lib/rhythmHoldMastery';
import { REACTION_ROUNDS, scoreReactionAttempt } from '../src/lib/reactionGameplay';
import { REACTION_OVERTIME_ROUNDS } from '../src/lib/reactionOvertime';
import { getReactionCircuitCompletionBonus } from '../src/lib/reactionCircuits';
import { PERFECT_STOP_ROUNDS, judgePerfectStop } from '../src/lib/perfectStopGameplay';
import { PERFECT_STOP_ENCORE_ROUNDS } from '../src/lib/perfectStopEncore';
import { createPerfectStopRouteState, advancePerfectStopRoute } from '../src/lib/perfectStopBeaconRoutes';
import { AIR_HOCKEY_DIFFICULTY_CONFIG } from '../src/lib/airHockeyFairness';

let checks=0;
const check=(condition: unknown,message: string)=>{checks++;assert.ok(condition,message);};
const ids=Object.keys(SCORING_PROFILES);
assert.deepEqual(new Set(ids),new Set(GAMES_REGISTRY.map(g=>g.id)));
assert.deepEqual(new Set(ids),new Set(Object.keys(GAME_RULES)));
check(ids.length===32,'complete roster');
const golden: { game: string; mode: string; version: number; raw: number; points: number }[]=[];
let modeCount=0;
for(const [id,p] of Object.entries(SCORING_PROFILES)) {
  const modes=id==='rhythm'?Object.keys(RHYTHM_MODES):id==='airhockey'?['EASY','MEDIUM','HARD']:['standard'];
  modeCount+=modes.length;
  for(const anchors of [p.anchors,p.legacyAnchors]) check(anchors.length===3&&anchors[0]>0&&anchors[1]>anchors[0]&&anchors[2]>anchors[1],`${id} ordered anchors`);
  for(const mode of modes) {
    check(isScoreMode(id,mode),`${id}/${mode} supported`);
    check(scoreContext(id,2,mode)?.modeId===mode,`${id}/${mode} token context`);
    for(const raw of [-1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])check(toArcadePoints(id,raw,mode)===0,`${id}/${mode}: reject invalid`);
    const anchors=id==='rhythm'?RHYTHM_MODES[mode].anchors:p.anchors;
    const reward=id==='rhythm'?RHYTHM_MODES[mode].reward:1;
    [1000,3000,6000].forEach((points,i)=>check(toArcadePoints(id,anchors[i],mode)===Math.floor(points*reward),`${id}/${mode} benchmark ${i}`));
    check(toArcadePoints(id,2*anchors[2],mode)===Math.floor(8000*reward),`${id}/${mode}: longer successful play rewarded`);
    check(toArcadePoints(id,4*anchors[2],mode)===Math.floor(10000*reward),`${id}/${mode}: endless contribution`);
    let previous=-1;
    for(let step=0;step<=3000;step++) {
      const raw=Math.floor(anchors[2]*Math.pow(10,step/1000)/10);
      const points=toArcadePoints(id,raw,mode);
      check(points>=previous,`${id}/${mode} monotonic ${raw}`); previous=points;
    }
    const rawSamples=[0,1,anchors[0]-1,anchors[0],anchors[0]+1,anchors[1]-1,anchors[1],anchors[1]+1,anchors[2]-1,anchors[2],anchors[2]+1,anchors[2]*2,anchors[2]*4,1_000_000,1_000_000_000,Number.MAX_SAFE_INTEGER];
    for(const raw of rawSamples)golden.push({game:id,mode,version:2,raw,points:toArcadePoints(id,raw,mode)});
    check(toArcadePoints(id,Number.MAX_SAFE_INTEGER,mode)<150000,`${id}/${mode}: even the numeric ceiling cannot produce a million AP`);
    check(toArcadePoints(id,0,mode)===0,`${id}/${mode}: no attendance points`);
  }
  for(const raw of [0,1,...p.legacyAnchors,p.legacyAnchors[2]*2,p.legacyAnchors[2]*4,1_000_000]) golden.push({game:id,mode:'legacy',version:1,raw,points:toArcadePoints(id,raw,undefined,1)});
  check(toArcadePoints(id,p.anchors[1],'nope',2)===0,`${id}: unknown mode closed`);
  check(toArcadePoints(id,p.anchors[1],undefined,3)===0,`${id}: unknown version closed`);
  check(scoreContext(id,1,undefined)?.modeId==='legacy',`${id}: legacy clients isolated`);
}
check(modeCount===36,'32 cabinets / 36 selectable game-mode configurations');
for(const id of ['missing','__proto__','constructor'])check(toArcadePoints(id,1e9)===0&&scoreContext(id,2,'standard')===null,'unknown games closed');
check(SCORE_VERSION===2&&SESSION_TTL_MS===21600000,'version/session lifetime');
check(GAME_RULES.reaction.maxScore>24000,'legitimate reaction overtime no longer blocked by 10k raw ceiling');
check(arcadeRating({chain:1_000_000})===10000,'single-game overall limit');
check(arcadeRating({orbit:3000,stack:3000,reaction:3000,dodge:3000})>arcadeRating({chain:1_000_000}),'four strong games beat any specialist record');
check(arcadeRating(Object.fromEntries(ids.map(id=>[id,0])))===0,'playing every game for zero never wins rating');
check(arcadeRating(Object.fromEntries(ids.map(id=>[id,10000])))===320000,'all-cabinet ceiling');
check(arcadeTotal({chain:20000,stack:4000})===24000,'uncapped total still rewards longer runs');
check(arcadeRating({chain:20000,stack:4000})===14000,'rating versus total distinguished');
check(arcadeRating({missing:1e9,orbit:NaN,stack:-1})===0,'bad local values cannot affect rating');

// Real engine reward helpers, not a second implementation of the patched formulas.
for(let n=1;n<=100000;n+=37) {
 check(chainOrbReward(n)<=392&&chainOrbReward(n,true)<=784,'bounded Chain orb rewards');
 check(matrixStepBase(n)<=600,'bounded Matrix step');
 check(pulsePerfectReward(n)<=750,'bounded Pulse precision');
 check(rhythmComboMultiplier(n,true)<=3,'bounded Rhythm fever combo');
}
check(pulsePerfectReward(11)>pulsePerfectReward(1),'Pulse skill streak still rewarded');
check(pulsePerfectReward(100)/240<3.2,'perfect versus great no longer 18.75x');
check(DRIFT_TIER_TICKS===180,'Drift tiers earned over three seconds');
const oldChain36=Array.from({length:36},(_,i)=>(i+1)*140*(Math.floor((i+1)/4)+1)).reduce((a,b)=>a+b,0);
const newChain36=Array.from({length:36},(_,i)=>chainOrbReward(i+1)).reduce((a,b)=>a+b,0);
const oldDriftMinute=60*60*10*6,newDriftMinute=60*60*driftTickReward(6,false);
check(oldChain36/newChain36>40,'Chain cubic accumulation removed');
check(oldDriftMinute/newDriftMinute===10,'Drift fixed-tick reward reduced tenfold');
check(driftTickReward(6,true)===12,'Boost remains worth 2x');

// Finite games: score the actual authored rounds; faster/more accurate attempts must win.
const reactionRuns=[0,200,400,650].map(ms=>{
 const raw=[...REACTION_ROUNDS,...REACTION_OVERTIME_ROUNDS].reduce((sum,c)=>sum+scoreReactionAttempt(c,ms,true).points,0)+[0,1,2].reduce((sum,i)=>sum+getReactionCircuitCompletionBonus('SPEED',i,true),0);
 return {reactionMs:ms,raw,points:toArcadePoints('reaction',raw)};
});
for(let i=1;i<reactionRuns.length;i++)check(reactionRuns[i-1].points>reactionRuns[i].points,'Reaction faster correct responses earn more');
check(reactionRuns[0].raw<GAME_RULES.reaction.maxScore,'all overtime rounds within validation range');
let streak=0,stopRaw=0,route=createPerfectStopRouteState();
for(const [i,cfg] of [...PERFECT_STOP_ROUNDS,...PERFECT_STOP_ENCORE_ROUNDS].entries()){
 const r=judgePerfectStop(50,50,cfg,streak);streak=r.nextStreak;
 const resolved=advancePerfectStopRoute(route,'PRIMARY',r.rating,i);route=resolved.state;stopRaw+=r.points+resolved.bonus;
}
const perfectStop={raw:stopRaw,points:toArcadePoints('perfectstop',stopRaw)};
check(perfectStop.points>6000&&perfectStop.points<10000,'perfect finite run fits the shared economy');

// Authored charts loop. This is an ideal-event score model, not a claim of a human full combo.
const charts=RHYTHM_SONGS.map(song=>{
 let native=0,oldNative=0;
 for(const [i,note] of [...song.notes].sort((a,b)=>a.time-b.time).entries()){
  const combo=i+1,points=350*(note.type==='bonus'?2:1);
  // Full-combo upper budget: allow fever once unlocked. Holds cannot exceed the bounded multiplier.
  const newMult=rhythmComboMultiplier(combo,combo>15);
  const oldMult=(combo>=50?8:combo>=25?4:combo>=12?3:combo>=5?2:1)*(combo>15?2:1);
  native+=Math.round(points*newMult);oldNative+=Math.round(points*oldMult);
  if(note.type==='hold') {native+=getRhythmHoldCompletionBonus(note.holdBeats??0,3);oldNative+=getRhythmHoldCompletionBonus(note.holdBeats??0,16);}
 }
 native+=5000;oldNative+=5000;
 return {id:song.id,difficulty:song.difficulty,seconds:song.durationBeats*60/song.bpm,notes:song.notes.length,oldNativeBudget:oldNative,newNativeBudget:native,points:toArcadePoints('rhythm',native,song.id),secondLoopPoints:toArcadePoints('rhythm',native*2,song.id)};
});
const ordered=['neon_midnight','cyber_odyssey','hypernova'].map(id=>charts.find(c=>c.id===id)!);
check(ordered[0].points<ordered[1].points&&ordered[1].points<ordered[2].points,'harder chart full-combo budgets earn more');
charts.forEach(c=>check(c.secondLoopPoints>c.points&&c.secondLoopPoints<16000,'repeat-chart survival rewarded without inflation'));
const hockey=['EASY','MEDIUM','HARD'].map(mode=>{
 const base=AIR_HOCKEY_DIFFICULTY_CONFIG[mode as keyof typeof AIR_HOCKEY_DIFFICULTY_CONFIG].pointsPerGoal;
 const raw=[1,2,3,4,4,4].reduce((s,n)=>s+n*base,0);
 return {mode,raw,points:toArcadePoints('airhockey',raw,mode)};
});
check(hockey[0].points<hockey[1].points&&hockey[1].points<hockey[2].points,'same six goals reward tougher AI more, without double multiplier');
// Ensure the changed engines actually use these audited helpers.
for(const [file,helper] of [['Chain','chainOrbReward'],['Drift','driftTickReward'],['Matrix','matrixStepBase'],['Pulse','pulsePerfectReward'],['Rhythm','rhythmComboMultiplier']])check(readFileSync(`src/games/${file}Game.tsx`,'utf8').includes(helper+'('),`${file}: helper integrated`);
mkdirSync('balance-report',{recursive:true});
writeFileSync('balance-report/golden.json',JSON.stringify(golden,null,2));
writeFileSync('balance-report/models.json',JSON.stringify({method:'Source-derived deterministic budgets and design benchmarks; not measured human percentiles.',checks,cabinets:32,modes:modeCount,chain:{oldChain36,newChain36},drift:{oldDriftMinute,newDriftMinute},reactionRuns,perfectStop,charts,hockey},null,2));
console.log(`Scoring v2 PASS: ${checks} assertions, 32 games / ${modeCount} modes, ${golden.length} SQL parity vectors.`);
console.log(JSON.stringify({reactionRuns,perfectStop,charts,hockey},null,2));
