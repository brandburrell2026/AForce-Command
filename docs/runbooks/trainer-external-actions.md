# Trainer Dashboard — external actions

Four things stand between the merged code and a live surface. **None of them
are code, and none of them were performed.** Each section is the exact action
required, written so the person doing it does not have to reconstruct the
reasoning.

Nothing here has been executed. No schema applied, no secret provisioned, no
legal determination made, no device measured.

---

## 1. Database — apply the schema

**Status: READY FOR EXTERNAL ACTION.** Blocked on confirming the target.

### 1.1 Preflight — all six must pass before anything is applied

| # | Check | Command | Required answer |
|---|---|---|---|
| 1 | You are on the intended database | `SELECT current_database(), inet_server_addr(), version();` | Matches the deploy environment's `DATABASE_URL` host and database, **verified against the deploy variable, not a dashboard panel** |
| 2 | None of the 14 tables already exist | `SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'aforce_athlete_%' OR table_name LIKE 'aforce_rtp_%' OR table_name IN ('aforce_programs','aforce_program_members','aforce_medical_access_log');` | `0` |
| 3 | A backup exists and is younger than the change window | provider snapshot listing | A restorable snapshot taken within the last hour |
| 4 | The restore path has been rehearsed at least once | — | Yes, with a date |
| 5 | The connecting role may create tables | `SELECT has_schema_privilege(current_user,'public','CREATE');` | `t` |
| 6 | The feature flag is OFF | `GET /api/admin/metrics` → `flags.values["feature.trainer_api"]` | `false` |

> **Check 2 is not a formality.** If any table exists, something has already
> been applied and this file is not the right instrument — stop and
> reconcile, do not proceed.

### 1.2 Backup requirement

A **restorable snapshot taken immediately before the apply**, not the nightly.
The apply is additive and the transaction protects it, but the requirement
here is not about this change: it is that from the moment the flag is turned
on, these tables hold records that cannot be recreated from anywhere else.

### 1.3 The command

```bash
# Nothing is applied with drizzle-kit push. Push is not transactional across
# 14 tables: a mid-run failure leaves a partial set with no down path.
psql "$DATABASE_URL" \
  --single-transaction \
  -v ON_ERROR_STOP=1 \
  -f docs/sql/trainer-schema.sql
```

**Transaction boundaries:** the entire file is one transaction.
`--single-transaction` wraps it; `ON_ERROR_STOP=1` makes the first error abort
rather than continuing to the next statement. Postgres executes DDL
transactionally, so an abort leaves **zero** of the 14 tables behind.

Verified by execution, not assumed: applying the file with a failing statement
appended leaves `0` tables.

### 1.4 Abort conditions — stop and do not retry

- Any preflight check fails
- `psql` reports an error of any kind (the transaction has already rolled back)
- The connection drops mid-apply — **verify with the post-apply checks before
  re-running**, because a committed apply that lost its client looks identical
  to a failed one
- Table count after apply is anything other than 14

### 1.5 Post-apply verification

```sql
-- 1. Fourteen tables.
SELECT count(*) FROM information_schema.tables
 WHERE table_schema = 'public'
   AND (table_name LIKE 'aforce_athlete_%' OR table_name LIKE 'aforce_rtp_%'
        OR table_name IN ('aforce_programs','aforce_program_members',
                          'aforce_medical_access_log'));
-- expect 14

-- 2. Eight CHECK constraints.
SELECT count(*) FROM pg_constraint
 WHERE contype = 'c' AND conname LIKE 'aforce_%'
   AND (conname LIKE '%athlete%' OR conname LIKE '%program_members%'
        OR conname LIKE '%rtp%');
-- expect 8

-- 3. The two indexes that enforce correctness, not just speed.
SELECT indexname FROM pg_indexes
 WHERE indexname IN ('aforce_athlete_soap_notes_chain_idx',
                     'aforce_athlete_soap_notes_idempotency_uq');
-- expect both, and both UNIQUE

-- 4. Nothing else changed.
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
-- expect the pre-apply count + 14
```

Then, with the flag still **off**, confirm the API is unchanged: every trainer
route must still answer 404.

### 1.6 Rollback / restore

**Application rollback is safe** and is the normal mechanism. Redeploy the
previous build; the tables go unused.

