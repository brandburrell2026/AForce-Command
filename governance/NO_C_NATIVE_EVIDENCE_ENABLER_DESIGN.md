# NO-c Native Evidence Enabler — DESIGN v2 (revised per founder review; still design-only)

**Status:** Revised design proposal · **DESIGN-ONLY — no implementation yet** · Owner: Julius + Brandon
**Branch:** `NO-c-native-evidence-enabler` (off `feat/night-out-no-c`) · **Draft PR #450** (isolated diff).
**Purpose:** validation infrastructure ONLY — let an authorized operator render the gated Night Out
screen in a **native internal build** to capture Tier-3 evidence (spec §27). Calls the existing
sanctioned `enableNightOutForInternalPreview`; must not weaken the production authorization model.

> Founder review of v1 approved the direction but required: (a) **structural** production route
> exclusion (not a redirecting/`null` route); (b) deterministic typed build config; (c) an explicit
> gate predicate; (d) a sanctioned reset; (e) expanded isolation tests. All are incorporated below.
> Implementation begins only after this revised design is approved.

---

## 1. CORRECTION — structural production route exclusion (was the v1 defect)

**Rejected (v1):** a permanently-present `app/internal-preview.tsx` that redirects / returns `null`.
A runtime redirect + guarded import do **not** prove the route is absent from the production route
manifest or bundle.

**v2 approach — the internal route source lives OUTSIDE `app/` and is INJECTED into `app/` only for the
internal-native build (Acceptable Approach 1 + 4), with a Metro block belt (Approach 3):**

- The internal route + control + gate live under a **non-app** top-level dir `internal-preview/`
  (never part of the production route tree). The production `app/` directory **never contains**
  `internal-preview.tsx` in the committed repo.
- A **build-profile-gated prebuild step** `scripts/inject-internal-preview.mjs` runs ONLY when
  `EXPO_PUBLIC_APP_VARIANT === 'internal'` (wired as the `internal-native` EAS profile's
  `prebuildCommand` / build hook). It copies `internal-preview/internalPreviewRoute.tsx` →
  `app/internal-preview.tsx` for that build only. `app/internal-preview.tsx` is **git-ignored** so it
  can only ever be a generated artifact of the internal profile.
- **Belt (Approach 3):** the production Metro config (`metro.config.js`) adds
  `internal-preview/` + any generated `app/internal-preview.tsx` to `resolver.blockList` when
  `EXPO_PUBLIC_APP_VARIANT !== 'internal'`, so even an accidental import cannot resolve in production.
- Because the route file is absent from `app/` during production bundling, Expo Router's `require.context`
  never registers it → it is **absent from the production route manifest and the Metro bundle graph**
  (statically, not "disabled after registration").

**Evidence (tests, §5):** committed `app/` contains no `internal-preview.tsx`; the injection script is
gated on the internal variant; no shipping source imports `internal-preview/`; a production bundle +
its source maps contain no internal-preview module path/strings (CI bundle-grep); `/internal-preview`
does not resolve in a production build.

## 2. Deterministic build configuration — typed `app.config.ts` (fail-closed)

Introduce a typed **`app.config.ts`** (Expo merges it over `app.json`) that reads
`EXPO_PUBLIC_APP_VARIANT` and sets identity deterministically per variant, and **throws at config
evaluation (build-time failure)** on any missing / invalid / contradictory variant.

| | `production` | `internal` |
|---|---|---|
| `ios.bundleIdentifier` | `com.aforce.os` | **`com.aforce.os.internal`** |
| app `name` | `AForce OS` | **`AForce OS Internal`** |
| `scheme` | `aforce-os` | **`aforce-os-internal`** (internal deep-link scheme) |
| `EXPO_PUBLIC_APP_VARIANT` | `production` | `internal` |
| `EXPO_PUBLIC_INTERNAL_PREVIEW` | unset / `false` | `true` |
| `EXPO_PUBLIC_DEMO_MODE` | `false` | `true` |

