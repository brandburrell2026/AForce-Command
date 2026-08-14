/**
 * PrimaryCTA — "Become AForce" big tappable button + Snooze affordance +
 * the flavor picker modal it opens.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from '../Icon';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { Colors } from '../../theme/colors';
import { FlavorPickerModal, type FlavorChoice } from '../FlavorPickerModal';
import { useEngineSlice, useUserSlice, useCycleSlice, useActionsSlice } from '../../store/slices';
import { useDisplayedAccent } from '../../hooks/useDisplayedAccent';
import type { FluidType } from '../../types';
import type { IntakeSource } from '@/services/intakeSource';

interface Layout {
  ctaPaddingV: number;
  gutter: number;
}

interface CtaActions {
  logIntake: (
    fluidType: FluidType,
    opts?: { silent?: boolean; ozOverride?: number; flavorLabel?: string; source?: IntakeSource },
  ) => Promise<void>;
  snooze: () => void;
}

interface Props { layout: Layout }

function PrimaryCTAImpl({ layout }: Props) {
  const { t } = useTranslation();
  const { performanceState } = useEngineSlice();
  const userState = useUserSlice();
  const { isCompletingCycle } = useCycleSlice();
  const { logIntake, snooze } = useActionsSlice<CtaActions>();
  const [open, setOpen] = React.useState(false);
  // Track the visible (animating) accent so the "Become AForce" CTA
  // border + glow change colour together with the orb digit and the
  // AI Coach card.
  const displayed = useDisplayedAccent();
  const stateColor = displayed?.primary ?? performanceState.color;

  const onCta = () => {
    if (isCompletingCycle) return;
    Haptics.selectionAsync().catch(() => {});
    setOpen(true);
  };
  const onChoose = (flavor: FlavorChoice | null) => {
    setOpen(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    const fluid = flavor?.fluid ?? 'aforce_stick';
    const opts = flavor
      ? {
          flavorLabel: flavor.label,
          ...(flavor.ozOverride != null ? { ozOverride: flavor.ozOverride } : {}),
        }
      : undefined;
    logIntake(fluid, opts);
  };
  const onSnooze = () => { Haptics.selectionAsync(); snooze(); };

  return (
    <>
      <FlavorPickerModal
        visible={open}
        format="both"
        onCancel={() => setOpen(false)}
        onConfirm={onChoose}
      />
      <TouchableOpacity
        style={[
          styles.ctaButton,
          { borderColor: `${stateColor}66`, paddingVertical: layout.ctaPaddingV, marginHorizontal: layout.gutter },
          isCompletingCycle && styles.ctaDisabled,
        ]}
        onPress={onCta}
        activeOpacity={0.85}
        disabled={isCompletingCycle}
      >
        <View style={[styles.ctaGlow, { backgroundColor: `${stateColor}1F` }]} />
        <Icon name="check-circle" size={20} color={isCompletingCycle ? Colors.text.muted : stateColor} />
        <Text style={[styles.ctaText, { color: isCompletingCycle ? Colors.text.muted : Colors.text.primary }]}>
          {isCompletingCycle ? `${t('home.cta_become_aforce')}…` : t('home.cta_become_aforce')}
        </Text>
      </TouchableOpacity>
      {!userState.isSnoozed ? (
        <TouchableOpacity style={styles.snoozeBtn} onPress={onSnooze} activeOpacity={0.7}>
          <Icon name="clock" size={12} color={Colors.text.muted} />
          <Text style={styles.snoozeText}>{t('home.snooze')}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.snoozeBtn}>
          <Icon name="moon" size={12} color={Colors.states.RECOVERING.primary} />
          <Text style={[styles.snoozeText, { color: Colors.states.RECOVERING.primary }]}>
            {t('home.snoozed')}
          </Text>
        </View>
      )}
    </>
  );
}

export const PrimaryCTA = React.memo(PrimaryCTAImpl);

const styles = StyleSheet.create({
  ctaButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 18, borderRadius: 16,
    backgroundColor: Colors.background.elevated, borderWidth: 1.5, overflow: 'hidden',
  },
  ctaGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  snoozeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, marginTop: 4,
  },
  snoozeText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.text.muted },
});
