-- P31: backend data resilience, private recovery snapshots, verified export, and restore rehearsal.
BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE IF NOT EXISTS private.micro_arcade_recovery_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('daily','monthly','offsite','manual','pre_restore','post_restore','restore_drill')),
  captured_at timestamptz NOT NULL DEFAULT now(),
  schema_sha256 text NOT NULL CHECK (schema_sha256 ~ '^[0-9a-f]{64}$'),
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  row_counts jsonb NOT NULL CHECK (jsonb_typeof(row_counts)='object'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object'),
  payload_bytes bigint NOT NULL CHECK (payload_bytes > 0),
  verified boolean NOT NULL DEFAULT false,
  verification jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(verification)='object')
);
ALTER TABLE private.micro_arcade_recovery_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.micro_arcade_recovery_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.micro_arcade_recovery_snapshots TO service_role;
COMMENT ON TABLE private.micro_arcade_recovery_snapshots IS
  'P31 private Arcade recovery snapshots. Durable state plus only historical sessions referenced by durable score/run evidence.';

CREATE INDEX IF NOT EXISTS micro_arcade_recovery_snapshots_captured_idx
  ON private.micro_arcade_recovery_snapshots(captured_at DESC);
CREATE INDEX IF NOT EXISTS micro_arcade_recovery_snapshots_source_idx
  ON private.micro_arcade_recovery_snapshots(source,captured_at DESC);

CREATE OR REPLACE FUNCTION private.micro_arcade_p31_schema_sha256()
RETURNS text
LANGUAGE sql
STABLE
SET search_path=''
AS $$
WITH target_tables(table_name) AS (
  VALUES
    ('micro_arcade_best_scores'),
    ('micro_arcade_lb_policy'),
    ('micro_arcade_lb_reviews'),
    ('micro_arcade_lb_runs'),
    ('micro_arcade_lb_sessions'),
    ('micro_arcade_play_sessions'),
    ('micro_arcade_players'),
    ('micro_arcade_score_submissions'),
    ('micro_arcade_scoring_profiles')
),
columns_text AS (
  SELECT string_agg(
    c.table_name || ':' || lpad(c.ordinal_position::text,4,'0') || ':' || c.column_name || ':' ||
    c.udt_name || ':' || c.is_nullable || ':' || coalesce(c.column_default,''),
    E'\n' ORDER BY c.table_name,c.ordinal_position
  ) value
  FROM information_schema.columns c
  JOIN target_tables t USING(table_name)
  WHERE c.table_schema='public'
),
constraints_text AS (
  SELECT string_agg(
    cls.relname || ':' || con.conname || ':' || pg_catalog.pg_get_constraintdef(con.oid,true),
    E'\n' ORDER BY cls.relname,con.conname
  ) value
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class cls ON cls.oid=con.conrelid
  JOIN pg_catalog.pg_namespace ns ON ns.oid=cls.relnamespace
  JOIN target_tables t ON t.table_name=cls.relname
  WHERE ns.nspname='public'
),
indexes_text AS (
  SELECT string_agg(
    i.tablename || ':' || i.indexname || ':' || i.indexdef,
    E'\n' ORDER BY i.tablename,i.indexname
  ) value
  FROM pg_catalog.pg_indexes i
  JOIN target_tables t ON t.table_name=i.tablename
  WHERE i.schemaname='public'
)
SELECT encode(
  extensions.digest(
    pg_catalog.convert_to(
      coalesce((SELECT value FROM columns_text),'') || E'\n--constraints--\n' ||
      coalesce((SELECT value FROM constraints_text),'') || E'\n--indexes--\n' ||
      coalesce((SELECT value FROM indexes_text),''),
      'UTF8'
    ),
    'sha256'
  ),
  'hex'
);
$$;

