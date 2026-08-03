# Connected Health / Canonical-Consumer — Translation Review

**Branch:** `chore/health-locale-consolidation`
**Scope:** Wave-3 follow-up PR 3 — move remaining English-only Connected
Health and canonical-consumer strings into the locale system
(`artifacts/aforce-os/locales/*.json`, 11 locales: en, es, de, fr, it, pt,
ja, ko, zh, hi, ar).

## Decision summary

1. **Swept every file** in `services/health/*.ts` (top-level and
   `healthConnect/`) and `components/health/*.tsx`, excluding `__tests__/`
   and `*Fixtures.ts`. Result: the Connected Health surface
   (`connectedHealthView.ts` → `ConnectedHealthView.tsx`,
   `connectedHealthContainerModel.ts` → `ConnectedHealthContainer.tsx`) is
   **already fully localized** — every user-facing string is an `I18nText`
   (`{ key, params? }`) resolved exactly once, at the presentational
   component, via `useTranslation()`. `providerPresentation.ts`,
   `healthSignalsFromStore.ts`, `signalResolution.ts`, and
   `readinessSignals.ts` carry no user-facing strings at all — they are pure
   enum/numeric reshaping layers.
2. **One genuinely new hardcoded surface was found and fixed**: `sleepSignals.ts`
   (5 strings, now 7 after rebasing onto #492) — investigated but **not
   extracted this PR**; see "Pending extraction" below for the root cause.
3. **One scope addition landed mid-PR** (the #491 independent-review B2
   finding): `connected_health.offline_notice` was factually wrong on a
   cold-start probe failure (claimed "Offline" when no last-known state
   exists) and has been reworded across all 11 locale files. This is a
   **changed existing key**, not a new one — included in the table below
   per the coordinator's request.
4. **Zero new locale keys were added.** See "Why zero new keys" below —
   every string this PR was scoped to touch was either already correctly
   keyed, had no user-facing strings, or was found to be unsafe to extract
   without expanding scope into an unrelated, non-localized screen.

## Extraction pattern (already established — followed, not invented)

`services/health/connectedHealthView.ts` and
`services/health/connectedHealthContainerModel.ts` establish the pattern
this PR follows for the `connected_health.offline_notice` fix:

- A pure service/resolver (no React, no `t()` import) returns an `I18nText`
  reference — `{ key: string, params?: Record<string, string | number> }` —
  pointing at a `connected_health.*` locale key. It never resolves the
  string itself.
- Exactly one presentational component per surface
  (`ConnectedHealthView.tsx`) calls `useTranslation()` and resolves every
  `I18nText` via a small `tt(text) => t(text.key, text.params)` helper.
- Non-English locale files that have no real translation yet carry the
  **verbatim English string** (never a machine translation, never left
  hardcoded in `.ts`/`.tsx`) — this mirrors `services/i18nService.ts`'s
  documented "hidden languages are English placeholder copies" convention
  for ar/zh/ja/ko/hi, and is applied here to es/fr/de/pt/it as well because
  the entire `connected_health` namespace has no existing translations in
  any of the 10 non-English files yet (verified — see below).

No new fallback machinery was built; `i18n.init({ fallbackLng: 'en' })` in
`services/i18nService.ts` is unchanged and already covers a locale missing a
key entirely (not the situation here — all 11 files carry every
`connected_health` key, just with English values for the 10 non-English
ones).

## Changed key: `connected_health.offline_notice` (#491 review, finding B2)

**Before (all 11 locales, identical):**
`"Offline — showing the last known connection status."`

**After — English source (en.json):**
`"Couldn't check your connections just now — this list may be out of date."`

Root cause of the reword: a cold-start probe failure has no "last known"
connection status to show yet, so the old copy's factual claim ("showing the
last known...") was false in exactly the case it was meant to describe. The
new copy makes no claim about what it's showing — only that the check
failed and the list may be stale.

| Locale | Value source | Status |
|---|---|---|
| en | Approved English (this PR) | Source of truth |
| es | English (unchanged from existing placeholder) | English placeholder — needs human localization |
| de | English (unchanged from existing placeholder) | English placeholder — needs human localization |
| fr | English (unchanged from existing placeholder) | English placeholder — needs human localization |
| it | English (unchanged from existing placeholder) | English placeholder — needs human localization |
| pt | English (unchanged from existing placeholder) | English placeholder — needs human localization |
| ja | English (unchanged from existing placeholder) | English placeholder — needs human localization |
| ko | English (unchanged from existing placeholder) | English placeholder — needs human localization |
| zh | English (unchanged from existing placeholder) | English placeholder — needs human localization |
| hi | English (unchanged from existing placeholder) | English placeholder — needs human localization |
| ar | English (unchanged from existing placeholder) | English placeholder — needs human localization |

**Reuse check performed:** the entire `connected_health` namespace was
checked in `es.json` (the most-translated non-English MVP locale) for any
existing translated phrase covering "couldn't check" / "out of date" /
"connections" — none exists; every key in that namespace across all 10
non-English files is still an untranslated English mirror (confirmed
programmatically — `header`, `empty`, `loading`, etc. all read identical to
`en.json`). Per the mission's rule ("reuse approved existing terminology
... otherwise put the ENGLISH source string"), the English source was
carried into all 10 files.

**Tests updated to match (mechanical, copy-following only, no logic
changes):**
- `services/health/__tests__/connectedHealthView.test.ts` — the `/Offline/`
  regex assertion on `EN_LOCALE.connected_health.offline_notice` no longer
  matches the reworded copy; updated to `/couldn't check|out of date/i`.
- `components/health/__tests__/connectedHealthView.render.test.tsx` — same
  fix for the rendered offline banner text.
- `components/health/__tests__/connectedHealthContainer.render.test.tsx` —
  same fix; this test exercises `ConnectedHealthContainer.tsx` (a #491-owned
  file, **not edited** — only its test's literal-text assertion changed to
  track the copy change, since the assertion would otherwise fail regardless
  of file ownership).

`components/health/ConnectedHealthContainer.tsx` line ~41 has a stale code
comment referencing the old "showing the last known connection status"
phrase descriptively. Not fixed here — that file is #491-owned and this is
comment-only (no functional or compliance impact); flagging for whoever next
touches that file.

## Why zero new keys

The mission's known target (`sleepSignals.ts`) and the "sweep for more"
instruction were both investigated exhaustively:

- `connectedHealthView.ts` / `ConnectedHealthView.tsx`: already fully keyed.
- `connectedHealthContainerModel.ts` / `ConnectedHealthContainer.tsx`
  (#491-owned, read-only sweep): already fully keyed — including the
  `connected_health.revocation.*` pattern this PR was told to mirror.
- `providerPresentation.ts`, `healthSignalsFromStore.ts`,
  `signalResolution.ts`, `readinessSignals.ts`: pure enum/numeric
  reshaping — zero user-facing strings.
- `weeklyHealthAggregates.ts` (#492-owned, read-only sweep): zero
  user-facing strings.
- `appleHealthSync.ts`, `healthConnect/sync.ts`: two string literals found
  by the initial scan (`"HealthKit authorization was revoked mid-sync"`,
  `"persisted token envelope is not valid JSON"`, `"...an unrecognized
  shape or version"`) — all three are `Error` constructor / default-message
  text for internal exception classes, never rendered to a user (each is
  mapped to a closed status enum before reaching any UI, per this
  codebase's honesty discipline). Not compliance/user-facing copy; not
  extracted.
- `sleepSignals.ts`: the one real finding — see below.

Given that, adding speculative new locale keys nothing yet consumes would
be scope-guessing (a namespace shape for Sleep Mode copy that doesn't exist
yet, under a `connected_health.*` tree it doesn't structurally belong to) —
worse than documenting the gap plainly.

## Pending extraction (blocked by #491/#492 lineage + out-of-scope consumer)

`services/health/sleepSignals.ts` — **not extracted this PR.**

| String | Occurrences | Locale key if extracted |
|---|---|---|
| `Last night` | 2 | *(not yet assigned — see root cause)* |
| `No recent signal` | 1 | *(not yet assigned)* |
| `Signal is stale` | 2 | *(not yet assigned)* |
| `Permission needed` | 1 | *(not yet assigned)* |
| `Resting HR` | 2 | *(not yet assigned)* |
| `HRV (RMSSD)` | 1 (added by #492, post-rebase) | *(not yet assigned)* |
| `HRV (SDNN)` | 1 (added by #492, post-rebase) | *(not yet assigned)* |

**Root cause (verified, not guessed):** `SleepSignalsForContainer.freshness`
and `SleepMetricInput.label` (the two fields carrying these strings) flow
directly into `services/sleep/sleepModeView.ts` and
`screens/SleepModeScreen.tsx` — an entirely separate, currently
**non-i18n'd** legacy surface. Confirmed by reading `sleepModeView.ts`:
`PHASE_LABEL`, `CHIP_LABEL`, `CONFIDENCE_LABEL`, `SLEEP_GATED_NOTICE`, and
every other string in that ~450-line module are hardcoded English with zero
`useTranslation()` calls anywhere in the Sleep Mode screen chain.

Converting `sleepSignals.ts`'s output to `I18nText` (the pattern this PR
uses everywhere else) would do one of two things, both out of scope for a
Connected-Health/canonical-consumer localization PR:
1. Break `tsc --noEmit` at `SleepModeScreen.tsx` (a `string`-typed field
   would receive `{ key, params? }`), or
2. If loosely typed to compile, render raw locale keys (e.g.
   `connected_health.sleep.last_night`) on the live Sleep Mode screen —
   a regression, not an improvement.

Neither is acceptable inside "minimal, string→key swaps only, no logic"
for this one file. Real extraction requires a **separate, larger PR**
that first makes `services/sleep/sleepModeView.ts` +
`screens/SleepModeScreen.tsx` i18n-aware (mirroring the
`ConnectedHealthView.tsx` split: pure resolver returns `I18nText`, one
presentational component resolves it) — a Sleep Mode localization project
in its own right, not a byproduct of this PR.

**Lock-test handling:** these 7 exact strings are allowlisted by exact
string match, scoped to `sleepSignals.ts` only, in
`services/health/__tests__/hardcodedHealthCopy.test.ts`
(`PENDING_EXTRACTION_ALLOWLIST`). Any *new*, *different* hardcoded string
added to `sleepSignals.ts` — or anywhere else in the scanned tree — still
fails the lock test. A self-test in that file proves the allowlist cannot
silently swallow an unrelated new violation.

**Recommendation:** open a follow-up ticket, "Localize Sleep Mode screen,"
scoped to `services/sleep/sleepModeView.ts` + `screens/SleepModeScreen.tsx`
+ `sleepSignals.ts`'s consumer-facing fields, once that surface's own
product/compliance review is ready for it. Merging that PR should delete
the corresponding rows from `PENDING_EXTRACTION_ALLOWLIST` and this table.

## New key × locale matrix

**0 new keys added.** (See "Why zero new keys" above.) One existing key's
value changed (`connected_health.offline_notice`, table above).

## Lock test

`services/health/__tests__/hardcodedHealthCopy.test.ts` — pattern-scan test
guarding `services/health/*` + `components/health/*` (excluding
`__tests__/` and `*Fixtures.ts`) against new hardcoded user-facing strings.
Heuristic, exemptions, and scope are documented in the test file's header
comment. Includes a live self-test (temporarily injecting a hardcoded
string into `providerPresentation.ts` during development, confirmed the
scan catches it, then reverted — see PR description for the verification
note) and a second self-test proving the pending-extraction allowlist only
exempts its exact tracked literals, not entire files.

## Test totals (this PR, scoped run)

```
npx vitest run artifacts/aforce-os/services/health artifacts/aforce-os/components/health
Test Files  18 passed (18)
     Tests  430 passed (430)
```

(17 pre-existing files/409 tests + 1 new file
`hardcodedHealthCopy.test.ts`/21 tests = 18 files/430 tests.)
