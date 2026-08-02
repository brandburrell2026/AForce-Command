# NO-c Native Evidence Enabler — DESIGN (for review before implementation)

**Status:** Design proposal · **DESIGN-ONLY commit — no implementation yet** · Owner: Julius + Brandon
**Branch:** `NO-c-native-evidence-enabler` (off `feat/night-out-no-c`) · **Draft PR** (isolated diff).
**Purpose:** validation infrastructure ONLY — a non-production internal-preview entry that calls the
existing sanctioned `enableNightOutForInternalPreview` so an authorized operator can render Night Out
in a **native internal build** to capture the Tier-3 evidence (spec §27). **Not a consumer feature;
must not weaken the production authorization model.**

> Per founder instruction: this PR records the proposed **file-level design, build safeguards, and
> test plan** only. Implementation begins **after** this design is approved.

---

## 1. Mandatory-architecture compliance (how each rule is met)

| # | Rule | How the design satisfies it |
|---|---|---|
| 1 | Don't edit `night_out_enabled` default | `flags.ts` untouched; default stays `false`. A test asserts `flags.ts` is byte-unchanged. |
| 2 | Don't weaken/bypass the route guard | `app/night-out.tsx` untouched; the enabler flips the flag via the sanctioned function, then the **existing** `isNightOutEnabled(flags, DEMO context)` guard still decides render. |
| 3 | No URL/deep-link/AsyncStorage/remote/ordinary-dev-menu/gesture enablement | The control is not a URL param, not persisted, not a remote value, not in the ordinary Developer tab; it exists only in the internal build and requires an explicit button. Tests assert none of these paths enable the flag. |
| 4 | Not exposed in prod / preview-web / TestFlight-prod / App Store | Gated by a compile-time env marker + build identity; statically dead-code-eliminated from non-internal bundles (see §3). |
| 5 | Compiled only when all internal-build conditions are true | `isInternalEvidenceBuild()` requires **all** of: `EXPO_PUBLIC_INTERNAL_PREVIEW==='true'` + `EXPO_PUBLIC_APP_VARIANT==='internal'` + `DEMO_MODE===true` + (`__DEV__===true` or approved internal distribution) + `Application.applicationId !== 'com.aforce.os'` (production id). |
| 6 | Call the sanctioned enabler, not duplicate auth state | The control calls `enableNightOutForInternalPreview(flags)` (from `services/nightOut/access.ts`) and applies it via `setFeatureFlags`. It never sets `night_out_enabled` directly. |
| 7 | Authorization stays constrained by `DEMO_MODE` + access checks | Even after the flag flips, `/night-out` renders only if `isNightOutEnabled(flags, nightOutInternalPreviewContext())` passes (flag **AND** `DEMO_MODE`). Two independent layers. |
| 8 | Enablement separate from Night Out presentation/business logic | New `components/nightOut/internalPreview/*` + `services/nightOut/internalPreview.ts`; the presentation component (`NightOutCommandView`) and business logic are untouched. |

## 2. File-level design (new files only; no edits to NO-c feature code except one guarded mount)

