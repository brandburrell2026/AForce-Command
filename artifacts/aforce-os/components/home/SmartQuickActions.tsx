/**
 * SmartQuickActions — Priority #6 (Passive Logging) surface.
 *
 * Up to three one-tap logging pills on home so a hydration log takes
 * under two seconds: Repeat Last Drink · Log 12 oz · Complete Cycle.
 * No typing, no forms, no navigation. Mirrors DailyWinBanner: an
 * additive home row, no feature flag (fast logging is core), self-hides
 * only if nothing is available (the latter two are always present).
 *
 * Each tap records Time-To-Log into the internal analytics layer
 * (Priority #4) and calls the existing `logIntake`. The TTL clock is
 * anchored when the row mounts and reset after every log, so each
 * measurement is "time from the surface being ready to the tap".
 */
import React, { useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { hapticImpact } from '@/services/haptics';

import { Colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { useIntakeSlice, useCycleSlice, useActionsSlice } from '@/store/slices';
import { recordLogAction } from '@/services/analytics';
import {
  deriveQuickActions,
  type QuickAction,
} from '@/utils/logging/quickActions';
import type { FluidType } from '@/types';
import type { IntakeSource } from '@/services/intakeSource';

interface QuickLogActions {
  logIntake?: (
    fluidType: FluidType,
    opts?: {
      silent?: boolean;
      ozOverride?: number;
      flavorLabel?: string;
      /** Which surface is logging — record-only provenance. */
      source?: IntakeSource;
      displayNameOverride?: string;
      categoryId?: string;
    },
  ) => void | Promise<void>;
}

function asMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : 0;
  }
  return 0;
}

export function SmartQuickActions() {
  const intake = useIntakeSlice();
  const { isCompletingCycle } = useCycleSlice();
  const { logIntake } = useActionsSlice<QuickLogActions>();

  // TTL anchor: when the surface became ready (mount), reset after a log.
  const anchorRef = useRef<number>(Date.now());

  // Re-anchor whenever home regains focus so backgrounded / tab-away time
  // never inflates Time-To-Log — we measure "surface active → tap".
  useFocusEffect(
    useCallback(() => {
      anchorRef.current = Date.now();
    }, []),
  );

  const actions = useMemo(
    () =>
      deriveQuickActions({
        recentEvents: (intake.recentEvents ?? []).map((e) => ({
          fluidType: e.fluidType,
          oz: e.oz,
          flavor: e.flavor ?? null,
          loggedAt: asMillis(e.loggedAt),
        })),
      }),
    [intake.recentEvents],
  );

  const onPress = useCallback(
    (action: QuickAction) => {
      if (isCompletingCycle || !logIntake) return;
      const ttlMs = Date.now() - anchorRef.current;
      anchorRef.current = Date.now();
      void recordLogAction(ttlMs, action.id, new Date().toISOString());
      if (Platform.OS !== 'web') {
        hapticImpact('light');
      }
      void logIntake(action.fluidType, {
        source: 'home',
        ...(action.ozOverride != null ? { ozOverride: action.ozOverride } : {}),
        ...(action.flavorLabel ? { flavorLabel: action.flavorLabel } : {}),
      });
    },
    [isCompletingCycle, logIntake],
  );

  if (actions.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.row} testID="smart-quick-actions">
        {actions.map((action) => (
          <Pressable
            key={action.id}
            onPress={() => onPress(action)}
            disabled={isCompletingCycle}
            style={({ pressed }) => [
              styles.pill,
              pressed && !isCompletingCycle && { opacity: 0.85 },
              isCompletingCycle && { opacity: 0.5 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${action.label}: ${action.detail}`}
            testID={`quick-action-${action.id}`}
          >
            <Icon name={action.icon} size={14} color={Colors.text.primary} />
            <Text style={styles.label} numberOfLines={1}>
              {action.label}
            </Text>
            <Text style={styles.detail} numberOfLines={1}>
              {action.detail}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.fill.light,
  },
  label: {
    color: Colors.text.primary,
    fontSize: 10,
    letterSpacing: 1.2,
    fontFamily: 'Inter_600SemiBold',
  },
  detail: {
    color: Colors.text.secondary,
    fontSize: 10,
    letterSpacing: 0.2,
  },
});

export default SmartQuickActions;
