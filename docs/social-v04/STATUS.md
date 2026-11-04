# Social v0.4 implementation checkpoint — 2026-11-04

Source: Julius's linked Social v0.4 artifact, saved as source-spec-accessibility.txt.
Branch: feat/social-v04. This is local implementation, not an internally released build.

## Implemented behind the internal preview gate

- One shared preparation screen for Social and One Breath, carried on the existing account-scoped Moment.
- Capture, editable Mirror, canonical preparation review, hold-to-Seal, Lock In, Quiet, Plans changed, private return, and Replay.
- Saved Seal acknowledgement, duplicate retry protection, stale-review rejection, scope checks and deletion tombstones. Seal binds the exact canonical command ID and action, the reviewed validity window and visible upcoming context. Live input checks cover mid-hold changes and queued save starts; acknowledged retries remain idempotent. Calendar context bindings remain in memory only.
- Actual existing-Moment Noticed entry; no fabricated calendar event. Suggestions use fresh shared Moments/preferences at tap time, respect quiet hours, lead windows, active-plan suppression and one proposal per occurrence. Repeated declines reduce frequency; category opt-out and an independent restore control use the existing scoped Moments preferences key with acknowledged writes.
- Upcoming context reads the existing shared Moments selector and displays the event after the reviewed Moment, including its date. Noticed may propose a real, readable calendar candidate supplied by the existing consent/category/confidence-gated calendar layer. Demo, masked and tentative/cancelled candidates are excluded. The internal gate mounts before shared data readers; production calendar settings remain unchanged.
- A calendar candidate remains read-only through Mirror and Plan. Seal explicitly creates a member-reviewed manual Moment from approved fields, with a minimal opaque event/occurrence link to suppress only that exact calendar row. It never persists the source object, notes, attendees or body. Other recurring occurrences and moved events remain visible; removing the manual plan reveals the source again. Access revocation clears an unsealed source candidate. A sealed manual plan remains the member's own record.
- Hydration instructions mirror the current guarded command only in the existing preparation window or explicit happening-now capture. Future plans do not freeze today's dose into a later action. Newly reviewed actions are never assigned past times. No Social-specific dose or timing policy was added.
- Each lifecycle view exposes a focusable screen-reader heading and resets scroll to the top when entered. Editing within the same view preserves input focus; revealing a different safety view moves focus to its heading. Native focus requests check screen-reader availability and cancel stale asynchronous requests. Seal reports its disabled/busy state. Browser interaction tests cover step transitions and uninterrupted typing; native VoiceOver behavior still requires phone acceptance.
- Mirror summarizes a known date/time and expands its editors and getting-back controls on request. Unknown timing remains visible for explicit confirmation. Calendar provenance and approval wording remain visible.
- An unchecked-by-default follow-up choice links only the member-selected next Moment at Seal. It is disclosed in Plan and Seal, persists on the same Moment, and creates no extra Moment, reminder or command. Return offers a fresh One Breath review of that exact occurrence; changed, masked, completed, expired or revoked context requires another choice. Replaying feedback leaves this handoff available. Same-member route changes remount local draft state; account changes block the handoff. A timed 6 AM crossing stays in Quiet until Return.
- Social entry remains inside Protocol / Prepare My Day, with no tab.
- Inter typography, source-derived mirrored-N geometry, blue/orange/sun orb variants, reduced-motion handling, eight-second Quiet dim.
- “Go perform.” shared Lock In/Quiet wording. Current brand fill already matches #C1281B.
- Quiet serializes native scheduling with cancellation before committing Lock In. Existing safety-kind schedules are preserved; ordinary schedules and TTS are suppressed, as is the morning voice overlay.
- Local /os and /os/ permanent redirects to /aforce-os; not deployed.

Gate: EXPO_PUBLIC_INTERNAL_TESTFLIGHT=true AND EXPO_PUBLIC_SOCIAL_V04=true. Off by default. Existing One Breath confirmation and restricted Night Out entry remain fallback behavior.

## Verified locally

375 tests pass across 36 focused and regression suites, including shared UI interactions, persistence, Decision Guard, existing voice, travel/Moments/Concierge reminders and Quiet scheduling races. App TypeScript passes.

The iOS Metro/Hermes bundle export succeeds with both internal preview flags enabled (4,640 modules). The local dependency layout was repaired without changing the original checkout. This is a bundle export, not a signed build or device acceptance.

Ten local browser projections were rendered from the actual shared component with synthetic data. Fonts, mirrored-N mark, orb, plan, Seal and safety layouts were inspected. Files in local-previews/ are local review outputs and are not physical-iPhone evidence.

## Required before release or claiming spec completion

- Complete broader context-dependent recovery policies and forwarded-reservation inputs. Manual words, existing consent/confidence-filtered calendar candidates, decline preferences, source binding, explicit follow-up intent and a Return-to-One-Breath handoff are implemented. Current guidance still comes only from the guarded command authority. The example breakfast, walk, exercise-replacement and sleep-based next-morning rules are not implemented; the app does not invent those policies or promise protection/recovery.
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
