import { ZodError } from "zod";
import { af } from "@/theme/afTokens";
import {
  enableIntelligenceReminders,
  reconcileIntelligenceReminders,
} from "@/services/travel/intelligenceReminders";
import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  travelTripsSchema,
  flightIdentity,
  travelProposal,
  type TravelLeg,
  type TravelTrip,
} from "@workspace/api-zod";
import { AFScreen } from "@/components/ui/AFScreen";
import {
  useTravelIntelligence,
  TravelSyncConflict,
} from "@/hooks/useTravelIntelligence";
import { useTravelJourney } from "@/hooks/useTravelJourney";
import {
  emptyTravelDocument,
  airportInstant,
  localTravelTime,
} from "@/services/travel/intelligence";
import { resolveDepartureZone } from "@/services/travel/airportTimeZone";
import {
  travelDeviceId,
  travelPushRegistration,
} from "@/services/travel/intelligenceNotifications";
const blank = () => ({
  flightNumber: "",
  origin: "",
  destination: "",
  date: "",
  time: "",
  arrivalDate: "",
  arrivalTime: "",
  departureOffset: "",
  arrivalOffset: "",
});
type LegForm = ReturnType<typeof blank> & { id?: string };
const fields: Array<[keyof ReturnType<typeof blank>, string]> = [
  ["flightNumber", "Flight number"],
  ["origin", "Departure airport"],
  ["destination", "Arrival airport"],
  ["date", "Departure date · YYYY-MM-DD"],
  ["time", "Departure time · HH:mm"],
  ["arrivalDate", "Arrival date · optional YYYY-MM-DD"],
  ["arrivalTime", "Arrival time · destination HH:mm"],
];
function formFor(leg: TravelLeg): LegForm {
  const parts = (at: string, zone: string) =>
    Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(new Date(at))
        .map((p) => [p.type, p.value]),
    );
  const d = parts(leg.departureAt, leg.originTimeZone),
    a = leg.arrivalAt ? parts(leg.arrivalAt, leg.destinationTimeZone) : null;
  return {
    id: leg.id,
    flightNumber: leg.flight.flightNumber,
    origin: leg.flight.origin,
    destination: leg.flight.destination,
    date: `${d.year}-${d.month}-${d.day}`,
    time: `${d.hour}:${d.minute}`,
    arrivalDate: a ? `${a.year}-${a.month}-${a.day}` : "",
    arrivalTime: a ? `${a.hour}:${a.minute}` : "",
    departureOffset: "",
    arrivalOffset: "",
  };
}
export function TravelIntelligenceScreen() {
  const router = useRouter(),
    travel = useTravelIntelligence(),
    legacy = useTravelJourney();
  const doc = travel.query.data;
  const [busy, setBusy] = React.useState(false),
    [message, setMessage] = React.useState(""),
    [editing, setEditing] = React.useState<string | null>(null),
    [title, setTitle] = React.useState(""),
    [forms, setForms] = React.useState<LegForm[]>([blank()]),
    [code, setCode] = React.useState(""),
    [imported, setImported] = React.useState<TravelTrip[] | null>(null),
    [conflict, setConflict] = React.useState<TravelSyncConflict | null>(null),
    [confirm, setConfirm] = React.useState<string | null>(null);
  const [connections, setConnections] = React.useState(false);
  const lock = React.useRef(false);
  const act = async (run: () => Promise<unknown>, success = "Saved.") => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      await run();
      setMessage(success);
    } catch (error) {
      if (error instanceof TravelSyncConflict) setConflict(error);
      setMessage(
        error instanceof ZodError
          ? (error.issues[0]?.message ?? "Check your itinerary.")
          : error instanceof Error
            ? error.message
            : "Could not save. Try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const button = (label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={[styles.button, busy && { opacity: 0.5 }]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
  const save = async () => {
    if (!doc) return;
    const legs = forms.map((f): TravelLeg => {
      const origin = f.origin.trim().toUpperCase(),
        destination = f.destination.trim().toUpperCase(),
        departure = airportInstant(
          origin,
          f.date,
          f.time,
          f.departureOffset || undefined,
        );
      const arrival =
        f.arrivalDate || f.arrivalTime
          ? airportInstant(
              destination,
              f.arrivalDate,
              f.arrivalTime,
              f.arrivalOffset || undefined,
            )
          : null;
      const destinationZone = resolveDepartureZone(
        destination,
        f.date,
        f.time,
      ).timeZone;
      if (!destinationZone)
        throw new Error(
          "Arrival airport time zone unavailable. Check the airport.",
        );
      return {
        id: f.id ?? Crypto.randomUUID(),
        flight: {
          flightNumber: f.flightNumber.trim().toUpperCase(),
          origin,
          destination,
          departureDate: (() => {
            const prior = doc.trips
              .flatMap((t) => t.legs)
              .find((l) => l.id === f.id);
            return prior &&
              prior.flight.flightNumber ===
                f.flightNumber.trim().toUpperCase() &&
              prior.flight.origin === origin &&
              prior.flight.destination === destination &&
              formFor(prior).date === f.date
              ? prior.flight.departureDate
              : f.date;
          })(),
        },
        departureAt: departure.at,
        arrivalAt: arrival?.at ?? null,
        originTimeZone: departure.zone,
        destinationTimeZone: destinationZone,
      };
    });
    const old = doc.trips.find((t) => t.id === editing);
    const trip = {
      id: editing === "new" ? Crypto.randomUUID() : editing!,
      title,
      legs,
      createdAt: old?.createdAt ?? new Date().toISOString(),
      completedAt: null,
    };
    await travel.save(
      travelTripsSchema.parse([
        ...doc.trips.filter((t) => t.id !== editing),
        trip,
      ]),
    );
    setEditing(null);
  };
  return (
    <AFScreen
      scroll
      edges={["top", "bottom"]}
      contentContainerStyle={{ paddingBottom: 50 }}
    >
      {button("Back", () => router.back())}
      <Text style={styles.eyebrow}>TRAVEL INTELLIGENCE · PRIVATE PILOT</Text>
      <Text style={styles.heading}>One journey. Every moment.</Text>
      <Text style={styles.copy}>
        Saved plans create departure and arrival Moments. Provider updates are
        separate until you review and accept them. AForce’s existing guidance
        remains your preparation source.
      </Text>
      {message ? (
        <Text accessibilityRole="alert" style={styles.message}>
          {message}
        </Text>
      ) : null}
      {travel.query.isError ? (
        <>
          {
            <Text style={styles.copy}>
              Saved trips could not be read. Retry before editing.
            </Text>
          }
          {button("Retry", () => void travel.query.refetch())}
        </>
      ) : null}
      {!doc ? (
        <Text style={styles.copy}>Loading trips…</Text>
      ) : (
        <>
          {conflict ? (
            <View style={styles.panel}>
              <Text style={styles.label}>Resolve sync conflict</Text>
              <Text style={styles.copy}>
                This device:{" "}
                {doc.trips
                  .map(
                    (t) =>
                      `${t.title}: ${t.legs.map((l) => `${l.flight.flightNumber} ${l.flight.origin} → ${l.flight.destination} ${localTravelTime(l.departureAt, l.originTimeZone)}`).join("; ")}`,
                  )
                  .join(" · ") || "No trips"}
                . Cloud:{" "}
                {conflict.remote.trips
                  .map(
                    (t) =>
                      `${t.title}: ${t.legs.map((l) => `${l.flight.flightNumber} ${l.flight.origin} → ${l.flight.destination} ${localTravelTime(l.departureAt, l.originTimeZone)}`).join("; ")}`,
                  )
                  .join(" · ") || "No trips"}
                . Replacing a version updates its entire trip list.
              </Text>
              {button(
                "Use cloud version",
                () =>
                  void act(async () => {
                    await travel.applyRemote(conflict.remote, true);
                    setConflict(null);
                  }, "Cloud version saved on this device."),
              )}
              {button(
                "Replace cloud with this device’s reviewed trips",
                () =>
                  void act(async () => {
                    await travel.applyRemote(
                      await travel.request("/state", "PUT", {
                        revision: conflict.remote.revision,
                        trips: doc.trips,
                        consent: true,
                      }),
                    );
                    setConflict(null);
                  }, "Cloud replaced with your reviewed version."),
              )}
              {button("Keep both versions unchanged", () => setConflict(null))}
            </View>
          ) : null}
          {legacy.query.data && !legacy.query.data.completedAt
            ? button(
                "Move my current flight into Travel Intelligence",
                () =>
                  void act(async () => {
                    const j = legacy.query.data!;
                    const originZone = resolveDepartureZone(
                        j.details.origin,
                        j.details.departureDate,
                        j.details.departureTime,
                      ).timeZone,
                      destinationZone = resolveDepartureZone(
                        j.details.destination,
                        j.details.departureDate,
                        j.details.departureTime,
                      ).timeZone;
                    if (!originZone || !destinationZone)
                      throw new Error("Confirm airport time zones first.");
                    const id = `legacy_${j.createdAt.replace(/[^0-9]/g, "")}`;
                    if (!doc.trips.some((t) => t.id === id))
                      await travel.save([
                        ...doc.trips,
                        {
                          id,
                          title: `${j.details.origin} → ${j.details.destination}`,
                          createdAt: j.createdAt,
                          completedAt: null,
                          legs: [
                            {
                              id: `${id}_leg`,
                              flight: {
                                flightNumber: j.details.flightNumber,
                                origin: j.details.origin,
                                destination: j.details.destination,
                                departureDate: j.details.departureDate,
                              },
                              departureAt: j.departureAt,
                              arrivalAt: null,
                              originTimeZone: originZone,
                              destinationTimeZone: destinationZone,
                            },
                          ],
                        },
                      ]);
                    await legacy.mutation.mutateAsync({ kind: "finish" });
                  }, "Current flight moved. Departure Moment preserved; the old preparation reminder was cancelled."),
              )
            : null}
          {button("Add a trip", () => {
            setEditing("new");
            setTitle("");
            setForms([blank()]);
          })}
          {editing ? (
            <View style={styles.panel}>
              <Text style={styles.label}>Review your itinerary</Text>
              <TextInput
                accessibilityLabel="Trip title"
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Trip name"
                placeholderTextColor={af.textTertiary}
              />
              {forms.map((f, index) => (
                <View key={index} style={styles.panel}>
                  <Text style={styles.label}>Leg {index + 1}</Text>
                  {fields.map(([key, label]) => (
                    <View key={key}>
                      <Text style={styles.copy}>{label}</Text>
                      <TextInput
                        accessibilityLabel={`Leg ${index + 1} ${label}`}
                        style={styles.input}
                        value={f[key]}
                        autoCapitalize="none"
                        autoCorrect={false}
                        onChangeText={(value) =>
                          setForms((all) =>
                            all.map((item, i) =>
                              i === index ? { ...item, [key]: value } : item,
                            ),
                          )
                        }
                      />
                    </View>
                  ))}
                  {(
                    [
                      [
                        "departureOffset",
                        "Departure",
                        f.origin,
                        f.date,
                        f.time,
                      ],
                      [
                        "arrivalOffset",
                        "Arrival",
                        f.destination,
                        f.arrivalDate,
                        f.arrivalTime,
                      ],
                    ] as const
                  ).map(([key, label, airport, date, time]) =>
                    resolveDepartureZone(airport, date, time).error?.includes(
                      "occurs twice",
                    ) ? (
                      <View key={key}>
                        <Text style={styles.copy}>
                          {label} falls in a repeated clock-change hour. Enter
                          the UTC offset confirmed by your airline.
                        </Text>
                        <TextInput
                          accessibilityLabel={`${label} UTC offset for repeated hour`}
                          value={f[key]}
                          placeholder="-04:00 or -05:00"
                          placeholderTextColor={af.textTertiary}
                          style={styles.input}
                          onChangeText={(value) =>
                            setForms((all) =>
                              all.map((item, i) =>
                                i === index ? { ...item, [key]: value } : item,
                              ),
                            )
                          }
                        />
                      </View>
                    ) : null,
                  )}
                  {forms.length > 1
                    ? button("Remove this leg", () =>
                        setForms((all) => all.filter((_, i) => i !== index)),
                      )
                    : null}
                </View>
              ))}
              {forms.length < 8
                ? button("Add connecting leg", () =>
                    setForms((all) => [
                      ...all,
                      { ...blank(), origin: all.at(-1)?.destination ?? "" },
                    ]),
                  )
                : null}
              {button(
                "Confirm itinerary",
                () =>
                  void act(
                    save,
                    "Itinerary saved. Moments updated on this device.",
                  ),
              )}
              {button("Cancel editing", () => setEditing(null))}
            </View>
          ) : null}
          {doc.trips.map((trip) => (
            <View key={trip.id} style={styles.panel}>
              <Text style={styles.heading}>{trip.title}</Text>
              {trip.completedAt ? (
                <Text style={styles.copy}>Journey finished</Text>
              ) : null}
              {trip.legs.map((leg, index) => {
                const saved = doc.observations[leg.id],
                  obs =
                    saved?.identity === flightIdentity(leg) ? saved : undefined,
                  proposal = obs ? travelProposal(leg, obs.snapshot) : null;
                const next = trip.legs[index + 1];
                return (
                  <View key={leg.id} style={styles.panel}>
                    <Text style={styles.label}>
                      {leg.flight.origin} → {leg.flight.destination} ·{" "}
                      {leg.flight.flightNumber}
                    </Text>
                    <Text style={styles.copy}>
                      Depart{" "}
                      {localTravelTime(leg.departureAt, leg.originTimeZone)}
                    </Text>
                    <Text style={styles.copy}>
                      {leg.arrivalAt
                        ? `Arrive ${localTravelTime(leg.arrivalAt, leg.destinationTimeZone)}`
                        : "Arrival time has not been confirmed."}
                    </Text>
                    {leg.arrivalAt && next ? (
                      <Text style={styles.copy}>
                        Connection:{" "}
                        {Math.round(
                          (Date.parse(next.departureAt) -
                            Date.parse(leg.arrivalAt)) /
                            60000,
                        )}{" "}
                        minutes at {leg.flight.destination}. Confirm transfer
                        requirements with your airline.
                      </Text>
                    ) : null}
                    <Text style={styles.copy}>
                      Arrival preparation appears as a recovery Moment using
                      your existing AForce guidance.
                    </Text>
                    {obs ? (
                      <Text style={styles.copy}>
                        Last provider report: {obs.snapshot.flight.status} ·
                        gate {obs.snapshot.flight.departureGate ?? "unreported"}{" "}
                        · terminal{" "}
                        {obs.snapshot.flight.departureTerminal ?? "unreported"}.
                        Checked{" "}
                        {new Date(obs.snapshot.fetchedAt).toLocaleString()}.
                        Refresh before relying on it.
                      </Text>
                    ) : null}
                    {!trip.completedAt
                      ? button(
                          "Check this flight",
                          () =>
                            void act(async () => {
                              await travel.sync();
                              const result = await travel.request(
                                "/check",
                                "POST",
                                { legId: leg.id },
                              );
                              if (result.unavailable)
                                throw new Error(
                                  "Flight status unavailable. Try again later.",
                                );
                              await travel.applyRemote(result);
                            }, "Flight report updated. Your itinerary is unchanged."),
                        )
                      : null}
                    {proposal ? (
                      <View>
                        <Text style={styles.label}>Review provider change</Text>
                        <Text style={styles.copy}>
                          Departure:{" "}
                          {proposal.departureAt
                            ? localTravelTime(
                                proposal.departureAt,
                                leg.originTimeZone,
                              )
                            : "unavailable"}
                          . Arrival:{" "}
                          {proposal.arrivalAt
                            ? localTravelTime(
                                proposal.arrivalAt,
                                leg.destinationTimeZone,
                              )
                            : "unavailable"}
                          . Accepting updates this leg and its preparation and
                          arrival Moments. Connected legs must still follow in
                          time.
                        </Text>
                        {proposal.canAccept ? (
                          button(
                            "Accept these times",
                            () =>
                              void act(async () => {
                                await travel.applyRemote(
                                  await travel.request("/accept", "POST", {
                                    revision: doc.revision,
                                    legId: leg.id,
                                    key: proposal.key,
                                  }),
                                );
                              }, "Reviewed times accepted. Moments updated."),
                          )
                        ) : (
                          <Text style={styles.copy}>
                            This report cannot update your plan. Review with
                            your airline.
                          </Text>
                        )}
                      </View>
                    ) : null}
                  </View>
                );
              })}
              {button("Edit itinerary", () => {
                setEditing(trip.id);
                setTitle(trip.title);
                setForms(trip.legs.map(formFor));
              })}
              {button(
                trip.completedAt ? "Reopen journey" : "Finish journey",
                () =>
                  setConfirm(
                    trip.completedAt
                      ? `reopen:${trip.id}`
                      : `finish:${trip.id}`,
                  ),
              )}
              {button("Remove trip", () => setConfirm(`remove:${trip.id}`))}
            </View>
          ))}
          {confirm ? (
            <View style={styles.panel}>
              <Text style={styles.copy}>
                {confirm.startsWith('clearcloud:')
                  ? 'Clear cloud and this device’s Travel Intelligence data? This removes synced trips, the AForce link, registered devices and alert jobs. This cannot be undone in the app. Other devices may retain offline copies; revoke remaining connections in TravelGate itself.'
                  : confirm.startsWith('remove:')
                    ? 'Remove this trip? Its itinerary, departure and arrival Moments will be removed. This cannot be undone in the app. Connected devices and monitoring update when sync succeeds.'
                    : confirm.startsWith('reopen:')
                      ? 'Reopen this journey? Its departure and arrival Moments become available again. Connected devices update when sync succeeds.'
                      : 'Finish this journey? Its upcoming Moments and preparation reminders stop. You can reopen it later. Connected devices and monitoring update when sync succeeds.'}
              </Text>
              {button(
                "Confirm change",
                () =>
                  void act(async () => {
                    const [kind, id] = confirm.split(":");
                    if (kind === "clearcloud") {
                      await travel.request("/state", "DELETE", {
                        confirm: true,
                      });
                      await travel.write(emptyTravelDocument());
                      setConfirm(null);
                      return;
                    }
                    await travel.save(
                      kind === "remove"
                        ? doc.trips.filter((t) => t.id !== id)
                        : doc.trips.map((t) =>
                            t.id === id
                              ? {
                                  ...t,
                                  completedAt:
                                    kind === "finish"
                                      ? new Date().toISOString()
                                      : null,
                                }
                              : t,
                          ),
                    );
                    setConfirm(null);
                  }, "Trip updated locally. Sync to update other devices and monitoring."),
              )}
              {button("Cancel", () => setConfirm(null))}
            </View>
          ) : null}
          {button("Open Moments", () => router.push("/moments"))}
          {button(
            connections
              ? "Hide sync and alert settings"
              : "Sync, account linking and reminders",
            () => setConnections((value) => !value),
          )}
          {connections ? (
            <>
              <View style={styles.panel}>
                <Text style={styles.label}>Sync and connections</Text>
                {button(
                  "Clear cloud and this device’s Travel Intelligence data",
                  () => setConfirm("clearcloud:all"),
                )}
                <Text style={styles.copy}>
                  {doc.sync
                    ? "Cloud sync is enabled. Saved edits sync when connected; foreground checks refresh other devices’ changes."
                    : "Trips stay on this device until you choose cloud sync."}{" "}
                  {doc.dirty ? "Local changes are waiting to sync." : ""}
                </Text>
                {button(
                  "Sync trips across my devices",
                  () => void act(() => travel.sync(true), "Trips synced."),
                )}
                {button(
                  "Pause cloud sync on this device",
                  () =>
                    void act(
                      () => travel.write({ ...doc, sync: false }),
                      "Sync paused. Cloud copies remain available on your other devices.",
                    ),
                )}
                <Text style={styles.copy}>
                  To connect TravelGate, sign in there, explicitly share your
                  trips, then generate a five-minute linking code.
                </Text>
                <TextInput
                  accessibilityLabel="TravelGate linking code"
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  placeholder="One-time linking code"
                  placeholderTextColor={af.textTertiary}
                />
                {button(
                  "Connect TravelGate",
                  () =>
                    void act(async () => {
                      await travel.request("/link", "POST", {
                        code: code.trim(),
                        consent: true,
                      });
                      await travel.write({ ...travel.current(), linked: true });
                      setCode("");
                    }, "TravelGate connected. Review shared trips before importing."),
                )}
                {doc.linked ? (
                  <>
                    {button(
                      "Review shared TravelGate trips",
                      () =>
                        void act(async () => {
                          const result = await travel.request("/linked-trips");
                          setImported(travelTripsSchema.parse(result.trips));
                        }, "Review the shared trips below."),
                    )}
                    {button(
                      "Disconnect TravelGate",
                      () =>
                        void act(async () => {
                          await travel.request("/link", "DELETE");
                          await travel.write({
                            ...travel.current(),
                            linked: false,
                          });
                        }, "AForce disconnected. You can revoke all remaining AForce connections in TravelGate."),
                    )}
                  </>
                ) : null}
                {imported ? (
                  <View>
                    <Text style={styles.label}>Import review</Text>
                    {imported.map((t) => (
                      <Text key={t.id} style={styles.copy}>
                        {t.title} ·{" "}
                        {t.legs
                          .map(
                            (l) =>
                              `${l.flight.flightNumber}: ${l.flight.origin} → ${l.flight.destination}`,
                          )
                          .join(", ")}
                      </Text>
                    ))}
                    {button(
                      "Confirm import",
                      () =>
                        void act(async () => {
                          const existing = new Set(doc.trips.map((t) => t.id));
                          const added = imported
                            .filter((t) => !existing.has(`tg_${t.id}`))
                            .map((t) => ({
                              ...t,
                              id: `tg_${t.id}`,
                              legs: t.legs.map((l) => ({
                                ...l,
                                id: `tg_${l.id}`,
                              })),
                            }));
                          await travel.save(
                            travelTripsSchema.parse([...doc.trips, ...added]),
                          );
                          setImported(null);
                        }, "Trips imported locally. Sync to publish them."),
                    )}
                    {button("Cancel import", () => setImported(null))}
                  </View>
                ) : null}
                {button(
                  "Enable cloud sync and flight-change alerts on this device",
                  () =>
                    void act(async () => {
                      await travel.sync(true);
                      const capability = await travel.request("/state");
                      if (!capability.monitoringAvailable)
                        throw new Error(
                          "Flight-change alerts have not been activated for this pilot.",
                        );
                      await travel.request(
                        "/device",
                        "POST",
                        await travelPushRegistration(),
                      );
                    }, "Flight-change monitoring enabled. Alerts appear only when a later provider check detects a change."),
                )}
                <Text style={styles.copy}>
                  Preparation reminders are optional, two hours before each
                  departure. Reminders during 10 PM–7 AM at the departure
                  airport are skipped.
                </Text>
                {button(
                  "Enable preparation reminders",
                  () =>
                    void act(async () => {
                      await enableIntelligenceReminders();
                      await travel.write({
                        ...travel.current(),
                        reminders: true,
                      });
                      await reconcileIntelligenceReminders(
                        travel.owner!,
                        travel.current().trips,
                        true,
                      );
                    }, "Preparation reminders enabled for eligible future departures."),
                )}
                {button(
                  "Turn off preparation reminders",
                  () =>
                    void act(async () => {
                      await travel.write({
                        ...travel.current(),
                        reminders: false,
                      });
                      await reconcileIntelligenceReminders(
                        travel.owner!,
                        [],
                        false,
                      );
                    }, "Preparation reminders turned off."),
                )}
                {button(
                  "Turn off flight-change alerts on this device",
                  () =>
                    void act(async () => {
                      await travel.request("/device", "DELETE", {
                        deviceId: await travelDeviceId(),
                      });
                    }, "Flight-change alerts disabled on this device."),
                )}
              </View>
            </>
          ) : null}
        </>
      )}
    </AFScreen>
  );
}
const styles = StyleSheet.create({
  heading: {
    color: af.textPrimary,
    fontSize: 28,
    fontWeight: "700",
    marginVertical: 14,
  },
  eyebrow: { color: af.redText, fontSize: 13, letterSpacing: 2, marginTop: 24 },
  copy: {
    color: af.textSecondary,
    fontSize: 16,
    lineHeight: 25,
    marginVertical: 8,
  },
  label: {
    color: af.textPrimary,
    fontSize: 20,
    fontWeight: "600",
    marginVertical: 10,
  },
  panel: {
    borderTopWidth: 1,
    borderColor: af.divider,
    paddingTop: 18,
    marginTop: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: af.textTertiary,
    borderRadius: 8,
    color: af.textPrimary,
    padding: 14,
    fontSize: 17,
    marginVertical: 8,
  },
  button: {
    borderWidth: 1,
    borderColor: af.textTertiary,
    padding: 17,
    marginVertical: 7,
    borderRadius: 6,
  },
  buttonText: {
    color: af.textPrimary,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  message: {
    color: af.amber,
    fontSize: 16,
    lineHeight: 24,
    marginVertical: 15,
  },
});
