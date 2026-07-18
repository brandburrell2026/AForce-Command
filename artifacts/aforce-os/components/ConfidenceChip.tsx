/**
 * ConfidenceChip — the shared monochrome confidence primitive for the Show-10
 * layer. A small dot + caps micro-label, differentiated by OPACITY only, so it
 * reads as "how sure / how current / how complete" without colliding with the
 * status-color band or urgency palette. One grammar across §53/§54/§55/§58.
 *
 * This generalizes §58's `CommandConfidenceBadge` (identical dot+label styling);
 * that badge should migrate to render THROUGH this primitive so there is one
 * chip, not two — deferred as its own follow-up because the badge feeds three
 * live surfaces (Today's Command, HydroScan Fit, Social) and that de-dup wants a
 * visual pass, not a blind refactor. Tracked separately.
 *
 * Copy-independence (docs/design/show10-confidence-surface.md): `label` (a
 * structural caps token) + `opacity` are the whole chip. `explain` is OPTIONAL,
 * additive, and self-sizing — the chip is complete and intentional with it
 * absent (the default state), and no layout reserves space for it. Presentational
 * only; never a score or a claim. The label token ships regardless of CR-1; any
 * explanatory sentence passed as `explain` is CR-1-pending.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

interface Props {
  /** Structural rating token, already uppercased (e.g. 'RICH', 'EXCELLENT'). */
  label: string;
  /** Monochrome dot + label opacity (0..1). Higher = more real / current data. */
  opacity: number;
  /** Optional explanatory line (CR-1-pending copy). Absent = a valid finished state. */
  explain?: string;
}

export function ConfidenceChip({ label, opacity, explain }: Props) {
  return (
    <View accessibilityLabel={label}>
      <View style={styles.row}>
        <View style={[styles.dot, { opacity }]} />
        <Text style={[styles.label, { opacity }]}>{label}</Text>
      </View>
      {explain ? <Text style={styles.explain}>{explain}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // dot + label match CommandConfidenceBadge exactly (the primitive it generalizes).
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 5, backgroundColor: Colors.text.secondary },
  label: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: Colors.text.secondary, letterSpacing: 1.2 },
  // Explanatory copy: quiet body text, self-sizing, no reserved space when absent.
  explain: { marginTop: 4, fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.text.muted, lineHeight: 16 },
});
