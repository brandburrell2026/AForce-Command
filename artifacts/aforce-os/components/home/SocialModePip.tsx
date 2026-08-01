/**
 * SocialModePip — one-tap Social Mode toggle for the home zone
 * (Spec Rule #13 visible touchpoint).
 *
 * Social Mode already exists as a full screen + Profile toggle; this
 * pip is the smallest possible home-zone affordance so the user can
 * arm/disarm without leaving the home tab. When active it surfaces
 * the live depletion rate so the user feels the cost of the choice.
 *
 * No new screens, no feed, no member list — Rule #13 keeps Social
 * surfaces minimal. Tap toggles; long press is not used.
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../theme/colors';
import { useAppStore, useFeatureFlags } from '@/store/useAppStore';
import { useEngineSlice, useUserSlice } from '../../store/slices';
import { isNightOutEnabled, nightOutInternalPreviewContext } from '@/services/nightOut/access';

export function SocialModePip() {
  const userState = useUserSlice();
  const engine = useEngineSlice();
  const flags = useFeatureFlags();
  const { activateSocialMode, deactivateSocialMode } = useAppStore();

  const active = !!userState.socialMode?.active;
  const decay = engine.prediction.decayPerMinute;

  const onPress = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    if (active) {
      void deactivateSocialMode();
    } else {
      void activateSocialMode();
    }
  }, [active, activateSocialMode, deactivateSocialMode]);

  // NO-b: Night Out (formerly Social Mode) is Founder/Internal-Preview only
  // (NO-10). This Home entry renders NOTHING unless authorized — so production /
  // unauthorized users can neither see nor activate Night Out from Home.
  if (!isNightOutEnabled(flags, nightOutInternalPreviewContext())) return null;

  // Inactive = muted border, active = Signal Red accent + decay badge so the
  // cost of the choice is visible at a glance.
  const accent = active ? Colors.accent.primary : Colors.text.muted;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.pip, { borderColor: `${accent}55`, backgroundColor: `${accent}14` }]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={active ? 'Night Out active. Tap to deactivate.' : 'Activate Night Out.'}
      testID="home-social-pip"
    >
      <View style={[styles.dot, { backgroundColor: accent }]} />
      <Text style={[styles.eyebrow, { color: accent }]}>NIGHT OUT</Text>
      <Text style={[styles.label, { color: accent }]}>{active ? 'ON' : 'OFF'}</Text>
      {active ? (
        <Text style={styles.decay}>{decay.toFixed(2)} pts/min</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
  },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  eyebrow: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.4,
    opacity: 0.85,
  },
  label: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
  },
  decay: {
    fontSize: 9,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.muted,
    letterSpacing: 0.5,
    marginLeft: 2,
  },
});
