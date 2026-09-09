import assert from 'node:assert/strict';
import {createLeaderboardHandler} from '../../server/leaderboard/http.ts';
import {POLICY_ID} from '../../shared/leaderboard/domain.ts';
const player={id:crypto.randomUUID(),name:'Fixture',countryCode:'XX',createdAt:1};let allowed=true;const calls=[];
const handler=createLeaderboardHandler({legacyPepper:'test-only',allowedOrigins:['https://arcade.test'],store:{async rpc(name,args){calls.push({name,args});if(name==='micro_arcade_rate_limit')return allowed;if(name==='micro_arcade_lb_auth')return player;if(name==='micro_arcade_lb_board')return {ok:true,policyId:POLICY_ID,entries:[],totalCompetitors:0};if(name==='micro_arcade_lb_guest')return {...player,id:args.p_id};throw Error('Unexpected test RPC '+name)}}});
async function req(path,body,headers={},method=body===undefined?'GET':'POST'){
 return handler(new Request('https://backend.test'+path,{method,headers:{...(body!==undefined?{'content-type':'application/json'}:{}),...headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})}));
}
assert.equal((await req('/v3/health')).status,200);
let r=await req('/v3/health',undefined,{origin:'https://bad.test'});assert.equal(r.status,403);assert.equal(r.headers.get('access-control-allow-origin'),null);
r=await req('/v3/scores',undefined,{origin:'https://arcade.test'},'OPTIONS');assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),'https://arcade.test');assert.equal(r.headers.get('vary'),'Origin');
for(const body of ['[]','null','"str"','{broken'])assert.equal((await req('/v3/guest',body)).status,400);
assert.equal((await req('/v3/guest','x'.repeat(4097))).status,413);
assert.equal((await req('/v3/guest',{}, {'content-type':'text/plain'})).status,415);
assert.equal((await req('/v3/guest',{credential:'chosen'})).status,400);
assert.equal((await req('/v3/me')).status,401);
assert.equal((await req('/v3/me',undefined,{authorization:'Bearer bad'})).status,401);
assert.equal((await req('/v3/leaderboards/overall?offset=-1')).status,400);
assert.equal((await req('/v3/leaderboards/overall?limit=50000')).status,400);
assert.equal((await req('/v1/scores',{})).status,426);
allowed=false;r=await req('/v3/guest',{});assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'60');allowed=true;
const stream=new ReadableStream({start(){}});r=await handler(new Request('https://backend.test/v3/guest',{method:'POST',headers:{'content-type':'application/json'},body:stream,duplex:'half'}));assert.equal(r.status,408,'stalled request body is bounded');
for(const call of calls.filter(c=>c.name==='micro_arcade_rate_limit'))assert.match(call.args.p_key,/^[0-9a-f]{64}$/,'raw IP not persisted in throttle table');
console.log('Leaderboard HTTP PASS: allowed/denied CORS, bounded streaming bodies, malformed input, auth, legacy rejection, pagination and Retry-After.');
