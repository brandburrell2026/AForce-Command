/**
 * JournalScreen — Hydration Journal.
 *
 * Layout:
 *   1. Header with title + Export PDF button
 *   2. Range picker (7 / 30 / 90 days)
 *   3. Chart of score over time (with band color zones)
 *   4. Daily timeline — collapsible day cards backed by /journal/rollups
 *
 * Snapshots are written by the store's debounced writer effect — this
 * screen is read-only.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import JournalRangePicker, { type JournalRange } from '@/components/journal/JournalRangePicker';
import JournalChart from '@/components/journal/JournalChart';
import JournalDayCard from '@/components/journal/JournalDayCard';
import { fetchJournalRollups, fetchJournalTimeline } from '@/services/realApi';
import {
  deriveJournalShareContext,
  toShareRouteParams,
} from '@/services/journalShareContext';
import type { JournalRollup, JournalSnapshot, JournalTimelineEntry } from '@/types';
import { Colors } from '@/theme/colors';

export default function JournalScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [range, setRange] = useState<JournalRange>(7);
  const [timeline, setTimeline] = useState<JournalTimelineEntry[]>([]);
  const [rollups, setRollups] = useState<JournalRollup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);

  const load = useCallback(async (r: JournalRange) => {
    setLoading(true);
    setError(null);
    try {
      const [tl, rl] = await Promise.all([
        fetchJournalTimeline(r),
        fetchJournalRollups(r),
      ]);
      setTimeline(tl);
      setRollups(rl);
    } catch (err) {
      console.warn('[Journal] load failed', err);
      setError(t('journal.load_failed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load(range);
  }, [range, load]);

  const snapshots = useMemo<JournalSnapshot[]>(
    () => timeline.filter((e): e is JournalSnapshot => e.type === 'snapshot'),
    [timeline],
  );

  // Reverse for the daily list (most recent at the top).
  const reversedRollups = useMemo(() => [...rollups].reverse(), [rollups]);

  const chartWidth = Math.min(Dimensions.get('window').width - 32, 720);

  const onShareJournal = useCallback(() => {
    // Hand the journal context off to the existing /share screen so the
    // user gets the full voice / format / platform picker. The route
    // accepts query params via Expo Router; the share screen's
    // `parseContext` validates them.
    const ctx = deriveJournalShareContext(rollups, range);
    router.push({ pathname: '/share', params: toShareRouteParams(ctx) });
  }, [rollups, range, router]);

  const onExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    setExportNote(null);
    try {
      const html = buildReportHtml(range, snapshots, rollups);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: t('journal.export_pdf'),
          UTI: 'com.adobe.pdf',
        });
        setExportNote(t('journal.shared'));
      } else {
        setExportNote(uri);
      }
    } catch (err) {
      console.warn('[Journal] export failed', err);
      setExportNote(t('journal.share_failed'));
    } finally {
      setExporting(false);
    }
  }, [exporting, range, snapshots, rollups, t]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>HYDRATION JOURNAL</Text>
            <Text style={styles.title}>{t('journal.title')}</Text>
            <Text style={styles.subtitle}>{t('journal.subtitle')}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={onShareJournal}
              accessibilityRole="button"
              accessibilityLabel={t('journal.share_social')}
              testID="journal-share-social"
              style={styles.shareBtn}
            >
              <Feather name="share-2" size={14} color="#FFFFFF" />
              <Text style={styles.shareBtnText}>{t('journal.share_social')}</Text>
            </Pressable>
            <Pressable
              onPress={onExport}
              accessibilityRole="button"
              accessibilityLabel={t('journal.export_pdf')}
              disabled={exporting}
              style={[styles.exportBtn, exporting && styles.exportBtnDisabled]}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#0A0A1E" />
              ) : (
                <Feather name="share" size={14} color="#0A0A1E" />
              )}
              <Text style={styles.exportBtnText}>
                {exporting ? t('journal.exporting') : t('journal.export_pdf')}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.rangeRow}>
          <JournalRangePicker value={range} onChange={setRange} />
        </View>

        {exportNote && (
          <Text style={styles.exportNote}>{exportNote}</Text>
        )}

        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>{t('journal.chart_title')}</Text>
          {loading ? (
            <View style={[styles.chartPlaceholder, { width: chartWidth }]}>
              <ActivityIndicator color="#B4FF50" />
            </View>
          ) : (
            <JournalChart data={snapshots} width={chartWidth} height={220} />
          )}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={{ marginTop: 16 }}>
          {loading && rollups.length === 0 ? null : reversedRollups.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t('journal.empty_title')}</Text>
              <Text style={styles.emptyBody}>{t('journal.empty_body')}</Text>
            </View>
          ) : (
            reversedRollups.map((r) => <JournalDayCard key={r.date} rollup={r} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── PDF report builder ────────────────────────────────────────────────────────
function buildReportHtml(
  range: JournalRange,
  snapshots: JournalSnapshot[],
  rollups: JournalRollup[],
): string {
  const now = new Date();
  const generated = now.toLocaleString();
  const totalSnaps = snapshots.length;
  const sumScore = snapshots.reduce((acc, s) => acc + s.score, 0);
  const avgScore = totalSnaps > 0 ? Math.round(sumScore / totalSnaps) : 0;
  const minScore = totalSnaps > 0 ? Math.min(...snapshots.map((s) => s.score)) : 0;
  const maxScore = totalSnaps > 0 ? Math.max(...snapshots.map((s) => s.score)) : 0;
  const totalIntakes = rollups.reduce((acc, r) => acc + r.intakeCount, 0);
  const totalAforce = rollups.length > 0 ? rollups[rollups.length - 1].endAforceUnits : 0;

  const dailyRows = [...rollups].reverse().map((r) => `
    <tr>
      <td>${escapeHtml(r.date)}</td>
      <td style="text-align:right">${r.avgScore}</td>
      <td style="text-align:right">${r.minScore}</td>
      <td style="text-align:right">${r.maxScore}</td>
      <td style="text-align:right">${r.endOzConsumed.toFixed(0)}</td>
      <td style="text-align:right">${r.endAforceUnits}</td>
      <td style="text-align:right">${r.intakeCount}</td>
      <td style="text-align:right">${r.endSodiumDelivered.toFixed(0)}</td>
      <td style="text-align:right">${r.endSodiumLost.toFixed(0)}</td>
      <td style="text-align:right">${r.endDeficitPct.toFixed(1)}%</td>
    </tr>`).join('');

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>AForce Hydration Journal — ${range}d</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif; color: #111; padding: 32px; }
  h1 { margin: 0 0 4px 0; font-size: 22px; }
  h2 { margin: 28px 0 8px 0; font-size: 15px; letter-spacing: 1px; color: #444; text-transform: uppercase; }
  .meta { color: #666; font-size: 12px; margin-bottom: 18px; }
  .stats { display: flex; gap: 16px; margin: 14px 0; }
  .stat { border: 1px solid #e5e5e5; border-radius: 8px; padding: 10px 14px; min-width: 86px; }
  .stat .k { font-size: 10px; color: #777; letter-spacing: 1px; }
  .stat .v { font-size: 20px; font-weight: 700; color: #111; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border-bottom: 1px solid #eee; padding: 6px 8px; text-align: left; }
  th { background: #f7f7f7; font-size: 10px; letter-spacing: 0.5px; text-transform: uppercase; color: #555; }
  .footer { color: #999; font-size: 10px; margin-top: 22px; }
</style>
</head>
<body>
  <h1>AForce Hydration Journal</h1>
  <div class="meta">${range}-day window · Generated ${escapeHtml(generated)}</div>

  <h2>Summary</h2>
  <div class="stats">
    <div class="stat"><div class="k">AVG SCORE</div><div class="v">${avgScore}</div></div>
    <div class="stat"><div class="k">MIN</div><div class="v">${minScore}</div></div>
    <div class="stat"><div class="k">MAX</div><div class="v">${maxScore}</div></div>
    <div class="stat"><div class="k">SNAPSHOTS</div><div class="v">${totalSnaps}</div></div>
    <div class="stat"><div class="k">INTAKES</div><div class="v">${totalIntakes}</div></div>
    <div class="stat"><div class="k">AFORCE UNITS</div><div class="v">${totalAforce}</div></div>
  </div>

  <h2>Daily Rollups</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th style="text-align:right">Avg</th>
        <th style="text-align:right">Min</th>
        <th style="text-align:right">Max</th>
        <th style="text-align:right">Ounces</th>
        <th style="text-align:right">AForce</th>
        <th style="text-align:right">Intakes</th>
        <th style="text-align:right">Na in (mg)</th>
        <th style="text-align:right">Na lost (mg)</th>
        <th style="text-align:right">Deficit</th>
      </tr>
    </thead>
    <tbody>${dailyRows || '<tr><td colspan="10" style="text-align:center;color:#999;padding:20px">No rollup data in this window.</td></tr>'}</tbody>
  </table>

  <div class="footer">AForce OS · Hydration Journal · This report is for personal use; not medical advice.</div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#050510',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  eyebrow: {
    color: '#B4FF50',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  title: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
  },
  subtitle: {
    color: '#9CA3AF',
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    gap: 6,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#B4FF50',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    gap: 6,
  },
  exportBtnDisabled: {
    opacity: 0.5,
  },
  exportBtnText: {
    color: '#0A0A1E',
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  rangeRow: {
    marginBottom: 14,
  },
  exportNote: {
    color: '#00E5C8',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  chartCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  chartTitle: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  chartPlaceholder: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#FF2D55',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    marginBottom: 6,
  },
  emptyBody: {
    color: '#9CA3AF',
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
