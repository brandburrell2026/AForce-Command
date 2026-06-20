---
name: AForce OS Cruise vertical gating (consumer-exposure audit)
description: Why the legacy Cruise screen is NOT truly hidden — FeatureGate is a self-serve upsell not a security boundary, the flag defaults open, and the Modules launcher is ungated. The newer hidden sub-app is the correct pattern.
---

# AForce OS — "Cruise" hidden-vertical gating

Requirement: Cruise must be hidden behind a flag, ENTERPRISE-ONLY (founders / developers /
authorized cruise clients), NEVER exposed to consumers. Current state: the newer hidden
sub-app complies; the LEGACY screen does NOT.

## The non-obvious trap: FeatureGate is an UPSELL, not a security gate
`components/FeatureGate.tsx`: when the flag is OFF it does NOT block — it renders a
"DEMO LOCKED" card with an **"Activate Demo" button whose onPress flips the flag ON for
the user** (`setFeatureFlags({ ...flags, [flag]: true })`). So any flag wrapped only in
FeatureGate is one tap from activation by anyone, even a consumer. **Lesson:** to truly
hide an enterprise surface, use the fail-closed `<Redirect>` pattern, NOT FeatureGate.

## Two Cruise layers, opposite postures
- **Legacy (EXPOSED):** route `app/cruise.tsx` → `screens/CruiseModeScreen.tsx`, gated only
  by `<FeatureGate flag="cruise_mode_enabled">`. `cruise_mode_enabled` defaults **true** in
  `DEFAULT_FLAGS`, and the store seeds `featureFlags: DEFAULT_FLAGS` with no __DEV__/prod
  override — so it renders by default. (The "build flips it before public release" comment is
  a manual, easily-missed step.)
- **Hidden sub-app (CORRECT):** `app/(hidden)/cruise/*` (journey/port/pre-port/excursion/
  recovery) gated by `spec_cruise` which defaults **false** + a hard `<Redirect href="/">`
  in `_layout.tsx`. Fail-closed. This is the pattern the legacy screen should adopt.

## Consumer-reachable entry points (no identity gate anywhere)
- `app/modules.tsx` ("Modules", reached from Profile → Modules) is a VISIBLE launcher open to
  ANY user; it lists Cruise → `/cruise` with NO gate tag (vs Recovery which is tagged
  "Flag-gated · spec_cruise"). So Profile → Modules → Cruise reaches the legacy screen.
- Deep link `/cruise` also reaches it.
- "Developer Mode" (`services/devMode.ts`) is just a local AsyncStorage boolean any user can
  toggle — not an identity check. There is NO founder/enterprise/role/email gate in the app
  (grep: only `spec_enterprise:false` in a test fixture).

## Server side
`artifacts/api-server/src/routes/cruise.ts` (`/cruise/ports`, `/cruise/environment`) has NO
auth/entitlement middleware — fully public. Low-sensitivity (port list + OpenWeather proxy),
but still ungated; real enterprise gating would enforce here too.

## Why a one-line flag flip is INSUFFICIENT
Flipping `cruise_mode_enabled` → false alone does NOT close exposure, because FeatureGate
then shows the self-serve "Activate Demo" button. Real fix is layered: (1) migrate legacy
Cruise behind the `spec_cruise` Redirect pattern (drop FeatureGate for it), (2) gate/remove
its Modules entry, (3) add an actual enterprise identity/entitlement model (defining
"authorized cruise client" is a product decision), (4) gate the API routes. Items 3-4 are
major + need owner product decisions → report and ask, don't bolt on.

## Test note
`store/__tests__/_fixtures.ts` already sets `cruise_mode_enabled: false`, so a default flip
would match the fixture (won't break that test).
