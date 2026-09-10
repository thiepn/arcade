import { defaultScoreMode } from '../../shared/scoring';
import { AP_SCALE,POLICY_ID,RunReceipt,UUID,displayPoints,displayRating,getPolicy,safeInteger } from '../../shared/leaderboard/domain';
import { UserStats } from '../types';
import { leaderboardBase,leaderboardRequest,existingCredential,IDENTITY_EVENT } from './leaderboardIdentity';
import { enqueueUpload,flushUploads,getUploadHistory,PUBLISHED_EVENT } from './leaderboardOutbox';
import { LeaderboardError } from './leaderboardRequest';
export type LeaderboardDivision='diamond'|'platinum'|'gold'|'silver'|'bronze';
export type LeaderboardScope='game'|'global';
export interface LeaderboardEntry{
 id:string;rank:number;name:string;score:number;rawScore?:number;modeId?:string;scoreVersion?:number;
 apMicros?:number;contributionMicros?:number;country:string;countryCode:string;timestamp:string;achievedAt?:number;
 isUser?:boolean;badge?:string;avatarSeed?:number;division?:LeaderboardDivision;trend?:'up'|'down'|'same';level?:number;
}
export interface GlobalOverallEntry{
 id:string;rank:number;name:string;ratingScore:number;totalScore:number;badgesUnlocked:number;
 country:string;countryCode:string;badgeTitle:string;division:LeaderboardDivision;level:number;isUser?:boolean;timestamp:string;
 gamesPlayed?:number;contributionMicros?:number;apMicros?:number;
}
export interface LeaderboardPlaySession{
 id:string;playerId:string;gameId:string;modeId:string;clientStartedAt:number;issuedAt:number;expiresAt:number;uploadExpiresAt:number;policyId:string;
}
export interface Contribution{gameId:string;modeId:string;rawScore:number;apMicros:number;contributionMicros:number;completedAt:number}
export interface BoardMeta{asOf?:number;offset?:number;nextOffset?:number|null;cachedAt?:number;contributions?:Contribution[]}
export interface GameLeaderboardData extends BoardMeta{topEntries:LeaderboardEntry[];userRank:number|null;userEntry:LeaderboardEntry|null;totalCompetitors:number}
export interface OverallLeaderboardData extends BoardMeta{topEntries:GlobalOverallEntry[];userRank:number|null;userEntry:GlobalOverallEntry;totalWorldCompetitors:number;weekStart?:number;weekEnd?:number}
export interface GuestProfileData{id:string;name:string;countryCode:string;createdAt:number;submissions:number;rankedGames:number;reviews?:number;legacyRuns?:number}
interface ServerRow{
 id:string;name:string;country_code:string;rank:number;ap_micros:number;contribution_micros:number;
 raw_score?:number;mode_id?:string;source_version?:number;achieved_at:number;last_achieved_at:number;games_played:number;isUser?:boolean;
}
interface ServerBoard{entries:ServerRow[];userEntry:ServerRow|null;totalCompetitors:number;asOf:number;offset:number;nextOffset:number|null;contributions:Contribution[];weekStart?:number;weekEnd?:number}
const CACHE_PREFIX='micro_arcade_board_v3:';
export const LEADERBOARD_UPDATED_EVENT='micro-arcade-leaderboards-updated';
const cache=new Map<string,{owner:string;policyId:string;savedAt:number;data:unknown}>();
let profile:GuestProfileData|null=null;
const owner=()=>existingCredential()?.split('.')[0]??'anonymous';
export const isLiveLeaderboardConfigured=()=>Boolean(leaderboardBase());
function emit(){if(typeof window!=='undefined')window.dispatchEvent(new Event(LEADERBOARD_UPDATED_EVENT));}
export function getDivisionForRank(rank:number):LeaderboardDivision{return rank===1?'diamond':rank<=3&&rank>0?'platinum':rank<=6&&rank>0?'gold':rank<=10&&rank>0?'silver':'bronze';}
export function getDivisionColor(v:LeaderboardDivision):string{return {diamond:'#38BDF8',platinum:'#A855F7',gold:'#FACC15',silver:'#E2E8F0',bronze:'#FB923C'}[v]??'#FB923C';}
function flag(code:string):string{return /^[A-Z]{2}$/.test(code)&&code!=='XX'?String.fromCodePoint(...[...code].map(c=>127397+c.charCodeAt(0))):'🌐';}
function timestamp(ms:number):string{return new Date(ms).toLocaleString();}
function checkRow(r:unknown):r is ServerRow{
 if(!r||typeof r!=='object')return false;const x=r as ServerRow;
 return UUID.test(x.id??'')&&typeof x.name==='string'&&x.name.length<=100&&/^[A-Z]{2}$/.test(x.country_code??'')&&safeInteger(x.rank,1)&&
  safeInteger(x.ap_micros)&&safeInteger(x.contribution_micros,0,320000*AP_SCALE)&&safeInteger(x.games_played,1,32)&&safeInteger(x.last_achieved_at)&&safeInteger(x.achieved_at);
}
function checkContributions(value:unknown):value is Contribution[]{
 return Array.isArray(value)&&value.length<=32&&value.every(c=>c&&typeof c==='object'&&getPolicy(c.gameId,c.modeId)&&safeInteger(c.rawScore)&&safeInteger(c.apMicros)&&safeInteger(c.contributionMicros,0,10000*AP_SCALE)&&safeInteger(c.completedAt));
}
function checkBoard(data:unknown):asserts data is ServerBoard{
 const b=data as ServerBoard;
 if(!b||!Array.isArray(b.entries)||b.entries.length>50||!b.entries.every(checkRow)||(b.userEntry!==null&&!checkRow(b.userEntry))||!safeInteger(b.totalCompetitors)||!safeInteger(b.asOf)||!safeInteger(b.offset,0,10000)||
  (b.nextOffset!==null&&!safeInteger(b.nextOffset,0,10000))||!checkContributions(b.contributions)||b.entries.some(r=>r.rank>b.totalCompetitors)||(b.userEntry&&b.userEntry.rank>b.totalCompetitors))throw new LeaderboardError('invalid_response','Invalid leaderboard data.',503);
}
function cached(key:string):ServerBoard|null{
 try{const record=cache.get(key)??JSON.parse(localStorage.getItem(CACHE_PREFIX+key)??'null');
  if(!record||record.owner!==owner()||record.policyId!==POLICY_ID||!safeInteger(record.savedAt)||Date.now()-record.savedAt>86400000)return null;
  checkBoard(record.data);return record.data;
 }catch{return null;}
}
function save(key:string,data:ServerBoard){
 const record={owner:owner(),policyId:POLICY_ID,savedAt:Date.now(),data};cache.set(key,record);try{localStorage.setItem(CACHE_PREFIX+key,JSON.stringify(record));}catch{}emit();
}
export function resetAllLeaderboards():void{
 cache.clear();profile=null;
 try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k?.startsWith(CACHE_PREFIX))localStorage.removeItem(k);}
  localStorage.removeItem('micro_arcade_live_leaderboards_v2');localStorage.removeItem('micro_arcade_global_leaderboards_v2');
 }catch{}emit();
}
if(typeof window!=='undefined'){
 window.addEventListener(IDENTITY_EVENT,resetAllLeaderboards);window.addEventListener(PUBLISHED_EVENT,resetAllLeaderboards);
 window.addEventListener('storage',e=>{if(e.key==='micro_arcade_guest_credential_v1'){resetAllLeaderboards();window.dispatchEvent(new Event(IDENTITY_EVENT));}});
}
function gameRow(r:ServerRow):LeaderboardEntry{return {id:r.id,rank:r.rank,name:r.name,score:displayPoints(r.ap_micros),apMicros:r.ap_micros,contributionMicros:r.contribution_micros,
 rawScore:safeInteger(r.raw_score)?r.raw_score:undefined,modeId:r.mode_id,scoreVersion:r.source_version,country:flag(r.country_code),countryCode:r.country_code,
 timestamp:timestamp(r.achieved_at),achievedAt:r.achieved_at,isUser:r.id===owner(),division:getDivisionForRank(r.rank)};}
