# AForce OS — Canonical Locks (v2.1.0)

**Status:** Authoritative. **Last resolved:** 2026-06-23.

This document exists to end disagreement between spec files. Where `replit.md`,
`AFORCE_FINAL_SPEC.md`, `AForce-OS-Specification.md`, `SPEC-SHEET.md`, and
`design/aforce-design-tokens.md` print conflicting numbers, **this file wins**, and the
code in `theme/statusColor.ts` / `theme/colors.ts` is the implementation of record.

Each lock below states the canonical value, then the stray values it supersedes, so a reviewer
can grep for the old numbers and confirm they've been retired.

---

## Lock 1 — Performance-State Bands (the score system)

**Canonical: five bands**, single source `theme/statusColor.ts`. Color is a signal only
(borders, dots, glows, accents, CTA tint) — never a fill.

| Band | Range | Calm hex | Pressure-mode hex | Meaning |
|------|-------|----------|-------------------|---------|
| OPTIMAL  | 85–100 | `#1FA35A` | `#17C964` | Peak — soft wide glow |
| STABLE   | 70–84  | `#3DBE7A` | `#2BAA66` | Holding — subtle glow |
| DECLINING| 50–69  | `#FFDE00` | `#FFC000` | Slipping — minimal glow |
| RISK     | 30–49  | `#FF8C1A` | `#FF7A00` | Act now — medium glow |
| CRITICAL | 0–29   | `#FF2800` | `#FF0040` | Depleted — tight intense glow |

### Display-label mapping (the 4-band names are labels, not a second system)

The cinematic, orb caption, and demo overlay may surface the legacy four labels.
They are **aliases over the five canonical bands**, never independent ranges:

| Display label | Maps to canonical band(s) |
|---------------|---------------------------|
| PEAK       | OPTIMAL (85–100) |
| BALANCED   | STABLE (70–84) |
| RECOVERING | DECLINING (50–69) + RISK (30–49) |
| DEPLETED   | CRITICAL (0–29) |

**Retired (do not use as range definitions):**
- `PEAK 90–100 / BALANCED 75–89 / RECOVERING 60–74 / DEPLETED 0–59` (old SPEC-SHEET §5)
- Any band table that defines its own ranges instead of referencing this one.

**Rule:** new spec docs reference this table; they do not restate ranges.

---

## Lock 2 — Hero Accent (Signal Red)

**Canonical: Signal Red `#C1281B`** everywhere — thin lines, eyebrows, active states,
CTAs, **tab-bar active tint**, notification accent.

| Token | Value |
|-------|-------|
| `accent.primary` | `#C1281B` |
| `accent.glow`    | `rgba(193,40,27,0.50)` |
| `accent.dim`     | `rgba(193,40,27,0.12)` |
| `accent.subtle`  | `rgba(193,40,27,0.06)` |

**Retired:** `accent.brand #FF3B30` (and `brandGlow/brandDim/brandSubtle`) introduced in the
replit.md Home+Nav override. `#FF3B30` is iOS system red and reads as a platform default.
The tab bar's active tint is **`#C1281B`**, not `#FF3B30`. Delete the `accent.brand*` tokens
or alias them to `accent.primary`.

Pure black `#000000` stays reserved for scrims, drop-shadow color, and `text.inverse` only.
Secondary data accent: Berry blue `#1E5BFF`. Positive status: Soursop green `#1FA35A`.

---

## Lock 3 — Typography

**Canonical: three faces by role.**

| Role | Family |
|------|--------|
| display (hero numerals, wordmarks) | Archivo Black |
| eyebrow / metric (tracked uppercase labels, values) | IBM Plex Mono |
| body (everything else) | Inter (400–800) |

**Retired / to reconcile:** `Bebas Neue` and `DM Sans` appear in the SPEC-SHEET font-asset
appendix but nowhere in the brand system. **Action:** remove them from
`@expo-google-fonts/*` imports and `app.json` unless they are an intentional fallback — in
which case document the fallback chain here. Default stance: remove (dead dependency).

