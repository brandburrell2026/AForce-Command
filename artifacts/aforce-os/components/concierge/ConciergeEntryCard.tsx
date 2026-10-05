/**
 * AForce Concierge — Home entry.
 *
 * One quiet card: the product line and a single affordance. It states nothing
 * about the member's body (no score, no dose, no clock) — Home's hero already
 * does that — so it can sit on both Home surfaces without touching the
 * editorial laws. Renders nothing when `ai_concierge_enabled` is off.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { af, afLayout, afType } from '@/theme';
import { Icon } from '@/components/Icon';
import { AFMotionPressable } from '@/components/ui';
import { useFeatureFlags } from '@/store/useAppStore';
import { useAFEyebrowType } from '@/hooks/useAFEyebrowType';

export interface ConciergeEntryCardProps {
  /** Editorial Home passes 'editorial' for the ink-on-black register. */
  tone?: 'standard' | 'editorial';
  testID?: string;
}

export function ConciergeEntryCard({ tone = 'standard', testID = 'concierge-entry-card' }: ConciergeEntryCardProps) {
  const flags = useFeatureFlags();
  const router = useRouter();
  const { t } = useTranslation();
  const eyebrowType = useAFEyebrowType();
  if (!flags.ai_concierge_enabled) return null;

  const title = t('concierge.entry_title');
  const sub = t('concierge.entry_sub');
  return (
    <AFMotionPressable
      onPress={() => router.push('/concierge')}
      motionEnabled={flags.elite_motion_enabled}
      haptic={flags.elite_motion_enabled ? 'selection' : false}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}. ${t('concierge.entry_cta')}`}
      style={[styles.card, tone === 'editorial' && styles.editorial]}
      pressedStyle={styles.pressed}
      testID={testID}
    >
      <View style={styles.iconWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon name="message-circle" size={18} color={af.textPrimary} />
      </View>
      <View style={styles.textCol}>
        <Text style={[styles.eyebrow, eyebrowType]}>{t('concierge.eyebrow').toUpperCase()}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <View style={styles.cta} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.ctaText}>{t('concierge.entry_cta')}</Text>
        <Icon name="arrow-right" size={14} color={af.textPrimary} />
      </View>
    </AFMotionPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: afLayout.controlMinHeight + 24,
    paddingVertical: 14,
    paddingHorizontal: afLayout.cardPadding,
    borderRadius: afLayout.radiusCard,
    backgroundColor: af.surface,
    borderWidth: afLayout.hairline,
    borderColor: af.border,
  },
  editorial: {
    backgroundColor: af.canvasElevated,
    borderColor: af.divider,
  },
  pressed: { backgroundColor: af.surfacePressed },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: af.redDim,
    borderWidth: afLayout.hairline,
    borderColor: af.redHairline,
  },
  textCol: { flex: 1, gap: 2 },
  eyebrow: { ...afType.eyebrow, color: af.textTertiary },
  title: { ...afType.bodyStrong, color: af.textPrimary },
  sub: { ...afType.secondary, color: af.textSecondary },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ctaText: { ...afType.microLabel, color: af.textPrimary },
});
