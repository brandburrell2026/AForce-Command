import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { preparationPreviewEnabled } from "@/services/preparationAccess";
import { preparationTokens as T } from "@/theme/DESIGN-TOKENS";
import { useMomentsStore } from "@/services/momentsStore";
export function SocialProtocolEntry() {
  const router = useRouter();
  const { moments } = useMomentsStore();
  const active = moments.find(
    (m) => !!m.preparation?.sealedAtIso && !m.preparation.returnedAtIso,
  );
  const candidate = !active
    ? moments
        .filter(
          (m) =>
            m.source !== "demo" &&
            m.type === "personal" &&
            !m.preparation &&
            Date.parse(m.startAtIso) > Date.now(),
        )
        .sort((a, b) => Date.parse(a.startAtIso) - Date.parse(b.startAtIso))[0]
    : undefined;
  if (!preparationPreviewEnabled()) return null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push(
          active || candidate
            ? {
                pathname: "/social",
                params: { momentId: (active ?? candidate)!.id },
              }
            : "/social",
        )
      }
      style={s.entry}
    >
      <Text style={s.label}>SOCIAL ONE BREATH</Text>
      <Text style={s.body}>
        {active
          ? "Return to your sealed plan."
          : candidate
            ? `${candidate.title}? Prepare around it.`
            : "Prepare around your next social moment."}
      </Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  entry: {
    minHeight: 64,
    paddingVertical: 18,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: T.rule,
  },
  label: { ...T.eyebrow, color: T.blueHi },
  body: { ...T.body, color: T.bone },
});