**Fail-closed rules (build-time throw, not runtime fallback):**
- Missing/unknown `EXPO_PUBLIC_APP_VARIANT` → throw.
- `variant==='internal'` but bundle id ≠ `com.aforce.os.internal`, or `INTERNAL_PREVIEW!=='true'`, or
  `DEMO_MODE!=='true'` → throw (contradiction).
- `variant==='production'` but `INTERNAL_PREVIEW==='true'` or bundle id === `com.aforce.os.internal`
  → throw (contradiction).

`eas.json` gains an **`internal-native`** profile setting the internal env + a `prebuildCommand` that
runs the injection script. **`eas.json` and `app.config.ts`/`app.json` are flag-first / build-config —
proposed here; I will not create/edit them without explicit per-edit founder authorization.**

## 3. Explicit gate predicate (replaces "`__DEV__` or approved internal profile")

`services/nightOut/internalPreview.ts` (pure, unit-testable) — the control is available **only when
ALL** of the following hold; otherwise **fail closed** (return false):

1. **Valid internal-native build profile:** `EXPO_PUBLIC_EAS_PROFILE === 'internal-native'`
   **or** (`__DEV__ === true` **and** the internal app identity below). A generic dev / preview /
   TestFlight / non-production build does **not** qualify on its own.
2. **Internal app variant:** `EXPO_PUBLIC_APP_VARIANT === 'internal'`.
3. **Internal-preview marker:** `EXPO_PUBLIC_INTERNAL_PREVIEW === 'true'`.
4. **Demo mode:** `DEMO_MODE === true`.
5. **Non-production application identifier:** `Application.applicationId !== 'com.aforce.os'`.
6. **Expected internal bundle identifier:** `Application.applicationId === 'com.aforce.os.internal'`.
7. **Sanctioned Night Out access check:** the "Open Night Out" navigation is offered only after
   `isNightOutEnabled(flags, nightOutInternalPreviewContext())` returns true post-enable.

Explicitly: local dev qualifies only with the internal app identity + every marker (1–6); a named
`internal-native` distribution qualifies only with the internal app identity + every marker.
**Environment variables are build selectors, not authorization credentials** — items 5–6 (build
identity) and 7 (sanctioned runtime access) are the real gates; the env markers only select which
build compiled the module in.

## 4. Enabler + reset — via sanctioned APIs only

- **Enable:** the control calls a thin companion service `enableEvidenceMode({ flags, setFeatureFlags })`
  in the internal-preview module, which calls the **sanctioned** `enableNightOutForInternalPreview(flags)`
  and applies the result through the store's `setFeatureFlags`. The UI does not call `setFeatureFlags`
  directly — it calls the service; the service composes the sanctioned transformer + the store API.
- **Reset:** the sanctioned module has **no disable API today** (verified: `access.ts` exports only
  `enableNightOutForInternalPreview`). Per the founder rule, add a **sanctioned counterpart**
  `disableNightOutForInternalPreview(flags) => ({ ...flags, night_out_enabled: false })` **in
  `access.ts`** (the authorization module — the correct home for both enable + disable, kept out of
  presentation/business logic), with its own unit test. The companion service exposes
  `disableEvidenceMode(...)` composing it + `setFeatureFlags`. No convenience flag mutation is invented
  anywhere else. (This is the only edit to a NO-c feature file — a small, tested addition to the
  sanctioned auth service; flagged for review.)

## 5. Expanded isolation test plan (all 12 required)

