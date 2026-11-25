/**
 * HydroScan — a barcode that is not in the list, finished by taps.
 *
 * The spec's flow (One Breath Final Build Spec, drinks 5 and D6): say it is
 * not recognized, do not guess what it is, let the member pick the kind of
 * drink or type it, ask how much, and log only on their tap. A scan is never
 * drinking: nothing is logged until "Log it" is done, and the card says so.
 *
 * Presentation only. Wording is from the One Breath wording page (A4, A5).
 * No HydroState number is shown here: this screen never presents a score of
 * the member (ruling D1).
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { af } from "@/theme/afTokens";

const MONO = "IBMPlexMono_500Medium";

/** The kinds offered, in the wording page's order, with the app's own category ids. */
export const UNKNOWN_DRINK_KINDS: readonly { categoryId: string; label: string }[] = [
  { categoryId: "water", label: "Water" },
  { categoryId: "electrolyte", label: "Electrolyte drink" },
  { categoryId: "sports_drink", label: "Sports drink" },
  { categoryId: "coffee", label: "Coffee" },
  { categoryId: "energy_drink", label: "Energy drink" },
];
/** Amounts offered as taps. Anything else is typed. */
export const UNKNOWN_DRINK_AMOUNTS_OZ: readonly number[] = [8, 12, 16, 20, 24];

function Tile({ label, onPress, testID, disabled }: { label: string; onPress: () => void; testID?: string; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={s.tile} testID={testID}>
      <Text style={s.tileText}>{label}</Text>
    </Pressable>
  );
}

function WideButton({ label, onPress, primary, testID, disabled }: { label: string; onPress: () => void; primary?: boolean; testID?: string; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.wide, primary && s.widePrimary, disabled && s.off]}
      testID={testID}
    >
      <Text style={[s.wideText, primary && s.wideTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

/** Step 1: what kind of drink is it? */
export function HydroScanUnknownPick({ onPick, onType }: { onPick: (kind: { categoryId: string; label: string }) => void; onType: () => void }) {
  return (
    <View testID="hydroscan-unknown">
      <View accessible accessibilityLiveRegion="assertive">
        <Text style={s.caption}>BARCODE READ · NOT IN OUR LIST YET</Text>
        <Text accessibilityRole="header" style={s.title}>I don’t know this product yet.</Text>
        <Text style={s.body}>I won’t guess what it is. Pick what kind of drink it is, or type it.</Text>
      </View>
      <View style={s.grid}>
        {UNKNOWN_DRINK_KINDS.map((k) => (
          <Tile key={k.categoryId} label={k.label} onPress={() => onPick(k)} testID={`hydroscan-kind-${k.categoryId}`} />
        ))}
      </View>
      <Text style={s.quiet}>Nothing is logged.</Text>
      <WideButton label="Type it" onPress={onType} testID="hydroscan-unknown-type" />
    </View>
  );
}

/** Step 2: how much? One tap picks the amount; "Log it" is the only thing that logs. */
export function HydroScanUnknownAmount({
  kind,
  oz,
  busy,
  onAmount,
  onLog,
  onBack,
  onType,
}: {
  kind: string;
  oz: number | null;
  busy: boolean;
  onAmount: (oz: number) => void;
  onLog: () => void;
  onBack: () => void;
  onType: () => void;
}) {
  return (
    <View testID="hydroscan-amount">
      <Text style={s.caption}>{kind.toUpperCase()}</Text>
      <Text accessibilityRole="header" style={s.title}>How much?</Text>
      <View style={s.grid}>
        {UNKNOWN_DRINK_AMOUNTS_OZ.map((n) => (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`${n} ounces`}
            accessibilityState={{ selected: oz === n, disabled: busy }}
            disabled={busy}
            onPress={() => onAmount(n)}
            style={[s.tile, s.amount, oz === n && s.tileOn]}
            testID={`hydroscan-amount-${n}`}
          >
            <Text style={[s.tileText, oz === n && s.tileTextOn]}>{n} oz</Text>
          </Pressable>
        ))}
        <Tile label="Type it" onPress={onType} disabled={busy} testID="hydroscan-amount-type" />
      </View>
      <Text style={s.quiet}>Nothing is logged.</Text>
      <View style={s.row}>
        <View style={s.grow}>
          <WideButton label="Log it" primary onPress={onLog} disabled={busy || oz === null} testID="hydroscan-log-it" />
        </View>
        <WideButton label="Not now" onPress={onBack} disabled={busy} testID="hydroscan-not-now" />
      </View>
    </View>
  );
}

/** After the log: what was logged, Done, and Undo while the log can still be taken back. */
export function HydroScanLogged({
  label,
  note,
  state,
  busy,
  onDone,
  onUndo,
}: {
  /** "16 oz water". */
  label: string;
  /** The hydration rules' own words for a drink that does not move HydroState yet. Empty for water. */
  note: string;
  state: "logged" | "undone" | "failed";
  busy: boolean;
  onDone: () => void;
  /** Absent when this log cannot be taken back. */
  onUndo?: () => void;
}) {
  const line = state === "logged" ? `Logged ${label}.` : state === "undone" ? "Removed from today." : "Not logged.";
  const detail = state === "logged" ? note : state === "failed" ? "Your drink was not saved. Try again." : "";
  return (
    <View testID="hydroscan-logged">
      <View accessible accessibilityLiveRegion="polite">
        <Text style={s.caption}>{state === "logged" ? "LOGGED · CONFIRMED BY YOU" : state === "undone" ? "UNDONE" : "NOT LOGGED"}</Text>
        <Text accessibilityRole="header" style={s.title}>{line}</Text>
        {detail ? <Text style={s.body}>{detail}</Text> : null}
      </View>
      <View style={[s.row, s.rowTop]}>
        <View style={s.grow}>
          <WideButton label="Done" primary onPress={onDone} disabled={busy} testID="hydroscan-done" />
        </View>
        {state === "logged" && onUndo ? <WideButton label="Undo" onPress={onUndo} disabled={busy} testID="hydroscan-undo" /> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  caption: { fontFamily: MONO, fontSize: 10, letterSpacing: 1.8, color: af.textTertiary },
  title: { marginTop: 10, fontFamily: "Inter_600SemiBold", fontSize: 21, lineHeight: 27, letterSpacing: -0.3, color: af.textPrimary },
  body: { marginTop: 10, fontFamily: "Inter_400Regular", fontSize: 14.5, lineHeight: 21, color: af.textSecondary },
  grid: { marginTop: 18, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { flexBasis: "47%", flexGrow: 1, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: af.divider, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  amount: { flexBasis: "30%" },
  tileOn: { backgroundColor: af.primaryFill, borderColor: af.primaryFill },
  tileText: { fontFamily: "Inter_500Medium", fontSize: 14, color: af.textPrimary, textAlign: "center" },
  tileTextOn: { color: af.onPrimaryFill },
  quiet: { marginTop: 14, marginBottom: 12, fontFamily: "Inter_400Regular", fontSize: 13, color: af.textSecondary },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  rowTop: { marginTop: 22 },
  grow: { flex: 1 },
  wide: { minHeight: 54, borderRadius: 999, borderWidth: 1, borderColor: af.divider, alignItems: "center", justifyContent: "center", paddingHorizontal: 22 },
  widePrimary: { backgroundColor: af.primaryFill, borderColor: af.primaryFill },
  wideText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: af.textPrimary },
  wideTextPrimary: { color: af.onPrimaryFill },
  off: { opacity: 0.45 },
});
