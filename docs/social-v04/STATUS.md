# Social v0.4 implementation checkpoint — 2026-11-04

Source: Julius's linked Social v0.4 artifact, saved as source-spec-accessibility.txt.
Branch: feat/social-v04. This is local implementation, not an internally released build.

## Implemented behind the internal preview gate

- One shared preparation screen for Social and One Breath, carried on the existing account-scoped Moment.
- Capture, editable Mirror, canonical preparation review, hold-to-Seal, Lock In, Quiet, Plans changed, private return, and Replay.
- Saved Seal acknowledgement, duplicate retry protection, stale-review rejection, scope checks and deletion tombstones.
- Actual existing-Moment Noticed entry; no fabricated calendar event. Suggestions use fresh shared Moments/preferences at tap time, respect quiet hours, lead windows, active-plan suppression and one proposal per occurrence. Repeated declines reduce frequency; category opt-out and an independent restore control use the existing scoped Moments preferences key with acknowledged writes.
- Upcoming context reads the existing shared Moments selector and displays the event after the reviewed Moment, including its date. Derived calendar rows are read-only context and are not silently saved as manual Moments.
- Social entry remains inside Protocol / Prepare My Day, with no tab.
- Inter typography, source-derived mirrored-N geometry, blue/orange/sun orb variants, reduced-motion handling, eight-second Quiet dim.
- “Go perform.” shared Lock In/Quiet wording. Current brand fill already matches #C1281B.
- Quiet serializes native scheduling with cancellation before committing Lock In. Existing safety-kind schedules are preserved; ordinary schedules and TTS are suppressed, as is the morning voice overlay.
- Local /os and /os/ permanent redirects to /aforce-os; not deployed.

Gate: EXPO_PUBLIC_INTERNAL_TESTFLIGHT=true AND EXPO_PUBLIC_SOCIAL_V04=true. Off by default. Existing One Breath confirmation and restricted Night Out entry remain fallback behavior.

## Verified locally

199 tests pass across 24 focused and regression suites, including shared UI interactions, persistence, Decision Guard, existing voice, travel/Moments/Concierge reminders and Quiet scheduling races. App TypeScript passes.

The iOS Metro/Hermes bundle export succeeds with both internal preview flags enabled (4,640 modules). The local dependency layout was repaired without changing the original checkout. This is a bundle export, not a signed build or device acceptance.

Ten local browser projections were rendered from the actual shared component with synthetic data. Fonts, mirrored-N mark, orb, plan, Seal and safety layouts were inspected. Files in local-previews/ are local review outputs and are not physical-iPhone evidence.

## Required before release or claiming spec completion

- Complete Context Arbitration / Decision Delta integration, including protected-next-context command authority and confidence gating. Decline preferences and real upcoming-context selection are implemented; next context remains read-only. Current action adapter mirrors existing guarded actions and does not claim the full requested arbitration implementation.
- Regional policy selection remains pending. The code now preserves minimal volunteered context on the same scoped Moment, requires an explicitly configured region/lifetime/version, never extends expiry on read, purges metadata on hydration/foreground/active expiry, and clears it on member return. There is no drink count or raw-utterance log. Alcohol details are excluded from the persistent title/priority in this flow. Expiry is not sobriety or driving clearance. Validate regional age handling and emergency-number behavior before enabling the internal gate; deterministic phrase matching is not comprehensive emergency recognition or driving assessment.
- Validate ongoing-event capture and revisions, cancellation, every interrupted hold/save, offline and force-close behavior, concurrent account changes and native notification cancellation/reconciliation. Do not replay stale reminders in a burst.
- Finish visual comparison against all nine source screens and accessible focus/VoiceOver/large-text/reduced-motion checks on device.
- Real iPhone demos: nighttime, daytime, travel/offline/restart. User deferred unlocking iPhone (2); no real-phone screenshots have been produced.
- Signed build, internal TestFlight distribution and acceptance evidence. None is complete for Social; the local Metro/Hermes bundle export is verified above.
- Website redirect deployment and public verification.

Phase B remains deferred by the spec: accepted check-in-person invitations, temporary Circles, deeper ride integration and watch sync. Current ride links open the provider only; they do not book, charge, track or notify another person. No claim of Circle acceptance, shared status or delivery is made.

## Configuration contract (no approved lifetime assumed)

- EXPO_PUBLIC_INTERNAL_TESTFLIGHT=true and EXPO_PUBLIC_SOCIAL_V04=true enable the preview route.
- EXPO_PUBLIC_SOCIAL_POLICY_REGION: explicitly selected test region.
- EXPO_PUBLIC_SOCIAL_CONTEXT_RETENTION_HOURS: positive, approved lifetime; no hard-coded default.
- EXPO_PUBLIC_SOCIAL_POLICY_VERSION: version of that approved configuration.

Without all three policy values, volunteered alcohol context is not durably written by this flow. Safety alternatives still appear immediately, with a truthful persistence warning. A plan containing such context cannot be sealed until configuration exists. Configuration is not a clinical assessment or legal-age verification.

Quiet additionally blocks ordinary audio during unresolved hydration, cancels pending native reminders before Lock In, suppresses the cold opening/voice overlay and welcome banner, and invalidates in-flight TTS so a late response cannot play after Lock In. The typed web fallback uses stable voice methods so rerenders cannot cancel a valid Seal hold. Early release and a complete hold are covered by actual pointer-event tests.
