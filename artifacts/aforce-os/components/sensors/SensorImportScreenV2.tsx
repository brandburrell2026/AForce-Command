/**
 * Sensor Import Screen — pull sweat-loss + sodium data from third-party
 * patches (hDrop, Nix, Gatorade Gx) into the AForce timeline.
 *
 * Flow:
 *   1. Pick CSV via expo-document-picker  OR  paste JSON.
 *   2. Pick a source label (hdrop / nix / gatorade_gx).
 *   3. Preview parsed rows (count + first 3) and recognised columns.
 *   4. Tap "Import N rows" → POST /api/aforce/sensors/import.
 *   5. Server creates one intake_log + one score_snapshot per row.
 */

import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';

import { GradientBackground } from '@/components/GradientBackground';
import { af } from '@/theme';
import {
  parseSensorCsv, parseSensorJson, SENSOR_SOURCE_LABELS,
  type SensorRow, type SensorSource, type SensorParseResult,
} from '@/services/sensorImportService';
import { postSensorImport } from '@/services/realApi';

const SOURCES: SensorSource[] = ['hdrop', 'nix', 'gatorade_gx'];

export function SensorImportScreenV2() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [source, setSource] = useState<SensorSource>('hdrop');
  const [pasteText, setPasteText] = useState('');
  const [pickedFileName, setPickedFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<SensorParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const topPadding = Platform.OS === 'web' ? 24 : insets.top + 8;
  const bottomPadding = Platform.OS === 'web' ? 34 : insets.bottom + 24;

  // Re-parse the paste box every time it changes (cheap; no debounce
  // needed — text fits in a CSV under a few thousand rows comfortably).
  const livePasteResult = useMemo(() => {
    const trimmed = pasteText.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return parseSensorJson(trimmed);
    }
    return parseSensorCsv(trimmed);
  }, [pasteText]);

  // Whichever source has rows wins (file takes priority when both set).
  const activeResult = parseResult ?? livePasteResult;
  const rowCount = activeResult?.rows.length ?? 0;

  const onPickFile = async () => {
    setResultMessage(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'application/json', '*/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setPickedFileName(asset.name);
      // Fetch the file contents — works on both web (blob URL) and
      // native (file:// URI).
      const text = await fetch(asset.uri).then((r) => r.text());
      const looksJson = text.trimStart().startsWith('{') || text.trimStart().startsWith('[');
      const result = looksJson ? parseSensorJson(text) : parseSensorCsv(text);
      setParseResult(result);
      setPasteText('');
    } catch (err) {
      setResultMessage(t('sensors.v2.read_error', { msg: (err as Error).message }));
    }
  };

  const onClearPick = () => {
    setParseResult(null);
    setPickedFileName(null);
  };

  const onImport = async () => {
    if (!activeResult || activeResult.rows.length === 0) return;
    setImporting(true);
    setResultMessage(null);
    try {
      const res = await postSensorImport({ source, rows: activeResult.rows });
      setResultMessage(t('sensors.v2.imported', { count: res.imported, source: SENSOR_SOURCE_LABELS[source] }));
      setParseResult(null);
      setPickedFileName(null);
      setPasteText('');
    } catch (err) {
      setResultMessage(t('sensors.v2.import_failed', { msg: (err as Error).message }));
    } finally {
      setImporting(false);
    }
  };

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: topPadding, paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.back')} testID="sensors-back">
              <Icon name="chevron-left" size={20} color={af.textPrimary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>{t('sensors.v2.eyebrow')}</Text>
              <Text style={styles.title}>{t('sensors.v2.title')}</Text>
            </View>
          </View>

          <Text style={styles.intro}>{t('sensors.v2.intro')}</Text>

          {/* Source picker */}
          <SectionHeader label={t('sensors.v2.source_label')} />
          <View style={styles.card}>
            {SOURCES.map((s, i) => (
              <Pressable
                key={s}
                onPress={() => setSource(s)}
                style={[styles.row, i < SOURCES.length - 1 && styles.rowBorder]}
                accessibilityRole="radio"
                accessibilityState={{ checked: source === s }}
                testID={`sensor-source-${s}`}
              >
                <View style={styles.rowLeft}>
                  <Icon
                    name={source === s ? 'check-circle' : 'circle'}
                    size={16}
                    color={source === s ? af.green : af.textTertiary}
                  />
                  <Text style={styles.rowLabel}>{SENSOR_SOURCE_LABELS[s]}</Text>
                </View>
                <Text style={styles.rowMuted}>{s}</Text>
              </Pressable>
            ))}
          </View>

          {/* File picker */}
          <SectionHeader label={t('sensors.v2.file_label')} hint={t('sensors.v2.file_hint')} />
          <View style={styles.card}>
            {/* RC-1 fix: the clear button was a Pressable NESTED inside the
                pick-file Pressable — nested touchables are an a11y
                anti-pattern (ambiguous VoiceOver/TalkBack focus + hit-testing,
                and the outer responder can swallow taps meant for the inner
                one). Un-nested to siblings inside a shared row View. */}
            <View style={styles.row}>
              <Pressable
                onPress={onPickFile}
                style={styles.rowLeft}
                hitSlop={{ top: 14, bottom: 14, left: 14, right: 0 }}
                accessibilityRole="button"
                accessibilityLabel={pickedFileName ?? t('sensors.v2.pick_file')}
                testID="sensor-pick-file"
              >
                <Icon name="file-plus" size={16} color={af.cyan} />
                <Text style={styles.rowLabel}>{pickedFileName ?? t('sensors.v2.pick_file')}</Text>
              </Pressable>
              {pickedFileName && (
                <Pressable onPress={onClearPick} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('sensors.v2.remove_file_a11y')} testID="sensor-clear-pick">
                  <Icon name="x" size={14} color={af.textTertiary} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Paste fallback */}
          <SectionHeader label={t('sensors.v2.paste_label')} hint={t('sensors.v2.paste_hint')} />
          <View style={styles.pasteCard}>
            <TextInput
              value={pasteText}
              onChangeText={(text) => { setPasteText(text); setParseResult(null); setPickedFileName(null); }}
              placeholder={'timestamp,sweat_loss_ml,sodium_mg\n2026-04-29T10:00:00Z,420,180\n2026-04-29T10:30:00Z,510,220'}
              placeholderTextColor={af.textTertiary}
              multiline
              style={styles.pasteInput}
              autoCapitalize="none"
              autoCorrect={false}
              testID="sensor-paste-input"
              accessibilityLabel={t('sensors.v2.paste_label')}
              accessibilityHint={t('sensors.v2.paste_hint')}
            />
          </View>

          {/* Preview */}
          {activeResult && (
            <>
              <SectionHeader label={t('sensors.v2.preview_label')} />
              <View style={styles.card}>
                <PreviewRow
                  label={t('sensors.v2.rows_ready')}
                  value={`${activeResult.rows.length}`}
                  highlight={activeResult.rows.length > 0}
                />
                <PreviewRow label={t('sensors.v2.columns_recognised')} value={activeResult.recognized.join(', ') || '—'} />
                <PreviewRow label={t('sensors.v2.skipped')} value={`${activeResult.skipped.length}`} />
                {activeResult.rows.slice(0, 3).map((r, i) => (
                  <PreviewRow
                    key={i}
                    label={new Date(r.timestamp).toLocaleString()}
                    value={t('sensors.v2.preview_reading', { ml: r.sweatLossMl, na: r.sodiumMg })}
                    muted
                  />
                ))}
              </View>
            </>
          )}

          {/* Action */}
          <Pressable
            onPress={onImport}
            disabled={importing || rowCount === 0}
            style={[
              styles.primaryButton,
              (importing || rowCount === 0) && styles.primaryButtonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityState={{ busy: importing, disabled: importing || rowCount === 0 }}
            testID="sensor-import-btn"
          >
            {importing ? (
              <ActivityIndicator color={af.canvas} />
            ) : (
              <>
                <Icon name="upload-cloud" size={14} color={af.canvas} />
                <Text style={styles.primaryButtonLabel}>
                  {rowCount > 0 ? t('sensors.v2.import_rows', { count: rowCount }) : t('sensors.v2.nothing_to_import')}
                </Text>
              </>
            )}
          </Pressable>

          {resultMessage && (
            <Text style={styles.resultMessage} accessibilityLiveRegion="polite" testID="sensor-result">{resultMessage}</Text>
          )}
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

function SectionHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {hint && <Text style={styles.sectionHint}>{hint}</Text>}
    </View>
  );
}

function PreviewRow({ label, value, highlight, muted }: { label: string; value: string; highlight?: boolean; muted?: boolean }) {
  return (
    <View style={styles.previewRow}>
      <Text style={[styles.previewLabel, muted && { color: af.textTertiary }]}>{label}</Text>
      <Text
        style={[
          styles.previewValue,
          highlight && { color: af.green },
          muted && { color: af.textTertiary, fontFamily: 'Inter_400Regular' },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: af.canvas },
  content: { paddingHorizontal: 20, gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: af.surface,
    borderWidth: 1, borderColor: af.divider,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, color: af.textTertiary, letterSpacing: 2 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, color: af.textPrimary, marginTop: 2 },
  intro: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.textSecondary },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, color: af.textTertiary, letterSpacing: 1.8 },
  sectionHint: { fontFamily: 'Inter_500Medium', fontSize: 10, color: af.textTertiary },

  card: {
    backgroundColor: af.surface,
    borderRadius: 14,
    borderWidth: 1, borderColor: af.divider,
    overflow: 'hidden',
  },
  row: {
    paddingVertical: 14, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: af.divider },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  rowLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: af.textPrimary },
  rowMuted: { fontFamily: 'Inter_500Medium', fontSize: 11, color: af.textTertiary },

  pasteCard: {
    backgroundColor: af.surface,
    borderRadius: 14,
    borderWidth: 1, borderColor: af.divider,
    padding: 12,
  },
  pasteInput: {
    fontFamily: 'Menlo',
    fontSize: 11,
    color: af.textPrimary,
    minHeight: 120,
    textAlignVertical: 'top',
  },

  previewRow: {
    paddingVertical: 10, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  previewLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: af.textSecondary, flex: 1 },
  previewValue: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: af.textPrimary, marginLeft: 12 },

  primaryButton: {
    marginTop: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 10,
    backgroundColor: af.red,
  },
  primaryButtonDisabled: { opacity: 0.4 },
  primaryButtonLabel: {
    fontFamily: 'Inter_700Bold', fontSize: 12, color: af.canvas, letterSpacing: 1.4,
  },
  resultMessage: {
    marginTop: 10,
    fontFamily: 'Inter_500Medium', fontSize: 12, color: af.textSecondary,
    textAlign: 'center',
  },
});
