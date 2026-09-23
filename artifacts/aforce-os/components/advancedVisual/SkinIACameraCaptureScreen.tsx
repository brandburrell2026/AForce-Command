import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { edAccent, edInk, edRule, edStock, edType } from '@/theme/editorialTokens';
import { withAlpha } from '@/theme/afTokens';
import { assessSkinIATechnicalQuality, type SkinIATechnicalQuality } from '@/services/skiniaTechnicalQuality';
import { extractSkinIAImageFeatures, type SkinIAImageFeatureState, type SkinIAImageMetrics } from '@/modules/skinia-image-features';
import { deriveSkinIAExperimentalCandidates } from '@/services/skiniaImageAnalysis';
import { resolveSkinIAInternalObservation, type SkinIAObservationOutcome } from '@/services/skiniaObservationPipeline';
import { resolveSkinIAMemberResult, SKINIA_MEMBER_OBSERVATIONS_ADMITTED } from '@/services/skiniaMemberResultGate';
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
  const cameraRef = useRef<InstanceType<typeof CameraView> | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<CaptureState>('PREPARING');
  const isLive = useRef(true);
  const sessionBaseline = useRef<SkinIAImageMetrics | null>(null);
  const [internalOutcome, setInternalOutcome] = useState<SkinIAObservationOutcome | null>(null);
  const [qualityReason, setQualityReason] = useState<QualityCode | null>(null);

  const retryCapture = useCallback(() => {
    setInternalOutcome(null);
    setQualityReason(null);
    setReady(false);
    setState('READY');
  }, []);

  const exitCapture = useCallback(() => {
    // Mark the session closed before navigation unmounts this screen. An
    // in-flight camera promise must not start analysis after a user cancels.
    isLive.current = false;
    sessionBaseline.current = null;
    onExit();
  }, [onExit]);

  useEffect(() => {
    isLive.current = true;
    return () => {
      // A PictureRef is never copied outside the capture callback. Dropping the
      // reference on every unmount/cancel is the final local cleanup boundary.
      isLive.current = false;
      sessionBaseline.current = null;
    };
  }, []);

  useEffect(() => {
    if (!permission) return;
    setState(permission.granted ? 'READY' : 'DENIED');
  }, [permission]);

  const takeEphemeralPicture = useCallback(async () => {
    if (!ready || state !== 'READY' || !cameraRef.current) return;
    setState('CAPTURING');
    let picture: PictureRef | undefined;
    let nextState: CaptureState = 'UNAVAILABLE';
    let nextOutcome: SkinIAObservationOutcome | null = null;
    let nextQualityReason: QualityCode | null = null;
    try {
      // pictureRef avoids a URI/base64/EXIF payload and a persistent asset.
      // The native quality gate measures fine cheek detail. Avoid introducing
      // JPEG compression blur before that measurement; the image stays in RAM.
      picture = await cameraRef.current.takePictureAsync({ pictureRef: true, quality: 1 });
      if (!isLive.current) return;
      const quality = assessSkinIATechnicalQuality({ cameraReady: ready, width: picture.width, height: picture.height });
      if (quality.state !== 'PASS') {
        nextState = 'QUALITY_INSUFFICIENT';
        nextQualityReason = quality.reason;
      } else {
        const analysis = await extractSkinIAImageFeatures(picture);
        if (!isLive.current) return;
        if (analysis.state !== 'PASS') {
          nextState = analysis.state === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'QUALITY_INSUFFICIENT';
          if (analysis.state !== 'UNAVAILABLE') nextQualityReason = analysis.state;
        } else {
          // Session-only comparison for internal QA. Every experimental candidate
          // has LOW confidence. A same-session capture is not a validated recent
          // personal baseline, and the member-result admission gate is closed.
          const candidates = deriveSkinIAExperimentalCandidates(analysis.metrics, sessionBaseline.current);
          sessionBaseline.current = analysis.metrics;
          const firstCandidate = candidates[0];
          nextOutcome = firstCandidate
            ? resolveSkinIAInternalObservation({ ...firstCandidate, capturedAt: new Date().toISOString() }, false)
            : null;
          nextState = 'REVIEW';
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
        nextOutcome = null;
        nextQualityReason = null;
        nextState = 'UNAVAILABLE';
      }
    }
    if (isLive.current) {
      setInternalOutcome(nextOutcome);
      setQualityReason(nextQualityReason);
      setState(nextState);
    }
  }, [ready, state]);

  if (state === 'DENIED') {
    return <PermissionDenied onExit={exitCapture} onRequest={() => { void requestPermission(); }} />;
  }
  if (state === 'QUALITY_INSUFFICIENT') return <QualityInsufficient onExit={exitCapture} onRetry={retryCapture} reason={qualityReason} />;
  if (state === 'REVIEW') return <Review outcome={internalOutcome} onExit={exitCapture} onAgain={retryCapture} />;
  if (state === 'UNAVAILABLE') return <Unavailable onExit={exitCapture} />;

  return (
    <View style={styles.screen} accessibilityLabel="SkinIA Visual Check camera capture">
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing="front"
        mirror
        onCameraReady={() => setReady(true)}
      />
      <View pointerEvents="none" style={styles.scrim} />
      <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.furniture}><Text style={styles.wordmark}>AFORCE</Text><Text style={styles.date}>CONTROLLED TESTFLIGHT</Text></View>
        <Text style={styles.kicker}>SKINIA VISUAL CHECK / SCAN</Text>
        <Text style={styles.title}>See today.{`\n`}Compare over time.</Text>
        <Text style={styles.body}>Center your full face, 30–45 cm away, with even light in front of you.</Text>
        <View style={styles.viewfinder} pointerEvents="none">
          <View style={[styles.corner, styles.topLeft]} /><View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} /><View style={[styles.corner, styles.bottomRight]} />
          <Text style={styles.guide}>ALIGN FACE / EVEN LIGHT / NO FILTERS</Text>
        </View>
        <View style={styles.meta}><Text style={styles.metaLabel}>Camera status</Text><Text style={styles.metaValue}>{ready ? 'READY' : 'PREPARING'}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Capture SkinIA image" disabled={!ready || state === 'CAPTURING'} onPress={takeEphemeralPicture} style={({ pressed }) => [styles.action, (!ready || state === 'CAPTURING') && styles.disabled, pressed && styles.pressed]}>
          <Text style={styles.actionLabel}>{state === 'CAPTURING' ? 'Capturing securely' : 'Capture review image'}</Text><Text style={styles.actionPlus}>+</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel SkinIA capture" onPress={exitCapture} style={styles.cancel}><Text style={styles.cancelText}>Cancel and discard</Text></Pressable>
        <Text style={styles.disclosure}>OBSERVATIONAL ONLY / NOT A DIAGNOSIS</Text>
        <View style={styles.footer}><View style={styles.rule} /><View style={styles.footerRow}><Text style={styles.footerText}>AFORCE OS</Text><Text style={styles.footerText}>02 / SCAN</Text></View></View>
      </View>
    </View>
  );
}

