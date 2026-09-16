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
import { useAuth } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";

import { FeatureGate } from "@/components/FeatureGate";
import { af, afLayout, afType } from "@/theme/afTokens";
import { useFeatureFlags } from "@/store/useAppStore";
import { buildTrainerDemoRoster } from "@/data/trainerDemoSeed";
import TrainerAthleteRecordScreen from "@/screens/TrainerAthleteRecordScreen";
import { buildRecord, type AthleteRecord } from "@/utils/trainerRecord";
import { trainerStorage } from "@/services/trainerStorage";
import { freshnessLabel, readRecord, writeRecord } from "@/utils/trainerRecordCache";

/**
 * Fallback viewer scope.
 *
 * The key shape was always per-viewer — two staff sharing a device must not
 * read each other's cached athletes — but the value was hardcoded to
 * `"demo_viewer"`, which defeated the design completely: every trainer on a
 * device shared one namespace, so the cache answered whoever asked. The real
 * scope is now the signed-in user id.
 *
 * This constant remains only for the signed-out case, where there is nothing
 * to key on. Nothing clinical is written under it, because a signed-out
 * session has no record to fetch.
 */
const ANONYMOUS_SCOPE = "anonymous";

export default function TrainerAthleteRecordRoute() {
  const router = useRouter();
  const flags = useFeatureFlags();
  const { athleteId } = useLocalSearchParams<{ athleteId: string }>();

  const { userId } = useAuth();
  /**
   * The cache is keyed on the signed-in staff member, and the record itself
   * carries note bodies and availability reasons — which is why it is stored
   * through `secureKV` (expo-secure-store) rather than plain AsyncStorage.
   * The Lock already requires an encrypted local cache for profile-class
   * data; a medical note is not a lesser class than a profile.
   */
  const viewerScope = userId ?? ANONYMOUS_SCOPE;

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
      const cached = await readRecord(trainerStorage, viewerScope, athleteId);
      if (!cancelled && cached) {
        setRecord(cached.record);
        setCacheAgeMs(cached.ageMs);
      }

      // 2. Then the live source, if there is one.
      const live = loadLive();
      if (!cancelled && live) {
        setRecord(live);
        setCacheAgeMs(null);
        await writeRecord(trainerStorage, viewerScope, live);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [athleteId, loadLive, viewerScope]);

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
