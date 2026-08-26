# Home / HydroState — Premium UX Specification

**Status:** APPROVED WITH AMENDMENTS (founder, 2026-08-13) and IMPLEMENTED — see the
"Founder amendments" section at the end for what changed between spec and build.
**Baseline:** Build 63 / `709bc733` (verified on physical device)
**Scope:** presentation hierarchy only. No HydroState mathematics, thresholds, decay, evidence
calculation, or intake semantics.

---

## 1 · Current hierarchy (production flags, as it ships)

`spec_home` ✓ · `home_v3_dashboard_enabled` ✓ · `moments_enabled` ✓ ·
`elite_home_experience_enabled` ✗ · `elite_voice_coach_enabled` ✗ · `offline_intake_outbox` ✗

| # | Element | Type / token | Source |
|---|---|---|---|
| 1 | "Good morning, {name}" | `afType.secondary` 15/21, textTertiary | `:541` |
| 2 | **"AForce OS"** | **`afType.title1` 32/38, textPrimary** | `:543` |
| 3 | provider chip (conditional) | `afType.caption` 13/18 | `:544-556` |
| 4 | freshness label | `afType.caption`, textTertiary | `:558` |
| 5 | **score numeral** | **76pt `displayScore`** | `:482` |
| 6 | "HYDROSTATE" eyebrow | `afType.eyebrow` 11/14 mono | `:484` |
| 7 | **band word — "DEPLETED"** | `afType.caption` 13/18 | `:493` |
| 8 | **"EVIDENCE: LIMITED"** | ConfidenceChip, 5px dot + 9pt caps | `:499` |
| 9 | **"● CRITICAL"** + trend | LiveStatusLine, `af.redText` | `:664` |
| 10 | command card | `AFCard` ~232pt tall | `:525` |
| 11 | signal tiles (2×2) | — | `:700+` |
| 12 | Moments section | — | `:393` |

Hero slot is a three-way gate — `pending` (skeleton), `building` (BUILDING YOUR BASELINE),
`established` (the table above). **That gate is protected and unchanged by this spec.**

## 2 · Files requiring change

**Home-only (safe to change):**
- `components/home/HomeScreenV2.tsx` — hierarchy, spacing, safe area
- `components/home/LiveStatusLine.tsx` — the CRITICAL verb
- `components/home/homePresentation.ts` — band accent mapping (read-only use)

**SHARED — must NOT be modified for Home's benefit:**
- `AFCommandCard`, `AFReadinessArc`, `ConfidenceChip`, `AFCard`, `AFScreen`
  → composed by Protocol, Hydration, Performance Signal, Week in Review, Moments.
  Every change below is achieved by **how Home composes these**, not by editing them.

## 3 · Where CRITICAL comes from — and why it goes

**It is not command urgency.** The engine *does* produce `urgencyLevel: 'critical'`, but
**Home never reads it.** The visible CRITICAL comes from `services/statusVerb.ts:28-31`:

```ts
if (level === 'DEPLETED') {
  if (direction === 'rising') return 'RECOVERING';
  return 'CRITICAL';
}
```

It is a **band × trend composite verb** — but at DEPLETED the trend axis collapses (2 of 3
directions produce CRITICAL), so it degenerates into **a second, louder lexicalisation of the same
variable**, rendered ~8–24pt below the first, in `af.redText`.

Worse: `useScoreTrend` initialises to `'flat'`, so **a DEPLETED member sees "● CRITICAL" on first
paint** — with no delta and no window, because `showWindow` is false when direction is flat.

**Removal is purely presentational.** `LiveStatusLine` is Home-only; nothing else consumes the
verb; no scoring, band or threshold is involved. The i18n key stays in place.

**Proposed:** at DEPLETED, the verb is suppressed and the line renders trend only when a real
direction exists. Urgency, if needed, belongs in the command card — where the engine's actual
`urgencyLevel` already lives, unread.

## 4 · Remove / move / demote

| Element | Action | Why |
|---|---|---|
| **"AForce OS" 32pt** | demote to eyebrow scale | It is the **second-largest type on screen**, competing with the hero for the same glance. The app does not need to announce itself above the member's state. |
| **CRITICAL verb** | remove at DEPLETED | §3 — duplicate verdict |
| **Band word** | keep, exactly once | It *is* the interpretation of the score |
| **EVIDENCE chip** | keep, restyled as metadata | §9 |
| **Score numeral** | **enlarge relative to everything else** | It is the hero and must read as the only hero |
| Greeting / freshness | keep, quiet | Correct as secondary already |

