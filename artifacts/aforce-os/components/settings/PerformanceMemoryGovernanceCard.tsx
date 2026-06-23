/**
 * PerformanceMemoryGovernanceCard — the read-only governance surface for
 * Performance Memory™.
 *
 * It projects the unified Performance Memory snapshot (via the pure
 * `useUnifiedPerformanceMemory` hook) into a summarized, human-readable
 * read-out plus per-source coverage so a member can see exactly what the app
 * has observed about their behaviour. The single "Delete" action calls
 * `clearPerformanceMemoryCapture()`, which permanently erases the three
 * locally-captured observational streams (travel / caffeine / self-reported
 * priority).
 *
 * Score-Protection: this card is display + delete ONLY. It dispatches nothing
 * into the hydration reducer and never awards, reads-into, mutates, or
 * fabricates score. Mounted behind `performance_memory_governance_enabled`;
 * capture itself is always-on and independent of this flag.
 *
 * Self-contained so it can drop into the existing Profile settings card
 * without adding navigation (replit.md build lock).
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Alert } from 'react-native';

import { Colors } from '@/theme/colors';
import { Icon, type IconName } from '@/components/Icon';
import { useUnifiedPerformanceMemory } from '@/hooks/useUnifiedPerformanceMemory';
import { clearPerformanceMemoryCapture } from '@/services/performanceMemoryCapture';

/** Format a "X of Y days" coverage hint, or a neutral empty-state string. */
function coverageHint(available: boolean, sampleSize: number): string {
  if (!available || sampleSize <= 0) return 'No data yet';
  return `${sampleSize} observed`;
}

function MemoryRow(props: {
  icon: IconName;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Icon name={props.icon} size={15} color={Colors.text.secondary} />
        <View style={styles.textWrap}>
          <Text style={styles.label}>{props.label}</Text>
          <Text style={styles.hint}>{props.hint}</Text>
        </View>
      </View>
      <Text style={styles.value}>{props.value}</Text>
    </View>
  );
}

export function PerformanceMemoryGovernanceCard() {
  const memory = useUnifiedPerformanceMemory();
  const [busy, setBusy] = React.useState(false);

  const runDelete = React.useCallback(async () => {
    setBusy(true);
    try {
      await clearPerformanceMemoryCapture();
    } finally {
      setBusy(false);
    }
  }, []);

  const onDelete = React.useCallback(() => {
    if (Platform.OS === 'web') {
      void runDelete();
      return;
    }
    Alert.alert(
      'Delete captured memory?',
      'This permanently erases the observational streams AForce has captured on this device (travel, caffeine, and your self-reported daily priority). It does not affect your account, hydration history, command history, or scores.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void runDelete();
          },
        },
      ],
    );
  }, [runDelete]);

  const {
    hydrationPatterns: hp,
    caffeinePatterns: cp,
    travelPatterns: tp,
    userPriorities: up,
    completionHistory: ch,
    checkInHistory: cih,
    recoveryPatterns: rp,
    performanceAgeHistory: pah,
    lastUpdated,
  } = memory;

  const updatedLabel =
    lastUpdated == null
      ? 'No memory captured yet'
      : `Updated ${new Date(lastUpdated).toLocaleDateString()}`;

  return (
    <View style={styles.wrap} testID="performance-memory-governance">
      <View style={styles.header}>
        <Icon name="activity" size={16} color={Colors.text.secondary} />
        <View style={styles.textWrap}>
          <Text style={styles.title}>Performance Memory</Text>
          <Text style={styles.subTitle}>
            A read-only summary of what AForce has observed about your behaviour.
            Observational only — it never changes your score.
          </Text>
        </View>
      </View>

      <View style={styles.list}>
        <MemoryRow
          icon="droplet"
          label="Hydration"
          value={`${hp.totalLogs}`}
          hint={`${hp.daysActive} active ${hp.daysActive === 1 ? 'day' : 'days'} · ${coverageHint(
            hp.coverage.available,
            hp.coverage.sampleSize,
          )}`}
        />
        <MemoryRow
          icon="coffee"
          label="Caffeine"
          value={`${cp.totalLogs}`}
          hint={`${cp.daysWithCaffeine} ${cp.daysWithCaffeine === 1 ? 'day' : 'days'} · ${coverageHint(
            cp.coverage.available,
            cp.coverage.sampleSize,
          )}`}
        />
        <MemoryRow
          icon="navigation"
          label="Travel"
          value={`${tp.travelDays}`}
          hint={coverageHint(tp.coverage.available, tp.coverage.sampleSize)}
        />
        <MemoryRow
          icon="target"
          label="Daily priority"
          value={up.topGoal ?? '—'}
          hint={`${up.daysRecorded} ${up.daysRecorded === 1 ? 'day' : 'days'} · ${coverageHint(
            up.coverage.available,
            up.coverage.sampleSize,
          )}`}
        />
        <MemoryRow
          icon="check-circle"
          label="Command completion"
          value={ch.total > 0 ? `${ch.followed}/${ch.total}` : '—'}
          hint={coverageHint(ch.coverage.available, ch.coverage.sampleSize)}
        />
        <MemoryRow
          icon="calendar"
          label="Check-ins"
          value={`${cih.entriesLogged}`}
          hint={`${cih.streak} ${cih.streak === 1 ? 'day' : 'days'} streak`}
        />
        <MemoryRow
          icon="battery"
          label="Recovery"
          value={rp.available && rp.recovery != null ? `${Math.round(rp.recovery)}` : '—'}
          hint={rp.available && rp.trend ? rp.trend : 'No data yet'}
        />
        <MemoryRow
          icon="trending-up"
          label="Performance Age"
          value={pah.latest != null ? `${pah.latest}` : '—'}
          hint={`${pah.daysOfHistory} ${pah.daysOfHistory === 1 ? 'day' : 'days'} · ${coverageHint(
            pah.coverage.available,
            pah.coverage.sampleSize,
          )}`}
        />
      </View>

      <Text style={styles.updated}>{updatedLabel}</Text>

      <Pressable
        onPress={onDelete}
        disabled={busy}
        style={styles.deleteBtn}
        accessibilityRole="button"
        accessibilityLabel="Delete captured performance memory"
        testID="performance-memory-delete"
      >
        <Text style={styles.deleteLabel}>Delete captured memory</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  subTitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: Colors.text.secondary,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  textWrap: { flex: 1 },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.text.primary,
  },
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 14,
    color: Colors.text.secondary,
    marginTop: 1,
  },
  value: {
    fontFamily: 'IBMPlexMono_500Medium',
    fontSize: 13,
    color: Colors.text.primary,
  },
  updated: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 10,
    letterSpacing: 0.3,
    color: Colors.text.muted,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  deleteBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  deleteLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.2,
    color: '#FF2800',
  },
});

export default PerformanceMemoryGovernanceCard;
