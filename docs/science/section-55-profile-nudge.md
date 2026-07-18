# §55 Step 3 — Profile Completeness Nudge (evidence note)

**Ruling by:** performance-scientist · **Date:** 2026-07-17 · **Status:** implemented (Step 3)

Basis for the profile-completeness nudge, kept here so the honest-mechanics
constraints survive team turnover. Code: `artifacts/aforce-os/utils/profile/profileNudge.ts`.

## Claim under review
> "Completing your profile helps AForce OS generate more personalized recommendations."

**Grade: Supported.** It is a factual statement about the system's own behavior —
more filled fields widen the model's specific inputs. Corroborated in-repo by Step 2
(`profileCompletenessConfidence`), where sparse self-report caps confidence at
`partial`. No external physiological claim is made.

**What would make it unsupportable (blocked variants):** any outcome framing —
hydration, recovery, readiness, performance, error-avoidance, "prevent," "better."
The claim is about recommendation *specificity*, full stop.

## Approved copy
- Primary: "Completing your profile helps AForce OS generate more personalized recommendations."
- Rotation variant (same claim-grade): "The more of your profile AForce OS has, the more specific its recommendations can be."
- Named-field pattern (allowlist only): "Adding your {field} helps AForce OS tailor its recommendations."

All gated by `isCompliantCoachLine` (§64 observation-only guard) in the test suite.

## Field-naming rule
A field may be named **only if it is a behavioral, preference, or performance
setting.** Never a body measurement, protected characteristic, or age/identity
attribute. Current allowlist: `trainingLevel`, `primaryGoal`, `activityLevel`.
**Never nameable / never pressured:** weight, goal weight, height, biological sex,
birth year/age, and — held out deliberately as a physiological self-classification —
sweat classification (escalate to counsel if product ever wants it nameable). The
allowlist is a `Set` the builder reads from, so a body/bio field is *structurally*
unreachable, not merely omitted by author discretion.

## Cadence ("occasionally", not nagging)
Pure predicate, rules first-match-wins: never at `rich`; stop forever after 2
dismissals, 4 lifetime shows, or reaching rich; 7-day / 3-session grace before the
first show; 30-day cooldown after a dismiss; ≥14 days between shows. Net worst case
for a user who never dismisses: ~4 shows across the life of a sparse/partial profile,
then never again. Fails **closed** (never shows) on non-finite counters.

## Behavior-change mechanic
Honest cue / capability explanation — a transparent statement of how the tool works —
NOT variable reward, loss aversion, or streak pressure. Anti-patterns that fail
re-review: guilt/deficiency framing ("30% complete", "missing 6 fields"), reward or
gamification coupling ("complete to unlock"), anxiety coupling (surfacing on a low
reading), re-prompting after dismissal, escalating urgency, interrupting modals, a
100%-completion target / progress meter, or any population comparison.

## Surface (out of PS domain, flagged)
Placement and the dismiss affordance are a ui-designer / ux-researcher call. This
ruling governs mechanics and copy, not the pixel surface — it must be an inline,
dismissible card in a neutral/idle slot, never a modal and never attached to a
score or negative state.
