# AForce OS — TestFlight Submit Checklist

A step-by-step runbook for getting an internal beta build of AForce OS into TestFlight for the team. Estimated total time on a fresh setup: **3–6 hours** (most of it waiting on Apple).

---

## Phase 0 — Prerequisites (do once)

### 0.1 Apple Developer Program
- [ ] Enroll at https://developer.apple.com/programs/ ($99/yr individual, ~$299/yr organization).
- [ ] Wait for approval (usually same-day for individuals, up to a few business days for organizations).
- [ ] Confirm enrollment is active in [App Store Connect](https://appstoreconnect.apple.com/).

### 0.2 Expo / EAS account
- [ ] Sign up at https://expo.dev/signup if you don't have one.
- [ ] On your local machine: `npm install -g eas-cli`
- [ ] `eas login` and confirm with `eas whoami`.

### 0.3 Privacy policy live at a real URL
- [ ] Take `legal/privacy-policy.md`, fill in the mailing address and any TBD fields.
- [ ] Have it reviewed by counsel (HealthKit + CCPA + GDPR).
- [ ] Publish at a stable URL, e.g. `https://drinkaforce.com/privacy`. (A Notion public page or a static HTML file works for beta; you'll need a real domain page for App Store production.)
- [ ] Save the URL — you'll paste it into App Store Connect.

---

## Phase 1 — App Store Connect setup (do once)

### 1.1 Create the app record
- [ ] Go to App Store Connect → **My Apps** → **+** → **New App**.
- [ ] Platform: **iOS**
- [ ] Name: **AForce OS** (must be unique on the App Store)
- [ ] Primary Language: English (U.S.)
- [ ] Bundle ID: `com.aforce.os` — if it doesn't appear in the dropdown, register it first at developer.apple.com → **Certificates, Identifiers & Profiles** → **Identifiers** → **+**.
- [ ] SKU: `AFORCE-OS-001` (any unique string)
- [ ] User Access: **Full Access**
- [ ] Click **Create**.

### 1.2 Fill in App Information
- [ ] **Privacy Policy URL** → paste the URL from 0.3
- [ ] **Category** → Primary: Health & Fitness; Secondary: Lifestyle (or your choice)
- [ ] **Content Rights** → declare whether the app contains third-party content
- [ ] **Age Rating** → walk through the questionnaire (likely 4+)

### 1.3 App Privacy questionnaire (App Store Connect → App Privacy)
This is required before TestFlight external testing and before App Store submission. For internal-only TestFlight you can defer it, but it's faster to do it now.

Declare data collection for:
- [ ] **Health & Fitness** — used for App Functionality, **not** linked to user identity if you keep it client-side; linked if you sync to your backend
- [ ] **Contact Info → Email** — used for App Functionality (auth)
- [ ] **Identifiers → User ID** — used for App Functionality
- [ ] **Usage Data → Product Interaction** — used for Analytics
- [ ] **Diagnostics → Crash Data, Performance Data** — used for App Functionality

For each category, confirm: data is **not used for tracking** and **not shared with third parties for advertising**.

---

## Phase 2 — Pre-build sanity checks

Run these before every build.

- [ ] `pnpm --filter @workspace/aforce-os run typecheck` passes
- [ ] `app.json` `version` is correct (currently `1.0.0`)
- [ ] `app.json` `ios.bundleIdentifier` is `com.aforce.os` and matches App Store Connect
- [ ] All `infoPlist` permission strings read like a human wrote them (Apple rejects placeholder text)
- [ ] App icon at `assets/images/icon.png` is **1024 × 1024 PNG, no transparency, no alpha channel** (Apple's hard requirement)
- [ ] Smoke-test on a real iPhone: sign in, log a drink, scan a barcode, grant HealthKit, view recovery score, sign out. Simulator does **not** support HealthKit, so a physical device is required.
- [ ] No `console.log` of secrets, no hard-coded test API keys, `EXPO_PUBLIC_*` env vars set for production
- [ ] Backend (api-server) is deployed and reachable from a non-Replit network

---

## Phase 3 — Build with EAS

From the repo root.

### 3.1 First-time only: configure credentials
- [ ] `cd artifacts/aforce-os`
- [ ] `eas build:configure` — confirms `eas.json` (already present) and links to your Expo project
- [ ] `eas credentials` → iOS → **Set up a new distribution certificate**. EAS can manage certificates and provisioning profiles for you; say yes.

### 3.2 Build for TestFlight
- [ ] `eas build --profile production --platform ios`
- [ ] Wait ~15–30 minutes for the build to finish on EAS's macOS workers
- [ ] Build artifact (`.ipa`) appears in your Expo dashboard

The `production` profile in `eas.json` is the right one for TestFlight — `distribution` defaults to "store" (App Store Connect), which is what TestFlight reads from. The `preview` profile (`distribution: internal`) is only for ad-hoc IPAs you sideload outside TestFlight.

---

## Phase 4 — Submit to TestFlight

### 4.1 Upload
- [ ] `eas submit --profile production --platform ios`
- [ ] Pick the build from the previous step
- [ ] Provide your Apple ID and an [app-specific password](https://account.apple.com/account/manage) (or use API key — recommended for CI)
- [ ] Wait for upload + Apple's processing (~15–60 minutes; you'll get an email)

### 4.2 Configure the TestFlight build (App Store Connect → TestFlight tab)

- [ ] Once Apple finishes processing, the build appears under **iOS Builds**
- [ ] Click the build → fill in **Test Information**:
  - **What to Test:** "First internal build of AForce OS. Please test: sign-in, hydration logging, barcode scan, HealthKit grant flow, recovery score, sign-out. Report bugs to bburrell@alkalineforce.com."
  - **Beta App Description:** short paragraph from the pitch deck
  - **Email:** bburrell@alkalineforce.com
  - **Privacy Policy URL:** same as in Phase 1.2
- [ ] **Export Compliance:** answer the encryption question. AForce OS uses standard HTTPS only → choose **"Uses standard encryption exempt from export compliance"** (ITSAppUsesNonExemptEncryption = false).

### 4.3 Add internal testers (no Apple review needed)
- [ ] App Store Connect → TestFlight → **Internal Testing** → **+** → create a group called "AForce Team"
- [ ] Add team members by email (must have an App Store Connect role on your team — invite them via **Users and Access** first)
- [ ] Enable the build for the group
- [ ] Up to **100 internal testers**, each on up to 30 devices, no Apple review

### 4.4 (Optional) Add external testers (light Apple review)
- [ ] TestFlight → **External Testing** → **+** → create a group like "Friends & Family Beta"
- [ ] Add testers by email — they don't need an App Store Connect account
- [ ] Submit the build for **Beta App Review** (usually 1–2 business days)
- [ ] Apple will check: app launches, HealthKit usage matches the declared purpose, no broken core flows
- [ ] Up to **10,000 external testers**, each build is valid for 90 days

---

## Phase 5 — Iterate

For each new beta build:

- [ ] Bump `ios.buildNumber` in `app.json` (or rely on `appVersionSource: "remote"` in `eas.json`, which auto-increments — already set)
- [ ] `eas build --profile production --platform ios`
- [ ] `eas submit --profile production --platform ios`
- [ ] Update **What to Test** with the changes since the last build
- [ ] Internal testers get the build immediately; external testers get it after Apple's quick re-check (subsequent reviews are usually <24h)

---

## Common gotchas

| Symptom | Fix |
| --- | --- |
| Build fails: "Missing privacy manifest" | Add `app.json` → `ios.privacyManifests` or rely on Expo SDK 54+ defaults; check Expo release notes for your SDK |
| App Store Connect: "Invalid Bundle. The bundle identifier cannot be registered" | Someone else already registered `com.aforce.os`. Pick a new one and update `app.json` |
| TestFlight: "Build is missing compliance" | Export Compliance not answered (Phase 4.2) |
| HealthKit prompt never appears | You're testing in the simulator. Use a real device |
| Crash on launch in TestFlight only | Almost always a missing `EXPO_PUBLIC_*` env var that's set locally but not baked into the production build. Set it in EAS: `eas secret:create` |
| Apple rejects: "Health data used for advertising" | Your privacy policy or App Privacy answers are inconsistent. HealthKit data must never be marketed-as-used for ads |

---

## Useful links

- [EAS Build docs](https://docs.expo.dev/build/introduction/)
- [EAS Submit docs](https://docs.expo.dev/submit/introduction/)
- [TestFlight overview](https://developer.apple.com/testflight/)
- [App Store Connect](https://appstoreconnect.apple.com/)
- [Apple's HealthKit review guidelines](https://developer.apple.com/app-store/review/guidelines/#health-and-health-research)
