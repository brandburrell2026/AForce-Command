/**
 * ConnectCalendarScreen — CONNECT CALENDAR (Phase 3b, DR-011). The founder
 * spec's Screen 5, honest to how iOS actually works: one read-only device
 * permission surfaces every account's calendars (iCloud / Google / Exchange),
 * grouped by source, each individually selectable. Categories filter what
 * classifies. Denied/revoked states are first-class postures with a path to
 * OS Settings; disconnect forgets prefs (no event data exists to delete —
 * the bridge is in-memory only).
 */
import React from 'react';
import { View, Text, StyleSheet, Switch, Linking, AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { AFScreen, AFTopBar, AFCard, AFSectionLabel, AFPrimaryButton, AFTextButton } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { af, afType, Spacing } from '@/theme';
import {
  getCalendarPermission,
  requestCalendarPermission,
  listDeviceCalendars,
  getCalendarPrefs,
  setCalendarPrefs,
  disconnectCalendar,
  DEFAULT_CALENDAR_PREFS,
  type CalendarPermission,
  type CalendarPrefs,
  type DeviceCalendarInfo,
} from '@/services/calendarBridge';
import { refreshCalendarMoments } from '@/services/calendarMoments';
import type { MomentCategoryToggle } from '@/services/momentClassification';

const CATEGORY_ROWS: { key: MomentCategoryToggle; labelKey: string; hintKey: string }[] = [
  { key: 'work', labelKey: 'moments.calendar.cat_work', hintKey: 'moments.calendar.cat_work_hint' },
  { key: 'training', labelKey: 'moments.calendar.cat_training', hintKey: 'moments.calendar.cat_training_hint' },
  { key: 'travel', labelKey: 'moments.calendar.cat_travel', hintKey: 'moments.calendar.cat_travel_hint' },
];

export function ConnectCalendarScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [permission, setPermission] = React.useState<CalendarPermission>('undetermined');
  const [prefs, setPrefs] = React.useState<CalendarPrefs>(DEFAULT_CALENDAR_PREFS);
  const [calendars, setCalendars] = React.useState<DeviceCalendarInfo[]>([]);

  const reload = React.useCallback(async () => {
    const [perm, p] = await Promise.all([getCalendarPermission(), getCalendarPrefs()]);
    setPermission(perm);
    setPrefs(p);
    if (perm === 'granted' && p.connected) {
      setCalendars(await listDeviceCalendars());
    } else {
      setCalendars([]);
    }
  }, []);

  React.useEffect(() => {
    void reload();
    // Re-check after the member returns from OS Settings (revoke/grant).
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void reload();
    });
    return () => sub.remove();
  }, [reload]);

  const connect = async () => {
    const perm = await requestCalendarPermission();
    setPermission(perm);
    if (perm !== 'granted') return;
    const device = await listDeviceCalendars();
    setCalendars(device);
    // Least-privilege default: everything OFF until the member selects.
    const next: CalendarPrefs = { ...prefs, connected: true };
    setPrefs(next);
    await setCalendarPrefs(next);
  };

  const update = async (next: CalendarPrefs) => {
    setPrefs(next);
    await setCalendarPrefs(next);
    void refreshCalendarMoments(true);
  };

  const disconnect = async () => {
    await disconnectCalendar();
    setPrefs(DEFAULT_CALENDAR_PREFS);
    setCalendars([]);
    void refreshCalendarMoments(true);
  };

  const bySource = React.useMemo(() => {
    const groups = new Map<string, DeviceCalendarInfo[]>();
    for (const c of calendars) {
      const list = groups.get(c.sourceName) ?? [];
      list.push(c);
      groups.set(c.sourceName, list);
    }
    return [...groups.entries()];
  }, [calendars]);

  return (
    <AFScreen scroll contentContainerStyle={styles.scrollContent}>
      <AFTopBar
        eyebrow={t('moments.overview_eyebrow')}
        title={t('moments.calendar.title')}
        onBack={() => router.back()}
      />
      <Text style={styles.subtitle}>{t('moments.calendar.subtitle')}</Text>

      {permission === 'unavailable' ? (
        <AFCard style={styles.postureCard} testID="calendar-unavailable">
          <Text style={styles.postureText}>{t('moments.calendar.unavailable')}</Text>
        </AFCard>
      ) : permission === 'denied' ? (
        <AFCard style={styles.postureCard} testID="calendar-denied">
          <Text style={styles.postureText}>{t('moments.calendar.denied')}</Text>
          <AFTextButton
            label={t('moments.calendar.manage_access')}
            onPress={() => void Linking.openSettings()}
            testID="calendar-open-settings"
          />
        </AFCard>
      ) : !prefs.connected || permission !== 'granted' ? (
        <AFCard variant="raised" style={styles.connectCard} testID="calendar-connect">
          <View style={styles.connectRow}>
            <View style={styles.connectIcon}>
              <Icon name="calendar" size={18} color={af.green} />
            </View>
            <View style={styles.connectBody}>
              <Text style={styles.connectTitle}>{t('moments.calendar.device_calendars')}</Text>
              <Text style={styles.connectHint}>{t('moments.calendar.device_hint')}</Text>
            </View>
          </View>
          <AFPrimaryButton label={t('moments.calendar.connect')} onPress={() => void connect()} testID="calendar-connect-button" />
        </AFCard>
      ) : (
        <>
          <View style={styles.connectedRow} testID="calendar-connected">
            <View style={styles.connectedDot} />
            <Text style={styles.connectedText}>{t('moments.calendar.connected')}</Text>
          </View>

          <View style={styles.section}>
            <AFSectionLabel label={t('moments.calendar.calendars_label')} />
            {bySource.map(([source, items]) => (
              <View key={source} style={styles.sourceGroup}>
                <Text style={styles.sourceName}>{source}</Text>
                <View style={styles.card}>
                  {items.map((c, i) => (
                    <View key={c.id}>
                      {i > 0 && <View style={styles.divider} />}
                      <View style={styles.row}>
                        <View style={[styles.calDot, { backgroundColor: c.color ?? af.textTertiary }]} />
                        <Text style={styles.rowLabel} numberOfLines={1}>{c.title}</Text>
                        <Switch
                          value={prefs.selectedCalendarIds.includes(c.id)}
                          onValueChange={(v) =>
                            void update({
                              ...prefs,
                              selectedCalendarIds: v
                                ? [...prefs.selectedCalendarIds, c.id]
                                : prefs.selectedCalendarIds.filter((id) => id !== c.id),
                            })
                          }
                          trackColor={{ false: af.surface, true: af.green }}
                          thumbColor={af.textPrimary}
                          ios_backgroundColor={af.surface}
                          accessibilityLabel={c.title}
                          testID={`calendar-toggle-${c.id}`}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <AFSectionLabel label={t('moments.calendar.categories_label')} />
            <View style={styles.card}>
              {CATEGORY_ROWS.map((row, i) => (
                <View key={row.key}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowLabel}>{t(row.labelKey)}</Text>
                      <Text style={styles.rowHint}>{t(row.hintKey)}</Text>
                    </View>
                    <Switch
                      value={prefs.categories.includes(row.key)}
                      onValueChange={(v) =>
                        void update({
                          ...prefs,
                          categories: v
                            ? [...prefs.categories, row.key]
                            : prefs.categories.filter((k) => k !== row.key),
                        })
                      }
                      trackColor={{ false: af.surface, true: af.green }}
                      thumbColor={af.textPrimary}
                      ios_backgroundColor={af.surface}
                      accessibilityLabel={t(row.labelKey)}
                      testID={`category-toggle-${row.key}`}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>

          <AFTextButton
            label={t('moments.calendar.disconnect')}
            onPress={() => void disconnect()}
            testID="calendar-disconnect"
          />
        </>
      )}

      <View style={styles.privacy}>
        <Icon name="lock" size={13} color={af.textTertiary} />
        <Text style={styles.privacyText}>{t('moments.calendar.privacy_footer')}</Text>
      </View>
      {permission === 'granted' ? (
        <AFTextButton
          label={t('moments.calendar.manage_access')}
          onPress={() => void Linking.openSettings()}
        />
      ) : null}
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: Spacing[24] + Spacing[8], gap: 16 },
  subtitle: { ...afType.body, color: af.textSecondary, marginTop: 6 },
  postureCard: { gap: 10 },
  postureText: { ...afType.body, color: af.textSecondary, lineHeight: 22 },
  connectCard: { gap: 14 },
  connectRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  connectIcon: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: `${af.green}1A`,
  },
  connectBody: { flex: 1, gap: 2 },
  connectTitle: { ...afType.bodyStrong, color: af.textPrimary },
  connectHint: { ...afType.caption, color: af.textTertiary },
  connectedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  connectedDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: af.green },
  connectedText: { ...afType.caption, color: af.green },
  section: { gap: 10 },
  sourceGroup: { gap: 6, marginTop: 8 },
  sourceName: { ...afType.caption, color: af.textTertiary },
  card: { borderRadius: 14, borderWidth: 1, borderColor: af.border, backgroundColor: af.surface },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: af.divider, marginLeft: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  calDot: { width: 10, height: 10, borderRadius: 5 },
  rowLabel: { ...afType.bodyStrong, color: af.textPrimary, flex: 1 },
  rowHint: { ...afType.caption, color: af.textTertiary, marginTop: 2 },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 },
  privacyText: { ...afType.caption, color: af.textTertiary, flex: 1, lineHeight: 18 },
});
