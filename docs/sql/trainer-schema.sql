-- Trainer surface — reviewed DDL for the 14 tables.
--
--                    *** THIS HAS NOT BEEN APPLIED ANYWHERE ***
--
-- WHY THIS FILE EXISTS. `lib/db` has no migration files: the convention is
-- `drizzle-kit push`, which diffs the schema against a live database and
-- applies the difference. That is fine for a table nobody writes to yet and
-- poor for fourteen tables carrying medical notes and an audit log, because
-- nobody sees the statements before they run and `push` is not transactional
-- across fourteen tables — a failure part-way leaves a partial set with no
-- down path.
--
-- So this is what `push` WOULD do, extracted with `pg_dump --schema-only`
-- from a throwaway Postgres 16.4 instance that the schema was actually
-- applied to, then read. It is not hand-written and it is not a guess.
--
-- HOW TO USE IT. Someone with dashboard access confirms the target database
-- first — that is still an open pre-production gate — and then runs this
-- inside a single transaction, rather than running `push` against production:
--
--     BEGIN;
--     \i docs/sql/trainer-schema.sql
--     COMMIT;
--
-- Every statement is additive. No existing table is altered and no data is
-- touched, so a failure inside the transaction rolls back to exactly the
-- state before it.
--
-- ROLLBACK IS ASYMMETRIC, AND NO RUNBOOK SAID SO.
--
--   APPLICATION ROLLBACK IS SAFE. Redeploy the previous build; these tables
--   simply go unused. This is the normal rollback mechanism and the only one
--   that should appear in a runbook as routine.
--
--   SCHEMA ROLLBACK BY DROPPING THESE TABLES IS DATA DESTRUCTION. It is NOT
--   the normal rollback mechanism. Unlike the graph-table precedent, these
--   tables have live writers — including the access log itself — so a DROP
--   destroys medical records AND the evidence of who read them. If the schema
--   itself must be reverted, restore from backup; do not DROP.
--
-- Verified by execution, not assumed: applied to a scratch Postgres 16.4
-- inside `psql --single-transaction -v ON_ERROR_STOP=1`, it commits and
-- creates exactly 14 tables. With a failing statement appended, the abort
-- leaves ZERO tables behind — which is the property `drizzle-kit push` does
-- not have across fourteen tables, and the reason this file exists.
--
-- WHAT IS DELIBERATELY ABSENT:
--
--   * FOREIGN KEYS. Zero, repo-wide convention: referential integrity lives
--     in the application. The consequence is real and worth stating — a
--     sign-off can be written against a progression in another program, and
--     nothing at this layer would refuse it. Adding them is a separate
--     decision with its own migration, not a change to smuggle in here.
--
--   * CHECK CONSTRAINTS. Zero. Every invariant — RPE 1..10, questionnaire
--     answers 1..5, the status and role vocabularies, "an amendment must
--     state a reason" — is enforced in TypeScript only. Same decision.
--
-- WHAT IS DELIBERATELY PRESENT, and is new in this branch:
--
--   * CHECK CONSTRAINTS, added in the consistency pass. The availability and
--     role vocabularies, the RPE and duration ranges, "an amendment must
--     state a reason", and a non-negative stage index. Each of these lived in
--     one `if` at one route, which protects a REQUEST and not the TABLE — a
--     seed, an import or a backfill never passes through the route at all.
--     Every one is proven to refuse its bad row in
--     trainerConstraints.drizzle.test.ts, written with raw SQL around the
--     application so the constraint itself is what is under test.
--
--   * aforce_athlete_soap_notes_chain_idx is UNIQUE on (root_id, version).
--     Without it, two concurrent amendments both chose version N+1 and both
--     inserted; `currentNotes` kept one and the other clinician's amendment
--     vanished from the current view while surviving in the chart export.
--     Reproduced against real Postgres in trainerRepo.drizzle.test.ts:
--     versions came back [1, 2, 2, 3, 3] instead of [1, 2, 3, 4, 5].
--
-- Generated from PostgreSQL 16.4. Regenerate with the pg_dump invocation in
-- docs/sql/README.md after any schema change to these tables.


