# Redaction Standard for Validation Evidence

**Last verified:** 2026-08-03
**Applies to:** every screenshot, screen recording, log excerpt, and captured
record attached to an `EVIDENCE-TEMPLATE.md` packet.

## What evidence must never contain

- **Tokens or secrets** — OAuth access/refresh tokens, client secrets, API
  keys, encryption keys, session tokens, or any value that would let someone
  impersonate the test account or the app's server credentials.
- **Medication data** — even though AForce's health scope is hydration/
  readiness rather than clinical, a real test account's connected provider
  data (especially Apple Health) can carry unrelated medication or clinical
  records if the test device/account is a real personal one rather than a
  purpose-built test account. If a screenshot could show a Health app
  medications list, crop it out or don't take it.
- **Personal health details beyond what the test is exercising** — a
  screenshot of the Sleep screen does not need to also show an unrelated
  visible notification with someone's real heart-rate alert, or a real
  person's name/photo in a device's lock screen preview.
- **Personal account identifiers** where a purpose-built test account would
  do — real email addresses, real phone numbers, real names tied to a
  personal (not test) Oura/WHOOP account.

## How to redact

- **Screenshots:** black-box or crop out any field containing the above
  before saving. Do this at capture time where possible (use a test account
  with placeholder data) rather than relying on after-the-fact editing.
- **Screen recordings:** same standard as screenshots, applied per frame —
  a recording that only redacts the first and last frame but shows a token
  in a middle frame (e.g. a deep-link URL flashing during an OAuth redirect)
  is not redacted.
- **Logs:** strip or replace token/secret values with a fixed placeholder
  (e.g. `[REDACTED-TOKEN]`) before attaching. Prefer capturing logs with
  secret-bearing fields already excluded at the source (most of this
  codebase's logging should not print token values in the first place —
  if a log line does print one, that is itself worth flagging separately
  as a logging-hygiene issue, not just redacting and moving on).
- **Canonical record JSON:** device identifiers (`device.hardwareVersion`,
  precise `externalId` values from a real personal account) should be
  replaced with representative placeholders unless the exact value is the
  thing being verified (e.g. verifying `externalId`-based deduplication) —
  in which case keep it but confirm the account is a test account, not a
  personal one.

## What makes evidence inadmissible

Evidence that violates the above is **not partially usable with a note** —
it is inadmissible and must be recaptured. Specifically:

- Any unredacted token/secret makes the entire attachment inadmissible,
  not just the frame/field it appears in — treat the whole file as
  compromised and destroy/replace it, don't just crop the final version
  and leave the original artifact sitting in a shared location.
- Evidence captured against a real personal account (not a designated test
  account) where a test account was available is inadmissible for privacy
  reasons, independent of whether anything sensitive is actually visible —
  the standard is "don't put real personal data at risk," not "nothing bad
  happened this time."
- Evidence that cannot be traced to a specific run (missing device/build/
  timestamp context per `EVIDENCE-TEMPLATE.md`) is inadmissible as proof of
  anything, even if the screenshot itself looks fine — evidence without
  provenance is exactly the failure mode this whole program exists to
  prevent everywhere else in the stack.

If in doubt whether something needs redaction, redact it. A verdict is
never blocked on over-redaction; it is always blocked on evidence that
turns out to be inadmissible after the fact.
