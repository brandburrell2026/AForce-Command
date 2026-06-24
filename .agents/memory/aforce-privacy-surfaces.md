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

## Three privacy docs — two now synced, the .md still diverges
There are **three** privacy surfaces. The public web page and the in-app screen are now
mirrored on purpose (same story for App Store privacy review); the `.md` source still differs:
- `artifacts/aforce-site/src/pages/Privacy.tsx` — the public drinkaforce.com page; canonical
  for the live site. Children **16**, full CCPA/CPRA + GDPR/UK GDPR, explicit
  health-not-for-advertising, real owner contact (AForce Hydration, 535 Fifth Avenue 4th Floor
  #1004, NY 10017, `bburrell@alkalineforce.com`).
- `artifacts/aforce-os/app/legal/privacy.tsx` — in-app screen, now **mirrors** the public page
  word-for-word (rendered through the shared `LegalDocumentScreen`; list items are plain-string
  bullets with `\n` since the component renders text-only bodies; contact block goes in the
  `footer` prop — its documented "contact line" slot). Keep it in lockstep with the public page.
- `artifacts/aforce-os/legal/privacy-policy.md` — the fuller legal source the public copy was
  drawn from, BUT it still says children **13** and uses a placeholder mailing address +
  `privacy@drinkaforce.com`. Do NOT blindly copy those two fields from the `.md`.

**Why:** App Store / HealthKit review requires the explicit "health data is never used for
advertising/tracking and never shared with third parties for advertising" statement plus
CCPA/GDPR rights, and Apple expects the hosted page + in-app screen + App Privacy
questionnaire to tell the identical story.
**How to apply:** edit the public `Privacy.tsx` and the in-app `privacy.tsx` together — they
must stay byte-equivalent in meaning. The `.md` is the legal-language source but is stale on
children-age (13 vs 16) and contact; reconcile to children **16** + the alkalineforce.com
contact when in doubt. The shared `LegalDocumentScreen` only accepts `{heading, body:string}`
sections — no rich lists.