CREATE TABLE public.aforce_athlete_availability (
    id bigint NOT NULL,
    program_id text NOT NULL,
    athlete_user_id text NOT NULL,
    status text NOT NULL,
    reason text,
    set_by_user_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT aforce_athlete_availability_status_enum CHECK ((status = ANY (ARRAY['available'::text, 'limited'::text, 'out'::text])))
);

CREATE SEQUENCE public.aforce_athlete_availability_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.aforce_athlete_availability_id_seq OWNED BY public.aforce_athlete_availability.id;

CREATE TABLE public.aforce_athlete_consent_events (
    id bigint NOT NULL,
    program_id text NOT NULL,
    athlete_user_id text NOT NULL,
    action text NOT NULL,
    decision_seq integer NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.aforce_athlete_consent_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.aforce_athlete_consent_events_id_seq OWNED BY public.aforce_athlete_consent_events.id;

CREATE TABLE public.aforce_athlete_consents (
    id bigint NOT NULL,
    program_id text NOT NULL,
    athlete_user_id text NOT NULL,
    granted boolean NOT NULL,
    decision_seq integer NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.aforce_athlete_consents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.aforce_athlete_consents_id_seq OWNED BY public.aforce_athlete_consents.id;

CREATE TABLE public.aforce_athlete_medical_notes (
    id bigint NOT NULL,
    program_id text NOT NULL,
    subject_user_id text NOT NULL,
    author_user_id text NOT NULL,
    body text NOT NULL,
    supersedes_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.aforce_athlete_medical_notes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.aforce_athlete_medical_notes_id_seq OWNED BY public.aforce_athlete_medical_notes.id;

CREATE TABLE public.aforce_athlete_questionnaires (
    id bigint NOT NULL,
    program_id text NOT NULL,
    athlete_user_id text NOT NULL,
    form_version integer DEFAULT 1 NOT NULL,
    answers jsonb NOT NULL,
    for_date text NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.aforce_athlete_questionnaires_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.aforce_athlete_questionnaires_id_seq OWNED BY public.aforce_athlete_questionnaires.id;

CREATE TABLE public.aforce_athlete_screenings (
    id bigint NOT NULL,
    program_id text NOT NULL,
    athlete_user_id text NOT NULL,
    items jsonb NOT NULL,
    notes text,
    cleared boolean NOT NULL,
    screened_by_user_id text NOT NULL,
    screened_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.aforce_athlete_screenings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.aforce_athlete_screenings_id_seq OWNED BY public.aforce_athlete_screenings.id;

CREATE TABLE public.aforce_athlete_sessions (
    id bigint NOT NULL,
    program_id text NOT NULL,
    athlete_user_id text NOT NULL,
    session_date text NOT NULL,
    rpe integer NOT NULL,
    duration_min integer NOT NULL,
    session_type text,
    entered_by_user_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT aforce_athlete_sessions_duration_range CHECK (((duration_min >= 1) AND (duration_min <= 600))),
    CONSTRAINT aforce_athlete_sessions_rpe_range CHECK (((rpe >= 1) AND (rpe <= 10)))
);

CREATE SEQUENCE public.aforce_athlete_sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.aforce_athlete_sessions_id_seq OWNED BY public.aforce_athlete_sessions.id;

CREATE TABLE public.aforce_athlete_soap_notes (
    id bigint NOT NULL,
    program_id text NOT NULL,
    subject_user_id text NOT NULL,
    author_user_id text NOT NULL,
    root_id bigint,
    version integer DEFAULT 1 NOT NULL,
    supersedes_id bigint,
    amendment_reason text,
    subjective text,
    objective text,
    assessment text,
    plan text,
    subjective_enc bytea,
    objective_enc bytea,
    assessment_enc bytea,
    plan_enc bytea,
    template_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT aforce_athlete_soap_notes_amendment_has_reason CHECK (((version = 1) OR ((amendment_reason IS NOT NULL) AND (length(btrim(amendment_reason)) > 0)))),
    CONSTRAINT aforce_athlete_soap_notes_version_positive CHECK ((version >= 1))
);

CREATE SEQUENCE public.aforce_athlete_soap_notes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.aforce_athlete_soap_notes_id_seq OWNED BY public.aforce_athlete_soap_notes.id;

CREATE TABLE public.aforce_medical_access_log (
    id bigint NOT NULL,
    actor_user_id text NOT NULL,
    subject_user_id text NOT NULL,
    program_id text NOT NULL,
    actor_role text NOT NULL,
    resource text NOT NULL,
    action text NOT NULL,
    fields jsonb NOT NULL,
    redaction_level text NOT NULL,
    consent_decision_seq integer,
    request_id text,
    route text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.aforce_medical_access_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.aforce_medical_access_log_id_seq OWNED BY public.aforce_medical_access_log.id;

CREATE TABLE public.aforce_program_members (
    id bigint NOT NULL,
    program_id text NOT NULL,
    user_id text NOT NULL,
    role text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT aforce_program_members_role_enum CHECK ((role = ANY (ARRAY['athletic_trainer'::text, 'team_physician'::text, 'strength'::text, 'coach'::text, 'program_admin'::text, 'athlete'::text]))),
    CONSTRAINT aforce_program_members_status_enum CHECK ((status = ANY (ARRAY['active'::text, 'removed'::text])))
);

CREATE SEQUENCE public.aforce_program_members_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.aforce_program_members_id_seq OWNED BY public.aforce_program_members.id;

CREATE TABLE public.aforce_programs (
    id text NOT NULL,
    name text NOT NULL,
    sport text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.aforce_rtp_progressions (
    id text NOT NULL,
    program_id text NOT NULL,
    athlete_user_id text NOT NULL,
    protocol_id text NOT NULL,
    stages_snapshot jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    started_by_user_id text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    stopped_reason text,
    stopped_at timestamp with time zone
);

CREATE TABLE public.aforce_rtp_protocols (
    id text NOT NULL,
    program_id text NOT NULL,
    name text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    stages jsonb NOT NULL,
    created_by_user_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.aforce_rtp_signoffs (
    id bigint NOT NULL,
    progression_id text NOT NULL,
    program_id text NOT NULL,
    stage_index integer NOT NULL,
    stage_key text NOT NULL,
    signed_by_user_id text NOT NULL,
    note text,
    signed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT aforce_rtp_signoffs_stage_index_non_negative CHECK ((stage_index >= 0))
);

CREATE SEQUENCE public.aforce_rtp_signoffs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.aforce_rtp_signoffs_id_seq OWNED BY public.aforce_rtp_signoffs.id;

ALTER TABLE ONLY public.aforce_athlete_availability ALTER COLUMN id SET DEFAULT nextval('public.aforce_athlete_availability_id_seq'::regclass);

ALTER TABLE ONLY public.aforce_athlete_consent_events ALTER COLUMN id SET DEFAULT nextval('public.aforce_athlete_consent_events_id_seq'::regclass);

ALTER TABLE ONLY public.aforce_athlete_consents ALTER COLUMN id SET DEFAULT nextval('public.aforce_athlete_consents_id_seq'::regclass);

ALTER TABLE ONLY public.aforce_athlete_medical_notes ALTER COLUMN id SET DEFAULT nextval('public.aforce_athlete_medical_notes_id_seq'::regclass);

ALTER TABLE ONLY public.aforce_athlete_questionnaires ALTER COLUMN id SET DEFAULT nextval('public.aforce_athlete_questionnaires_id_seq'::regclass);

ALTER TABLE ONLY public.aforce_athlete_screenings ALTER COLUMN id SET DEFAULT nextval('public.aforce_athlete_screenings_id_seq'::regclass);

ALTER TABLE ONLY public.aforce_athlete_sessions ALTER COLUMN id SET DEFAULT nextval('public.aforce_athlete_sessions_id_seq'::regclass);

ALTER TABLE ONLY public.aforce_athlete_soap_notes ALTER COLUMN id SET DEFAULT nextval('public.aforce_athlete_soap_notes_id_seq'::regclass);

ALTER TABLE ONLY public.aforce_medical_access_log ALTER COLUMN id SET DEFAULT nextval('public.aforce_medical_access_log_id_seq'::regclass);

ALTER TABLE ONLY public.aforce_program_members ALTER COLUMN id SET DEFAULT nextval('public.aforce_program_members_id_seq'::regclass);

ALTER TABLE ONLY public.aforce_rtp_signoffs ALTER COLUMN id SET DEFAULT nextval('public.aforce_rtp_signoffs_id_seq'::regclass);

ALTER TABLE ONLY public.aforce_athlete_availability
    ADD CONSTRAINT aforce_athlete_availability_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.aforce_athlete_consent_events
    ADD CONSTRAINT aforce_athlete_consent_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.aforce_athlete_consents
    ADD CONSTRAINT aforce_athlete_consents_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.aforce_athlete_medical_notes
    ADD CONSTRAINT aforce_athlete_medical_notes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.aforce_athlete_questionnaires
    ADD CONSTRAINT aforce_athlete_questionnaires_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.aforce_athlete_screenings
    ADD CONSTRAINT aforce_athlete_screenings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.aforce_athlete_sessions
    ADD CONSTRAINT aforce_athlete_sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.aforce_athlete_soap_notes
    ADD CONSTRAINT aforce_athlete_soap_notes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.aforce_medical_access_log
    ADD CONSTRAINT aforce_medical_access_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.aforce_program_members
    ADD CONSTRAINT aforce_program_members_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.aforce_programs
    ADD CONSTRAINT aforce_programs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.aforce_rtp_progressions
    ADD CONSTRAINT aforce_rtp_progressions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.aforce_rtp_protocols
    ADD CONSTRAINT aforce_rtp_protocols_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.aforce_rtp_signoffs
    ADD CONSTRAINT aforce_rtp_signoffs_pkey PRIMARY KEY (id);

CREATE INDEX aforce_athlete_availability_current_idx ON public.aforce_athlete_availability USING btree (program_id, athlete_user_id, created_at);

CREATE INDEX aforce_athlete_consent_events_athlete_idx ON public.aforce_athlete_consent_events USING btree (athlete_user_id, recorded_at);

CREATE UNIQUE INDEX aforce_athlete_consents_program_athlete_uq ON public.aforce_athlete_consents USING btree (program_id, athlete_user_id);

CREATE INDEX aforce_athlete_medical_notes_subject_idx ON public.aforce_athlete_medical_notes USING btree (program_id, subject_user_id, created_at);

CREATE INDEX aforce_athlete_questionnaires_lookup_idx ON public.aforce_athlete_questionnaires USING btree (program_id, athlete_user_id, for_date);

CREATE INDEX aforce_athlete_screenings_lookup_idx ON public.aforce_athlete_screenings USING btree (program_id, athlete_user_id, screened_at);

CREATE INDEX aforce_athlete_sessions_lookup_idx ON public.aforce_athlete_sessions USING btree (program_id, athlete_user_id, session_date);

CREATE UNIQUE INDEX aforce_athlete_soap_notes_chain_idx ON public.aforce_athlete_soap_notes USING btree (root_id, version);

CREATE INDEX aforce_athlete_soap_notes_subject_idx ON public.aforce_athlete_soap_notes USING btree (program_id, subject_user_id, created_at);

CREATE INDEX aforce_medical_access_log_actor_idx ON public.aforce_medical_access_log USING btree (actor_user_id, occurred_at);

CREATE INDEX aforce_medical_access_log_subject_idx ON public.aforce_medical_access_log USING btree (subject_user_id, occurred_at);

CREATE INDEX aforce_program_members_program_role_idx ON public.aforce_program_members USING btree (program_id, role, status);

CREATE UNIQUE INDEX aforce_program_members_program_user_uq ON public.aforce_program_members USING btree (program_id, user_id);

CREATE INDEX aforce_program_members_user_idx ON public.aforce_program_members USING btree (user_id, status);

CREATE INDEX aforce_rtp_progressions_athlete_idx ON public.aforce_rtp_progressions USING btree (program_id, athlete_user_id, started_at);

CREATE INDEX aforce_rtp_protocols_program_idx ON public.aforce_rtp_protocols USING btree (program_id, created_at);

CREATE INDEX aforce_rtp_signoffs_progression_idx ON public.aforce_rtp_signoffs USING btree (progression_id, signed_at);

CREATE UNIQUE INDEX aforce_rtp_signoffs_stage_uq ON public.aforce_rtp_signoffs USING btree (progression_id, stage_index);
