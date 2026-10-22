-- AForce Spatial Studio — saved activation designs, one additive table + one index.
-- Mirrors lib/db/src/schema/spatialStudio.ts exactly (drizzle-kit push would emit the same DDL).
-- Safe to apply before the studio talks to the API: the routes answer 503 until it exists,
-- and the account-deletion cascade skips the purge while it is absent.
-- Idempotent (IF NOT EXISTS) so a re-run is a no-op.
BEGIN;
CREATE TABLE IF NOT EXISTS aforce_spatial_studio_projects (
  user_id text NOT NULL,
  id text NOT NULL,
  name text NOT NULL,
  document jsonb NOT NULL,
  thumbnail text,
  bytes integer NOT NULL DEFAULT 0,
  fixture_count integer NOT NULL DEFAULT 0,
  asset_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT aforce_spatial_studio_projects_user_id_id_pk PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS aforce_spatial_studio_projects_user_updated_idx
  ON aforce_spatial_studio_projects (user_id, updated_at);
COMMIT;
