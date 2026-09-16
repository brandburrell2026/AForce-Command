# Runbook — Trainer Dashboard

For whoever is on call at 6am when a training room is waiting.

This surface carries medical records. Most of what follows is about turning
things **off** safely and proving what was read; none of it is about restoring
service quickly at the cost of the audit trail.

**Status: not launched.** `feature.trainer_api` is off and no program rows
exist. Every "if this is happening" below assumes it has been turned on.

---

## 1. Turn it off

The surface is behind one flag. With it off every route answers 404 —
identical to what a non-member sees, so turning it off discloses nothing.

```bash
# Add to the deploy environment, then restart. Seconds, not a deploy.
AFORCE_FLAGS="feature.trainer_api=false"
```

One variable holds every override, comma-separated:

```bash
AFORCE_FLAGS="feature.trainer_api=false,kill.ai_router=true"
```

Only the literal strings `true` and `false` count. An unknown flag, a missing
`=`, or a value like `1` or `yes` is **ignored and the default stands** — one
bad entry does not discard the rest, and nothing malformed can turn a flag on.

**Confirm it took effect** rather than assuming:

```
GET /api/admin/metrics     (founder only)
→ flags.values["feature.trainer_api"]   false
→ flags.sources["feature.trainer_api"]  "env"
```

`sources` is the part that matters. `"env"` means someone set it. `"default"`
means nobody did and it merely happens to match — the difference between "we
turned it off" and "we never turned it on".

**Precedence:** a live `setFlag` override beats `AFORCE_FLAGS`, which beats the
compiled default. Nothing calls `setFlag` in production today; when a remote
config service is wired up, it will win over the environment.

---

## 2. What the counters mean

All at `GET /api/admin/metrics`, founder-only. Process-lifetime, reset on
deploy. Names are in `TRAINER_COUNTERS` so the code and this page cannot drift.

| Counter | Meaning |
|---|---|
| `trainer.audit_rows_written` | An access-log row was durably written |
| `trainer.consent_denied` | A read refused because consent was not granted |
| `trainer.inference_guard_tripped` | Phase 8 refused to send a report |
| `trainer.note_encryption_unavailable` | A note write refused for want of a usable key |
| `trainer.access_lookup_failed` | A membership or consent lookup failed and the surface failed closed |
| `trainer.rate_limited` | A 429 |
| `trainer.server_errors` | A 5xx |
| `requests_total.trainer.<status>` | Outcomes by status |
| `latency_ms.trainer<route pattern>` | Latency per route **pattern** |
| `db_pool.waiting` | Requests queued for one of the ten connections |

Metric names never contain an athlete or program id — they key on the route
pattern. That is enforced by test, not convention.

---

## 3. Alerts, and what to do

### Clinical reads continue while `trainer.audit_rows_written` stops

**The most serious alert on this surface.** Reads are being served and no
record is being kept of who read what. A silent audit failure is
indistinguishable from a quiet morning unless something counts both.

1. **Turn the surface off** (§1). Do not wait to find the cause.
2. Check `trainer.server_errors` and the logs for insert failures.
3. Establish the gap: the last `occurred_at` in `aforce_medical_access_log`
   against the first affected request in the API logs.
4. That window is a period of unlogged access to medical records. Treat it as
   a reportable event until counsel says otherwise.

Do not "fix it forward" by restoring reads before logging works.

### `trainer.inference_guard_tripped` is non-zero

The Phase 8 guard refused to send an availability report because it found
clinical vocabulary in something a coach would receive.

**The instinct to make the report work again is the wrong one.** The guard
fired because content that should not reach a coach was about to. Find what
changed — a new field on the report, a free-text value flowing somewhere it
should not, a stage label carrying a diagnosis. Fix the leak, not the guard.

The log line records the count of terms matched, deliberately **not** the
terms themselves: moving the clinical signal into a log stream with different
retention is the thing the guard exists to prevent.

### `trainer.note_encryption_unavailable` is non-zero

Note writes are being refused in production because
`MEDICAL_NOTE_ENCRYPTION_KEY` is missing or is not a usable 32-byte key
(base64 or hex). **This refusal is correct** — the alternative is plaintext
medical notes.

Restore the key from the secret store. Do not work around it by unsetting
`NODE_ENV=production` or by writing plaintext.