| File | Responsibility |
|---|---|
| `services/nightOut/internalPreview.ts` (new) | **Pure** `isInternalEvidenceBuild(env, opts)` — the multi-factor build-identity gate (see §3), unit-testable. Plus a thin runtime wrapper reading `process.env` + `__DEV__` + `expo-application` `applicationId`. No RN/UI imports. |
| `components/nightOut/internalPreview/NightOutEvidenceModeControl.tsx` (new) | The internal-only control UI (see §4). Renders **null** unless `isInternalEvidenceBuild()`. Calls `enableNightOutForInternalPreview` via `setFeatureFlags`; shows auth result; offers a link to `/night-out` only after the sanctioned access check passes; offers reset (flag→false). |
| `app/internal-preview.tsx` (new) | The route surface. Its default export returns `<Redirect href="/(tabs)/protocol" />` unless the compile-time env guard passes; the control is imported **behind** `process.env.EXPO_PUBLIC_INTERNAL_PREVIEW === 'true'` via a guarded `require`, so Metro dead-code-eliminates the control from non-internal bundles (satisfies #4/#8). The route file itself is tiny + inert in production. |
| `eas.json` + `app.json` (proposed, **founder-gated**) | A new `internal-native` EAS profile: `EXPO_PUBLIC_INTERNAL_PREVIEW=true`, `EXPO_PUBLIC_APP_VARIANT=internal`, `EXPO_PUBLIC_DEMO_MODE=true`, a **distinct** `ios.bundleIdentifier` (`com.aforce.os.internal`) + app name ("AForce OS Internal"). **`eas.json` is flag-first — I will not edit it without explicit per-edit founder authorization** (project memory). Proposed only. |
| `services/nightOut/__tests__/internalPreviewIsolation.test.ts` (new) | The 8 isolation assertions (§5). |
| `components/nightOut/__tests__/nightOutEvidenceControl.render.test.tsx` (new) | Renders the control under the internal marker (proves the gate + it renders the label + calls the sanctioned enabler), and renders **nothing** without the marker. |

**No edits** to `flags.ts`, `app/night-out.tsx`, `access.ts`, `NightOutCommandView.tsx`,
`NightOutCommandScreen.tsx`, or any scoring/session code.

## 3. Build safeguards (multi-layer; not env alone)

`isInternalEvidenceBuild()` returns true **only when ALL** hold:
1. `EXPO_PUBLIC_INTERNAL_PREVIEW === 'true'` — compile-time marker #1 (Metro-inlined → DCE lever).
2. `EXPO_PUBLIC_APP_VARIANT === 'internal'` — compile-time marker #2 (independent).
3. `DEMO_MODE === true` — existing internal/demo context (already required by `isNightOutEnabled`).
4. `__DEV__ === true` **or** an approved internal distribution profile marker.
5. **Build identity:** `Application.applicationId !== 'com.aforce.os'` (the production bundle id) —
   a real build-identity safeguard beyond env vars (uses `expo-application`, resolvable).

The route's guarded `require` uses `process.env.EXPO_PUBLIC_INTERNAL_PREVIEW === 'true'` so the control
module is **statically excluded** from production/preview-web/App-Store bundles (Metro DCE) — #8.

## 4. Internal control UX (`NightOutEvidenceModeControl`)
- Prominent banner: **"INTERNAL BUILD — NOT FOR PRODUCTION"**.
- Title: **"Internal Preview → Enable Night Out Evidence Mode"**.
- Explicit **[Enable Night Out Evidence Mode]** button → `setFeatureFlags(enableNightOutForInternalPreview(flags))`.
- Shows authorization result: "Authorized ✓ / Not authorized" from `isNightOutEnabled(flags, ctx)`.
- **[Open Night Out]** link (`router.push('/night-out')`) — shown **only after** the access check passes.
- **[Disable / Reset]** → `setFeatureFlags({ ...flags, night_out_enabled: false })`.
- Rendered only inside `isInternalEvidenceBuild()`; **not** in ordinary consumer settings/navigation.

## 5. Isolation test plan (8 required assertions)
1. `isInternalEvidenceBuild` is **false** when any marker is missing (env #1/#2, `DEMO_MODE`, `__DEV__`).
2. **false** for the production bundle identifier (`com.aforce.os`).
3. The control **cannot** call the enabler unless `DEMO_MODE` + all internal conditions hold (render test: no marker → renders null → no enabler call).
4. **No** URL param / route param / AsyncStorage value / remote payload / ordinary client setting enables Night Out (grep shipping code; extends `bundleIsolation.test.ts`).
5. Production navigation does not import/register the control — the app-route imports it only behind the `process.env.EXPO_PUBLIC_INTERNAL_PREVIEW` guard; no always-on nav imports it.
6. The `/night-out` route guard is **unchanged** (byte diff assertion vs the NO-c version).
7. `flags.ts` is **unchanged** (byte diff assertion).
8. Production bundle graph **excludes** the control where statically provable — assert the control is required behind the env guard (not a static top-level import) in `app/internal-preview.tsx`.

## 6. Repository discipline
- Separate branch (`NO-c-native-evidence-enabler`) + separate **draft** PR, base = `feat/night-out-no-c`
  so the diff is the enabler alone (independently auditable). Not added to PR #449.
- The PR states plainly: **internal validation infrastructure; not intended to merge into a production
  release unless the build-profile isolation is independently approved.**
- `eas.json`/`app.json` build-profile edits are **founder-gated** — proposed here, applied only on
  explicit per-edit authorization.
- Neither PR merges without explicit approval.

## 7. After design approval (implementation → native evidence)
1. Implement per §2 (behind approval), add the §5 tests, run focused + full suites + tsc.
2. Produce/install the authorized internal iOS build (`internal-native` profile).
3. Operator renders Night Out via the control and runs the §27 native protocol: 9 states × device/
   text/motion configs.
4. **Human VoiceOver pass** (must be recorded by a person on the simulator/device — accepted manual
   acceptance gate).
5. Attach evidence to PR #449 (device, iOS version, build profile, text size, reduced-motion, fixture/
   state, pass/fail). Apply only native-discovered defects; rerun tests on any code change.
6. Stop for founder review. Do not un-draft/merge/begin NO-d without explicit approval.

**Division of labor (founder ruling):** Claude owns implementation, build preparation, fixtures, and
the evidence checklist; the **final VoiceOver observations are recorded by a human** operator. That is
an accepted manual acceptance gate, not an engineering failure.
