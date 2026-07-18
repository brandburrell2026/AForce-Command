# Show 10: The Confidence & Personalization Surface

**Design spec — ui-designer** · 2026-07-18
**Batches:** §53 Data Freshness · §54 Signal Quality · §55 Profile Completeness (+ nudge) · §56 Personalization Coverage · §58 Command Confidence Display
**Status:** Design only. No code shipped by this doc. All copy marked CR-1-pending — nothing here may ship until CR-1 clears.

---

## 0. Grounding — what's actually on disk

Read before designing: `utils/confidence/signalQuality.ts`, `utils/confidence/dataConfidence.ts`,
`utils/profile/profileCompleteness.ts`, `utils/profile/profileNudge.ts`,
`utils/profile/profileCompletenessConfidence.ts`, `utils/personalization/personalizationCoverage.ts`,
`utils/commandConfidenceDisplay.ts`, `components/CommandConfidenceBadge.tsx`,
`hooks/useCommandConfidence.ts`, `theme/colors.ts`, `theme/statusColor.ts`, `featureFlags/flags.ts`,
`app/(tabs)/index.tsx`, `app/(tabs)/profile.tsx`, `components/ProductFitCard.tsx`,
`components/home/CommandStack.tsx`, `components/WhyThisScore.tsx`, `components/home/NotificationBanner.tsx`.

**One load-bearing finding that changes the flag plan:** §53 Data Freshness (`utils/confidence/dataFreshness.ts`)
does **not exist in the working tree or in `HEAD`/`origin/main`**. `governance/Launch-Readiness.md` lists it as
"Shipped-live (engine)," but that's wrong — I verified with `git show HEAD:artifacts/aforce-os/utils/confidence/dataFreshness.ts`
(fails: path does not exist) and `git merge-base --is-ancestor` against both local `HEAD` and `origin/main` (both `NO`).
The code exists only on an unmerged remote branch (`origin/feat/section-53-data-freshness`, stacked into
`origin/feat/section-54-signal-quality` at commit `fc5902a9`) that was never merged to main. I pulled its full
content via `git show` to design against the real shape (`FreshnessRating = fresh | aging | stale | expired`,
`freshnessCeiling`, `applyFreshness`, per-kind `FRESHNESS_WINDOWS` in `config/hydroStateModel.ts` on that branch) —
so this spec is accurate to what §53 will be — but **the merge itself is a launch-tracker correction, not a
design task**. Flag it to whoever owns the tracker; see Open Question 1.

Everything else (§54, §55 incl. nudge + confidence adapter, §56, §58) is genuinely on `main`, headless or
dark-flagged, exactly as the tracker describes.

**Also confirmed while reading:** `theme/colors.ts` / `theme/statusColor.ts` — the actual in-app system — is the
**dark** Cinematic Black instrument (`#0D0D0D` ground, white/Bone text, Signal Red `#C1281B` scarce accent, Soursop
`#1FA35A` / amber / orange / `#FF2800` status bands). This is distinct from `CLAUDE.md`'s Brand v2.2.0, which
describes the **marketing website's** light Paper (`#E9E7E1`) theme — that reversal is web-only. This spec targets
the React Native app, so every token below is the dark in-app system, not the marketing palette.

---

## 1. The unifying concept

Five sections of the spec (§53/54/55/56/58), read separately, are five widgets. Read as one idea, they are a
single question the product is finally willing to answer out loud: **"how sure are we, and how much of this is
actually about you?"**

The unifying move: **one visual primitive, four vocabularies, one detail pattern.**

- **One primitive** — a small monochrome dot + IBM Plex Mono micro-label. This is not new: it's `CommandConfidenceBadge`
  (§58), already shipped, already deliberately monochrome so it never collides with the status-color band. Rather
  than inventing a second visual language for §53/54/55/56, this spec **generalizes that exact primitive** into a
  shared component (`ConfidenceChip`, described in §3) that every layer renders through. A user should never be able
  to tell, just by looking, whether a chip came from §54 or §56 — the grammar (dot, opacity, tiny caps label) is
  identical; only the word changes.
