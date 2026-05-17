/**
 * BACEstimateCard — Estimated Blood Alcohol Concentration tile.
 *
 * SAFETY:
 *   This card always renders the `social.estimate_only` +
 *   `social.not_legal_medical` disclaimer copy underneath the number.
 *   We render a *range* (e.g. "0.06–0.08") to make it visually clear
 *   the value is approximate, never a single false-precision figure.
 *
 * Layout: range + trend arrow on the left, confidence chip + clear
 * time on the right, disclaimer footer beneath.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon, type IconName } from './Icon';
import { useTranslation } from 'react-i18next';

import { Colors } from '../theme/colors';
import type { BACEstimate } from '../types';

interface Props {
  bac: BACEstimate;
}

const TREND_ICON: Record<BACEstimate['trend'], IconName> = {
  rising: 'trending-up',
  steady: 'minus',
  falling: 'trending-down',
};

const TREND_COLOR: Record<BACEstimate['trend'], string> = {
  rising: '#F4B23F',
  steady: 'rgba(255,255,255,0.55)',
  falling: '#7CFB9D',
};

function formatBAC(value: number): string {
  // 3 decimal precision to surface 0.005 deltas without misleading the user.
  return value.toFixed(3);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatClearTime(minutes: number, t: (key: string, opts?: any) => string): string {
  if (minutes <= 0) return t('social.bac_clear_now');
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return t('social.bac_clear_minutes', { minutes: m });
  if (m === 0) return t('social.bac_clear_hours', { hours: h });
  return t('social.bac_clear_hours_minutes', { hours: h, minutes: m });
}

export function BACEstimateCard({ bac }: Props) {
  const { t } = useTranslation();
  const trendColor = TREND_COLOR[bac.trend];

  return (
    <View style={styles.card} testID="bac-estimate-card">
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>{t('social.bac_label')}</Text>
        <View style={[styles.confidence, { borderColor: 'rgba(157,124,251,0.45)' }]}>
          <Text style={styles.confidenceText}>
            {t(`social.bac_confidence_${bac.confidence}`)}
          </Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.range}>
            {formatBAC(bac.rangeLow)}<Text style={styles.dash}>–</Text>{formatBAC(bac.rangeHigh)}
          </Text>
          <View style={styles.trendRow}>
            <Icon name={TREND_ICON[bac.trend]} size={13} color={trendColor} />
            <Text style={[styles.trendText, { color: trendColor }]}>
              {t(`social.bac_trend_${bac.trend}`)}
            </Text>
          </View>
        </View>
        <View style={styles.clearBlock}>
          <Text style={styles.clearLabel}>{t('social.bac_clear_label')}</Text>
          <Text style={styles.clearValue}>{formatClearTime(bac.timeToClearMinutes, t)}</Text>
        </View>
      </View>

      <View style={styles.disclaimerRow}>
        <Icon name="info" size={11} color="rgba(255,255,255,0.45)" />
        <Text style={styles.disclaimer}>
          {t('social.estimate_only')} · {t('social.not_legal_medical')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(157,124,251,0.30)',
    backgroundColor: 'rgba(157,124,251,0.07)',
    padding: 14,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#9D7CFB',
    letterSpacing: 1.6,
  },
  confidence: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  confidenceText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: '#9D7CFB',
    letterSpacing: 1.2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginBottom: 10,
  },
  range: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  dash: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 22,
    fontFamily: 'Inter_400Regular',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  trendText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
  },
  clearBlock: {
    alignItems: 'flex-end',
  },
  clearLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  clearValue: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  disclaimer: {
    flex: 1,
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 14,
  },
});