CREATE OR REPLACE FUNCTION private.micro_arcade_p31_build_payload()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path=''
AS $$
SELECT jsonb_build_object(
  'micro_arcade_players',
    coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM public.micro_arcade_players t),'[]'::jsonb),
  'micro_arcade_play_sessions',
    coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id)
              FROM public.micro_arcade_play_sessions t
              WHERE EXISTS (SELECT 1 FROM public.micro_arcade_score_submissions s WHERE s.session_id=t.id)),'[]'::jsonb),
  'micro_arcade_score_submissions',
    coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM public.micro_arcade_score_submissions t),'[]'::jsonb),
  'micro_arcade_best_scores',
    coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.game_id,t.player_id) FROM public.micro_arcade_best_scores t),'[]'::jsonb),
  'micro_arcade_scoring_profiles',
    coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.game_id) FROM public.micro_arcade_scoring_profiles t),'[]'::jsonb),
  'micro_arcade_lb_policy',
    coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.version) FROM public.micro_arcade_lb_policy t),'[]'::jsonb),
  'micro_arcade_lb_sessions',
    coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id)
              FROM public.micro_arcade_lb_sessions t
              WHERE EXISTS (SELECT 1 FROM public.micro_arcade_lb_runs r WHERE r.session_id=t.id)),'[]'::jsonb),
  'micro_arcade_lb_runs',
    coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM public.micro_arcade_lb_runs t),'[]'::jsonb),
  'micro_arcade_lb_reviews',
    coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM public.micro_arcade_lb_reviews t),'[]'::jsonb)
);
$$;

CREATE OR REPLACE FUNCTION private.micro_arcade_p31_row_counts(p_payload jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path=''
AS $$
SELECT jsonb_build_object(
  'micro_arcade_players', jsonb_array_length(p_payload->'micro_arcade_players'),
  'micro_arcade_play_sessions', jsonb_array_length(p_payload->'micro_arcade_play_sessions'),
  'micro_arcade_score_submissions', jsonb_array_length(p_payload->'micro_arcade_score_submissions'),
  'micro_arcade_best_scores', jsonb_array_length(p_payload->'micro_arcade_best_scores'),
  'micro_arcade_scoring_profiles', jsonb_array_length(p_payload->'micro_arcade_scoring_profiles'),
  'micro_arcade_lb_policy', jsonb_array_length(p_payload->'micro_arcade_lb_policy'),
  'micro_arcade_lb_sessions', jsonb_array_length(p_payload->'micro_arcade_lb_sessions'),
  'micro_arcade_lb_runs', jsonb_array_length(p_payload->'micro_arcade_lb_runs'),
  'micro_arcade_lb_reviews', jsonb_array_length(p_payload->'micro_arcade_lb_reviews')
);
$$;

CREATE OR REPLACE FUNCTION public.micro_arcade_p31_verify_snapshot(p_snapshot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  s private.micro_arcade_recovery_snapshots%ROWTYPE;
  calculated_hash text;
  current_schema text;
  keys_ok boolean;
  relationships_ok boolean;
  session_scope_ok boolean;
  counts_ok boolean;
BEGIN
  SELECT * INTO s
  FROM private.micro_arcade_recovery_snapshots
  WHERE id=p_snapshot_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'code','snapshot_not_found');
  END IF;

  current_schema:=private.micro_arcade_p31_schema_sha256();
  calculated_hash:=encode(
    extensions.digest(pg_catalog.convert_to(s.payload::text,'UTF8'),'sha256'),
    'hex'
  );

  SELECT array_agg(key ORDER BY key)=ARRAY[
    'micro_arcade_best_scores',
    'micro_arcade_lb_policy',
    'micro_arcade_lb_reviews',
    'micro_arcade_lb_runs',
    'micro_arcade_lb_sessions',
    'micro_arcade_play_sessions',
    'micro_arcade_players',
    'micro_arcade_score_submissions',
    'micro_arcade_scoring_profiles'
  ]::text[]
  INTO keys_ok
  FROM jsonb_object_keys(s.payload) AS x(key);

  counts_ok:=s.row_counts=private.micro_arcade_p31_row_counts(s.payload);

  SELECT
    NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(s.payload->'micro_arcade_score_submissions') x
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.payload->'micro_arcade_players') p
        WHERE p->>'id'=x->>'player_id'
      )
      OR NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.payload->'micro_arcade_play_sessions') ps
        WHERE ps->>'id'=x->>'session_id'
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(s.payload->'micro_arcade_best_scores') x
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.payload->'micro_arcade_players') p
        WHERE p->>'id'=x->>'player_id'
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(s.payload->'micro_arcade_lb_runs') x
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.payload->'micro_arcade_players') p
        WHERE p->>'id'=x->>'player_id'
      )
      OR NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.payload->'micro_arcade_lb_sessions') ls
        WHERE ls->>'id'=x->>'session_id'
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(s.payload->'micro_arcade_lb_reviews') x
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.payload->'micro_arcade_lb_runs') r
        WHERE r->>'id'=x->>'run_id'
      )
    )
  INTO relationships_ok;

  SELECT
    NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(s.payload->'micro_arcade_play_sessions') ps
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.payload->'micro_arcade_score_submissions') x
        WHERE x->>'session_id'=ps->>'id'
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(s.payload->'micro_arcade_lb_sessions') ls
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.payload->'micro_arcade_lb_runs') x
        WHERE x->>'session_id'=ls->>'id'
      )
    )
  INTO session_scope_ok;

  UPDATE private.micro_arcade_recovery_snapshots
  SET verified=(
        keys_ok
        AND counts_ok
        AND relationships_ok
        AND session_scope_ok
        AND s.schema_sha256=current_schema
        AND s.payload_sha256=calculated_hash
      ),
      verification=jsonb_build_object(
        'keysOk',keys_ok,
        'countsOk',counts_ok,
        'relationshipsOk',relationships_ok,
        'sessionScopeOk',session_scope_ok,
        'schemaMatches',s.schema_sha256=current_schema,
        'payloadHashMatches',s.payload_sha256=calculated_hash,
        'verifiedAt',now()
      )
  WHERE id=s.id;

  RETURN jsonb_build_object(
    'ok',keys_ok AND counts_ok AND relationships_ok AND session_scope_ok
         AND s.schema_sha256=current_schema AND s.payload_sha256=calculated_hash,
    'snapshotId',s.id,
    'schemaSha256',current_schema,
    'rowCounts',s.row_counts
  );
