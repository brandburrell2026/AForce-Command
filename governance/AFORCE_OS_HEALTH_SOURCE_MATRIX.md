# AForce OS — Health Source Matrix (Phase 0)

**Status:** Draft for founder review · Read-only audit · **Owner:** Julius + Brandon
**Verified against:** `52986ece` (2026-08-01). Sources: Phase 0L (token security) + existing
`docs/HEALTH_PLATFORM_INTEGRATION_ARCHITECTURE.md` (approval-ready architecture, no code).

> Capability status per provider, plus the token-security posture that applies to all OAuth providers.
> **"Real-time" is never claimed unless the provider + implementation prove it; missing measurements
> are never simulated as measured data** (Constitution Principle: observation not fabrication).
> Provider feature flags (`healthkit_native_enabled`, all `health_*_direct`/`_connect`/`_demo_data`)
> are **OFF** in production (Launch-Readiness §6); demo data off.

---

## 1. Provider capability matrix

| Provider | Backend present | Auth | Encryption at rest | Status | Notes |
|---|---|---|---|---|---|
| **WHOOP** | ✅ token store + fetch worker | OAuth2 | pgcrypto dual-write (`lib/db/src/whoopTokenStore.ts`) | **Partially Built** | v2 API + `score_state`; Phase-C plaintext-drop pending; prod key presence unverified (SS-03) |
| **Oura** | ✅ token store + fetch worker | OAuth2 | pgcrypto dual-write (`ouraTokenStore.ts`) | **Partially Built** | same encryption posture; `readinessScore` biometric (`types/biometrics.ts:36`) |
| **Garmin** | ✅ token store | OAuth | pgcrypto (`garminTokenStore.ts`) | **Partially Built** | fetch pipeline maturity not fully verified this pass |
| **Strava** | ✅ token store + fetch worker | OAuth2 | pgcrypto (`stravaTokenStore.ts`) | **Partially Built** | activity-oriented |
| **Apple HealthKit** | native module gated | on-device HK | n/a (on-device) | **Specified / Proposed** | `healthkit_native_enabled` off; architecture in the integration doc |
| **Android Health Connect** | — | on-device | n/a | **Specified / Proposed** | integration doc; no code verified |
| **Samsung Health** | — | — | — | **Proposed** | integration doc only |
| **Fitbit** | — | — | — | **Proposed** | integration doc only |
| **Polar / Coros / Suunto** | — | — | — | **Proposed** | integration doc only |
| **Phantom Band** | ✅ BLE service (`phantomBandService.ts`) | BLE | — | **Built-Hidden** | `phantom_wearable_enabled` off; "band never processes audio" |
| **Meridian** | reference stub | — | — | **Proposed** | Phase-3 tier reference only |

Per-provider fields the architecture doc must resolve before any provider goes Live (enrollment/partner
approval, scopes, read/write direction, sync model + latency, webhook/poll behavior, rate limits, last-
sync, freshness, error/retry, disconnect, revocation, deletion, duplicate-resolution, sandbox
availability, prod-credential status) are specified in `docs/HEALTH_PLATFORM_INTEGRATION_ARCHITECTURE.md`
and are **not** re-verified here — most providers are Specified/Proposed.

## 2. Token-security posture (applies to all OAuth providers) — Phase 0L

- **Encryption:** all four live stores encrypt at rest via pgcrypto (`pgp_sym_encrypt`), **Phase A
  dual-write** (plaintext column + ciphertext, prefer-enc-on-read). **Phase B** backfill helper exists.
  **Phase C (drop plaintext columns) NOT done** — plaintext still present in the schema
  (`whoopTokenStore.ts:71`).
- **Conditional-on-config risk (SS-03):** the encryption key is nullable; workers pass
  `process.env[...] ?? null` (`whoopFetchWorker.ts:252`, `ouraFetchWorker.ts:174`). **If the
  `*_TOKEN_ENCRYPTION_KEY` env vars are unset in production, tokens persist plaintext-only.** Could not
  verify prod key presence in this environment (secrets off-limits) — **must confirm.**
