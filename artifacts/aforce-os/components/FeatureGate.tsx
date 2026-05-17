/**
 * FeatureGate — Wraps Phase 2 / Phase 3 surfaces.
 * If the flag is OFF, renders an upgrade / coming-soon placeholder, never a dead link.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Icon } from './Icon';
import { Colors } from '../theme/colors';
import type { FeatureFlags } from '../types';
import { useAppStore } from '../store/useAppStore';

interface Props {
  flag: keyof FeatureFlags;
  title: string;
  description: string;
  accentColor?: string;
  ctaLabel?: string;
  children: React.ReactNode;
  onUpgrade?: () => void;
}

export function FeatureGate({
  flag,
  title,
  description,
  accentColor = Colors.guardian.primary,
  ctaLabel = 'Activate Demo',
  children,
  onUpgrade,
}: Props) {
  const { state, setFeatureFlags } = useAppStore();
  const enabled = state.featureFlags[flag];

  if (enabled) return <>{children}</>;

  const handleActivate = () => {
    if (onUpgrade) return onUpgrade();
    setFeatureFlags({ ...state.featureFlags, [flag]: true });
  };

  return (
    <View style={[styles.container, { borderColor: `${accentColor}33` }]}>
      <View style={[styles.iconWrap, { backgroundColor: `${accentColor}1A`, borderColor: `${accentColor}55` }]}>
        <Icon name="lock" size={20} color={accentColor} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.eyebrow, { color: accentColor }]}>DEMO LOCKED</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.desc}>{description}</Text>
        <Pressable
          onPress={handleActivate}
          style={({ pressed }) => [
            styles.cta,
            { borderColor: accentColor, backgroundColor: pressed ? `${accentColor}22` : `${accentColor}10` },
          ]}
        >
          <Text style={[styles.ctaText, { color: accentColor }]}>{ctaLabel}</Text>
          <Icon name="arrow-right" size={14} color={accentColor} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 14,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: Colors.background.card,
    marginHorizontal: 20,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 6 },
  eyebrow: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },
  desc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary,
    lineHeight: 17,
    marginBottom: 6,
  },
  cta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
    marginTop: 4,
  },
  ctaText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
});
