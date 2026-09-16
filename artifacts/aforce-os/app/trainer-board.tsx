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
import { applyPendingAvailability } from "@/utils/trainerBoardCache";
import {
  enqueue,
  syncSummary,
  type OutboxItem,
} from "@/utils/trainerOutbox";
import TrainerBoardScreen from "@/screens/TrainerBoardScreen";
import type { Availability, BoardAthlete } from "@/utils/trainerBoard";

/** Placeholder until a trainer session carries a real program id. */
const DEMO_PROGRAM_ID = "demo_program";

export default function TrainerBoardRoute() {
  const router = useRouter();
  const flags = useFeatureFlags();
  const seedEnabled = flags.trainer_demo_seed_enabled;

  const initial = useMemo<BoardAthlete[]>(
    () => (seedEnabled ? buildTrainerDemoRoster() : []),
    [seedEnabled],
  );
  const [athletes, setAthletes] = useState<BoardAthlete[]>(initial);
  /**
   * The outbox. Local-first: a tap lands here first and the board reflects it
   * immediately, whether or not anything can be sent. Phase 7's flush loop
   * binds this to AsyncStorage and the API; the queue shape is what the
   * screen needs and is already proven by the unit suite.
   */
  const [queue, setQueue] = useState<OutboxItem[]>([]);

  // Keep the list in step when the seed flag flips at runtime (developer
  // toggle) without dropping edits made since mount.
  React.useEffect(() => setAthletes(initial), [initial]);

  const onChangeAvailability = useCallback((athleteUserId: string, status: Availability) => {
    const now = Date.now();
    setQueue((prev) =>
      enqueue(prev, {
        id: `avail_${athleteUserId}_${now}`,
        kind: "availability",
        athleteUserId,
        programId: DEMO_PROGRAM_ID,
        payload: { status },
        baseVersion: null,
        createdAtMs: now,
      }),
    );
  }, []);

  // The queue is the source of truth for anything unsent, so an entry made
  // with no signal is visible on the row the moment it is made.
  const pendingAvailability = useMemo(
    () =>
      queue
        .filter((q) => q.kind === "availability" && q.state !== "synced")
        .map((q) => ({
          athleteUserId: q.athleteUserId,
          status: String((q.payload as { status?: unknown }).status ?? ""),
        })),
    [queue],
  );

  const shown = useMemo(
    () => applyPendingAvailability(athletes, pendingAvailability),
    [athletes, pendingAvailability],
  );

  const summary = useMemo(() => syncSummary(queue), [queue]);

  return (
    <View style={styles.screen}>
      <FeatureGate
        flag="trainer_board_enabled"
        title="Trainer Board"
        description="The morning board: roster sorted by who needs you, exception-first, with availability in two taps. Activate to preview."
        accentColor={af.red}
      >
        <TrainerBoardScreen
          athletes={shown}
          heatIndexF={null}
          ambientMeasured={false}
          onChangeAvailability={onChangeAvailability}
          onOpenAthlete={(athleteUserId) => router.push(`/trainer-athlete/${athleteUserId}`)}
          syncLabel={summary.label}
          syncNeedsAttention={summary.needsAttention}
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
