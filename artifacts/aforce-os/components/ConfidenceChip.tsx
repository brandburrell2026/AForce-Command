/**
 * ConfidenceChip — the shared monochrome confidence primitive for the Show-10
 * layer. A small dot + caps micro-label, differentiated by OPACITY only, so it
 * reads as "how sure / how current / how complete" without colliding with the
 * status-color band or urgency palette. One grammar across §53/§54/§55/§58.
 *
 * This generalizes §58's `CommandConfidenceBadge` (identical dot+label styling);
 * that badge now renders THROUGH this primitive, so there is one chip, not two.
 * The badge stays the §58-specific adapter (it owns the level→label/opacity
 * mapping) and delegates the actual dot+label render here. The badge-alone path
 * below is deliberately a single row node so the migration is visually a no-op at
 * the badge's live call sites (HydroScan Fit, Social, Cruise).
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
  /**
   * a11y-ONLY noun appended to the spoken label, never rendered visually. The
   * rating tokens are bare words ('SPARSE', 'LIMITED', 'BUILDING') — spoken alone
   * to a screen-reader user who can't see the dot, they lack the noun that gives
   * them meaning. Pass the vocabulary's noun (e.g. 'confidence', 'profile
   * completeness', 'signal quality') so it reads 'SPARSE profile completeness'.
   * Structural, not a claim — ships regardless of CR-1.
   */
  a11yContext?: string;
}

export function ConfidenceChip({ label, opacity, explain, a11yContext }: Props) {
  // `accessible` collapses the chip to ONE a11y node (no double-read of the
  // label between the container and the <Text>). The composed a11y label folds
  // in the a11y context noun and the explanatory line when present. The VISIBLE
  // label is always just `label` — a11yContext is spoken-only.
  const spokenLabel = a11yContext ? `${label} ${a11yContext}` : label;

  // Badge-alone (the default, no `explain`): the chip IS the row — a single node,
  // no wrapper box. This keeps it structurally identical to CommandConfidenceBadge
  // (the §58 primitive this generalizes, which renders THROUGH this) so migrating
  // the badge adds zero layout at its live call sites. A wrapper View would default
  // to column/stretch and could shift siblings; there is deliberately none here.
  if (!explain) {
    return (
      <View style={styles.row} accessible accessibilityLabel={spokenLabel}>
        <View style={[styles.dot, { opacity }]} />
        <Text style={[styles.label, { opacity }]}>{label}</Text>
      </View>
    );
  }

  // With copy: stack the row + explanatory line inside one accessible container.
  return (
    <View accessible accessibilityLabel={`${spokenLabel}. ${explain}`}>
      <View style={styles.row}>
        <View style={[styles.dot, { opacity }]} />
        <Text style={[styles.label, { opacity }]}>{label}</Text>
      </View>
      <Text style={styles.explain}>{explain}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // dot + label use a SOLID base color (text.primary), NOT the semi-transparent
  // text.secondary. The opacity ramp (1 / 0.78 / 0.55 / 0.30) is applied as the
  // element `opacity` at render; over a 0.55-alpha base it COMPOUNDED (0.55 × ramp),
  // dropping LIMITED/UNAVAILABLE to ~0.16–0.30 effective alpha — illegible once the
  // DATA BEHIND THIS sheet renders a full list of them. With a solid base the ramp
  // applies directly, so it now spans #FFFFFF → rgba(255,255,255,0.30) — and 0.30 is
  // exactly `text.muted`, the app's established floor for quiet-but-readable text.
  // The 1/0.78/0.55/0.30 gradient (spec §3) is preserved; only the base is solid.
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 5, backgroundColor: Colors.text.primary },
  label: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: Colors.text.primary, letterSpacing: 1.2 },
  // Explanatory copy: quiet body text, self-sizing, no reserved space when absent.
  explain: { marginTop: 4, fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.text.muted, lineHeight: 16 },
});
