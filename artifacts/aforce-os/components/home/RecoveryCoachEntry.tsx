/**
 * RecoveryCoachEntry — the flag-gated Home affordance that opens the full-screen
 * Recovery Coach (S1). Self-hiding on two conditions so it never surfaces
 * prematurely:
 *   1. `spec_recoveryCoach` is OFF (default) → renders nothing. Flipping the
 *      flag is the single "go-live" switch for the whole focused mode.
 *   2. Recovery isn't currently recommended (score ≥ MODE_RECOVERY_SCORE) →
 *      renders nothing, so the entry only appears when the Coach has something
 *      to say.
 *
 * Additive and reversible — no nav change, no rebuild (Build Rule #14). Adopts
 * the F2 `AFCard` primitive; the Home redesign (S3) can absorb/replace it.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { AFCard } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { af, afType } from '@/theme';
import { useAppStore } from '@/store/useAppStore';
import { useEngineSlice } from '@/store/slices';
import { MODE_RECOVERY_SCORE } from '@/utils/modes/smartModes';

export function RecoveryCoachEntry() {
  const router = useRouter();
  const { state } = useAppStore();
  const engine = useEngineSlice();

  if (!state.featureFlags.spec_recoveryCoach) return null;
  const recoveryActive = typeof engine.score === 'number' && engine.score < MODE_RECOVERY_SCORE;
  if (!recoveryActive) return null;

  return (
    <View style={styles.wrap}>
      <AFCard
        variant="interactive"
        onPress={() => router.push('/recovery-coach')}
        accessibilityLabel="Open Recovery Coach"
        testID="recovery-coach-entry"
      >
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <Icon name="activity" size={16} color={af.red} />
          </View>
          <View style={styles.body}>
            <Text style={styles.eyebrow}>RECOVERY RECOMMENDED</Text>
            <Text style={styles.title}>Open Recovery Coach</Text>
            <Text style={styles.subtitle}>Live guidance for your next move.</Text>
          </View>
          <Icon name="chevron-right" size={18} color={af.textTertiary} />
        </View>
      </AFCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: af.redDim,
  },
  body: { flex: 1, gap: 2 },
  eyebrow: { ...afType.eyebrow, color: af.textTertiary },
  title: { ...afType.title3, color: af.textPrimary },
  subtitle: { ...afType.caption, color: af.textTertiary },
});