| # | Assertion | How |
|---|---|---|
| 1 | Internal route absent from the **production route manifest** | committed `app/` has no `internal-preview.tsx`; expo-router context over `app/` yields no such route |
| 2 | Internal control module absent from the **production Metro bundle graph** | CI: bundle in `production` variant; assert the internal module path is not in the graph |
| 3 | Production **source maps** contain no internal-preview control strings/paths | CI: grep the prod source maps for `internal-preview` / `NightOutEvidenceMode` → none |
| 4 | Production build cannot resolve/navigate to `/internal-preview` | route absent + Metro blockList; nav to it → not-found |
| 5 | A build with **only** `EXPO_PUBLIC_INTERNAL_PREVIEW=true` fails closed | pure gate returns false when variant/DEMO/identity markers absent |
| 6 | A build using `com.aforce.os` fails closed **regardless of every env marker** | gate false when `applicationId === 'com.aforce.os'` even if all env markers set |
| 7 | Internal bundle id but **missing the named internal profile** fails closed | gate false when `EXPO_PUBLIC_EAS_PROFILE !== 'internal-native'` and not `__DEV__`+internal-identity |
| 8 | **Contradictory config → build-time failure**, not runtime fallback | `app.config.ts` throws on contradictions (unit-test the config resolver) |
| 9 | The control calls **only** the sanctioned enabler/disabler | render/spy test: enable→`enableNightOutForInternalPreview`; disable→`disableNightOutForInternalPreview`; no direct `night_out_enabled` write in the control |
| 10 | The existing Night Out **route guard is unchanged** | byte-diff `app/night-out.tsx` vs the NO-c version |
| 11 | `flags.ts` remains **byte-unchanged** | byte-diff |
| 12 | Internal module unreachable via URL/deep-link/AsyncStorage/remote/ordinary settings | grep + gate tests: no such enablement path |

(#2/#3 are CI/build-step checks that bundle in production mode; the always-run unit proxy is "no
shipping source imports `internal-preview/`".)

## 6. File-level design (v2)

| Path | Kind | Notes |
|---|---|---|
| `internal-preview/internalGate.ts` | new, pure | the §3 predicate (unit-tested) |
| `internal-preview/evidenceModeService.ts` | new | `enableEvidenceMode`/`disableEvidenceMode` composing sanctioned access + `setFeatureFlags` |
| `internal-preview/NightOutEvidenceModeControl.tsx` | new | the internal control UI (banner, enable/reset, Open-Night-Out post-check) |
| `internal-preview/internalPreviewRoute.tsx` | new | route component; **injected** into `app/` only for internal builds |
| `scripts/inject-internal-preview.mjs` | new | variant-gated prebuild injector; copies the route into `app/` for `internal` only |
| `app.config.ts` | new (**founder-gated**) | deterministic per-variant identity; fail-closed |
| `metro.config.js` | edit (**founder-gated**) | production blockList belt for `internal-preview/` |
| `eas.json` | edit (**founder-gated**) | `internal-native` profile + prebuild hook |
| `.gitignore` | edit | ignore generated `app/internal-preview.tsx` |
| `services/nightOut/access.ts` | edit (small, tested) | add sanctioned `disableNightOutForInternalPreview` |
| `internal-preview/__tests__/*` + `services/nightOut/__tests__/internalPreviewIsolation.test.ts` | new | the 12 assertions |

**No edits** to `flags.ts`, `app/night-out.tsx`, `NightOutCommandView.tsx`,
`NightOutCommandScreen.tsx`, or any scoring/session code (the one exception is the tested sanctioned
`disable` added alongside `enable` in `access.ts`).

## 7. Repository discipline (unchanged, approved)
- Separate branch + separate **draft** PR #450, base `feat/night-out-no-c` (isolated diff). Not added
  to PR #449. Both PRs stay draft; neither merges without explicit approval.
- The PR states plainly: **internal validation infrastructure; not intended to merge into a production
  release unless the build-profile isolation is independently approved.**
- `eas.json` / `app.config.ts` / `metro.config.js` are **founder-gated** — proposed here, applied only
  on explicit per-edit authorization.

## 8. After design approval (implementation → native evidence)
Implement per §1–§6 (behind approval) + the 12 tests; run focused + full + tsc; produce/install the
`internal-native` iOS build; render Night Out via the control; run the §27 native protocol (9 states ×
device/text/motion configs). **A human records the final VoiceOver pass** on the simulator/device
(accepted manual acceptance gate). Attach evidence to PR #449; apply only native-discovered defects.
Stop for founder review. Do not un-draft/merge/begin NO-d without explicit approval.

## 9. Stop condition (design v2)
Design-only update. No implementation. Stop for founder approval of this revised design.
