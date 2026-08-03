# Verdict Definitions

**Last verified:** 2026-08-03
**Applies to:** every squad's validation run, recorded in that run's `EVIDENCE-TEMPLATE.md` packet.

Every validation run ends in exactly one of three verdicts. There is no
fourth option and no way to defer the call — an incomplete run is not
"pending," it is FAIL until the missing piece is supplied.

## PASS

All applicable acceptance criteria (`ACCEPTANCE-CRITERIA.md`) are met, with
evidence, and nothing observed during the run contradicts the platform's
truthfulness guarantees (Constitution: observation never diagnosis; no
fabricated measurement; provider attribution preserved).

A PASS is not final until an independent reviewer has signed off per
`REVIEW-CHECKLIST.md` — a squad cannot self-certify its own PASS into
DEVICE-VALIDATED status.

## PARTIAL

The provider works for its core path, but has one or more **documented,
non-blocking gaps** — each gap must be:

- Named specifically (not "some edge cases remain"),
- Ticketed (a tracked follow-up, not a verbal promise), and
- Judged non-blocking by the independent reviewer, not by the squad that
  found the gap.

Examples of what qualifies as a non-blocking gap: a rare device model not
yet tested, a cosmetic a11y label wording issue, a retry backoff timing that
works but isn't optimally tuned. PARTIAL still requires evidence for every
criterion — it means "met with a caveat," not "some criteria untested."

A provider recorded as PARTIAL is **not** DEVICE-VALIDATED. It is a
distinct, disclosed state that later validation work must close out to PASS
before the provider can advance on `STAGE-LADDER.md`.

## FAIL

Any of the following makes a run FAIL, with no partial credit:

- Any acceptance criterion unmet (including "untested" — untested is not
  evidence of passing).
- Any truthfulness violation: a permission state, sync status, freshness
  label, or provenance claim that does not match reality.
- Any governance violation: provider data touching the Hydration Score,
  a provider score relabeled as an AForce score, a claim of "LIVE" without
  a verified unexpired link, HRV RMSSD presented as SDNN (or vice versa),
  Samsung presented as a direct connection, or any other violation of the
  hard rules stated in the relevant provider runbook.
- Missing or non-redacted evidence (see `REDACTION.md`) — inadmissible
  evidence is treated as no evidence, which fails criterion 14.

A FAIL requires root-causing before the next attempt, not a second guess at
the same fix. If the same fix fails twice, stop and escalate rather than
trying a third variation blind (see `docs/ENGINEERING-PLAYBOOK.md`).

## What a verdict is not

- A verdict is not a vibe. "Looked fine on my phone" is not a verdict; a
  filled `EVIDENCE-TEMPLATE.md` packet is the only thing that produces one.
- A verdict is not permanent. A regression discovered later (a new OS
  version, a provider API change, a code change touching the provider path)
  invalidates a prior PASS until re-validated. `STAGE-LADDER.md`'s
  DEVICE-VALIDATED status is a claim about the last-verified state, not a
  permanent certificate.
- A verdict is not a rollout decision. Reaching PASS/DEVICE-VALIDATED
  authorizes moving to the next rung of `STAGE-LADDER.md` — it does not, by
  itself, authorize shipping to any real user cohort. Cohort expansion has
  its own gate (`ROLLBACK-CHECKLIST.md` + `STAGE-LADDER.md`).
