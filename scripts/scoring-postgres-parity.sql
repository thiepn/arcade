-- Compare the actual PostgreSQL implementation to balance-report/golden.json's JS checksum.
WITH contexts AS (
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
SELECT count(*) AS vectors,md5(string_agg(concat_ws('|',game_id,mode,version,raw,points),E'\n' ORDER BY game_id COLLATE "C",mode COLLATE "C",version,raw)) AS checksum FROM vectors;
