import type { UserStats,ScoreDetails } from '../types';
import { AP_SCALE,apMicros,contributionMicros,getPolicy } from '../../shared/leaderboard/domain';
export type LocalModeBest=ScoreDetails&{apMicros:number;achievedAt:number};
export function currentGameBests(stats:UserStats):Record<string,LocalModeBest>{
 const result:Record<string,LocalModeBest>={};
 for(const [key,best] of Object.entries(stats.modeBests??{})){
  const gameId=key.split(':')[0];if(best.scoreVersion!==2||!getPolicy(gameId,best.modeId))continue;
  const canonical={...best,apMicros:apMicros(gameId,best.rawScore,best.modeId)};
  if(!result[gameId]||canonical.apMicros>result[gameId].apMicros)result[gameId]=canonical;
 }
 return result;
}
export function localRating(stats:UserStats):number{
 return Object.entries(currentGameBests(stats)).reduce((sum,[id,best])=>sum+contributionMicros(id,best.apMicros,best.modeId),0)/AP_SCALE;
}
export function currentBestAP(stats:UserStats,id:string):number{return Math.floor((currentGameBests(stats)[id]?.apMicros??0)/AP_SCALE);}
export function currentBestRaw(stats:UserStats,id:string):number{return currentGameBests(stats)[id]?.rawScore??0;}