END
$$;

CREATE OR REPLACE FUNCTION public.micro_arcade_p31_capture_snapshot(p_source text DEFAULT 'manual')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  payload jsonb;
  counts jsonb;
  schema_hash text;
  payload_hash text;
  snapshot_id uuid;
  verification jsonb;
BEGIN
  IF p_source NOT IN ('daily','monthly','offsite','manual','pre_restore','post_restore','restore_drill') THEN
    RAISE EXCEPTION 'invalid snapshot source';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('micro_arcade_p31_snapshot'));
  payload:=private.micro_arcade_p31_build_payload();
  counts:=private.micro_arcade_p31_row_counts(payload);
  schema_hash:=private.micro_arcade_p31_schema_sha256();
  payload_hash:=encode(
    extensions.digest(pg_catalog.convert_to(payload::text,'UTF8'),'sha256'),
    'hex'
  );

  INSERT INTO private.micro_arcade_recovery_snapshots(
    source,schema_sha256,payload_sha256,row_counts,payload,payload_bytes
  )
  VALUES(
    p_source,schema_hash,payload_hash,counts,payload,
    pg_catalog.octet_length(pg_catalog.convert_to(payload::text,'UTF8'))
  )
  RETURNING id INTO snapshot_id;

  verification:=public.micro_arcade_p31_verify_snapshot(snapshot_id);
  IF coalesce((verification->>'ok')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'P31 snapshot verification failed';
  END IF;

  DELETE FROM private.micro_arcade_recovery_snapshots
  WHERE id<>snapshot_id
    AND (
      (source='daily' AND captured_at<now()-interval '35 days') OR
      (source='monthly' AND captured_at<now()-interval '370 days') OR
      (source='offsite' AND captured_at<now()-interval '100 days') OR
      (source='restore_drill' AND captured_at<now()-interval '14 days') OR
      (source='post_restore' AND captured_at<now()-interval '90 days')
    );

  RETURN (
    SELECT jsonb_build_object(
      'ok',true,
      'snapshotId',id,
      'source',source,
      'capturedAt',captured_at,
      'schemaSha256',schema_sha256,
      'payloadSha256',payload_sha256,
      'payloadBytes',payload_bytes,
      'rowCounts',row_counts
    )
    FROM private.micro_arcade_recovery_snapshots
    WHERE id=snapshot_id
  );
END
$$;

CREATE OR REPLACE FUNCTION public.micro_arcade_p31_restore_drill(p_snapshot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  s private.micro_arcade_recovery_snapshots%ROWTYPE;
  counts jsonb;
  relationships_ok boolean;
BEGIN
  SELECT * INTO s FROM private.micro_arcade_recovery_snapshots WHERE id=p_snapshot_id;
  IF NOT FOUND OR NOT s.verified THEN
    RETURN jsonb_build_object('ok',false,'code','snapshot_not_verified');
  END IF;

  CREATE TEMP TABLE p31_players ON COMMIT DROP AS SELECT * FROM public.micro_arcade_players WITH NO DATA;
  CREATE TEMP TABLE p31_play_sessions ON COMMIT DROP AS SELECT * FROM public.micro_arcade_play_sessions WITH NO DATA;
  CREATE TEMP TABLE p31_score_submissions ON COMMIT DROP AS SELECT * FROM public.micro_arcade_score_submissions WITH NO DATA;
  CREATE TEMP TABLE p31_best_scores ON COMMIT DROP AS SELECT * FROM public.micro_arcade_best_scores WITH NO DATA;
  CREATE TEMP TABLE p31_scoring_profiles ON COMMIT DROP AS SELECT * FROM public.micro_arcade_scoring_profiles WITH NO DATA;
  CREATE TEMP TABLE p31_lb_policy ON COMMIT DROP AS SELECT * FROM public.micro_arcade_lb_policy WITH NO DATA;
  CREATE TEMP TABLE p31_lb_sessions ON COMMIT DROP AS SELECT * FROM public.micro_arcade_lb_sessions WITH NO DATA;
  CREATE TEMP TABLE p31_lb_runs ON COMMIT DROP AS SELECT * FROM public.micro_arcade_lb_runs WITH NO DATA;
  CREATE TEMP TABLE p31_lb_reviews ON COMMIT DROP AS SELECT * FROM public.micro_arcade_lb_reviews WITH NO DATA;

  INSERT INTO p31_players SELECT * FROM jsonb_populate_recordset(NULL::public.micro_arcade_players,s.payload->'micro_arcade_players');
  INSERT INTO p31_play_sessions SELECT * FROM jsonb_populate_recordset(NULL::public.micro_arcade_play_sessions,s.payload->'micro_arcade_play_sessions');
  INSERT INTO p31_score_submissions SELECT * FROM jsonb_populate_recordset(NULL::public.micro_arcade_score_submissions,s.payload->'micro_arcade_score_submissions');
  INSERT INTO p31_best_scores SELECT * FROM jsonb_populate_recordset(NULL::public.micro_arcade_best_scores,s.payload->'micro_arcade_best_scores');
  INSERT INTO p31_scoring_profiles SELECT * FROM jsonb_populate_recordset(NULL::public.micro_arcade_scoring_profiles,s.payload->'micro_arcade_scoring_profiles');
  INSERT INTO p31_lb_policy SELECT * FROM jsonb_populate_recordset(NULL::public.micro_arcade_lb_policy,s.payload->'micro_arcade_lb_policy');
  INSERT INTO p31_lb_sessions SELECT * FROM jsonb_populate_recordset(NULL::public.micro_arcade_lb_sessions,s.payload->'micro_arcade_lb_sessions');
  INSERT INTO p31_lb_runs SELECT * FROM jsonb_populate_recordset(NULL::public.micro_arcade_lb_runs,s.payload->'micro_arcade_lb_runs');
  INSERT INTO p31_lb_reviews SELECT * FROM jsonb_populate_recordset(NULL::public.micro_arcade_lb_reviews,s.payload->'micro_arcade_lb_reviews');

  counts:=jsonb_build_object(
    'micro_arcade_players',(SELECT count(*) FROM p31_players),
    'micro_arcade_play_sessions',(SELECT count(*) FROM p31_play_sessions),
    'micro_arcade_score_submissions',(SELECT count(*) FROM p31_score_submissions),
    'micro_arcade_best_scores',(SELECT count(*) FROM p31_best_scores),
    'micro_arcade_scoring_profiles',(SELECT count(*) FROM p31_scoring_profiles),
    'micro_arcade_lb_policy',(SELECT count(*) FROM p31_lb_policy),
    'micro_arcade_lb_sessions',(SELECT count(*) FROM p31_lb_sessions),
    'micro_arcade_lb_runs',(SELECT count(*) FROM p31_lb_runs),
    'micro_arcade_lb_reviews',(SELECT count(*) FROM p31_lb_reviews)
  );

  SELECT
    NOT EXISTS (
      SELECT 1 FROM p31_score_submissions x
      LEFT JOIN p31_players p ON p.id=x.player_id
      LEFT JOIN p31_play_sessions ps ON ps.id=x.session_id
      WHERE p.id IS NULL OR ps.id IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM p31_best_scores x LEFT JOIN p31_players p ON p.id=x.player_id WHERE p.id IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM p31_lb_runs x
      LEFT JOIN p31_players p ON p.id=x.player_id
      LEFT JOIN p31_lb_sessions ls ON ls.id=x.session_id
      WHERE p.id IS NULL OR ls.id IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM p31_lb_reviews x LEFT JOIN p31_lb_runs r ON r.id=x.run_id WHERE r.id IS NULL
    )
  INTO relationships_ok;

  RETURN jsonb_build_object(
    'ok',counts=s.row_counts AND relationships_ok,
    'snapshotId',s.id,
    'schemaSha256',s.schema_sha256,
    'rowCounts',counts,
    'relationshipsOk',relationships_ok,
    'productionMutated',false
  );
END
$$;

CREATE OR REPLACE FUNCTION public.micro_arcade_p31_offsite_export()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  capture jsonb;
  snapshot_id uuid;
  drill jsonb;
  s private.micro_arcade_recovery_snapshots%ROWTYPE;
BEGIN
  capture:=public.micro_arcade_p31_capture_snapshot('offsite');
  snapshot_id:=(capture->>'snapshotId')::uuid;
  drill:=public.micro_arcade_p31_restore_drill(snapshot_id);
  IF coalesce((drill->>'ok')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'P31 restore drill failed';
  END IF;

  SELECT * INTO s FROM private.micro_arcade_recovery_snapshots WHERE id=snapshot_id;
  IF NOT FOUND OR NOT s.verified THEN
    RAISE EXCEPTION 'P31 verified snapshot missing';
  END IF;

  RETURN jsonb_build_object(
    'format','arcade-p31-offsite-v1',
    'project_ref','hycegznamzjhwinegaai',
    'schema_sha256',s.schema_sha256,
    'snapshot_count',1,
    'excluded_transient',jsonb_build_array('micro_arcade_rate_limits','unused micro_arcade_play_sessions','unused micro_arcade_lb_sessions'),
    'restore_drill',drill,
    'snapshot',jsonb_build_object(
      'id',s.id,
      'source',s.source,
      'captured_at',s.captured_at,
      'schema_sha256',s.schema_sha256,
      'payload_sha256',s.payload_sha256,
      'payload_bytes',s.payload_bytes,
      'row_counts',s.row_counts,
      'verified',s.verified,
      'verification',s.verification,
      'payload',s.payload
    )
  );
END
$$;

REVOKE ALL ON FUNCTION private.micro_arcade_p31_schema_sha256() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.micro_arcade_p31_build_payload() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.micro_arcade_p31_row_counts(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.micro_arcade_p31_schema_sha256() TO service_role;
GRANT EXECUTE ON FUNCTION private.micro_arcade_p31_build_payload() TO service_role;
GRANT EXECUTE ON FUNCTION private.micro_arcade_p31_row_counts(jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.micro_arcade_p31_verify_snapshot(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.micro_arcade_p31_capture_snapshot(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.micro_arcade_p31_restore_drill(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.micro_arcade_p31_offsite_export() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.micro_arcade_p31_verify_snapshot(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.micro_arcade_p31_capture_snapshot(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.micro_arcade_p31_restore_drill(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.micro_arcade_p31_offsite_export() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname='pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='micro-arcade-p31-daily') THEN
      PERFORM cron.schedule(
        'micro-arcade-p31-daily',
        '17 3 * * *',
        'select public.micro_arcade_p31_capture_snapshot(''daily'');'
      );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='micro-arcade-p31-monthly') THEN
      PERFORM cron.schedule(
        'micro-arcade-p31-monthly',
        '47 3 1 * *',
        'select public.micro_arcade_p31_capture_snapshot(''monthly'');'
      );
    END IF;
  END IF;
END
$$;

NOTIFY pgrst,'reload schema';
COMMIT;
