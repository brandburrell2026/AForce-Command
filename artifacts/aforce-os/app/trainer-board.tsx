/**
 * Route: /trainer-board — the Morning Board.
 *
 * Gated twice, both default OFF:
 *   - `trainer_board_enabled` gates the surface itself. It is registered in
 *     INTERNAL_TIER_FLAGS, so `demoUnlockAllFlags` force-clamps it false for
 *     anyone who is not __DEV__ or internal TestFlight — the same treatment
 *     Clutch and Guardian get, and for the same reason: this surface carries
 *     medical-adjacent copy.
 *   - `trainer_demo_seed_enabled` gates the SIMULATED roster. With it off the
 *     board renders empty rather than inventing athletes.
 *
 * Availability changes are held in screen state this phase. The server write
 * exists (Phase 1: POST /trainer/programs/:id/athletes/:id/availability) but
 * no program row exists in any database yet, so wiring the call would be
 * writing against a table that has never been applied. That wiring is the
 * first task of the phase that follows, and the interaction is built so the
 * handler is the only thing that changes.
 */
import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";

import { FeatureGate } from "@/components/FeatureGate";
import { af, afLayout, afType } from "@/theme/afTokens";
import { useFeatureFlags } from "@/store/useAppStore";
import { buildTrainerDemoRoster } from "@/data/trainerDemoSeed";
import TrainerBoardScreen from "@/screens/TrainerBoardScreen";
import type { Availability, BoardAthlete } from "@/utils/trainerBoard";

export default function TrainerBoardRoute() {
  const router = useRouter();
  const flags = useFeatureFlags();
  const seedEnabled = flags.trainer_demo_seed_enabled;

  const initial = useMemo<BoardAthlete[]>(
    () => (seedEnabled ? buildTrainerDemoRoster() : []),
    [seedEnabled],
  );
  const [athletes, setAthletes] = useState<BoardAthlete[]>(initial);

  // Keep the list in step when the seed flag flips at runtime (developer
  // toggle) without dropping edits made since mount.
  React.useEffect(() => setAthletes(initial), [initial]);

  const onChangeAvailability = useCallback((athleteUserId: string, status: Availability) => {
    setAthletes((prev) =>
      prev.map((a) => (a.athleteUserId === athleteUserId ? { ...a, availability: status } : a)),
    );
  }, []);

  return (
    <View style={styles.screen}>
      <FeatureGate
        flag="trainer_board_enabled"
        title="Trainer Board"
        description="The morning board: roster sorted by who needs you, exception-first, with availability in two taps. Activate to preview."
        accentColor={af.red}
      >
        <TrainerBoardScreen
          athletes={athletes}
          heatIndexF={null}
          ambientMeasured={false}
          onChangeAvailability={onChangeAvailability}
          onOpenAthlete={(athleteUserId) => router.push(`/trainer-athlete/${athleteUserId}`)}
        />
        {seedEnabled ? null : (
          <View style={styles.emptyNote}>
            <Text style={styles.emptyText}>
              No roster connected. Turn on the simulated roster in Developer settings to preview
              the board.
            </Text>
            <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.back}>BACK</Text>
            </Pressable>
          </View>
        )}
      </FeatureGate>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: af.canvas },
  emptyNote: { padding: afLayout.screenPaddingX },
  emptyText: { ...afType.secondary, color: af.textSecondary },
  back: { ...afType.tab, color: af.redText, marginTop: afLayout.cardGap },
});
