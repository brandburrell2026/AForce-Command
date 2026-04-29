/**
 * Collapsible per-day summary card. Tap to expand details:
 * intake count, total oz, sodium in/out, deficit %, time per band,
 * AForce units, sessions.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { JournalRollup } from '@/types';
import { Colors } from '@/theme/colors';

interface Props {
  rollup: JournalRollup;
}

function avgColor(score: number): string {
  if (score >= 85) return '#B4FF50';
  if (score >= 65) return '#00E5C8';
  if (score >= 40) return '#FFA01E';
  return '#FF2D55';
}

function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map((s) => Number(s));
  if (!y || !m || !d) return ymd;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function JournalDayCard({ rollup }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const color = avgColor(rollup.avgScore);

  return (
    <Pressable
      onPress={() => setOpen((o) => !o)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={styles.card}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.date}>{formatDate(rollup.date)}</Text>
          <Text style={styles.meta}>
            {rollup.snapshotsCount} snapshots · {rollup.intakeCount} intakes
          </Text>
        </View>
        <View style={styles.scoreCol}>
          <Text style={[styles.scoreVal, { color }]}>{rollup.avgScore}</Text>
          <Text style={styles.scoreLabel}>{t('journal.day_card_avg')}</Text>
        </View>
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#5C6275"
          style={{ marginLeft: 12 }}
        />
      </View>

      {open && (
        <View style={styles.body}>
          <Row label={t('journal.day_card_oz')} value={`${rollup.endOzConsumed.toFixed(0)}`} />
          <Row label={t('journal.day_card_aforce')} value={`${rollup.endAforceUnits}`} />
          <Row label={t('journal.day_card_sodium_in')} value={`${rollup.endSodiumDelivered.toFixed(0)}`} />
          <Row label={t('journal.day_card_sodium_lost')} value={`${rollup.endSodiumLost.toFixed(0)}`} />
          {rollup.endDeficitPct > 0 && (
            <Row label={t('journal.day_card_deficit')} value={`${rollup.endDeficitPct.toFixed(1)}%`} />
          )}
          <View style={styles.bandRow}>
            <Text style={styles.bandLabel}>{t('journal.day_card_band_time')}</Text>
            <View style={styles.bandStack}>
              <BandChip label={t('journal.band_peak')} pct={rollup.pctTimePeak} color="#B4FF50" />
              <BandChip label={t('journal.band_balanced')} pct={rollup.pctTimeBalanced} color="#00E5C8" />
              <BandChip label={t('journal.band_recovering')} pct={rollup.pctTimeRecovering} color="#FFA01E" />
              <BandChip label={t('journal.band_depleted')} pct={rollup.pctTimeDepleted} color="#FF2D55" />
            </View>
          </View>
          {(rollup.autopilotSessions > 0 || rollup.socialSessions > 0) && (
            <View style={styles.sessionsRow}>
              {rollup.autopilotSessions > 0 && (
                <Text style={styles.sessionPill}>
                  Autopilot × {rollup.autopilotSessions}
                </Text>
              )}
              {rollup.socialSessions > 0 && (
                <Text style={styles.sessionPill}>
                  Social × {rollup.socialSessions}
                </Text>
              )}
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function BandChip({ label, pct, color }: { label: string; pct: number; color: string }) {
  if (pct <= 0) return null;
  return (
    <View style={[styles.bandChip, { borderColor: color }]}>
      <Text style={[styles.bandChipText, { color }]}>
        {label} {pct}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  date: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  meta: {
    color: '#5C6275',
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.4,
  },
  scoreCol: {
    alignItems: 'flex-end',
    marginRight: 4,
  },
  scoreVal: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
  },
  scoreLabel: {
    color: '#5C6275',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.7,
  },
  body: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowLabel: {
    color: '#9CA3AF',
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  rowValue: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  bandRow: {
    marginTop: 10,
  },
  bandLabel: {
    color: '#5C6275',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  bandStack: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  bandChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bandChipText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 0.4,
  },
  sessionsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  sessionPill: {
    color: '#B4FF50',
    backgroundColor: 'rgba(180,255,80,0.08)',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
});
