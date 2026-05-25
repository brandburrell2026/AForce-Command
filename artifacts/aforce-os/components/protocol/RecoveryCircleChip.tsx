/**
 * RecoveryCircleChip — minimum-surface visible touchpoint for the
 * Recovery Circle service (Spec Rule #11: "Build hidden. No referral
 * wording. Day 0 / Day 1 / Day 3 / Day 7 / Day 30. Max 3 people. No
 * feed.").
 *
 * Rule #11 forbids a feed, invites, or referral copy. This chip is
 * the smallest possible visible affordance: a single read-only line
 * surfacing the next (or currently-due) checkpoint day so the user
 * knows the cadence exists. No tap target, no member list, no share
 * button.
 *
 * Renders nothing when:
 *   - the `spec_recoveryCircle` flag is off
 *   - no snapshot exists yet AND the seed write hasn't completed
 *   - all five checkpoints (Day 0/1/3/7/30) have been completed
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Colors } from '@/theme/colors';
import { useFeatureFlags } from '@/store/useAppStore';
import {
  ensureRecoveryCircle,
  currentCheckpoint,
  nextCheckpoint,
  type RecoveryCircleSnapshot,
} from '@/services/recoveryCircle';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function relativeDaysLabel(dueAtIso: string, now: number): string {
  const delta = Date.parse(dueAtIso) - now;
  if (!Number.isFinite(delta)) return '';
  const days = Math.round(delta / MS_PER_DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'in 1 day';
  return `in ${days} days`;
}

export function RecoveryCircleChip() {
  const flags = useFeatureFlags();
  const [snapshot, setSnapshot] = useState<RecoveryCircleSnapshot | null>(null);

  // Seed-and-load: the hidden service only reads, so we ensure a
  // snapshot exists on first mount when the flag is on. Day 0 is
  // anchored to "now" so the checkpoint cadence starts immediately.
  useEffect(() => {
    if (!flags.spec_recoveryCircle) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    void ensureRecoveryCircle(new Date().toISOString()).then((s) => {
      if (!cancelled) setSnapshot(s);
    });
    return () => {
      cancelled = true;
    };
  }, [flags.spec_recoveryCircle]);

  if (!flags.spec_recoveryCircle || !snapshot) return null;

  const now = Date.now();
  const due = currentCheckpoint(snapshot.checkpoints, now);
  const upcoming = due ? null : nextCheckpoint(snapshot.checkpoints, now);

  // All five checkpoints completed — chip retires itself rather than
  // showing a stale "Day 30" forever.
  if (!due && !upcoming) return null;

  const label = due ? `Day ${due.day} check-in · due now` : `Next check-in · Day ${upcoming!.day}`;
  const meta = due ? '' : relativeDaysLabel(upcoming!.dueAt, now);
  const accent = due ? Colors.accent.primary : Colors.text.secondary;

  return (
    <View
      style={[styles.chip, { borderColor: due ? `${accent}40` : Colors.border.subtle }]}
      accessibilityRole="text"
      accessibilityLabel={due ? `Recovery Circle ${label}` : `Recovery Circle ${label} ${meta}`}
      testID="recovery-circle-chip"
    >
      <View style={[styles.dot, { backgroundColor: accent }]} />
      <Text style={styles.label}>{label}</Text>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    backgroundColor: Colors.background.card,
    gap: 8,
    marginBottom: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.primary,
    letterSpacing: 0.2,
  },
  meta: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
    letterSpacing: 0.1,
  },
});
