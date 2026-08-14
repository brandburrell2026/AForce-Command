# Navigation Dispositions — Build 65 Device QA

Two navigation findings from Build 65 looked like the same class of problem and
turned out to be opposites. Recorded so neither is re-litigated.

## Recovery → Home: DEFECT, neutralized for Phase 1

**Observed** Choosing Recovery returned the member to Home.

**Root cause** The Modules launcher entry pointed at `/cruise/recovery`. That
route has never existed — there is no `app/cruise/` directory. expo-router could
not resolve it and fell through to the index. Nothing crashed and nothing logged.

**Not** the intentional dark-feature guard we assumed. It was a stale affordance
promising a screen that was never built.

**Disposition — Phase 1**

- The launcher entry is **removed**, not repointed. An affordance that names a
  destination and delivers a different one is worse than no affordance, and
  choosing a destination for Recovery is a product decision, not a bug fix.
- The Recovery **implementation is untouched** and stays dark behind its existing
  governance: `spec_recoveryCoach`, default OFF, surfaced only by
  `components/home/RecoveryCoachEntry.tsx`, which renders nothing when the flag
  is off. Nothing was deleted. The flag was not activated.
- The `recovery` tile in `components/home/EntryActions.tsx` is unaffected — it
  opens an inline panel via `setOpenKey` and never navigates, so it promises
  nothing it cannot deliver.

**Lock** `artifacts/aforce-os/lib/__tests__/moduleRouteTargets.test.ts` fails if
any launcher entry names a route with no file, and separately asserts the
launcher stays behind `developerControlsAvailable()` so ordinary production
members cannot reach it at all. All 14 entries are covered, not just Recovery.

## Social → Circle: PASS, intentional

**Observed** Choosing Social lands on the Circle tab.

**Traced** `/social-v2` is an explicit legacy compatibility redirect →
`/night-out` → authorization gate → `<Redirect href="/(tabs)/competition" />`,
which is Circle.

**This is designed behavior.** The night-out route file states it directly:
*Circle owns community.* Night Out is a gated social entry point that falls back
to Circle when it is not authorized for the current context.

**Disposition**

- **Circle is the canonical community/social surface.** No separate Social
  surface is to be built.
- The redirect behavior is preserved as-is.
- Circle's #712 sample-cohort rules remain in force: the founder reversed the
  anonymous-boards substitution in favour of the comparison cohort, and that
  ruling stands. Do not re-substitute without a new one.
- Classified **PASS** — no redesign, no fix.
