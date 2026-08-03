# Engineering Playbook

**Last verified:** 2026-08-03
**Scope:** cross-cutting engineering process rules that apply across every
workstream in this monorepo — not a workstream-specific guide. Individual
programs (e.g. `docs/health/validation/`) inherit these rules and should
link here rather than restate them; if you find a workstream doc repeating
one of these rules verbatim instead of linking, that's drift to fix.

This is a process doc, not an architecture doc. For system design, see
`docs/AFORCE_OS_ARCHITECTURE_V1.md`; for governance principles, see
`governance/` (the sole authoritative source per Founder Decision 3,
2026-07-22).

---

## 1. Review-before-merge

No feature, provider, or capability goes live — to any user, including
founders/employees on an "internal" flip — without independent review by
someone who did not do the work.

- **CODEOWNERS gates review, not just approval theater.** `.github/CODEOWNERS`
  defines per-path ownership; `docs/CI_BRANCH_PROTECTION.md` documents the
  required-checks configuration this repo's branch protection should
  enforce (`typecheck`, `tests-baseline`, `focused-health`,
  `governance-drift`, `integration`, all required, no bypass once owner
  handles are filled in). A green CI run is necessary, never sufficient —
  see Rule 2.
- **A reviewer who wrote the code being reviewed is not independent
  review.** This applies to validation-evidence review the same as code
  review: `docs/health/validation/REVIEW-CHECKLIST.md` requires the
  independent reviewer be someone who did not perform the validation run
  being reviewed, for the same reason a PR author cannot self-approve.
- **Governance-owned paths require the governance owner specifically.**
  `governance/TEST-BASELINE.md` carries the `governance/` CODEOWNERS entry;
  any PR that edits it (including to legitimately lower a failure count)
  requires that reviewer, and — per the `baseline-override` label
  mechanism in `docs/CI_BRANCH_PROTECTION.md` — cannot silently move the
  ceiling without a reviewer consciously applying the label.

## 2. No mock-only activation

**A green test suite against mocks or fixtures is necessary but never
sufficient to call something validated, working, or ready for real users.**
This is `docs/health/validation/STAGE-LADDER.md`'s iron rule, stated here
as a general engineering rule because it applies well beyond health
providers:

- Unit and integration tests against fixture payloads prove the code
  handles the shapes you gave it. They prove nothing about whether those
  shapes match reality — see `docs/health/garmin/MOCK-COVERAGE.md` for a
  worked example of a fully-green mock suite (`garminMock/`, 100% passing)
  that explicitly documents a long list of things it does NOT prove
  (real endpoints, real field names, even the right delivery model).
- A working demo-data toggle (e.g. `health_demo_data_enabled`) is a UI/QA
  convenience, never evidence that the real integration works.
- "The tests pass" is not, by itself, a sentence that belongs in any
  sign-off — it must be accompanied by evidence of what was actually
  tested against (fixtures vs. a real account/device/environment) and what
  wasn't.
- When a capability is genuinely mock-only (dormant, unverified, or
  pre-partner-approval, like Garmin today), say so explicitly rather than
  leaving it ambiguous. `docs/health/garmin/README.md`'s standing rule —
  "no claim in this directory may imply Garmin is connected, verified, or
  available to users" — is the general pattern: mark mock-only work as
  mock-only, in the same PR that adds it, not as a follow-up.

## 3. Post-merge verification

Merging is not shipping, and a green CI check is not a verified deploy.
Verify the thing actually happened in the environment that matters:

- **A merged PR is not a deployed PR.** This repo has been burned by
  exactly this gap before — confirm the deploy pipeline (Railway for the
  API, EAS for mobile builds, Vercel for the marketing site) actually
  picked up the merge and completed, rather than assuming merge-to-main
  implies live. Railway's own deploy status is the fastest signal for
  backend changes; check it rather than inferring success from the merge
  alone.
- **A green Vercel preview check proves only that `aforce-site` built.**
  Per `docs/CI_BRANCH_PROTECTION.md`: Vercel's check runs no `tsc`, no
  vitest, touches neither `artifacts/api-server` nor `artifacts/aforce-os`.
  Treat it as informational for marketing-site-only PRs, never as proof a
  backend or mobile change was verified.
- **After any environment or config change** (host/domain change, env var
  change, feature-flag flip), confirm the specific surface that depends on
  it in the actual running environment — not just that the config value
  was set correctly in source. A correct `.env.example` entry is not proof
  the deployed environment has the matching real value.
- **Dirty-tree verification proves nothing.** Running typecheck or tests
  against an uncommitted, partially-staged working tree does not tell you
  whether the actual committed/merged state is correct — verify against
  what was actually committed, ideally from a clean checkout or worktree,
  the same way `docs/CI_BRANCH_PROTECTION.md`'s "Fresh-checkout defects"
  section describes catching two real repo defects that a long-lived local
  checkout's accumulated state had been masking.

## 4. Root-cause before retry — stop after two failed fixes

If the same fix fails twice, stop and escalate rather than trying a third
variation blind. This is not a suggestion — it's the difference between
debugging and guessing:

- The first failure is information: it tells you your model of the problem
  was incomplete. Revise the model before attempting a second fix.
- A second failure of a *different* attempt at the same fix (not a retry
  of the identical action) means the model is still wrong at a level you
  haven't identified yet. At this point, stop attempting fixes and
  root-cause instead — read the actual failure output, the actual code
  path, the actual state, rather than pattern-matching to a plausible-
  sounding next guess.
- This applies to rollback incidents too:
  `docs/health/validation/ROLLBACK-CHECKLIST.md` requires root cause be
  investigated before any re-attempt after a rollback — "a second flip
  without understanding why the first one triggered rollback is a guess,
  not a fix."
- It applies to validation verdicts:
  `docs/health/validation/VERDICT-DEFINITIONS.md` requires a FAIL be
  root-caused before the next attempt, not answered with a second guess at
  the same fix.
- Escalating is not a failure. Naming "I don't know why this is happening"
  to the person who can help (a domain-owning agent, the founder, whoever
  has access you don't) is strictly better than a third blind attempt that
  might mask the real problem under a fourth layer of incidental change.

## 5. Documentation ships with the code it describes

A doc-later promise is a doc-never outcome. Any PR that changes a host,
domain, env var, pricing, or retires a feature must update the docs that
reference the old value in the **same PR** — staleness is caught by
grepping for the old value and confirming its absence, not by trusting
memory that "someone will update the docs later." See
`docs/health/validation/README.md`,
`docs/health/garmin/README.md`, and this repo's own `*.replit.app`
domain-migration cleanup as the standing examples of what this rule
prevents and what it looks like when it's followed.

Legacy references that genuinely cannot be updated yet (a doc pointing at
a system still mid-migration, a path that will move but hasn't) get marked
**"(legacy — relocation TBD)"** explicitly, rather than left ambiguous for
a future reader to mistake as current.
