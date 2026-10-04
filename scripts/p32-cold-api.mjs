import { SQL } from 'bun';
import { createLeaderboardHandler } from '../server/leaderboard/http.ts';

const dbUrl=process.env.P32_DATABASE_URL||'';
const parsed=new URL(dbUrl);
if(!['127.0.0.1','localhost'].includes(parsed.hostname)||!/p32|recovery/i.test(parsed.pathname))throw new Error('P32 cold API refuses non-local database targets');
const port=Number(process.env.P32_API_PORT||8787);
const db=new SQL(dbUrl,{max:4,idleTimeout:5});

const store={
  async rpc(name,args){
    if(name==='micro_arcade_rate_limit'){
      return (await db`SELECT public.micro_arcade_rate_limit(${args.p_scope}::text,${args.p_key}::text,${args.p_limit}::integer,${args.p_now}::bigint) AS value`)[0].value;
    }
    if(name==='micro_arcade_lb_board'){
      return (await db`SELECT public.micro_arcade_lb_board(
        ${args.p_scope}::text,${args.p_game}::text,${args.p_mode}::text,
        ${args.p_player}::uuid,${args.p_limit}::integer,${args.p_offset}::integer,${args.p_asof}::bigint
      ) AS value`)[0].value;
    }
    throw new Error('P32 read-only cold API does not expose RPC '+name);
  }
};

const handler=createLeaderboardHandler({
  store,
  legacyPepper:'p32-cold-recovery-no-production-secret',
  allowedOrigins:['http://127.0.0.1:3000','http://localhost:3000'],
  readOnly:true,
});

const server=Bun.serve({
  hostname:'127.0.0.1',
  port,
  fetch:handler,
});
console.log('P32 COLD API — READY http://127.0.0.1:'+server.port);
const shutdown=async()=>{server.stop(true);await db.close();process.exit(0);};
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
