# Circle pilot — membership and explicit sharing

Started October 5, 2026 from `origin/main` (`391d6279`). This change implements
real connections inside the existing Circle screen. Membership merged in #1076.
The next slice adds separately gated, explicit sharing of recorded app score and
state. Live rankings and shared challenges remain outside this slice.

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
2. **Explicit sharing consent:** implemented in the gated slice below for score
   and state. Still requires real PostgreSQL CI and two-account/device acceptance;
   full identity deletion must be integrated before broader release.
3. **Recorded activity feed:** implemented in the gated slice below, with
   timestamps and honest empty/error states. The new endpoint uses fresh grants;
   the legacy snapshot feed is suppressed while the sharing pilot is enabled.
4. **One shared challenge:** invitation/acceptance, real progress, expiry,
   cancellation, and completion with two-account tests. The existing challenge
   acceptance route needs lifecycle hardening before it is used for this.
5. **Notifications:** establish delivery, preferences, privacy-safe copy, and
   bounded retries before promising notifications to members.
6. **Launch:** real PostgreSQL race tests, physical-device two-account evidence,
   migration review, and a controlled pilot precede a public flag change.
   Live global/city/team rankings remain a separate milestone.


## Explicit sharing slice

The `circle_sharing_enabled` client flag and `CIRCLE_SHARING_ENABLED=true` server
switch are separate, default-off controls. The client also requires the membership
pilot and an internal/local build. Apply the additive
`lib/db/migrations/20261005_circle_sharing.sql` only in the isolated test database
before enabling this slice. Deploying code alone does not enable sharing.

Every recipient starts with no allowed fields. A member selects score and/or
state, reviews the named recipient and fields, and explicitly confirms ongoing
sharing of the newest recorded app data from the past 24 hours. Legacy privacy
preferences are never consent. Grant writes use a version check; disconnect,
reconnection, revocation, and health-data deletion invalidate stale saves using
retained grant tombstones. Both membership directions must be active at read
time. Muting either direction hides activity. Reads use a single database
statement snapshot: a read begun before revocation may finish with the prior
grant; subsequent reads deny access. The client clears activity on background
and refreshes on foreground and every 60 seconds while active. Already seen
information cannot be recalled.

The source is persisted, client-reported `aforce_score_snapshots`, not a verified
sensor measurement or live reading. The newest record is selected before
validation; missing, invalid, future, older-than-24-hour, or NOT_COMPUTED records
produce no activity. An older valid record is never substituted. Unselected
fields are omitted, and no timestamp is emitted without allowed data.

Health-data deletion revokes both-direction grants inside its existing database
transaction. It preserves membership and hydration/score history under the
existing health-only deletion contract. Sharing that retained history again
requires fresh explicit consent. Full identity deletion remains a separate
release requirement below. Lifecycle writes currently use a pilot-wide advisory
lock; revisit serialization before scaling beyond the controlled pilot.

Turning off the server sharing switch stops new nonempty grants and activity
reads. Grant inspection and revocation remain available. Do not drop grant rows
or the table during rollback: tombstone versions prevent stale requests from
restoring consent. Disabling client presentation alone is not server revocation.

Additional two-account checks:

1. Connect A and B. Both initially have sharing off and see no activity, even if
   legacy privacy preferences allow sharing.
2. A confirms score-only sharing to B. B sees only the recorded score and time;
   state is absent. Repeat state-only, then both fields.
3. Revoke, mute, disconnect, and reconnect. Refresh B after each operation and
   verify access ends; reconnect must not restore consent.
4. Queue a first save and an edit before disconnect/reconnect or health purge.
   Their old versions must conflict rather than restore sharing.
5. Turn the server sharing switch off. Activity becomes unavailable and new
   sharing is refused, while A can still inspect and revoke an existing grant.
6. Confirm recorded provenance, no fallback to older records, no data after the
   24-hour window, honest offline errors, foreground refresh, and account-switch
   isolation on physical devices.

A dedicated Railway test project/database is awaiting approval; the existing
Railway project has only production. No production Circle flags or migrations
have been changed during this continuation.
