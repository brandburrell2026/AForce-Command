/**
 * SmartCaptureModal — photograph or upload a food/drink and get AI-powered
 * hydration/recovery estimates. Slice 2 of the HydroScan final system.
 *
 * Flow:
 *   1. choose  — Take Photo / Choose from Library
 *   2. preview — show the image with Re-take / Analyze
 *   3. loading — spinner while server analyzes via OpenAI vision
 *   4. result  — four load cards (hydration / recovery / stimulant / acidic),
 *                a correction recommendation card with one-tap log, and
 *                the required disclaimer pinned at the bottom.
 *
 * Per product spec we explicitly do NOT show calories or macros. The
 * server's system prompt + response schema enforce the same rule.
 *
 * Disclaimer text (verbatim per spec):
 *   "Smart Capture provides estimated hydration and recovery guidance
 *    only and is not a medical or nutritional diagnostic tool."
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Icon } from './Icon';
import { Colors } from '../theme/colors';
import { DRINK_CATEGORIES, type DrinkCategoryId } from '../data/drinkCatalog';
import { postSmartCapture, type SmartCaptureResult, type LoadLevel } from '../services/smartCaptureApi';

interface Props {
  visible: boolean;
  accentColor: string;
  onCancel: () => void;
  /**
   * Called when the user taps "LOG CORRECTION" on the result card.
   * Parent owns the actual logIntake call (same contract as
   * AddDrinkModal) so we stay decoupled from the store.
   */
  onLogCorrection: (args: {
    categoryId: DrinkCategoryId;
    name: string;
    displayName: string;
    enteredOz: number;
    effectiveOz: number;
    hydrationCoefficient: number;
  }) => void;
}

