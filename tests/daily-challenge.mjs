import assert from 'node:assert/strict';
import {
  DAILY_CHALLENGE_STRONG_AP,
  applyDailyChallengeRun,
  dailyChallengeGameId,
  getDailyChallengeView,
  millisecondsUntilNextUtcDay,
  normalizeDailyChallengeState,
  previousUtcDayKey,
  utcDayKey,
} from '../src/lib/dailyChallenge.ts';

const ids=['orbit','stack','reaction','dodge'];
assert.equal(utcDayKey(Date.parse('2026-10-05T23:59:59.999Z')),'2026-10-05');
assert.equal(utcDayKey(Date.parse('2026-10-06T00:00:00.000Z')),'2026-10-06');
assert.equal(previousUtcDayKey('2026-03-01'),'2026-02-28');
assert.ok(millisecondsUntilNextUtcDay(Date.parse('2026-10-05T23:59:59Z'))>=1000);

const cycle=new Set();
for(let day=0;day<ids.length;day++){
  const date=new Date(Date.UTC(2026,0,1+day)).toISOString().slice(0,10);
  cycle.add(dailyChallengeGameId(date,ids));
}
assert.equal(cycle.size,ids.length,'daily rotation covers every cabinet before repeating');

const now=Date.parse('2026-10-05T12:00:00Z');
const today=utcDayKey(now);
const game=dailyChallengeGameId(today,ids);
const other=ids.find(id=>id!==game);

let state=normalizeDailyChallengeState(undefined);
let run=applyDailyChallengeRun(state,ids,other,4000,now);
assert.equal(run.wasDailyChallenge,false);
assert.equal(run.view.completed,false);

run=applyDailyChallengeRun(state,ids,game,0,now);
assert.equal(run.wasDailyChallenge,true);
assert.equal(run.justCompleted,false);
assert.equal(run.view.completed,false);

run=applyDailyChallengeRun(run.state,ids,game,850,now);
assert.equal(run.justCompleted,true);
assert.equal(run.view.completed,true);
assert.equal(run.view.currentStreak,1);
assert.equal(run.view.totalCompleted,1);
state=run.state;

run=applyDailyChallengeRun(state,ids,game,3500,now);
assert.equal(run.justCompleted,false,'same-day retries do not duplicate completion');
assert.equal(run.justReachedStrongGoal,true);
assert.equal(run.view.bestAP,3500);
assert.equal(run.view.strongGoalReached,true);
assert.equal(run.view.totalCompleted,1);

const tomorrow=Date.parse('2026-10-06T12:00:00Z');
const tomorrowGame=dailyChallengeGameId(utcDayKey(tomorrow),ids);
run=applyDailyChallengeRun(run.state,ids,tomorrowGame,1,tomorrow);
assert.equal(run.justCompleted,true);
assert.equal(run.view.currentStreak,2);
assert.equal(run.view.bestStreak,2);
assert.equal(run.view.totalCompleted,2);

const gap=Date.parse('2026-10-08T12:00:00Z');
const gapGame=dailyChallengeGameId(utcDayKey(gap),ids);
run=applyDailyChallengeRun(run.state,ids,gapGame,DAILY_CHALLENGE_STRONG_AP,gap);
assert.equal(run.view.currentStreak,1,'missed UTC day resets streak');
assert.equal(run.view.bestStreak,2);
assert.equal(run.justReachedStrongGoal,true);

const staleView=getDailyChallengeView(run.state,ids,Date.parse('2026-10-10T12:00:00Z'));
assert.equal(staleView.completed,false);
assert.equal(staleView.bestAP,0);
assert.equal(staleView.currentStreak,0);

const corrupted=normalizeDailyChallengeState({dayKey:'nope',bestAP:-1,completed:true,currentStreak:-4,bestStreak:2,totalCompleted:3});
assert.equal(corrupted.dayKey,undefined);
assert.equal(corrupted.bestAP,0);
assert.equal(corrupted.completed,false);
assert.equal(corrupted.currentStreak,0);

console.log('P28 DAILY CHALLENGE — PASS');
