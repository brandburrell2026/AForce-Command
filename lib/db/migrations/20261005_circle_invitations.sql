-- Manually reviewed additive migration. Apply before enabling CIRCLE_MEMBERSHIP_ENABLED.
BEGIN;
CREATE TABLE aforce_circle_invitations (
  id text PRIMARY KEY,
  owner_user_id text NOT NULL,
  display_name text NOT NULL,
  "group" text NOT NULL DEFAULT 'friends',
  code_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by_user_id text,
  revoked_at timestamptz
);
CREATE UNIQUE INDEX aforce_circle_invitations_code_uq ON aforce_circle_invitations(code_hash);
CREATE INDEX aforce_circle_invitations_owner_idx ON aforce_circle_invitations(owner_user_id);
COMMIT;
