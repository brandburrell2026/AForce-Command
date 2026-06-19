---
name: AForce QR activation funnel (pure foundation)
description: Day-1 pure activation engine — deep-link trust rules + conversion-chronology rule, and the Phase-2 boundary that needs owner sign-off.
---

# QR Activation funnel — pure foundation

Day-1 shipped a PURE, headless, deterministic engine only, under `utils/activation/`
(`attribution.ts` + `funnel.ts`), unit-tested in `utils/__tests__/`. No app-boot
wiring, no new analytics event types, no server/DB aggregation — those are an
explicitly-deferred **Phase 2** that requires owner sign-off ("Ask before major
changes"). Flag OFF byte-identical; nothing mutates score (Score-Protection).

## Durable rules (keep future work consistent)

- **Activation deep-link trust = scheme + host allow-list + exact path segment, NEVER substring.**
  `isActivationLink()` must reject substring look-alikes (`/deactivate`, `?activate=1`),
  schemeless bare paths, and untrusted/look-alike hosts (`evil.com`,
  `aforce.app.evil.com`, `evilaforce.app`). Trust = custom scheme `aforce-os://activate`
  OR an `http(s)` link whose host is in `TRUSTED_ACTIVATION_HOSTS` with first path
  segment exactly `activate`/`activation`.
  **Why:** a permissive substring match lets a hostile QR/link poison acquisition
  attribution (SKU/retail/geo) before any server exists.

- **`TRUSTED_ACTIVATION_HOSTS` must stay in lockstep with app.json `associatedDomains` (iOS) + Android App-Links hosts.**
  It's the single source of trusted web hosts; Phase-2 universal-link config and this
  list drift independently and will silently drop real attribution if they diverge.
  Phase-2 should also consider restricting web links to `https`-only (Day-1 allows
  `http` too — non-blocking because the host allow-list is the real gate and links
  carry no secrets).

- **Conversion counts require chronological progression.** `aggregateConversion()`
  counts a conversion only when both endpoints reached AND `elapsedMsBetween(from,to) !== null`
  (i.e. `to >= from`; simultaneous delta-0 counts). **Why:** out-of-order / clock-skewed
  milestones otherwise inflate headline rates (Scan→Install, Install→Activation,
  Activation→Subscription).

## Semantics worth remembering
- "Activation" = **First Command Completed** (start of the habit loop), not install.
- The visible funnel ends at the Day-7 subscription OFFER; `subscription_started` is the
  paid-outcome milestone (tracked, not a visible stage) so Activation→Subscription can
  measure the real subscribe.
