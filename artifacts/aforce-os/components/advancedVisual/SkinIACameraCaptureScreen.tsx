import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Ellipse, Line } from 'react-native-svg';
import { edStock } from '@/theme/editorialTokens';
import { af, afLayout, afType, withAlpha } from '@/theme/afTokens';
import { AFMasthead } from '@/components/ui/AFMasthead';
import { useAFEyebrowType } from '@/hooks/useAFEyebrowType';
import { useAFGutter } from '@/hooks/useAFGutter';
import { assessSkinIATechnicalQuality, type SkinIATechnicalQuality } from '@/services/skiniaTechnicalQuality';
import { extractSkinIAImageFeatures, type SkinIAImageFeatureState } from '@/modules/skinia-image-features';
import { deriveSkinIABaselineFreeQaProbes } from '@/services/skiniaImageAnalysis';
import { resolveSkinIAReviewPresentation } from '@/services/skiniaReviewPresentation';
import { createSkinIACaptureAttemptGate } from '@/services/skiniaCaptureAttemptGate';
import type { PictureRef } from 'expo-camera';

type CaptureState = 'PREPARING' | 'DENIED' | 'READY' | 'CAPTURING' | 'REVIEW' | 'QUALITY_INSUFFICIENT' | 'UNAVAILABLE';
type QualityCode = Exclude<SkinIATechnicalQuality['reason'], 'TECHNICAL_METADATA_ACCEPTED'>
  | Exclude<SkinIAImageFeatureState, 'PASS' | 'UNAVAILABLE'>;
type InternalQaCode = QualityCode | 'OBSERVATIONS_NOT_ADMITTED';

/**
 * Controlled-TestFlight capture surface based on approved Figma node 5:218.
 *
 * It uses Expo's native picture reference mode: no URI, base64, EXIF, preview,
 * upload, file write, storage, analytics payload, or member observation output.
 * Native pixel analysis returns derived metrics only and releases the capture
 * reference before any state transition.
 *
 * Black Issue restyle (PR 4, 2026-10-07; Figma frame 12): presentation only.
 * AFMasthead, the camera preview inside a bordered viewfinder plate (corner
 * brackets, guide ellipse, a live-preview pill and the pinned guidance line),
 * the camera-status row and the one red capture CTA. The reference also draws
 * QUALITY / FRAME / ALIGN / LIGHT / DIST readouts, a LIGHT / ANGLE / MOTION
 * row and "SCAN n OF SERIES"; the capture pipeline measures none of those
 * before a capture (only `ready`), so none is drawn. Imports editorialTokens
 * only for the two pinned preview scrims (DR-017 grants the tokens module and nothing else).
 */
export function SkinIACameraCaptureScreen({ onExit }: { onExit: () => void }) {
  if (Platform.OS === 'web') return <Unavailable onExit={onExit} />;
  return <NativeSkinIACameraCapture onExit={onExit} />;
}

