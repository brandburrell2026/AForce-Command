/**
 * Collapsible per-day summary card. Tap to expand details:
 * intake count, total oz, sodium in/out, deficit %, time per band,
 * AForce units, sessions.
 */

import React, { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Icon } from '../Icon';
import { useTranslation } from 'react-i18next';
import type { JournalRollup } from '@/types';
import { Colors } from '@/theme/colors';

interface Props {
  rollup: JournalRollup;
}

/**
 * Surface the dominant band as a one-sentence "lesson" so each day card
 * teaches the user something instead of just summarising metrics. Mirrors
 * the spec's request for an at-a-glance takeaway on every day.
 */
function getTodaysLesson(rollup: JournalRollup): string {
  const bands: { name: string; pct: number; lesson: string }[] = [
    {
      name: 'PEAK',
      pct: rollup.pctTimePeak,
      lesson: 'Most of your day was spent at PEAK — keep this rhythm and you\'ll bank a streak.',
    },
    {
      name: 'BALANCED',
      pct: rollup.pctTimeBalanced,
      lesson: 'You held BALANCED for the bulk of the day. One earlier AForce stick will push you into PEAK.',
    },
    {
      name: 'RECOVERING',
      pct: rollup.pctTimeRecovering,
      lesson: 'Most of your day was RECOVERING — front-load tomorrow with sodium + 24 oz before noon.',
    },
    {
      name: 'DEPLETED',
      pct: rollup.pctTimeDepleted,
      lesson: 'You spent serious time DEPLETED. Tomorrow: stick + 24 oz before your first task.',
    },
  ];
  const dominant = bands.reduce((best, b) => (b.pct > best.pct ? b : best), bands[0]!);
  if (dominant.pct < 25) {
    return 'Mixed day across bands — set a target band tomorrow and check in mid-morning.';
  }
  return dominant.lesson;
}

function avgColor(score: number): string {
  if (score >= 85) return '#1FA35A';
  if (score >= 65) return '#00E5C8';
  if (score >= 40) return '#FFA01E';
  return '#FF2800';
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

  // Hide rule (spec §6/7): a day with zero snapshots AND zero intakes
  // adds noise — collapse it entirely so the journal only renders days
  // where something actually happened.
  if (rollup.snapshotsCount === 0 && rollup.intakeCount === 0) {
    return null;
  }

  const lesson = getTodaysLesson(rollup);

  // Light tactile tick on expand/collapse — matches the WHOOP-style
  // selection feedback used elsewhere in the app (tab switch, range
  // picker). Web is a no-op; native ignores errors silently so a
  // missing haptics engine never breaks the press.
  const handleToggle = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    setOpen((o) => !o);
  }, []);

  return (
    <Pressable
      onPress={handleToggle}
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
        <Icon
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
          <View style={styles.lessonRow}>
            <Icon name="zap" size={11} color="#C1281B" />
            <Text style={styles.lessonText}>{lesson}</Text>
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
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(180,255,80,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(180,255,80,0.18)',
  },
  lessonText: {
    flex: 1,
    color: '#D8FFB1',
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 17,
  },
  sessionsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  sessionPill: {
    color: '#C1281B',
    backgroundColor: 'rgba(193,40,27,0.08)',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
});
