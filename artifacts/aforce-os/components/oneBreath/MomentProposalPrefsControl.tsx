import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMomentProposalPreferences } from "@/hooks/useMomentProposalPreferences";
import { allowMomentPreparationSuggestions } from "@/services/momentNotifications";
import { preparationPreviewEnabled } from "@/services/preparationAccess";
import { getUserScopeGeneration } from "@/services/userScope";
import { captureScope, isScopeCurrent } from "@/services/scopedWriteQueue";
import { preparationTokens as T } from "@/theme/DESIGN-TOKENS";

/** Undo is available independently of notification permission or reminder settings. */
export function MomentProposalPrefsControl() {
  const prefs = useMomentProposalPreferences(preparationPreviewEnabled());
  const [saving, setSaving] = React.useState(false),
    [error, setError] = React.useState("");
  const generation = getUserScopeGeneration();
  React.useEffect(() => {
    setSaving(false);
    setError("");
  }, [generation]);
  const resetAt = Date.parse(prefs?.suggestionsAllowedAtIso ?? "") || 0;
  if (
    !prefs ||
    (!prefs.neverTypes.length &&
      !prefs.records.some(
        (r) => r.outcome === "declined" && Date.parse(r.atIso) > resetAt,
      ))
  )
    return null;
  const restore = async () => {
    const token = captureScope();
    setSaving(true);
    setError("");
    try {
      await allowMomentPreparationSuggestions();
    } catch {
      if (isScopeCurrent(token))
        setError("Could not save that preference. Try again.");
    } finally {
      if (isScopeCurrent(token)) setSaving(false);
    }
  };
  return (
    <View style={s.card}>
      <Text style={s.label}>PREPARATION SUGGESTIONS</Text>
      <Text style={s.body}>
        Your dismissed Moments stay dismissed. Allow suggestions for future
        Moments again.
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled={saving}
        accessibilityState={{ disabled: saving }}
        style={s.button}
        onPress={() => {
          void restore();
        }}
      >
        <Text style={s.action}>
          {saving ? "Saving…" : "Allow suggestions again"}
        </Text>
      </Pressable>
      {error ? (
        <Text accessibilityRole="alert" style={s.body}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  card: { gap: 12, paddingVertical: 16 },
  label: { ...T.eyebrow, color: T.blueHi },
  body: { ...T.body, color: T.muted, fontSize: 14, lineHeight: 21 },
  button: {
    borderColor: T.rule,
    borderWidth: 1,
    padding: 14,
    minHeight: 48,
    borderRadius: 5,
  },
  action: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: T.bone,
    textAlign: "center",
  },
});
