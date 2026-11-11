import { createChunkStorage } from "./chunkStorage";
import { z } from "zod";
import {
  travelTripsSchema,
  flightIdentity,
  travelSnapshotSchema,
  type TravelTrip,
} from "@workspace/api-zod";
import type { Moment } from "@/types/moments";
import { resolveDepartureZone } from "./airportTimeZone";
import type { JourneyStorage } from "./journey";
export const travelDocumentSchema = z.object({
  localVersion: z.number().int().nonnegative().default(0),
  trips: travelTripsSchema,
  revision: z.number().int().nonnegative(),
  dirty: z.boolean(),
  sync: z.boolean(),
  reminders: z.boolean().default(false),
  linked: z.boolean(),
  observations: z.record(
    z.string(),
    z.object({ identity: z.string(), snapshot: travelSnapshotSchema }),
  ),
});
export type TravelDocument = z.infer<typeof travelDocumentSchema>;
export const emptyTravelDocument = (): TravelDocument => ({
  localVersion: 0,
  trips: [],
  revision: 0,
  dirty: false,
  sync: false,
  reminders: false,
  linked: false,
  observations: {},
});
export function createTravelDocuments(adapter: JourneyStorage) {
  const storage = createChunkStorage(adapter);
  const key = (owner: string) =>
    `aforce.travel.v2.${Array.from(owner)
      .map((c) => c.codePointAt(0)!.toString(16))
      .join("_")}`;
  const queues = new Map<string, Promise<unknown>>();
  const load = async (owner: string) => {
    const raw = await storage.getItem(key(owner));
    if (!raw) return emptyTravelDocument();
    if (raw.length > 500000) throw new Error("Travel data cannot be read.");
    return travelDocumentSchema.parse(JSON.parse(raw));
  };
  return {
    load,
    save(owner: string, document: TravelDocument, expectedVersion?: number) {
      const parsed = travelDocumentSchema.parse(document);
      const identities = new Map(
        parsed.trips
          .filter((t) => !t.completedAt)
          .flatMap((t) => t.legs.map((l) => [l.id, flightIdentity(l)])),
      );
      parsed.observations = Object.fromEntries(
        Object.entries(parsed.observations).filter(
          ([id, obs]) => identities.get(id) === obs.identity,
        ),
      );
      const prior = queues.get(owner) ?? Promise.resolve();
      const next = prior
        .catch(() => undefined)
        .then(async () => {
          if (
            expectedVersion !== undefined &&
            (await load(owner)).localVersion !== expectedVersion
          )
            throw new Error(
              "Travel changed while saving. Your newer saved version was kept.",
            );
          await storage.setItem(key(owner), JSON.stringify(parsed));
        });
      queues.set(owner, next);
      return next;
    },
  };
}
export function airportInstant(
  airport: string,
  date: string,
  time: string,
  explicitOffset?: string,
) {
  const zone = resolveDepartureZone(airport, date, time);
  if (explicitOffset && zone.timeZone && !zone.invalidLocalTime) {
    if (!/^[+-](?:0[0-9]|1[0-4]):[0-5][0-9]$/.test(explicitOffset))
      throw new Error("Enter an airline-confirmed UTC offset, such as -04:00.");
    const instant = new Date(`${date}T${time}:00${explicitOffset}`);
    if (!Number.isFinite(instant.getTime()))
      throw new Error("Check the date and time.");
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: zone.timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(instant)
        .map((p) => [p.type, p.value]),
    );
    if (
      `${p.year}-${p.month}-${p.day}` !== date ||
      `${p.hour}:${p.minute}` !== time
    )
      throw new Error(
        "That offset does not match the airport time on this date.",
      );
    return { at: instant.toISOString(), zone: zone.timeZone };
  }
  if (!zone.timeZone || !zone.utcOffset || zone.error)
    throw new Error(
      zone.error ?? "Enter a valid airport date and 24-hour time.",
    );
  const instant = new Date(`${date}T${time}:00${zone.utcOffset}`);
  if (!Number.isFinite(instant.getTime()))
    throw new Error("Check the date and time.");
  return { at: instant.toISOString(), zone: zone.timeZone };
}
export function tripMoments(trips: TravelTrip[]): Moment[] {
  return trips
    .filter((t) => !t.completedAt)
    .flatMap((trip) =>
      trip.legs.flatMap((leg) => {
        const base = {
          source: "manual" as const,
          importance: "moderate" as const,
          createdAtIso: trip.createdAt,
        };
        return [
          {
            ...base,
            id: `travel2:${trip.id}:${leg.id}:departure`,
            title: `${leg.flight.origin} → ${leg.flight.destination} · ${leg.flight.flightNumber}`,
            type: "travel" as const,
            startAtIso: leg.departureAt,
            preparedAtIso: leg.departurePreparedAt ?? undefined,
            prepGoal: `Departure at ${localTravelTime(leg.departureAt, leg.originTimeZone)}. Open Travel Intelligence for status and connections.`,
          },
          ...(leg.arrivalAt
            ? [
                {
                  ...base,
                  id: `travel2:${trip.id}:${leg.id}:arrival`,
                  title: `Arrive in ${leg.flight.destination}`,
                  type: "recovery" as const,
                  startAtIso: leg.arrivalAt,
                  preparedAtIso: leg.arrivalPreparedAt ?? undefined,
                  prepGoal: `Destination time ${localTravelTime(leg.arrivalAt, leg.destinationTimeZone)}. Follow your existing AForce recovery guidance.`,
                },
              ]
            : []),
        ];
      }),
    );
}
export function mergeIntelligenceMoments(base: Moment[], trips: TravelTrip[]) {
  const projected = tripMoments(trips);
  const departures = projected.filter((m) => m.type === "travel");
  return [
    ...base.filter(
      (m) =>
        !m.id.startsWith("travel2:") &&
        !departures.some(
          (p) =>
            Date.parse(p.startAtIso) === Date.parse(m.startAtIso) &&
            m.type === "travel" &&
            (p.title === m.title ||
              m.title.trim().toUpperCase() ===
                `FLIGHT TO ${p.title.split(" → ")[1]?.split(" · ")[0]}`),
        ),
    ),
    ...projected,
  ];
}
export function localTravelTime(iso: string, zone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: zone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function markTravelPrepared(
  trips: TravelTrip[],
  momentId: string,
  at = new Date().toISOString(),
): TravelTrip[] {
  const [prefix, tripId, legId, stage] = momentId.split(":");
  if (prefix !== "travel2" || !["departure", "arrival"].includes(stage))
    throw new Error("Unknown travel Moment.");
  const trip = trips.find((t) => t.id === tripId && !t.completedAt),
    leg = trip?.legs.find((l) => l.id === legId);
  if (!leg || (stage === "arrival" && !leg.arrivalAt))
    throw new Error("Journey changed. Open Moments again.");
  return travelTripsSchema.parse(
    trips.map((t) =>
      t.id !== tripId
        ? t
        : {
            ...t,
            legs: t.legs.map((l) =>
              l.id !== legId
                ? l
                : {
                    ...l,
                    [stage === "departure"
                      ? "departurePreparedAt"
                      : "arrivalPreparedAt"]: at,
                  },
            ),
          },
    ),
  );
}
