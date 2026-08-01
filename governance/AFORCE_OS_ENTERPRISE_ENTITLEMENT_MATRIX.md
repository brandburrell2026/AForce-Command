# AForce OS — Enterprise Entitlement & Isolation Matrix (Phase 0)

**Status:** Draft for founder review · Read-only audit · **Owner:** Julius + Brandon
**Scope:** Clutch · Guardian · Personal Cruise · Cruise Industry (B2B) · Founder Mode
**References (not duplicated):** `docs/COMMERCE-AND-ENTERPRISE-SPEC.md`, `governance/Section-62-Founder-Mode-Spec.md`,
`governance/Section-63-Compliance-Pass.md`, DR-006 (Guardian injury-risk removed).
**Verified against:** working commit `52986ece` (2026-08-01).

> Companion to `AFORCE_OS_STOP_SHIP_REGISTER.md` and `AFORCE_OS_SECURITY_PRIVACY_THREAT_MODEL.md`.
> Every row is `path:line`-cited from Phase 0J evidence. Merged code is evidence, not approved truth.

---

## 0. Cross-cutting finding — no server-side entitlement/RBAC for enterprise tiers

The gate mechanism for every enterprise capability is the **client** component
`components/FeatureGate.tsx`. When a flag is off it shows "DEMO LOCKED"; the **"Activate Demo"
button flips the flag locally** with no server call, entitlement check, or auth
(`FeatureGate.tsx:37-40`). The flag module itself states production gating does not yet exist:
`featureFlags/flags.ts:6-8` ("In production these would be driven by a remote config / entitlements
service… For demo, an admin toggle in Profile flips them"). No `isFounder`/`founderOnly`/RBAC/tenant
construct exists in the app artifact.

**Consequence:** every capability below is gated by a client boolean any signed-in user can flip.
Server-authoritative enforcement exists **only** for the launched consumer money path
(`checkout.ts` `LAUNCHED_PLAN_IDS` = `{core, athlete}`; dark tiers 404 on direct purchase — Phase 0K),
**not** for feature access to Clutch/Guardian/Cruise once a flag is on. This is the central
enterprise-readiness gap.

---

## 1. Capability × entitlement × isolation matrix

| Capability | Route(s) | Flag (prod default) | Gate type | Server auth / RBAC / tenant isolation | Data | Status |
|---|---|---|---|---|---|---|
| **Clutch** (team) | `app/clutch.tsx` | `clutch_access_enabled` = false (`flags.ts:14`) + `clutch_heat/inventory/clip` | Client `FeatureGate` (`clutch.tsx:55-60`) | **None** | Mock roster (`clutch.tsx:16`) | **Partially Built** (client-gated mock) |
| **Guardian** (coach/team) | `app/guardian.tsx`, `app/heat/guardian.tsx` | `guardian_intelligence_enabled` = false (`flags.ts:20`) + `guardian_body_map/alerts` | Client `FeatureGate` (`guardian.tsx:74-79`) | **None** — no athlete consent, no coach/trainer/operator/athlete view split, no audit log, no revocation | Mock roster (`guardian.tsx:16`) | **Partially Built** (client-gated mock) |
| **Personal Cruise Mode** | `app/cruise.tsx` → `CruiseModeScreen` | `cruise_mode_enabled` = **true** (`flags.ts:72`) | Client `FeatureGate` (`CruiseModeScreen.tsx:686`) | Guest single-user; public `/cruise/environment`, no auth header (`cruiseEnvService.ts:60-67`); non-diagnostic engine (`cruiseModeService.ts:12-15`); disclaimer always rendered (`CruiseModeScreen.tsx:570-573`) | Live env | **Live** (consumer, disclaimered) |
| **Cruise Industry (B2B)** | `app/(hidden)/cruise/*` | `spec_cruise` = false (`flags.ts:95`); layout redirects home when off (`_layout.tsx:23-25`) | Hidden route group | **None** — no tenant isolation, RBAC, passenger/operator roles, or B2B backend; screens are static placeholders (`port.tsx:18-44`); no Founder Preview path | Static "—" | **Specified / Proposed** (hidden skeleton) |
| **Founder Mode (§62)** | — | — | `services/devMode.ts` client AsyncStorage boolean only (`devMode.ts:16-55`) | **Not built** — no `founderMode`/`isFounder`/server auth/sandbox-write/time-travel code; nearest is Investor Demo overlay gated by client `demo_mode_enabled` (`flags.ts:500,506-508`) | — | **Not Built** |

---

## 2. Governance conformance findings

### 2.1 Guardian — observation vs diagnosis tension (DR-006 / Constitution Principle 5)
DR-006 removed Guardian "injury-risk protection" → canonical "Performance readiness and recovery
oversight," claiming no injury prediction/diagnosis/medical-risk. The current Guardian demo screen
**crosses that line in the UI**:
- per-athlete composite "risk score" over `coreTempEstimate` and `pH` (`guardian.tsx:37-46`);
- "BODY RISK MAP" with per-body-zone risk (`guardian.tsx:91-104`); `CRITICAL` tier; auto critical
  alerts (`guardian.tsx:146-180`);
- directive copy `'PULL FROM ROTATION. Medical eval.'` (`utils/scoring/recommendations.ts:189`,
  comment `:143` "escalate to medical eval").
- **No on-screen disclaimer** (contrast Personal Cruise, which renders one).

→ Reconciliation/stop-ship: Guardian's shipped-behind-flag copy must be brought to DR-006 governed
language and carry the compliance disclaimer before any Guardian tier is exposed. (Feature is
default-OFF, so not live — but the demo any user can unlock renders it.)

### 2.2 Clutch — medical-adjacent directives
`recommendations.ts:134-135` ("PULL FROM ROTATION. 24 ounces + 3 sticks." / "Cooling protocol.
Recheck core temp in 5 min.") render with no disclaimer. Same governed-language pass required.

### 2.3 Founder Mode (§62) — spec vs reality
Build-Rule #9 and `Section-62-Founder-Mode-Spec.md` require server-authenticated, Production-hidden,
Sandbox-only-writes Founder Mode. **It does not exist.** `Launch-Readiness.md` correctly lists §62 as
"Not-built (spec only)." The client "Developer" tab (Phase 0A, `ProfileScreenV2` `PROFILE_TABS`
`developer`) and `devMode` are **not** the governed Founder Mode and provide **no** production
isolation — they are the opposite risk (client flag admin possibly shipping in prod). See Stop-Ship
S1.

---

## 3. Circle / Community / Competition — the 4th tab (reconciliation)

The 4th tab is simultaneously:
- **`competition`** — route / deep-link id (`app/(tabs)/competition.tsx`)
- **"Community"** — code comments + in-screen title (`competition.tsx:2`, `(tabs)/_layout.tsx:9`,
  `CompetitionScreen.tsx:143`)
- **"Circle"** — the visible i18n label the user reads (`locales/en.json:30`
  `"competition": "Circle"`), per founder ruling RC-L1 (label change DONE `4000791f`)
- **trophy / "SPORT MODE"** — icon + framing (`_layout.tsx:58`, `CompetitionScreen.tsx:142`)

**Content leans public-competition, not private support:** RANK / CHALLENGES / BATTLES / TEAMS / MAP
(`CompetitionScreen.tsx:40-46`); an **individual global leaderboard exposing names + city/state
labels** (`CompetitionScreen.tsx:245,262,270`; `global_leaderboard_enabled` = true `flags.ts:41`);
"Hydration Battles" where "Your score adds to their total" (`:368`). Governance direction (RC-L1/L4:
private Circle, competition folds *inside*) conflicts with the shipped competition-first content.

→ Reconciliation `PA-01`: align route id, all locale files, code comments, screen copy, and content
model to the single ruled intent (Circle, competition nested). Structural fold-in is PENDING BUILD
(not yet done); only the label was changed.

---

## 4. Sharing privacy (Circle) — controls built, defaults inverted

- **Field-level controls exist + honored:** scope (`private`/`circle`/`team_coach`/`public_card`) +
  per-field Score/State/Streak/Protocol/Trend toggles (`MySharedStatusScreen.tsx:20-25,108-112`),
  enforced by `projectSharedStatus` (zeroes disallowed fields, full obfuscation on `private`)
  (`privacyService.ts:112-133`), server-backed (`/api/privacy`).
- **Default posture NOT private (stop-ship):** `DEFAULT_PRIVACY` = scope `'circle'` with **every
  field true** (`data/mockCircleData.ts:70-73`) — score + HydroState label + streak + protocol +
  trend shared by default, opt-out.
- **No moderation / blocking / reporting / minor(COPPA) gate** anywhere; relationship model tops out
  at `muted` + `removeFromCircle` (`types/circle.ts:9`, `circleService.ts:242,259`). No
  challenge-integrity/verification layer.
- Outbound `SharePreviewScreen` sharing is **user-initiated** (OS share sheet), "identity not data"
  (`SharePreviewScreen.tsx:1-13`) — private coach statements not auto-attached. Good.

---

## 5. Status summary

| Capability | Status | Blocking gap before the tier can go Live |
|---|---|---|
| Clutch | Partially Built | Server entitlement/RBAC; real activation + verified-completion loop; disclaimer + governed language |
| Guardian | Partially Built | Athlete consent; role-based views; audit log; revocation; DR-006 language + disclaimer; server RBAC |
| Personal Cruise | Live | (consumer, disclaimered) — none blocking; note public env endpoint has no auth header |
| Cruise Industry | Specified/Proposed | Entire B2B backend: tenant isolation, RBAC, roles, Founder Preview |
| Founder Mode (§62) | Not Built | Entire capability; server auth; Production-hidden; Sandbox-only writes |
| Circle/Community | Live + Built-Hidden | Naming reconciliation (PA-01); content-vs-intent |
| Sharing privacy | Partially Built | Private-by-default; moderation/report/block; minor gate |

**Recommended sequencing** is in `AFORCE_OS_ELITE_IMPLEMENTATION_PLAN.md`. No enterprise tier should
be flag-enabled in production until server-side entitlement + isolation exist.
