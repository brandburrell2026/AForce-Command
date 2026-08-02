/**
 * NO-c native-evidence enabler — internal evidence control.
 *
 * Renders NOTHING unless `isInternalEvidenceBuild()` (fail closed). In an authorized
 * internal build it lets an operator enable Night Out via the SANCTIONED service
 * (never a direct `setFeatureFlags`/flag mutation), verifies access through the
 * normal Night Out access function before offering navigation, and offers a
 * sanctioned reset. It never bypasses or replaces the `/night-out` route guard.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { af, afType } from '@/theme';
import { useAppStore } from '@/store/useAppStore';
import { DEMO_MODE } from '@/services/demoMode';
import { isInternalEvidenceBuild } from './internalGate';
import { readInternalBuildInputs } from './buildInputs';
import { enableEvidenceMode, disableEvidenceMode, evidenceAccessGranted } from './evidenceModeService';

const NIGHT_OUT_HREF = '/night-out' as unknown as Href;

export function NightOutEvidenceModeControl() {
  const router = useRouter();
  const { state, setFeatureFlags } = useAppStore();
  const flags = state.featureFlags;
  const [, force] = React.useReducer((n: number) => n + 1, 0);

  const build = readInternalBuildInputs();
  if (!isInternalEvidenceBuild(build)) return null; // fail closed — never in production

  const granted = evidenceAccessGranted(flags, DEMO_MODE);

  // Evaluated safeguards (non-secret booleans only).
  const checks: Array<[string, boolean]> = [
    ['Internal app variant', build.appVariant === 'internal'],
    ['Internal-preview marker', build.internalPreview === 'true'],
    ['Demo mode', build.demoMode === true],
    ['Non-production bundle id', build.applicationId !== 'com.aforce.os'],
    ['Sanctioned access granted', granted],
  ];

  const onEnable = () => {
    enableEvidenceMode({ flags, setFeatureFlags, build });
    force();
  };
  const onReset = () => {
    disableEvidenceMode({ flags, setFeatureFlags, build });
    force();
  };

  return (
    <View style={styles.wrap} testID="night-out-evidence-control">
      <View style={styles.warnBanner}>
        <Text style={styles.warnText}>INTERNAL BUILD — NOT FOR PRODUCTION</Text>
      </View>
      <Text style={styles.title} accessibilityRole="header">Internal Preview → Enable Night Out Evidence Mode</Text>

      <View style={styles.checks}>
        {checks.map(([label, ok]) => (
          <View key={label} style={styles.checkRow} accessible accessibilityLabel={`${label}: ${ok ? 'yes' : 'no'}`}>
            <Text style={styles.checkLabel}>{label}</Text>
            <Text style={[styles.checkVal, { color: ok ? af.green : af.textTertiary }]}>{ok ? 'PASS' : '—'}</Text>
          </View>
        ))}
      </View>

      <Pressable onPress={onEnable} style={[styles.cta, { backgroundColor: af.cyan }]} accessibilityRole="button" accessibilityLabel="Enable Night Out evidence mode" testID="evidence-enable">
        <Text style={styles.ctaText}>ENABLE NIGHT OUT EVIDENCE MODE</Text>
      </Pressable>

      {granted && (
        <Pressable onPress={() => router.push(NIGHT_OUT_HREF)} style={styles.secondary} accessibilityRole="button" accessibilityLabel="Open Night Out" testID="evidence-open">
          <Text style={styles.secondaryText}>Open Night Out →</Text>
        </Pressable>
      )}

      <Pressable onPress={onReset} style={styles.secondary} accessibilityRole="button" accessibilityLabel="Disable Night Out evidence mode" testID="evidence-reset">
        <Text style={styles.secondaryText}>Disable / Reset</Text>
      </Pressable>

      <Text style={styles.foot}>Status: {granted ? 'Authorized ✓' : 'Not authorized'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, padding: 4 },
  warnBanner: { backgroundColor: af.redDim, borderColor: af.red, borderWidth: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  warnText: { ...afType.eyebrow, color: af.redText },
  title: { ...afType.title3, color: af.textPrimary },
  checks: { gap: 6, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: af.border, backgroundColor: af.surface },
  checkRow: { flexDirection: 'row', justifyContent: 'space-between' },
  checkLabel: { ...afType.secondary, color: af.textSecondary },
  checkVal: { ...afType.caption },
  cta: { paddingVertical: 16, borderRadius: 16, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  ctaText: { ...afType.bodyStrong, color: af.canvas, letterSpacing: 1 },
  secondary: { paddingVertical: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: af.border },
  secondaryText: { ...afType.secondary, color: af.textSecondary },
  foot: { ...afType.caption, color: af.textTertiary, textAlign: 'center' },
});
