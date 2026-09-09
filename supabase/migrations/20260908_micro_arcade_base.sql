-- Reproducible fresh-install baseline. Existing deployed tables are left untouched.
BEGIN;
CREATE TABLE IF NOT EXISTS public.micro_arcade_players (
 id uuid PRIMARY KEY, credential_hash text NOT NULL, display_name text NOT NULL,
 country_code text NOT NULL DEFAULT 'XX', created_at bigint NOT NULL, last_seen_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS public.micro_arcade_play_sessions (
 id uuid PRIMARY KEY, player_id uuid NOT NULL REFERENCES public.micro_arcade_players(id),
 game_id text NOT NULL, issued_at bigint NOT NULL, expires_at bigint NOT NULL, used_at bigint
);
CREATE TABLE IF NOT EXISTS public.micro_arcade_score_submissions (
 id uuid PRIMARY KEY, session_id uuid UNIQUE NOT NULL REFERENCES public.micro_arcade_play_sessions(id),
 player_id uuid NOT NULL REFERENCES public.micro_arcade_players(id), game_id text NOT NULL,
 score bigint NOT NULL CHECK(score>=0), duration_ms bigint NOT NULL CHECK(duration_ms>=0), created_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS public.micro_arcade_best_scores (
 game_id text NOT NULL, player_id uuid NOT NULL REFERENCES public.micro_arcade_players(id),
 score bigint NOT NULL CHECK(score>=0), achieved_at bigint NOT NULL, submissions integer NOT NULL DEFAULT 1,
 PRIMARY KEY(game_id,player_id)
);
CREATE TABLE IF NOT EXISTS public.micro_arcade_rate_limits (
 scope text NOT NULL,bucket_key text NOT NULL,bucket_start bigint NOT NULL,request_count integer NOT NULL DEFAULT 1,
 PRIMARY KEY(scope,bucket_key,bucket_start)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['micro_arcade_players','micro_arcade_play_sessions','micro_arcade_score_submissions','micro_arcade_best_scores','micro_arcade_rate_limits'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',t);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.micro_arcade_rate_limit(p_scope text,p_key text,p_limit integer,p_now bigint)
RETURNS boolean LANGUAGE plpgsql SET search_path='' AS $$ DECLARE n integer; BEGIN
 INSERT INTO public.micro_arcade_rate_limits VALUES(p_scope,p_key,(p_now/60000)*60000,1)
 ON CONFLICT(scope,bucket_key,bucket_start) DO UPDATE SET request_count=public.micro_arcade_rate_limits.request_count+1 RETURNING request_count INTO n;
 RETURN n<=greatest(1,p_limit);
END $$;
CREATE OR REPLACE FUNCTION public.micro_arcade_profile_activity(p_player_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('submissions',count(*),'rankedGames',count(distinct game_id)) FROM public.micro_arcade_score_submissions WHERE player_id=p_player_id;
$$;
REVOKE ALL ON FUNCTION public.micro_arcade_rate_limit(text,text,integer,bigint),public.micro_arcade_profile_activity(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.micro_arcade_rate_limit(text,text,integer,bigint),public.micro_arcade_profile_activity(uuid) TO service_role;
COMMIT;