**Schema rollback by dropping these tables is data destruction, not a
rollback.** These tables have live writers including the access log, so a
`DROP` destroys the medical records *and* the evidence of who read them.

| Situation | Action |
|---|---|
| Apply aborted | Nothing to undo. The transaction rolled back. |
| Applied, flag never turned on, want it gone | `DROP` is safe **only** while every table is empty. Verify with a row count across all 14 first. |
| Applied, flag turned on, any row written | **Do not DROP.** Turn the flag off and restore from backup if the schema itself must go. |

---

## 2. Encryption key — provision the secret

**Status: READY FOR EXTERNAL ACTION.** Not provisioned. Not generated here.

| Property | Value |
|---|---|
| Environment variable | `MEDICAL_NOTE_ENCRYPTION_KEY` |
| Format | 32 raw bytes, encoded **base64** (44 chars) or **hex** (64 chars) |
| Entropy | A full 256 bits from a CSPRNG. A passphrase is **rejected** — not weakened, rejected |
| Algorithm it feeds | AES-256-GCM, application-side (`lib/db/src/noteCrypto.ts`) |
| Storage | Managed secret store, injected as an environment variable |

Generate it wherever your secret store generates secrets — `openssl rand -base64 32`
is the shape. **Do not generate it in a shell that keeps history, do not paste
it into a ticket, and do not put it in the repository.**

### 2.1 Why a passphrase is rejected

The previous gate accepted any string of 32+ characters and never used it as a
key. Anything that "sounds like a key" satisfying the check is precisely how
that happened. The value must decode to exactly 32 bytes or the application
refuses it.

### 2.2 Failure mode when the key is missing or unusable

In production, a note write is **refused with 503 `note_encryption_unavailable`**
and the counter `trainer.note_encryption_unavailable` increments.

**This refusal is correct.** The alternative is a plaintext medical note. Do
not work around it by unsetting `NODE_ENV=production` or by disabling the gate.

Reads of existing notes are unaffected only where those notes were written
without a key; anything written *with* a key cannot be read without it.

### 2.3 The application fails safely — confirmed

| Condition | Behaviour | Where proven |
|---|---|---|
| Variable unset | write refused, 503 | `noteCrypto.test.ts` |
| Passphrase / wrong length | write refused, 503 | `noteCrypto.test.ts` |
| Wrong key on read | throws; does **not** return plausible text | `noteCrypto.test.ts` |
| Tampered ciphertext | throws, same message as a wrong key — not an oracle | `noteCrypto.test.ts` |
| Key never logged | absent from the error, the reason string, and the serialized error | `noteCrypto.test.ts` |

### 2.4 Backup and recovery implications

> **Losing this key loses every note written with it. There is no recovery
> path. AES-256-GCM is not recoverable without the key, by design.**

The key therefore needs the same backup discipline as the database itself, and
they must be backed up **together** — a database restore paired with a lost key
restores unreadable ciphertext.

### 2.5 Rotation implications

Ciphertext is prefixed `v1:`, so a reader dispatches on the version rather than
guessing. Rotation is therefore *possible* but **not implemented**: there is no
re-encryption path today. Rotating the key without one makes every existing
note unreadable.

If rotation is a requirement before launch, say so — it is a small, separate
piece of work (a `v2:` writer plus a backfill), not a configuration change.

---

## 3. Privacy regime — counsel checklist

**Status: BLOCKED.** These are questions for counsel. **No legal conclusions
are drawn here, and none should be inferred from the engineering choices.**

The system was built to the strictest plausible interpretation and claims
nothing. Counsel's answers change configuration and documentation, not the data
model.

### 3.1 Classification

1. Does the data collected — trainer-authored SOAP notes, athlete-reported
   questionnaires, pre-practice screenings, availability with clinical reasons,
   return-to-play progressions — constitute protected health information in the
   jurisdictions where AForce will operate?
2. Does the relationship between AForce and a program make AForce a covered
   entity, a business associate, or neither?
3. Does the athlete population include minors, and does that change the answer?
4. Do any programs sit in jurisdictions with their own regimes (GDPR, state
   laws) that apply simultaneously?

### 3.2 Agreements

