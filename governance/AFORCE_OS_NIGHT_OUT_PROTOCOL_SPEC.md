# AForce OS — Night Out Protocol Spec (Phase 0 reconciliation)

**Status:** Draft for founder review · **Documentation-only, append-only reconciliation pass**
**Owner / approval:** Julius + Brandon · **Verified against:** working commit on `main` (2026-08-01),
branch `docs/night-out-reconciliation`.
**Supersedes:** all earlier Night Out / Social Mode addenda **only**. Does **not** supersede the
Constitution, approved architecture, roadmap, master prompt, or frozen governance.

> This spec reconciles the **Night Out Protocol** against the actual repository (the current "Social
> Mode" implementation) and the completed Phase-0 audit. **No product code, scoring architecture,
> migration, package, provider, entitlement, or HydroState authority was changed.** Deterministic
> values in this document (HydroState 76, 12 oz, 20-min window, High Confidence) are design fixtures,
> never production behavior. Where this addendum conflicts with higher-authority governance the
> conflict is recorded in the Reconciliation Register and stopped for Julius + Brandon.

---

## 1. Name & product lock (§2)

| Field | Value |
|---|---|
| Public screen title | **NIGHT OUT** |
| Official system name | **AForce Night Out Protocol** |
| Public descriptor | **Private Evening Protocol** |
| Eyebrow (from concept ref) | **AFORCE PROTOCOL** |
| Retired public term | "Social Mode" (legacy alias only — stored data, migration, deep-link, historical analytics, route redirection) |
| Banned terms | Night Owl, Party/Drinking/Alcohol/Hangover Mode, Recovery Shield, Protect Tomorrow, novelty nightlife terms; no owl mascot / nightclub / alcohol-centered identity |

**Current repository state (evidence):** the term is "Social Mode" throughout —
`screens/SocialModeV2Screen.tsx`, `services/socialModeEngine.ts`, `app/(tabs)/social.tsx`,
`app/(tabs)/social-legacy.tsx`, `app/social-v2.tsx`, `spec_social` flag (`featureFlags/flags.ts:93,364`),
`social.*` i18n keys. → Naming migration is a Reconciliation item (**NO-1**), not a code change in this
pass.

## 2. Product definition & placement (§3)

Night Out is a **private, optional performance protocol** for managing **confirmed hydration behavior**
during an extended evening. **Alcohol is optional context, not the defining requirement** — valid
alcohol-free contexts include dinner, gala, concert, travel, networking, long engagements.

Night Out is **not** a social network / feed / matching / leaderboard / BAC calculator / impairment or
sobriety / driving-safety / hangover-prevention / medical / emergency tool, and **not a 6th tab**.

**Placement lock:** Night Out must live **inside the existing Protocol tab** — five tabs preserved
(Build-Rule #14). **Current repository state:** Social V2 is a **hidden bottom-tab route**
(`app/(tabs)/social.tsx`, `href:null`) plus a duplicate root mount (`app/social-v2.tsx`) and a
dev-gated legacy screen (`app/(tabs)/social-legacy.tsx`). → **Placement + duplicate cleanup is
Reconciliation item NO-2** (relocate into Protocol; retire duplicates; keep `social`/`social-legacy`
as legacy redirects). No automatic activation from location/venue/calendar/camera/voice/gait/
wearable/scan/inferred-alcohol — **activation requires an intentional user action.**

## 3. Authority Matrix (§6, required)

| Authority | Question | Current implementation (evidence) | Status |
|---|---|---|---|
| **Event authority** | Which record is confirmed intake/session activity after reconciliation? | `aforceIntakeLogs` (append-only, idempotent by `clientEventId`, correction tombstones) is the de-facto event record; Night Out drinks are logged via `logSocialDrink` into `state.socialMode.drinks` (`store/app/actions.ts:481`). No unified canonical event ledger table. | **Partially Built** |
| **Session authority** | Preparing / active / winding-down / closed / recovery-handoff? | `state.socialMode` carries `active` + an 8h recovery window (`inRecoveryWindow`, `socialModeEngine`); no full preparing→closed lifecycle. | **Partially Built** |
| **HydroState calculation authority** | Which component calculates HydroState? | **On-device** `utils/scoringEngine.ts` (`calculateScore`); server persists client-submitted snapshots (`scoreSnapshotRepo`). **Preserve — do not change** (§6, §30.9). | **Live** |
| **Presentation authority** | Which value the UI shows (pending/projected/reconciled/stale/offline)? | Home orb + confidence/freshness surfaces read the engine projection; no explicit Night-Out pending/reconciled presentation state. | **Partially Built** |

**A server-reconciled event record does not make the server the HydroState calculation authority**
(§6). The canonical server **event ledger** (`events/schemas.ts` + in-memory `eventBus.ts`) is
**Specified, not wired** (no producers) — classified accurately, not "built."

## 4. Alcohol ↔ HydroState reconciliation (§5) — **existing logic documented exactly**

**Precise current behavior (evidence):**
- **Activation / scan / selection / intention are score-neutral** — scanning writes a scan record with
  `scoreBefore === scoreAfter` (`HydrationScanScreenV2.tsx:243-244`); `ConsumptionStatus` advisory
  never dispatches (`:371-374`). ✔ aligns with §5.
- **A confirmed alcohol drink influences the deterministic model prospectively, two ways:**
  1. **Intake path** — alcohol category `hydrationCoefficient = 0.10` ("net diuretic — minimal credit",
     `data/drinkCatalog.ts:23,189`): a logged alcohol serving contributes low effective hydration to
     `calculateScore`.
  2. **Windowed depletion** — `socialIntakePoints(drinks, now)` (`utils/hangoverRisk.ts:191`) applies a
     **time-decaying, capped** penalty (`PER_DRINK_WEIGHT = 5` at the 5–60 min peak-diuresis window,
     decaying to 0 by ~180 min, capped at `SOCIAL_INTAKE_MAX_PENALTY`), consumed by the score breakdown
     (`utils/scoring/breakdown.ts:101,393`) from `state.socialMode.drinks`. Tested:
     `utils/__tests__/socialIntake.test.ts` (~30 cases) + determinism guard
     (`scoreClockDeterminism.test.ts:131`).
- The `.social` rollup (`buildSocialRollup(userState, score)`, `scoringEngine.ts:57`) is computed
  **from** the score and returned as a separate field (`:76`); it does **not** mutate the score — it
  influences **command selection** (`generateCommand(level, userState, score, social)`) and the
  recovery window.

**Assessment vs §5:** the existing effect is **prospective, deterministic, config-shaped, capped, and
time-decaying from the confirmed event** — it does **not** apply an arbitrary subtraction, award points,
rewrite pre-event history, use AI weights, or change HydroState merely because Night Out is active. **It
substantially aligns with the addendum's §5 rule.** Two reconciliation notes:
- **NO-3 (Build-Rule #13):** `PER_DRINK_WEIGHT`, `SOCIAL_INTAKE_MAX_PENALTY`, per-drink
  `decayMultiplier`/`activeMinutes` (`data/alcoholDrinks.ts:47-52`) are **hardcoded in
  `hangoverRisk.ts`/`alcoholDrinks.ts`, not `config/hydroStateModel.ts`.** Build-Rule #13 requires
  tunable thresholds in config. Reconcile (documentation flags; **do not move in this pass**).
- **NO-4:** correction/deletion of a confirmed drink must follow approved event-reconciliation/replay;
  the append-only correction pattern exists for intake but the Night-Out drink array is client-state —
  reconcile before proposing any correction (§5). **Do not change architecture now.**

## 5. Entitlement Decision entry (§7) — **OWNER: Julius + Brandon**

| Field | Evidence / recommendation |
|---|---|
| Current flag | `spec_social` = **true** (`flags.ts:93`) — a *reskin* flag (V2 vs legacy), **not** an entitlement gate. No dedicated `night_out_*` flag exists. |
| Current entitlement | **None** — Night Out is not mapped to Core/Command; the obsolete **Athlete** tier is retired (RC-L14) and must not be reintroduced. |
| Production visibility | Reachable now (hidden tab route; `spec_social` on). |
| Non-binding recommendation | Founder/Internal Preview during dev + validation → candidate for **Command** after validation; **not** a standalone subscription. |
| Implementation dependency | A dedicated `night_out_enabled` flag + entitlement mapping (server-authoritative, per Phase-0 SS-02) before public exposure. |
| **Decision required** | **Julius + Brandon must approve final entitlement placement before public exposure.** Unresolved — do not assign in this pass (§30.8). |

## 6. Complete experience lifecycle (§8) — target vs current

| Stage | Target (§8) | Current evidence |
|---|---|---|
| BEFORE | user-initiated activation; HydroState + interpretation + freshness + confidence; optional user-provided duration (never inferred); one Water-First prep command; Start / Not Now | activation exists; no explicit prep-command lifecycle |
| NOW | one dominant Water-First command + amount/range + window + reason + confidence + source/freshness; Start Water / Adjust / Not Now; partial completion; **never "safe alcohol amount"** | command exists; confidence/source/adjust/partial inconsistent on the surface (Phase-0 SS-22) |
| NEXT | **"Update confirmed intake"** (not "Log your next drink"); quick categories Water/AForce/Coffee/Alcohol/Other (age+region permitting) | current copy leads with product on the RTD path (SS-25); alcohol quick-log exists |
| LATER | reassessment time; "Subject to change"; **no countdown to another drink; no "earned" drink** | recovery window exists; verify no "earned drink" framing |
| BEFORE SLEEP | one calm evidence-supported action; Water-First; **no detox/hangover-prevention/guaranteed-recovery claim**; Recovery Window handoff | 8h recovery window exists; hangover terminology present (NO-6) |
| NEXT MORNING | return to normal Protocol; Collecting/Limited-Confidence/Stale/Not-Available honesty; **no fabricated improvement, no comeback bonus** | normal Protocol resumes; honesty states exist elsewhere |

## 7. Consumption-truth model (§10)
`SCANNED → SELECTED → INTENDED → STARTED → PARTIALLY CONSUMED → COMPLETED → DISCARDED`. **Current:**
scan/select/intent are score-neutral (verified); a **label-only `HYDROSCAN_FLOW`** exists but is not
consumed; **partial consumption is not modeled** (`IntakeEvent.oz` single value); two scan-log paths
auto-assume full serving (`realApi.ts:337`). Reuse the canonical intake event — **do not create a second
Night-Out intake system** (§10). → Reconciliation NO-7 (= Phase-0 RC-L12 / SS-23).

## 8. Neutral alcohol-confirmation design (§11) — **currently compliant**
Alcohol is logged via a **separate `logSocialDrink` action** (`store/app/actions.ts:481`), **not** the
water `logIntake` path — so it fires **no** completion reward, success voice, or `markCycleExecuted`
(those live only in `logIntake`, `actions.ts:274-281`). The Night Out screen uses **light selection /
light impact haptics** (`SocialModeV2Screen.tsx:265,324`), not `notification(Success)`. **This aligns
with §11** (neutral confirmation, no celebration for alcohol). Preserve this separation on rename.

## 9. Event-Class Provider Matrix (§13, required)

| Class | Providers that may supply it | Night-Out use | Never fabricate |
|---|---|---|---|
| A · Hydration/beverage intake | **Only** providers exposing approved hydration/beverage records (today: manual + scan; no wearable supplies beverage intake) | confirmed drinks | Garmin/WHOOP/Oura/Strava/Apple/Health-Connect/Samsung/Phantom **do not** supply beverage intake |
| B · Activity/workout | Garmin/WHOOP/Strava/Apple/Health-Connect + manual | demand/timing context only | — |
| C · Sleep/recovery | Oura/WHOOP/Apple/Health-Connect | Recovery Window context | — |
| D · Biometric | Oura/WHOOP/Garmin/Apple (HR/HRV/temp) | context; **never** infer alcohol/impairment (§14) | — |
| E · Environmental | Open-Meteo/city climate (weather/heat/humidity/altitude/travel) | demand context | — |

Deduplicate **only within** an event class using class-specific native ids + source precedence +
freshness + class-appropriate windows — **not** one universal "freshest wins" (§13). Provider limits
documented honestly in `AFORCE_OS_HEALTH_SOURCE_MATRIX.md`.

## 10. AI / camera / voice / wearable limits (§14) & prohibited outputs (§12/§14)
Code calculates; AI explains. **Never** determine or display BAC / impairment / intoxication / sobriety
/ time-until-sober / alcohol clearance / driving ability / hangover prevention / a safe alcohol
quantity / a score weight / a medical conclusion. **Never** infer alcohol use or impairment from
face/skin/eye/speech/voice/gait/typing/location/HR/HRV/temp/sleep. **Current gap (NO-5 = SS-05):**
`services/socialModeEngine.ts` still imports/computes `estimateBAC`, `impairmentFromBAC`,
`transportationPromptFor` into `ScoreEngineOutput.social`, and BAC/"do not drive" strings ship in all
12 locales (`en.json:792,811,814,819`) — render components orphaned but re-importable. **"Hangover
Risk" terminology (NO-6)** (`calculateHangoverRisk`; `en.json:770,1397`) is banned user-facing risk
language (Terminology §7). Complete deprecation is required before Night Out public exposure.

## 11. Privacy, security, sensitive-data (§15) — Night Out is private by default
Confirmed alcohol data is **sensitive personal data.** Do not auto-expose activation/timing/venue/
beverage/alcohol/HydroState/commands/next-morning to Circle, Guardian, Clutch Team, coaches, Cruise/
hospitality operators, or any enterprise tenant. **Current gap:** default share posture is opt-out
(`DEFAULT_PRIVACY` every field true — SS-06); no moderation/age gate (SS-08). Lock-screen notifications
must be neutral by default — preferred "**AForce has an update**"; never show "Night Out"/"Alcohol"/
beverage history without explicit detailed-preview opt-in. No precise-location requirement. Full threat
model: `AFORCE_OS_SECURITY_PRIVACY_THREAT_MODEL.md`.

## 12. Age & regional alcohol controls (§17) — **absent (legal item)**
**No age gating / drinking-age / regional alcohol eligibility logic found** in the repo (grep clean).
Alcohol-specific controls (quick-log, disclaimers) must respect applicable age + jurisdiction; Night
Out itself supports alcohol-free use. Age entry alone does not establish legal eligibility without
approved compliance logic. **Legal counsel must review** alcohol onboarding, disclosures, consent, and
regional availability before public launch. → NO-8.

## 13. Emergency boundary (§18) — **absent**
No approved escalation path exists. When explicit user-reported information meets an approved escalation
rule: stop normal coaching → show legally-approved localized emergency guidance → never promise
monitoring/rescue → never give driving clearance. All escalation rules + copy require legal +
clinical-safety + regional review. → NO-9 (design item, not built).

## 14. Visual / motion / haptics (§19, §20)
Hierarchy: **AFORCE PROTOCOL → NIGHT OUT → Private Evening Protocol**; HydroState remains the only hero;
positive/Balanced never urgent red; preserve AForce tokens. No bar/nightclub/owl/party imagery, no
alcohol rings/streaks, no celebration on activation or alcohol log. Neutral/no haptic for alcohol
logging; success reserved for verified beneficial completion; every animation needs reduced-motion.
Cross-refs `AFORCE_OS_MOTION_SPEC.md`.

## 15. Capability status (§27)

**Night Out Protocol = Partially Built (as "Social Mode"), Blocked for public Night-Out exposure.**
Evidence: shipped Social V2 screen + engine + deterministic alcohol-depletion model + tests
(`spec_social` on); **blocked** by naming migration (NO-1), Protocol placement (NO-2), residual
prohibited BAC/hangover language (NO-5/NO-6 = SS-05/SS-21), absent age/regional controls (NO-8),
unresolved flag/entitlement (§7), and absent emergency boundary (NO-9). Not "Live/Validated" as Night
Out until these clear + legal review + deterministic states + real-device evidence.

## 16. Reconciliation items opened (mirrored into `AFORCE_OS_RECONCILIATION_REGISTER.md`)

| ID | Item | Owner | Blocking? |
|---|---|---|---|
| NO-1 | "Social Mode" → "Night Out" public rename; retain legacy alias | Julius + Brandon | yes |
| NO-2 | Relocate into Protocol tab; retire `social-v2`/`social-legacy` duplicates | Founder + eng | yes |
| NO-3 | Move hardcoded alcohol-depletion constants to `config/hydroStateModel.ts` (Build-Rule #13) | eng (DR if thresholds change) | yes |
| NO-4 | Confirmed-drink correction/deletion → approved event reconciliation/replay | eng | yes (before any correction) |
| NO-5 | Complete BAC/impairment/driving deprecation (= SS-05) | Founder + counsel | **S1** |
| NO-6 | Retire "Hangover Risk" user-facing terminology (Terminology §7) | Founder + counsel | yes |
| NO-7 | Consumption state machine (= RC-L12 / SS-23) | product | yes |
| NO-8 | Age + regional alcohol controls (§17) | Founder + counsel | **S1 (legal)** |
| NO-9 | Emergency boundary design (§18) | Founder + counsel + clinical | yes (design) |
| NO-10 | Dedicated `night_out_enabled` flag + entitlement mapping (§7; server-authoritative per SS-02) | Julius + Brandon | yes |

## 17. Aligned / already-compliant (no change needed)
- Alcohol influence on score is deterministic, capped, time-decaying, prospective (§5). ✔
- Alcohol logging is neutral (separate `logSocialDrink`, no celebration) (§11). ✔
- `socialModeEngine` rollup does not mutate the score (Score Protection). ✔
- Activation/scan/select/intent are score-neutral (§4). ✔
- Sports/activity never raise HydroState directly; no fake steps. ✔

## 18. Stop condition
Documentation only. No product code, packages, migrations, provider connections, entitlement
assignment, or HydroState-authority change. Entitlement (§7) and every blocking NO-item stop for Julius
+ Brandon. After approval, the implementation phase is authored via Prompt 2; Prompt 3 certifies.

## 19. NO-a implementation record (2026-08-01) — flag + session-state model

First implementation slice of Phase P-NO (founder-approved). **Scope-limited: no UI, no HydroState/
alcohol/navigation change; entitlement stays Founder/Internal-Preview per NO-10.**

- **Flag `night_out_enabled`** — added to `types/index.ts` (FeatureFlags), `featureFlags/flags.ts`
  (`DEFAULT_FLAGS` = **false** / prod-off; `DEMO_ALL_ON_FLAGS` = **true** / internal-demo only), and the
  test `baseFlags`. Founder decision NO-10: not assigned to any paid tier; no client toggle grants real
  access; production access must ultimately require server-side authorization (a later slice).
- **Canonical session-state model** — `services/nightOut/sessionState.ts`:
  `NightOutSessionState = OFF | PREPARING | ACTIVE | WINDING_DOWN | RECOVERY_HANDOFF | CLOSED`, resolved
  by a **pure** `resolveNightOutSessionState(social, {now, phaseHint})` that **reconciles onto the
  existing `SocialModeState`** (reads `active`/`endedAt`/`cruiseUntil`; 8h/24h recovery window;
  clock-safe). **No parallel state system, no stored-shape change → no migration; legacy Social Mode
  data + the `social_mode` alias are preserved** (`NIGHT_OUT_LEGACY_ALIAS`). PREPARING/WINDING_DOWN are
  reserved canonical states not yet in the stored shape — driven only by an explicit `phaseHint` until
  the NO-c session-start/wind-down flows exist.
- **Fixtures** — `services/nightOut/fixtures.ts`: one deterministic `SocialModeState` per canonical
  state (clock-injected; DEV/test only, never production data).
- **Tests** — `services/nightOut/__tests__/sessionState.test.ts` (18): derivation, 8h/24h window,
  clock-skew safety, malformed-date safety, reserved-state hints, legacy-alias, fixture coverage of all
  six states, and flag defaults (OFF prod / ON demo). tsc 0; full suite green (pre-existing failures
  only). **Not started:** NO-b…NO-f (NO-f blocked pending legal/compliance).

## 20. Stop condition (NO-a)
NO-a committed in isolation. Stop for Julius + Brandon review. Do not begin NO-b…NO-f.

## 22. NO-b record (2026-08-01) — public rename + Protocol placement + visibility

Naming migration + gated placement + route-visibility. **No HydroState scoring, alcohol modeling,
session persistence, or database schema changed; no consumer entitlement tier assigned; no NO-f
legal-gated copy added; no active command experience built; five bottom tabs preserved.**

- **Canonical naming** — `services/nightOut/naming.ts`: public **NIGHT OUT**, official **AForce Night
  Out Protocol**, descriptor **Private Evening Protocol**, eyebrow **AFORCE PROTOCOL**. "Social Mode"
  retired from user-facing copy; retained only as the internal `social_mode` legacy alias.
- **Authorized entry inside Protocol** — `components/nightOut/NightOutProtocolEntry.tsx` mounted in
  `ProtocolScreenV2`. Renders **null** unless authorized (`isNightOutEnabled` = restricted flag +
  approved internal-preview context) → hidden in production; routes to `/night-out` when authorized.
- **Canonical gated route** — `app/night-out.tsx`: authorization-gated; redirects to `/(tabs)/protocol`
  when unauthorized (no loop). Interim target is the existing (renamed) screen; the active experience
  is NO-c.
- **Duplicate-route visibility removed (non-destructive)** — `app/social-v2.tsx` → redirect to
  `/night-out`; `app/(tabs)/social-legacy.tsx` → dev-gated (redirects to Protocol when not in Developer
  Mode); the Profile "Social V2" discoverability link removed. Legacy `/social` route + `socialMode`
  state + analytics keys preserved as compatibility aliases.
- **Home entry points gated** — the Home `SocialModePip` and the `SignalsZone` Night Out banner + entry
  tile now render only when authorized, so unauthorized/production users can neither see nor enter Night
  Out from Home. (This removes the previously ungated Social entry from the production Home — a visible
  change; flagged for founder awareness.)
- **Residue removed** — user-facing "Social Mode"/"SOCIAL MODE" replaced with Night Out across the
  screen header, disclaimer, `en.json` (`social.*` + Profile demo-preview), the Home pip/quote, and the
  legacy Profile label. Locale KEYS unchanged (compat).

Tests (`services/nightOut/__tests__/naming.test.ts` + `routing.test.ts`, +25): canonical naming; no
user-facing residue in en.json / screen; gating (prod hidden, internal reachable); safe redirects with
no loops; social-v2/social-legacy not discoverable; Home entries gated; five tabs / no Night Out tab.
Night Out suite **43/43**; tsc 0; full suite green (pre-existing failures only). **Not started:**
NO-c…NO-f (NO-f blocked pending legal/compliance).

## 23. Stop condition (NO-b)
NO-b committed in isolation. Stop for Julius + Brandon review. Do not begin NO-c.

## 21. NO-a.1 record (2026-08-01) — internal flag isolation

Follow-up correction on the NO-a branch, closing the PR #447 merge blocker: the
production-reachable Developer "unlock all" applied `DEMO_ALL_ON_FLAGS`, which had
`night_out_enabled: true` — a client action could enable a Founder/Internal-Preview
capability (Phase-0 SS-01). Fixed with a two-layer defense, and the three concepts
are now kept explicitly separate:

| Concept | Mechanism | Grants access? |
|---|---|---|
| **Demo presentation capability** | `DEMO_ALL_ON_FLAGS` / demo build | **No** — presentation only |
| **Restricted internal-preview authorization** | `services/nightOut/access.ts` `isNightOutEnabled(flags, ctx)` — flag AND env-driven `DEMO_MODE` context both required | **Yes**, only in an approved internal context |
| **Future server-side authorization** | not yet implemented — the authoritative boundary; supersedes the client gate when it lands | (future) |

Changes:
- `featureFlags/flags.ts`: `DEMO_ALL_ON_FLAGS.night_out_enabled` → **false**; added
  `INTERNAL_PREVIEW_RESTRICTED_FLAGS = ['night_out_enabled']` + pure
  `demoUnlockAllFlags(base?)` that force-clamps every restricted flag to false —
  so the generic unlock can NEVER enable Night Out, even if the demo set is later
  edited to `true`.
- `components/profile/ProfileScreenV2.tsx` + `ProfileLegacy.tsx`: the "unlock all"
  control now applies `demoUnlockAllFlags()` (one-line payload swap + matching
  `allOn` comparison). **No Developer-tab redesign; no new toggle; no Night Out UI.**
- `services/nightOut/access.ts` (new): `isNightOutEnabled` (flag necessary but not
  sufficient — approved context required), `nightOutInternalPreviewContext(DEMO_MODE)`,
  `enableNightOutForInternalPreview` (the only sanctioned enabler; for a later
  approved internal entry, never the generic unlock).
- Flags are **not persisted** (`SET_FLAGS` is in-memory; cold start = `DEFAULT_FLAGS`),
  so there is no persisted-override vector; the access gate additionally denies any
  runtime-flipped flag without the approved context.

Tests (`services/nightOut/__tests__/access.test.ts`, 8): default OFF; restricted-flag
membership; generic unlock cannot enable even against a tampered base; other demo
flags preserved; flag-alone insufficient; context-alone insufficient; client/persisted
override denied without context; approved internal context enables where intended.
tsc 0; full suite green (pre-existing failures only). Server-side authorization
remains the outstanding NO-10 item.
