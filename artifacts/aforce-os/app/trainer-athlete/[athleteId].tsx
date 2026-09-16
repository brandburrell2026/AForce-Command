/**
 * Route: /trainer-athlete/[athleteId] — the athlete record.
 *
 * ONE tap from a board row, which is inside the brief's "≤ 2 taps" budget.
 *
 * CACHE FIRST, ALWAYS. The screen renders whatever the cache holds before it
 * looks at anything live, so an airplane-mode open shows the record instead of
 * a spinner. When a live source exists it refreshes in the background and the
 * header's freshness label changes from cached to live. Today the "live"
 * source is the simulated roster, so the write-through is what proves the
 * path; swapping in the Phase 1 API changes `loadLive` and nothing else.
 *
 * Gated by `trainer_board_enabled`, the same flag as the board — the record is
 * part of that surface, not a second one to reason about.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";

import { FeatureGate } from "@/components/FeatureGate";
import { af, afLayout, afType } from "@/theme/afTokens";
import { useFeatureFlags } from "@/store/useAppStore";
import { buildTrainerDemoRoster } from "@/data/trainerDemoSeed";
import TrainerAthleteRecordScreen from "@/screens/TrainerAthleteRecordScreen";
import { buildRecord, type AthleteRecord } from "@/utils/trainerRecord";
import { freshnessLabel, readRecord, writeRecord } from "@/utils/trainerRecordCache";

/**
 * Viewer scope for the cache key. Two staff sharing a device must not read
 * each other's cached athletes; until the trainer session carries an id, the
 * demo scope keeps the key shape honest rather than pretending it is global.
 */
const VIEWER_SCOPE = "demo_viewer";

export default function TrainerAthleteRecordRoute() {
  const router = useRouter();
  const flags = useFeatureFlags();
  const { athleteId } = useLocalSearchParams<{ athleteId: string }>();

  const [record, setRecord] = useState<AthleteRecord | null>(null);
  const [cacheAgeMs, setCacheAgeMs] = useState<number | null>(null);

  const loadLive = useCallback((): AthleteRecord | null => {
    if (!flags.trainer_demo_seed_enabled || typeof athleteId !== "string") return null;
    const athlete = buildTrainerDemoRoster().find((a) => a.athleteUserId === athleteId);
    return athlete ? buildRecord(athlete) : null;
  }, [flags.trainer_demo_seed_enabled, athleteId]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (typeof athleteId !== "string") return;

      // 1. Cache first — this is the path that works with no network.
      const cached = await readRecord(AsyncStorage, VIEWER_SCOPE, athleteId);
      if (!cancelled && cached) {
        setRecord(cached.record);
        setCacheAgeMs(cached.ageMs);
      }

      // 2. Then the live source, if there is one.
      const live = loadLive();
      if (!cancelled && live) {
        setRecord(live);
        setCacheAgeMs(null);
        await writeRecord(AsyncStorage, VIEWER_SCOPE, live);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [athleteId, loadLive]);

  return (
    <View style={styles.screen}>
      <FeatureGate
        flag="trainer_board_enabled"
        title="Trainer Board"
        description="The morning board and the athlete record behind it. Activate to preview."
        accentColor={af.red}
      >
        {record === null ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Nothing cached for this athlete, and no roster is connected.
            </Text>
          </View>
        ) : (
          <TrainerAthleteRecordScreen
            record={record}
            cacheAgeMs={cacheAgeMs}
            freshness={freshnessLabel(cacheAgeMs)}
            onBack={() => router.back()}
          />
        )}
      </FeatureGate>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: af.canvas },
  empty: { padding: afLayout.screenPaddingX },
  emptyText: { ...afType.secondary, color: af.textSecondary },
});
