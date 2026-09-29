import React,{useCallback,useEffect,useRef,useState} from 'react';
import { ArrowLeft, CalendarDays, ChevronRight, Crown, Gamepad2, Globe2, Medal, RefreshCw, ShieldCheck, Sparkles, Trophy, Users } from 'lucide-react';
import { GAMES_REGISTRY } from '../data/games';
import type { UserStats } from '../types';
import { AP_SCALE,formatPoints,modeLabel,modesFor,POLICY_ID,RATING_GAME_COUNT,SUBMISSION_MESSAGES } from '../../shared/leaderboard/domain';
import { currentGameBests,localRating } from '../lib/localCompetition';
import { existingCredential,exportPlayerRecoveryCode,restorePlayerRecoveryCode,IDENTITY_EVENT,leaderboardRequest } from '../lib/leaderboardIdentity';
import { flushUploads,getUploadHistory,OUTBOX_EVENT,PUBLISHED_EVENT,refreshReviewedUploads,uploadsAreDurable,type PendingRun } from '../lib/leaderboardOutbox';
import { GameLeaderboardData,GlobalOverallEntry,LeaderboardEntry,LeaderboardDivision,OverallLeaderboardData,PublicPlayerProfileData,getGlobalLeaderboardForGame,getOverallArcadeLeaderboard,getWeeklyOverallLeaderboard,getPublicPlayerProfile,isLiveLeaderboardConfigured,refreshGameLeaderboard,refreshOverallLeaderboard,refreshWeeklyOverallLeaderboard } from '../lib/leaderboards';
import './leaderboard.css';
type Scope='overall'|'weekly'|'game';
type Board=GameLeaderboardData|OverallLeaderboardData;
type Entry=LeaderboardEntry|GlobalOverallEntry;
const titleFor=(id:string)=>GAMES_REGISTRY.find(g=>g.id===id)?.title??id;
function briefError(error:unknown):string{return error instanceof Error?error.message:'The leaderboard could not be loaded.';}
const total=(board:Board)=>'totalCompetitors'in board?board.totalCompetitors:board.totalWorldCompetitors;

