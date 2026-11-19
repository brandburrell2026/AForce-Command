/**
 * Moments calendar — the approved prototype's Calendar page.
 *
 * "Back · Moments", the month, a strip of the next fourteen days with a dot
 * under each day that has a Moment, then the Moments from the chosen day on.
 *
 * It shows the member's own AFORCE Moments from the same store as the Moments
 * tab. It does not ask for calendar permission and reads nothing from the
 * phone's calendar. Connecting a phone calendar is a separate screen
 * (`/calendar-settings`) behind `moments_calendar_enabled`, which stays off
 * until Legal and Privacy sign (DR-011); the row that opens it only appears
 * when that flag is on.
 */
import React from 'react';
import { WorldPhotoHero } from '@/components/world/WorldPhoto';
import { worldPhoto } from '@/components/world/worldPhotoSources';
import { CALENDAR_SCENE } from '@/utils/worldPhoto';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { AFScreen } from '@/components/ui';
import { useMomentsData } from '@/components/moments/useMomentsData';
import { useFeatureFlags } from '@/store/useAppStore';
import { af, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { calendarDayKey, calendarMonth, calendarRows, calendarStrip } from './momentsCalendarLogic';

const MONO = 'IBMPlexMono_400Regular';
const GUTTER = 20;

export function MomentsCalendarScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const flags = useFeatureFlags();
  const data = useMomentsData();
  const now = React.useMemo(() => new Date(data.nowIso), [data.nowIso]);
  const todayKey = calendarDayKey(now);
  const [picked, setPicked] = React.useState<string | null>(null);
  const moments = data.hydrated ? data.surfaced : [];
  const strip = React.useMemo(() => calendarStrip(moments, now), [moments, now]);
  // A day chosen yesterday may have left the strip; fall back to today.
  const selected = picked && strip.some((d) => d.key === picked) ? picked : todayKey;
  const rows = React.useMemo(
    () => calendarRows(moments, selected, t('moments.private_event')),
    [moments, selected, t],
  );

  if (!flags.moments_enabled) return <Redirect href="/" />;
  return (
    <AFScreen scroll padded={false} contentContainerStyle={styles.content} testID="moments-calendar-screen">
      <WorldPhotoHero source={worldPhoto(CALENDAR_SCENE)} bleed={GUTTER} height={300} dim testID="moments-calendar-photo" />
      <View style={styles.topRow}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/moments' as never))}
          accessibilityRole="button"
          accessibilityLabel="Back to Moments"
          hitSlop={8}
          style={styles.back}
          testID="moments-calendar-back"
        >
          <Icon name="chevron-left" size={18} color={af.textPrimary} />
          <Text style={styles.backText}>Moments</Text>
        </Pressable>
        <Text style={styles.eyebrow}>CALENDAR</Text>
      </View>

      <Text accessibilityRole="header" style={styles.month} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
        {calendarMonth(selected)}
      </Text>
      <Text style={styles.note}>Your AFORCE Moments · not your calendar app</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.strip}
        contentContainerStyle={styles.stripContent}
      >
        {strip.map((d) => {
          const on = d.key === selected;
          return (
            <Pressable
              key={d.key}
              onPress={() => setPicked(d.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={d.label}
              style={[styles.day, on && styles.dayOn]}
              testID={`moments-calendar-day-${d.key}`}
            >
              <Text style={[styles.dayWeek, on && styles.dayWeekOn]}>{d.weekday}</Text>
              <Text style={[styles.dayNum, on && styles.dayNumOn]}>{d.dayOfMonth}</Text>
              <View style={[styles.dot, on && styles.dotOn, !d.hasMoment && styles.dotHidden]} />
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.rows}>
        {rows.length === 0 ? (
          <View style={styles.empty} testID="moments-calendar-empty">
            <Text style={styles.emptyTitle}>Nothing from this day on</Text>
            <Text style={styles.emptyBody}>Plan a Moment with One Breath and it appears here.</Text>
          </View>
        ) : (
          rows.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => router.push(`/moment/${r.id}` as never)}
              accessibilityRole="button"
              accessibilityLabel={`${r.title}. ${r.eyebrow}. ${r.sub}`}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              testID={`moments-calendar-row-${r.id}`}
            >
              <Text style={styles.rowEyebrow}>{r.eyebrow.toUpperCase()}</Text>
              <Text style={styles.rowTitle} numberOfLines={1}>{r.title}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>{r.sub}</Text>
            </Pressable>
          ))
        )}
      </View>

      {flags.moments_calendar_enabled ? (
        <Pressable
          onPress={() => router.push('/calendar-settings')}
          accessibilityRole="button"
          accessibilityLabel="Spot Moments on my calendar. Read-only. Offers to plan, never creates anything."
          style={({ pressed }) => [styles.connect, pressed && styles.rowPressed]}
          testID="moments-calendar-connect"
        >
          <View style={styles.connectText}>
            <Text style={styles.connectTitle}>Spot Moments on my calendar</Text>
            <Text style={styles.rowSub}>Read-only · offers to plan, never creates anything</Text>
          </View>
          <Icon name="chevron-right" size={18} color={af.textTertiary} />
        </Pressable>
      ) : null}
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingBottom: 40 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, marginBottom: 22 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  backText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: af.textPrimary },
  eyebrow: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: af.textSecondary },
  month: { fontFamily: 'Inter_600SemiBold', fontSize: 36, lineHeight: 38, letterSpacing: -1, color: af.textPrimary, marginBottom: 4 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.textSecondary, marginBottom: 14 },
  strip: { marginHorizontal: -GUTTER },
  stripContent: { paddingHorizontal: GUTTER, gap: 6 },
  day: {
    width: 46,
    minHeight: 44,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: af.border,
  },
  dayOn: { backgroundColor: af.primaryFill, borderColor: af.primaryFill },
  dayWeek: { fontFamily: 'Inter_400Regular', fontSize: 11, color: af.textSecondary },
  dayWeekOn: { color: af.onPrimaryFill, opacity: 0.7 },
  dayNum: { fontFamily: 'Inter_500Medium', fontSize: 17, color: af.textPrimary },
  dayNumOn: { color: af.onPrimaryFill },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: af.primaryFill },
  dotOn: { backgroundColor: af.onPrimaryFill },
  dotHidden: { opacity: 0 },
  rows: { gap: 10, marginTop: 16 },
  row: {
    minHeight: 96,
    borderRadius: 18,
    backgroundColor: af.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'flex-end',
    gap: 2,
  },
  rowPressed: { backgroundColor: af.surfacePressed },
  rowEyebrow: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: af.textSecondary },
  rowTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 17, color: af.textPrimary },
  rowSub: { fontFamily: 'Inter_400Regular', fontSize: 12.5, lineHeight: 17, color: af.textSecondary },
  empty: { borderRadius: 18, backgroundColor: af.surface, padding: 16, gap: 4 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: af.textPrimary },
  emptyBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: af.textSecondary },
  connect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: af.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  connectText: { flex: 1, gap: 2 },
  connectTitle: { fontFamily: 'Inter_400Regular', fontSize: 15, color: af.textPrimary },
});
