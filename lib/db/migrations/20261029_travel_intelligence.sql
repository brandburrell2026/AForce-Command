BEGIN;
CREATE TABLE aforce_travel_accounts (
 user_id text PRIMARY KEY, revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 trips jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(trips)='array'),
 observations jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(observations)='object'),
 link_ciphertext text, linked_at timestamptz,
 monitoring boolean NOT NULL DEFAULT false, next_check_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE aforce_travel_devices (
 user_id text NOT NULL REFERENCES aforce_travel_accounts(user_id) ON DELETE CASCADE,
 device_id text NOT NULL, token_ciphertext text NOT NULL, token_hash text NOT NULL UNIQUE,
 enabled boolean NOT NULL DEFAULT false, last_sent_at timestamptz, send_lease_until timestamptz,
 PRIMARY KEY(user_id,device_id)
);
CREATE TABLE aforce_travel_alerts (
 id text PRIMARY KEY, user_id text NOT NULL, device_id text NOT NULL,
 trip_id text NOT NULL, leg_id text NOT NULL, event_key text NOT NULL,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN('queued','sending','receipt','delivered','failed','superseded')),
 attempts integer NOT NULL DEFAULT 0, ticket_id text, next_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 FOREIGN KEY(user_id,device_id) REFERENCES aforce_travel_devices(user_id,device_id) ON DELETE CASCADE,
 UNIQUE(user_id,device_id,event_key)
);
CREATE INDEX aforce_travel_accounts_due_idx ON aforce_travel_accounts(next_check_at) WHERE monitoring;
CREATE INDEX aforce_travel_alerts_due_idx ON aforce_travel_alerts(next_at) WHERE state IN('queued','sending','receipt');
COMMIT;