export function UploadManager(){
 const [runs,setRuns]=useState<PendingRun[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let alive=true;const update=()=>{void getUploadHistory().then(rows=>{if(alive)setRuns(rows.sort((a,b)=>b.createdAt-a.createdAt));}).catch(e=>{if(alive)setError(briefError(e));});};
  update();window.addEventListener(OUTBOX_EVENT,update);return()=>{alive=false;window.removeEventListener(OUTBOX_EVENT,update);};},[]);
 const pending=runs.filter(r=>r.status==='pending'||r.status==='auth-required').length;
 const review=runs.filter(r=>r.status==='review').length;
 return <details className="lb-details" data-upload-manager><summary>Uploads · {pending} pending{review?` · ${review} in review`:''}</summary>
  <p>Queued runs survive reloads and retry when this app is open and online. They stay bound to the original player. Playing offline without an online session saves a local record only.</p>
  {!uploadsAreDurable()&&<p className="lb-warning">Durable upload storage is unavailable. Keep this tab open until submission succeeds.</p>}
  <button type="button" className="lb-button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await flushUploads(true);await refreshReviewedUploads();}catch(e){setError(briefError(e));}finally{setBusy(false);}}}>{busy?'Checking…':'Retry / check uploads'}</button>
  {error&&<p role="alert">{error}</p>}
  <ul className="lb-history">{runs.slice(0,20).map(r=><li key={r.id}><strong>{titleFor(r.gameId)}</strong> · {modeLabel(r.gameId,r.payload.modeId)}<br/>
   Score {r.payload.rawScore.toLocaleString()} · <span>{r.status==='accepted'?'Published':r.status==='auth-required'?'Restore original player':r.status}</span>
   {r.lastError&&r.lastError!=='ok'&&<p>{SUBMISSION_MESSAGES[r.lastError]??'Upload status: '+r.lastError}</p>}
  </li>)}</ul>{!runs.length&&<p>No uploads are queued on this device.</p>}
 </details>;
}
export function PlayerRecovery(){
 const [code,setCode]=useState(''),[restore,setRestore]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const reveal=()=>{const value=exportPlayerRecoveryCode();if(value)setCode(value);else setMessage('Play an online game or create a player profile first.');};
 return <details className="lb-details"><summary>Player recovery & other devices</summary>
  <p>Your recovery code controls your public player profile. Keep it private. Restoring it links your published records, not another device’s local progress.</p>
  <button type="button" className="lb-button" onClick={reveal}>Show my recovery code</button>
  {code&&<><label className="lb-label">Private recovery code<textarea readOnly value={code} rows={3} spellCheck={false}/></label><button type="button" className="lb-button" onClick={()=>setCode('')}>Hide code</button></>}
  <label className="lb-label">Restore an existing player<input type="password" autoComplete="off" spellCheck={false} value={restore} onChange={e=>setRestore(e.target.value)} placeholder="Paste your private recovery code"/></label>
  <button type="button" className="lb-button" disabled={busy||!restore.trim()} onClick={async()=>{
   const existing=existingCredential();if(existing&&existing!==restore.trim()&&!window.confirm('Switch player identity? Published records are preserved. Uploads belonging to the previous player will wait for that player’s recovery code.'))return;
   setBusy(true);setMessage('');try{await restorePlayerRecoveryCode(restore);setRestore('');setCode('');setMessage('Player restored. Published records are linked.');await flushUploads(true);}catch(e){setMessage(briefError(e));}finally{setBusy(false);}
  }}>{busy?'Restoring…':'Restore player'}</button><p role="status">{message}</p>
 </details>;
}
export function PublishedHistory(){
 const [rows,setRows]=useState<any[]>([]),[count,setCount]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const load=async(more=false)=>{setBusy(true);setMessage('');try{
  const data=await leaderboardRequest<{entries:any[];total:number}>(`/v3/me/runs?limit=20&offset=${more?rows.length:0}`,{},true);
  if(!Array.isArray(data.entries)||!Number.isSafeInteger(data.total))throw Error('Invalid run history.');setRows(old=>more?[...old,...data.entries]:data.entries);setCount(data.total);
 }catch(e){setMessage(briefError(e));}finally{setBusy(false);}};
 return <details className="lb-details"><summary>Published & archived run history</summary>
  <p>Old scoring-rule records are preserved as an archive. Compatible v2 native results are carried forward. A legacy archive result never becomes a new ranked submission.</p>
  <button type="button" className="lb-button" disabled={busy} onClick={()=>void load()}>Load my run history</button>
  <ul className="lb-history">{rows.map(r=><li key={r.id}>{titleFor(r.game_id)} · {modeLabel(r.game_id,r.mode_id)}<br/>Score {Number(r.raw_score).toLocaleString()} · {formatPoints(Number(r.ap_micros)/AP_SCALE)} AP · {r.status==='legacy'?'Archived old rules':r.status}</li>)}</ul>
  {rows.length<count&&<button type="button" className="lb-button" disabled={busy} onClick={()=>void load(true)}>More history</button>}
  {message&&<p role="status">{message}</p>}
 </details>;
}
export function LeaderboardPanel({stats,initialGameId}:{stats:UserStats;initialGameId?:string}){
 const [scope,setScope]=useState<Scope>(initialGameId?'game':'overall');
 const [gameId,setGameId]=useState(initialGameId??GAMES_REGISTRY[0].id),[mode,setMode]=useState('all');
 const [board,setBoard]=useState<Board>(()=>initialGameId?getGlobalLeaderboardForGame(initialGameId):getOverallArcadeLeaderboard());
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[tick,setTick]=useState(0),[clock,setClock]=useState(Date.now());
 const [selectedPlayer,setSelectedPlayer]=useState<{id:string;name:string;country:string;division:LeaderboardDivision}|null>(null);
 const [publicProfile,setPublicProfile]=useState<PublicPlayerProfileData|null>(null),[profileBusy,setProfileBusy]=useState(false),[profileError,setProfileError]=useState(''),[profileTick,setProfileTick]=useState(0);
 const rolledWeek=useRef(0);
 const sequence=useRef(0),profileSequence=useRef(0),abort=useRef<AbortController|null>(null);
 const live=isLiveLeaderboardConfigured();
 const fetchBoard=useCallback((options:{offset?:number;asOf?:number;signal?:AbortSignal}={})=>scope==='game'?refreshGameLeaderboard(gameId,mode,options):scope==='weekly'?refreshWeeklyOverallLeaderboard(options):refreshOverallLeaderboard(options),[scope,gameId,mode]);
 useEffect(()=>{
  const id=++sequence.current;abort.current?.abort();const controller=new AbortController();abort.current=controller;
  setError('');
  setBoard(scope==='game'?getGlobalLeaderboardForGame(gameId,0,0,mode):scope==='weekly'?getWeeklyOverallLeaderboard():getOverallArcadeLeaderboard());
  if(!live){setBusy(false);return;}
  setBusy(true);void fetchBoard({signal:controller.signal}).then(data=>{if(id===sequence.current)setBoard(data);}).catch(e=>{if(id===sequence.current&&!controller.signal.aborted)setError(briefError(e));}).finally(()=>{if(id===sequence.current)setBusy(false);});
  return()=>{controller.abort();sequence.current++;};
 },[fetchBoard,live,tick,scope,gameId,mode]);
 useEffect(()=>{
  const update=()=>setTick(n=>n+1);window.addEventListener(PUBLISHED_EVENT,update);window.addEventListener(IDENTITY_EVENT,update);
  const interval=setInterval(()=>{setClock(Date.now());},30000);
  return()=>{window.removeEventListener(PUBLISHED_EVENT,update);window.removeEventListener(IDENTITY_EVENT,update);clearInterval(interval);};
 },[]);
 useEffect(()=>{if(scope==='weekly'&&'weekEnd'in board&&board.weekEnd&&clock>=board.weekEnd&&rolledWeek.current!==board.weekEnd){rolledWeek.current=board.weekEnd;setTick(n=>n+1);}},[scope,board,clock]);
 useEffect(()=>{
  if(!selectedPlayer){setPublicProfile(null);setProfileError('');setProfileBusy(false);return;}
  const id=++profileSequence.current;setPublicProfile(null);setProfileError('');setProfileBusy(true);
  void getPublicPlayerProfile(selectedPlayer.id).then(data=>{if(id===profileSequence.current)setPublicProfile(data);}).catch(e=>{if(id===profileSequence.current)setProfileError(briefError(e));}).finally(()=>{if(id===profileSequence.current)setProfileBusy(false);});
  return()=>{profileSequence.current++;};
 },[selectedPlayer,profileTick]);
 const loadMore=async()=>{
  if(busy||board.nextOffset===null||board.nextOffset===undefined)return;const id=sequence.current;setBusy(true);setError('');
  try{const next=await fetchBoard({offset:board.nextOffset,asOf:board.asOf,signal:abort.current?.signal});if(id===sequence.current)setBoard(previous=>({...next,topEntries:[...new Map([...previous.topEntries,...next.topEntries].map(r=>[r.id,r])).values()]} as Board));}
  catch(e){if(id===sequence.current)setError(briefError(e));}finally{if(id===sequence.current)setBusy(false);}
 };
 const localBest=scope==='game'?(mode==='all'?currentGameBests(stats)[gameId]:stats.modeBests?.[gameId+':'+mode]):undefined;
 const entries=board.topEntries as Entry[];
 const own=board.userEntry;
 const renderRank=(rank:number)=>rank===1?<Crown aria-hidden="true"/>:rank===2?<Medal aria-hidden="true"/>:rank===3?<Medal aria-hidden="true"/>:<span>#{rank}</span>;
 const tierLabel=(division:LeaderboardDivision)=>division.charAt(0).toUpperCase()+division.slice(1)+' tier';
 const openPlayer=(entry:Entry)=>setSelectedPlayer({id:entry.id,name:entry.name,country:entry.country,division:entry.division??'bronze'});
 const renderRow=(entry:Entry)=><li key={entry.id} className={`lb-row lb-division-${entry.division??'bronze'} ${entry.rank<=3?`lb-podium lb-podium-${entry.rank}`:''} ${entry.isUser?'lb-self':''}`} data-leaderboard-player={entry.id}>
  <div className="lb-position" aria-label={`Rank ${entry.rank}`}>{renderRank(entry.rank)}</div>
  <div className="lb-player-cell">
   <span className="lb-country" aria-hidden="true">{entry.country}</span>
   <div className="lb-person">
    <div className="lb-name-line">
     <button className="lb-name lb-name-button" type="button" aria-label={`Open player profile for ${entry.name}`} onClick={()=>openPlayer(entry)}>{entry.name}</button>
     <span className={`lb-tier lb-tier-${entry.division??'bronze'}`}>{tierLabel(entry.division??'bronze')}</span>
    </div>
    <div className="lb-player-meta">{entry.isUser&&<span className="lb-you">YOU</span>}<span>VIEW PROFILE</span></div>
   </div>
  </div>
  <div className="lb-metrics">{scope==='game'&&'score'in entry?<><strong title={`${Math.floor((entry.apMicros??0)/AP_SCALE).toLocaleString()} AP`}>{formatPoints(entry.score)} <em>AP</em></strong><span>Score {entry.rawScore?.toLocaleString()??'Unavailable'} · {modeLabel(gameId,entry.modeId)}</span></>:<><strong title={`${formatPoints('ratingScore'in entry?entry.ratingScore:0)} overall rating`}>{formatPoints('ratingScore'in entry?entry.ratingScore:0)} <em>RATING</em></strong><span>{'gamesPlayed'in entry?entry.gamesPlayed:0} ranked games</span></>}</div>
 </li>;
 const scopeCopy=scope==='game'?'Ranked by AP. Raw Score remains specific to its game and mode.':scope==='weekly'?'Best result from each game completed during the current UTC week. Rating stays on the same 0–10,000 scale.':'One best contribution per game, combined into a simple 0–10,000 overall rating.';
 if(selectedPlayer){
  const shown=publicProfile;
  const division=shown?.division??selectedPlayer.division;
  return <section className="lb-panel lb-player-profile-page" aria-label={`Player profile for ${shown?.name??selectedPlayer.name}`} data-player-profile>
   <button type="button" className="lb-button lb-profile-back" aria-label="Back to leaderboard" onClick={()=>setSelectedPlayer(null)}><ArrowLeft aria-hidden="true"/> Back to leaderboard</button>
   <div className="lb-profile-hero">
    <div className="lb-profile-identity">
     <span className="lb-profile-flag" aria-hidden="true">{shown?.country??selectedPlayer.country}</span>
     <div>
      <div className="lb-profile-name-line"><h2>{shown?.name??selectedPlayer.name}</h2><span className={`lb-tier lb-tier-${division}`}>{tierLabel(division)}</span></div>
      <p>{shown?`${shown.countryCode} · PLAYER ${shown.id.slice(0,8).toUpperCase()}`:'Loading public arcade profile…'}</p>
     </div>
    </div>
   </div>
   {profileBusy&&<div className="lb-profile-status" role="status">Loading player profile…</div>}
   {profileError&&<div className="lb-warning" role="alert">{profileError}<button type="button" className="lb-button" onClick={()=>setProfileTick(n=>n+1)}>Retry</button></div>}
   {shown&&<>
    <div className="lb-profile-stats">
     <div><Globe2 aria-hidden="true"/><span>Global rank</span><strong>#{shown.globalRank}</strong></div>
     <div><Trophy aria-hidden="true"/><span>Overall rating</span><strong>{formatPoints(shown.globalRating)}</strong></div>
     <div><CalendarDays aria-hidden="true"/><span>Weekly rank</span><strong>{shown.weeklyRank?`#${shown.weeklyRank}`:'—'}</strong></div>
     <div><Gamepad2 aria-hidden="true"/><span>Ranked games</span><strong>{shown.rankedGames}</strong></div>
    </div>
    <div className="lb-profile-summary">
     <div><span>Tier</span><strong>{tierLabel(shown.division)}</strong></div>
     <div><span>Weekly rating</span><strong>{formatPoints(shown.weeklyRating)}</strong></div>
     <div><span>Total AP</span><strong>{formatPoints(shown.totalScore)}</strong></div>
     <div><span>Last ranked activity</span><strong>{new Date(shown.lastActiveAt).toLocaleDateString()}</strong></div>
    </div>
    <div className="lb-profile-contributions">
     <div className="lb-profile-section-title"><div><Trophy aria-hidden="true"/><span>Best game contributions</span></div><small>{shown.contributions.length} ranked {shown.contributions.length===1?'game':'games'}</small></div>
     {shown.contributions.length?<ol>{shown.contributions.map(c=><li key={c.gameId}><div><strong>{titleFor(c.gameId)}</strong><span>{modeLabel(c.gameId,c.modeId)} · Score {c.rawScore.toLocaleString()}</span></div><div><strong>{formatPoints(c.apMicros/AP_SCALE)} AP</strong><span>Best contribution</span></div></li>)}</ol>:<p className="lb-profile-status">No public ranked contributions are available.</p>}
    </div>
   </>}
  </section>;
 }
 return <section className={`lb-panel lb-scope-${scope}`} aria-label="Published arcade leaderboard" data-leaderboard-v3>
  <div className="lb-tabs" role="group" aria-label="Leaderboard view">
   <button type="button" className="lb-button" aria-pressed={scope==='overall'} onClick={()=>setScope('overall')}><Globe2 aria-hidden="true"/><span>Global</span></button>
   <button type="button" className="lb-button" aria-pressed={scope==='weekly'} onClick={()=>setScope('weekly')}><CalendarDays aria-hidden="true"/><span>Weekly</span></button>
   <button type="button" className="lb-button" aria-pressed={scope==='game'} onClick={()=>setScope('game')}><Gamepad2 aria-hidden="true"/><span>By game</span></button>
  </div>
  {scope==='game'&&<div className="lb-selectors"><label className="lb-label">Game<select aria-label="Leaderboard game" value={gameId} onChange={e=>{setGameId(e.target.value);setMode('all');}}>{GAMES_REGISTRY.map(g=><option key={g.id} value={g.id}>{g.title}</option>)}</select></label><label className="lb-label">Mode<select aria-label="Leaderboard mode" value={mode} onChange={e=>setMode(e.target.value)}><option value="all">All modes · best AP</option>{modesFor(gameId).map(p=><option key={p.modeId} value={p.modeId}>{p.modeLabel}</option>)}</select></label></div>}
  <div className="lb-overview">
   <div className="lb-stat-card"><div className="lb-stat-icon"><Users aria-hidden="true"/></div><div><span>Published competitors</span><strong>{total(board).toLocaleString()}</strong></div></div>
   <div className={`lb-stat-card ${board.userRank?'lb-stat-ranked':''}`}><div className="lb-stat-icon"><Trophy aria-hidden="true"/></div><div><span>Your published rank</span><strong>{board.userRank?`#${board.userRank}`:'Not ranked'}</strong></div></div>
  </div>
  <div className="lb-local"><div className="lb-local-icon"><ShieldCheck aria-hidden="true"/></div><div><strong>ON THIS DEVICE</strong><p>{scope==='game'?localBest?<>Score {localBest.rawScore.toLocaleString()} · {formatPoints(localBest.apMicros/AP_SCALE)} AP · {modeLabel(gameId,localBest.modeId)}</>:'No current-rule local record':<>{formatPoints(localRating(stats))} local rating</>}</p><span>Local records and pending uploads do not create a published rank.</span></div></div>
  <div className="lb-toolbar"><div className="lb-rules-summary"><Sparkles aria-hidden="true"/><p>{scopeCopy}</p></div><button type="button" className="lb-button lb-refresh" disabled={busy||!live} aria-label="Refresh leaderboard" onClick={()=>setTick(n=>n+1)}><RefreshCw aria-hidden="true" className={busy?'lb-spin':''}/><span>{busy?'Loading…':'Refresh'}</span></button></div>
  {scope==='weekly'&&'weekEnd'in board&&board.weekEnd&&<p className="lb-caption lb-week-caption">UTC week: {new Date(board.weekStart!).toLocaleDateString(undefined,{timeZone:'UTC'})} – {new Date(board.weekEnd-1).toLocaleDateString(undefined,{timeZone:'UTC'})} · Resets Monday 00:00 UTC.</p>}
  {board.asOf&&<p className="lb-caption">Snapshot: {new Date(board.asOf).toLocaleString()}{error?' · Previously loaded data':''}</p>}
  {!live&&<p className="lb-warning">This build is local-only. The published leaderboard is not connected.</p>}
  {error&&<p className="lb-warning" role="alert">{error} Refresh to start a new snapshot.</p>}
  <div className="lb-board-shell">
   <div className="lb-table-head" aria-hidden="true"><span>Rank</span><span>Player</span><span>{scope==='game'?'Arcade Points / Score':'Overall rating'}</span></div>
   <ol className="lb-list" aria-label="Leaderboard rankings" aria-busy={busy}>{entries.map(renderRow)}</ol>
   {!entries.length&&<div className="lb-empty"><Trophy aria-hidden="true"/><strong>{busy?'Loading rankings…':'No published results yet'}</strong><span>{busy?'Connecting to the arcade circuit.':'Play a ranked run to put a score on this board.'}</span></div>}
  </div>
  {own&&board.userRank&&!entries.some(e=>e.id===own.id)&&<><p className="lb-caption lb-your-position">YOUR POSITION</p><ol className="lb-list lb-pinned-self">{renderRow(own)}</ol></>}
  {board.nextOffset!==null&&board.nextOffset!==undefined&&<button type="button" className="lb-button lb-more" disabled={busy} onClick={()=>void loadMore()}>Load more players <ChevronRight aria-hidden="true"/></button>}
  <div className="lb-utility-grid">
   <details className="lb-details"><summary><span><Trophy aria-hidden="true"/> Scoring & ranking rules</span><ChevronRight className="lb-summary-chevron" aria-hidden="true"/></summary>
    <div className="lb-details-body"><p><strong>Score</strong> is the game’s raw result. <strong>AP</strong> turns that result into a balanced score for that game and mode. <strong>Overall Rating</strong> combines your best result from every game onto one fixed 0–10,000 scale.</p>
    <p>The ranking still rewards breadth exactly as before: each game can contribute up to 10,000 internally, then the combined total is divided by the {RATING_GAME_COUNT} arcade games. That scaling only makes the number readable; it does not change who ranks above whom.</p>
    <p>Most games reach full contribution at 10,000 AP. Finite games use elite targets so they are not disadvantaged. Repeated attempts and extra modes do not create extra game slots.</p>
    <p>Score, AP and Rating are always displayed as whole numbers. The server keeps finer precision internally only to order extremely close results fairly; those decimals are never shown.</p>
    <p>Weekly boards use completion time, not retry time. Compatible v2 records carry forward; v1 rules remain in your archive. Public results are plausibility-screened, not replay-verified.</p>
    <p className="lb-caption">Leaderboard v3 · scoring v2 · policy {POLICY_ID.slice(0,12)}</p></div>
   </details>
   <UploadManager/>
  </div>
 </section>;
}