5. Is a Business Associate Agreement required before any pilot?
6. What must a program agree to, and who at a program can agree to it?
7. What must the ATHLETE agree to, separately from the program? The system
   implements athlete-level consent with append-only evidence and a
   server-issued decision sequence — counsel should confirm that mechanism is
   what the regime requires.

### 3.3 Retention and deletion

8. Minimum retention for clinical records, by jurisdiction?
9. Maximum retention, and does the athlete leaving the program start a clock?
10. Does a deletion request override clinical retention, and which wins?
11. The access log is append-only evidence of who read what. Is it subject to
    the same retention as the records, a longer one, or a shorter one?

### 3.4 Disclosure and breach

12. What is the breach-notification trigger and timeline?
13. Is the coach-facing availability report a disclosure requiring consent, a
    permitted operational use, or neither? It carries name, position and
    availability, and is engineered to carry nothing clinical.
14. What is the athlete's right of access, and what must a subject-access
    response contain? (The access log can answer "who looked at my record";
    counsel should confirm the required format and timeline.)

### 3.5 Operational

15. Who is the privacy contact of record?
16. What audit evidence must be retained to demonstrate compliance, and for how
    long?
17. Is any third-party processor involved that requires its own agreement?

---

## 4. Device validation — the two unmeasured targets

**Status: BLOCKED** on infrastructure that does not exist in this repository.

> **Neither target is claimed. Neither has been measured.** The server-side
> budget underneath them is measured and committed at
> `docs/benchmarks/trainer-board.md`; that is a different number and must not
> be quoted as if it were these.

### 4.1 What is already known

| Roster | SQL statements | DB time | API p50 | API p95 | Payload |
|---:|---:|---:|---:|---:|---:|
| 120 | 6 | 4.29 ms | 5.85 ms | 7.06 ms | 44.5 KB |
| 500 | 6 | 11.79 ms | 20.08 ms | 21.98 ms | 185.7 KB |

Measured on local Postgres, not production hardware. Statement counts are
hardware-independent; millisecond figures will re-scale.

### 4.2 Target 1 — board renders in under 400 ms (120 athletes)

**Definition to agree before measuring:** render time is from navigation
commit to the first frame in which the board's above-the-fold rows are
painted — not to the end of the virtualized list, and not including network.

| | |
|---|---|
| Devices | One mid-tier Android (Pixel 6a class) and one low-tier (Android Go class); one iPhone SE 3 |
| Build | Release, not debug. JS minified, Hermes enabled, dev menu off |
| State | Cold start and warm start, reported separately |
| Data | 120-athlete roster from the seed, including the §6.1 edge cases |
| Runs | 10 per device per state; report p50 and p95, not a mean |
| Instrumentation | `performance.now()` at navigation commit and in the board's first `onLayout`, plus a system trace (`systrace` / Instruments) to confirm the JS number matches the frame |
| Tooling | Maestro or Detox driving navigation; neither exists in this repo yet |
| Pass | p95 < 400 ms on the mid-tier device |

### 4.3 Target 2 — interactive in under 2 s on throttled 3G

**Definition to agree:** from app launch to the board accepting a tap that
changes availability — not to first paint.

| | |
|---|---|
| Network | Regular 3G — 1.6 Mbps down / 768 Kbps up / 300 ms RTT — shaped at the OS or proxy level, not in JS |
| Also measure | Offline cold start, which should be **faster** (cache-first) and is the sideline case that actually matters |
| Devices | As above |
| Runs | 10 cold starts per device per network condition |
| Instrumentation | Launch timestamp to the first successful availability tap handler |
| Pass | p95 < 2 s on the mid-tier device on shaped 3G |

### 4.4 What has to exist first

1. A device lane — Maestro or Detox — wired into CI or a manual harness
2. A release build with instrumentation that does not itself alter timing
3. A shaped-network setup, reproducible enough that two runs are comparable
4. A committed report, per device per condition, regenerable by one command

Until all four exist, the honest statement is: **unmeasured**.

---

## Nothing here was performed

| Action | Performed? |
|---|---|
| Schema applied to any database | **No.** Only a disposable local instance, now stopped |
| Secret provisioned | **No.** No key generated, requested or stored |
| Legal determination | **No.** Questions only |
| Device measured | **No.** No device lane exists |
| Production flag enabled | **No.** `feature.trainer_api` remains false |
