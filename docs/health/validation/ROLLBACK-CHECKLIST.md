# Rollback Checklist — Per-Flip Rehearsal

**Last verified:** 2026-08-03
**Applies to:** every feature-flag flip that advances a provider on
`STAGE-LADDER.md`'s cohort-stage axis (founders → internal employees →
10-person beta → 50-person beta → Founding 250 → staged production). Every
`health_*_enabled` flag defaults OFF in both DEFAULT and DEMO flag sets
(`artifacts/aforce-os/featureFlags/flags.ts`) and is locked there by
`featureFlags/__tests__/healthFlagsDefaultOff.test.ts` — this checklist is
what has to be true *before* any of those defaults changes for any cohort.

Reaching DEVICE-VALIDATED (`ACCEPTANCE-CRITERIA.md`) authorizes attempting
the first cohort flip. It does not skip this checklist — rehearsing rollback
is a separate gate, run fresh for every flip, not a one-time exercise done
once per provider.

## Before the flip

- [ ] **Revert path identified and tested.** The exact mechanism to turn the
      flag back off (config change, redeploy, or remote flag flip) is known
      and has been exercised at least once in a non-production environment
      — not just assumed to work because it's "just a boolean."
- [ ] **Cohort zeroing plan exists.** If the flip is scoped to a named cohort
      (e.g. the 10-person beta), there is a concrete list of exactly which
      accounts/devices are in that cohort, and a tested way to zero it back
      to nobody without affecting accounts outside the cohort.
- [ ] **Monitoring signals named.** Specific, checkable signals are agreed
      before the flip — not "we'll keep an eye on it." At minimum: error
      rate on the provider's sync/auth endpoints, any spike in
      `disconnect`/`error`/`action_required` presentation states for the
      provider, and any new support-ticket volume tagged to that provider.
- [ ] **Failure thresholds defined in advance.** A specific, numeric trigger
      for rollback is written down before the flip (e.g. "error rate on
      provider sync exceeds baseline by X%," "more than N cohort members
      report broken disconnect") — not decided in the moment under
      pressure.
- [ ] **Who can pull the trigger is named.** At least one person with actual
      access to flip the flag back is identified and available during the
      observation window — a plan that depends on someone unreachable is
      not a plan.

## During the observation window

- [ ] Monitoring signals are actually being watched (someone is looking),
      not just theoretically instrumented.
- [ ] Any threshold breach triggers the pre-agreed rollback immediately —
      not a discussion about whether the threshold "really" counts.

## After a rollback (if triggered)

- [ ] Root cause is investigated before any re-attempt — a second flip
      without understanding why the first one triggered rollback is a
      guess, not a fix (see `docs/ENGINEERING-PLAYBOOK.md` on not guessing
      twice).
- [ ] The incident (what triggered it, what was affected, how it was
      resolved) is recorded before the next flip attempt for this provider.

## After a rollback is NOT triggered (successful window)

- [ ] The observation window's actual duration and the monitoring data are
      recorded as part of that cohort stage's evidence — a successful flip
      with no record of having been watched is indistinguishable, later,
      from one that was never actually monitored.
- [ ] `STAGE-LADDER.md`'s cohort-stage table is updated to reflect the new
      cohort stage for that provider.

## What this checklist deliberately does not cover

This checklist governs the *flip itself*. It does not replace
`ACCEPTANCE-CRITERIA.md` (whether the provider works) or
`REVIEW-CHECKLIST.md` (whether the evidence is sound) — a provider still
needs DEVICE-VALIDATED status and reviewer sign-off before its first cohort
flip is even eligible to be attempted under this checklist.
