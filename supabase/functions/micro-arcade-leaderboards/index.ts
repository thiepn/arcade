import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createLeaderboardHandler,createSupabaseStore } from '../../../server/leaderboard/http.ts';
const url=Deno.env.get('SUPABASE_URL')??'';
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
// verify_jwt=false is intentional: high-entropy guest credentials are authenticated by the handler.
Deno.serve(createLeaderboardHandler({store:createSupabaseStore(url,key),readOnly:Deno.env.get('LEADERBOARD_READ_ONLY')==='1',legacyPepper:key,allowedOrigins:[
  'https://thiepn.dev','https://thiepn.github.io','http://localhost:3000','http://127.0.0.1:3000',
]}));