> **Losing this key loses the notes.** They are AES-256-GCM and there is no
> recovery path. It needs the same backup and rotation discipline as the
> database itself.

### `trainer.consent_denied` rising sharply

Usually benign — athletes revoking is the system working. Investigate if it
spikes without a corresponding product event: it can also mean consent rows
failed to seed for a cohort, in which case staff are locked out of records
they should see.

### `db_pool.waiting` sustained above zero

The pool has ten connections and is shared with checkout, intake and the
health checks. A sustained queue means something is holding connections.

The board was this, before Step 4: 1,902 statements for one 500-athlete load.
It is now six regardless of roster size, and
`trainerRosterQueryCount.drizzle.test.ts` fails if that regresses. If this
alert fires, look for a **new** per-row query.

Every statement is capped at `PG_STATEMENT_TIMEOUT_MS` (15s default), so a
single stuck query can no longer hold a connection indefinitely.

---

## 4. Rate limits

Per user, per minute. A 429 body names the tier.

| Tier | Limit | Covers |
|---|---:|---|
| `trainer_read` | 120 | board, record, notes, sessions, progression |
| `trainer_write` | 60 | availability, screening, notes, amendments, sessions, sign-offs |
| `trainer_export` | 10 | chart PDF, availability report (JSON and PDF) |

The tier is chosen from the request, not declared per route, so a new `.pdf`
endpoint lands in the export tier automatically.

Keyed per user: one trainer hitting a limit cannot lock out the room.

---

## 5. Rollback

**Application rollback is safe.** Redeploy the previous build. The tables go
unused. This is the normal mechanism.

**Schema rollback by dropping these tables is data destruction**, not a
rollback. These tables have live writers including the access log, so a `DROP`
destroys the medical records *and* the evidence of who read them. If the
schema must be reverted, restore from backup. See
`docs/sql/trainer-schema.sql`.

---

## 6. Answering "who looked at my record?"

An athlete's subject-access request. `aforce_medical_access_log` is indexed
for exactly this.

```sql
SELECT occurred_at, actor_user_id, actor_role, resource, action,
       fields, redaction_level, consent_decision_seq
  FROM aforce_medical_access_log
 WHERE subject_user_id = $1
 ORDER BY occurred_at DESC;
```

`fields` is **key names only**, never values — asserted by test. Every route
that discloses or writes files a row, including amendments, report exports and
coach return-to-play reads; `trainerAuditCoverage.test.ts` fails if a route is
added without deciding.

`consent_decision_seq` is what makes "this was read while consent stood"
provable after the fact. Cross-reference `aforce_athlete_consent_events`.

Two operations deliberately file no row here, and are recorded elsewhere:
consent decisions (`aforce_athlete_consent_events`, its own append-only
evidence with a server-issued sequence) and protocol creation (a program-level
template with no subject).

---

## 7. Before launch

Open items. None are code.

- [ ] **Target database confirmed** against a deploy variable by someone with
      dashboard access. No schema has been applied anywhere.
- [ ] **`MEDICAL_NOTE_ENCRYPTION_KEY` provisioned** in a managed secret store,
      with backup and rotation. Losing it loses the notes.
- [ ] **Privacy regime determined by counsel** — retention, breach workflow,
      whether a BAA is required. No HIPAA-covered arrangement without a signed
      agreement.
- [ ] **Device performance measured** on a supported device and a shaped
      network. The 400ms render and 2s-on-3G targets are **unverified**; the
      server-side budget is measured in `docs/benchmarks/trainer-board.md`.
- [ ] **Backups cover the new tables**, and a restore has been rehearsed for
      the append-only evidence.
- [ ] **Alert routing** for §3 wired to whoever is on call.

---

## 8. Known gaps

Real, and not fixed by anything above.

- **Note writes are not idempotent.** A 500 after a durable write, retried by
  the client outbox, files a second note. Needs an idempotency-key column.
- **Commit-then-audit ordering** on write paths: the write commits, then the
  audit row is written. An audit failure returns 500 on an already-durable
  write.
- **The client outbox does not persist.** It lives in screen state, so a
  reload loses queued entries, and there is no flush loop yet.
- **No foreign keys and no CHECK constraints** on any of the 14 tables —
  repo-wide convention. A sign-off can be written against a progression in
  another program and nothing at the database layer refuses it.
- **The availability report is unpaginated.** 185.7 KB at 500 athletes.
