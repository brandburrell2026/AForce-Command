/**
 * WEEKLY PERFORMANCE REPORT™ — the once-a-week, screenshot-and-share surface.
 *
 * A NON-TAB route (Nav lock: no new tab). It is reachable two ways:
 *   • the Modules internal-evaluation launcher (always listed — "Build once.
 *     Evaluate everything. Release later."), and
 *   • a flag-gated Profile row (public surface, behind `spec_weekly_report`).
 * The screen itself is a pure read-only projection of signals the engine and
 * analytics layer already produce, folded through the deterministic
 * `utils/weeklyReport` helper. It NEVER fabricates a trend: any section
 * without a real basis renders an explicit "collecting" (history is still
 * accruing) or "awaiting" (no instrumentation yet) state (Score-Protection).
 *
 * All copy is localized (en/es/fr/de/pt/it + hidden resource-only locales)
 * via the `reports.*` i18n block; the "Next week focus" line is Water-First.
 */

import React from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { GradientBackground } from '@/components/GradientBackground';
import { AdaptiveScreenWrapper } from '@/components/AdaptiveScreenWrapper';
import { Colors } from '@/theme/colors';
import { TAB_BAR_HEIGHT, WEB_TOP_PADDING, WEB_BOTTOM_PADDING } from '@/constants/layout';
import {
  buildWeeklyReport,
  lastCompletedWeek,
  type WeeklyReport,
  type WeeklyReportSection,
  type WeeklyReportSectionKey,
  type WeeklyReportStatus,
} from '@/utils/weeklyReport';
import type { AnalyticsEvent } from '@/utils/analytics/metrics';
import { getAnalyticsSnapshot } from '@/services/analytics';
import { useAppStore } from '@/store/useAppStore';
import { ReadinessInsightsV2 } from '@/components/insights/ReadinessInsightsV2';
import { WeeklyReportV3 } from '@/components/insights/WeeklyReportV3';
import { usePerformanceAge } from '@/hooks/usePerformanceAge';
import { openShareSheet } from '@/services/shareService';
import { sectionSummary } from '@/components/insights/weeklyReportCopy';
import { buildWeeklyHealthAggregates } from '@/services/health/weeklyHealthAggregates';

type IconName = React.ComponentProps<typeof Icon>['name'];

const SECTION_ICON: Record<WeeklyReportSectionKey, IconName> = {
  improved: 'trending-up',
  attention: 'alert-circle',
  performanceAge: 'activity',
  habitVelocity: 'zap',
  recovery: 'refresh-cw',
  topCommand: 'star',
  nextWeekFocus: 'droplet',
};

const STATUS_COLOR: Record<WeeklyReportStatus, string> = {
  improved: '#1FA35A',
  attention: '#FFA01E',
  steady: 'rgba(255,255,255,0.55)',
  collecting: '#1E5BFF',
  awaiting: 'rgba(255,255,255,0.35)',
};

/** Order the report is rendered top-to-bottom (the 7 spec sections). */
const SECTION_ORDER: WeeklyReportSectionKey[] = [
  'improved',
  'attention',
  'performanceAge',
  'habitVelocity',
  'recovery',
  'topCommand',
  'nextWeekFocus',
];

/**
 * Weekly Report route — three-way switch, newest first: the V3 Week in Review
 * (`weekly_v3_dashboard_enabled`, founder comps 2026-08-11), else the Phase 2
 * "Readiness insights" redesign (`spec_weekly_report`), else the legacy report
 * below (unchanged). Flipping a flag is the go-live switch.
 */
export default function WeeklyReportScreen() {
  const flags = useAppStore().state.featureFlags;
  if (flags.weekly_v3_dashboard_enabled) return <WeeklyReportV3 />;
  return flags.spec_weekly_report ? <ReadinessInsightsV2 /> : <WeeklyReportLegacy />;
}