function NativeSkinIACameraCapture({ onExit }: { onExit: () => void }) {
  // Lazy native-only load keeps the controlled surface unavailable on web.
  const ExpoCamera = require('expo-camera') as typeof import('expo-camera');
  const { CameraView, useCameraPermissions } = ExpoCamera;
  const insets = useSafeAreaInsets();
  const gutter = useAFGutter();
  const eyebrowType = useAFEyebrowType();
  const cameraRef = useRef<InstanceType<typeof CameraView> | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<CaptureState>('PREPARING');
  const isLive = useRef(true);
  const attemptGate = useRef(createSkinIACaptureAttemptGate());
  const permissionRequestInFlight = useRef(false);
  const interrupted = useRef(false);
  const [qualityReason, setQualityReason] = useState<QualityCode | null>(null);

  const retryCapture = useCallback(() => {
    setQualityReason(null);
    setReady(false);
    setState('READY');
  }, []);

  const exitCapture = useCallback(() => {
    // Mark the session closed before navigation unmounts this screen. An
    // in-flight camera promise must not start analysis after a user cancels.
    isLive.current = false;
    attemptGate.current.close();
    onExit();
  }, [onExit]);

  const requestCameraPermission = useCallback(async () => {
    permissionRequestInFlight.current = true;
    try {
      await requestPermission();
    } catch {
      if (isLive.current && !interrupted.current) setState('UNAVAILABLE');
    } finally {
      permissionRequestInFlight.current = false;
    }
  }, [requestPermission]);

  useEffect(() => {
    isLive.current = true;
    attemptGate.current.foregrounded();
    return () => {
      // Invalidate late results. The callback still owns any PictureRef until
      // its finally block releases it; native interruption needs device QA.
      isLive.current = false;
      // Invalidate the attempt, but permit React's development effect replay.
      attemptGate.current.interrupted();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        attemptGate.current.foregrounded();
        return;
      }
      // iOS may report inactive while its camera-permission sheet is open.
      // That sheet has not started a capture; a real background still aborts.
      if (next === 'inactive' && permissionRequestInFlight.current) return;
      attemptGate.current.interrupted();
      interrupted.current = true;
      setReady(false);
      setQualityReason(null);
      setState('UNAVAILABLE');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!permission || interrupted.current) return;
    setState(permission.granted ? 'READY' : 'DENIED');
  }, [permission]);

  const takeEphemeralPicture = useCallback(async () => {
    if (!ready || state !== 'READY' || !cameraRef.current) return;
    if (AppState.currentState !== 'active') {
      setState('UNAVAILABLE');
      return;
    }
    const attempt = attemptGate.current.begin();
    if (attempt === null) {
      setState('UNAVAILABLE');
      return;
    }
    setState('CAPTURING');
    let picture: PictureRef | undefined;
    let nextState: CaptureState = 'UNAVAILABLE';
    let nextQualityReason: QualityCode | null = null;
    try {
      // pictureRef avoids a URI/base64/EXIF payload and a persistent asset.
      // The native quality gate measures fine cheek detail. Avoid introducing
      // JPEG compression blur before that measurement; the image stays in RAM.
      picture = await cameraRef.current.takePictureAsync({ pictureRef: true, quality: 1 });
      if (!isLive.current || !attemptGate.current.isCurrent(attempt)) return;
      const quality = assessSkinIATechnicalQuality({ cameraReady: ready, width: picture.width, height: picture.height });
      if (quality.state !== 'PASS') {
        nextState = 'QUALITY_INSUFFICIENT';
        nextQualityReason = quality.reason;
      } else {
        const analysis = await extractSkinIAImageFeatures(picture);
        if (!isLive.current || !attemptGate.current.isCurrent(attempt)) return;
        if (analysis.state !== 'PASS') {
          nextState = analysis.state === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'QUALITY_INSUFFICIENT';
          if (analysis.state !== 'UNAVAILABLE') nextQualityReason = analysis.state;
        } else {
          // The first capture has no comparable personal baseline. Keep only
          // versioned, baseline-free QA probes in this callback; do not infer
          // an appearance label or retain them in component state.
          nextState = deriveSkinIABaselineFreeQaProbes(analysis)
            ? 'REVIEW'
            : 'UNAVAILABLE';
        }
      }
    } catch {
      nextState = 'UNAVAILABLE';
    } finally {
      // Release before any review or failure state can be displayed.
      try {
        picture?.release();
      } catch {
        // A failed native release cannot be treated as a successful review.
        // Keep the result closed and let the reference fall out of JS scope.
        nextQualityReason = null;
        nextState = 'UNAVAILABLE';
      }
    }
    if (isLive.current && attemptGate.current.isCurrent(attempt)) {
      setQualityReason(nextQualityReason);
      setState(nextState);
    }
  }, [ready, state]);

  if (state === 'DENIED') {
    return <PermissionDenied onExit={exitCapture} onRequest={() => { void requestCameraPermission(); }} />;
  }
  if (state === 'QUALITY_INSUFFICIENT') return <QualityInsufficient onExit={exitCapture} onRetry={retryCapture} reason={qualityReason} />;
  if (state === 'REVIEW') return <Review onExit={exitCapture} onAgain={retryCapture} />;
  if (state === 'UNAVAILABLE') return <Unavailable onExit={exitCapture} />;

  return (
    <View style={styles.screen} accessibilityLabel="SkinIA Visual Check camera capture">
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, paddingHorizontal: gutter }]}
        showsVerticalScrollIndicator={false}
      >
        <AFMasthead
          meta="CONTROLLED TESTFLIGHT"
          breadcrumb="SKINIA VISUAL CHECK / SCAN"
          title={'Capture for QA.\nNo skin reading yet.'}
          subtitle="Center your full face, 30–45 cm away, with even light in front of you."
        />
        <View style={styles.plate}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFillObject}
            facing="front"
            mirror
            onCameraReady={() => { if (!interrupted.current) setReady(true); }}
          />
          <View pointerEvents="none" style={styles.scrim} />
          <View style={styles.viewfinder} pointerEvents="none">
            <Svg style={styles.guideSvg} viewBox="0 0 100 120" preserveAspectRatio="xMidYMid meet" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Line x1="50" y1="0" x2="50" y2="120" stroke={af.textTertiary} strokeOpacity={0.35} strokeWidth={0.4} />
              <Line x1="0" y1="60" x2="100" y2="60" stroke={af.textTertiary} strokeOpacity={0.35} strokeWidth={0.4} />
              <Ellipse cx="50" cy="60" rx="34" ry="46" stroke={af.textSecondary} strokeOpacity={0.5} strokeWidth={0.6} fill="none" />
              <Ellipse cx="50" cy="60" rx="27" ry="37" stroke={af.redText} strokeWidth={0.9} fill="none" />
            </Svg>
            <View style={[styles.corner, styles.topLeft]} /><View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} /><View style={[styles.corner, styles.bottomRight]} />
            <View style={styles.pillRow}>
              <View style={[styles.pill, ready && styles.pillLive]}>
                {ready ? <View style={styles.pillDot} /> : null}
                <Text style={[styles.pillText, eyebrowType]}>{ready ? 'LIVE PREVIEW' : 'PREPARING'}</Text>
              </View>
            </View>
            <View style={styles.guideWrap}><Text style={[styles.guide, eyebrowType]}>ALIGN FACE / EVEN LIGHT / NO FILTERS</Text></View>
          </View>
        </View>
        <View style={styles.meta} accessible accessibilityLabel={`Camera status, ${ready ? 'ready' : 'preparing'}`}>
          <Text style={styles.metaLabel}>Camera status</Text><Text style={[styles.metaValue, eyebrowType]}>{ready ? 'READY' : 'PREPARING'}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Capture SkinIA image" accessibilityState={{ disabled: !ready || state === 'CAPTURING' }} disabled={!ready || state === 'CAPTURING'} onPress={takeEphemeralPicture} style={({ pressed }) => [styles.action, (!ready || state === 'CAPTURING') && styles.disabled, pressed && styles.pressed]}>
          <Text style={styles.actionLabel}>{state === 'CAPTURING' ? 'Capturing securely' : 'Capture review image'}</Text><Text style={styles.actionPlus}>+</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel SkinIA capture" onPress={exitCapture} style={styles.cancel}><Text style={styles.cancelText}>Cancel and discard</Text></Pressable>
        <Text style={[styles.disclosure, eyebrowType]}>OBSERVATIONAL ONLY / NOT A DIAGNOSIS</Text>
        <Folio eyebrowType={eyebrowType} />
      </ScrollView>
    </View>
  );
}

