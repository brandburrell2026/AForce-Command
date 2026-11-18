# CLAUDE.md: AFORCE OS Hydration Upgrade (v1.8.3 work)

Put this file at the repo root, or append it to `governance/Claude-Code-Build-Rules.md` as rules 15–32. Rules 1–14 in that file still apply and win on any conflict. Read these before every task:

- `governance/AForce-Constitution.md`
- `governance/Claude-Code-Build-Rules.md`
- `governance/AFORCE_OS_STOP_SHIP_REGISTER.md`
- `governance/PROOF-TRACKER.md`
- `docs/AFORCE-OS-Spec-v1.8.3-Amendment.md` (the companion file to this one)

App code lives in `artifacts/aforce-os`. The server lives in `server/src`. Database schema lives in `lib/db/src/schema`.

## How to work

15. **One task at a time.** Work from `docs/CLAUDE-CODE-TASKS.md` in order. Each task has a goal, the files, its acceptance criteria and tests. Do not start the next task until the current one has passing tests and a short summary in the PR description.
16. **Read before writing.** Before changing any file, read it and the tests that import it. If the spec and the code disagree, stop and report the conflict in the PR. Do not pick one silently. The Nov 5 engine boundary still applies: preserve validated HydroState behavior unless the task explicitly changes it.
17. **Flag everything new.** Every new behavior ships behind a flag in `featureFlags/flags.ts`, defaulting to `false` in `DEFAULT_FLAGS` and in every production EAS profile. Flag names end in `_enabled`. A flag flips to `true` only after the matching approval row exists in `governance/PROOF-TRACKER.md`. Never flip flags in code review yourself.
18. **No hardcoded numbers.** Every threshold, ceiling, coefficient, band and default lives in `config/hydroStateModel.ts` (rule 13), and each one carries a comment with its source and `approvedBy` / `approvedOn` fields (null until approved). Unapproved values get `status: 'proposed'`. Code must refuse to use a `'proposed'` value when its flag is on in a production build, and must fall back to the documented safe behavior instead.
19. **Version the model.** Any change that alters HydroState output for identical inputs is a major model bump, per D-09 §1.4. The drink-rule work is `hydrostate-v3.0`. Add one registry row and one release note per bump. Never bump silently.

## Product rules you must not break

20. **Navigation is fixed.** Keep Home · Hydration · One Breath · Moments · Circles, with Profile opened from the member photo. No new tabs (rule 14). New settings go under Profile. New surfaces are sheets, cards or OS-level extensions (widgets, controls, intents).
21. **Measurement is not consumption.** A workout, device reading, bottle sensor, sweat result or active-energy value never counts as water intake. Only member-logged or member-confirmed drinks count. The one exception is C1's Phantom Band rule, and any new bottle source must follow the same confirm rule.
22. **Estimates stay estimates.** HydroState, targets, sweat rates and heat values are always labeled as estimates. Each shows its source and time and has a "Why?" Never use diagnosis, cure, detox, cellular or medical-risk language. Extend `utils/__tests__/consumerCopyClaimsLint.test.ts` whenever you add copy.
23. **Calm by default.** At most 3 automatic touches per Moment, and C7 still applies. No streaks, leaderboards, badges or "great job" for volume (D2). New nudges are off by default and respect quiet hours, Focus and DND.
24. **Safety outranks everything.** The overdrinking rule (#53), the heat protocol and safety branches sit in the deterministic safety layer (`utils/intelligence/decisionGuard.ts` or its successor). Lessons, preferences and AI output can never override them.
25. **Privacy.**
    - Treat weight, urine color, thirst, sweat results, intake logs and active energy as consumer health data. None of it is ever shared to a Circle.
    - Each new table or field must be added to the export job and to the full deletion path in `server/src/routes/accountDeletion.ts` in the same PR.
    - Keep OAuth tokens encrypted only (SS-03).
    - Respect `per_user_storage_isolation_enabled`.
26. **No body data at signup.** Weight, sex and height are never required at onboarding (D11). Features that need them ask in context, explain why, and work, or degrade gracefully, without them.
27. **Delete, don't hide.** When a task says to remove dead risk code (BAC, "do not drive", ungated Heat Risk), delete the code, its routes, strings and tests. Do not leave it behind a flag.

## Quality bar

28. **Tests are required.**
    - Unit tests for every pure function (drink rules, target, heat index, WBGT adapter, sweat rate, safety rule).
    - A render test for every new screen or card.
    - A contract test for every new server route.
    - Copy goes through the claims lint.
    - Accessibility: every new control has an accessibility label and supports Dynamic Type. The ring and widgets announce values with units.
29. **Locales.** Every new user-facing string goes into `locales/en.json` with a key, never inline. Note new keys in the PR so the W2-N2 locale backlog can track them.
30. **Native work.**
    - iOS widgets, Control Center controls and App Intents use `@bacons/apple-targets` (Expo SDK 53+), with App Group storage shared between app and extension.
    - Android widgets and Wear OS tiles need a native module or a vetted library. Propose one in the PR before adding a dependency.
    - Never add an SDK that sends health data to a third party.
31. **Report what you could not verify.** Mark anything that needs a real device, provider credentials or a founder decision as `[D]` or `[?]` in the PR, as the spec does. Never claim device behavior you did not run.
32. **Updating the spec.** When a task changes behavior the spec describes, update the matching section of `docs/AFORCE-OS-Spec-v1.8.3-Amendment.md` and the Proof Tracker row in the same PR.
