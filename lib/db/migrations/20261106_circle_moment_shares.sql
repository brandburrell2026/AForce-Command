-- Explicit Circle Moment shares. Applies no historical shares and contains no
-- performance, hydration, health, score, state, or goal columns.
BEGIN;

CREATE TABLE aforce_circle_moment_shares (
  id text PRIMARY KEY,
  source_user_id text NOT NULL,
  recipient_user_id text NOT NULL,
  moment_id text NOT NULL,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE UNIQUE INDEX aforce_circle_moment_shares_source_recipient_moment_uq
  ON aforce_circle_moment_shares(source_user_id, recipient_user_id, moment_id);

CREATE INDEX aforce_circle_moment_shares_recipient_active_idx
  ON aforce_circle_moment_shares(recipient_user_id, revoked_at, starts_at);

COMMIT;
