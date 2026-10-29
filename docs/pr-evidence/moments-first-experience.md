# Combined Moments-first direction — internal app

Brandon approved implementing the combined direction on 2026-10-28 after a live comparison of Julius's Moment prototype and Figma Black Issue Social Brief (file VlcxuqlYiEEOeNKZuwi0WL, frames 8:2, 8:73, 50:50).

This approval covers the navigation exception to Build Rule 14: the internal binary exchanges the visible Protocol destination for Moments while retaining five tabs and the original Protocol route. Normal public binaries retain their current Home and navigation. It does not authorize calculation, legal, privacy, calendar-ingestion, or voice-engine changes.

## Behavior

- Internal Home uses the established guarded Editorial Home data chain in a focused composition: next Moment context, explicit planning entry, compact HydroState, one canonical command, current evidence and daily progress, explicit water picker. Skin intelligence and Protocol remain reachable.
- Moments is a direct tab with the existing three-day planner and the private TravelGate management entry. Flights continue to derive one Moment from the owner-scoped journey; flight provider checks are unchanged.
- One Breath is type-first. Review copies the member's words into an editable name; it never guesses a schedule. Explicit date/time, type, and optional preparation goal are reviewed before Confirm plan. Existing account-scoped Moments storage is the only write destination. No write occurs on draft, review, edit, back, or dismissal.
- Confirmation rejects invalid, past, nonexistent and repeated local times. The screen displays its device time zone and directs airport-based schedules to Travel.
- Signed-out/unresolved identity cannot commit. Scope changes invalidate an in-flight draft; a synchronous commit latch prevents duplicate submissions. Normal public One Breath remains its existing review-only shell.
- No microphone capture, transcription, new recommendation engine, hydration credit, Circle sharing, booking, calendar writes, or notification preference changes. Existing Moment preparation scheduling still respects existing preferences.

## Validation

Validation and runtime evidence are recorded with this change; local preview evidence is distinct from a native TestFlight/device acceptance.

- 788 tests passed across 61 focused suites (Home, Moments, Hydration, Travel, account-switch/draft confirmation, visibility and editorial truth guards).
- Expo/mobile TypeScript check passed. The test-only fetch mock explicitly accepts both native and DOM fetch signatures.
- Browser runtime at 393×852: invalid date/time rejected; review editable; explicit confirmation created one marked UI-test Moment; reload retained it; Home and the direct Moments tab reflected it. Browser account data is separate from iPhone travel storage.
- Native binary and on-device acceptance are separate release gates.
