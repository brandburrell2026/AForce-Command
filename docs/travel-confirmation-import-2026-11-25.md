# Travel confirmation import — staging beta

## Member flow

Travel → **Import a flight confirmation** → paste the itinerary text from an
email → **Review imported flights** → correct the editable itinerary →
**Confirm itinerary**. A saved active flight offers **Check flight status**
through AFORCE's authenticated TravelGate bridge, without requiring cloud sync
of the trip list. Existing cloud-enabled journeys retain their reviewed
provider-change flow.

The original Add a trip / One Breath entry stays available. Nothing saves on
paste or Review. The existing travel owner validates airport time zones, DST,
chronology, connecting airports and duplicate active flights before saving.
Pasted passenger names, booking references and contact details are not included
in the extracted fields, saved document or flight-status request. The raw text
is not sent to a model, provider or inbox service, and is cleared on review,
cancel or account change.

## Supported first version

- Plain text with explicit flight identifiers, From/To or airport-code routes,
  and labeled departure/arrival details. Recognizes common US carrier names
  and a defined set of carrier codes; this is text recognition, not an airline
  account integration or a guarantee of live coverage for every carrier.
- Up to eight flight entries, all shown in the editable review. Oversized or
  unrecognized input is rejected; extra flights are never silently dropped.
- Dates need an explicit year. Ambiguous slash dates and clocks without clear
  AM/PM or 24-hour evidence stay blank. UTC timestamps are not mistaken for
  local airport time. Arrival day is never copied from departure by default.
- Explicit, on-demand flight checks only. No new background polling, monitoring
  subscription, notification permission or itinerary rewrite occurs.
- The status panel shows provider/fetch evidence, expires stale reports, and
  retains an honestly labeled last-known report after a failed refresh.

## Existing TravelGate provider access

The owner explicitly selected existing TravelGate provider access. A read-only
smoke on November 25 returned a matching FlightAware observation through the
existing TravelGate bridge for public flight AA100 / JFK–LHR / November 25.
Only the existing bridge credential is reused server-side on the isolated
AFORCE candidate staging service. It is never placed in source, app bundles,
chat or reports. Flight checking is enabled for one identified staging pilot.
Production configuration and TravelGate production code/deployment are unchanged.

Cloud Travel Intelligence/account linking remains gated. Its staging identity
deletion webhook and broader pilot setup have not been provisioned. No dummy
signing secret or authentication override is introduced to activate those paths.

## Acceptance

Automated coverage includes carrier/code extraction, multiple flights,
contradictions, invalid/ambiguous dates and clocks, passenger-data exclusion,
review/cancel/busy behavior, no save before confirmation, editable local-time
conversion, duplicate protection, storage failure, account-switch clearing and
the minimal four-field authenticated flight-status request. Existing One Breath
handoff and trip-entry behavior are checked alongside the new flow.

Simulator acceptance and the full CI result must be recorded before a beta
update is recommended. Physical iPhone/Android acceptance remains separate.

## Follow-up phases

Automatic email forwarding/inbox ingestion, background flight monitoring and
connected carrier loyalty profiles are not part of this local-import version.
TravelGate's existing inbound-email/account-grant integration is the next path
to evaluate, including actual consent, supported carrier coverage, revocation,
deletion and commercial provider access. No universal airline login, mileage
balance sync, booking change/check-in or all-carrier compatibility is claimed.
