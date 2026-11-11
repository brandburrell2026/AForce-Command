/** Shared, versioned travel data. Itinerary is member-confirmed; observations are server-owned. */
import { z } from "zod";
import {
  travelFlightRequestSchema,
  travelFlightObservationSchema,
  TRAVEL_FRESHNESS_MS,
  matchesTravelFlight,
} from "./travelBridge";
const iso = z.string().datetime({ offset: true });
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const zone = z
  .string()
  .max(80)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }, "Invalid time zone");
export const travelLegSchema = z
  .object({
    id,
    flight: travelFlightRequestSchema,
    departureAt: iso,
    arrivalAt: iso.nullable(),
    originTimeZone: zone,
    destinationTimeZone: zone,
    departurePreparedAt: iso.nullable().optional(),
    arrivalPreparedAt: iso.nullable().optional(),
  })
  .strict()
  .superRefine((leg, ctx) => {
    if (
      leg.arrivalAt &&
      Date.parse(leg.arrivalAt) <= Date.parse(leg.departureAt)
    )
      ctx.addIssue({
        code: "custom",
        message: "Arrival must follow departure.",
        path: ["arrivalAt"],
      });
  });
export const travelTripSchema = z
  .object({
    id,
    title: z.string().trim().min(1).max(120),
    legs: z.array(travelLegSchema).min(1).max(8),
    completedAt: iso.nullable(),
    createdAt: iso,
  })
  .strict()
  .superRefine((trip, ctx) => {
    if (new Set(trip.legs.map((leg) => leg.id)).size !== trip.legs.length)
      ctx.addIssue({
        code: "custom",
        message: "Leg identifiers must be unique.",
      });
    trip.legs.forEach((leg, index) => {
      const previous = trip.legs[index - 1];
      if (
        previous &&
        (previous.flight.destination !== leg.flight.origin ||
          Date.parse(previous.arrivalAt ?? previous.departureAt) >=
            Date.parse(leg.departureAt))
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Connected legs must share an airport and follow in time.",
          path: ["legs", index],
        });
      }
    });
  });
export const travelTripsSchema = z
  .array(travelTripSchema)
  .max(20)
  .superRefine((trips, ctx) => {
    const active=trips.filter(t=>!t.completedAt).flatMap(t=>t.legs.map(flightIdentity));
    if(new Set(active).size!==active.length)ctx.addIssue({code:'custom',message:'This flight is already in an active trip. Edit that trip instead of adding it twice.'});

    if (
      new Set(trips.map((trip) => trip.id)).size !== trips.length ||
      new Set(trips.flatMap((trip) => trip.legs.map((leg) => leg.id))).size !==
        trips.reduce((sum, trip) => sum + trip.legs.length, 0)
    )
      ctx.addIssue({
        code: "custom",
        message: "Trip and leg identifiers must be unique.",
      });
  });
export const travelSnapshotSchema = z
  .object({
    version: z.literal(2),
    provider: z.literal("flightaware"),
    availability: z.enum(["available", "stale"]),
    fetchedAt: iso,
    flight: travelFlightObservationSchema
      .extend({
        scheduledArrival: iso.nullable(),
        estimatedArrival: iso.nullable(),
        actualArrival: iso.nullable(),
        actualDeparture: iso.nullable(),
        originTimeZone: zone,
        destinationTimeZone: zone,
      })
      .strict(),
  })
  .strict();
export const travelSnapshotResponseSchema = z.union([
  travelSnapshotSchema,
  z
    .object({
      version: z.literal(2),
      availability: z.literal("unavailable"),
      reason: z.string().max(80),
    })
    .strict(),
]);
export const travelCloudStateSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    trips: travelTripsSchema,
  })
  .strict();
export const travelSyncRequestSchema = travelCloudStateSchema
  .extend({ consent: z.literal(true) })
  .strict();
export const travelLinkCodeSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const travelDeviceSchema = z
  .object({
    deviceId: id,
    token: z.string().regex(/^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/),
    enabled: z.boolean(),
    consent: z.literal(true),
  })
  .strict();