- **Four vocabularies, one grammar.** §53 (fresh/aging/stale/expired), §54 (excellent/good/limited/unavailable),
  §55 (sparse/partial/rich), and §58 (high/medium/low) are all **quality gradients** — "how much of this is real,
  and how current" — and all render as the same dot-opacity ramp, just with different word sets and step counts.
  §56 is different in kind: personalized/population-default/blocked-on-input/scoring-locked are not four points on
  a quality gradient, they're four *categories* (one of which — scoring-locked — is a policy boundary, not a
  confidence level). §56 renders through the same chip *shape* but never dims — see Design Decision 3 in §3.
- **One detail pattern.** Every chip is tappable into the same expansion: a bottom sheet titled **DATA BEHIND THIS**
  that lists the real inputs, honestly, one row per signal. This is not a new interaction — it's `WhyThisScore`'s
  existing "tap the card, chevron signals more" pattern, reused so the whole confidence layer feels like it belongs
  to the same product as the score breakdown, not a bolted-on trust badge.

This gives Brandon's "one hand made it" test a clean answer: a user sees the same small dot-and-word chip on
Today's Command, on a HydroScan Fit axis, in Profile, and (later) on Recovery Window, and the same tap gesture opens
the same kind of honest, undecorated list every time.

---

## 1.1 Copy-independence — a first-class constraint

**Every explanatory sentence in this document is a CR-1 placeholder.** Nothing in §5 is approved copy; CR-1 hasn't
even been scheduled yet (per `governance/Launch-Readiness.md`). That means the layout cannot be designed *around*
any specific sentence surviving review — it has to survive CR-1 stripping a line, rewording it, or rejecting it
outright, with zero redesign and zero broken layout.

**The rule:** if CR-1 removes or rewords an explanatory line anywhere in this surface, the affected chip, row, or
sheet degrades to **badge/rating/level alone** — the dot, the label, the status glyph — and nothing else changes.
No empty gap where a sentence used to sit, no orphaned bullet, no card that suddenly looks unfinished. Structure is
ours to design now; words are pending counsel, and the structure must not flinch when the words are pulled out from
under it.

**Acceptance criterion (applies to every surface in §2):** a surface only passes design review if it **reads as
complete and intentional with ALL explanatory copy removed** — i.e., delete every sentence in §5 from the mockup
and look again. If what's left looks broken, unfinished, or like something is missing, the design has failed this
constraint, regardless of how good it looks with the copy in. Badge-only is not a degraded state to tolerate; it is
the default state copy is layered onto.

This is why §3's component contract treats explanatory copy as an *optional, additive* prop rather than a required
one (see Design Decision 5), and why §5 below shows the copy-stripped rendering next to every proposed line.

---

## 2. Per-surface placement

### 2.1 Today's Command (`app/(tabs)/index.tsx` → `components/home/CommandStack.tsx`)

