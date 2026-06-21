---
name: AForce QR activation funnel (end-to-end)
description: Activation tracking now spans mobile emission → server aggregation → founder Command Center panel; deep-link trust rules, conversion chronology, and the pseudonymity-aggregation rule.
---

# QR Activation funnel — end-to-end

The deterministic core lives in the shared lib **`lib/activation-core/`**
(`src/attribution.ts` + `src/funnel.ts`, tested in `src/__tests__/`) — NOT the old
`utils/activation/` path. Tracking is now WIRED END-TO-END (the old "pure-only,
Phase-2 deferred" note is obsolete):
- **Mobile (aforce-os):** emits `qr_scanned` + the rest of the contract events via a
  consent-gated, dedupe-safe activation pipeline driven by a deep-link observer.
- **Server (api-server):** `lib/activationFunnel.ts` (`buildActivationFunnel` + Zod
  `ActivationFunnelSchema`) reuses the activation-core engine; surfaced behind the
  founder-gated route `GET /api/admin/command-center/activation-funnel` plus the
  legacy retention gate **G5 (QR Scan → Activated)**.
- **Command Center (web):** the **Activation** panel (`/activation`) hand-mirrors the
  server DTO (local fetch client, never the consumer api-client).

`INSTRUMENTED_STAGES` flags which owner stages have a real event behind them;
un-instrumented stages stay visible but read "not instrumented", never a fabricated 0.
Flag OFF byte-identical; nothing mutates score (Score-Protection). QR capture UI =
`CameraScanModal.tsx` (barcode/QR, framed for hydration-product scanning).

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

- **Any conversion-rate numerator must be a SUBSET of its denominator.** Marketing
  attribution's `subscribeRate` = `converted / scanned`, where `converted` = scanners who
  THEN subscribed chronologically (reuse `elapsedMsBetween`), NOT the raw `subscribers`
  count. Keep the raw paid count in a separate `subscribers` field. **Why:** paid
  subscribers can exist outside the scanned cohort (organic / unattributed), so a raw
  `subscribers / scanned` can exceed 1 — which both lies (>100% conversion) AND fails the
  Zod `max(1)` on the DTO, throwing and 500-ing the founder route. **How to apply:** every
  rate built over a mixed cohort needs its own subset numerator + a mixed-cohort test
  (scanned + unscanned subscribers must stay ≤100% and parse the schema).

- **Founder analytics queries are aggregate-only + pseudonymous.** The funnel SQL may
  `GROUP BY analytics_id` but must NEVER `SELECT` it or join user/subscription PII —
  return only counts/rates/coarse attribution (sku/retailLocationId/geo/campaign).
  **Why:** analytics is keyed by pseudonymous `anon_...` ids; surfacing the id (or PII)
  in a reporting payload breaks the pseudonymity lock even inside the founder cockpit.
  **How to apply:** any new Command Center analytics route mirrors this — aggregate in
  SQL, hand rows to a pure builder, never ship per-identity rows to the client.

## Semantics worth remembering
- "Activation" = **First Command Completed** (start of the habit loop), not install.
- The visible funnel ends at the Day-7 subscription OFFER; `subscription_started` is the
  paid-outcome milestone (tracked, not a visible stage) so Activation→Subscription can
  measure the real subscribe.
