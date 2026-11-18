/**
 * FeatureGate — Wraps Phase 2 / Phase 3 surfaces.
 * If the flag is OFF, renders a placeholder, never a dead link.
 *
 * The "Activate Demo" control is a developer convenience, not an entitlement:
 * it is offered only where `featureGateSelfActivationAllowed` permits it
 * (stop-ship RA-N1). In an ordinary production build a locked gate shows a
 * neutral "not available" card with no control and none of the caller's
 * feature copy.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Icon } from './Icon';
import { Colors } from '../theme/colors';
import type { FeatureFlags } from '../types';
import { useAppStore } from '../store/useAppStore';
import { featureGateSelfActivationAllowed } from '../featureFlags/flags';

/** Shown instead of the caller's description when the gate cannot be opened here. */
export const FEATURE_GATE_UNAVAILABLE_COPY = "This feature isn't available in this version.";

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

  const selfActivation = featureGateSelfActivationAllowed(flag);
  const canAct = Boolean(onUpgrade) || selfActivation;

  const handleActivate = () => {
    if (onUpgrade) return onUpgrade();
    if (!selfActivation) return;
    setFeatureFlags({ ...state.featureFlags, [flag]: true });
  };

  return (
    <View style={[styles.container, { borderColor: `${accentColor}33` }]}>
      <View style={[styles.iconWrap, { backgroundColor: `${accentColor}1A`, borderColor: `${accentColor}55` }]}>
        <Icon name="lock" size={20} color={accentColor} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.eyebrow, { color: accentColor }]}>
          {canAct ? 'DEMO LOCKED' : 'NOT AVAILABLE'}
        </Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.desc}>{canAct ? description : FEATURE_GATE_UNAVAILABLE_COPY}</Text>
        {canAct ? (
          <Pressable
            onPress={handleActivate}
            accessibilityRole="button"
            testID="feature-gate-activate"
            style={({ pressed }) => [
              styles.cta,
              { borderColor: accentColor, backgroundColor: pressed ? `${accentColor}22` : `${accentColor}10` },
            ]}
          >
            <Text style={[styles.ctaText, { color: accentColor }]}>{ctaLabel}</Text>
            <Icon name="arrow-right" size={14} color={accentColor} />
          </Pressable>
        ) : null}
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