function PermissionDenied({ onExit, onRequest }: { onExit: () => void; onRequest: () => void }) { return <StaticState title="Camera access is off." kicker="PERMISSION DENIED" body="SkinIA will not begin a visual check without your explicit camera permission. No image has been captured." action="Enable camera" onAction={onRequest} secondary="Cancel" onSecondary={onExit} />; }
function QualityInsufficient({ onExit, onRetry, reason }: { onExit: () => void; onRetry: () => void; reason: QualityCode | null }) { return <StaticState title="Unable to Analyze" kicker="CAPTURE QUALITY INSUFFICIENT" body="We couldn’t make a reliable observation from today’s image. The temporary capture was discarded. For another try, face even light, avoid strong light behind you, center your full face, and hold still." action="Try another capture" onAction={onRetry} secondary="Back to SkinIA" onSecondary={onExit} qaCode={reason} />; }
function Review({ onExit, onAgain, outcome }: { onExit: () => void; onAgain: () => void; outcome: SkinIAObservationOutcome | null }) { const result = resolveSkinIAMemberResult(outcome); const qaCode = !SKINIA_MEMBER_OBSERVATIONS_ADMITTED && result.kind === 'NON_RESULT' ? 'OBSERVATIONS_NOT_ADMITTED' : null; return <StaticState title={result.kind === 'OBSERVATION' ? 'Your visual check.' : 'Unable to Analyze'} kicker="VISUAL CHECK RESULT" body={result.message} action="Take another scan" onAction={onAgain} secondary="Back to SkinIA" onSecondary={onExit} qaCode={qaCode} />; }
function Unavailable({ onExit }: { onExit: () => void }) { return <StaticState title="No visual check available." kicker="UNKNOWN" body="AForce cannot make a reliable visual observation from this image. No image was saved or sent." action="Back to SkinIA" onAction={onExit} />; }
function StaticState({ title, kicker, body, action, onAction, secondary, onSecondary, qaCode }: { title: string; kicker: string; body: string; action: string; onAction: () => void; secondary?: string; onSecondary?: () => void; qaCode?: InternalQaCode | null }) { const insets = useSafeAreaInsets(); return <View style={styles.staticScreen}><View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}><View style={styles.furniture}><Text style={styles.wordmark}>AFORCE</Text><Text style={styles.date}>CONTROLLED TESTFLIGHT</Text></View><Text style={styles.kicker}>SKINIA VISUAL CHECK / {kicker}</Text><Text style={styles.title}>{title}</Text><Text style={styles.body}>{body}</Text>{process.env.EXPO_PUBLIC_INTERNAL_TESTFLIGHT === 'true' && qaCode ? <Text style={styles.qaCode}>INTERNAL QA CODE: {qaCode}</Text> : null}<Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onAction} style={styles.action}><Text style={styles.actionLabel}>{action}</Text><Text style={styles.actionPlus}>+</Text></Pressable>{secondary && onSecondary ? <Pressable accessibilityRole="button" accessibilityLabel={secondary} onPress={onSecondary} style={styles.cancel}><Text style={styles.cancelText}>{secondary}</Text></Pressable> : null}<Text style={styles.disclosure}>Visual observations only. SkinIA does not diagnose conditions or measure hydration.</Text><View style={styles.footer}><View style={styles.rule} /><View style={styles.footerRow}><Text style={styles.footerText}>AFORCE OS</Text><Text style={styles.footerText}>02 / SCAN</Text></View></View></View></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: edStock.black }, staticScreen: { flex: 1, backgroundColor: edStock.black }, scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: withAlpha(edStock.black, 0.34) }, content: { flex: 1, paddingHorizontal: 32 },
  furniture: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, wordmark: { ...edType.caption, color: edAccent.red, fontWeight: '700' }, date: { ...edType.micro, color: edInk.quietOnBlack }, kicker: { ...edType.micro, color: edAccent.red, marginTop: 42 }, title: { ...edType.statement, color: edInk.ivory, marginTop: 14 }, body: { ...edType.bodySmall, color: edInk.quietOnBlack, marginTop: 10 },
  viewfinder: { alignSelf: 'center', backgroundColor: withAlpha(edStock.black, 0.06), borderRadius: 18, height: 230, marginTop: 30, overflow: 'hidden', width: '100%' }, corner: { borderColor: edAccent.red, height: 28, position: 'absolute', width: 28 }, topLeft: { borderLeftWidth: 2, borderTopWidth: 2, left: 22, top: 22 }, topRight: { borderRightWidth: 2, borderTopWidth: 2, right: 22, top: 22 }, bottomLeft: { borderBottomWidth: 2, borderLeftWidth: 2, bottom: 44, left: 22 }, bottomRight: { borderBottomWidth: 2, borderRightWidth: 2, bottom: 44, right: 22 }, guide: { ...edType.micro, bottom: 20, color: edInk.quietOnBlack, left: 22, position: 'absolute' },
  meta: { borderBottomColor: edRule.onBlack, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, paddingBottom: 16 }, metaLabel: { ...edType.bodySmall, color: edInk.ivory, fontWeight: '700' }, metaValue: { ...edType.micro, color: edAccent.red }, qaCode: { ...edType.micro, color: edInk.quietOnBlack, marginTop: 12 }, action: { alignItems: 'center', backgroundColor: edStock.paper, flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, minHeight: 48, paddingHorizontal: 16 }, actionLabel: { ...edType.bodySmall, color: edInk.black, fontWeight: '700' }, actionPlus: { color: edAccent.red, fontSize: 20, lineHeight: 22 }, disabled: { opacity: 0.56 }, pressed: { opacity: 0.75 }, cancel: { marginTop: 12, paddingVertical: 10 }, cancelText: { ...edType.bodySmall, color: edInk.quietOnBlack, textDecorationLine: 'underline' }, disclosure: { ...edType.micro, color: edInk.quietOnBlack, marginTop: 10 }, footer: { flex: 1, justifyContent: 'flex-end', paddingTop: 40 }, rule: { backgroundColor: edRule.onBlack, height: StyleSheet.hairlineWidth }, footerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12 }, footerText: { ...edType.micro, color: edInk.quietOnBlack },
});