**Already there:** `CommandConfidenceBadge` (§58) is mounted here **unflagged** today (per the component's own doc
comment — Today's Command is the one surface that shows confidence regardless of `spec_commandConfidenceDisplay`).
Nothing to add for the badge itself.

**What Show 10 adds:** make the existing badge tappable. Today it's a static `<View>` (no `Pressable`). Wrap it so
tapping opens the **DATA BEHIND THIS** sheet, seeded from whatever produced that Command Confidence read (the
Impact Engine context — hydration/recovery/heat signal pairs) plus, when available, the §53 freshness of the
wearable/hydration-verification signal behind it and the §56 coverage read for `HydroState` (the engine driving
Today's Command). This is the single highest-traffic mount point, so it's also where most users will first
discover that the layer is interactive at all.

- Mounts inside `CommandStack`, directly beside/replacing the current `CommandConfidenceBadge` render.
- Sheet composes: Command Confidence level (already shown) → per-signal freshness (§53, when the merge lands) →
  HydroState coverage rows (§56) → a single link-out line to Profile's fuller Profile Strength section (§2.3) for
  "why is this population-default."
- No copy change to the visible chip itself — `CONFIDENCE_LABEL_KEYS`/`CONFIDENCE_OPACITY` stay exactly as shipped.
  This surface only gains the *tap*, not new visible chrome.

### 2.2 HydroScan Performance Fit (`components/ProductFitCard.tsx`)

**Already there:** the same `CommandConfidenceBadge`, gated by `spec_commandConfidenceDisplay` (OFF), in the card
header next to "Product Profile."

**What Show 10 adds:**
- Same tap-through as 2.1, seeded from the `HydroScan` engine's §56 coverage row (weight, activityLevel,
  performanceMemory; sign-off-pending: sweatClassification, primaryGoal) instead of HydroState's.
- **Do not** add a chip per axis (Hydration speed / Electrolyte density / Sugar load / Recovery fit / Performance
  fit). The five axis bars are already a dense, information-rich strip; a chip bolted onto each row would be the
  over-decoration this brief explicitly warns against, and none of the five axes map 1:1 onto a §56 engine field
  anyway. One header-level chip, one sheet, is the honest amount of surface here.

### 2.3 Profile (`app/(tabs)/profile.tsx`)

Profile is the only surface built for a full, unhurried disclosure — this is where "how confident, how
personalized" gets a real answer instead of a glance.

**New section, using the existing `SectionHeader` pattern** (`label` + `hint`, same as MODULES / WEEKLY REPORT
etc.), inserted in the PERFORMANCE tab, above or beside MODULES:

```
SectionHeader label="PROFILE STRENGTH" hint="What we know about you, and how we're using it"
```

Contents, top to bottom:

1. **Profile Completeness chip** (§55) — `SPARSE` / `PARTIAL` / `RICH`, rendered as the same `ConfidenceChip`
   primitive. Tapping opens a plain list of the 9 `ProfileIdentity` fields, present/missing — **never** a ring,
   never "6 of 9," per §55's own locked doctrine (see §4). This is the one place a user can see the field list at
   all, satisfying curiosity without the nudge banner ever needing to enumerate fields itself.
2. **The existing profile nudge line** (`profileNudge.ts` → `selectProfileNudge`), when its cadence says show —
   rendered as its own quiet inline row directly under the chip (not inside the tap-through sheet; the nudge has
   its own strict 14-day/dismissal/lifetime cadence that must keep firing independent of whether the user ever
   opens the sheet). Visually: same treatment as `NotificationBanner`'s card (soft `accent.primary` tint at ~6–10%
   fill, hairline border), not a chip — it's a sentence, not a status.
3. **Personalization audit table** (§56) — one row per built engine (`HydroState`, `HydroScan`, `SleepReadiness`,
   `RecoveryWindow`, `PerformanceIdentity`; composites `AutoPilot`/`Guardian`/`Clutch`/`Cruise` optionally rolled
   into an expandable "modes" sub-list since they're aggregates, not primary reads). Each row: engine name (mono,
   caps, matches existing `axisLabel` styling in `ProductFitCard`) + one `ConfidenceChip`-shaped status pill
   showing the *dominant* status for that engine (worst case wins for honesty: if any actionable field is
   `population-default`, show that over `personalized`). Tapping a row opens the same **DATA BEHIND THIS** sheet,
   scoped to that engine's field list.
4. `TomorrowLoadForecast` and any other `not-yet-built` engine are simply omitted from the table — never shown
   as "0% personalized" or any other fabricated-absence state.

This section is the honest home for the §56 gap — see §4.

### 2.4 Recovery Window

**Grounding correction:** there is no shipped "Recovery Window" screen. The name is used in the §58 badge's own
doc comment as one of its four intended mount surfaces, but the only matching route on disk is
`app/(hidden)/cruise/recovery.tsx` (internal/hidden, under the Cruise enterprise flag family), and the Recovery
Layer itself (`spec_recovery`) ships OFF with zero visible consumers today (confirmed against
`governance/Launch-Readiness.md` §2 build table — "Recovery Layer — hidden engine... no visible surfaces").

**Design position:** don't design a bespoke Recovery Window confidence treatment now — there's no real screen to
attach it to, and speculative chrome for an unbuilt surface is exactly the kind of premature decoration this brief
warns against. Instead: the moment Recovery Window ships a real UI (post the Recovery Layer's own launch gate),
it mounts the *same* `ConfidenceChip` + **DATA BEHIND THIS** sheet used everywhere else, seeded from
`RecoveryWindow`'s existing §56 coverage row (connectedWearables, activityLevel, performanceMemory; sign-off:
trainingLevel, age, travelStatus) and the wearable_sync §53 freshness window. No new component design work is
owed later — this is the payoff of building one reusable primitive now.

