/**
 * OnboardingOverlay — First-launch coach mark.
 * 3 paged screens introducing AForce OS, the 4 tabs, and the Demo Access toggle.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors } from '../theme/colors';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

const PAGES = [
  {
    eyebrow: 'WELCOME TO AFORCE OS',
    title: 'A real-time human performance OS.',
    body: 'AForce tells you what to do next, not what you did yesterday. The Pulse, score, and AI command update live.',
    icon: 'activity' as const,
  },
  {
    eyebrow: 'YOUR LOOP',
    title: 'Home → Check → Protocol → Profile.',
    body: 'Home shows your live score. Check updates your signals. Protocol shows the active stage. Profile is your settings + Demo Access.',
    icon: 'compass' as const,
  },
  {
    eyebrow: 'DEMO ACCESS',
    title: 'Unlock Phase 2 and Phase 3.',
    body: 'Open Profile → DEMO ACCESS → Unlock all to preview Clutch (Command the Team) and Guardian (Protect the Roster).',
    icon: 'unlock' as const,
  },
];

export function OnboardingOverlay({ visible, onDismiss }: Props) {
  const [page, setPage] = useState(0);
  const opacity = useSharedValue(visible ? 1 : 0);
  const scale = useSharedValue(visible ? 1 : 0.9);

  React.useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 280 });
      scale.value = withSpring(1, { damping: 16, stiffness: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 180 });
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!visible) return null;

  const isLast = page === PAGES.length - 1;
  const current = PAGES[page];
  const accent = Colors.states.PEAK.primary;

  const next = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    if (isLast) onDismiss();
    else setPage(page + 1);
  };

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="auto">
      <Animated.View style={[styles.card, cardStyle, { borderColor: `${accent}33` }]}>
        <View style={[styles.iconCircle, { backgroundColor: `${accent}1A`, borderColor: `${accent}55` }]}>
          <Feather name={current.icon} size={28} color={accent} />
        </View>
        <Text style={[styles.eyebrow, { color: accent }]}>{current.eyebrow}</Text>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.body}>{current.body}</Text>

        <View style={styles.dotsRow}>
          {PAGES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === page ? accent : Colors.fill.medium,
                  width: i === page ? 22 : 6,
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.actions}>
          {page > 0 && (
            <Pressable onPress={() => setPage(page - 1)} style={styles.backBtn} hitSlop={8}>
              <Feather name="chevron-left" size={14} color={Colors.text.secondary} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          <Pressable onPress={onDismiss} style={styles.skipBtn} hitSlop={8}>
            <Text style={styles.skipText}>SKIP</Text>
          </Pressable>
          <Pressable onPress={next} style={[styles.nextBtn, { backgroundColor: accent }]}>
            <Text style={styles.nextText}>{isLast ? 'START' : 'NEXT'}</Text>
            <Feather name={isLast ? 'check' : 'arrow-right'} size={14} color="#000" />
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,2,8,0.92)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 300, paddingHorizontal: 26,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.background.elevated,
    borderRadius: 24, borderWidth: 1,
    paddingHorizontal: 26, paddingVertical: 28,
  },
  iconCircle: {
    width: 60, height: 60, borderRadius: 30, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  eyebrow: {
    fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 2.5, marginBottom: 6,
  },
  title: {
    fontSize: 22, fontFamily: 'Inter_700Bold',
    color: Colors.text.primary, letterSpacing: -0.4, marginBottom: 10, lineHeight: 28,
  },
  body: {
    fontSize: 14, fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary, lineHeight: 20, marginBottom: 22,
  },
  dotsRow: {
    flexDirection: 'row', gap: 6, marginBottom: 22,
  },
  dot: { height: 6, borderRadius: 3 },
  actions: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 8, paddingRight: 8,
  },
  backText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.text.secondary },
  skipBtn: { paddingVertical: 10, paddingHorizontal: 12 },
  skipText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 1.5 },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
  },
  nextText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#000', letterSpacing: 1.5 },
});
