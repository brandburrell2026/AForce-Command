/**
 * MomentPrepPrefsCard — Moments notification preferences (Phase 3a, DR-010):
 * mode (important-only / all) and lead time (prep-window default or a fixed
 * preset). "Adaptive" is deliberately absent until PR-002 5.6 is approved —
 * the locked hint says so honestly. Prefs persist via momentNotifications'
 * own storage; the scheduling hook resyncs on the next store change.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AFSegmentedControl } from '@/components/ui';
import { af, afType } from '@/theme';
import {
  getMomentNotifyPrefs,
  setMomentNotifyPrefs,
  DEFAULT_MOMENT_NOTIFY_PREFS,
  type MomentNotifyPrefs,
} from '@/services/momentNotifications';
import { MOMENT_NOTIFY_LEAD_PRESETS_MIN } from '@/config/hydroStateModel';
import { useFeatureFlags } from '@/store/useAppStore';

export function MomentPrepPrefsCard() {
  const { t } = useTranslation();
  const [prefs, setPrefs] = React.useState<MomentNotifyPrefs>(DEFAULT_MOMENT_NOTIFY_PREFS);
  const learningOn = useFeatureFlags().moments_learning_enabled;

  React.useEffect(() => {
    let cancelled = false;
    void getMomentNotifyPrefs().then((p) => {
      if (!cancelled) setPrefs(p);
    });
    return () => { cancelled = true; };
  }, []);

  const update = (next: MomentNotifyPrefs) => {
    setPrefs(next);
    void setMomentNotifyPrefs(next);
  };

  return (
    <View style={styles.card} testID="moment-prep-prefs">
      <Text style={styles.label}>{t('moments.notify.prefs_label')}</Text>
      <AFSegmentedControl
        segments={[
          { key: 'important', label: t('moments.notify.mode_important') },
          { key: 'all', label: t('moments.notify.mode_all') },
        ]}
        value={prefs.mode}
        onChange={(key) => update({ ...prefs, mode: key as MomentNotifyPrefs['mode'] })}
        testID="moment-prep-mode"
      />
      <Text style={styles.label}>{t('moments.notify.lead_label')}</Text>
      <View style={styles.leadRow}>
        <LeadPill
          label={t('moments.notify.lead_window')}
          on={prefs.leadMin == null && prefs.adaptive !== true}
          onPress={() => update({ ...prefs, leadMin: null, adaptive: false })}
        />
        {MOMENT_NOTIFY_LEAD_PRESETS_MIN.map((n) => (
          <LeadPill
            key={n}
            label={t('moments.notify.lead_min', { n })}
            on={prefs.leadMin === n && prefs.adaptive !== true}
            onPress={() => update({ ...prefs, leadMin: n, adaptive: false })}
          />
        ))}
        {learningOn ? (
          <LeadPill
            label={t('moments.notify.lead_adaptive')}
            on={prefs.adaptive === true}
            onPress={() => update({ ...prefs, adaptive: true })}
          />
        ) : null}
      </View>
      {learningOn ? (
        prefs.adaptive === true ? (
          <Text style={styles.lockedHint}>{t('moments.notify.lead_adaptive_on')}</Text>
        ) : null
      ) : (
        <Text style={styles.lockedHint}>{t('moments.notify.lead_adaptive_locked')}</Text>
      )}
    </View>
  );
}

function LeadPill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, on && styles.pillOn]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
    >
      <Text style={[styles.pillText, on && styles.pillTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14, gap: 10, borderRadius: 14,
    borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  label: { ...afType.eyebrow, color: af.textTertiary, fontSize: 10 },
  leadRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: af.border, backgroundColor: af.surfaceRaised,
  },
  pillOn: { backgroundColor: af.red, borderColor: af.red },
  pillText: { ...afType.caption, color: af.textSecondary },
  pillTextOn: { color: af.onRed },
  lockedHint: { ...afType.caption, color: af.textTertiary },
});
