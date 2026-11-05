import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { preparationTokens as T } from "@/theme/DESIGN-TOKENS";
import type { MomentDraft } from "@/services/momentDraft";

const pad = (n: number) => String(n).padStart(2, "0");
const deviceZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
function zones() {
  const intl = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };
  return [
    ...new Set([
      deviceZone(),
      "UTC",
      ...(intl.supportedValuesOf?.("timeZone") ?? [
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
        "America/Phoenix",
        "America/Anchorage",
        "Pacific/Honolulu",
        "Europe/London",
        "Europe/Paris",
        "Asia/Dubai",
        "Asia/Kolkata",
        "Asia/Tokyo",
        "Australia/Sydney",
      ]),
    ]),
  ];
}

/** Selection changes only the unsealed draft. No device calendar access is requested. */
export function MomentTimingPicker({
  draft,
  onChange,
}: {
  draft: MomentDraft;
  onChange: (key: "date" | "time" | "timeZone", value: string) => void;
}) {
  const [open, setOpen] = React.useState<"date" | "time" | "zone" | null>(null);
  const [month, setMonth] = React.useState(() => new Date().getMonth());
  const [year, setYear] = React.useState(() => new Date().getFullYear());
  const [search, setSearch] = React.useState("");
  const availableZones = React.useMemo(zones, []);
  const [hour, minute] = /^\d{2}:\d{2}$/.test(draft.time)
    ? draft.time.split(":").map(Number)
    : [12, 0];
  const chooseTime = (h: number, m: number) =>
    onChange("time", `${pad(h)}:${pad(m)}`);
  const choice = (
    label: string,
    action: () => void,
    selected = false,
    key = label,
  ) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={action}
      style={[s.choice, selected && s.selected]}
    >
      <Text style={s.text}>{label}</Text>
    </Pressable>
  );
  const toggle = (kind: "date" | "time" | "zone") => {
    if (kind === "date" && /^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
      const [y, m] = draft.date.split("-").map(Number);
      if (m! >= 1 && m! <= 12) {
        setYear(y!);
        setMonth(m! - 1);
      }
    }
    setOpen(open === kind ? null : kind);
  };
  const heading = (label: string, kind: "date" | "time" | "zone") => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: open === kind }}
      onPress={() => toggle(kind)}
      style={s.trigger}
    >
      <Text style={s.text}>{label}</Text>
    </Pressable>
  );
  const moveMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setMonth(next.getMonth());
    setYear(next.getFullYear());
  };
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  return (
    <View style={s.container}>
      {heading(`Choose date · ${draft.date || "Not selected"}`, "date")}
      {open === "date" && (
        <View accessibilityLabel="Moment calendar" style={s.panel}>
          <View style={s.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              onPress={() => moveMonth(-1)}
              style={s.choice}
            >
              <Text style={s.text}>‹</Text>
            </Pressable>
            <Text accessibilityRole="header" style={s.text}>
              {new Date(year, month, 1).toLocaleDateString([], {
                month: "long",
                year: "numeric",
              })}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next month"
              onPress={() => moveMonth(1)}
              style={s.choice}
            >
              <Text style={s.text}>›</Text>
            </Pressable>
          </View>
          <View style={s.week}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <Text key={d} style={s.weekday}>
                {d}
              </Text>
            ))}
          </View>
          <View style={s.grid}>
            {Array.from({ length: firstDay }, (_, i) => (
              <View key={`blank-${i}`} style={s.day} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const date = `${year}-${pad(month + 1)}-${pad(i + 1)}`;
              return (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${date}`}
                  accessibilityState={{ selected: draft.date === date }}
                  style={[s.day, draft.date === date && s.selected]}
                  onPress={() => {
                    onChange("date", date);
                    setOpen(null);
                  }}
                >
                  <Text style={s.text}>{i + 1}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      {heading(`Choose time · ${draft.time || "Not selected"}`, "time")}
      {open === "time" && (
        <View style={s.panel}>
          <Text style={s.text}>Hour · Minute · AM / PM</Text>
          <View style={s.row}>
            <ScrollView
              style={s.column}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              accessibilityLabel="Choose hour"
            >
              {Array.from({ length: 12 }, (_, i) =>
                choice(
                  `Hour ${i + 1}`,
                  () =>
                    chooseTime(
                      ((i + 1) % 12) + (hour! >= 12 ? 12 : 0),
                      minute!,
                    ),
                  hour! % 12 === (i + 1) % 12,
                ),
              )}
            </ScrollView>
            <ScrollView
              style={s.column}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              accessibilityLabel="Choose minute"
            >
              {Array.from({ length: 60 }, (_, i) =>
                choice(
                  `Minute ${pad(i)}`,
                  () => chooseTime(hour!, i),
                  minute === i,
                ),
              )}
            </ScrollView>
            <View>
              {choice("AM", () => chooseTime(hour! % 12, minute!), hour! < 12)}
              {choice(
                "PM",
                () => chooseTime((hour! % 12) + 12, minute!),
                hour! >= 12,
              )}
            </View>
          </View>
          {choice("Done choosing time", () => setOpen(null))}
        </View>
      )}
      {heading(`Choose time zone · ${draft.timeZone || deviceZone()}`, "zone")}
      {open === "zone" && (
        <View style={s.panel}>
          {choice("Use phone time zone", () => {
            onChange("timeZone", "");
            setOpen(null);
          })}
          <TextInput
            accessibilityLabel="Search time zones"
            placeholder="Search city or region"
            placeholderTextColor={T.muted}
            value={search}
            onChangeText={setSearch}
            style={s.search}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <ScrollView
            style={s.zoneList}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {availableZones
              .filter((z) =>
                z
                  .toLowerCase()
                  .replace(/_/g, " ")
                  .includes(search.toLowerCase().replace(/_/g, " ")),
              )
              .map((z) =>
                choice(
                  z,
                  () => {
                    onChange("timeZone", z);
                    setOpen(null);
                    setSearch("");
                  },
                  z === (draft.timeZone || deviceZone()),
                  z,
                ),
              )}
          </ScrollView>
        </View>
      )}
      <Text style={s.note}>
        Choose the time zone where the moment happens. Saved Moments are shown
        in your phone’s local time.
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  container: { gap: 12 },
  trigger: {
    borderWidth: 1,
    borderColor: T.muted,
    borderRadius: 5,
    padding: 14,
    minHeight: 48,
  },
  text: { color: T.bone, fontFamily: "Inter_400Regular", fontSize: 16 },
  note: { color: T.muted, fontSize: 14, lineHeight: 21 },
  panel: {
    borderWidth: 1,
    borderColor: T.muted,
    borderRadius: 5,
    padding: 8,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  choice: {
    padding: 10,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 5,
  },
  selected: { backgroundColor: "#263966" },
  week: { flexDirection: "row" },
  weekday: {
    width: "14.285714%",
    textAlign: "center",
    color: T.muted,
    fontSize: 12,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  day: {
    width: "14.285714%",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 5,
  },
  column: { height: 220, flex: 1 },
  zoneList: { maxHeight: 240 },
  search: {
    borderWidth: 1,
    borderColor: T.muted,
    padding: 12,
    color: T.bone,
    fontSize: 16,
  },
});
