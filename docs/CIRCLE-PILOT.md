# Circle pilot — membership slice

Started October 5, 2026 from `origin/main` (`391d6279`). This change implements
real connections inside the existing Circle screen. It is not a launch of live
rankings, shared health status, or shared challenges.

## Included

- In an explicitly enabled internal/local build, Circle → Friends shows actual
  members, loading/error/empty states, and a refresh action.
- A signed-in member enters the display name they want their connection to see
  and creates an invitation. The random code is displayed once for manual copy.
  The application does not send an email or message.
- A second signed-in member enters the code and their own display name. One
  database transaction consumes the invitation and establishes both sides of
  the connection. Codes expire after seven days; expired, revoked, or already
  accepted codes cannot be used again.
- Each account may have up to ten outstanding invitations; the cap is enforced
  inside a per-owner database transaction even for simultaneous requests.
- Members can revoke outstanding invitations and remove a connection. Removal
  deletes both membership directions and their stored status snapshots.
  Muted connections are listed too, so muting does not hide the removal action.
- A connection never opts either person into sharing health data. Reconnection
  clears old status snapshots instead of reviving previous sharing.
- Rank/Cities retain the existing clearly labeled sample cohort. Demo gallery
  fixtures and ordinary public builds retain their existing presentation.

Display names are self-selected labels, not verified identities. The code is a
bearer invitation: give it only to the intended person; anyone with a valid code
and authenticated account can redeem it first.

## Activation and rollback

The implementation is off by default on both client and server. No database
migration, deployment, remote setting, or TestFlight submission is performed by
this change.

1. Use a dedicated test environment with working Clerk authentication.
2. Review and apply `lib/db/migrations/20261005_circle_invitations.sql` to that
   environment. This is an additive, transactional, one-time migration. Do not
   use a broad schema push against production for this change.
3. Deploy the API code there with `CIRCLE_MEMBERSHIP_ENABLED=true`. Anonymous
   demo identities are refused even outside production. Configure the app to
   use that same test API and Clerk instance.
4. In local development or an internal TestFlight build, explicitly enable
   **Profile → Developer → Circle membership pilot**. The
   `circle_membership_enabled` flag remains false in public/default/demo flags;
   the Friends screen also checks the build context.
5. Execute the two-account checks below before inviting a pilot cohort.

To stop new invitations and acceptance, unset `CIRCLE_MEMBERSHIP_ENABLED` or set
it to `false`. Disable the client pilot toggle as appropriate. Removing an
existing connection remains available at the API regardless of the invitation
switch. Keep the additive table for recovery/audit; do not drop it as rollback.

## Two-account acceptance checks

Use two separate authenticated accounts, A and B, with real Clerk sessions.

1. A creates an invitation; the code is visible once and no member is yet added.
2. A cannot redeem that code. B accepts it; A and B each see the other's chosen
   display name after refresh. Neither sees the other's health measurements.
3. B and a third account cannot reuse the code. A revoked code and a test-expired
   code both fail without creating a relationship.
4. A revokes a still-pending invitation; it disappears from the outstanding list.
5. B removes A; refresh both accounts and confirm that both directions are gone.
   Rejoining requires a new invitation and does not restore old status snapshots.
6. Start a request and switch A → B (also A → B → A). No prior account's members,
   pending invitations, name input, or issued code may appear in the new session.
7. Disconnect network during load and after a successful mutation. The UI must
   distinguish unavailable data from an empty Circle, and a completed action
   followed by a failed refresh must not be presented as an unperformed action.
8. Check keyboard, touch targets, text scaling, VoiceOver, and code copying on
   physical iOS/Android devices. Confirm the pilot cannot open in a public build.

## Verification commands

Run with the repository's supported Node 22 and pnpm toolchain:

```sh
pnpm run typecheck:libs
pnpm --filter @workspace/api-server typecheck
pnpm --filter @workspace/aforce-os typecheck
pnpm exec vitest run artifacts/api-server/src/lib/__tests__/circleMembership.test.ts artifacts/api-server/src/routes/__tests__/circleInvitations.test.ts artifacts/api-server/src/routes/__tests__/circle.test.ts artifacts/api-server/src/routes/__tests__/circleBolaE2E.test.ts artifacts/aforce-os/services/__tests__/circleMembershipService.test.ts artifacts/aforce-os/components/community/__tests__ artifacts/aforce-os/featureFlags/__tests__/productionRestrictedFlags.test.ts
pnpm exec vitest run --config vitest.integration.config.ts lib/db/src/__integration__/circleMembership.integration.test.ts
```

The integration suite requires Docker and provisions its own disposable
PostgreSQL. It must never point at a member database. The route tests also need
permission to bind local HTTP servers.

Local verification on October 5: 123 targeted tests passed across 11 files;
library, API, and app typechecks passed; `git diff --check` passed. These ran
with the available Node 24.19.0 runtime (the repository/CI targets Node 22).
The six PostgreSQL integration tests could not execute locally because no
working container runtime was available. They subsequently passed on the CI
runner with real PostgreSQL: [integration run 37313838334](https://github.com/brandburrell2026/AForce-Command/actions/runs/37313838334)
(41 tests passed overall, including all six Circle cases). Physical-device
and real-account acceptance remain unverified.

## Remaining work for the broader Circle pilot

1. **Identity deletion lifecycle:** the repository currently exposes a
   health-data-only deletion operation, not a full account-deletion hook. Before
   broader release, integrate verified account deletion with invitation
   invalidation and removal of reciprocal relationships. Do not silently change
   health-data-only deletion into account deletion.
2. **Explicit sharing consent:** obtain fresh consent for real sharing; existing
   preferences were created while sharing was only a preview. Enforce scope and
   field visibility on the server at read time, including immediate revocation,
   disconnection, account deletion, and no data for unknown/absent observations.
3. **Real activity feed:** connect only authorized member activity, including
   timestamps and honest empty/error states. Do not publish through the legacy
   unfiltered snapshot reader.
4. **One shared challenge:** invitation/acceptance, real progress, expiry,
   cancellation, and completion with two-account tests. The existing challenge
   acceptance route needs lifecycle hardening before it is used for this.
5. **Notifications:** establish delivery, preferences, privacy-safe copy, and
   bounded retries before promising notifications to members.
6. **Launch:** real PostgreSQL race tests, physical-device two-account evidence,
   migration review, and a controlled pilot precede a public flag change.
   Live global/city/team rankings remain a separate milestone.
