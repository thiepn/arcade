-- Additive, immutable v3 competition. v1/v2 native history is never deleted or rewritten.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE public.micro_arcade_players ADD COLUMN IF NOT EXISTS credential_version integer NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS public.micro_arcade_lb_policy(version integer PRIMARY KEY,payload jsonb NOT NULL);
-- POLICY_INSERT
CREATE TABLE IF NOT EXISTS public.micro_arcade_lb_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), player_id uuid NOT NULL REFERENCES public.micro_arcade_players(id),
 request_id uuid NOT NULL, game_id text NOT NULL,mode_id text NOT NULL,policy_id text NOT NULL,
 issued_at bigint NOT NULL,expires_at bigint NOT NULL,used_at bigint,
 UNIQUE(player_id,request_id), CHECK(expires_at=issued_at+21600000)
);
CREATE TABLE IF NOT EXISTS public.micro_arcade_lb_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid UNIQUE NOT NULL REFERENCES public.micro_arcade_lb_sessions(id),
 player_id uuid NOT NULL REFERENCES public.micro_arcade_players(id),game_id text NOT NULL,mode_id text NOT NULL,
 policy_id text NOT NULL,source_version integer NOT NULL CHECK(source_version=2),
 raw_score bigint NOT NULL CHECK(raw_score BETWEEN 0 AND 9007199254740991),
 duration_ms bigint NOT NULL CHECK(duration_ms BETWEEN 0 AND 21600000),active_ms bigint NOT NULL CHECK(active_ms BETWEEN 0 AND duration_ms),
 ap_micros bigint NOT NULL CHECK(ap_micros>=0),contribution_micros bigint NOT NULL CHECK(contribution_micros BETWEEN 0 AND 10000000000),
 completed_at bigint NOT NULL,created_at bigint NOT NULL,
 status text NOT NULL CHECK(status IN ('ranked','review','rejected')),code text NOT NULL,
 provenance text NOT NULL CHECK(provenance IN ('v3','migrated-v2'))
);
CREATE INDEX IF NOT EXISTS micro_arcade_lb_board_idx ON public.micro_arcade_lb_runs(game_id,mode_id,ap_micros DESC) WHERE status='ranked';
CREATE INDEX IF NOT EXISTS micro_arcade_lb_player_idx ON public.micro_arcade_lb_runs(player_id,game_id,mode_id,ap_micros DESC);
CREATE INDEX IF NOT EXISTS micro_arcade_lb_week_idx ON public.micro_arcade_lb_runs(completed_at,player_id,game_id) WHERE status='ranked';
CREATE INDEX IF NOT EXISTS micro_arcade_lb_session_expiry_idx ON public.micro_arcade_lb_sessions(expires_at) WHERE used_at IS NULL;
CREATE TABLE IF NOT EXISTS public.micro_arcade_lb_reviews (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,run_id uuid NOT NULL REFERENCES public.micro_arcade_lb_runs(id),
 previous_status text NOT NULL,new_status text NOT NULL,reason text NOT NULL,reviewed_at bigint NOT NULL DEFAULT floor(extract(epoch from clock_timestamp())*1000)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['micro_arcade_lb_policy','micro_arcade_lb_sessions','micro_arcade_lb_runs','micro_arcade_lb_reviews'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',t);
 END LOOP;
END $$;
REVOKE INSERT,UPDATE,DELETE ON public.micro_arcade_lb_policy FROM service_role;
GRANT USAGE,SELECT ON SEQUENCE public.micro_arcade_lb_reviews_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.micro_arcade_lb_values(p_game text,p_mode text,p_raw bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE cfg jsonb; a double precision;b double precision;c double precision;r double precision;reward double precision;v double precision;units bigint;contribution bigint;
BEGIN
 SELECT payload->'policies'->(p_game||':'||p_mode) INTO cfg FROM public.micro_arcade_lb_policy WHERE version=3;
 IF cfg IS NULL OR p_raw IS NULL OR p_raw<0 OR p_raw>9007199254740991 THEN RETURN NULL; END IF;
 a:=(cfg->'anchors'->>0)::double precision;b:=(cfg->'anchors'->>1)::double precision;c:=(cfg->'anchors'->>2)::double precision;
 r:=p_raw::double precision;reward:=(cfg->>'reward')::double precision;
 v:=CASE WHEN r<=a THEN 1000*r/a WHEN r<=b THEN 1000+2000*(r-a)/(b-a) WHEN r<=c THEN 3000+3000*(r-b)/(c-b) ELSE 6000+2000*ln(r/c)/ln(2::double precision) END;
 units:=floor(v*reward*1000000+0.00001)::bigint;
 contribution:=least(10000000000,floor(units::numeric*10000/(cfg->>'contributionTarget')::numeric)::bigint);
 RETURN jsonb_build_object('apMicros',units,'arcadePoints',floor(units::numeric/1000000),'contributionMicros',contribution);
END $$;
CREATE OR REPLACE FUNCTION public.micro_arcade_lb_screen(p_game text,p_mode text,p_raw bigint,p_active bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE cfg jsonb;seconds double precision;ceiling double precision;BEGIN
 SELECT payload->'policies'->(p_game||':'||p_mode) INTO cfg FROM public.micro_arcade_lb_policy WHERE version=3;
 IF cfg IS NULL OR p_raw IS NULL OR p_raw<0 OR p_raw>9007199254740991 OR p_active IS NULL OR p_active<0 OR p_active>21600000 THEN RETURN jsonb_build_object('status','rejected','code','invalid_run'); END IF;
 IF p_raw>(cfg->>'hardMax')::bigint THEN RETURN jsonb_build_object('status','rejected','code','impossible_score'); END IF;
 seconds:=p_active::double precision/1000;
 ceiling:=(cfg->>'openingAllowance')::double precision+(cfg->>'perSecond')::double precision*seconds+(cfg->>'perSecondSquared')::double precision*seconds*seconds;
 IF p_active<(cfg->>'minActiveMs')::bigint OR p_active>(cfg->>'maxActiveMs')::bigint OR p_raw>ceiling THEN RETURN jsonb_build_object('status','review','code','plausibility_review'); END IF;
 RETURN jsonb_build_object('status','ranked','code','ok');
END $$;
CREATE OR REPLACE FUNCTION public.micro_arcade_lb_receipt(r public.micro_arcade_lb_runs)
RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('protocolVersion',3,'scoreVersion',2,'ratingVersion',3,'policyId',r.policy_id,
 'accepted',r.status='ranked','status',r.status,'sessionId',r.session_id,'gameId',r.game_id,'modeId',r.mode_id,
 'rawScore',r.raw_score,'apMicros',r.ap_micros,'arcadePoints',floor(r.ap_micros::numeric/1000000),
 'contributionMicros',r.contribution_micros,'completedAt',r.completed_at,'code',r.code);
$$;
CREATE OR REPLACE FUNCTION public.micro_arcade_lb_cleanup()
RETURNS integer LANGUAGE plpgsql SET search_path='' AS $$
DECLARE n integer;now_ms bigint:=floor(extract(epoch from clock_timestamp())*1000);BEGIN
 WITH doomed AS(SELECT id FROM public.micro_arcade_lb_sessions WHERE used_at IS NULL AND expires_at<now_ms-604800000 ORDER BY expires_at LIMIT 1000)
 DELETE FROM public.micro_arcade_lb_sessions WHERE id IN(SELECT id FROM doomed);
 GET DIAGNOSTICS n=ROW_COUNT;
 DELETE FROM public.micro_arcade_rate_limits WHERE ctid IN(SELECT ctid FROM public.micro_arcade_rate_limits WHERE bucket_start<now_ms-172800000 LIMIT 1000);
 -- Old unused tokens have no score evidence. Never remove tokens referenced by historical runs.
 DELETE FROM public.micro_arcade_play_sessions WHERE id IN(SELECT s.id FROM public.micro_arcade_play_sessions s WHERE s.used_at IS NULL AND s.expires_at<now_ms-604800000 AND NOT EXISTS(SELECT 1 FROM public.micro_arcade_score_submissions r WHERE r.session_id=s.id) LIMIT 1000);
 RETURN n;
END $$;
CREATE OR REPLACE FUNCTION public.micro_arcade_lb_start(p_player uuid,p_request uuid,p_game text,p_mode text,p_policy text)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE cfg jsonb;policy text;s public.micro_arcade_lb_sessions;now_ms bigint:=floor(extract(epoch from clock_timestamp())*1000);BEGIN
 SELECT payload->>'policyId',payload->'policies'->(p_game||':'||p_mode) INTO policy,cfg FROM public.micro_arcade_lb_policy WHERE version=3;
 IF p_policy IS DISTINCT FROM policy OR cfg IS NULL OR p_request IS NULL THEN RETURN jsonb_build_object('ok',false,'code','upgrade_required'); END IF;
 INSERT INTO public.micro_arcade_lb_sessions(player_id,request_id,game_id,mode_id,policy_id,issued_at,expires_at)
 VALUES(p_player,p_request,p_game,p_mode,policy,now_ms,now_ms+21600000) ON CONFLICT(player_id,request_id) DO NOTHING;
 SELECT * INTO s FROM public.micro_arcade_lb_sessions WHERE player_id=p_player AND request_id=p_request;
 IF s.game_id<>p_game OR s.mode_id<>p_mode OR s.policy_id<>policy THEN RETURN jsonb_build_object('ok',false,'code','session_mismatch'); END IF;
 PERFORM public.micro_arcade_lb_cleanup();
 RETURN jsonb_build_object('ok',true,'protocolVersion',3,'scoreVersion',2,'ratingVersion',3,'policyId',policy,'session',jsonb_build_object('id',s.id,'playerId',p_player,'gameId',p_game,'modeId',p_mode,'issuedAt',s.issued_at,'expiresAt',s.expires_at,'uploadExpiresAt',s.expires_at+604800000,'policyId',policy));
END $$;
CREATE OR REPLACE FUNCTION public.micro_arcade_lb_finish(p_player uuid,p_session uuid,p_raw bigint,p_duration bigint,p_active bigint,p_mode text,p_policy text,p_source integer)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE s public.micro_arcade_lb_sessions;r public.micro_arcade_lb_runs;val jsonb;screen jsonb;now_ms bigint:=floor(extract(epoch from clock_timestamp())*1000);BEGIN
 SELECT * INTO s FROM public.micro_arcade_lb_sessions WHERE id=p_session AND player_id=p_player FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','unknown_session'); END IF;
 IF p_source IS DISTINCT FROM 2 OR p_policy IS DISTINCT FROM s.policy_id OR p_mode IS DISTINCT FROM s.mode_id THEN RETURN jsonb_build_object('ok',false,'code','session_mismatch'); END IF;
 SELECT * INTO r FROM public.micro_arcade_lb_runs WHERE session_id=s.id;
 IF FOUND THEN
  IF p_raw IS DISTINCT FROM r.raw_score OR p_duration IS DISTINCT FROM r.duration_ms OR p_active IS DISTINCT FROM r.active_ms THEN RETURN jsonb_build_object('ok',false,'code','payload_conflict'); END IF;
  RETURN jsonb_build_object('ok',true)||public.micro_arcade_lb_receipt(r);
 END IF;
 IF now_ms>s.expires_at+604800000 THEN RETURN jsonb_build_object('ok',false,'code','session_expired'); END IF;
 IF p_raw IS NULL OR p_raw<0 OR p_raw>9007199254740991 OR p_duration IS NULL OR p_duration<0 OR p_duration>21600000 OR p_active IS NULL OR p_active<0 OR p_active>p_duration OR s.issued_at+p_duration>now_ms+15000 THEN RETURN jsonb_build_object('ok',false,'code','invalid_run'); END IF;
 val:=public.micro_arcade_lb_values(s.game_id,s.mode_id,p_raw);
 IF val IS NULL THEN RETURN jsonb_build_object('ok',false,'code','invalid_run'); END IF;
 screen:=public.micro_arcade_lb_screen(s.game_id,s.mode_id,p_raw,p_active);
 INSERT INTO public.micro_arcade_lb_runs(session_id,player_id,game_id,mode_id,policy_id,source_version,raw_score,duration_ms,active_ms,ap_micros,contribution_micros,completed_at,created_at,status,code,provenance)
 VALUES(s.id,p_player,s.game_id,s.mode_id,s.policy_id,2,p_raw,p_duration,p_active,(val->>'apMicros')::bigint,(val->>'contributionMicros')::bigint,s.issued_at+p_duration,now_ms,screen->>'status',screen->>'code','v3') RETURNING * INTO r;
 UPDATE public.micro_arcade_lb_sessions SET used_at=now_ms WHERE id=s.id;
 RETURN jsonb_build_object('ok',true)||public.micro_arcade_lb_receipt(r);
END $$;
-- Native evidence is immutable. Moderation changes eligibility, never rewrites a player's run.
CREATE OR REPLACE FUNCTION public.micro_arcade_lb_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF (to_jsonb(NEW)-'status'-'code') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'code') THEN RAISE EXCEPTION 'run evidence is immutable'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS micro_arcade_lb_immutable ON public.micro_arcade_lb_runs;
CREATE TRIGGER micro_arcade_lb_immutable BEFORE UPDATE ON public.micro_arcade_lb_runs FOR EACH ROW EXECUTE FUNCTION public.micro_arcade_lb_immutable();
CREATE OR REPLACE FUNCTION public.micro_arcade_lb_review(p_run uuid,p_status text,p_reason text)
RETURNS boolean LANGUAGE plpgsql SET search_path='' AS $$ DECLARE previous text;BEGIN
 IF p_status NOT IN('ranked','rejected') OR p_reason IS NULL OR char_length(trim(p_reason))<5 OR char_length(p_reason)>1000 THEN RETURN false; END IF;
 SELECT status INTO previous FROM public.micro_arcade_lb_runs WHERE id=p_run FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO public.micro_arcade_lb_reviews(run_id,previous_status,new_status,reason) VALUES(p_run,previous,p_status,p_reason);
 UPDATE public.micro_arcade_lb_runs SET status=p_status,code=CASE WHEN p_status='ranked' THEN 'review_approved' ELSE 'review_rejected' END WHERE id=p_run;
 RETURN true;
END $$;
-- A snapshot plus deterministic ordering stabilizes pagination. New runs cannot shuffle later pages.
CREATE OR REPLACE FUNCTION public.micro_arcade_lb_bests(p_asof bigint,p_start bigint,p_end bigint)
RETURNS SETOF public.micro_arcade_lb_runs LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT (chosen.r).* FROM (
  SELECT r,row_number() OVER(PARTITION BY r.player_id,r.game_id,r.mode_id ORDER BY r.ap_micros DESC,r.raw_score DESC,r.completed_at ASC,r.id ASC) AS rn
  FROM public.micro_arcade_lb_runs r WHERE r.status='ranked' AND r.ap_micros>0 AND r.created_at<=p_asof AND r.completed_at>=p_start AND r.completed_at<p_end
 )chosen WHERE rn=1;
$$;
CREATE OR REPLACE FUNCTION public.micro_arcade_lb_board(p_scope text,p_game text,p_mode text,p_player uuid,p_limit integer DEFAULT 20,p_offset integer DEFAULT 0,p_asof bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE now_ms bigint:=floor(extract(epoch from statement_timestamp())*1000);snap bigint;lo bigint:=0;hi bigint:=9007199254740991;result jsonb;policy text;BEGIN
 snap:=coalesce(p_asof,now_ms);
 IF p_asof IS NOT NULL AND EXISTS(SELECT 1 FROM public.micro_arcade_lb_reviews WHERE reviewed_at>snap) THEN RETURN jsonb_build_object('ok',false,'code','snapshot_expired'); END IF;
 IF p_scope NOT IN('game','overall','weekly') OR p_limit NOT BETWEEN 1 AND 50 OR p_offset NOT BETWEEN 0 AND 10000 OR snap>now_ms+1000 OR snap<now_ms-300000 THEN RETURN jsonb_build_object('ok',false,'code','snapshot_expired'); END IF;
 IF p_scope='game' AND NOT EXISTS(SELECT 1 FROM public.micro_arcade_lb_policy WHERE version=3 AND EXISTS(SELECT 1 FROM jsonb_each(payload->'policies') v WHERE v.value->>'gameId'=p_game AND (p_mode='all' OR v.value->>'modeId'=p_mode))) THEN RETURN jsonb_build_object('ok',false,'code','unknown_mode'); END IF;
 SELECT payload->>'policyId' INTO policy FROM public.micro_arcade_lb_policy WHERE version=3;
 IF p_scope='weekly' THEN
  lo:=floor(extract(epoch from (date_trunc('week',to_timestamp(snap/1000.0) AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'))*1000)::bigint;hi:=lo+604800000;
 END IF;
 WITH modes AS(SELECT * FROM public.micro_arcade_lb_bests(snap,lo,hi) WHERE p_scope<>'game' OR (game_id=p_game AND (p_mode='all' OR mode_id=p_mode))),
 games AS(SELECT * FROM(SELECT *,row_number() OVER(PARTITION BY player_id,game_id ORDER BY ap_micros DESC,completed_at ASC,id ASC) pick FROM modes)x WHERE pick=1),
 rows AS(
  SELECT g.player_id AS id,p.display_name AS name,p.country_code,g.ap_micros::numeric/1000000 AS score,g.raw_score,g.mode_id,g.source_version,g.completed_at AS achieved_at,
   g.contribution_micros::numeric/1000000 AS rating_score,g.ap_micros::numeric/1000000 AS total_score,1::bigint AS games_played,g.completed_at AS last_achieved_at,
   g.ap_micros AS sort_units,g.ap_micros,g.contribution_micros
  FROM games g JOIN public.micro_arcade_players p ON p.id=g.player_id WHERE p_scope='game'
  UNION ALL
  SELECT g.player_id,p.display_name,p.country_code,0::numeric,NULL::bigint,NULL::text,NULL::integer,max(g.completed_at),
   sum(g.contribution_micros)::numeric/1000000,sum(g.ap_micros)::numeric/1000000,count(*),max(g.completed_at),
   sum(g.contribution_micros)::bigint,sum(g.ap_micros)::bigint,sum(g.contribution_micros)::bigint
  FROM games g JOIN public.micro_arcade_players p ON p.id=g.player_id WHERE p_scope<>'game' GROUP BY g.player_id,p.display_name,p.country_code
 ), ranked AS(SELECT *,rank() OVER(ORDER BY sort_units DESC) AS rank FROM rows),
 page AS(SELECT * FROM ranked ORDER BY sort_units DESC,last_achieved_at ASC,id ASC LIMIT p_limit OFFSET p_offset),
 own AS(SELECT * FROM ranked WHERE id=p_player)
 SELECT jsonb_build_object('ok',true,'protocolVersion',3,'scoreVersion',2,'ratingVersion',3,'policyId',policy,
  'entries',coalesce((SELECT jsonb_agg((to_jsonb(page)-'sort_units')||jsonb_build_object('isUser',id=p_player) ORDER BY sort_units DESC,last_achieved_at ASC,id ASC) FROM page),'[]'::jsonb),
  'userEntry',(SELECT to_jsonb(own)-'sort_units' FROM own),'totalCompetitors',(SELECT count(*) FROM ranked),
  'asOf',snap,'offset',p_offset,'nextOffset',CASE WHEN p_offset+p_limit<(SELECT count(*) FROM ranked) AND p_offset+p_limit<=10000 THEN p_offset+p_limit ELSE NULL END,
  'weekStart',CASE WHEN p_scope='weekly' THEN lo ELSE NULL END,'weekEnd',CASE WHEN p_scope='weekly' THEN hi ELSE NULL END,
  'contributions',coalesce((SELECT jsonb_agg(jsonb_build_object('gameId',game_id,'modeId',mode_id,'rawScore',raw_score,'apMicros',ap_micros,'contributionMicros',contribution_micros,'completedAt',completed_at) ORDER BY contribution_micros DESC,game_id) FROM games WHERE player_id=p_player),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.micro_arcade_lb_activity(p_player uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('submissions',count(*),'rankedGames',count(distinct game_id) FILTER(WHERE status='ranked' AND ap_micros>0),'reviews',count(*) FILTER(WHERE status='review'),
 'legacyRuns',(SELECT count(*) FROM public.micro_arcade_score_submissions WHERE player_id=p_player AND source_version=1))
 FROM public.micro_arcade_lb_runs WHERE player_id=p_player;
$$;
-- Copy compatible v2 evidence exactly once. Old v1 gameplay is retained in the original archive, not silently treated as the same economy.
INSERT INTO public.micro_arcade_lb_sessions(id,player_id,request_id,game_id,mode_id,policy_id,issued_at,expires_at,used_at)
SELECT s.session_id,s.player_id,s.session_id,s.game_id,s.mode_id,p.payload->>'policyId',s.created_at-least(s.duration_ms,21600000),s.created_at-least(s.duration_ms,21600000)+21600000,s.created_at
FROM public.micro_arcade_score_submissions s CROSS JOIN public.micro_arcade_lb_policy p WHERE s.source_version=2 AND p.version=3 AND p.payload->'policies' ? (s.game_id||':'||s.mode_id) ON CONFLICT DO NOTHING;
INSERT INTO public.micro_arcade_lb_runs(session_id,player_id,game_id,mode_id,policy_id,source_version,raw_score,duration_ms,active_ms,ap_micros,contribution_micros,completed_at,created_at,status,code,provenance)
SELECT s.session_id,s.player_id,s.game_id,s.mode_id,p.payload->>'policyId',2,s.raw_score,least(s.duration_ms,21600000),least(s.duration_ms,21600000),
 (v.val->>'apMicros')::bigint,(v.val->>'contributionMicros')::bigint,s.created_at,s.created_at,q.val->>'status',q.val->>'code','migrated-v2'
FROM public.micro_arcade_score_submissions s CROSS JOIN public.micro_arcade_lb_policy p
 CROSS JOIN LATERAL(SELECT public.micro_arcade_lb_values(s.game_id,s.mode_id,s.raw_score) AS val)v
 CROSS JOIN LATERAL(SELECT public.micro_arcade_lb_screen(s.game_id,s.mode_id,s.raw_score,least(s.duration_ms,21600000)) AS val)q
WHERE s.source_version=2 AND p.version=3 AND v.val IS NOT NULL ON CONFLICT(session_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.micro_arcade_lb_guest(p_id uuid,p_hash text,p_country text)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$ DECLARE now_ms bigint:=floor(extract(epoch from clock_timestamp())*1000);BEGIN
 IF p_hash !~ '^[a-f0-9]{64}$' OR p_country !~ '^[A-Z]{2}$' THEN RAISE EXCEPTION 'invalid guest'; END IF;
 INSERT INTO public.micro_arcade_players(id,credential_hash,credential_version,display_name,country_code,created_at,last_seen_at)
 VALUES(p_id,p_hash,2,'Player-'||upper(substr(replace(p_id::text,'-',''),1,6)),p_country,now_ms,now_ms);
 RETURN jsonb_build_object('id',p_id,'name','Player-'||upper(substr(replace(p_id::text,'-',''),1,6)),'countryCode',p_country,'createdAt',now_ms);
END $$;
CREATE OR REPLACE FUNCTION public.micro_arcade_lb_auth(p_id uuid,p_hash text,p_legacy_hash text)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$ DECLARE player public.micro_arcade_players;BEGIN
 SELECT * INTO player FROM public.micro_arcade_players WHERE id=p_id AND
 ((credential_version=2 AND credential_hash=p_hash) OR (credential_version=1 AND credential_hash=p_legacy_hash));
 IF NOT FOUND THEN RETURN NULL; END IF;
 -- 256-bit random guest secrets need no service-key-dependent pepper. Upgrade without changing identity.
 IF player.credential_version=1 THEN UPDATE public.micro_arcade_players SET credential_hash=p_hash,credential_version=2 WHERE id=p_id AND credential_version=1; END IF;
 RETURN jsonb_build_object('id',player.id,'name',player.display_name,'countryCode',player.country_code,'createdAt',player.created_at);
END $$;
CREATE OR REPLACE FUNCTION public.micro_arcade_lb_rename(p_player uuid,p_name text)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$ DECLARE p public.micro_arcade_players;BEGIN
 IF p_name IS NULL OR char_length(p_name) NOT BETWEEN 3 AND 20 THEN RAISE EXCEPTION 'invalid display name'; END IF;
 UPDATE public.micro_arcade_players SET display_name=p_name,last_seen_at=floor(extract(epoch from clock_timestamp())*1000) WHERE id=p_player RETURNING * INTO p;
 RETURN jsonb_build_object('id',p.id,'name',p.display_name,'countryCode',p.country_code,'createdAt',p.created_at);
END $$;
CREATE OR REPLACE FUNCTION public.micro_arcade_lb_result(p_player uuid,p_session uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT public.micro_arcade_lb_receipt(r) FROM public.micro_arcade_lb_runs r WHERE player_id=p_player AND session_id=p_session;
$$;
CREATE OR REPLACE FUNCTION public.micro_arcade_lb_history(p_player uuid,p_limit integer DEFAULT 20,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 WITH all_runs AS(
  SELECT r.id,r.game_id,r.mode_id,r.source_version,r.raw_score,r.ap_micros,r.contribution_micros,r.completed_at,r.status,r.code,r.provenance
  FROM public.micro_arcade_lb_runs r WHERE r.player_id=p_player
  UNION ALL SELECT r.id,r.game_id,r.mode_id,r.source_version,r.raw_score,r.score*1000000,0,r.created_at,'legacy','archived_old_rules','legacy-v1'
  FROM public.micro_arcade_score_submissions r WHERE r.player_id=p_player AND r.source_version=1
 ),page AS(SELECT * FROM all_runs ORDER BY completed_at DESC,id ASC LIMIT greatest(1,least(50,p_limit)) OFFSET greatest(0,least(10000,p_offset)))
 SELECT jsonb_build_object('entries',coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY completed_at DESC,id ASC) FROM page),'[]'::jsonb),'total',(SELECT count(*) FROM all_runs));
$$;

-- Explicit least-privilege grants; adding a function must not make it anonymously executable.
DO $$ DECLARE r record;BEGIN
 FOR r IN SELECT p.oid::regprocedure AS name FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'micro_arcade_lb_%' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',r.name);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',r.name);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
