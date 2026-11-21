/**
 * CarriedUndoBar — the Undo for a drink logged in One Breath, shown on the
 * next screen for the seconds that are left. It appears only while there is
 * something to undo, says plainly what happened when it is used, and goes.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { takeCarriedUndo, useCarriedUndo } from "@/services/carriedUndo";
import { preparationTokens as T } from "@/theme/DESIGN-TOKENS";
import { UndoStrip } from "./kit";

export function CarriedUndoBar() {
  const state = useCarriedUndo();
  const insets = useSafeAreaInsets();
  const [now, setNow] = React.useState(() => Date.now());
  const offering = state.kind === "offer";
  React.useEffect(() => {
    if (!offering) return;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [offering]);
  if (state.kind === "none") return null;
  const seconds = state.kind === "offer" ? Math.max(1, Math.ceil((state.expiresAt - now) / 1000)) : 0;
  return (
    <View pointerEvents="box-none" style={[s.wrap, { bottom: insets.bottom + 96 }]} testID="carried-undo">
      <View style={s.card} accessibilityLiveRegion="polite">
        {state.kind === "offer" ? (
          <UndoStrip reverses={`Logged ${state.label}`} lasts={`${seconds} ${seconds === 1 ? "second" : "seconds"}`} onUndo={() => void takeCarriedUndo()} />
        ) : (
          <Text style={s.text}>
            {state.kind === "working" ? "Removing…" : state.kind === "undone" ? "Removed from today." : "That didn’t go through. It is still in your log."}
          </Text>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16 },
  card: { borderRadius: 18, borderWidth: 1, borderColor: T.rule, backgroundColor: T.panel, paddingVertical: 10, paddingHorizontal: 14 },
  text: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20, color: T.bone },
});
