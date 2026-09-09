import { canonicalPayload, CREDENTIAL, getPolicy, POLICY_ID, PROTOCOL_VERSION, UUID, validDisplayName } from '../../shared/leaderboard/domain.ts';
export interface Store { rpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> }
export interface ServerOptions { store: Store; legacyPepper: string; allowedOrigins: string[]; now?: () => number; readOnly?: boolean }
interface Player { id: string; name: string; countryCode: string; createdAt: number }
export class ApiError extends Error { constructor(readonly status: number, readonly code: string, message: string) { super(message); } }
const encoder = new TextEncoder();
export async function hash(value: string): Promise<string> {
  const data=await crypto.subtle.digest('SHA-256',encoder.encode(value));
  return Array.from(new Uint8Array(data),v=>v.toString(16).padStart(2,'0')).join('');
}
function randomSecret(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
async function bodyObject(request: Request): Promise<Record<string, unknown>> {
  if ((request.headers.get('content-type')??'').split(';')[0].trim().toLowerCase()!=='application/json') throw new ApiError(415,'invalid_content_type','Expected JSON.');
  if (Number(request.headers.get('content-length'))>4096) throw new ApiError(413,'payload_too_large','Request exceeds 4 KB.');
  const reader=request.body?.getReader();
  if (!reader) throw new ApiError(400,'invalid_json','Expected a JSON object.');
  const chunks: Uint8Array[]=[];let size=0;let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;void reader.cancel();},4000);
  try {
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw new ApiError(413,'payload_too_large','Request exceeds 4 KB.');}chunks.push(value);}
    if(timedOut)throw new ApiError(408,'body_timeout','Request body timed out.');
    const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    let value: unknown;try{value=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new ApiError(400,'invalid_json','Invalid JSON.');}
    if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError(400,'invalid_json','Expected a JSON object.');
    return value as Record<string,unknown>;
  } finally {clearTimeout(timer);reader.releaseLock();}
}
function only(body: Record<string,unknown>, keys: string[]): void {
  if(Object.keys(body).some(k=>!keys.includes(k)))throw new ApiError(400,'unknown_field','Unexpected request field.');
}
function integerParam(url: URL,key: string,fallback: number,min: number,max: number): number {
  const text=url.searchParams.get(key);if(text===null)return fallback;
  if(!/^\d+$/.test(text))throw new ApiError(400,'invalid_page','Invalid pagination.');
  const value=Number(text);if(!Number.isSafeInteger(value)||value<min||value>max)throw new ApiError(400,'invalid_page','Invalid pagination.');
  return value;
}
function dbResult<T extends {ok?:boolean;code?:string}>(value: T): T {
  if(value?.ok===false){const code=value.code??'invalid_run';const status=code==='unknown_session'?404:code==='payload_conflict'?409:code==='session_expired'?410:code==='snapshot_expired'?409:code==='upgrade_required'?426:422;throw new ApiError(status,code,'The request could not be accepted.');}
  return value;
}
export function createLeaderboardHandler({store,legacyPepper,allowedOrigins,now=Date.now,readOnly=false}:ServerOptions) {
  const allowed=new Set(allowedOrigins);
  return async function handle(request: Request): Promise<Response> {
    const requestId=crypto.randomUUID();const origin=request.headers.get('origin');
    const headers: Record<string,string>={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','vary':'Origin','x-request-id':requestId};
    if(origin&&allowed.has(origin))headers['access-control-allow-origin']=origin;
    const response=(value: unknown,status=200)=>new Response(status===204?null:JSON.stringify(value),{status,headers});
    const envelope={protocolVersion:PROTOCOL_VERSION,scoreVersion:2,ratingVersion:3,policyId:POLICY_ID};
    try {
      if(origin&&!allowed.has(origin))throw new ApiError(403,'origin_not_allowed','Origin not allowed.');
      if(request.method==='OPTIONS'){
        headers['access-control-allow-headers']='authorization, content-type';headers['access-control-allow-methods']='GET,POST,PATCH,OPTIONS';headers['access-control-max-age']='600';
        return response(null,204);
      }
      const url=new URL(request.url);const marker='/micro-arcade-leaderboards';
      const path=url.pathname.includes(marker)?url.pathname.slice(url.pathname.indexOf(marker)+marker.length):url.pathname;
      const rate=async(scope:string,key:string,limit:number)=>{if(!await store.rpc<boolean>('micro_arcade_rate_limit',{p_scope:scope,p_key:key,p_limit:limit,p_now:now()}))throw new ApiError(429,'rate_limited','Too many requests. Retry shortly.');};
      // Store a one-way, app-scoped digest, not raw IP addresses. Gateway IP limiting is best-effort; authenticated quotas are separate.
      const ipKey=await hash('micro-arcade:rate:'+((request.headers.get('x-forwarded-for')??request.headers.get('cf-connecting-ip')??'unknown').split(',').at(-1)??'unknown').trim().slice(0,200));
      await rate('lb-read',ipKey,180);
      if((path==='/v3/health'||path==='/v1/health')&&request.method==='GET'){
        const board=dbResult(await store.rpc<any>('micro_arcade_lb_board',{p_scope:'overall',p_game:'',p_mode:'all',p_player:null,p_limit:1,p_offset:0,p_asof:null}));
        if(board.policyId!==POLICY_ID)throw new ApiError(503,'policy_mismatch','The scoring rollout is not ready.');
        return response({...envelope,ok:true,backend:'supabase',validation:'plausibility-screened',serverTime:now()});
      }
      if(readOnly&&request.method!=='GET')throw new ApiError(503,'maintenance','Leaderboard uploads are paused for maintenance. Queued runs will retry.');
      if(!path.startsWith('/v3/'))throw new ApiError(426,'upgrade_required','Reload Micro Arcade to use the current leaderboard. Local records are preserved.');
      let playerPromise: Promise<Player|null>|undefined;
      const authenticate=async(optional=false):Promise<Player|null>=>{
        if(!playerPromise)playerPromise=(async()=>{
          const auth=request.headers.get('authorization');if(!auth)return null;
          const token=auth.replace(/^Bearer\s+/i,'');
          if(!/^Bearer\s+/i.test(auth)||!CREDENTIAL.test(token))throw new ApiError(401,'unauthorized','Restore your player recovery code.');
          const [id,secret]=token.split('.');
          const player=await store.rpc<Player|null>('micro_arcade_lb_auth',{p_id:id,p_hash:await hash('micro-arcade:guest:v2:'+secret),p_legacy_hash:await hash(legacyPepper+':'+secret)});
          if(!player)throw new ApiError(401,'unauthorized','Restore your player recovery code.');
          return player;
        })();
        const p=await playerPromise;if(!p&&!optional)throw new ApiError(401,'unauthorized','Player authentication is required.');return p;
      };
      if(path==='/v3/guest'&&request.method==='POST'){
        const body=await bodyObject(request);only(body,[]);
        await rate('lb-guest',ipKey,5);
        const id=crypto.randomUUID(),secret=randomSecret();
        const player=await store.rpc<Player>('micro_arcade_lb_guest',{p_id:id,p_hash:await hash('micro-arcade:guest:v2:'+secret),p_country:'XX'});
        return response({...envelope,credential:`${id}.${secret}`,player},201);
      }
      if(path==='/v3/me'&&request.method==='GET'){
        const player=(await authenticate())!;
        const activity=await store.rpc('micro_arcade_lb_activity',{p_player:player.id});
        return response({...envelope,player,activity});
      }
      if(path==='/v3/me'&&request.method==='PATCH'){
        const player=(await authenticate())!,body=await bodyObject(request);only(body,['name']);await rate('lb-rename',player.id,10);
        const name=typeof body.name==='string'?body.name.normalize('NFKC').trim():'';
        if(!validDisplayName(name))throw new ApiError(400,'invalid_name','Use 3–20 letters, numbers, spaces, dots, dashes or underscores.');
        const next=await store.rpc('micro_arcade_lb_rename',{p_player:player.id,p_name:name});return response({...envelope,player:next});
      }
      if(path==='/v3/me/runs'&&request.method==='GET'){
        const player=(await authenticate())!;const history=await store.rpc<Record<string,unknown>>('micro_arcade_lb_history',{p_player:player.id,p_limit:integerParam(url,'limit',20,1,50),p_offset:integerParam(url,'offset',0,0,10000)});
        return response({...envelope,...history});
      }
      if(path==='/v3/sessions'&&request.method==='POST'){
        const player=(await authenticate())!,body=await bodyObject(request);only(body,['requestId','gameId','modeId','scoreVersion','protocolVersion','policyId']);
        if(body.scoreVersion!==2||body.protocolVersion!==3||body.policyId!==POLICY_ID)throw new ApiError(426,'upgrade_required','Reload Micro Arcade before starting a ranked run.');
        if(typeof body.requestId!=='string'||!UUID.test(body.requestId)||typeof body.gameId!=='string'||typeof body.modeId!=='string'||!getPolicy(body.gameId,body.modeId))throw new ApiError(400,'unknown_mode','Unknown game or mode.');
        await rate('lb-session',player.id,60);
        return response(dbResult(await store.rpc<any>('micro_arcade_lb_start',{p_player:player.id,p_request:body.requestId,p_game:body.gameId,p_mode:body.modeId,p_policy:POLICY_ID})),201);
      }
      if(path==='/v3/scores'&&request.method==='POST'){
        const player=(await authenticate())!,body=await bodyObject(request);
        const run=canonicalPayload(body);if(!run)throw new ApiError(422,'invalid_run','Invalid raw score, duration, version or session.');
        await rate('lb-score',player.id,60);
        const result=dbResult(await store.rpc<any>('micro_arcade_lb_finish',{p_player:player.id,p_session:run.sessionId,p_raw:run.rawScore,p_duration:run.durationMs,p_active:run.activeMs,p_mode:run.modeId,p_policy:run.policyId,p_source:run.scoreVersion}));
        return response(result);
      }
      const receipt=/^\/v3\/sessions\/([^/]+)\/result$/.exec(path);
      if(receipt&&request.method==='GET'){
        const player=(await authenticate())!;if(!UUID.test(receipt[1]))throw new ApiError(400,'invalid_session','Invalid session.');
        const result=await store.rpc('micro_arcade_lb_result',{p_player:player.id,p_session:receipt[1]});
        if(!result)throw new ApiError(404,'not_received','This run has not been received.');return response(result);
      }
      const board=/^\/v3\/leaderboards\/(overall|weekly|[a-z0-9]+)$/.exec(path);
      const inspect=/^\/v3\/players\/([^/]+)\/contributions$/.exec(path);
      if((board||inspect)&&request.method==='GET'){
        const player=await authenticate(true);let playerId=player?.id??null;
        let scope=board?.[1]==='overall'?'overall':board?.[1]==='weekly'?'weekly':'game';
        if(inspect){if(!UUID.test(inspect[1]))throw new ApiError(400,'invalid_player','Invalid player.');playerId=inspect[1];scope=url.searchParams.get('period')==='weekly'?'weekly':'overall';}
        const result=dbResult(await store.rpc<any>('micro_arcade_lb_board',{p_scope:scope,p_game:scope==='game'?board![1]:'',p_mode:url.searchParams.get('mode')??'all',p_player:playerId,
          p_limit:integerParam(url,'limit',20,1,50),p_offset:integerParam(url,'offset',0,0,10000),p_asof:url.searchParams.has('asOf')?integerParam(url,'asOf',0,0,Number.MAX_SAFE_INTEGER):null}));
        if(result.policyId!==POLICY_ID)throw new ApiError(503,'policy_mismatch','Scoring rollout is not ready.');
        return response(inspect?{...envelope,contributions:result.contributions,player:result.userEntry,asOf:result.asOf}:result);
      }
      throw new ApiError(404,'not_found','Endpoint not found.');
    } catch(error) {
      if(error instanceof ApiError){if(error.status===429)headers['retry-after']='60';return response({...envelope,error:error.message,code:error.code,requestId},error.status);}
      console.error(JSON.stringify({event:'leaderboard_error',requestId}));
      return response({...envelope,error:'The leaderboard is temporarily unavailable. Your run can be retried.',code:'unavailable',requestId},503);
    }
  };
}
export function createSupabaseStore(url: string,key: string): Store {
  if(!/^https:\/\/[^/]+$/.test(url)||!key)throw new Error('Missing server-only Supabase configuration');
  return { async rpc<T>(name: string,args: Record<string,unknown>):Promise<T>{
    if(!/^micro_arcade_(?:lb_[a-z_]+|rate_limit)$/.test(name))throw new Error('Unapproved RPC');
    const response=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(6000)});
    if(!response.ok)throw new Error('Database request failed');
    return await response.json() as T;
  }};
}