function PermissionDenied({ onExit, onRequest }: { onExit: () => void; onRequest: () => void }) { return <StaticState title="Camera access is off." kicker="PERMISSION DENIED" body="SkinIA will not begin a visual check without your explicit camera permission. No image has been captured." action="Enable camera" onAction={onRequest} secondary="Cancel" onSecondary={onExit} />; }
function QualityInsufficient({ onExit, onRetry, reason }: { onExit: () => void; onRetry: () => void; reason: QualityCode | null }) { return <StaticState title="Unable to Analyze" kicker="CAPTURE QUALITY INSUFFICIENT" body="We couldn’t make a reliable observation from today’s image. The temporary capture was discarded. For another try, face even light, avoid strong light behind you, center your full face, and hold still." action="Try another capture" onAction={onRetry} secondary="Back to SkinIA" onSecondary={onExit} qaCode={reason} />; }
function Review({ onExit, onAgain }: { onExit: () => void; onAgain: () => void }) {
  const presentation = resolveSkinIAReviewPresentation(null, process.env.EXPO_PUBLIC_INTERNAL_TESTFLIGHT === 'true');
  const findingsGated = presentation.qaCode === 'OBSERVATIONS_NOT_ADMITTED';

  return <StaticState
    title={presentation.title}
    kicker={presentation.kicker}
    body={presentation.body}
    qaNote={presentation.qaNote}
    action={presentation.action}
    onAction={findingsGated ? onExit : onAgain}
    secondary={findingsGated ? undefined : 'Back to SkinIA'}
    onSecondary={findingsGated ? undefined : onExit}
    qaCode={presentation.qaCode}
  />;
}
function Unavailable({ onExit }: { onExit: () => void }) { return <StaticState title="No visual check available." kicker="UNKNOWN" body="AForce cannot make a reliable visual observation from this image. No image was saved or sent." action="Back to SkinIA" onAction={onExit} />; }
function Folio({ eyebrowType }: { eyebrowType: { letterSpacing: number } }) {
  return <View style={styles.footer}><View style={styles.rule} /><View style={styles.footerRow}><Text style={[styles.footerText, eyebrowType]}>AFORCE OS</Text><Text style={[styles.footerText, eyebrowType]}>02 / SCAN</Text></View></View>;
}
function StaticState({ title, kicker, body, action, onAction, secondary, onSecondary, qaCode, qaNote }: { title: string; kicker: string; body: string; action: string; onAction: () => void; secondary?: string; onSecondary?: () => void; qaCode?: InternalQaCode | null; qaNote?: string | null }) {
  const insets = useSafeAreaInsets();
  const gutter = useAFGutter();
  const eyebrowType = useAFEyebrowType();
  return (
    <View style={styles.staticScreen}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        <AFMasthead meta="CONTROLLED TESTFLIGHT" breadcrumb={`SKINIA VISUAL CHECK / ${kicker}`} title={title} subtitle={body} />
        {process.env.EXPO_PUBLIC_INTERNAL_TESTFLIGHT === 'true' && qaNote ? <Text style={styles.qaNote}>{qaNote}</Text> : null}
        {process.env.EXPO_PUBLIC_INTERNAL_TESTFLIGHT === 'true' && qaCode ? <Text style={[styles.qaCode, eyebrowType]}>INTERNAL QA CODE: {qaCode}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onAction} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><Text style={styles.actionLabel}>{action}</Text><Text style={styles.actionPlus}>+</Text></Pressable>
        {secondary && onSecondary ? <Pressable accessibilityRole="button" accessibilityLabel={secondary} onPress={onSecondary} style={styles.cancel}><Text style={styles.cancelText}>{secondary}</Text></Pressable> : null}
        <Text style={styles.disclosureBody}>Visual observations only. SkinIA does not diagnose conditions or measure hydration.</Text>
        <Folio eyebrowType={eyebrowType} />
      </ScrollView>
    </View>
  );
}

