# DR-017 — SkinIA editorial presentation reuse (presentation-only allowlist)

**Status:** approved by founder — 2026-09-23  
**Scope:** Advanced Visual Intelligence™ / member-facing **SkinIA Visual Check** —
reuse of the Editorial OS presentation tokens (`@/theme/editorialTokens`) in
five identified files  
**Related:** DR-015 (SkinIA controlled internal/TestFlight build), AF-SI-001A
(Skin Intelligence Phase 1 internal approval), the Editorial OS E1 foundation
lock (founder authorization 2026-08-29)

## Decision

Founder Decision A3, verbatim:

> A3 — SkinIA editorial reuse: approve a narrow presentation-layer exception.
> SkinIA may use the existing, audited Editorial OS presentation imports in the
> exact five identified files.
> Create an explicit decision record and cite it in the allowlist. Do not claim
> DR-015 or AF-SI-001A already granted this permission.
> No wildcard or directory-wide exemption is authorized. Preserve
> flag-and-cohort gating and the separation of data access, member
> authorization, engines, and recommendation authority. This is permission to
> reuse presentation elements—not permission to expose SkinIA to additional
> members or production cohorts.
> Keep negative coverage demonstrating that an unapproved consumer still fails
> the editorial-layer lock.

This record is that explicit decision record. The allowlist it authorizes
cites it by name (see Enforcement).

## Exact files

Paths are relative to `artifacts/aforce-os/`:

1. `app/skinia.tsx`
2. `components/advancedVisual/AdvancedVisualIntelligenceScreen.tsx`
3. `components/advancedVisual/SkinIACameraCaptureScreen.tsx`
4. `components/advancedVisual/SkinIAObservationResultsFixture.tsx`
5. `components/skinIntelligence/SkinIntelligenceEditorialSuite.tsx`

These five, exactly. Adding a sixth file, or renaming one of these, requires
amending this record and the allowlist pin together: the lock asserts the
allowlist size, that every entry exists, and that every entry still imports the
tokens module (a dormant exemption is removed, not kept).

## Boundaries

- **Presentation only.** The exception covers visual presentation: stock,
  ink, accent, rule and type roles. It changes no observation vocabulary, no
  non-result state, no raw-image policy and no member-facing claim; those
  remain governed by DR-015 and AF-SI-001A.
- **`@/theme/editorialTokens` only.** The five files may import the tokens
  module. They may not import from `components/editorial/**` (core,
  instruments, home, moments, protocol, weekly, scan) in any specifier form —
  the alias (`@/components/editorial/…`) or a relative path
  (`../editorial/core`, or the barrel `../editorial`). A DR-017 file that does
  so fails the lock, reported with the suffix
  `(imports components/editorial; DR-017 permits editorialTokens only)`.
- **No wildcard or directory-wide exemption.** Not
  `components/advancedVisual/**`, not `components/skinIntelligence/**`, not
  `app/skinia*`. The allowlist is a set of exact file paths and the lock
  rejects any entry containing `*` or ending in `/`. The negative coverage
  plants unlisted files inside a DR-017 directory, under the `app/skinia`
  name prefix and in a directory whose name merely begins with
  `components/editorial`, and requires them reported, so a sweep that
  exempted by directory, glob or bare name prefix instead of exact file would
  fail (see Enforcement).
- **Flag-and-cohort gating preserved.** `advanced_visual_intelligence_enabled`
  is `false` in `DEFAULT_FLAGS` and in `DEMO_ALL_ON_FLAGS`
  (`featureFlags/flags.ts`). It is `true` only through the internal-TestFlight
  overlay (`SKINIA_INTERNAL_TESTFLIGHT_OVERLAY_FLAGS` in
  `featureFlags/internalTestflightOverlay.ts`), and the route additionally
  requires the internal build marker and a live, server-resolved cohort grant:
  `services/skiniaCohortAccess.ts` (the fetching hook, fail-closed until the
  server answers) and `services/skiniaCohortGate.ts` (the pure WAIT / ALLOW /
  DENY decision). `app/skinia.tsx` redirects on DENY and shows a camera-free
  wait state on WAIT. This record changes none of that.
- **Separation preserved.** Data access, member authorization, engines and
  recommendation authority are untouched. The tokens module exports colors and
  type roles only: no data, no auth, no engine, no recommendation. SkinIA still
  cannot generate commands or RecoveryCommand changes (DR-015).
- **Not an exposure grant.** This is permission to reuse presentation
  elements. It is not permission to expose SkinIA to additional members or
  production cohorts. Public production exposure remains prohibited pending a
  separate, explicit founder release decision (DR-015) and the AF-SI-001A
  release gate.