type Stage =
  | { kind: 'choose' }
  | { kind: 'preview'; imageBase64: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp'; localUri: string }
  | { kind: 'loading'; localUri: string }
  | { kind: 'result'; localUri: string; result: SmartCaptureResult }
  | { kind: 'error'; localUri: string | null; message: string };

const DISCLAIMER =
  'Smart Capture provides estimated hydration and recovery guidance only ' +
  'and is not a medical or nutritional diagnostic tool.';

export function SmartCaptureModal({ visible, accentColor, onCancel, onLogCorrection }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: 'choose' });

  // Reset every time the modal opens so a previous analysis doesn't bleed in.
  useEffect(() => {
    if (visible) setStage({ kind: 'choose' });
  }, [visible]);

  const hapticTap = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  };

  const launchPicker = useCallback(async (source: 'camera' | 'library') => {
    hapticTap();
    try {
      // Lazy require so web bundling never tries to resolve the native module.
      const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');

      // On web, expo-image-picker only supports the library picker; "camera"
      // falls back to the same picker which lets users still upload.
      if (source === 'camera' && Platform.OS !== 'web') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            'Camera access needed',
            'AForce OS needs camera access to capture your food or drink.',
          );
          return;
        }
      }

      const opts: import('expo-image-picker').ImagePickerOptions = {
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
        allowsEditing: false,
        exif: false,
      };

      const result =
        source === 'camera' && Platform.OS !== 'web'
          ? await ImagePicker.launchCameraAsync(opts)
          : await ImagePicker.launchImageLibraryAsync(opts);

      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const b64 = asset.base64;
      if (!b64) {
        setStage({ kind: 'error', localUri: null, message: 'Could not read photo. Please try again.' });
        return;
      }

      // expo-image-picker normalizes to JPEG on most platforms; if it
      // returned PNG/WebP we still honor the actual mime via asset.mimeType.
      const inferredMime: 'image/jpeg' | 'image/png' | 'image/webp' =
        asset.mimeType === 'image/png'
          ? 'image/png'
          : asset.mimeType === 'image/webp'
          ? 'image/webp'
          : 'image/jpeg';

      setStage({
        kind: 'preview',
        imageBase64: b64,
        mimeType: inferredMime,
        localUri: asset.uri,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not open photo picker.';
      setStage({ kind: 'error', localUri: null, message });
    }
  }, []);

  const analyze = useCallback(async () => {
    if (stage.kind !== 'preview') return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    const { imageBase64, mimeType, localUri } = stage;
    setStage({ kind: 'loading', localUri });
    try {
      const result = await postSmartCapture({ imageBase64, mimeType });
      setStage({ kind: 'result', localUri, result });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Smart Capture could not analyze that photo. Please try again.';
      setStage({ kind: 'error', localUri, message });
    }
  }, [stage]);

  const retake = () => {
    hapticTap();
    setStage({ kind: 'choose' });
  };

  const logCorrection = () => {
    if (stage.kind !== 'result') return;
    const rec = stage.result.correctionRecommendation;
    const cat = DRINK_CATEGORIES[rec.drinkCategory];
    if (!cat) return;
    const coef = cat.hydrationCoefficient;
    const effective = Math.round(Math.max(0, rec.oz) * Math.max(0, coef) * 10) / 10;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    onLogCorrection({
      categoryId: rec.drinkCategory,
      name: rec.drinkName,
      displayName: `${cat.label} \u00b7 ${rec.drinkName}`,
      enteredOz: rec.oz,
      effectiveOz: effective,
      hydrationCoefficient: coef,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ width: 20 }} />
            <Text style={styles.title}>SMART CAPTURE</Text>
            <Pressable onPress={onCancel} hitSlop={12} accessibilityLabel="Close">
              <Icon name="x" size={20} color={Colors.text.secondary} />
            </Pressable>
          </View>

          {stage.kind === 'choose' && (
            <ChooseStage accentColor={accentColor} onPick={launchPicker} />
          )}

          {stage.kind === 'preview' && (
            <PreviewStage
              localUri={stage.localUri}
              accentColor={accentColor}
              onRetake={retake}
              onAnalyze={analyze}
            />
          )}

          {stage.kind === 'loading' && (
            <LoadingStage localUri={stage.localUri} accentColor={accentColor} />
          )}

          {stage.kind === 'result' && (
            <ResultStage
              localUri={stage.localUri}
              result={stage.result}
              accentColor={accentColor}
              onRetake={retake}
              onLog={logCorrection}
            />
          )}

          {stage.kind === 'error' && (
            <ErrorStage message={stage.message} accentColor={accentColor} onRetry={retake} />
          )}

          {/* Disclaimer — always visible per spec */}
          <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Stages ───────────────────────────────────────────────────────────

function ChooseStage(props: {
  accentColor: string;
  onPick: (source: 'camera' | 'library') => void;
}) {
  const { accentColor, onPick } = props;
  return (
    <View style={{ gap: 14 }}>
      <Text style={styles.eyebrow}>SNAP A FOOD OR DRINK</Text>
      <Text style={styles.bodyText}>
        Get an instant read on hydration demand, recovery load, stimulants,
        and acidic burden — plus what to drink next to correct.
      </Text>

      <View style={{ gap: 10, marginTop: 6 }}>
        <Pressable
          onPress={() => onPick('camera')}
          style={({ pressed }) => [
            styles.ctaPrimary,
            { backgroundColor: accentColor },
            pressed && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
          testID="smart-capture-take"
        >
          <Icon name="camera" size={16} color={Colors.text.inverse} />
          <Text style={styles.ctaPrimaryText}>TAKE PHOTO</Text>
        </Pressable>

        <Pressable
          onPress={() => onPick('library')}
          style={({ pressed }) => [styles.ctaSecondary, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          testID="smart-capture-upload"
        >
          <Icon name="image" size={16} color={Colors.text.primary} />
          <Text style={styles.ctaSecondaryText}>UPLOAD FROM LIBRARY</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PreviewStage(props: {
  localUri: string;
  accentColor: string;
  onRetake: () => void;
  onAnalyze: () => void;
}) {
  const { localUri, accentColor, onRetake, onAnalyze } = props;
  return (
    <View style={{ gap: 12 }}>
      <Image source={{ uri: localUri }} style={styles.previewImage} resizeMode="cover" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={onRetake}
          style={({ pressed }) => [styles.ctaSecondary, { flex: 1 }, pressed && { opacity: 0.85 }]}
        >
          <Icon name="refresh-cw" size={14} color={Colors.text.primary} />
          <Text style={styles.ctaSecondaryText}>RETAKE</Text>
        </Pressable>
        <Pressable
          onPress={onAnalyze}
          style={({ pressed }) => [
            styles.ctaPrimary,
            { flex: 2, backgroundColor: accentColor },
            pressed && { opacity: 0.85 },
          ]}
          testID="smart-capture-analyze"
        >
          <Icon name="zap" size={14} color={Colors.text.inverse} />
          <Text style={styles.ctaPrimaryText}>ANALYZE</Text>
        </Pressable>
      </View>
    </View>
  );
}

function LoadingStage(props: { localUri: string; accentColor: string }) {
  const { localUri, accentColor } = props;
  return (
    <View style={{ gap: 14, alignItems: 'center' }}>
      <Image source={{ uri: localUri }} style={[styles.previewImage, { opacity: 0.4 }]} resizeMode="cover" />
      <ActivityIndicator size="small" color={accentColor} />
      <Text style={styles.eyebrow}>ANALYZING…</Text>
      <Text style={[styles.bodyText, { textAlign: 'center' }]}>
        Estimating hydration, recovery, stimulant, and acidic load.
      </Text>
    </View>
  );
}

function ResultStage(props: {
  localUri: string;
  result: SmartCaptureResult;
  accentColor: string;
  onRetake: () => void;
  onLog: () => void;
}) {
  const { localUri, result, accentColor, onRetake, onLog } = props;
  const cat = DRINK_CATEGORIES[result.correctionRecommendation.drinkCategory];

  return (
    <ScrollView
      style={{ maxHeight: 460 }}
      contentContainerStyle={{ gap: 12, paddingBottom: 4 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.resultHeader}>
        <Image source={{ uri: localUri }} style={styles.resultThumb} resizeMode="cover" />
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>WE SEE</Text>
          <Text style={styles.resultSummary} numberOfLines={2}>{result.itemSummary}</Text>
        </View>
      </View>

      <View style={styles.loadsGrid}>
        <LoadCard label="HYDRATION DEMAND" item={result.hydrationDemand} />
        <LoadCard label="RECOVERY LOAD"    item={result.recoveryLoad} />
        <LoadCard label="STIMULANT LOAD"   item={result.stimulantLoad} />
        <LoadCard label="ACIDIC LOAD"      item={result.acidicLoad} />
      </View>

      <View style={[styles.correctionCard, { borderColor: accentColor }]}>
        <Text style={[styles.eyebrow, { color: accentColor }]}>CORRECTION</Text>
        <Text style={styles.correctionName}>
          {cat?.label ?? 'Drink'} \u00b7 {result.correctionRecommendation.drinkName}
        </Text>
        <Text style={styles.correctionMeta}>
          {result.correctionRecommendation.oz} oz \u00b7 {Math.round((cat?.hydrationCoefficient ?? 0.8) * 100)}% hydration credit
        </Text>
        <Text style={styles.correctionRationale} numberOfLines={4}>
          {result.correctionRecommendation.rationale}
        </Text>

        <Pressable
          onPress={onLog}
          style={({ pressed }) => [
            styles.ctaPrimary,
            { backgroundColor: accentColor, marginTop: 10 },
            pressed && { opacity: 0.85 },
          ]}
          testID="smart-capture-log-correction"
        >
          <Icon name="check-circle" size={14} color={Colors.text.inverse} />
          <Text style={styles.ctaPrimaryText}>
            LOG {result.correctionRecommendation.oz} OZ
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onRetake}
        style={({ pressed }) => [styles.ctaSecondary, pressed && { opacity: 0.85 }]}
      >
        <Icon name="refresh-cw" size={14} color={Colors.text.primary} />
        <Text style={styles.ctaSecondaryText}>NEW CAPTURE</Text>
      </Pressable>
    </ScrollView>
  );
}

function ErrorStage(props: { message: string; accentColor: string; onRetry: () => void }) {
  const { message, accentColor, onRetry } = props;
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.errorBox}>
        <Icon name="alert-triangle" size={16} color={Colors.states.DEPLETED.primary} />
        <Text style={styles.errorText} numberOfLines={4}>{message}</Text>
      </View>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [
          styles.ctaPrimary,
          { backgroundColor: accentColor },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Icon name="refresh-cw" size={14} color={Colors.text.inverse} />
        <Text style={styles.ctaPrimaryText}>TRY AGAIN</Text>
      </Pressable>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function LoadCard(props: {
  label: string;
  item: { level: LoadLevel; score: number; note: string };
}) {
  const { label, item } = props;
  const color = loadColor(item.level);
  return (
    <View style={[styles.loadCard, { borderColor: `${color}55` }]}>
      <View style={styles.loadRow}>
        <Text style={styles.loadLabel}>{label}</Text>
        <Text style={[styles.loadLevel, { color }]}>{formatLevel(item.level)}</Text>
      </View>
      <View style={styles.loadBarTrack}>
        <View
          style={[
            styles.loadBarFill,
            { width: `${Math.max(4, Math.min(100, item.score))}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={styles.loadNote} numberOfLines={3}>{item.note}</Text>
    </View>
  );
}

function formatLevel(l: LoadLevel): string {
  switch (l) {
    case 'low': return 'LOW';
    case 'moderate': return 'MODERATE';
    case 'high': return 'HIGH';
    case 'very_high': return 'VERY HIGH';
  }
}

function loadColor(l: LoadLevel): string {
  switch (l) {
    case 'low':       return Colors.states.PEAK.primary;
    case 'moderate':  return Colors.states.RECOVERING.primary;
    case 'high':      return Colors.states.RECOVERING.primary;
    case 'very_high': return Colors.states.DEPLETED.primary;
  }
}

// ─── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background.elevated,
    paddingTop: 14,
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 12,
    maxHeight: '92%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 3,
    color: Colors.text.primary,
  },

  eyebrow: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
    color: Colors.text.muted,
  },
  bodyText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.secondary,
    lineHeight: 19,
  },

  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  ctaPrimaryText: {
    color: Colors.text.inverse,
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
  },
  ctaSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.medium,
  },
  ctaSecondaryText: {
    color: Colors.text.primary,
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
  },

  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    backgroundColor: Colors.fill.medium,
  },

  resultHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  resultThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: Colors.fill.medium,
  },
  resultSummary: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.primary,
    marginTop: 2,
  },

  loadsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  loadCard: {
    flexBasis: '48%',
    flexGrow: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: Colors.fill.light,
    gap: 6,
  },
  loadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loadLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.4,
    color: Colors.text.muted,
  },
  loadLevel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
  },
  loadBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border.subtle,
    overflow: 'hidden',
  },
  loadBarFill: {
    height: 4,
    borderRadius: 2,
  },
  loadNote: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.secondary,
    lineHeight: 15,
  },

  correctionCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: Colors.fill.light,
    gap: 4,
  },
  correctionName: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    marginTop: 2,
  },
  correctionMeta: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.muted,
    marginTop: 2,
  },
  correctionRationale: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.secondary,
    lineHeight: 17,
    marginTop: 6,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: `${Colors.states.DEPLETED.primary}14`,
    borderWidth: 1,
    borderColor: `${Colors.states.DEPLETED.primary}55`,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.primary,
    lineHeight: 17,
  },

  disclaimer: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.muted,
    lineHeight: 14,
    textAlign: 'center',
    paddingHorizontal: 6,
    paddingTop: 4,
    letterSpacing: 0.2,
  },
});