export type TravelLeg = z.infer<typeof travelLegSchema>;
export type TravelTrip = z.infer<typeof travelTripSchema>;
export type TravelSnapshot = z.infer<typeof travelSnapshotSchema>;
export type TravelSnapshotResponse = z.infer<
  typeof travelSnapshotResponseSchema
>;
export type TravelCloudState = z.infer<typeof travelCloudStateSchema>;

export function flightIdentity(leg: TravelLeg): string {
  return JSON.stringify([
    leg.flight.flightNumber,
    leg.flight.departureDate,
    leg.flight.origin,
    leg.flight.destination,
  ]);
}
export function freshMatchingSnapshot(
  leg: TravelLeg,
  snapshot: TravelSnapshot,
  now = Date.now(),
): boolean {
  const age = now - Date.parse(snapshot.fetchedAt);
  return (
    snapshot.availability === "available" &&
    age >= -30_000 &&
    age < TRAVEL_FRESHNESS_MS &&
    matchesTravelFlight(leg.flight, snapshot.flight)
  );
}
export function flightChanges(
  before: TravelSnapshot | null,
  after: TravelSnapshot,
): Array<{ field: string; before: string | null; after: string | null }> {
  if (!before || !matchesTravelFlight(before.flight, after.flight)) return [];
  const fields = [
    "status",
    "estimatedDeparture",
    "estimatedArrival",
    "departureGate",
    "departureTerminal",
  ] as const;
  return fields
    .filter((field) => before.flight[field] !== after.flight[field])
    .map((field) => ({
      field,
      before: before.flight[field],
      after: after.flight[field],
    }));
}
export function travelProposal(
  leg: TravelLeg,
  snapshot: TravelSnapshot,
  now = Date.now(),
) {
  if (!freshMatchingSnapshot(leg, snapshot, now)) return null;
  const departureAt =
    snapshot.flight.estimatedDeparture ?? snapshot.flight.scheduledDeparture;
  const arrivalAt =
    snapshot.flight.actualArrival ??
    snapshot.flight.estimatedArrival ??
    snapshot.flight.scheduledArrival;
  const changed =
    (departureAt && Date.parse(departureAt) !== Date.parse(leg.departureAt)) ||
    (arrivalAt && Date.parse(arrivalAt) !== Date.parse(leg.arrivalAt ?? ""));
  if (!changed) return null;
  const canAccept =
    !!departureAt &&
    !["cancelled", "diverted", "unknown"].includes(snapshot.flight.status) &&
    (!arrivalAt || Date.parse(arrivalAt) > Date.parse(departureAt));
  return {
    key: JSON.stringify([
      leg.id,
      leg.departureAt,
      leg.arrivalAt,
      departureAt,
      arrivalAt,
      snapshot.flight.status,
    ]),
    departureAt,
    arrivalAt,
    canAccept,
  };
}
export function acceptTravelProposal(
  trips: TravelTrip[],
  legId: string,
  snapshot: TravelSnapshot,
  key: string,
  now = Date.now(),
): TravelTrip[] {
  const leg = trips
    .flatMap((trip) => trip.legs)
    .find((leg) => leg.id === legId);
  if (!leg) throw new Error("Journey changed. Review it again.");
  const proposal = travelProposal(leg, snapshot, now);
  if (!proposal?.canAccept || proposal.key !== key)
    throw new Error("This proposal changed or expired. Check again.");
  return travelTripsSchema.parse(
    trips.map((trip) => ({
      ...trip,
      legs: trip.legs.map((item) =>
        item.id === legId
          ? {
              ...item,
              departureAt: proposal.departureAt!,
              arrivalAt: proposal.arrivalAt,
              ...(item.departurePreparedAt &&
              Date.parse(item.departureAt) !== Date.parse(proposal.departureAt!)
                ? { departurePreparedAt: null }
                : {}),
              ...(item.arrivalPreparedAt &&
              item.arrivalAt !== proposal.arrivalAt
                ? { arrivalPreparedAt: null }
                : {}),
            }
          : item,
      ),
    })),
  );
}
