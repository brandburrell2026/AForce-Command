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
import { Icon } from '../components/Icon';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';

import { GradientBackground } from '@/components/GradientBackground';
import { Colors } from '@/theme/colors';
import {
  parseSensorCsv, parseSensorJson, SENSOR_SOURCE_LABELS,
  type SensorRow, type SensorSource, type SensorParseResult,
} from '@/services/sensorImportService';
import { postSensorImport } from '@/services/realApi';

const SOURCES: SensorSource[] = ['hdrop', 'nix', 'gatorade_gx'];

export function SensorImportScreen() {
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
      setResultMessage(`Could not read file: ${(err as Error).message}`);
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
      setResultMessage(`Imported ${res.imported} rows from ${SENSOR_SOURCE_LABELS[source]}.`);
      setParseResult(null);
      setPickedFileName(null);
      setPasteText('');
    } catch (err) {
      setResultMessage(`Import failed: ${(err as Error).message}`);
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
            <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12} testID="sensors-back">
              <Icon name="chevron-left" size={20} color={Colors.text.primary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>HARDWARE</Text>
              <Text style={styles.title}>Sweat-Sensor Import</Text>
            </View>
          </View>

          <Text style={styles.intro}>
            Import data from a third-party sweat patch. Each row creates an intake event and a score snapshot tagged with the sensor source.
          </Text>

          {/* Source picker */}
          <SectionHeader label="SOURCE" />
          <View style={styles.card}>
            {SOURCES.map((s, i) => (
              <Pressable
                key={s}
                onPress={() => setSource(s)}
                style={[styles.row, i < SOURCES.length - 1 && styles.rowBorder]}
                testID={`sensor-source-${s}`}
              >
                <View style={styles.rowLeft}>
                  <Icon
                    name={source === s ? 'check-circle' : 'circle'}
                    size={16}
                    color={source === s ? Colors.states.PEAK.primary : Colors.text.muted}
                  />
                  <Text style={styles.rowLabel}>{SENSOR_SOURCE_LABELS[s]}</Text>
                </View>
                <Text style={styles.rowMuted}>{s}</Text>
              </Pressable>
            ))}
          </View>

          {/* File picker */}
          <SectionHeader label="FILE" hint="CSV with timestamp + sweat_loss columns" />
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
                testID="sensor-pick-file"
                accessibilityRole="button"
                accessibilityLabel={pickedFileName ?? 'Pick a CSV or JSON file'}
              >
                <Icon name="file-plus" size={16} color={Colors.states.BALANCED.primary} />
                <Text style={styles.rowLabel}>{pickedFileName ?? 'Pick a CSV / JSON file'}</Text>
              </Pressable>
              {pickedFileName && (
                <Pressable
                  onPress={onClearPick}
                  hitSlop={8}
                  testID="sensor-clear-pick"
                  accessibilityRole="button"
                  accessibilityLabel="Clear picked file"
                >
                  <Icon name="x" size={14} color={Colors.text.muted} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Paste fallback */}
          <SectionHeader label="PASTE" hint="CSV or JSON — overrides the file when filled" />
          <View style={styles.pasteCard}>
            <TextInput
              value={pasteText}
              onChangeText={(t) => { setPasteText(t); setParseResult(null); setPickedFileName(null); }}
              placeholder={'timestamp,sweat_loss_ml,sodium_mg\n2026-04-29T10:00:00Z,420,180\n2026-04-29T10:30:00Z,510,220'}
              placeholderTextColor={Colors.text.muted}
              multiline
              style={styles.pasteInput}
              autoCapitalize="none"
              autoCorrect={false}
              testID="sensor-paste-input"
              accessibilityLabel="Paste CSV or JSON sensor data"
              accessibilityHint="Overrides the picked file when filled in"
            />
          </View>

          {/* Preview */}
          {activeResult && (
            <>
              <SectionHeader label="PREVIEW" />
              <View style={styles.card}>
                <PreviewRow
                  label="Rows ready"
                  value={`${activeResult.rows.length}`}
                  highlight={activeResult.rows.length > 0}
                />
                <PreviewRow label="Columns recognised" value={activeResult.recognized.join(', ') || '—'} />
                <PreviewRow label="Skipped" value={`${activeResult.skipped.length}`} />
                {activeResult.rows.slice(0, 3).map((r, i) => (
                  <PreviewRow
                    key={i}
                    label={new Date(r.timestamp).toLocaleString()}
                    value={`${r.sweatLossMl} mL · ${r.sodiumMg} mg Na`}
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
            testID="sensor-import-btn"
          >
            {importing ? (
              <ActivityIndicator color={Colors.background.primary} />
            ) : (
              <>
                <Icon name="upload-cloud" size={14} color={Colors.background.primary} />
                <Text style={styles.primaryButtonLabel}>
                  {rowCount > 0 ? `IMPORT ${rowCount} ROWS` : 'NOTHING TO IMPORT'}
                </Text>
              </>
            )}
          </Pressable>

          {resultMessage && (
            <Text style={styles.resultMessage} testID="sensor-result">{resultMessage}</Text>
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
      <Text style={[styles.previewLabel, muted && { color: Colors.text.muted }]}>{label}</Text>
      <Text
        style={[
          styles.previewValue,
          highlight && { color: Colors.states.PEAK.primary },
          muted && { color: Colors.text.muted, fontFamily: 'Inter_400Regular' },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  content: { paddingHorizontal: 20, gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.fill.light,
    borderWidth: 1, borderColor: Colors.border.subtle,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, color: Colors.text.muted, letterSpacing: 2 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, color: Colors.text.primary, marginTop: 2 },
  intro: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: Colors.text.secondary },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, color: Colors.text.muted, letterSpacing: 1.8 },
  sectionHint: { fontFamily: 'Inter_500Medium', fontSize: 10, color: Colors.text.muted },

  card: {
    backgroundColor: Colors.fill.light,
    borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border.subtle,
    overflow: 'hidden',
  },
  row: {
    paddingVertical: 14, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border.subtle },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  rowLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.text.primary },
  rowMuted: { fontFamily: 'Inter_500Medium', fontSize: 11, color: Colors.text.muted },

  pasteCard: {
    backgroundColor: Colors.fill.light,
    borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border.subtle,
    padding: 12,
  },
  pasteInput: {
    fontFamily: 'Menlo',
    fontSize: 11,
    color: Colors.text.primary,
    minHeight: 120,
    textAlignVertical: 'top',
  },

  previewRow: {
    paddingVertical: 10, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  previewLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.text.secondary, flex: 1 },
  previewValue: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.text.primary, marginLeft: 12 },

  primaryButton: {
    marginTop: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 10,
    backgroundColor: Colors.text.primary,
  },
  primaryButtonDisabled: { opacity: 0.4 },
  primaryButtonLabel: {
    fontFamily: 'Inter_700Bold', fontSize: 12, color: Colors.background.primary, letterSpacing: 1.4,
  },
  resultMessage: {
    marginTop: 10,
    fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.text.secondary,
    textAlign: 'center',
  },
});
