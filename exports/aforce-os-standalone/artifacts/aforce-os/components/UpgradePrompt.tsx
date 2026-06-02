/**
 * Upgrade Prompt.
 *
 * Modal-style overlay that appears when a user taps a locked feature.
 * Shows feature name, what it unlocks, the required plan, and a CTA
 * that routes the user to /subscription.
 */

import React from 'react';
import {
  Modal, View, Text, StyleSheet, Pressable, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Icon } from './Icon';

import { Colors } from '@/theme/colors';
import type { GateCheck, SubscriptionPlanId } from '@/types/subscription';
import { PLAN_BY_ID } from '@/data/subscriptionPlans';

interface Props {
  gate: GateCheck | null;
  visible: boolean;
  onDismiss: () => void;
  onUpgrade: (planId: SubscriptionPlanId) => void;
}

const PLAN_ACCENT: Record<SubscriptionPlanId, string> = {
  core:            Colors.states.BALANCED.primary,
  recovery_plus:   Colors.states.RECOVERING.primary,
  athlete:         Colors.states.PEAK.primary,
  system:          Colors.states.PEAK.primary,
  elite:           Colors.guardian.primary,
  team_starter:    Colors.states.BALANCED.primary,
  team_growth:     Colors.states.BALANCED.primary,
  team_pro:        Colors.states.BALANCED.primary,
  clutch_starter:  Colors.clutch.primary,
  clutch_pro:      Colors.clutch.primary,
  clutch_elite:    Colors.clutch.primary,
  guardian_core:   Colors.guardian.primary,
  guardian_elite:  Colors.guardian.primary,
};

export function UpgradePrompt({ gate, visible, onDismiss, onUpgrade }: Props) {
  if (!gate) return null;
  const planId = gate.requiredPlanId ?? 'athlete';
  const plan = PLAN_BY_ID[planId];
  const accent = PLAN_ACCENT[planId];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.scrim} onPress={onDismiss}>
        <Pressable style={[styles.sheet, { borderColor: `${accent}55` }]} onPress={() => {}}>
          <View style={[styles.iconWrap, { backgroundColor: `${accent}1A`, borderColor: `${accent}66` }]}>
            <Icon name="lock" size={20} color={accent} />
          </View>
          <Text style={styles.eyebrow}>LOCKED FEATURE</Text>
          <Text style={styles.title}>{gate.featureLabel}</Text>
          <Text style={styles.body}>
            Unlocked with {plan.name}. {plan.positioning}.
          </Text>

          <View style={[styles.planChip, { backgroundColor: `${accent}14`, borderColor: `${accent}55` }]}>
            <Icon name="zap" size={11} color={accent} />
            <Text style={[styles.planChipText, { color: accent }]}>
              {plan.name.toUpperCase()} · {plan.priceLabel}
            </Text>
          </View>

          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              onUpgrade(planId);
            }}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: accent, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={styles.ctaText}>UPGRADE TO {plan.name.toUpperCase()}</Text>
          </Pressable>

          <Pressable onPress={onDismiss} style={styles.dismiss}>
            <Text style={styles.dismissText}>Not now</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%', maxWidth: 360,
    backgroundColor: Colors.background.elevated,
    borderRadius: 22, borderWidth: 1,
    padding: 24, gap: 12, alignItems: 'center',
  },
  iconWrap: {
    width: 48, height: 48, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  eyebrow: {
    fontSize: 10, fontFamily: 'Inter_700Bold',
    color: Colors.text.muted, letterSpacing: 2,
  },
  title: {
    fontSize: 20, fontFamily: 'Inter_700Bold',
    color: Colors.text.primary, letterSpacing: -0.4, textAlign: 'center',
  },
  body: {
    fontSize: 13, fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary, lineHeight: 19, textAlign: 'center',
  },
  planChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 100, borderWidth: 1, marginTop: 4,
  },
  planChipText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },
  cta: {
    width: '100%', paddingVertical: 14, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  ctaText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#000', letterSpacing: 1.4 },
  dismiss: { paddingVertical: 6 },
  dismissText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.text.muted },
});
