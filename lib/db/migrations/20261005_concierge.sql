-- AForce Concierge (Section 64 surface) — three additive tables + three indexes.
-- Mirrors lib/db/src/schema/concierge.ts exactly (drizzle-kit push would emit the same DDL).
-- Safe to apply before the feature is enabled: the routes answer 503 until these exist,
-- and the account-deletion cascade skips the concierge purge while they are absent.
-- Idempotent (IF NOT EXISTS) so a re-run is a no-op.
BEGIN;
CREATE TABLE IF NOT EXISTS aforce_concierge_conversations (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aforce_concierge_conversations_user_updated_idx
  ON aforce_concierge_conversations (user_id, updated_at);

CREATE TABLE IF NOT EXISTS aforce_concierge_messages (
  id text PRIMARY KEY,
  conversation_id text NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aforce_concierge_messages_conversation_created_idx
  ON aforce_concierge_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS aforce_concierge_messages_user_idx
  ON aforce_concierge_messages (user_id);

CREATE TABLE IF NOT EXISTS aforce_concierge_preferences (
  user_id text PRIMARY KEY,
  prefs jsonb NOT NULL,
  consent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
