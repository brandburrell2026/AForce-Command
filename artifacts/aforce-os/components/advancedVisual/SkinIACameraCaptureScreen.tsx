import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { edAccent, edInk, edRule, edStock, edType } from '@/theme/editorialTokens';
import { assessSkinIATechnicalQuality } from '@/services/skiniaTechnicalQuality';

type CaptureState = 'PREPARING' | 'DENIED' | 'READY' | 'CAPTURING' | 'REVIEW' | 'QUALITY_INSUFFICIENT' | 'UNAVAILABLE';

/**
 * Controlled-TestFlight capture surface based on approved Figma node 5:218.
 *
 * It uses Expo's native picture reference mode: no URI, base64, EXIF, preview,
 * upload, file write, storage, analytics payload, or observation output. The
 * native picture reference remains scoped to the capture callback and is
 * discarded immediately after the minimal technical dimensions check.
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

  useEffect(() => {
    return () => {
      // A PictureRef is never copied outside the capture callback. Dropping the
      // reference on every unmount/cancel is the final local cleanup boundary.
      isLive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!permission) return;
    setState(permission.granted ? 'READY' : 'DENIED');
  }, [permission]);

  const takeEphemeralPicture = useCallback(async () => {
    if (!ready || state !== 'READY' || !cameraRef.current) return;
    setState('CAPTURING');
    try {
      // pictureRef avoids a URI/base64/EXIF payload and does not create a
      // persistent preview asset. This PR only checks technical dimensions.
      const picture = await cameraRef.current.takePictureAsync({ pictureRef: true, quality: 0.45 });
      const quality = assessSkinIATechnicalQuality({ cameraReady: ready, width: picture.width, height: picture.height });
      // Explicitly release the native image buffer before any UI transition.
      picture.release();
      // Do not retain the native reference or create a derived member result.
      if (isLive.current) setState(quality.state === 'PASS' ? 'REVIEW' : 'QUALITY_INSUFFICIENT');
    } catch {
      if (isLive.current) setState('UNAVAILABLE');
    }
  }, [ready, state]);

  if (state === 'DENIED') {
    return <PermissionDenied onExit={onExit} onRequest={() => { void requestPermission(); }} />;
  }
  if (state === 'QUALITY_INSUFFICIENT') return <QualityInsufficient onExit={onExit} />;
  if (state === 'REVIEW') return <Review onExit={onExit} />;
  if (state === 'UNAVAILABLE') return <Unavailable onExit={onExit} />;

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
        <Text style={styles.body}>A guided visual check-in for consistent, non-diagnostic observation.</Text>
        <View style={styles.viewfinder} pointerEvents="none">
          <View style={[styles.corner, styles.topLeft]} /><View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} /><View style={[styles.corner, styles.bottomRight]} />
          <Text style={styles.guide}>ALIGN FACE / EVEN LIGHT / NO FILTERS</Text>
        </View>
        <View style={styles.meta}><Text style={styles.metaLabel}>Capture quality</Text><Text style={styles.metaValue}>{ready ? 'READY' : 'PREPARING'}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Capture SkinIA image" disabled={!ready || state === 'CAPTURING'} onPress={takeEphemeralPicture} style={({ pressed }) => [styles.action, (!ready || state === 'CAPTURING') && styles.disabled, pressed && styles.pressed]}>
          <Text style={styles.actionLabel}>{state === 'CAPTURING' ? 'Capturing securely' : 'Capture review image'}</Text><Text style={styles.actionPlus}>+</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel SkinIA capture" onPress={onExit} style={styles.cancel}><Text style={styles.cancelText}>Cancel and discard</Text></Pressable>
        <Text style={styles.disclosure}>OBSERVATIONAL ONLY / NOT A DIAGNOSIS</Text>
        <View style={styles.footer}><View style={styles.rule} /><View style={styles.footerRow}><Text style={styles.footerText}>AFORCE OS</Text><Text style={styles.footerText}>02 / SCAN</Text></View></View>
      </View>
    </View>
  );
}

function PermissionDenied({ onExit, onRequest }: { onExit: () => void; onRequest: () => void }) { return <StaticState title="Camera access is off." kicker="PERMISSION DENIED" body="SkinIA will not begin a visual check without your explicit camera permission. No image has been captured." action="Enable camera" onAction={onRequest} secondary="Cancel" onSecondary={onExit} />; }
function QualityInsufficient({ onExit }: { onExit: () => void }) { return <StaticState title="Do not force a result." kicker="CAPTURE QUALITY INSUFFICIENT" body="Status: UNKNOWN. The temporary capture was discarded because its technical conditions were not suitable. No observation was produced." action="Back to SkinIA" onAction={onExit} />; }
function Review({ onExit }: { onExit: () => void }) { return <StaticState title="Capture cleared." kicker="CAPTURE REVIEW" body="The temporary capture has been discarded. This build does not produce a visual observation until the approved quality and validation gates are complete." action="Back to SkinIA" onAction={onExit} />; }
function Unavailable({ onExit }: { onExit: () => void }) { return <StaticState title="No visual check available." kicker="UNKNOWN" body="AForce cannot make a reliable visual observation from this image. No image has been retained." action="Back to SkinIA" onAction={onExit} />; }
function StaticState({ title, kicker, body, action, onAction, secondary, onSecondary }: { title: string; kicker: string; body: string; action: string; onAction: () => void; secondary?: string; onSecondary?: () => void }) { const insets = useSafeAreaInsets(); return <View style={styles.staticScreen}><View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}><View style={styles.furniture}><Text style={styles.wordmark}>AFORCE</Text><Text style={styles.date}>CONTROLLED TESTFLIGHT</Text></View><Text style={styles.kicker}>SKINIA VISUAL CHECK / {kicker}</Text><Text style={styles.title}>{title}</Text><Text style={styles.body}>{body}</Text><Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onAction} style={styles.action}><Text style={styles.actionLabel}>{action}</Text><Text style={styles.actionPlus}>+</Text></Pressable>{secondary && onSecondary ? <Pressable accessibilityRole="button" accessibilityLabel={secondary} onPress={onSecondary} style={styles.cancel}><Text style={styles.cancelText}>{secondary}</Text></Pressable> : null}<Text style={styles.disclosure}>Visual observations only. SkinIA does not diagnose conditions or measure hydration.</Text><View style={styles.footer}><View style={styles.rule} /><View style={styles.footerRow}><Text style={styles.footerText}>AFORCE OS</Text><Text style={styles.footerText}>02 / SCAN</Text></View></View></View></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: edStock.black }, staticScreen: { flex: 1, backgroundColor: edStock.black }, scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(13, 13, 13, 0.56)' }, content: { flex: 1, paddingHorizontal: 32 },
  furniture: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, wordmark: { ...edType.caption, color: edAccent.red, fontWeight: '700' }, date: { ...edType.micro, color: edInk.quietOnBlack }, kicker: { ...edType.micro, color: edAccent.red, marginTop: 42 }, title: { ...edType.statement, color: edInk.ivory, marginTop: 14 }, body: { ...edType.bodySmall, color: edInk.quietOnBlack, marginTop: 10 },
  viewfinder: { alignSelf: 'center', backgroundColor: 'rgba(13, 13, 13, 0.68)', borderRadius: 18, height: 230, marginTop: 30, overflow: 'hidden', width: '100%' }, corner: { borderColor: edAccent.red, height: 28, position: 'absolute', width: 28 }, topLeft: { borderLeftWidth: 2, borderTopWidth: 2, left: 22, top: 22 }, topRight: { borderRightWidth: 2, borderTopWidth: 2, right: 22, top: 22 }, bottomLeft: { borderBottomWidth: 2, borderLeftWidth: 2, bottom: 44, left: 22 }, bottomRight: { borderBottomWidth: 2, borderRightWidth: 2, bottom: 44, right: 22 }, guide: { ...edType.micro, bottom: 20, color: edInk.quietOnBlack, left: 22, position: 'absolute' },
  meta: { borderBottomColor: edRule.onBlack, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, paddingBottom: 16 }, metaLabel: { ...edType.bodySmall, color: edInk.ivory, fontWeight: '700' }, metaValue: { ...edType.micro, color: edAccent.red }, action: { alignItems: 'center', backgroundColor: edStock.paper, flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, minHeight: 48, paddingHorizontal: 16 }, actionLabel: { ...edType.bodySmall, color: edInk.black, fontWeight: '700' }, actionPlus: { color: edAccent.red, fontSize: 20, lineHeight: 22 }, disabled: { opacity: 0.56 }, pressed: { opacity: 0.75 }, cancel: { marginTop: 12, paddingVertical: 10 }, cancelText: { ...edType.bodySmall, color: edInk.quietOnBlack, textDecorationLine: 'underline' }, disclosure: { ...edType.micro, color: edInk.quietOnBlack, marginTop: 10 }, footer: { flex: 1, justifyContent: 'flex-end', paddingTop: 40 }, rule: { backgroundColor: edRule.onBlack, height: StyleSheet.hairlineWidth }, footerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12 }, footerText: { ...edType.micro, color: edInk.quietOnBlack },
});
