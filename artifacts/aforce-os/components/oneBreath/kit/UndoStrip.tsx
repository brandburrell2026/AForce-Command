/**
 * UndoStrip — one line that says exactly what Undo reverses, with the Undo
 * button beside it (the approved prototype's undo row).
 *
 * Presentation only. The caller owns the window: it shows the strip only
 * while the action can still be reversed and removes it the moment it cannot.
 * `reverses` must name the real thing ("Logged 12 oz coffee"), never a
 * generic "Done".
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { preparationTokens as T } from "@/theme/DESIGN-TOKENS";

export function undoLabel(reverses: string): string {
  return `Undo: ${reverses}`;
}

export function UndoStrip({ reverses, lasts, onUndo }: { reverses: string; lasts?: string; onUndo: () => void }) {
  return (
    <View style={s.row}>
      <Text style={s.text}>
        {reverses}
        {lasts ? ` · ${lasts}` : ""}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={undoLabel(reverses)} onPress={onUndo} hitSlop={5} style={s.button}>
        <Text style={s.buttonText}>Undo</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  text: { flex: 1, minWidth: 0, fontFamily: "Inter_400Regular", fontSize: 12.5, lineHeight: 17, color: T.muted },
  button: { minHeight: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: T.rule, justifyContent: "center" },
  buttonText: { fontFamily: "Inter_500Medium", fontSize: 13, color: T.bone },
});