function overallRow(r:ServerRow):GlobalOverallEntry{return {id:r.id,rank:r.rank,name:r.name,ratingScore:displayRating(r.contribution_micros),totalScore:displayPoints(r.ap_micros),
 apMicros:r.ap_micros,contributionMicros:r.contribution_micros,gamesPlayed:r.games_played,badgesUnlocked:0,country:flag(r.country_code),countryCode:r.country_code,
 badgeTitle:`${r.games_played} ranked ${r.games_played===1?'game':'games'}`,division:getDivisionForRank(r.rank),level:1,isUser:r.id===owner(),timestamp:timestamp(r.last_achieved_at)};}
const meta=(b:ServerBoard):BoardMeta=>({asOf:b.asOf,offset:b.offset,nextOffset:b.nextOffset,contributions:b.contributions});
function gameBoard(b:ServerBoard):GameLeaderboardData{return {...meta(b),topEntries:b.entries.map(gameRow),userRank:b.userEntry?.rank??null,userEntry:b.userEntry?gameRow(b.userEntry):null,totalCompetitors:b.totalCompetitors};}
function emptyOverall():OverallLeaderboardData{return {topEntries:[],userRank:null,totalWorldCompetitors:0,contributions:[],userEntry:{id:'local-user',rank:0,name:'Not ranked',ratingScore:0,totalScore:0,badgesUnlocked:0,country:'🌐',countryCode:'XX',badgeTitle:'No published record',division:'bronze',level:1,timestamp:'Not ranked',isUser:true}};}
function overallBoard(b:ServerBoard):OverallLeaderboardData{return {...meta(b),topEntries:b.entries.map(overallRow),userRank:b.userEntry?.rank??null,userEntry:b.userEntry?overallRow(b.userEntry):emptyOverall().userEntry,totalWorldCompetitors:b.totalCompetitors,weekStart:b.weekStart??undefined,weekEnd:b.weekEnd??undefined};}
export interface PageOptions{offset?:number;asOf?:number;signal?:AbortSignal}
async function readBoard(path:string,key:string,options:PageOptions={}):Promise<ServerBoard>{
 const params=new URLSearchParams({limit:'20',offset:String(options.offset??0)});if(options.asOf!==undefined)params.set('asOf',String(options.asOf));
 const separator=path.includes('?')?'&':'?';const requestOwner=owner();
 const data=await leaderboardRequest<ServerBoard>(path+separator+params,{signal:options.signal});checkBoard(data);
 if(requestOwner!==owner())throw new LeaderboardError('identity_changed','Player changed. Refresh this leaderboard.',409);
 if(!options.offset)save(key,data);return data;
}
export async function refreshGameLeaderboard(gameId:string,modeId='all',options:PageOptions={}):Promise<GameLeaderboardData>{
 if(modeId!=='all'&&!getPolicy(gameId,modeId))throw new Error('Unknown game mode');
 return gameBoard(await readBoard(`/v3/leaderboards/${encodeURIComponent(gameId)}?mode=${encodeURIComponent(modeId)}`,`game:${gameId}:${modeId}`,options));
}
export async function refreshOverallLeaderboard(options:PageOptions={}):Promise<OverallLeaderboardData>{return overallBoard(await readBoard('/v3/leaderboards/overall','overall',options));}
export async function refreshWeeklyOverallLeaderboard(options:PageOptions={}):Promise<OverallLeaderboardData>{return overallBoard(await readBoard('/v3/leaderboards/weekly','weekly',options));}
export function getGlobalLeaderboardForGame(gameId:string,_localAP=0,_raw=0,modeId='all'):GameLeaderboardData{
 const saved=cached(`game:${gameId}:${modeId}`);return saved?gameBoard(saved):{topEntries:[],userRank:null,userEntry:null,totalCompetitors:0,contributions:[]};
}
export function getOverallArcadeLeaderboard(_stats?:UserStats):OverallLeaderboardData{const saved=cached('overall');return saved?overallBoard(saved):emptyOverall();}
export function getWeeklyOverallLeaderboard(_stats?:UserStats):OverallLeaderboardData{const saved=cached('weekly');return saved&&(!saved.weekEnd||saved.weekEnd>Date.now())?overallBoard(saved):emptyOverall();}
export async function getGuestProfile():Promise<GuestProfileData>{
 const data=await leaderboardRequest<{player:{id:string;name:string;countryCode:string;createdAt:number};activity:{submissions:number;rankedGames:number;reviews?:number;legacyRuns?:number}}>('/v3/me',{},true);
 if(!data.player||!UUID.test(data.player.id)||typeof data.player.name!=='string'||!safeInteger(data.activity?.submissions)||!safeInteger(data.activity.rankedGames,0,32))throw new LeaderboardError('invalid_response','Invalid player profile.',503);
 profile={...data.player,...data.activity};emit();return profile;
}
export function getCachedGuestProfile():GuestProfileData|null{return profile?.id===owner()?profile:null;}
export async function updateGuestDisplayName(name:string):Promise<void>{await leaderboardRequest('/v3/me',{method:'PATCH',body:JSON.stringify({name})},true);resetAllLeaderboards();}
export async function simulateLiveCompetition(gameId:string):Promise<void>{await Promise.allSettled([refreshGameLeaderboard(gameId),refreshOverallLeaderboard(),refreshWeeklyOverallLeaderboard()]);}
export async function getPlayerContributions(playerId:string,weekly=false,asOf?:number):Promise<Contribution[]>{
 if(!UUID.test(playerId))throw new Error('Invalid player');const query=new URLSearchParams({period:weekly?'weekly':'overall'});if(asOf)query.set('asOf',String(asOf));
 const data=await leaderboardRequest<{contributions:unknown}>(`/v3/players/${playerId}/contributions?${query}`);if(!checkContributions(data.contributions))throw new LeaderboardError('invalid_response','Invalid contribution breakdown.',503);return data.contributions;
}
export async function beginLeaderboardSession(gameId:string,modeId=defaultScoreMode(gameId),requestId:string=crypto.randomUUID(),clientStartedAt=performance.now()):Promise<LeaderboardPlaySession|null>{
 if(!isLiveLeaderboardConfigured()||navigator.onLine===false)return null;
 const data=await leaderboardRequest<{session:Omit<LeaderboardPlaySession,'clientStartedAt'>}>('/v3/sessions',{method:'POST',body:JSON.stringify({requestId,gameId,modeId,scoreVersion:2,protocolVersion:3,policyId:POLICY_ID})},true);
 const s=data.session;
 if(!s||!UUID.test(s.id)||!UUID.test(s.playerId)||s.gameId!==gameId||s.modeId!==modeId||s.policyId!==POLICY_ID||!safeInteger(s.issuedAt)||s.expiresAt!==s.issuedAt+21600000||s.uploadExpiresAt!==s.expiresAt+604800000)throw new LeaderboardError('invalid_response','Session did not match this run.',503);
 return {...s,clientStartedAt};
}
export async function submitLeaderboardScore(session:LeaderboardPlaySession,rawScore:number,modeId=session.modeId,durationMs=Math.max(0,Math.floor(performance.now()-session.clientStartedAt)),activeMs=durationMs):Promise<boolean>{
 if(!safeInteger(rawScore)||modeId!==session.modeId)throw new Error('Invalid run score or mode');
 await enqueueUpload({id:session.id,playerId:session.playerId,gameId:session.gameId,createdAt:Date.now(),payload:{sessionId:session.id,rawScore,modeId,scoreVersion:2,protocolVersion:3,policyId:session.policyId,durationMs,activeMs}});
 await flushUploads();return (await getUploadHistory()).find(r=>r.id===session.id)?.status==='accepted';
}