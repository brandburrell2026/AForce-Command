-- Reviewed additive migration for v1.8.2's water-only HydroState rule.
-- Recorded drinks are intentionally isolated from scored intake logs: saving a
-- coffee, tea, or AForce drink must not mutate hydration counters or score.
BEGIN;

CREATE TABLE IF NOT EXISTS aforce_recorded_drinks (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  category_id text NOT NULL,
  display_name text NOT NULL,
  oz_amount real NOT NULL,
  entry_source text,
  client_event_id text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aforce_recorded_drinks_user_recorded_idx
  ON aforce_recorded_drinks(user_id, recorded_at);

CREATE UNIQUE INDEX IF NOT EXISTS aforce_recorded_drinks_user_client_uq
  ON aforce_recorded_drinks(user_id, client_event_id);

COMMIT;
