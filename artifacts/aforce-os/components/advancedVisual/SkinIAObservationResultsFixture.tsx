import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { edAccent, edInk, edRule, edStock, edType } from '@/theme/editorialTokens';

/**
 * Development-only presentation fixture. This is deliberately not connected
 * to a route, camera, image, model, storage, analytics, or member data.
 * It demonstrates only the approved language for a future, validated result.
 */
export type SkinIAVisibleObservation =
  | 'VISIBLE_DRYNESS'
  | 'VISIBLE_FLAKING'
  | 'VISIBLE_REDNESS'
  | 'VISIBLE_SURFACE_SHINE'
  | 'VISIBLE_TEXTURE';

export type SkinIAComparison = 'MORE' | 'LESS' | 'SIMILAR';

export interface SkinIAObservationFixture {
  readonly kind: 'STATIC_TEST_FIXTURE';
  readonly observations: readonly {
    readonly observation: SkinIAVisibleObservation;
    readonly comparison: SkinIAComparison;
  }[];
}

export const skinIAObservationResultsFixture: SkinIAObservationFixture = {
  kind: 'STATIC_TEST_FIXTURE',
  observations: [
    { observation: 'VISIBLE_DRYNESS', comparison: 'SIMILAR' },
    { observation: 'VISIBLE_SURFACE_SHINE', comparison: 'LESS' },
    { observation: 'VISIBLE_TEXTURE', comparison: 'SIMILAR' },
  ],
};

const labels: Record<SkinIAVisibleObservation, string> = {
  VISIBLE_DRYNESS: 'Visible dryness',
  VISIBLE_FLAKING: 'Visible flaking',
  VISIBLE_REDNESS: 'Visible redness',
  VISIBLE_SURFACE_SHINE: 'Visible surface shine',
  VISIBLE_TEXTURE: 'Visible texture',
};

const comparisonLabels: Record<SkinIAComparison, string> = {
  MORE: 'More',
  LESS: 'Less',
  SIMILAR: 'Similar',
};

/**
 * Internal review surface only. A future product route may use a separately
 * approved, validated data source; it must never render this fixture as a
 * member result.
 */
export function SkinIAObservationResultsFixture({
  fixture = skinIAObservationResultsFixture,
}: {
  fixture?: SkinIAObservationFixture;
}) {
  return (
    <View style={styles.screen} accessibilityLabel="SkinIA observation results fixture">
      <View style={styles.content}>
        <View style={styles.furniture}>
          <Text style={styles.wordmark}>AFORCE</Text>
          <Text style={styles.fixtureLabel}>INTERNAL FIXTURE / NOT A MEMBER RESULT</Text>
        </View>
        <Text style={styles.kicker}>SKINIA VISUAL CHECK</Text>
        <Text style={styles.title}>Compared with{`\n`}your baseline</Text>
        <View style={styles.results}>
          {fixture.observations.map(({ observation, comparison }) => (
            <View key={observation} style={styles.resultRow}>
              <Text style={styles.observation}>{labels[observation]}</Text>
              <Text style={styles.comparison}>{comparisonLabels[comparison]}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.disclosure}>Visual observations only. SkinIA does not diagnose conditions or measure hydration.</Text>
        <View style={styles.footer}>
          <View style={styles.rule} />
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>AFORCE OS</Text>
            <Text style={styles.footerText}>{fixture.kind}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: edStock.black },
  content: { flex: 1, paddingHorizontal: 32, paddingTop: 36, paddingBottom: 28 },
  furniture: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wordmark: { ...edType.caption, color: edAccent.red, fontWeight: '700' },
  fixtureLabel: { ...edType.micro, color: edInk.quietOnBlack, maxWidth: 170, textAlign: 'right' },
  kicker: { ...edType.micro, color: edAccent.red, marginTop: 46 },
  title: { ...edType.statement, color: edInk.ivory, marginTop: 14 },
  results: { borderTopColor: edRule.onBlack, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 38 },
  resultRow: { alignItems: 'center', borderBottomColor: edRule.onBlack, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 72 },
  observation: { ...edType.bodySmall, color: edInk.ivory },
  comparison: { ...edType.bodySmall, color: edAccent.red, fontWeight: '700' },
  disclosure: { ...edType.micro, color: edInk.quietOnBlack, marginTop: 20 },
  footer: { flex: 1, justifyContent: 'flex-end', paddingTop: 44 },
  rule: { backgroundColor: edRule.onBlack, height: StyleSheet.hairlineWidth },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12 },
  footerText: { ...edType.micro, color: edInk.quietOnBlack },
});