---

## 3. The confidence-chip design

### Component: `ConfidenceChip`

Generalizes `CommandConfidenceBadge` (dot + label, opacity-only). **As shipped (PR #273), the factoring is a pure
model + a dumb view** — mirroring the existing §58 split (`commandConfidenceDisplay.ts` holds the table, the badge
just reads it), not a vocabulary-switching component:

```
// pure — utils/confidence/confidenceChip.ts: vocabulary → { label, opacity }
completenessChip(level)   // §55  → { label: 'RICH'|'PARTIAL'|'SPARSE', opacity }
signalQualityChip(rating) // §54  → { label: 'EXCELLENT'|…, opacity }
freshnessChip(rating)     // §53  → { label: 'FRESH'|…, opacity }
//   §58 keeps its own CONFIDENCE_LABEL_KEYS/CONFIDENCE_OPACITY; §56 is excluded (categories, CR-1-gated)

// view — components/ConfidenceChip.tsx: the dumb chip
<ConfidenceChip
  label={...}      // structural caps token — REQUIRED, always renders, ships pre-CR-1
  opacity={...}    // REQUIRED, the monochrome ramp value
  explain?={...}   // OPTIONAL plain-English line, CR-1-pending — see Design Decision 5
/>
```

`explain` is the only provisional input. `label` + `opacity` alone are a complete, shippable chip. **Tap-through
(`onPress` → the DATA BEHIND THIS sheet) is NOT part of the chip — it belongs to slice ① (the sheet), a later slice;
the chip itself stays presentational.**

Visual anatomy (unchanged from the shipped badge): a 5×5px circle + an 9px IBM Plex Mono / Inter SemiBold caps
label at `letterSpacing: 1.2`, both driven by one opacity value, in `Colors.text.secondary` (`rgba(255,255,255,0.55)`
white) as the base — never a hue.

**Design Decision 1 — confidence is monochrome, always.** No chip in this layer ever borrows Signal Red, Soursop
Green, Berry Blue, or the amber/orange status hues. Those four colors are entirely reserved for
`getStatusColor(score)` (the hydration band) and the brand accent. A chip that went green next to a red-band score
would read, at a glance, as "this part is good" — exactly the kind of competing emphasis the brand law forbids
("if two things are red, neither is important" applies just as hard to green). Confidence differentiates by
**opacity only**, on the same neutral white/Bone family already used for secondary text everywhere in the app.

**Opacity ramps** (extending, not replacing, the shipped `CONFIDENCE_OPACITY` table):

| Vocabulary | Levels | Opacity |
|---|---|---|
| Command Confidence (§58, shipped) | high / medium / low | 1.0 / 0.7 / 0.45 |
| Signal Quality (§54) + Data Freshness (§53) | excellent–fresh / good–aging / limited–stale / unavailable–expired | 1.0 / 0.78 / 0.55 / 0.30 |
| Profile Completeness (§55) | rich / partial / sparse | 1.0 / 0.7 / 0.45 (reuses the §58 ramp exactly — same 3-step meaning: "how much do we have") |

`unavailable`/`expired` sit at 0.30, not 0 — an absent or expired signal is still information the user is entitled
to see; it never fully disappears the way a missing feature would. This mirrors `CommandConfidenceBadge`'s existing
"absent shows absent, never fabricated" rule, just extended to a dimmer floor instead of a `null` render.

**Design Decision 2 — §54/§53 compose before they render, never stack as two chips.** Per `dataFreshness.ts`'s own
documented composition rule, freshness is a **ceiling** on the §54 source rating (`effective = min(source, ceiling)`),
resolved *before* display. A signal never gets two chips ("Excellent source" + "Stale") — it gets one chip at the
lower of the two, exactly matching the engine's own anti-double-count discipline. The sheet-level detail view (not
the chip) is where both contributing facts get spelled out as separate lines, e.g.:

> HydroScan reading — **Limited** (excellent source, but 30h old — past its 4h fresh window)

