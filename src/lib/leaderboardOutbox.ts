import { POLICY_ID,RunPayload,RunReceipt,SubmissionStatus,apMicros,contributionMicros,canonicalPayload,UUID } from '../../shared/leaderboard/domain';
import { existingCredential,IDENTITY_EVENT,leaderboardRequest } from './leaderboardIdentity';
import { LeaderboardError } from './leaderboardRequest';
export const OUTBOX_EVENT='micro-arcade-outbox-updated';
export const PUBLISHED_EVENT='micro-arcade-run-published';
export interface PendingRun{
 id:string;playerId:string;gameId:string;payload:RunPayload;createdAt:number;attempts:number;retryAt:number;
 status:SubmissionStatus;updatedAt?:number;lastError?:string;receipt?:RunReceipt;
}
export interface OutboxStore{
 all():Promise<PendingRun[]>;
 update(id:string,fn:(current:PendingRun|undefined)=>PendingRun|undefined):Promise<PendingRun|undefined>;
 durable:boolean;
}
export class BrowserOutboxStore implements OutboxStore{
 durable=true;private memory=new Map<string,PendingRun>();private db:Promise<IDBDatabase|null>|null=null;
 private prefix='micro_arcade_upload_v3:';
 private open():Promise<IDBDatabase|null>{
  if(this.db)return this.db;
  if(typeof indexedDB==='undefined')return Promise.resolve(null);
  this.db=new Promise(resolve=>{
   try{const request=indexedDB.open('micro_arcade_uploads_v3',1);let settled=false;
    const done=(db:IDBDatabase|null)=>{if(!settled){settled=true;if(!db)this.db=null;resolve(db);}else db?.close();};
    const timeout=setTimeout(()=>done(null),2000);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('runs'))request.result.createObjectStore('runs',{keyPath:'id'});};
    request.onsuccess=()=>{clearTimeout(timeout);const db=request.result;db.onversionchange=()=>{db.close();this.db=null;};done(db);};
    request.onerror=()=>{clearTimeout(timeout);done(null);};request.onblocked=()=>{clearTimeout(timeout);done(null);};
   }catch{this.db=null;resolve(null);}
  });return this.db;
 }
 private valid(value:unknown):value is PendingRun{
  const r=value as PendingRun;return !!r&&typeof r==='object'&&UUID.test(r.id??'')&&UUID.test(r.playerId??'')&&typeof r.gameId==='string'&&!!canonicalPayload(r.payload)&&r.id===r.payload.sessionId&&
   ['pending','accepted','review','rejected','expired','auth-required'].includes(r.status)&&Number.isFinite(r.retryAt)&&Number.isSafeInteger(r.attempts)&&r.attempts>=0;
 }
 private fallbackRows():Map<string,PendingRun>{
  const result=new Map(this.memory);
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith(this.prefix)){try{const r=JSON.parse(localStorage.getItem(k)??'null');if(this.valid(r)&&(!result.has(r.id)||(r.updatedAt??0)>=(result.get(r.id)?.updatedAt??0)))result.set(r.id,r);}catch{}}}}
  catch{if(!this.db)this.durable=false;}return result;
 }
 async all():Promise<PendingRun[]>{
  const result=this.fallbackRows(),db=await this.open();
  if(db)try{const rows:PendingRun[]=await new Promise((resolve,reject)=>{const tx=db.transaction('runs','readonly');const get=tx.objectStore('runs').getAll();get.onsuccess=()=>resolve(get.result.filter(v=>this.valid(v)));get.onerror=()=>reject(get.error);});
   this.durable=true;
   for(const row of rows)if(!result.has(row.id)||(row.updatedAt??0)>=(result.get(row.id)?.updatedAt??0))result.set(row.id,row);
  }catch{this.db=null;}
  return [...result.values()];
 }
 async update(id:string,fn:(r:PendingRun|undefined)=>PendingRun|undefined):Promise<PendingRun|undefined>{
  const db=await this.open(),fallback=this.fallbackRows().get(id);let mutationError:unknown;let observed:PendingRun|undefined=fallback;
  if(db)try{return await new Promise((resolve,reject)=>{
   const tx=db.transaction('runs','readwrite'),store=tx.objectStore('runs'),get=store.get(id);let result:PendingRun|undefined;
   get.onsuccess=()=>{try{const saved=this.valid(get.result)?get.result:undefined;
    observed=fallback&&(fallback.updatedAt??0)>(saved?.updatedAt??0)?fallback:saved??fallback;
    result=fn(observed);if(result)result={...result,updatedAt:Date.now()};
    if(result)store.put(result);else store.delete(id);
   }catch(error){mutationError=error;tx.abort();reject(error);}};
   tx.oncomplete=()=>{this.durable=true;this.memory.delete(id);try{localStorage.removeItem(this.prefix+id);}catch{}resolve(result);};
   tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(mutationError??tx.error??new Error('Storage transaction aborted'));
  });}catch(error){if(mutationError)throw mutationError;this.db=null;}
  const next=fn(observed),result=next?{...next,updatedAt:Date.now()}:undefined;
  if(result)this.memory.set(id,result);else this.memory.delete(id);
  try{if(result)localStorage.setItem(this.prefix+id,JSON.stringify(result));else localStorage.removeItem(this.prefix+id);this.durable=true;}catch{this.durable=false;}
  return result;
 }

}
export class UploadQueue{
 private flushing:Promise<void>|null=null;
 constructor(readonly store:OutboxStore,private send:(run:PendingRun)=>Promise<RunReceipt>,private identity:()=>string|null,private notify:()=>void=()=>{},private now:()=>number=Date.now){}
 async enqueue(run:Omit<PendingRun,'attempts'|'retryAt'|'status'>):Promise<void>{
  if(!canonicalPayload(run.payload)||run.id!==run.payload.sessionId||!UUID.test(run.playerId))throw new Error('Invalid queued run');
  const all=await this.store.all();if(all.filter(r=>r.status==='pending'||r.status==='auth-required').length>=256&&!all.some(r=>r.id===run.id))throw new Error('Upload queue is full. Existing queued records were preserved.');
  await this.store.update(run.id,current=>{
   if(current){if(JSON.stringify(current.payload)!==JSON.stringify(run.payload)||current.playerId!==run.playerId)throw new Error('Queued result is immutable');return current;}
   return {...run,attempts:0,retryAt:this.now(),status:'pending'};
  });this.notify();
 }
 validReceipt(r:RunReceipt,run:PendingRun):boolean{
  return r?.protocolVersion===3&&r.policyId===POLICY_ID&&r.sessionId===run.id&&r.gameId===run.gameId&&r.modeId===run.payload.modeId&&r.rawScore===run.payload.rawScore&&
   ['ranked','review','rejected'].includes(r.status)&&Math.abs(r.apMicros-apMicros(run.gameId,run.payload.rawScore,run.payload.modeId))<=1&&
   Math.abs(r.contributionMicros-contributionMicros(run.gameId,r.apMicros,run.payload.modeId))<=1&&r.accepted===(r.status==='ranked');
 }
 async flush(force=false):Promise<void>{
  if(this.flushing)return this.flushing;
  this.flushing=(async()=>{
   const rows=(await this.store.all()).sort((a,b)=>a.createdAt-b.createdAt);
   for(const run of rows.filter(r=>(r.status==='pending'||(force&&r.status==='auth-required'))&&(force||r.retryAt<=this.now())).slice(0,10)){
    if(this.identity()!==run.playerId){await this.store.update(run.id,current=>current&&current.status!=='accepted'?{...current,status:'auth-required',lastError:'unauthorized'}:current);continue;}
    try{
     const receipt=await this.send(run);if(!this.validReceipt(receipt,run))throw new LeaderboardError('invalid_response','Server receipt did not match this run.',503);
     await this.store.update(run.id,current=>current?{...current,status:receipt.status==='ranked'?'accepted':receipt.status==='review'?'review':'rejected',receipt,lastError:receipt.code}:current);
    }catch(error){
     const e=error instanceof LeaderboardError?error:new LeaderboardError('unavailable','Connection interrupted.');
     await this.store.update(run.id,current=>{
      if(!current||['accepted','review','rejected','expired'].includes(current.status))return current;
      const attempts=current.attempts+1;
      return {...current,attempts,status:e.status===401?'auth-required':e.status===410?'expired':e.retryable?'pending':'rejected',lastError:e.code,
       retryAt:this.now()+Math.max(e.retryAfterMs,Math.min(300000,2000*2**Math.min(attempts,8)))};
     });
    }
   }
   // Prune terminal receipts only. Never evict an unsubmitted run to make room.
   const completed=(await this.store.all()).filter(r=>!['pending','auth-required','review'].includes(r.status)).sort((a,b)=>b.createdAt-a.createdAt);
   for(const old of completed.slice(100))await this.store.update(old.id,()=>undefined);
  })().finally(()=>{this.flushing=null;this.notify();});return this.flushing;
 }
}
const browserStore=new BrowserOutboxStore();
function notify(){if(typeof window!=='undefined')window.dispatchEvent(new Event(OUTBOX_EVENT));}
const queue=new UploadQueue(browserStore,async run=>{
 const credential=existingCredential();if(!credential||credential.split('.')[0]!==run.playerId)throw new LeaderboardError('unauthorized','Restore the original player.',401);
 const result=await leaderboardRequest<RunReceipt>('/v3/scores',{method:'POST',body:JSON.stringify(run.payload)},false,credential);
 if(result.status==='ranked'&&typeof window!=='undefined')window.dispatchEvent(new Event(PUBLISHED_EVENT));return result;
},()=>existingCredential()?.split('.')[0]??null,notify);
export const getUploadHistory=()=>browserStore.all();
export const uploadsAreDurable=()=>browserStore.durable;
export async function enqueueUpload(run:Omit<PendingRun,'attempts'|'retryAt'|'status'>):Promise<void>{await queue.enqueue(run);void flushUploads().catch(notify);}
let timer:ReturnType<typeof setTimeout>|undefined;let syncUsers=0;
export async function flushUploads(force=false):Promise<void>{
 if(typeof navigator!=='undefined'&&navigator.onLine===false)return;
 if(typeof navigator!=='undefined'&&navigator.locks)await navigator.locks.request('micro-arcade-upload-dispatch',()=>queue.flush(force));else await queue.flush(force);
 if(timer)clearTimeout(timer);
 const pending=(await browserStore.all()).filter(r=>r.status==='pending');
 if(pending.length&&syncUsers>0){const next=Math.min(...pending.map(r=>r.retryAt));timer=setTimeout(()=>void flushUploads().catch(notify),Math.max(1000,Math.min(300000,next-Date.now())));}
}
export function startLeaderboardSync():()=>void{
 if(typeof window==='undefined')return()=>{};syncUsers++;
 const online=()=>void flushUploads(true).catch(notify);const visible=()=>{if(!document.hidden)void flushUploads().catch(notify);};
 window.addEventListener('online',online);window.addEventListener(IDENTITY_EVENT,online);document.addEventListener('visibilitychange',visible);void flushUploads().catch(notify);
 return()=>{syncUsers=Math.max(0,syncUsers-1);window.removeEventListener('online',online);window.removeEventListener(IDENTITY_EVENT,online);document.removeEventListener('visibilitychange',visible);if(syncUsers===0&&timer){clearTimeout(timer);timer=undefined;}};
}
export async function refreshReviewedUploads():Promise<void>{
 for(const row of (await browserStore.all()).filter(r=>r.status==='review')){
  const credential=existingCredential();if(credential?.split('.')[0]!==row.playerId)continue;
  try{const receipt=await leaderboardRequest<RunReceipt>(`/v3/sessions/${row.id}/result`,{},false,credential);
   if(queue.validReceipt(receipt,row)&&['ranked','rejected'].includes(receipt.status)){
    await browserStore.update(row.id,current=>current?{...current,receipt,status:receipt.status==='ranked'?'accepted':'rejected',lastError:receipt.code}:current);
    window.dispatchEvent(new Event(PUBLISHED_EVENT));
   }
  }catch{}
 }notify();
}
