/**
 * CoachModePip — small status pip surfacing the active Coach Mode
 * posture (Silent / Ambient / Spoken) per Spec Rule #12 ("Reduce
 * talking").
 *
 * The pip is the visible counterpart to the existing Profile picker:
 * it tells the user — at a glance, from the home zone — which
 * voice/haptic posture the coach is currently operating under.
 *
 * Renders nothing when `spec_coachV2` is off (the picker still works
 * for power users but the coach behaves as 'spoken', so the pip
 * would be misleading).
 *
 * Tap target: navigates to Profile so the user can change the
 * posture without hunting for it.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { Colors } from '../../theme/colors';
import { useFeatureFlags } from '@/store/useAppStore';
import { useCoachModeSetting, type CoachMode } from '@/services/coachMode';

const LABEL: Record<CoachMode, string> = {
  silent: 'SILENT',
  ambient: 'AMBIENT',
  spoken: 'SPOKEN',
};

// Spoken = today's loud baseline → muted accent. Ambient/Silent
// are the deliberate "quieter" postures Rule #12 introduces →
// WHOOP lime to signal the user has taken control of the coach.
function accentFor(mode: CoachMode): string {
  return mode === 'spoken' ? Colors.text.muted : Colors.accent.primary;
}

export function CoachModePip() {
  const flags = useFeatureFlags();
  const mode = useCoachModeSetting();
  const router = useRouter();

  if (!flags.spec_coachV2) return null;

  const accent = accentFor(mode);

  const onPress = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    router.push('/(tabs)/profile');
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.pip, { borderColor: `${accent}55`, backgroundColor: `${accent}14` }]}
      accessibilityRole="button"
      accessibilityLabel={`Coach mode ${LABEL[mode].toLowerCase()}. Tap to change.`}
      testID="home-coach-pip"
    >
      <View style={[styles.dot, { backgroundColor: accent }]} />
      <Text style={[styles.eyebrow, { color: accent }]}>COACH</Text>
      <Text style={[styles.label, { color: accent }]}>{LABEL[mode]}</Text>
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
});
