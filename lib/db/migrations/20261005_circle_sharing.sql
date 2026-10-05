-- Apply before enabling CIRCLE_SHARING_ENABLED; creates no consent for existing users.
BEGIN;
CREATE TABLE aforce_circle_sharing_grants (
  source_user_id text NOT NULL,
  recipient_user_id text NOT NULL,
  allow_score boolean NOT NULL DEFAULT false,
  allow_state boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  acknowledgement_version text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(source_user_id, recipient_user_id)
);
COMMIT;
