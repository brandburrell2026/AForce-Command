---
name: AForce privacy / legal surfaces
description: Where the public drinkaforce.com legal pages live and which of the diverging privacy docs is authoritative.
---

# AForce privacy / legal surfaces

The public marketing site `artifacts/aforce-site` (React + Vite + **wouter** SPA, static
build with `/* → /index.html` rewrites, **no auth/Clerk gate anywhere**) is what serves
`https://www.drinkaforce.com`. Adding a new public page = add a page component under
`src/pages/` and one `<Route>` in `src/App.tsx`. The wouter base is `BASE_URL` so a route
`/privacy` is `/aforce-site/privacy` in dev preview but `/privacy` in production.

**Per-route canonical/title:** the SPA shares one `index.html`, so set canonical/title
client-side via a `useEffect` in the page (create-or-reuse `link[rel="canonical"]`, restore
on cleanup). Fonts for legal pages (Archivo Black, IBM Plex Mono) had to be added to
`index.html` — the site otherwise ships Inter/Outfit/Space Mono only.

## Three diverging privacy docs — pick the right source
There are **three** privacy surfaces and they do NOT match; do not assume "mirror the
in-app screen" means copy the thin one:
- `artifacts/aforce-os/app/legal/privacy.tsx` — thin in-app starter draft. Children **16**,
  but NO CCPA/GDPR, NO health-not-for-advertising disclaimer, contact = `privacy@aforce.com`.
- `artifacts/aforce-os/legal/privacy-policy.md` — fuller compliance-grade text (HealthKit
  **never for advertising**, CCPA/CPRA, GDPR/UK GDPR, retention). But children **13** and a
  placeholder mailing address; contact = `privacy@drinkaforce.com`.
- `artifacts/aforce-site/src/pages/Privacy.tsx` — the public drinkaforce.com page. Sources
  compliance language from the `.md`, keeps children **16**, and uses the real owner contact
  block (AForce Hydration, 535 Fifth Avenue 4th Floor #1004, NY 10017, `bburrell@alkalineforce.com`).

**Why:** App Store / HealthKit review requires the explicit "health data is never used for
advertising/tracking and never shared with third parties for advertising" statement plus
CCPA/GDPR rights — the thin in-app `privacy.tsx` cannot satisfy that on its own.
**How to apply:** when editing public legal copy, treat the `.md` as the legal source of
truth and the public `Privacy.tsx` as canonical for the live site; the three are NOT kept in
sync automatically — changing one does not change the others.
