# DR-016 — Legacy analytics-consent quarantine

**Status:** approved by founder — 2026-09-23  
**Scope:** per-user storage isolation / the legacy GLOBAL `@aforce/analytics-consent` record
(`artifacts/aforce-os/services/userScope.ts` migration manifest and its consumers)

## Decision

Founder ruling A1, verbatim:

> A1 — Consent quarantine: approve the narrow policy, with a privacy review checkpoint.
>
> I ratify quarantine rather than first-user assignment for the legacy analytics-consent key:
> retain the original global record, do not copy or attribute it to a member, and do not treat
> it as that member's consent.
>
> Update the test, stale comments, dead export, and readiness register consistently. Preserve
> server-side consent authority and existing member-scoped records. No production
> isolation-flag change, destructive migration, or member-record operation is authorized.

Operationally, when a member's scope is first resolved on a device that still holds the
pre-isolation global `@aforce/analytics-consent` record:

- the record stays where it is, byte for byte — it is never deleted, rewritten or moved;
- nothing is written under the member's namespace (`@aforce/analytics-consent:<userId>`) for it;
- the device is marked `aforce.namespaceMigration.quarantined` = `1`, a marker that carries no
  member identity;
- the record is never consulted as that member's consent, and never as evidence that the member
  has already answered the consent prompt.

This decision covers the legacy global `@aforce/analytics-consent` record only. It does not
ratify the handling of any other key in the migration manifest (see History).

## Supersedes

- The Wave-3 PR12 **copy-and-retain** rule for the consent key — commit `71c46b5c`
  (2026-08-12, "feat(aforce-os): analytics identity + consent isolation (Wave-3 PR12, approved
  W2-N4 subset)", merged in #747) — under which the legacy global consent record was copied into
  the first claiming member's namespace and the original retained as legal evidence.
- The `RETAIN_GLOBAL_COPY` export in `artifacts/aforce-os/services/userScope.ts` that carried
  that rule. It had no code consumers on `main` (verified by `git grep`) and is retired by this
  decision.
- The test pin `legacy migration preserves consent evidence › the global consent record is
  COPIED to the claiming user and RETAINED globally` in
  `artifacts/aforce-os/analytics/__tests__/analyticsIdentityIsolation.test.ts`, and the
  "copy-and-retain legal evidence" wording in row 12 of
  `governance/WAVE3-PRODUCTION-READINESS-EVIDENCE.md`.

## History

- **2026-08-12** — #747 / commit `71c46b5c` introduced copy-and-retain for the consent key
  (copy to the claiming member, keep the original).
- **2026-09-09** — #955 (S1-3 client half) moved the operative consent state and the pseudonym
  to the server. From then on `isConsentGranted()` never reads the local consent record;
  `hasAnsweredConsent()` prefers the server and falls back to the *member-scoped* local record
  for prompt suppression only.
- **2026-09-15** — #987 / commit `5fed0112` ("fix: quarantine unattributed legacy storage")
  replaced the migration with fail-closed quarantine for every key in the manifest: nothing
  copied, nothing deleted, marker written. It re-pinned
  `services/__tests__/userScopeIsolation.test.ts` ("legacy global data quarantine") but carried
  **no decision record**, and left the analytics suite's copy-and-retain pin, the `userScope.ts`
  comments, the dead export and the register row unchanged. #987 applies the same mechanics
  (retained in place, never copied) to the legacy global `@aforce/analytics-id` record and to
  every other key in `MIGRATED_GLOBAL_KEYS`. Those keys are **outside this decision**: DR-016
  ratifies the consent key only, and the `@aforce/analytics-id` expectations in the analytics
  suite pin observed #987 behaviour, not a rule this record makes. The general quarantine still
  has no decision record.
- **2026-09-23** — this record. **DR-016 is the first ratification of the consent-specific
  change.** The quarantine of the legacy consent record was not previously ratified: it was
  implemented in #987 without a decision and is approved here, on this date. This record is not
  backdated.

## Preserved

