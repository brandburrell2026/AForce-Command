# AForce OS — Security & Privacy Threat Model (Phase 0)

**Status:** Draft for founder review · Read-only audit · **Owner:** Julius + Brandon (+ counsel)
**Verified against:** `52986ece` (2026-08-01). Source: Phase 0L + 0J/0K.
**References:** `governance/DATA-CLASSIFICATION-MATRIX.md` (S0–S4 classes), DR-002/DR-004/DR-005,
`docs/COMPLIANCE_FRAMEWORK.md`, `docs/PRIVACY-COMPLIANCE-VALIDATION.md`, `CLAIMS-REGISTER.md`.

> **This is readiness mapping, not legal advice or attorney sign-off.** Items requiring qualified
> privacy/regulatory/security counsel are marked **[counsel]**. The later Lock modes
> (`/SECURITY /PRIVACY /REDTEAM`) have **not** been run (per `CONTINUITY.md`); this is the first pass.

---

## 1. Threat model summary (STRIDE-lite over the observed surfaces)

| Asset | Primary threats | Current control | Residual risk |
|---|---|---|---|
| Provider OAuth tokens (S2/S3) | Disclosure at rest / in logs | pgcrypto dual-write; key-conditional | **plaintext-if-key-unset (SS-03); Phase-C not done; token-in-URL on hub (`aforceHub.ts:81`)** |
| HydroState + health signals (S2/S3) | Tampering (client-supplied score); disclosure | append-only logs; biometrics clamp; analytics delta-only | **Score-Protection off in prod (SS-15)**; server persists client score |
| Feature entitlement | Elevation of privilege | consumer purchase server-gated (`checkout.ts`) | **enterprise feature flags client-flippable (SS-01/SS-02)** |
| User PII / account | Repudiation; right-to-erasure | consent versioning + withdrawal | **no export/deletion path (SS-04) [counsel]** |
| Shared/social data | Disclosure of health state | field-level scope controls | **default posture non-private (SS-06); public leaderboard (SS-07); no moderation/age gate (SS-08) [counsel]** |
| Camera images (Smart Capture) | Disclosure; retention | OS camera permission | **server round-trip, no minimization/deletion/consent (SS-10)** |

## 2. AuthN / AuthZ / isolation
- **AuthN:** Clerk (`@clerk/expo`); tab group gated by valid session (`(tabs)/_layout.tsx:323`),
  `DEMO_MODE` bypass for internal/pitch builds only.
- **AuthZ / RBAC:** **absent for enterprise** — no `isFounder`/founderOnly/role/tenant construct;
  `FeatureGate` flips flags client-side (SS-02). Consumer purchase eligibility **is** server-enforced
  (`LAUNCHED_PLAN_IDS`, 404 on dark tiers) and web-rail hard-restricted to `athlete`
  (`entitlement.ts:155`).
- **Tenant isolation:** no multi-tenant isolation module found (enterprise B2B unbuilt). **[counsel]**
  before any Guardian/Cruise-Industry tenant goes live.
- **Founder Mode (§62):** not built; devMode is a client boolean → no production isolation, and the
  Developer tab may expose flag admin in prod (SS-01).

## 3. Secrets & tokens
- Provider tokens: pgcrypto (Phase A/B), Phase C pending; key env-conditional (SS-03).
- Never place long-lived provider tokens in URLs — currently only a short-lived Clerk JWT is passed via
  WS `?token=` with an acknowledged tradeoff (`aforceHub.ts:81-85`). Prefer `Sec-WebSocket-Protocol`.
- Secrets are off-limits to this audit; **confirm** `*_TOKEN_ENCRYPTION_KEY`, `SHOPIFY_WEBHOOK_SECRET`,
  Stripe/Clerk keys are set in prod (devops).

## 4. Consent, retention, deletion, minimization
- **Consent:** versioned (`CONSENT_VERSION=1`), grant stamps version, `revokeConsent()` + UI toggle
  (`privacy_manager.ts:25,89,97`; `AnalyticsConsentRow.tsx`). ✅
- **Analytics minimization:** strong — health metrics sent as **years-delta only** (never absolute age
  / Performance Age), pseudonymous id (never Clerk id), consent-gated, k-anonymous server aggregates;
  telemetry never mutates a score (`event_dispatcher.ts:244-254,270`). ✅
- **Retention:** documented (`DATA-CLASSIFICATION-MATRIX.md`, DR-005 retention classes); **no code found
  enforcing retention windows.** ⚠️
- **Export / deletion:** **no `deleteAccount`/`exportData`/erasure implementation found anywhere**
  (SS-04). ❌ **[counsel]** — GDPR/CCPA blocker.
- **Device cache:** DR-002 requires encrypted local cache; R-12 (OPEN, S1) notes existing client stores
  use plaintext AsyncStorage. Intelligence cache must not ship plaintext (Plan P4/P6).

## 5. Compliance posture (documented; not attorney-approved) **[counsel]**
- `DATA-CLASSIFICATION-MATRIX.md` (S0–S4, "no surface ships until every class it reads appears here"),
  `Section-63-Compliance-Pass.md`, `CLAIMS-REGISTER.md`, `ios/AForceOS/PrivacyInfo.xcprivacy`, shipped
  privacy policy + health disclaimer.
- **CR-1 pre-launch claims review is prepped but UNBOOKED** (Launch-Readiness §1) — the standing
  compliance gate.
- HIPAA applicability: to be assessed, not claimed. GDPR/CCPA: export+deletion gap (SS-04). App Store /
  Play health+privacy+subscription+AI disclosures: to be confirmed at submission.

## 6. Observability / incident readiness
- Backend: latency histograms + tracing facade (`observability/metrics.ts`, `tracing.ts`).
- **Client: no crash reporting (no Sentry/Crashlytics), no perf/crash-free budgets** (0L). Incident
  response, backup-restore test, DR, threat-model doc, SBOM/dependency-license inventory — **not found**;
  candidates for a dedicated `/SECURITY` pass.

## 7. Top security/privacy actions (feed Plan P1)
1. Confirm prod encryption keys set; complete provider Phase-C (SS-03).
2. Build GDPR/CCPA export + deletion (SS-04) **[counsel]**.
3. Server-side enterprise entitlement/RBAC + gate the Developer tab (SS-01/SS-02).
4. Private-by-default sharing + moderation/age gate (SS-06/07/08) **[counsel]**.
5. Smart Capture consent + image minimization before enable (SS-10).
6. Add client crash reporting + retention enforcement; run the `/SECURITY` + `/PRIVACY` Lock modes.
