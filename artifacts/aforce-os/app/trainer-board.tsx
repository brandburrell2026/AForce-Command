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
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useAuth } from "@clerk/expo";
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
import { loadOutbox, saveOutbox } from "@/utils/trainerOutboxStore";
import { trainerStorage } from "@/services/trainerStorage";
import TrainerBoardScreen from "@/screens/TrainerBoardScreen";
import type { Availability, BoardAthlete } from "@/utils/trainerBoard";

/** Placeholder until a trainer session carries a real program id. */
const DEMO_PROGRAM_ID = "demo_program";

/** Key scope when signed out. Nothing clinical is queued in that state. */
const ANONYMOUS_SCOPE = "anonymous";

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

  const { userId } = useAuth();
  const viewerScope = userId ?? ANONYMOUS_SCOPE;

  /**
   * THE QUEUE IS NOW ON DISK.
   *
   * It lived in this `useState` alone: a trainer cleared a squad on a field
   * with no signal, the app reloaded, and every entry was gone — while the
   * indicator read "Saved locally · 12 pending" the whole time.
   *
   * `hydrated` gates the write-back so the first render's empty array cannot
   * overwrite a stored queue before it has been read.
   */
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    hydrated.current = false;
    void (async () => {
      const loaded = await loadOutbox(trainerStorage, viewerScope);
      if (cancelled) return;
      setQueue(loaded.items);
      hydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [viewerScope]);

  useEffect(() => {
    if (!hydrated.current) return;
    // Best effort: a storage failure must not take down the screen a trainer
    // is working on, and the in-memory queue is still correct.
    void saveOutbox(trainerStorage, viewerScope, queue);
  }, [queue, viewerScope]);

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
        // PLACEHOLDER, and deliberately not a claim. The board reads the demo
        // seed rather than the API, so there is no server version to quote
        // yet; it starts carrying a real one when the flush loop lands and
        // rows come from the roster endpoint.
        //
        // Until then this is SAFE rather than silently wrong: the server
        // treats `null` as "availability has never been set" and refuses the
        // write with 409 if it has. It cannot overwrite a trainer's decision.
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