- **Key rotation:** wrong key falls back to plaintext + warns, no throw (test-covered).
- **Token-in-URL:** the realtime hub accepts a short-lived Clerk JWT via `?token=` query
  (`aforceHub.ts:81-85`) with an acknowledged proxy-log-leak tradeoff — lower severity than a provider
  token, but flagged. **Never place long-lived provider tokens in URLs.**

## 3. Honesty requirements (governance)
- Provider status labels must reflect verified+unexpired links, not mocks — `resolveHealthProviderStatus`
  wired into Profile rows (PASS-3 slice 1 / RC-L13); the fake-LIVE mock + demo-biometric seeding into
  score inputs were removed.
- Biometrics feed **Readiness / recovery only, never the Score** (`types/index.ts:897-898`), clamped
  ±10 (`breakdown.ts:322-323`) — consistent with Score Protection.
- Missing provider data is shown as "Not connected"/unavailable, never estimated as measured.

## 4. Status summary
Four OAuth providers = **Partially Built** (encryption Phase-C + prod-key verification are the gating
items). Native/other providers = **Specified/Proposed**. No provider is **Live** in production
(all provider flags off).

## 5. Foundation 1A (2026-08-03) — canonical layer landed, still no provider Live

The provider-neutral foundation (`@workspace/health-core`, PR: health foundation 1A) added the shared
contracts WITHOUT activating anything. **No provider status above changed; no provider is Live.**
All `health_*` flags remain OFF in DEFAULT and DEMO sets — now locked by
`featureFlags/__tests__/healthFlagsDefaultOff.test.ts`.

What is now canonical (owned by `lib/health-core`):
- **Provider identity + typed capability declarations** (`HEALTH_PROVIDER_CAPABILITIES`): method,
  platforms, external-approval requirement (Garmin, Samsung-direct), typed record coverage,
  provider-attributed score kinds, HRV method, backfill caps, sync model, and **activation gates**
  per provider. Garmin is declared DORMANT (partner credentials + endpoint verification gates);
  Strava is declared PARKED (kept intact, not exposed); Samsung is modeled **via Health Connect**
  only — never a direct-connection claim.
- **HRV honesty (D1):** `hrvRmssdMs` / `hrvSdnnMs` split. The legacy `hrvSdnn` field is deprecated —
  WHOOP/Oura/Garmin actually populate it with RMSSD-based values; translation is explicit and
  per-provider (`HRV_METHOD_BY_PROVIDER`, `resolveHrv`). RMSSD is never presented as SDNN.
- **One normalization boundary** (`normalizeProviderBiometrics`) resolving shipped drift
  (Garmin `hrvMs`→`hrvRmssdMs`, `stress`→`stressScore`) at ingestion.
- **Deterministic deduplication + provenance chains** (`dedupeRecords`, `SOURCE_PRIORITY`): the four
  named double-count paths (Oura/Garmin via HealthKit, WHOOP via platform store, Samsung via Health
  Connect) are covered by fixture tests; provider scores are never cross-selected; steps are never
  summed across providers; cross-provider selection is priority-then-freshness, not freshest-wins.
- **Freshness-aware presentation** (`services/health/providerPresentation.ts`): a connected link with
  stale (>24h) or expired (>72h) data presents as `stale` / `no_recent_data`, never as live.
- **Compliance copy fix (D5):** the WHOOP card claim "FEEDING AFORCE HYDRATION SCORE · LIVE" was
  replaced with "INFORMING AFORCE READINESS · LIVE" in all locales, with a regression test
  (`services/health/__tests__/prohibitedCopy.test.ts`) preventing the prohibited claim from returning.

Deferred to PR 1B (server provider-kit + privacy lifecycle): shared OAuth/token/sync extraction
(Oura first, WHOOP last behind byte-parity tests), disconnect that also removes the served biometrics
snapshot + revokes provider-side where supported, account-deletion cascade, encryption Phase B for all
providers then Phase C, admin sync diagnostics. Until 1B, WHOOP keeps its shipped server-credential
gating (documented carve-out in `utils/health/providerRowStatus.ts`).