function WeeklyReportLegacy() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isWeb = Platform.OS === 'web';
  const { state } = useAppStore();
  const healthCanonicalConsumers = state.featureFlags.health_canonical_consumers;
  const biometrics = state.userState.biometrics;

  const topPad = isWeb ? WEB_TOP_PADDING : insets.top + 16;
  const bottomPad = isWeb ? WEB_BOTTOM_PADDING : insets.bottom + TAB_BAR_HEIGHT + 24;

  // Deterministic "now" anchor captured once when the screen mounts so the
  // report (and its week boundaries) stay stable while the screen is open.
  const nowISO = React.useRef(new Date().toISOString()).current;
  const week = React.useMemo(() => lastCompletedWeek(nowISO), [nowISO]);

  // Analytics event log loads asynchronously; until it lands we render an
  // honest empty projection (every signal "collecting"/"awaiting").
  //
  // RC-1 fix (P0 live bug): this fetch had no `.catch()` (a rejected promise
  // was silently swallowed) and no loading flag, so a slow/failed fetch was
  // indistinguishable from the *designed* empty state (genuinely zero
  // events). `eventsLoading` gates a real loading indicator below, distinct
  // from the honest "collecting"/"awaiting" per-section states that render
  // once the fetch has settled.
  const [events, setEvents] = React.useState<AnalyticsEvent[]>([]);
  const [eventsLoading, setEventsLoading] = React.useState(true);
  React.useEffect(() => {
    let cancelled = false;
    setEventsLoading(true);
    getAnalyticsSnapshot()
      .then((snap) => {
        if (!cancelled && snap) setEvents(snap.events);
      })
      .catch(() => {
        // Best-effort — leave `events` at its honest empty default so
        // every section renders "collecting"/"awaiting" (Score-Protection)
        // rather than crashing the report.
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Current Performance Age is a live engine output — read-only reference.
  const pa = usePerformanceAge();

  const report: WeeklyReport = React.useMemo(() => {
    // W3.4 — canonical health aggregates, gated behind
    // `health_canonical_consumers` (default OFF): when OFF this branch never
    // runs, so `health` stays `undefined` and `buildWeeklyReport`'s output is
    // byte-identical to before this flag existed.
    //
    // HONEST LIMITATION: no per-day health HISTORY is persisted anywhere in
    // the store yet (see services/health/healthSignalsFromStore.ts's own
    // doc) — only TODAY's biometrics snapshot is real. Wiring it in as the
    // single most-recent day of a 7-day window is deliberate: 6 of 7 days
    // are honestly absent, so every metric correctly reports
    // `insufficient_data` (1-of-7 coverage < the default 3-of-7 threshold)
    // rather than a fabricated week. This becomes a real weekly rollup the
    // moment daily history is persisted (tracked follow-up, not this PR).
    const nowMs = Date.parse(nowISO);
    const health = healthCanonicalConsumers
      ? buildWeeklyHealthAggregates({
          dailySignals: [
            {
              dayIndex: 6,
              input: {
                biometrics,
                records: undefined,
                activeDirectProviders: new Set(),
                connections: undefined,
                nowMs,
              },
            },
          ],
          days: 7,
          timezoneOffsetMin: -new Date(nowISO).getTimezoneOffset(),
          nowMs,
        })
      : undefined;

    return buildWeeklyReport({
      nowISO,
      weekStartISO: week.weekStartISO,
      weekEndISO: week.weekEndISO,
      priorWeekStartISO: week.priorWeekStartISO,
      priorWeekEndISO: week.priorWeekEndISO,
      analyticsEvents: events,
      current: { performanceAge: pa.result },
      health,
    });
  }, [nowISO, week, events, pa.result, healthCanonicalConsumers, biometrics]);

  const fmtDay = React.useCallback(
    (iso: string) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      try {
        return d.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' });
      } catch {
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }
    },
    [i18n.language],
  );

  const weekRange = t('reports.weekRange', {
    start: fmtDay(report.weekStartISO),
    end: fmtDay(report.weekEndISO),
  });
  const generated = t('reports.generated', { date: fmtDay(report.generatedAtISO) });

  const sections = SECTION_ORDER.map((key) =>
    report.sections.find((s) => s.key === key),
  ).filter((s): s is WeeklyReportSection => Boolean(s));

  const onShare = React.useCallback(() => {
    const lines: string[] = [t('reports.shareTitle'), weekRange, ''];
    for (const s of sections) {
      const title = t(`reports.sections.${s.key}.title`);
      const summary = sectionSummary(t, s);
      lines.push(summary ? `${title}: ${summary}` : title);
    }
    void openShareSheet({ format: 'recap', message: lines.join('\n') });
  }, [t, weekRange, sections]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <GradientBackground>
        <AdaptiveScreenWrapper>
          <View style={[styles.container, { paddingTop: topPad }]}>
            <View style={styles.header}>
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
                style={styles.backBtn}
              >
                <Icon name="chevron-left" size={22} color="#FFFFFF" />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>{t('reports.eyebrow')}</Text>
                <Text style={styles.title}>{t('reports.title')}</Text>
              </View>
              <Pressable
                onPress={onShare}
                hitSlop={12}
                testID="weekly-report-share"
                accessibilityRole="button"
                accessibilityLabel={t('reports.share_a11y')}
                style={styles.shareBtn}
              >
                <Icon name="share" size={16} color="#000000" />
                <Text style={styles.shareBtnText}>{t('reports.share')}</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{ paddingBottom: bottomPad }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.subtitle}>{t('reports.subtitle')}</Text>
              <Text style={styles.range}>{weekRange}</Text>
              <Text style={styles.generated}>{generated}</Text>

              {eventsLoading ? (
                <View style={styles.loadingWrap} testID="weekly-report-loading">
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              ) : (
                <View style={styles.grid}>
                  {sections.map((s) => (
                    <SectionCard key={s.key} section={s} />
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </AdaptiveScreenWrapper>
      </GradientBackground>
    </View>
  );
}

function SectionCard({ section }: { section: WeeklyReportSection }) {
  const { t } = useTranslation();
  const base = `reports.sections.${section.key}`;
  const accent = STATUS_COLOR[section.status];
  const isFocus = section.key === 'nextWeekFocus';

  // Headline value (big number / label) — only for real, value-bearing states.
  let valueText: string | null = null;
  if (section.key === 'habitVelocity' && section.status !== 'collecting') {
    valueText = t(`${base}.value`, section.params);
  } else if (section.key === 'topCommand' && section.status !== 'awaiting') {
    valueText = t(`${base}.value`, section.params);
  }

  const summary = sectionSummary(t, section);

  // Optional secondary reference line (current readout, never a trend).
  let reference: string | null = null;
  if (section.key === 'performanceAge' && section.params.currentPerformanceAge != null) {
    reference = t(`${base}.reference`, section.params);
  } else if (section.key === 'recovery' && section.params.current != null) {
    reference = t(`${base}.reference`, section.params);
  } else if (section.key === 'habitVelocity' && Number(section.params.streak) > 0) {
    reference = t(`${base}.streak`, section.params);
  }

  // Narrative sections render their findings as a bulleted evidence list.
  const evidence =
    (section.key === 'improved' && section.status === 'improved') ||
    (section.key === 'attention' && section.status === 'attention')
      ? (section.findings ?? []).map((f) => t(`reports.findings.${f.code}`, f.params))
      : [];

  return (
    <View style={[styles.card, isFocus && styles.focusCard]} testID={`weekly-report-section-${section.key}`}>
      <View style={styles.cardHead}>
        <View style={[styles.iconWrap, { borderColor: accent }]}>
          <Icon name={SECTION_ICON[section.key]} size={18} color={accent} />
        </View>
        <Text style={styles.cardTitle}>{t(`${base}.title`)}</Text>
        {!isFocus ? (
          <View style={[styles.badge, { borderColor: accent }]}>
            <Text style={[styles.badgeText, { color: accent }]}>
              {t(`reports.status.${section.status}`)}
            </Text>
          </View>
        ) : null}
      </View>

      {valueText ? <Text style={styles.value}>{valueText}</Text> : null}

      {evidence.length > 0 ? (
        <View style={styles.evidence}>
          {evidence.map((line, i) => (
            <View key={i} style={styles.evidenceRow}>
              <View style={[styles.dot, { backgroundColor: accent }]} />
              <Text style={styles.evidenceText}>{line}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.detail, isFocus && styles.focusDetail]}>{summary}</Text>
      )}

      {reference ? <Text style={styles.reference}>{reference}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0D0D' },
  container: { flex: 1, paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  eyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 2.5,
    color: 'rgba(255,255,255,0.55)',
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    color: '#FFFFFF',
    marginTop: 2,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: '#C1281B',
  },
  shareBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: '#000000',
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 4,
  },
  range: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 6,
  },
  generated: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
    marginBottom: 18,
  },
  grid: { gap: 12 },
  loadingWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  focusCard: {
    borderColor: 'rgba(30,91,255,0.35)',
    backgroundColor: 'rgba(30,91,255,0.06)',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  cardTitle: {
    flex: 1,
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  value: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    color: '#FFFFFF',
    marginTop: 12,
  },
  detail: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.70)',
    marginTop: 10,
  },
  focusDetail: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
  },
  evidence: {
    marginTop: 12,
    gap: 8,
  },
  evidenceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    marginTop: 7,
  },
  evidenceText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.70)',
  },
  reference: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.40)',
    marginTop: 8,
  },
});