**Nothing is deleted that carries information.** The only removal is a duplicate verdict.

## 5 · Responsive / safe-area — the actual defect

Home applies **no device-derived bottom inset**. Four facts compose:

1. `AFScreen` defaults `edges = ['top']`; Home passes no `edges` → bottom safe-area contribution **0**
2. No `contentInsetAdjustmentBehavior` → iOS adds nothing
3. The tab bar is `position: 'absolute'` and react-navigation renders scenes at `absoluteFill`
   — it **publishes** the height via `BottomTabBarHeightContext` but injects no padding
4. Real bar height = **49pt + `insets.bottom`** → 49 on SE, 83 on notched

Home substitutes a **hard-coded 128pt** (`Spacing[24] + Spacing[8]`), which is **device-blind** —
over-clearing a notched phone by 45pt and an SE by 79pt.

**But trailing padding is not the defect.** Measured from actual style values on a 667pt iPhone SE:
header 97 + arcWrap 288 + confidence ~20 + status ~24 + command card ~232 ≈ **681pt to the bottom
of LOG WATER**, against a tab bar occupying **618–667**. The CTA is **fully underneath the bar at
rest**. On a 812pt mini it ends ~691 against a bar at 729 — clear, but only just. That is exactly
"approaches the tab bar".

**Fix (Home-only):** read the height the navigator already publishes —
`React.useContext(BottomTabBarHeightContext) ?? 0` — and derive padding from it.

Two deliberate choices:
- **Use the context, not the `useBottomTabBarHeight()` hook** — the hook **throws** when the
  context is undefined, and Home must stay mountable in isolation for its render harnesses.
- **Do not fix this in `AFScreen`.** It is shared by 12+ non-tab surfaces, and the sibling tabs
  already disagree: `HydrationScreenV2` passes **no** bottom padding (its content sits under the
  bar today — a separate real bug), while Protocol hard-codes the same 128. A shared change would
  double-pad two of them.

**The height reduction comes from the hierarchy work**, not from padding: a smaller brand line and
a tighter arc block recover ~40–60pt on short devices.

## 6 · Typography

Tokens exist and are sufficient — `displayScore` (76) · `title1` (32/38) · `title3` (21) ·
`bodyStrong` · `secondary` (15/21) · `caption` (13/18) · `eyebrow` (11/14 mono).

**The problem is not the scale, it is the assignment.** Two elements currently sit at `title1`:
the hero-adjacent brand line and the command title. A luxury instrument has **one** dominant
numeral and everything else in a clearly subordinate register.

**Proposed:** score `displayScore` alone at the top of the scale → command title `title3` →
band/evidence at `caption`/`eyebrow` → brand line to `eyebrow`. No new tokens.

## 7 · Spacing / rhythm

Current Home mixes `afLayout` tokens with ad-hoc numerics (`marginTop: 8`, `marginBottom: 8`,
`marginVertical: 24`). **Proposed:** one vertical rhythm from `Spacing[]` only, with the arc block
given the most negative space and the header the least — currently they are near-equal, which is
what makes the screen read as a stack of equal sections rather than an instrument.

## 8 · Band treatment

Accent comes from `resolveHomePresentation(level).accent` (Wave 5). At DEPLETED the screen
currently carries red in **three** places: the arc stroke, the state word, and the CRITICAL verb.
Removing the verb (§3) takes it to two. **Proposed:** red remains on the arc and the band word
only — restrained, meaningful, never decorative. PEAK/BALANCED/RECOVERING are unchanged.

## 9 · EVIDENCE treatment

Today `EVIDENCE: LIMITED` sits in the vertical run of verdicts, so it reads as a *fourth* judgment
about the body. It describes **confidence in the reading**, not a physiological state.

**Proposed:** keep it visible (confidence matters and this was hard-won), but move it out of the
verdict column — attached to the score as metadata, at `eyebrow` weight, visually paired with the
number it qualifies rather than stacked beneath the band. **No change to `homeConfidence.ts`** —
the rating, its inputs and its ceilings are untouched.