---

## Lock 4 — Brand Mark & App Assets

The N–N "Non-Negotiable" monogram is the hero mark on icon, splash, adaptive icon, favicon:
two heavy geometric N's facing each other (left forward, right mirrored) in **Bone `#F5F0E8`**
with a **Signal Red `#C1281B`** center bar on **Cinematic Black `#0D0D0D`**.

- No green, no gradients on the letterforms, no "AForce OS" text in the mark.
- Generated font-free vector SVG → `rsvg-convert`. **Regenerate from vector — never
  AI-generate** (geometry/colors drift).
- `icon.png` 1024² is RGB, **no alpha channel** (Apple hard requirement).

---

## Lock 5 — Live Launch Blockers (consolidated)

The single place to track what actually stops TestFlight → January launch. These are
**account/credential/content tasks, not code** unless marked.

| # | Blocker | Where | Owner action |
|---|---------|-------|--------------|
| 1 | iOS submit IDs are placeholders (`REPLACE_WITH_APP_STORE_CONNECT_APP_ID`, `REPLACE_WITH_APPLE_TEAM_ID`) | `eas.json` | Run helper: `EAS_ASC_APP_ID=… EAS_APPLE_TEAM_ID=… pnpm --filter @workspace/scripts run eas-configure-submit` — never hand-edit |
| 2 | Privacy policy not live | `legal/privacy-policy.md` | Fill mailing address → counsel review (HealthKit + CCPA + GDPR) → publish at stable URL |
| 3 | Production env vars not baked into EAS build | EAS secrets | Set `EXPO_PUBLIC_*` (Clerk publishable key, API base URL). **#1 cause of TestFlight crash-on-launch** |
| 4 | Backend not reachable off-Replit | api-server | Deploy so a real device build can sign in / load state |
| 5 | App Privacy questionnaire + age rating | App Store Connect | Complete before external TestFlight |
| 6 | Store screenshots | — | Capture from real device/simulator binary (web preview can't produce submission-grade assets) |

**Already green (verified in-repo):** `app.json` version `1.0.0`, bundle ID `com.aforce.os`,
buildNumber set, icon RGB no-alpha, human-written permission strings, complete
`development/preview/production` EAS profiles, typecheck passing,
`ITSAppUsesNonExemptEncryption: false` declared.

**Hard rule:** `demo_mode_enabled` stays `false` in `DEFAULT_FLAGS` for all production builds
(enforced by `investorDemoGate.test.ts`). The investor overlay must never ship visible.

---

## Lock 6 — The Five Non-Negotiable Product Locks (unchanged, restated for completeness)

1. **Water-First Command System** — order is Water → Command → Optional support → Score update. Coach copy begins with HYDRATE NOW / Start with water. Behavior first, product second.
2. **Score Protection** — only completed actions change score. Scans/recommendations/product selection are advisory. Every Home read-out is a read-only projection.
3. **Language / Localization Lock** — launch set EN/ES/FR/DE/PT/IT. No country prioritization. Hidden locales stay flag-gated.
4. **Engine / UI Governance** — engine may grow smarter; navigation may not grow. Build 100% · Show 10% · Unlock over time.
5. **Product Positioning** — Context → Recovery → Behavior → Learning → Optional support. Products support behavior; never drive it.

---

## How to apply this file

1. In `AFORCE_FINAL_SPEC.md` and `replit.md`, add near the top:
   *"Canonical numeric values (bands, accent, fonts, blockers) live in
   `AFORCE_CANONICAL_LOCKS.md`. Where this doc and that one disagree, the Canonical Locks win."*
2. In `SPEC-SHEET.md` §5, replace the 4-band range table with a pointer to Lock 1.
3. In `design/aforce-design-tokens.md`, delete the `accent.brand* / #FF3B30` block (Lock 2)
   and confirm the score-status table matches Lock 1 exactly.
4. Grep the repo for `FF3B30`, `Bebas`, `DM Sans`, and the retired band ranges; each hit is a fix.