const CORNER = 22;
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: af.canvas },
  staticScreen: { flex: 1, backgroundColor: af.canvas },
  scroll: { flexGrow: 1 },
  // Pinned preview scrims (skiniaCameraCapture.test.ts): the camera stays legible, the guide stays visible.
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: withAlpha(edStock.black, 0.34) },
  plate: { backgroundColor: af.surface, borderColor: af.border, borderRadius: afLayout.radiusCard, borderWidth: 1, flexGrow: 1, marginTop: 24, minHeight: 300, overflow: 'hidden' },
  viewfinder: { ...StyleSheet.absoluteFillObject, backgroundColor: withAlpha(edStock.black, 0.06) },
  guideSvg: { ...StyleSheet.absoluteFillObject },
  corner: { borderColor: af.redText, height: CORNER, position: 'absolute', width: CORNER },
  topLeft: { borderLeftWidth: 2, borderTopWidth: 2, left: 14, top: 14 },
  topRight: { borderRightWidth: 2, borderTopWidth: 2, right: 14, top: 14 },
  bottomLeft: { borderBottomWidth: 2, borderLeftWidth: 2, bottom: 14, left: 14 },
  bottomRight: { borderBottomWidth: 2, borderRightWidth: 2, bottom: 14, right: 14 },
  pillRow: { flexDirection: 'row', left: 28, position: 'absolute', right: 28, top: 22 },
  pill: { alignItems: 'center', backgroundColor: withAlpha(edStock.black, 0.6), borderColor: af.border, borderRadius: 999, borderWidth: 1, columnGap: 6, flexDirection: 'row', flexShrink: 1, minHeight: 28, paddingHorizontal: 12, paddingVertical: 4 },
  pillLive: { borderColor: af.redText },
  pillDot: { backgroundColor: af.redText, borderRadius: 3, height: 6, width: 6 },
  pillText: { ...afType.micro, color: af.textPrimary, flexShrink: 1 },
  guideWrap: { alignItems: 'center', bottom: 20, left: 28, position: 'absolute', right: 28 },
  guide: { ...afType.micro, backgroundColor: withAlpha(edStock.black, 0.6), borderRadius: 4, color: af.textPrimary, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3, textAlign: 'center' },
  meta: { alignItems: 'baseline', borderBottomColor: af.border, borderBottomWidth: StyleSheet.hairlineWidth, borderTopColor: af.border, borderTopWidth: StyleSheet.hairlineWidth, columnGap: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 20, paddingVertical: 14 },
  metaLabel: { ...afType.secondary, color: af.textPrimary, fontWeight: '700' },
  metaValue: { ...afType.micro, color: af.redText },
  qaNote: { ...afType.secondary, color: af.textSecondary, marginTop: 16 },
  qaCode: { ...afType.micro, color: af.textSecondary, marginTop: 12 },
  action: { alignItems: 'center', backgroundColor: af.red, borderRadius: afLayout.radiusButton, columnGap: 12, flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, minHeight: afLayout.buttonHeight, paddingHorizontal: 20, paddingVertical: 8 },
  actionLabel: { ...afType.bodyStrong, color: af.onRed, flexShrink: 1 },
  actionPlus: { ...afType.title3, color: af.onRed },
  disabled: { opacity: 0.56 },
  pressed: { opacity: 0.85 },
  cancel: { justifyContent: 'center', marginTop: 8, minHeight: 44 },
  cancelText: { ...afType.secondary, color: af.textSecondary, textDecorationLine: 'underline' },
  disclosure: { ...afType.micro, color: af.textSecondary, marginTop: 8 },
  disclosureBody: { ...afType.caption, color: af.textSecondary, marginTop: 8 },
  footer: { flexGrow: 1, justifyContent: 'flex-end', paddingTop: 32 },
  rule: { backgroundColor: af.divider, height: StyleSheet.hairlineWidth },
  footerRow: { columnGap: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingTop: 12 },
  footerText: { ...afType.micro, color: af.textTertiary },
});
