# Completed Moment display correction

On internal TestFlight build 135, an owner-authorized test Moment was saved once and marked ready. Its detail remained Completed after leaving and reopening the app. Home still selected it as Next Moment, and the editorial planner omitted the Done label while its start time remained in the future. The four Nov 3 Moments were not edited.

The existing nextMoment selector now skips prepared records, retaining their planner history. The editorial row honors preparedAtIso before deriving the time-based presentation state. No preparation times, hydration actions, scoring, storage writes, or notification preferences change.

Regression validation: 145 focused tests across 13 suites passed, including Home advancement, retained planner history, all-prepared absence, and visible/spoken Done on a prepared future row. Mobile TypeScript check recorded in release progress.

Native reminder review: Moment prep on; Important moments only; lead time Prep window. Settings unchanged. Native notification delivery and OS authorization remain unverified.
