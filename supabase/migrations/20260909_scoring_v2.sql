-- Scoring v2: preserve every native record, migrate to Arcade Points, bind modes to sessions.
-- GENERATED profile values by scripts/generate-scoring-migrations.py.
BEGIN;
LOCK TABLE public.micro_arcade_score_submissions, public.micro_arcade_best_scores, public.micro_arcade_play_sessions IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE IF NOT EXISTS public.micro_arcade_scoring_profiles (game_id text PRIMARY KEY, profile jsonb NOT NULL);
ALTER TABLE public.micro_arcade_scoring_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.micro_arcade_scoring_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.micro_arcade_scoring_profiles TO service_role;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('orbit', '{"anchors":[1500,6500,18000],"legacyAnchors":[1500,6500,18000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('stack', '{"anchors":[12,45,120],"legacyAnchors":[12,45,120],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('reaction', '{"anchors":[4500,14000,24000],"legacyAnchors":[4500,14000,24000],"kind":"finite"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('dodge', '{"anchors":[3500,14000,40000],"legacyAnchors":[3500,14000,40000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('pulse', '{"anchors":[8000,32000,85000],"legacyAnchors":[30000,200000,650000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('merge', '{"anchors":[1500,10000,50000],"legacyAnchors":[1500,10000,50000],"kind":"puzzle"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('typerush', '{"anchors":[10000,100000,350000],"legacyAnchors":[10000,100000,350000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('oneline', '{"anchors":[3000,14000,40000],"legacyAnchors":[3000,14000,40000],"kind":"endless-puzzle"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('breakout', '{"anchors":[5000,25000,90000],"legacyAnchors":[5000,25000,90000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('perfectstop', '{"anchors":[4000,13000,25000],"legacyAnchors":[4000,13000,25000],"kind":"finite"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('chain', '{"anchors":[7000,30000,100000],"legacyAnchors":[25000,350000,1400000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('gravity', '{"anchors":[2500,8500,16000],"legacyAnchors":[2500,8500,16000],"kind":"finite"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('blade', '{"anchors":[5000,22000,75000],"legacyAnchors":[5000,22000,75000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('pinball', '{"anchors":[8000,40000,140000],"legacyAnchors":[8000,40000,140000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('chrono', '{"anchors":[2500,9500,28000],"legacyAnchors":[2500,9500,28000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('matrix', '{"anchors":[2500,11000,35000],"legacyAnchors":[2500,20000,100000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('drift', '{"anchors":[5000,22000,70000],"legacyAnchors":[25000,200000,750000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('vanguard', '{"anchors":[8000,45000,180000],"legacyAnchors":[8000,45000,180000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('slingshot', '{"anchors":[6000,28000,100000],"legacyAnchors":[6000,28000,100000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('snake', '{"anchors":[3000,16000,50000],"legacyAnchors":[3000,16000,50000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('rhythm', '{"anchors":[35000,145000,290000],"legacyAnchors":[200000,800000,1700000],"kind":"looping","modes":{"cyber_odyssey":{"anchors":[35000,145000,290000],"reward":1},"neon_midnight":{"anchors":[30000,125000,250000],"reward":0.85},"hypernova":{"anchors":[36000,150000,300000],"reward":1.3}}}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('tower', '{"anchors":[8000,32000,100000],"legacyAnchors":[8000,32000,100000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('pacmaze', '{"anchors":[1500,6500,22000],"legacyAnchors":[1500,6500,22000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('flappyaero', '{"anchors":[1500,9000,32000],"legacyAnchors":[1500,9000,32000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('roadcross', '{"anchors":[800,5000,18000],"legacyAnchors":[800,5000,18000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('bubblebuster', '{"anchors":[7000,35000,120000],"legacyAnchors":[7000,35000,120000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('astroblaster', '{"anchors":[4000,18000,65000],"legacyAnchors":[4000,18000,65000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('laserrope', '{"anchors":[5000,24000,80000],"legacyAnchors":[5000,24000,80000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('blockdrop', '{"anchors":[1500,12000,55000],"legacyAnchors":[1500,12000,55000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('knifetarget', '{"anchors":[4500,22000,65000],"legacyAnchors":[4500,22000,65000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('airhockey', '{"anchors":[1500,7000,20000],"legacyAnchors":[1500,7000,20000],"kind":"timed"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;
INSERT INTO public.micro_arcade_scoring_profiles VALUES ('neonrail', '{"anchors":[10000,40000,110000],"legacyAnchors":[10000,40000,110000],"kind":"endless"}'::jsonb) ON CONFLICT (game_id) DO UPDATE SET profile=excluded.profile;

CREATE OR REPLACE FUNCTION public.micro_arcade_points(p_game_id text, p_raw bigint, p_source_version integer DEFAULT 2, p_mode_id text DEFAULT 'standard')
RETURNS bigint LANGUAGE plpgsql STABLE SET search_path TO public AS $fn$
DECLARE cfg jsonb; anchors jsonb; a double precision; b double precision; c double precision;
  raw double precision; points double precision; reward double precision := 1;
BEGIN
  IF p_raw IS NULL OR p_raw < 0 OR p_raw > 9007199254740991 OR p_source_version IS NULL OR p_source_version NOT IN (1,2) THEN RETURN NULL; END IF;
  SELECT profile INTO cfg FROM public.micro_arcade_scoring_profiles WHERE game_id=p_game_id;
  IF cfg IS NULL THEN RETURN NULL; END IF;
  IF p_source_version=1 THEN anchors := cfg->'legacyAnchors';
  ELSE
    IF p_mode_id IS NULL THEN RETURN NULL; END IF;
    IF p_game_id='rhythm' THEN
      IF NOT (cfg->'modes' ? p_mode_id) THEN RETURN NULL; END IF;
      anchors := cfg->'modes'->p_mode_id->'anchors';
      reward := (cfg->'modes'->p_mode_id->>'reward')::double precision;
    ELSE
      IF (p_game_id='airhockey' AND p_mode_id NOT IN ('EASY','MEDIUM','HARD')) OR
         (p_game_id<>'airhockey' AND p_mode_id<>'standard') THEN RETURN NULL; END IF;
      anchors := cfg->'anchors';
    END IF;
  END IF;
  a := (anchors->>0)::double precision; b := (anchors->>1)::double precision; c := (anchors->>2)::double precision;
  raw := p_raw::double precision;
  points := CASE WHEN raw <= a THEN 1000*raw/a
    WHEN raw <= b THEN 1000+2000*(raw-a)/(b-a)
    WHEN raw <= c THEN 3000+3000*(raw-b)/(c-b)
    ELSE 6000+2000*ln(raw/c)/ln(2::double precision) END;
  RETURN floor(points*reward+1e-7)::bigint;
END; $fn$;
REVOKE ALL ON FUNCTION public.micro_arcade_points(text,bigint,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.micro_arcade_points(text,bigint,integer,text) TO service_role;

ALTER TABLE public.micro_arcade_play_sessions ADD COLUMN IF NOT EXISTS score_version integer NOT NULL DEFAULT 1 CHECK (score_version IN (1,2));
ALTER TABLE public.micro_arcade_play_sessions ADD COLUMN IF NOT EXISTS mode_id text NOT NULL DEFAULT 'legacy';
ALTER TABLE public.micro_arcade_score_submissions ADD COLUMN IF NOT EXISTS raw_score bigint;
ALTER TABLE public.micro_arcade_score_submissions ADD COLUMN IF NOT EXISTS source_version integer NOT NULL DEFAULT 1 CHECK (source_version IN (1,2));
ALTER TABLE public.micro_arcade_score_submissions ADD COLUMN IF NOT EXISTS mode_id text NOT NULL DEFAULT 'legacy';
ALTER TABLE public.micro_arcade_best_scores ADD COLUMN IF NOT EXISTS raw_score bigint;
ALTER TABLE public.micro_arcade_best_scores ADD COLUMN IF NOT EXISTS source_version integer NOT NULL DEFAULT 1 CHECK (source_version IN (1,2));
ALTER TABLE public.micro_arcade_best_scores ADD COLUMN IF NOT EXISTS mode_id text NOT NULL DEFAULT 'legacy';
-- raw_score is the immutable pre-conversion backup. Null guards prevent double conversion.
UPDATE public.micro_arcade_score_submissions SET raw_score=score, score=public.micro_arcade_points(game_id,score,1,'legacy') WHERE raw_score IS NULL;
UPDATE public.micro_arcade_best_scores SET raw_score=score, score=public.micro_arcade_points(game_id,score,1,'legacy') WHERE raw_score IS NULL;
ALTER TABLE public.micro_arcade_score_submissions ALTER COLUMN raw_score SET NOT NULL;
ALTER TABLE public.micro_arcade_best_scores ALTER COLUMN raw_score SET NOT NULL;
COMMENT ON COLUMN public.micro_arcade_score_submissions.score IS 'Canonical v2 Arcade Points, not the native engine counter.';
COMMENT ON COLUMN public.micro_arcade_score_submissions.raw_score IS 'Preserved native counter; source_version identifies the engine reward economy.';

CREATE OR REPLACE FUNCTION public.micro_arcade_consume_score_v2(p_player_id uuid, p_session_id uuid, p_score bigint, p_duration_ms bigint, p_now bigint, p_source_version integer, p_mode_id text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO public AS $fn$
DECLARE sess public.micro_arcade_play_sessions%ROWTYPE; points bigint; v_best bigint; cfg jsonb;
BEGIN
  SELECT * INTO sess FROM public.micro_arcade_play_sessions WHERE id=p_session_id AND player_id=p_player_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','unknown_session'); END IF;
  IF sess.used_at IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'code','session_used'); END IF;
  IF p_source_version IS DISTINCT FROM sess.score_version OR p_mode_id IS DISTINCT FROM sess.mode_id THEN RETURN jsonb_build_object('ok',false,'code','score_context_mismatch'); END IF;
  IF p_now IS NULL OR p_duration_ms IS NULL OR p_duration_ms<0 OR p_now>sess.expires_at OR p_now<sess.issued_at OR p_now-sess.issued_at>21600000 OR abs((p_now-sess.issued_at)-p_duration_ms)>90000 THEN RETURN jsonb_build_object('ok',false,'code','session_timing'); END IF;
  IF p_now-sess.issued_at < (CASE WHEN sess.game_id='reaction' THEN 750 ELSE 250 END) THEN RETURN jsonb_build_object('ok',false,'code','session_timing'); END IF;
  SELECT profile INTO cfg FROM public.micro_arcade_scoring_profiles WHERE game_id=sess.game_id;
  IF p_score IS NULL OR p_score<0 OR p_score>(CASE WHEN cfg->>'kind'='finite' THEN 100000 WHEN sess.game_id='airhockey' THEN 1000000 ELSE 1000000000000 END) THEN RETURN jsonb_build_object('ok',false,'code','invalid_score'); END IF;
  points := public.micro_arcade_points(sess.game_id,p_score,p_source_version,p_mode_id);
  IF points IS NULL THEN RETURN jsonb_build_object('ok',false,'code','invalid_score'); END IF;
  UPDATE public.micro_arcade_play_sessions SET used_at=p_now WHERE id=p_session_id;
  INSERT INTO public.micro_arcade_score_submissions(id,session_id,player_id,game_id,score,duration_ms,created_at,raw_score,source_version,mode_id)
    VALUES(gen_random_uuid(),p_session_id,p_player_id,sess.game_id,points,p_duration_ms,p_now,p_score,p_source_version,p_mode_id);
  INSERT INTO public.micro_arcade_best_scores(game_id,player_id,score,achieved_at,submissions,raw_score,source_version,mode_id)
    VALUES(sess.game_id,p_player_id,points,p_now,1,p_score,p_source_version,p_mode_id)
  ON CONFLICT(game_id,player_id) DO UPDATE SET
    raw_score=CASE WHEN excluded.score>micro_arcade_best_scores.score THEN excluded.raw_score ELSE micro_arcade_best_scores.raw_score END,
    source_version=CASE WHEN excluded.score>micro_arcade_best_scores.score THEN excluded.source_version ELSE micro_arcade_best_scores.source_version END,
    mode_id=CASE WHEN excluded.score>micro_arcade_best_scores.score THEN excluded.mode_id ELSE micro_arcade_best_scores.mode_id END,
    achieved_at=CASE WHEN excluded.score>micro_arcade_best_scores.score THEN excluded.achieved_at ELSE micro_arcade_best_scores.achieved_at END,
    score=greatest(excluded.score,micro_arcade_best_scores.score), submissions=micro_arcade_best_scores.submissions+1
  RETURNING score INTO v_best;
  RETURN jsonb_build_object('ok',true,'gameId',sess.game_id,'score',points,'bestScore',v_best,'scoreVersion',2);
END; $fn$;
-- Cached v1 clients remain safe: native scores use legacy calibration, never mix raw and AP.
CREATE OR REPLACE FUNCTION public.micro_arcade_consume_score(p_player_id uuid,p_session_id uuid,p_score bigint,p_duration_ms bigint,p_now bigint)
RETURNS jsonb LANGUAGE sql SET search_path TO public AS $fn$
  SELECT public.micro_arcade_consume_score_v2(p_player_id,p_session_id,p_score,p_duration_ms,p_now,1,'legacy');
$fn$;
REVOKE ALL ON FUNCTION public.micro_arcade_consume_score_v2(uuid,uuid,bigint,bigint,bigint,integer,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.micro_arcade_consume_score(uuid,uuid,bigint,bigint,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.micro_arcade_consume_score_v2(uuid,uuid,bigint,bigint,bigint,integer,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.micro_arcade_consume_score(uuid,uuid,bigint,bigint,bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.micro_arcade_overall_leaderboard(p_player_id uuid,p_limit integer DEFAULT 20) RETURNS jsonb LANGUAGE sql STABLE SET search_path TO public AS $fn$
WITH best AS (SELECT * FROM public.micro_arcade_best_scores WHERE score>0),
totals AS (
  SELECT p.id,p.display_name AS name,p.country_code,sum(bs.score)::bigint AS total_score,
    sum(least(bs.score,10000))::bigint AS rating_score,count(*)::bigint AS games_played,max(bs.achieved_at)::bigint AS last_achieved_at
  FROM best bs JOIN public.micro_arcade_players p ON p.id=bs.player_id GROUP BY p.id,p.display_name,p.country_code
), ranked AS (
  SELECT *,row_number() OVER(ORDER BY rating_score DESC,total_score DESC,last_achieved_at ASC,id ASC) AS rank FROM totals
), top_rows AS (SELECT * FROM ranked ORDER BY rank LIMIT greatest(1,least(50,p_limit))), own AS (SELECT * FROM ranked WHERE id=p_player_id)
SELECT jsonb_build_object('scoreVersion',2,'ratingGameCap',10000,
  'entries',coalesce((SELECT jsonb_agg(to_jsonb(top_rows)||jsonb_build_object('isUser',id=p_player_id) ORDER BY rank) FROM top_rows),'[]'::jsonb),
  'userEntry',(SELECT to_jsonb(own) FROM own),'totalCompetitors',(SELECT count(*) FROM ranked));
$fn$;
REVOKE ALL ON FUNCTION public.micro_arcade_overall_leaderboard(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.micro_arcade_overall_leaderboard(uuid,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.micro_arcade_weekly_leaderboard(p_player_id uuid,p_limit integer,p_week_start bigint,p_week_end bigint) RETURNS jsonb LANGUAGE sql STABLE SET search_path TO public AS $fn$
WITH weekly_ranked AS (
  SELECT *, row_number() OVER(PARTITION BY player_id,game_id ORDER BY score DESC,created_at ASC,id ASC) AS rn
  FROM public.micro_arcade_score_submissions WHERE score>0 AND created_at>=p_week_start AND created_at<p_week_end
), best AS (SELECT player_id,game_id,score,created_at AS achieved_at FROM weekly_ranked WHERE rn=1),
totals AS (
  SELECT p.id,p.display_name AS name,p.country_code,sum(bs.score)::bigint AS total_score,
    sum(least(bs.score,10000))::bigint AS rating_score,count(*)::bigint AS games_played,max(bs.achieved_at)::bigint AS last_achieved_at
  FROM best bs JOIN public.micro_arcade_players p ON p.id=bs.player_id GROUP BY p.id,p.display_name,p.country_code
), ranked AS (
  SELECT *,row_number() OVER(ORDER BY rating_score DESC,total_score DESC,last_achieved_at ASC,id ASC) AS rank FROM totals
), top_rows AS (SELECT * FROM ranked ORDER BY rank LIMIT greatest(1,least(50,p_limit))), own AS (SELECT * FROM ranked WHERE id=p_player_id)
SELECT jsonb_build_object('scoreVersion',2,'ratingGameCap',10000,
  'entries',coalesce((SELECT jsonb_agg(to_jsonb(top_rows)||jsonb_build_object('isUser',id=p_player_id) ORDER BY rank) FROM top_rows),'[]'::jsonb),
  'userEntry',(SELECT to_jsonb(own) FROM own),'totalCompetitors',(SELECT count(*) FROM ranked), 'weekStart',p_week_start,'weekEnd',p_week_end);
$fn$;
REVOKE ALL ON FUNCTION public.micro_arcade_weekly_leaderboard(uuid,integer,bigint,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.micro_arcade_weekly_leaderboard(uuid,integer,bigint,bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.micro_arcade_game_leaderboard(p_game_id text,p_player_id uuid,p_limit integer DEFAULT 10)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO public AS $fn$
WITH ranked AS (
  SELECT bs.player_id AS id,p.display_name AS name,p.country_code,bs.score,bs.achieved_at,
    bs.raw_score,bs.source_version,bs.mode_id,
    row_number() OVER(ORDER BY bs.score DESC,bs.achieved_at ASC,bs.player_id ASC) AS rank
  FROM public.micro_arcade_best_scores bs JOIN public.micro_arcade_players p ON p.id=bs.player_id WHERE bs.game_id=p_game_id AND bs.score>0
), top_rows AS (SELECT * FROM ranked ORDER BY rank LIMIT greatest(1,least(50,p_limit))), own AS (SELECT * FROM ranked WHERE id=p_player_id)
SELECT jsonb_build_object('gameId',p_game_id,'scoreVersion',2,
  'entries',coalesce((SELECT jsonb_agg(to_jsonb(top_rows)||jsonb_build_object('isUser',id=p_player_id) ORDER BY rank) FROM top_rows),'[]'::jsonb),
  'userEntry',(SELECT to_jsonb(own) FROM own),'totalCompetitors',(SELECT count(*) FROM ranked));
$fn$;
REVOKE ALL ON FUNCTION public.micro_arcade_game_leaderboard(text,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.micro_arcade_game_leaderboard(text,uuid,integer) TO service_role;
NOTIFY pgrst,'reload schema';
DO $gate$ DECLARE actual text; n bigint; BEGIN SELECT vectors,checksum INTO n,actual FROM (WITH contexts AS (
 SELECT game_id,'legacy'::text AS mode,1 AS version,profile->'legacyAnchors' AS anchors
 FROM public.micro_arcade_scoring_profiles
 UNION ALL
 SELECT p.game_id,m.mode,2,coalesce(p.profile->'modes'->m.mode->'anchors',p.profile->'anchors')
 FROM public.micro_arcade_scoring_profiles p
 CROSS JOIN LATERAL unnest(CASE WHEN p.game_id='rhythm' THEN ARRAY['cyber_odyssey','neon_midnight','hypernova']
  WHEN p.game_id='airhockey' THEN ARRAY['EASY','MEDIUM','HARD'] ELSE ARRAY['standard'] END) AS m(mode)
), anchors AS (
 SELECT game_id,mode,version,(anchors->>0)::bigint AS a,(anchors->>1)::bigint AS b,(anchors->>2)::bigint AS c FROM contexts
), vectors AS (
 SELECT game_id,mode,version,raw,public.micro_arcade_points(game_id,raw,version,mode) AS points FROM anchors
 CROSS JOIN LATERAL unnest(CASE WHEN version=1 THEN ARRAY[0,1,a,b,c,c*2,c*4,1000000]
  ELSE ARRAY[0,1,a-1,a,a+1,b-1,b,b+1,c-1,c,c+1,c*2,c*4,1000000,1000000000,9007199254740991] END) AS samples(raw)
)
SELECT count(*) AS vectors,md5(string_agg(concat_ws('|',game_id,mode,version,raw,points),E'\n' ORDER BY game_id COLLATE "C",mode COLLATE "C",version,raw)) AS checksum FROM vectors) checked; IF n<>832 OR actual<>'ff7a0b29f6f0e86f9203b1d04b2e6f32' THEN RAISE EXCEPTION 'Scoring JS/PostgreSQL parity mismatch: % vectors, checksum %',n,actual; END IF; END; $gate$;
COMMIT;
