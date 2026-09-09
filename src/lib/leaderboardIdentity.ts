import { CREDENTIAL,POLICY_ID } from '../../shared/leaderboard/domain';
import { LeaderboardError,requestLeaderboardJson } from './leaderboardRequest';
const KEY='micro_arcade_guest_credential_v1';
export const IDENTITY_EVENT='micro-arcade-identity-updated';
let volatileCredential:string|null=null;let creation:Promise<string>|null=null;
export const leaderboardBase=()=> (import.meta.env.VITE_LEADERBOARD_API_URL||'').trim().replace(/\/$/,'');
export function existingCredential():string|null{
  if(typeof window==='undefined')return null;
  try{const stored=localStorage.getItem(KEY);return stored&&CREDENTIAL.test(stored)?stored:volatileCredential;}catch{return volatileCredential;}
}
export function assertProtocol(data:unknown):void{
  const p=data as {protocolVersion?:number;scoreVersion?:number;policyId?:string}|null;
  if(!p||p.protocolVersion!==3||p.policyId!==POLICY_ID)throw new LeaderboardError('policy_mismatch','Update Micro Arcade to match the leaderboard rules.',426);
}
function saveCredential(credential:string):void{
  volatileCredential=credential;try{localStorage.setItem(KEY,credential);}catch{}
  window.dispatchEvent(new Event(IDENTITY_EVENT));
}
export async function ensureCredential():Promise<string>{
  if(!leaderboardBase())throw new LeaderboardError('not_configured','Online leaderboard is not configured.');
  const existing=existingCredential();if(existing)return existing;
  if(creation)return creation;
  const create=async()=>{
    const current=existingCredential();if(current)return current;
    const data=await requestLeaderboardJson<{credential:string;protocolVersion:number;policyId:string}>(leaderboardBase()+'/v3/guest',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    assertProtocol(data);if(!CREDENTIAL.test(data.credential))throw new LeaderboardError('invalid_response','Invalid player registration.',503);
    // Converge on a registration from another tab if Web Locks is unavailable.
    const winner=existingCredential();saveCredential(winner??data.credential);return winner??data.credential;
  };
  creation=(async()=>typeof navigator!=='undefined'&&navigator.locks?await navigator.locks.request('micro-arcade-guest',create):await create())();
  try{return await creation;}finally{creation=null;}
}
/** Reads may be anonymous. Never silently replace an invalid player credential. */
export async function leaderboardRequest<T>(path:string,init:RequestInit={},authenticated=false,credentialOverride?:string):Promise<T>{
  const base=leaderboardBase();if(!base)throw new LeaderboardError('not_configured','Online leaderboard is not configured.');
  const credential=credentialOverride??(authenticated?await ensureCredential():existingCredential());
  const headers=new Headers(init.headers);if(credential)headers.set('authorization',`Bearer ${credential}`);
  if(init.body&&!headers.has('content-type'))headers.set('content-type','application/json');
  const data=await requestLeaderboardJson<T>(base+path,{...init,headers});assertProtocol(data);return data;
}
export function exportPlayerRecoveryCode():string|null{return existingCredential();}
export async function restorePlayerRecoveryCode(code:string):Promise<void>{
  const value=code.trim();if(!CREDENTIAL.test(value))throw new LeaderboardError('invalid_credential','Invalid player recovery code.');
  const data=await leaderboardRequest<{player:{id:string}}>('/v3/me',{},false,value);
  if(data.player?.id!==value.split('.')[0])throw new LeaderboardError('invalid_response','Player identity did not match.',503);
  saveCredential(value);
}
