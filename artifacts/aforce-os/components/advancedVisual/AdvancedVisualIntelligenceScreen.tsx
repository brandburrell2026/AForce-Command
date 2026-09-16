import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientBackground } from '@/components/GradientBackground';
import { af } from '@/theme';
import {
  ADVANCED_VISUAL_INTELLIGENCE_NAME,
  SKINIA_MEMBER_LABEL,
  unavailableVisualCheckResult,
} from '@/services/advancedVisualIntelligence';

/**
 * Containment-only presentation. Do not add capture affordances or permission
 * requests here: the screen explains the future capability while it remains
 * unavailable pending founder and legal approval.
 */
export function AdvancedVisualIntelligenceScreen() {
  const insets = useSafeAreaInsets();
  const result = unavailableVisualCheckResult();

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
        accessibilityLabel={SKINIA_MEMBER_LABEL}
      >
        <Text style={styles.eyebrow}>{ADVANCED_VISUAL_INTELLIGENCE_NAME}</Text>
        <Text style={styles.title}>{SKINIA_MEMBER_LABEL}</Text>
        <Text style={styles.body}>
          A future opt-in visual check. It is not active in this build and does not access your camera, photos, or health data.
        </Text>

        <View style={styles.card} accessibilityRole="summary" accessibilityLabel="Visual check availability">
          <Text style={styles.cardLabel}>CURRENT STATUS</Text>
          <Text style={styles.unknown}>{result.status}</Text>
          <Text style={styles.cardBody}>
            No visual check has been performed. No image was captured, processed, stored, uploaded, or compared.
          </Text>
        </View>

        <View style={styles.card} accessibilityRole="summary" accessibilityLabel="Permission information">
          <Text style={styles.cardLabel}>CAMERA PERMISSION</Text>
          <Text style={styles.cardBody}>
            If this capability is approved in a future release, you will see a clear explanation and can choose whether to grant camera permission. This screen will never ask for it.
          </Text>
        </View>

        <Text style={styles.footnote}>
          Observation only. Never diagnoses. Availability requires founder and legal approval.
        </Text>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, gap: 16 },
  eyebrow: { color: af.textTertiary, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  title: { color: af.textPrimary, fontSize: 34, fontWeight: '700', letterSpacing: -0.7 },
  body: { color: af.textSecondary, fontSize: 16, lineHeight: 24 },
  card: { backgroundColor: af.surface, borderColor: af.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 18, gap: 9 },
  cardLabel: { color: af.textTertiary, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  unknown: { color: af.textPrimary, fontSize: 22, fontWeight: '700', letterSpacing: 0.8 },
  cardBody: { color: af.textSecondary, fontSize: 15, lineHeight: 22 },
  footnote: { color: af.textTertiary, fontSize: 13, lineHeight: 19, paddingTop: 4 },
});
