import assert from 'node:assert/strict';
import {getStoredStats,recordScore,recordGamePlay,saveStats,clearAllStats,isProgressSaved} from '../src/lib/storage';
import {ACHIEVEMENTS_REGISTRY,getPlayerRankProfile} from '../src/lib/achievements';
import {toArcadePoints} from '../shared/scoring';
import {localRating,currentGameBests} from '../src/lib/localCompetition';
const values=new Map<string,string>();let denied=false;
(globalThis as any).window=new EventTarget();
(globalThis as any).localStorage={getItem:(k:string)=>{if(denied)throw Error('denied');return values.get(k)??null;},setItem:(k:string,v:string)=>{if(denied)throw Error('quota');values.set(k,v);},removeItem:(k:string)=>values.delete(k)};
const legacy={highScores:{chain:1_400_000,rhythm:1_700_000,stack:18,reaction:4964},playCounts:{chain:15,stack:3},favorites:['stack'],recentlyPlayed:['stack','chain'],soundEnabled:false,hapticsEnabled:false,volume:.4,theme:'cyberpunk',totalPlayTimeSeconds:{chain:600}};
values.set('micro_arcade_stats_v1',JSON.stringify(legacy));
const migrated=getStoredStats();assert.equal(migrated.recordSchemaVersion,3);assert.deepEqual(migrated.legacyHighScores,legacy.highScores);
for(const [id,raw] of Object.entries(legacy.highScores)){assert.equal(migrated.highScores[id],toArcadePoints(id,raw,undefined,1));assert.equal(migrated.rawHighScores?.[id],raw);}
for(const field of ['playCounts','favorites','recentlyPlayed','soundEnabled','hapticsEnabled','volume','theme','totalPlayTimeSeconds'])assert.deepEqual((migrated as any)[field],(legacy as any)[field]);
assert.ok(values.has('micro_arcade_stats_v3'));
for(let i=0;i<25;i++){saveStats(getStoredStats());assert.deepEqual(getStoredStats().highScores,migrated.highScores);assert.deepEqual(getStoredStats().legacyHighScores,legacy.highScores);}
values.set('micro_arcade_stats_v1',JSON.stringify({...legacy,highScores:{chain:999_999_999}}));assert.deepEqual(getStoredStats().highScores,migrated.highScores,'old clients isolated');
assert.equal(ACHIEVEMENTS_REGISTRY.find(a=>a.id==='score_1m')!.isUnlocked(migrated),true,'earned legacy badges preserved');
assert.equal(getPlayerRankProfile(migrated).ratingScore,0,'old-rule records archived, not new-rule rating');
recordScore('stack',999999,{rawScore:120,modeId:'standard',scoreVersion:2});assert.equal(getStoredStats().highScores.stack,6000,'caller AP ignored in favor of actual raw score');
recordScore('stack',1,{rawScore:200,modeId:'standard',scoreVersion:2});assert.equal(getStoredStats().highScores.stack,toArcadePoints('stack',200));
const stale=getStoredStats();recordScore('stack',1,{rawScore:240,modeId:'standard',scoreVersion:2});saveStats({...stale,soundEnabled:true});assert.equal(getStoredStats().modeBests?.['stack:standard'].rawScore,240,'stale settings cannot clobber PB');
recordScore('rhythm',0,{rawScore:600000,modeId:'neon_midnight',scoreVersion:2});recordScore('rhythm',0,{rawScore:350000,modeId:'hypernova',scoreVersion:2});
assert.equal(currentGameBests(getStoredStats()).rhythm.modeId,'hypernova','stronger AP record tied to its actual native score and mode');
assert.equal(getPlayerRankProfile(getStoredStats()).ratingScore,localRating(getStoredStats()));
denied=true;recordScore('stack',1,{rawScore:300,modeId:'standard',scoreVersion:2});recordGamePlay('stack');assert.equal(getStoredStats().modeBests?.['stack:standard'].rawScore,300);assert.equal(isProgressSaved(),false);
denied=false;saveStats(getStoredStats());assert.equal(isProgressSaved(),true);
clearAllStats();assert.deepEqual(getStoredStats().modeBests,{});assert.deepEqual(getStoredStats().rawHighScores,{});assert.equal(values.has('micro_arcade_stats_v1'),false);
assert.equal(ACHIEVEMENTS_REGISTRY.find(a=>a.id==='score_1m')!.isUnlocked(getStoredStats()),false);
// Already-migrated v2 profiles must recover legacy native PB evidence too.
values.delete('micro_arcade_stats_v3');values.set('micro_arcade_stats_v2',JSON.stringify({scoreVersion:2,highScores:{stack:1363},legacyHighScores:{stack:18},bestScoreDetails:{}}));
assert.equal(getStoredStats().rawHighScores?.stack,18);assert.equal(localRating(getStoredStats()),0);
console.log('Scoring storage PASS: v1/v2→v3, archive preservation, 25 idempotent cycles, mode PBs, canonical AP, stale writes, denied storage, reset.');
