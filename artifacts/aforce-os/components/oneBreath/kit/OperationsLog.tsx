/**
 * OperationsLog — the numbered lines that show what One Breath really did:
 * HEARD, CHECKED, ACTION, WRITE, STATE, SEALED, QUIET, UNDO (the approved
 * prototype's flow steps).
 *
 * Presentation only. The spec's rule lives in the caller: one line per real
 * step, added only after the step succeeds. Member-facing words; no raw audio
 * and no unnecessary health detail.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { preparationTokens as T } from "@/theme/DESIGN-TOKENS";

export type LogTone = "open" | "done" | "accent" | "waiting";

export interface LogAction {
  label: string;
  onPress: () => void;
  primary?: boolean;
}

export interface LogLine {
  /** Step number as shown, e.g. 3 → "03". */
  n: number;
  /** HEARD, CHECKED, ACTION, WRITE, STATE, SEALED, QUIET, UNDO, SENT, NOT SENT… */
  label: string;
  /** Right-hand note: "BY YOU · TYPED", "4 SOURCES". */
  note?: string;
  text: string;
  detail?: string;
  tone?: LogTone;
  actions?: LogAction[];
}

const two = (n: number) => String(n).padStart(2, "0");

export function logLineLabel(line: LogLine): string {
  return [`Step ${line.n}`, line.label, line.note, line.text, line.detail].filter(Boolean).join(". ");
}

export function OperationsLog({ lines, social = false }: { lines: readonly LogLine[]; social?: boolean }) {
  return (
    <View style={s.root}>
      {lines.map((line, i) => {
        const tone = line.tone ?? "open";
        const last = i === lines.length - 1;
        return (
          <View key={`${line.n}-${line.label}`} style={s.line}>
            <View style={s.rail}>
              <View
                style={[
                  s.dot,
                  tone === "done" && s.dotDone,
                  tone === "accent" && { backgroundColor: social ? T.blue : T.red, borderColor: social ? T.blue : T.red },
                  tone === "waiting" && s.dotWaiting,
                ]}
              />
              {last ? null : <View style={s.thread} />}
            </View>
            <View style={s.body}>
              <View accessible accessibilityLabel={logLineLabel(line)} style={s.text}>
                <View style={s.head}>
                  <Text style={s.label}>
                    {two(line.n)} · {line.label}
                  </Text>
                  {line.note ? <Text style={s.note}>{line.note}</Text> : null}
                </View>
                <Text style={s.main}>{line.text}</Text>
                {line.detail ? <Text style={s.detail}>{line.detail}</Text> : null}
              </View>
              {line.actions?.length ? (
                <View style={s.actions}>
                  {line.actions.map((a) => (
                    <Pressable
                      key={a.label}
                      accessibilityRole="button"
                      accessibilityLabel={a.label}
                      onPress={a.onPress}
                      hitSlop={4}
                      style={[s.action, a.primary && s.actionPrimary]}
                    >
                      <Text style={[s.actionText, a.primary && s.actionTextPrimary]}>{a.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const MONO = "IBMPlexMono_500Medium";

const s = StyleSheet.create({
  root: { alignSelf: "stretch" },
  line: { flexDirection: "row", gap: 12, paddingBottom: 14 },
  rail: { width: 22, alignItems: "center" },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, borderWidth: 1.5, borderColor: T.muted, backgroundColor: T.ink },
  dotDone: { backgroundColor: T.bone, borderColor: T.bone },
  dotWaiting: { borderColor: T.bone },
  thread: { position: "absolute", top: 18, bottom: -14, width: 1, backgroundColor: T.rule },
  body: { flex: 1, minWidth: 0 },
  text: { alignSelf: "stretch" },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  label: { fontFamily: MONO, fontSize: 9.5, letterSpacing: 1.7, color: T.dim, textTransform: "uppercase" },
  note: { fontFamily: MONO, fontSize: 9.5, letterSpacing: 1.7, color: T.dim, textTransform: "uppercase" },
  main: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 21, color: T.bone, marginTop: 6 },
  detail: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18, color: T.muted, marginTop: 4 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  action: { minHeight: 44, paddingHorizontal: 15, borderRadius: 999, borderWidth: 1, borderColor: T.rule, justifyContent: "center" },
  actionPrimary: { backgroundColor: T.bone, borderColor: T.bone },
  actionText: { fontFamily: "Inter_500Medium", fontSize: 13, color: T.bone },
  actionTextPrimary: { fontFamily: "Inter_600SemiBold", color: T.ink },
});