**Design Decision 3 — §56 coverage never dims.** `personalized` / `population-default` / `blocked-on-input` /
`scoring-locked` are categories, not a quality gradient — `scoring-locked` is a policy boundary (the field is
withheld pending a scoring-engine change we're not making), not "worse" than `blocked-on-input` (the user simply
hasn't told us yet). Dimming would imply an ordering that doesn't exist and would make `scoring-locked` read as a
failure state, which it structurally isn't. So §56 chips render at **full opacity always**, differentiated only by
label + a small glyph (a filled dot for `personalized`, a hollow ring for `population-default`, a dashed ring for
`blocked-on-input`, a small lock glyph for `scoring-locked` — using the existing `Icon` component's stroke language,
not a new icon set).

### The DATA BEHIND THIS sheet

A bottom sheet (same modal family as `ScoreBreakdownSheet`), title-cased mono header `DATA BEHIND THIS`, body is a
plain vertical list — no charts, no rings, no percentage anywhere in this sheet, per Design Decision 4 below. Each
row: signal/field name (left, Inter SemiBold) + its chip (right), **self-sizing to that alone** — the row is
complete and correctly laid out with just name + chip. *Optionally*, below the name+chip line, one row of
plain-English context per non-`personalized`/non-`fresh` row (the honest-gap copy in §4/§5) — present when `explain`
is supplied, entirely absent (not blank, not collapsed-but-reserved) when it isn't, per Design Decision 5. A single
"Update your profile" text link at the bottom routes to Profile when any row is `blocked-on-input`; that link's copy
is itself CR-1-pending and the sheet is complete without it too.

**Design Decision 4 — no meter of any kind, anywhere in this layer.** §55's own guardrail (`profileNudge.ts` guardrail
#2: "never a percentage, progress ring, X of N, or 100% target") is the strictest rule in the five source files, and
this spec extends it to §54/§56/§58 for consistency: nothing in this entire confidence surface ever renders a
progress bar, ring, or percentage. Coverage is reported as a status list, not `"62% personalized."` This is a
deliberate refusal to let a trust surface accidentally become a completion meter — the thing §55's own doctrine
calls a dark pattern when it's coupled to profile fields, generalized here because the same psychological pull
(chase the number up) applies just as much to "personalization %" as to "profile %."

**Design Decision 5 — explanatory copy is optional, additive, and self-sizing; never load-bearing.** The `explain`
prop (and its sheet-row equivalent) is the *only* provisional part of this contract — everything CR-1 might touch
lives there and nowhere else. Concretely:

- The chip and the sheet row render their **complete, intended, final design** with `explain` absent — dot/opacity,
  label, glyph, tap target. This is not a fallback or a loading state; it is the default the component was designed
  for, and `explain` is layered on top of it, not the other way around.
- No row, card, or sheet **reserves fixed vertical space** for the explanatory line. Every container that can carry
  an `explain` string sizes to its content (`flex`/intrinsic height, no fixed `minHeight` sized for a sentence that
  may not exist). When `explain` is `undefined`, the row is simply shorter — never a gap, never a placeholder dash,
  never a skeleton shimmer standing in for words that aren't there.
- A chip or sheet that only reads as finished *with* its sentence present has failed this contract regardless of
  how good it looks with the copy in — see the acceptance criterion in §1.1, applied here at the component level.

---

## 4. The honest-gap treatment

The whole point of this pass, per the brief, is that `population-default` / `blocked-on-input` / `scoring-locked`
must surface **without nagging or implying something's wrong.** Three moves do that:

1. **No color, no urgency framing.** Per Design Decision 1/3, these states never render in Signal Red or amber —
   colors the user has already learned mean "your hydration needs attention." A gap in personalization is not a
   problem to fix urgently; conflating the two visual languages would be the single fastest way to make this
   feel like nagging.
2. **The gap is always paired with the reason, never bare.** A `population-default` row in the sheet never just
   says "General estimate" — it says *why*, using the honest-mechanics register the §55 nudge already uses
   ("Adding your X helps AForce OS tailor Y"), not a deficiency register ("Your X is missing"). Same move for
   `blocked-on-input`: framed as "this gets sharper once you add X," never "you haven't done X yet."
3. **It only appears where the user already went looking.** Every honest-gap row lives inside the tap-through sheet
   or the Profile Strength section — surfaces the user opened on purpose. The one exception, the §55 nudge banner,
   already has an extremely strict cadence (≥14 days apart, 30-day cooldown after dismiss, dead after 2 dismissals
   or 4 lifetime shows, 7-day/3-session grace) built and locked in `profileNudge.ts`; this spec does not touch that
   cadence and does not let any other part of the confidence layer piggyback on it or invent a second nudge channel.
   `scoring-locked` fields (e.g., `sex` for HydroState) get one extra sentence acknowledging the boundary honestly —
   "we use a general estimate here" — never dressed up as personalized and never explained as a bug.

---

## 5. Proposed copy — all CR-1-pending

None of this ships until the pre-launch claims review clears it (per `governance/Launch-Readiness.md`, CR-1 has no
reviewer booked yet — see Open Question 4). Every line below avoids "prevents/optimal/required/meets your needs"
framing and states an observation or a mechanism, never an outcome.

Per §1.1/Design Decision 5, every row below is shown **paired with its copy-stripped rendering** — what the reviewer
sees if CR-1 rejects the line entirely. If the stripped version reads as broken or incomplete, the row has failed
the constraint and needs a layout fix, not just a copy fix.

**Command Confidence chip labels** — unchanged, already shipped (`coach.confidence_high/medium/low`). No `explain`
prop today; this row is a precedent for "badge alone is already a finished design," not a new case.

**Signal Quality / Data Freshness rows (sheet):**

| Rating | With copy (`explain` present) | Without copy (`explain` absent) |
|---|---|---|
| Excellent / fresh | *"[Signal] — from [source], captured [time ago]."* | `[Signal]` · **EXCELLENT** chip. Row ends there. |
| Good / aging | *"[Signal] — from [source]; getting a little old."* | `[Signal]` · **GOOD** chip. Row ends there. |
| Limited / stale | *"[Signal] — from your phone, or from a reading that's aged past its usual window."* | `[Signal]` · **LIMITED** chip. Row ends there. |
| Unavailable / expired | *"[Signal] — nothing recent enough to use yet."* | `[Signal]` · **UNAVAILABLE** chip (0.30 opacity). Row ends there. |

**Profile Completeness chip:**

| Level | With copy | Without copy |
|---|---|---|
| Rich | *"Your profile is filled in — recommendations are working from real specifics."* | **RICH** chip alone, full opacity. |
| Partial | *"Your profile has some real detail in it."* | **PARTIAL** chip alone, 0.7 opacity. |
| Sparse | *"Your profile is still mostly a starting point."* | **SPARSE** chip alone, 0.45 opacity. |

**Profile nudge** (already locked verbatim in code — carried forward unchanged, not new copy):
- `"Completing your profile helps AForce OS generate more personalized recommendations."`
- `"The more of your profile AForce OS has, the more specific its recommendations can be."`
- `"Adding your [training level / primary goal / activity level] helps AForce OS tailor its recommendations."`

*Copy-stripped rendering:* the nudge banner has no chip/badge equivalent — it is structurally **all copy**, so
"strip the sentence" means "the banner doesn't render," which is already exactly how `selectProfileNudge` behaves
(`show: false, message: null`). This is the one row in this spec with no badge-alone state to design, because it
was never dependent on layout carrying a sentence in the first place — it's the existing cadence gate, unchanged.

**Personalization coverage rows (sheet), per status:**

| Status | With copy | Without copy |
|---|---|---|
| `personalized` | *"[Field] — used, from what you told us."* | `[Field]` · filled-dot glyph. Row ends there. |
| `population-default` | *"[Field] — we're using a general estimate here until you add yours."* | `[Field]` · hollow-ring glyph. Row ends there. |
| `blocked-on-input` | *"[Field] — add this in your profile and we'll use it."* | `[Field]` · dashed-ring glyph. Row ends there. |
| `scoring-locked` | *"[Field] — factored in generally; this one needs a scoring-engine change we haven't shipped yet."* | `[Field]` · lock glyph. Row ends there. |

**Section header (Profile):** label `"PROFILE STRENGTH"` (structural, not a claim — ships regardless of CR-1) / hint
`"What we know about you, and how we're using it."` (optional — `SectionHeader` already renders `hint` conditionally
today, `{hint && <Text>...}`, so this row is already copy-independent by the existing component's own contract).

**Sheet title:** `"DATA BEHIND THIS"` — structural label naming the surface, not a claim about the user's body or
data; ships as-is regardless of CR-1 outcome on the rows beneath it.

---

## 6. Smallest launch-relevant subset vs. nice-to-have — and the flag plan

**Smallest launch-relevant subset** (ship first, in order):

1. Make the existing Today's Command `CommandConfidenceBadge` tappable → the DATA BEHIND THIS sheet, populated
   from whatever's already computed (Impact Engine context + §56 HydroState coverage). This is the single highest-
   visibility move and needs no new merges beyond what's already on `main`.
2. Profile Strength section, Profile Completeness chip only (§55 is fully on `main`, including the confidence
   adapter) — no §53, no full §56 audit table yet.
3. Flip `spec_commandConfidenceDisplay` to internal-preview per its own existing flag comment, once (1) is proven
   out, so HydroScan Fit gets the same tappable chip.

**Nice-to-have / sequenced after:**

4. §56 personalization audit table in Profile (needs PR #264 merged first — it's currently open, not on main).
5. §53 freshness rows in the DATA BEHIND THIS sheet, everywhere — **blocked** until the §53 branch is actually
   merged (see §0 finding). Design is ready; the dependency is a merge, not a design task.
6. Recovery Window mount — sequenced after the Recovery Layer itself ships any visible surface at all.

**Flag plan** (Build 100 / Show 10 — everything below is OFF by default, additive, and never changes existing
score/board/color behavior):

| Flag | Gates | Depends on |
|---|---|---|
| `spec_commandConfidenceDisplay` (existing) | Chip on HydroScan Fit + future non-Today's-Command surfaces | Already on `main`, OFF |
| `spec_confidenceDetailSheet` (new) | The tap-through DATA BEHIND THIS sheet, on every surface the chip already appears | §54/§55 confidence adapters (on `main`); §53 rows inert/hidden until its merge lands |
| `spec_profileStrengthSection` (new) | The whole new Profile section (completeness chip + nudge row + audit table) | §55 (on `main`) for the chip; PR #264 merge for the audit table rows |
| `spec_personalizationAudit` (new, sub-flag of the above) | Just the §56 per-engine table rows inside Profile Strength, so the section can ship with completeness-only first and the audit table later without a second screen redesign | PR #264 merged |
| — (no new flag) | Recovery Window mount | Reuses whatever flag the Recovery Layer's eventual UI ships behind; not owed until that exists |

---

## 7. Open questions — RESOLVED (founder, 2026-07-18)

1. **§53 not on `main`** — RESOLVED. Was orphaned by a stacked-merge (#260 merged into #259's branch); recovered in
   **#268**. §53 freshness rows may go live once that's merged (now on `main`).
2. **Recovery Window screen** — DEFERRED (design question). `AFORCE_OS_ARCHITECTURE_V1` specs Recovery Window as a
   *calculated value* (recalculated on profile change), not a dedicated surfacing screen. Ambiguous → **out of the
   smallest subset**, no bespoke chrome designed. Revisit if/when a Recovery Window UI is actually specced.
3. **§56 personalization audit table** — DECIDED: it **waits for CR-1 as a unit**, and is **NOT built ahead, even
   flag-gated** — a built surface creates pressure to ship, and "we're estimating your sex" is exactly what CR-1
   exists to vet. This extends to the **§56 coverage rows in the DATA BEHIND THIS sheet**: same claims-sensitive
   content, also excluded from this pass. The **completeness-only Profile Strength section ships now** (its §55 copy
   is already locked/reviewed in `profileNudge.ts`).
4. **Naming** — DECIDED: keep **plain** (`ConfidenceChip` / "DATA BEHIND THIS"). Confidence UI is trust
   infrastructure; trust infrastructure that performs is less trustworthy. Ritual vocabulary stays reserved for the
   ritual loop — the restraint is the design.

**Build scope confirmed:** smallest subset ① (Today's Command badge → sheet, §53/§54/§58 content only, **no §56
rows**) + ② (Profile Strength completeness section), flag-gated. §56 (sheet rows + audit table) is CR-1-gated and
not built in this pass.
