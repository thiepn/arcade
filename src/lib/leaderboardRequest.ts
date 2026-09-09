export class LeaderboardError extends Error {
  constructor(public readonly code:string,message:string,public readonly status=0,public readonly retryAfterMs=0){super(message);this.name='LeaderboardError';}
  get retryable():boolean{return this.status===0||this.status===408||this.status===429||this.status>=500;}
}
/** The deadline includes response-body parsing. Server bodies never become executable content. */
export async function requestLeaderboardJson<T>(url:string,init:RequestInit={},timeoutMs=10000):Promise<T>{
 if(typeof navigator!=='undefined'&&navigator.onLine===false)throw new LeaderboardError('offline','Offline. Your local record is preserved.');
 const controller=new AbortController();const abort=()=>controller.abort(init.signal?.reason);
 if(init.signal?.aborted)abort();else init.signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetch(url,{...init,signal:controller.signal,cache:'no-store'});
  let data:unknown;let parsed=true;
  try{data=await response.json();}catch{parsed=false;}
  if(controller.signal.aborted)throw new LeaderboardError('timeout','Leaderboard request timed out. The upload can be retried.');
  if(!response.ok){
   const value=data as {code?:unknown;error?:unknown}|null;
   const fallback=response.status===429?'rate_limited':response.status===401?'unauthorized':response.status>=500?'unavailable':'rejected';
   const code=typeof value?.code==='string'&&/^[a-z_]{1,64}$/.test(value.code)?value.code:fallback;
   const message=typeof value?.error==='string'&&value.error.length<300?value.error:response.status===429?'Too many requests. Retry shortly.':'Leaderboard request could not be completed.';
   const header=response.headers.get('retry-after');const seconds=Number(header);
   const wait=header?(Number.isFinite(seconds)?seconds*1000:Date.parse(header)-Date.now()):0;
   throw new LeaderboardError(code,message,response.status,Math.max(0,Math.min(300000,Number.isFinite(wait)?wait:0)));
  }
  if(!parsed)throw new LeaderboardError('invalid_response','Leaderboard returned an invalid response.',503);
  return data as T;
 }catch(error){
  if(error instanceof LeaderboardError)throw error;
  throw new LeaderboardError(controller.signal.aborted?'timeout':'unavailable','Connection interrupted. Your local record is preserved.');
 }finally{clearTimeout(timer);init.signal?.removeEventListener('abort',abort);}
}
