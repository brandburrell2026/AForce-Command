# PR-002 — AForce Moments (DRAFT — pending founder decision)

**Status:** PARTIALLY APPROVED · Phases 1–2 built (PR #713). Items 5.1 + 5.4
approved by Brandon 2026-08-12 → DR-010 (Julius countersignature pending);
Phase 3a (prep notifications) in build. **Items 5.2 / 5.3 / 5.5 / 5.6 NOT authorized** — every item in Part 5 requires explicit
approval before any Phase 3 work begins.
**Deciders:** Brandon (founder) + Julius — items marked [JB] require both.
**Author:** Claude Code (drafted at founder direction, 2026-08-12).
**Template precedent:** PR-001 (Founder Decision 1: proposal → decision record →
constrained build).

---

## 1. What AForce Moments is

> Calendar = what is coming. Signals = where the user is now.
> AForce OS = what to do next. The Ritual = how AForce delivers it.

A preparation layer: important upcoming events ("Moments") each get a prep
window and one clear action, delivered through the existing PAUSE → HYDRATE →
LOCK IN → PERFORM ritual. A performance concierge, not a calendar app.

## 2. What is ALREADY built (Phases 1–2, founder-authorized, flag `moments_enabled` OFF in production)

- Manual + demo Moments only (`types/moments.ts`, `services/momentsStore.ts`).
- Pure advisory recommendation engine (`services/momentRecommendation.ts`):
  prep windows + Water-First actions from `config/hydroStateModel.ts` tunables
  (Build Rule 13); explanations via the Evidence Engine's fail-closed
  `CommandEvidence` shape; works with zero wearable/health inputs.
- Surfaces: Home NEXT MOMENT section + today list, Moment Detail ritual
  (flagship), Moments overview, Prepare My Day, Add a Moment.
- Compliance posture: **no calendar access, no notification behavior, no new
  raw data collection, no new score** (all deferred to Part 5). Score
  Protection (DR-001) holds: everything is a read-only projection; I'M READY
  writes only Moments-internal state.

## 3. Constitution check (Phases 1–2)

- P5 observation-not-diagnosis: actions are hydration/behavior preparation,
  no medical language (copy audited).
- P6/P10/P11 trust-over-attention: Phases 1–2 add ZERO interruptions — no
  notifications, no badges; value only when the member opens the app.
- P7 who-sees-this-data: manual moments are user-authored, stored locally
  (AsyncStorage), never transmitted; no new data leaves the device.
- Promise gate: a user-declared important moment is a direct signal of what
  matters to this person.

## 4. Terminology (needs registry entries — Change Control F10, founder approval)

- **Moment** — proposed registration: "a user-designated upcoming event AForce
  prepares the member for." Currently unregistered; no conflicts found.
- **Ritual** — already used three ways (Opening Sequence PAUSE/HYDRATE/LOCK
  IN/PERFORM; Shop "Build Your Ritual"; the live "Ritual" Shopify plan).
  Moments deliberately REUSES the Opening Sequence identity (same four words,
  same i18n keys) rather than minting a fourth meaning — but the registry
  should record both terms to close the SS-12-class overload risk.

## 5. Phase 3+ decisions — each requires explicit approval BEFORE build [JB]

| # | Decision | Standing conflict to resolve |
|---|---|---|
| 5.1 | **Section allocation** — allocate a reserved §43–46 slot (or run in Founder Mode unphased) via decision record | DR-003: reserved sections need a decision record; Build Rule 2 (numbered sections only) |
| 5.2 | **Calendar data class** — register calendar events as a new RAW collection class; counsel + privacy sign-off; update MHMD disclosure inventory + privacy policy ("we do not access…" line); define retention class + deletion path | DATA-CLASSIFICATION-MATRIX lock ("no new raw collection"); INTELLIGENCE-CHANGE-CONTROL §4 (Founder+Legal+Privacy); SS-04 (no deletion path yet); §51 Privacy Center is Phase 2 |
| 5.3 | **Calendar-derived surfacing** — approve automatic classification of calendar events into Moments | Night Out ruling: no automatic activation from calendar (intentional-user-action precedent) |
| 5.4 | **Prep notifications** — authorize prediction-type output on the notification surface; set caps/quiet-hours interplay | PT-1/DR-008 prohibits notifications as a prediction surface today; SS-17 quiet hours; 0C notification-cap standard incomplete |
| 5.5 | **Native build** — expo-calendar plugin + NSCalendars permission strings + EAS iOS build | eas.json/native config is founder-authorized per-edit |
| 5.6 | **Learning loop** — populate reserved command-ledger kinds for prep feedback; approve feedback-driven timing adaptation | Ledger reserved-kind activation is separately approved; adaptive-timing safety gates (hydration never de-prioritized) |

## 6. Privacy commitments carried into any Phase 3 design (from the founder spec)

Least-privilege read-only access; selected calendars only; titles/times only —
never bodies, attachments, attendees, or notes; PRIVATE EVENT masking; local
processing preferred; no full-history storage; permission
granted/denied/revoked/partial all first-class; manual Moments remain a full
substitute when access is absent.

## 7. Approval

- [x] 5.1 Section allocation — Brandon ☑ 2026-08-12 (DR-010) · Julius ☐ PENDING
- [ ] 5.2 Calendar data class — Brandon ☐ Legal ☐ Privacy ☐
- [ ] 5.3 Calendar-derived surfacing — Brandon ☐ Julius ☐
- [x] 5.4 Prep notifications — Brandon ☑ 2026-08-12 (DR-010, constrained) · Julius ☐ PENDING
- [ ] 5.5 Native build authorization — Brandon ☐
- [ ] 5.6 Learning loop — Brandon ☐ Julius ☐
- [ ] Terminology registrations (Part 4) — Brandon ☐
