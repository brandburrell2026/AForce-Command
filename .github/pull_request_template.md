<!--
  Thanks for sending a PR. Keep it small. Keep it focused. One concern per PR.
  Reviewers will be auto-assigned from .github/CODEOWNERS.
-->

## What
<!-- 1–3 sentences. What does this PR change from a user / API perspective? -->

## Why
<!-- Link an issue, a spec section, or paste the requirement. "Because the
     spec says so" is fine if you link the spec line. -->

## Scope (check all that apply)
- [ ] Mobile (`artifacts/aforce-os`)
- [ ] API server (`artifacts/api-server`)
- [ ] Shared lib (`lib/*`)
- [ ] OpenAPI spec — **regenerated client committed**
- [ ] DB schema — **migration committed**
- [ ] Investor deck / design / locales
- [ ] Infra / CI / repo config

## Verification
<!-- Paste the commands you ran and their result. Reviewers will reject PRs
     where this section is empty. -->
- [ ] `pnpm run typecheck` — green
- [ ] `pnpm run test` — green
- [ ] Manual smoke test on iOS Simulator / Android emulator (if mobile)
- [ ] Manual API check via curl / Postman (if backend)

## Flags / rollout
<!-- If this ships behind a feature flag, name it. If it changes a default
     flag value or threshold, call that out explicitly. -->

## Compliance notes
<!-- Touched user-facing copy in Cruise Mode, Sleep, or AI Coach? Confirm
     no medical / safety / diagnostic claims and that the disclaimer block
     still renders. Otherwise: N/A. -->

## Screenshots / recordings
<!-- Required for any visible UI change. Drag & drop here. -->

## Risk
<!-- Low / Medium / High + one sentence on blast radius and rollback plan. -->
