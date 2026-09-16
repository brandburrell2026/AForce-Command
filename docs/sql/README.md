# docs/sql

Reviewed DDL for schema changes that are too large to take on trust from
`drizzle-kit push`.

**Nothing in this directory has been applied to any database.** These files
exist so that a human can read the statements before they run, which `push`
does not allow.

## When a change belongs here

`lib/db` has no migration files by convention: `drizzle-kit push` diffs the
schema against a live database and applies the difference. That is a
reasonable trade for one additive column on a table nobody writes to yet.

It is a poor trade when the change is large, or when the tables carry records
that cannot be recreated. Write the DDL here first when any of these hold:

- more than a handful of tables land at once — `push` is not transactional
  across them, so a mid-run failure leaves a partial set with no down path
- the tables carry medical, financial or audit data
- the change is anything other than additive

## Regenerating

The DDL is extracted from a database the schema was really applied to, not
written by hand. Against a throwaway instance:

```bash
# 1. apply the current schema to a scratch database
DATABASE_URL=postgres://postgres@127.0.0.1:5432/scratch \
  pnpm --filter @workspace/db push-force

# 2. extract the tables you care about
pg_dump -d scratch --schema-only --no-owner --no-privileges --no-comments \
  -t aforce_programs -t aforce_program_members \
  -t aforce_athlete_consents -t aforce_athlete_consent_events \
  -t aforce_medical_access_log -t aforce_athlete_availability \
  -t aforce_athlete_medical_notes -t aforce_athlete_questionnaires \
  -t aforce_athlete_screenings -t aforce_athlete_soap_notes \
  -t aforce_athlete_sessions -t aforce_rtp_protocols \
  -t aforce_rtp_progressions -t aforce_rtp_signoffs
```

Then re-read it. The point of the file is the reading, not the file.

## Files

| File | Covers | Applied? |
|---|---|---|
| `trainer-schema.sql` | The 14 trainer-surface tables | **No.** Blocked on confirming the target database. |
