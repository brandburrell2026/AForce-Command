# NO-c Native-Evidence Run — Build-Infrastructure Proof + Operator Protocol

Records the founder-authorized native-evidence protocol for the NO-c internal-preview
enabler (draft PR #450) and the Tier-3 Night Out native evidence (draft PR #449).

- Commit under test: `db1a275d` (branch `NO-c-native-evidence-enabler`, off `feat/night-out-no-c`).
- Machine-verifiable steps (§1–§3) were executed in the repo and are recorded below with
  exact commands, artifact paths, and results.
- The native-device steps (§4–§8) require an iOS simulator/device and a human operator
  and are provided as an **operator protocol** (see Part B). They are **not** marked complete.

---

## PART A — Machine-verifiable evidence (executed)

### §1 · Resolved Expo config — both profiles

Command (per profile), run from `artifacts/aforce-os`:

```
# production
EXPO_NO_TELEMETRY=1 CI=1 EAS_BUILD_PROFILE=production \
  node node_modules/@expo/cli/build/bin/cli config --json --type public
# internal-native
EXPO_NO_TELEMETRY=1 CI=1 EAS_BUILD_PROFILE=internal-native APP_PROFILE=internal-native \
  EXPO_PUBLIC_APP_VARIANT=internal EXPO_PUBLIC_INTERNAL_PREVIEW=true EXPO_PUBLIC_DEMO_MODE=true \
  node node_modules/@expo/cli/build/bin/cli config --json --type public
```

| Field | Production (resolved) | Internal-native (resolved) |
|---|---|---|
| `name` | `AForce OS` | `AForce OS Internal` |
| `scheme` | `aforce-os` | `aforce-os-internal` |
| `ios.bundleIdentifier` | `com.aforce.os` | `com.aforce.os.internal` |
| `extra.appVariant` | `production` | `internal` |
| profile selector | `production` | `internal-native` |
| internal preview | disabled (marker unset) | enabled (`EXPO_PUBLIC_INTERNAL_PREVIEW=true`) |
| demo mode | not set → `DEMO_MODE=false` | `EXPO_PUBLIC_DEMO_MODE=true` |
| generated `app/internal-preview.tsx` after resolve | **ABSENT** | **PRESENT** (before route discovery) |
| internal scheme/labels/route in production | none | n/a |

Both profiles resolve deterministically and non-contradictorily. Production carries **no**
internal identity, scheme, marker, or route. Result: **PASS.**

### §2 · Deterministic route lifecycle (driven through the real `app.config.ts`)

Each transition below was produced by an actual `expo config` run for the given profile,
which invokes `syncInternalPreviewRoute` inside `app.config.ts`.

| Step | Action | Expected | Observed |
|---|---|---|---|
| 1 | clean production sync | route ABSENT | ABSENT ✓ |
| 2 | internal-native sync | route CREATED, generated header present, content == approved source | PRESENT, header present, content matches ✓ |
| 3 | repeat internal sync | identical output (idempotent) | identical sha `193f80d6…` ✓ |
| 4 | production sync immediately after | stale route DELETED + absence verified | ABSENT ✓ |
| 5 | dirty workspace: plant a **modified** fake generated route, then production sync | tampered route DELETED, verification passes, nothing tracked/staged | ABSENT; `git status` empty; not tracked by git ✓ |

`.gitignore` was **not** relied on as the boundary — the sync/delete + verify in
`routeSync.mjs` is. Result: **PASS.**

### §3 · Compiled production-exclusion (real Metro export + source map)

Command (from `artifacts/aforce-os`, using the app-local CLI so pnpm resolves `expo`):

```
EXPO_NO_TELEMETRY=1 CI=1 EAS_BUILD_PROFILE=production \
  node node_modules/@expo/cli/build/bin/cli export --platform ios --source-maps \
  --output-dir <out>/dist-prod
```

Artifacts produced:
- bundle: `_expo/static/js/ios/entry-8c288dc060877d8ae7d7d3ecca50acd4.hbc` (7.68 MB, Hermes)
- source map: `…/entry-8c288dc060877d8ae7d7d3ecca50acd4.hbc.map` (21.8 MB)
- `metadata.json`

**Source-map module inventory:** 4316 modules. Modules whose *path* matches
`internal-preview` / `internalPreview` / `internal-native`: **0**. Generated route module
`app/internal-preview.tsx`: **NONE**.

**Production bundle (`.hbc`) string scan — all `0`:**

| Target | Count |
|---|---|
| `INTERNAL BUILD — NOT FOR PRODUCTION` | 0 |
| `NightOutEvidenceModeControl` | 0 |
| `night-out-evidence-control` (testID) | 0 |
| `internal-preview` | 0 |
| `/internal-preview` (route path) | 0 |
| `aforce-os-internal` (scheme) | 0 |
| `AForce OS Internal` (name) | 0 |

**Route manifest:** no `/internal-preview` route is registered in any exported artifact.

**Two honest, expected, inert findings — NOT isolation failures:**

1. The substring `internal-preview` appears in the source map only inside the **prose
   comments** embedded in five *legitimately-shipping* modules — `featureFlags/flags.ts`,
   `components/profile/ProfileScreenV2.tsx`, `components/nightOut/NightOutProtocolEntry.tsx`,
   `services/nightOut/access.ts`, `app/night-out.tsx` — where they document the restricted
   internal-preview access model. **No internal UI module, generated route, or control**
   appears. The founder's stated fail condition ("source map contains internal UI modules")
   does not occur.
2. `enableNightOutForInternalPreview` / `disableNightOutForInternalPreview` each appear once
   in the `.hbc` because they are defined in the shipping sanctioned service
   `services/nightOut/access.ts`. They are **inert** in production: no internal control
   module exists to invoke them (the entire `internal-preview/` tree is absent), and
   `isNightOutEnabled` additionally requires the internal-preview env context that a
   production build cannot satisfy, with the restricted-flag clamp forcing
   `night_out_enabled=false` on the generic unlock path.

Result: **PASS** — no internal UI module, control, banner, testID, route path, internal
scheme, or internal name is present in the production bundle, source map, or manifest.

---

## PART B — Native-device protocol (operator handoff — NOT executed here)

This headless CLI environment has no iOS simulator/device that can be driven and no native
screenshot or VoiceOver capability. Per the standing honesty rule, §4–§8 are **not** marked
complete and are handed off as an operator protocol to run on a Mac with Xcode + a device.
No native screenshot or VoiceOver observation is claimed by automation.

### §4 · Build the authorized internal-native app
```
# From artifacts/aforce-os — EAS internal-native profile ONLY:
eas build --profile internal-native --platform ios
# (or a local dev-client run of the same profile)
```
Before install, verify the app identity is: bundle id `com.aforce.os.internal`; visibly named
**AForce OS Internal**; distinguishable from production; internal + demo markers present.
**Do not install a build reporting `com.aforce.os`.** Record: build profile, build ID / local
artifact path, commit SHA `db1a275d`, resolved Expo config (Part A §1 internal column), iOS
version, simulator/device model.

### §5 · Exercise the internal evidence control (record screenshots / screen recording)
1. Permanent "INTERNAL BUILD — NOT FOR PRODUCTION" warning visible on launch.
2. Night Out initially **unauthorized**.
3. Activate sanctioned evidence mode (ENABLE).
4. Control reports successful authorization.
5. "Open Night Out" appears **only after** the normal access check passes.
6. Open Night Out through the ordinary **guarded** route.
7. Use the sanctioned **disable** action.
8. Access removed.
9. Re-enable only as needed for the evidence protocol.

### §6 · Native visual matrix (nine states) — per §27 coverage
States: eligible idle · accepted active command · restored active command · nearing expiry ·
stale/low-confidence · pre-acceptance Adjust · expired/reassessing · completed ·
unauthorized route behavior.

Coverage: all 9 on a representative standard iPhone; highest-risk states on the smallest and
largest supported iPhone; active/restored/Adjust/stale at max supported text scale; an
animated active state with Reduce Motion ON. For each artifact record: fixture/state, device,
iOS version, viewport, text-size, Reduce-Motion state, build profile + commit, pass/fail,
observed defect.

### §7 · Native acceptance checks
Accepted vs restored amounts identical · no clipped title/amount/instruction/status/
confidence/freshness/CTA · primary CTA above safe area + home indicator · no overlap with
nav/keyboard/dynamic island/cutout · Adjust usable with keyboard visible · one dominant CTA
per state · status meaning not color-dependent · Signal Red never positive · reduced motion
suppresses nonessential motion · unauthorized navigation still redirects via the unchanged
production guard. Fix only demonstrated acceptance defects (narrowest fix, correct PR), not
cosmetic preferences.

### §8 · Human VoiceOver gate (must be a human operator)
Record: initial focus · reading order · HydroState name/value · status announcement · primary
CTA name/role/state/hint · secondary action names/roles/states · decorative redundant focus
stops · understandable without color · any missing/duplicated/vague/misleading announcement.
**VoiceOver completion may not be claimed from DOM tests or automated inspection.**

---

## Stop condition
Machine steps §1–§3 complete and recorded. Native steps §4–§8 await an operator run. Both PRs
remain **draft**; nothing merged; NO-d not started. Awaiting founder direction on who runs the
native pass.
