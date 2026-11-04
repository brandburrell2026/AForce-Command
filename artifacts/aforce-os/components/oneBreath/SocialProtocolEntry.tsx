import React from "react";
import { useMomentsData } from "@/components/moments/useMomentsData";
import { getMomentProposalPreferences } from "@/services/momentNotifications";
import { captureScope, isScopeCurrent } from "@/services/scopedWriteQueue";
import { preparationProposalCandidate } from "@/services/momentPreparation";
import { Pressable, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { preparationPreviewEnabled } from "@/services/preparationAccess";
import { preparationTokens as T } from "@/theme/DESIGN-TOKENS";
import { getMomentsState, useMomentsStore } from "@/services/momentsStore";
export function SocialProtocolEntry() {
  return preparationPreviewEnabled() ? <EnabledSocialProtocolEntry /> : null;
}
function EnabledSocialProtocolEntry() {
  const router = useRouter();
  const { moments } = useMomentsStore();
  const shared = useMomentsData();
  const latestShared = React.useRef(shared.surfaced);
  latestShared.current = shared.surfaced;
  const active = moments.find(
    (m) => !!m.preparation?.sealedAtIso && !m.preparation.returnedAtIso,
  );
  const [opening, setOpening] = React.useState(false);
  const open = async () => {
    if (opening) return;
    const token = captureScope();
    setOpening(true);
    try {
      // Re-read at the tap: a stale render cannot propose past quiet hours,
      // after an account change, or after a concurrently saved preference.
      const preferences = await getMomentProposalPreferences().catch(
        () => null,
      );
      if (!isScopeCurrent(token)) return;
      const latest = getMomentsState().moments;
      const activeNow = latest.find(
        (m) => !!m.preparation?.sealedAtIso && !m.preparation.returnedAtIso,
      );
      const candidate =
        !activeNow && preferences
          ? preparationProposalCandidate(
              [
                ...latest,
                ...latestShared.current.filter((m) => m.source === "calendar"),
              ],
              preferences,
              new Date().toISOString(),
            )
          : null;
      router.push(
        activeNow || candidate
          ? {
              pathname: "/social",
              params: {
                momentId: (activeNow ?? candidate)!.id,
                ...(candidate ? { proposal: "1" } : {}),
              },
            }
          : "/social",
      );
    } finally {
      if (isScopeCurrent(token)) setOpening(false);
    }
  };
  return (
    <Pressable
      accessibilityRole="button"
      disabled={opening}
      accessibilityState={{ disabled: opening }}
      onPress={() => {
        void open();
      }}
      style={s.entry}
    >
      <Text style={s.label}>SOCIAL ONE BREATH</Text>
      <Text style={s.body}>
        {active
          ? "Return to your sealed plan."
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
