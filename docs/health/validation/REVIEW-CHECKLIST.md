# Independent Reviewer Checklist

**Last verified:** 2026-08-03
**Who this is for:** whoever reviews a squad's `EVIDENCE-TEMPLATE.md` packet
before a PASS or PARTIAL verdict stands. Must not be the person who ran the
validation (criterion 15, `ACCEPTANCE-CRITERIA.md`).

This checklist is what turns a squad's self-reported verdict into a
program-level DEVICE-VALIDATED claim. Work through every section; do not
sign off on a packet with an unchecked section.

## 1. Evidence completeness

- [ ] Every field in `EVIDENCE-TEMPLATE.md` is filled in — no blanks, and
      every `N/A` has a stated reason.
- [ ] Device model, OS version, and app build SHA are all present and the
      SHA actually exists in the repo's history.
- [ ] Screenshots, and a screen recording where the runbook calls for one,
      are attached and open correctly (not corrupted, not placeholder
      images).
- [ ] Logs are attached where the runbook calls for them.
- [ ] The evidence covers every applicable §5 test case in the provider's
      runbook, not just the "happy path" subset.

## 2. Truthfulness spot-checks

Pick at least three claims in the packet and independently verify them
against the attached evidence — do not take the validator's summary at
face value:

- [ ] Does the screenshot/recording actually show what the "product surface
      output" section claims it shows?
- [ ] Does the "freshness observed" value match what the attached canonical
      record's `observedAt`/`syncedAt` timestamps actually say?
- [ ] Does the "source attribution observed" match the attached record's
      `provenanceChain` / native-origin field, not just the validator's
      description of it?
- [ ] For a disconnect/deletion test: does the evidence show the *before*
      and *after* state, not just an assertion that it worked?

## 3. Governance invariants

- [ ] No provider score (WHOOP recovery/strain, Oura readiness, Garmin
      stress, Strava training load) is shown blended into or relabeled as
      an AForce score anywhere in the evidence.
- [ ] No screenshot or copy shows provider data claimed as feeding the
      Hydration Score.
- [ ] HRV is never shown labeled as the wrong method (RMSSD presented as
      SDNN, or vice versa) — cross-check against `HRV_METHOD_BY_PROVIDER`
      in `lib/health-core/src/normalize.ts` for the provider under review.
- [ ] Samsung evidence (if applicable) never shows or claims a direct
      Samsung connection — always "via Health Connect."
- [ ] No "LIVE" or "connected" state is claimed without the evidence
      showing an actually verified, unexpired link.
- [ ] Provider-specific hard rules from the relevant runbook are checked
      individually (see each runbook's "Provider-specific hard rules"
      section) — this is not covered by the general checks above.

## 4. Redaction

- [ ] No token, secret, or key value appears anywhere in any attachment
      (screenshot, recording frame-by-frame where feasible, or log).
- [ ] No medication data or unrelated personal health detail is visible.
- [ ] No personal (non-test) account identifier appears where a test
      account was supposed to be used.
- [ ] If any attachment fails the above, it is rejected as inadmissible
      per `REDACTION.md` and the packet is sent back for recapture — the
      reviewer does not manually redact submitted evidence themselves.

## 5. Verdict sign-off

- [ ] The recorded verdict (PASS/PARTIAL/FAIL) matches what sections 1–4
      actually support — a reviewer who finds an unresolved gap during
      review downgrades the verdict, they do not approve the original
      claim and file a side note.
- [ ] For PARTIAL: every named gap has a ticket, and the reviewer
      independently agrees each gap is non-blocking (not just the
      validator's opinion).
- [ ] Reviewer signs the packet with name and date.
- [ ] If this sign-off makes the provider newly DEVICE-VALIDATED, the
      reviewer (or the squad, with the reviewer confirming) updates
      `STAGE-LADDER.md`'s current-state table in the same change.

A packet that fails any checklist item above does not get a passing
sign-off "with a note to fix later" — see `VERDICT-DEFINITIONS.md`: an
unmet criterion is a FAIL, full stop, until it is actually met.
