/**
 * SourceChips — the row under the One Breath status line that names where an
 * answer came from: "Health · Phantom · Calendar · synced 2m" in the approved
 * prototype.
 *
 * Presentation only. The spec's rule lives in the caller: pass only sources
 * that are authorized, connected and actually used for this answer. A source
 * that is missing is shown as unavailable or not authorized, in words as well
 * as in the dot, and never as sample data.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { preparationTokens as T } from "@/theme/DESIGN-TOKENS";

export type SourceState = "connected" | "unavailable" | "not_authorized";

export interface SourceChip {
  label: string;
  state: SourceState;
}

const STATE_WORD: Record<SourceState, string> = {
  connected: "",
  unavailable: "unavailable",
  not_authorized: "not authorized",
};

export function sourceChipLabel(chip: SourceChip): string {
  const word = STATE_WORD[chip.state];
  return word ? `${chip.label}, ${word}` : chip.label;
}

export function SourceChips({ chips, synced }: { chips: readonly SourceChip[]; synced?: string }) {
  if (chips.length === 0) return null;
  const spoken = [...chips.map(sourceChipLabel), synced ? `synced ${synced}` : ""].filter(Boolean).join(". ");
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={`Sources: ${spoken}`} style={s.row}>
      {chips.map((chip) => {
        const on = chip.state === "connected";
        return (
          <View key={chip.label} style={s.chip}>
            <View style={[s.dot, on ? s.dotOn : s.dotOff]} />
            <Text style={[s.label, !on && s.labelOff]}>
              {chip.label}
              {on ? "" : ` · ${STATE_WORD[chip.state]}`}
            </Text>
          </View>
        );
      })}
      {synced ? <Text style={[s.label, s.labelOff]}>Synced {synced}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", columnGap: 14, rowGap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  dotOn: { backgroundColor: T.bone },
  dotOff: { borderWidth: 1, borderColor: T.dim },
  label: { fontFamily: "IBMPlexMono_500Medium", fontSize: 9.5, letterSpacing: 1.3, color: T.muted, textTransform: "uppercase" },
  labelOff: { color: T.dim },
});