- **Server-side consent authority** (S1-3 / #955): `analytics/consentAuthority.ts` holds the
  server's adopted state with the local restrictive-only ceiling; `isConsentGranted()` is that
  state and nothing else. The legacy record cannot open collection.
- **Existing member-scoped records** (`@aforce/analytics-consent:<userId>`,
  `@aforce/analytics-id:<userId>`): untouched by migration, and a member's own scoped consent
  record continues to suppress the re-prompt for that member when the server is unreachable.
- **`per_user_storage_isolation_enabled`** stays as it is in `DEFAULT_FLAGS` (false). No
  production isolation-flag change is made or authorized by this record; none of the quarantine
  path is reachable in production until a separate founder flip.
- **No destructive migration**: no legacy key is deleted, rewritten or moved.
- **No member-record operation**: no on-device or server-side member record is created,
  re-attributed or deleted.

## Privacy review checkpoint — before merge

Founder text, verbatim:

> Before merge, obtain a documented privacy acknowledgement and evidence covering account
> switching, existing scoped records, legacy-record retention, and offline prompting. Do not
> assume that the only effect is one re-prompt without testing the relevant paths.

### Evidence

All in `artifacts/aforce-os/analytics/__tests__/analyticsIdentityIsolation.test.ts`, driven
through the real `userScope`, `scopedStorage`, `privacy_manager` and `consentAuthority` modules
over in-memory storage, with the S1-3 endpoints modelled as reachable or as a transport failure
(`status: 0`, the shape `lib/api.requestEither` reports).

| Required evidence | Test (describe `DR-016 — legacy consent quarantine evidence`) |
|---|---|
| legacy-record retention | `(a) legacy-record retention — the global record outlives A and a later B, claimed by neither`; also the re-pinned describe `legacy migration quarantines the consent record (DR-016)` |
| not treated as the member's consent | `(b) not treated as the member’s consent — a GRANTED legacy record opens nothing for A, offline or online` |
| offline prompting | `(c) offline prompting — with ONLY the legacy record, A is asked: the legacy answer is not attributed to A` · `(c) offline prompting — A’s OWN scoped record suppresses the re-prompt offline` · `(c) offline prompting — online, the server’s decision wins over every local record` |
| existing scoped records | `(d) existing scoped records preserved — A’s own records survive migration byte for byte beside the untouched legacy record` |
| account switching | `(e) account switching — B inherits neither the legacy record nor A’s; A’s record is intact on return` |

What the evidence establishes beyond "one re-prompt":

- a member whose only consent-shaped record on the device is the legacy global one is asked
  again, offline and online, and is never collected on the strength of that record;
- a member with their own scoped record is not re-prompted offline, and that record is not
  altered by migration, by another member's session, or by the server's decision;
- a second member on the device inherits nothing from the legacy record or from the first
  member, and no key is written for them;
- across a full A → sign-out → B → sign-out → A sequence the device gains exactly one key, the
  quarantine marker.

Limits of this evidence: these are unit-level proofs over in-memory storage. They do not
exercise a physical handset carrying real pre-isolation data, and none of this path is
reachable in production while `per_user_storage_isolation_enabled` is false.

### Acknowledgement — PENDING

No acknowledgement has been recorded. This section is to be completed by the privacy reviewer
before merge; the fields below are intentionally empty.

| Field | Value |
|---|---|
| Reviewer (name) | |
| Role | |
| Date | |
| Evidence reviewed (test run / commit) | |
| Acknowledgement | |

## Verification

- Test file: `artifacts/aforce-os/analytics/__tests__/analyticsIdentityIsolation.test.ts` —
  describe `legacy migration quarantines the consent record (DR-016)` and describe
  `DR-016 — legacy consent quarantine evidence`. The `@aforce/analytics-id` expectations in
  those describes are #987 behaviour pins, outside this decision.
- Companion pin from #987: `artifacts/aforce-os/services/__tests__/userScopeIsolation.test.ts`
  › `legacy global data quarantine`.
- Register: `governance/WAVE3-PRODUCTION-READINESS-EVIDENCE.md` row 12 (Evidence cell).
- `artifacts/aforce-os/services/userScope.ts`: comments and the removed `RETAIN_GLOBAL_COPY`
  export only; zero runtime behaviour change.