## Relationship to DR-015 and AF-SI-001A

- DR-015 (`governance/decisions/DR-015-skinia-internal-test-build.md`)
  authorizes the controlled internal/TestFlight build under the approved
  observation vocabulary and the zero-persistent-raw-image policy.
- AF-SI-001A (`governance/approvals/AF-SI-001A-phase1-internal-testflight.md`)
  approves Phase 1 implementation in the internal TestFlight cohort and sets
  the release gate.
- Neither document mentions the Editorial OS presentation layer,
  `components/editorial`, or `editorialTokens`. Neither granted the reuse
  recorded here, and this record does not claim they did. DR-017 is the record
  that grants it. It is additive to, and narrower than, both; nothing in DR-015
  or AF-SI-001A is superseded.

## Enforcement

- Lock file: `artifacts/aforce-os/components/__tests__/editorialFoundation.test.ts`,
  describe `E1 isolation — zero production consumers`. The allowlist constant is
  `DR017_SKINIA_PRESENTATION_ALLOWED`, kept separate from `ALLOWED` (the E-step
  route seams) because these files are not route seams. The sweep is the pure
  helper `findEditorialOffenders(rootDir, { roots, allowed, presentationOnly })`,
  so the same code that guards the real tree is proven against a fixture tree.
  The layer is detected by import specifier in any form (`EDITORIAL_LAYER_REF`:
  the alias substring or a relative `./`/`../` path to `editorial`); the tokens
  module by its bare module name, which every alias and relative spelling
  contains. The layer's own self-exclusion from the sweep is anchored to the
  directory boundary (`components/editorial` exactly, or `components/editorial`
  + path separator), never a bare prefix, so a sibling directory such as
  `components/editorialRogue/` is swept like any other consumer.
- Positive coverage (real tree):
  - `no production file imports the editorial layer except the hidden reference sheet`
    — the sweep returns no offenders.
  - `DR-017 allowlist names exact files, no wildcard, and every file exists`
    — size pinned at five; no `*`; no `/` suffix; `.ts`/`.tsx` only; each exists.
  - `DR-017 files reference editorialTokens only, never components/editorial`
    — each entry imports the tokens module and nothing from `components/editorial`.
- Negative coverage (fixture tree under `os.tmpdir()`, run with the same three
  sets as the real sweep). The fixture mirrors one real DR-017 entry
  (`components/advancedVisual/AdvancedVisualIntelligenceScreen.tsx`) and
  always plants four unlisted consumers, each placed where an exemption wider
  than exact files (or a self-exclusion wider than the layer) would swallow it,
  and each must be reported in every case:
  `components/advancedVisual/Sibling.tsx` (the same directory as the DR-017
  entry — a `components/advancedVisual/**` exemption would pass it; it imports
  the tokens module by the RELATIVE path `../../theme/editorialTokens`, so a
  tokens match narrowed to the alias form would also pass it),
  `app/skinia-rogue.tsx` (the `app/skinia` name prefix — an `app/skinia*`
  exemption would pass it), `components/editorialRogue/Leak.tsx` (a directory
  whose name merely begins with `components/editorial`; it imports the layer
  itself, `@/components/editorial/core` — a self-exclusion written as a bare
  prefix match would treat the directory as the layer and never sweep it) and
  `components/rogue/Leak.tsx` (a directory no DR-017 entry lives in). The
  allowlisted E-step seam is never reported.
  - `an unapproved consumer still fails the lock` — the DR-017 entry imports
    `@/theme/editorialTokens` and is not reported; the four unlisted files
    (the sibling by relative tokens path, the name-prefix rogue and the plain
    rogue by `@/theme/editorialTokens`, the layer-prefix rogue by
    `@/components/editorial/core`) are reported and nothing else is.
  - `a DR-017 file that reaches past tokens into components/editorial fails the lock`
    — the DR-017 entry importing `@/components/editorial/core` is reported
    with the tokens-only suffix, alongside the four unlisted files.
  - `relative specifiers do not evade the lock — DR-017 file and unlisted consumer alike`
    — the DR-017 entry importing `../editorial/core` is reported with the
    tokens-only suffix, and `components/rogue/Leak.tsx` importing the barrel
    `../editorial` is reported (neither spelling contains the alias
    substring), alongside the other three unlisted files.
  - Each case asserts the exact sorted offender list, so an exemption that is
    directory-wide, glob-based, name-prefix-based, or specifier-form-specific
    fails the fixture even while the real tree happens to be clean.
