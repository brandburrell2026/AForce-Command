# AForce OS — Investor Demo Readiness

_Last updated: June 22, 2026 · Phase 10 (Investor Demo Overlay) complete._

This is the single-page status for the **60-second investor demo** and the path
from "runs in the room today" to "in testers' hands" to launch. It is a
companion to `docs/TESTFLIGHT_CHECKLIST.md` (the build/submit runbook) — read
that for the step-by-step Apple mechanics.

---

## Ready now (works today, in this build)

- **The 60-second demo plays end-to-end.** Six acts × 10 seconds:
  1. **Opening** — AForce wordmark + "The Performance Operating System."
  2. **Readiness Score** — orb climbs Depleted → Peak, score animates 14 → 97.
  3. **HydroScan** — product recognition (AForce Hydration Stick · OPTIMAL MATCH)
     + the AI Voice Engine speaks "You're back in range. Lock in."
  4. **Social Mode** — BAC safety overlay, crimson ring on the orb.
  5. **Territory + Heat Guard** — stylized map sector + Heat Guard → WARNING.
  6. **The Standard** — clean Peak orb + "Built for people who don't get to be off."
- **Tap anywhere to skip**, or it **auto-dismisses at exactly 60s** and returns
  to the app underneath.
- **Launch path:** Profile → Voice Coach section → **▶ LAUNCH INVESTOR DEMO · 60s**
  (only visible when the demo flag is on — see below).
- **Score-Protection holds:** the overlay is a display-only projection of the
  seeded numbers in `data/demoProfile.ts`. It never awards, mutates, or persists
  score, never reads live user state, and writes nothing to the store.
- **Brand-correct:** AForce brand red (`#C1281B`) + WHOOP recovery state colors.
  No lime / gold (the spec's original gold/lime wording predates the brand
  re-skin and is intentionally superseded).

---

## Done this sprint (Phase 10)

- Replaced the legacy 10-beat voice script with the spec's **6-act, 10s-each**
  cinematic, driven entirely by a single seed (`data/demoProfile.ts`).
- `services/demo/investorDemoBeats.ts` derives the playable schedule
  (cumulative start times, `beatAtMs`, `bandToLevel`, new `scoreToBand` for the
  continuous orb re-tint during the climb).
- Rewrote `components/investorDemo/InvestorDemoOverlay.tsx` into a per-act scene
  switch: opening / readiness / hydroScan / social / territoryHeat / standard,
  with tap-anywhere + 60s auto-dismiss, reanimated orb/voice-halo/scan-line/
  social-ring/progress drivers, and voice on Act 3 only via `commandSpeak`.
- Added the `demo_mode_enabled` feature flag (OFF in `DEFAULT_FLAGS`, ON in
  `DEMO_ALL_ON_FLAGS`) and the pure, fail-closed `shouldShowInvestorDemo(flags,
  active)` helper.
- **Gated both entry points** on the flag: the `_layout.tsx` overlay mount and
  the Profile launcher. Production builds (flag OFF) have no path to the overlay.
- Tests: rewrote `investorDemoBeats.test.ts` for 6 acts and added
  `demoProfile.test.ts` (seed integrity) + `investorDemoGate.test.ts`
  (production-safe / fail-closed gating) — **33 tests, all green**; typecheck clean.
- Small TestFlight fix: declared `ITSAppUsesNonExemptEncryption: false` in
  `app.json` (standard HTTPS only) to avoid the "Build is missing compliance"
  stall on upload.

---

## Before TestFlight (internal beta) — owner / Apple actions

These are **account / credential** tasks, not code. Code side is ready.

- [ ] **Apple Developer Program** enrollment active.
- [ ] **Fill the two iOS submit IDs.** `eas.json` still has placeholders
      (`REPLACE_WITH_APP_STORE_CONNECT_APP_ID`, `REPLACE_WITH_APPLE_TEAM_ID`).
      Use the helper (never hand-edit): from repo root,
      `EAS_ASC_APP_ID=… EAS_APPLE_TEAM_ID=… pnpm --filter @workspace/scripts run eas-configure-submit`.
- [ ] **Privacy policy live at a real URL.** `legal/privacy-policy.md` exists but
      needs the mailing address filled in, counsel review (HealthKit + CCPA +
      GDPR), and publishing at a stable URL for App Store Connect.
- [ ] **Backend reachable from a non-Replit network** (api-server deployed) so a
      real device build can sign in and load state.
- [ ] **`EXPO_PUBLIC_*` production env vars** baked into the EAS build (Clerk
      publishable key, API base URL). Missing ones are the #1 cause of
      TestFlight-only crash-on-launch.
- [ ] Build + submit: `pnpm --filter @workspace/aforce-os run eas:build:ios`
      then `… eas:submit:ios` (see `docs/TESTFLIGHT_CHECKLIST.md`).

**Already green for TestFlight (verified in-repo):**
- `app.json` version `1.0.0`, `ios.bundleIdentifier` `com.aforce.os`, buildNumber set.
- App icon is **1024×1024 PNG, RGB (no alpha)** — Apple's hard requirement.
- All `infoPlist` permission strings are human-written (camera, location, HealthKit r/w).
- `eas.json` has complete development / preview / production profiles.
- Typecheck passes.

---

## Before Miami (October field demo)

- [ ] Run the demo on a **physical iPhone** (not the simulator / web preview) —
      HealthKit, haptics, and the Voice Engine's audio path only fully exercise
      on device.
- [ ] Confirm the **ElevenLabs voice** plays on Act 3 on the venue network
      (Act 3 is the only act that speaks; everything else is silent by design).
- [ ] Pre-flight the venue: airplane-mode fallback. The demo itself is
      self-contained (seeded, no network needed to render), but the Act-3 voice
      uses the ElevenLabs proxy — confirm behavior if Wi-Fi is flaky.
- [ ] Decide the **launch surface** for the room: keep it behind the Profile
      launcher, or wire a faster trigger for the presenter (flag stays the gate).
- [ ] Capture a screen-recording of a clean run as a backup if live demo fails.

---

## Before public launch (January)

- [ ] **`demo_mode_enabled` MUST stay `false`** in the production flag set
      (`DEFAULT_FLAGS`). This is the hard rule — verified by
      `investorDemoGate.test.ts`. The overlay must never ship visible.
- [ ] Full App Privacy questionnaire + age rating in App Store Connect.
- [ ] App Store screenshots from a real device/simulator binary (Replit web
      preview cannot produce submission-grade assets — see `replit.md`).
- [ ] Counsel sign-off on privacy policy + health disclaimer for production.
- [ ] External TestFlight (Beta App Review) pass before broad distribution.

---

## Risk level

**Low (for the demo itself).** The overlay is self-contained, seeded, gated, and
Score-Protection-safe; it cannot leak into production or corrupt user state. The
only runtime dependency is the Act-3 ElevenLabs voice (graceful if it fails to
play — the visuals carry the act).

**The remaining risk is operational, not code:** Apple account setup, the two
submit IDs, a published privacy policy, production env vars in the EAS build, and
a physical-device dry run before any live audience. None block the demo running
in the room today; all block getting it onto a stranger's phone.

---

## Next sprint (suggested, not committed)

- Wire a presenter-friendly trigger (e.g. a long-press affordance) behind the
  same flag for faster on-stage launches.
- Add a reduced-motion variant of the overlay (the rest of the app is
  reduced-motion aware; the demo currently always animates).
- Optional: a short "loop" mode for an unattended booth (auto-replay), still
  flag-gated and still Score-Protection-safe.
