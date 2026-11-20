/**
 * ResultCard — the small HydroState card One Breath shows with an answer or
 * after a logged drink (the approved prototype's result card): the number, the
 * state word, a bar, and a footnote.
 *
 * Presentation only. It draws the values it is given and computes nothing:
 * the number, word and position come from HydroState's own selectors. When
 * the value is an estimate the card says so in words. Colour is not status
 * here: the bar is warm white and the single marker dot is the One Breath
 * accent, so `statusColor.ts` is not involved.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { preparationTokens as T } from "@/theme/DESIGN-TOKENS";

export interface ResultCardProps {
  /** HydroState as shown, already rounded by its owner. */
  value: number;
  /** The state word from HydroState ("Behind", "Balanced"). */
  word: string;
  estimated: boolean;
  /** 0–1 position along the bar, from HydroState. */
  position: number;
  /** One mono line under the bar, e.g. "Coffee logged · partial credit pending". */
  footnote?: string;
  social?: boolean;
}

export function resultCardLabel(p: Pick<ResultCardProps, "value" | "word" | "estimated" | "footnote">): string {
  return [`HydroState ${p.value}`, p.word, p.estimated ? "estimated" : "", p.footnote].filter(Boolean).join(". ");
}

export function ResultCard(p: ResultCardProps) {
  const at = `${Math.round(Math.min(1, Math.max(0, p.position)) * 100)}%` as const;
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={resultCardLabel(p)} style={s.card}>
      <View style={s.left}>
        <Text style={s.meta}>HydroState</Text>
        <Text style={s.value}>{p.value}</Text>
      </View>
      <View style={s.right}>
        <View style={s.head}>
          <Text style={s.word}>{p.word}</Text>
          {p.estimated ? <Text style={s.meta}>Estimated</Text> : null}
        </View>
        <View style={s.bar}>
          <View style={[s.fill, { width: at }]} />
          <View style={[s.marker, { left: at, backgroundColor: p.social ? T.blue : T.red }]} />
        </View>
        {p.footnote ? <Text style={s.meta}>{p.footnote}</Text> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: T.rule, backgroundColor: T.panel },
  left: { gap: 4 },
  right: { flex: 1, minWidth: 0, gap: 8 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  value: { fontFamily: "Inter_300Light", fontSize: 30, lineHeight: 32, letterSpacing: -1.2, color: T.bone },
  word: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: T.bone },
  meta: { fontFamily: "IBMPlexMono_500Medium", fontSize: 9, lineHeight: 13, letterSpacing: 1.4, color: T.dim, textTransform: "uppercase" },
  // Clipped to the bar, as in the prototype: the marker reads as the bar's lit end, not a separate dot.
  bar: { height: 4, borderRadius: 4, backgroundColor: T.rule, overflow: "hidden" },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 4, backgroundColor: T.bone },
  marker: { position: "absolute", top: -3, width: 10, height: 10, borderRadius: 5, marginLeft: -5 },
});