## 10 · Accessibility implications

- Wave-5 locks assert: `AFCard` sets `accessible` when labelled; `AFProgressRing` names itself
  only when labelled; the hero announces **once** (inner progressbar hidden); contrast + 44pt
  targets.
- **VoiceOver reading order must remain**: state → confidence → command → action. Demoting the
  brand line and removing the CRITICAL verb *shortens* the hero announcement, which improves it.
- Any type-scale change must preserve Dynamic Type reflow — **no `adjustsFontSizeToFit`** as a
  fix (Wave 5 flagged it on the signal values for exactly this reason).

## 11 · Regression risks

| Lock | Risk |
|---|---|
| `tickTimerRenderBlast.render.test.tsx` | new slice subscription would reintroduce per-second renders |
| `homeScreenV2RenderCount.render.test.tsx` | **bidirectional** hook drift guard — any added slice hook fails it |
| `homeScreenV2Wiring.test.ts` | asserts the evidence gate expression verbatim, no-network, and that the arc/score exist ONLY in `established` |
| `openingEvidenceGate.test.ts` | the cinematic reads the same resolver |
| `homeConfidence.test.ts` | degradation ladder + coverage ceiling |
| `a11yContrastAndTargets.test.ts` | contrast + target locks reference Home |
| `brandTokenLiterals.lock.test.ts` | any raw hex fails the ratchet |
| `nonEnLocaleParity.test.ts` | copy changes must keep 11-locale key parity |

**Mitigation:** no new store subscriptions; no new colour literals; no change to the gate
expression; copy changes are value-only where keys already exist.

## 12 · Explicitly protected — confirmed unmodified

HydroState math · thresholds · decay · evidence calculation · hydration/intake semantics ·
`services/realApi.ts` · production API configuration (`eas.json`) · Clerk configuration ·
`requireAuth` · persistence · the Build-63 write path · Circle · Protocol · Recovery · Phantom ·
Guardian · Clutch · Calendar · entitlements · purchase flows · feature-flag policy ·
`AFScreen` and every shared primitive.

---

## Open question for the founder

**§4 — demoting "AForce OS" from 32pt to eyebrow scale** is the single largest visual change
proposed, and it is a brand decision as much as a hierarchy one. The argument for it: it is
currently the second-largest element on the screen and competes with the member's own state for
the first glance. The argument against: it is the product's name at the top of its flagship screen.

**I will not make that call.** Approve, reject, or amend it and I will implement exactly the
approved scope.


---

## Founder amendments (2026-08-13) — approved and implemented

| § | Spec proposed | Founder ruling | Built |
|---|---|---|---|
| 1 | Remove CRITICAL from the hero | **Approved** — Home visual hierarchy only; engine urgency, band semantics, score math, trend logic and non-Home consumers untouched | Suppressed at the Home call site; `statusVerb.ts` byte-identical |
| 2 | Derive bottom padding from the navigator | **Approved** — no new device constant, Home-scoped, `AFScreen` and sibling tabs untouched | Derived from `BottomTabBarHeightContext` |
| 3 | Demote "AForce OS" | **Approved with amendment** — keep it visible; branded but subordinate; not a marketing splash | `title1` → `eyebrow` + `textSecondary`, same key, same position |
| 4 | Evidence as metadata | **Approved** — do not hide it | Lower weight, paired with the number; `homeConfidence.ts` untouched |
| 5 | Hero refinement | **Approved with constraint** — do NOT enlarge the ring for drama | Ring dimensions unchanged; spacing and tracking only |
| 6 | Command card subordination | **Approved** | Achieved by separation alone; `AFCommandCard` untouched |

### Open item escalated during implementation

**The command title renders at `afType.title1` (32/38) inside the shared `AFCommandCard`** — with
the brand line demoted, it is now the second-largest type on Home. Reducing it to `title3` (spec
§6) cannot be done from Home's composition; it requires editing a primitive on the founder's
off-limits list.

Its only consumers are `HomeScreenV2` and `app/ui-gallery.tsx` — Protocol composes its own card —
so the real blast radius is the dev gallery. **Not actioned. Founder decision.** Subordination was
achieved through negative space instead.
