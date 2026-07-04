/**
 * Section 58 — Command Confidence Display™.
 *
 * Presentational badge that surfaces the ALREADY-COMPUTED Command Confidence™
 * level (how grounded a recommendation is, given its real/fresh data). It does
 * NO calculation and never touches the score — the level is derived by the
 * scoring engine (`utils/scoringEngine.ts`, off-limits) and passed in here.
 *
 * The monochrome opacity ramp is deliberate: confidence must read as "how sure
 * the system is" without colliding with the status-color band
 * (`theme/statusColor.ts`) or the urgency palette. Extracted from AICommandCard
 * so every surface renders it identically (Today's Command, HydroScan
 * Performance Fit, Recovery Window, Sun Recovery Mode).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { CommandConfidenceLevel } from '../types';
import { Colors } from '../theme/colors';
import i18n from '../services/i18nService';
import { CONFIDENCE_LABEL_KEYS, CONFIDENCE_OPACITY } from '../utils/commandConfidenceDisplay';

interface Props {
  /** The already-computed confidence level. Renders nothing when absent. */
  level: CommandConfidenceLevel | null | undefined;
}

/**
 * Renders the confidence chip, or nothing when no level is available (no
 * fabricated "confident" state — absent data shows absent, per Score-Protection
 * and the no-fabrication discipline in commandConfidence.ts).
 */
export function CommandConfidenceBadge({ level }: Props) {
  if (!level) return null;
  const label = i18n.t(CONFIDENCE_LABEL_KEYS[level]);
  const opacity = CONFIDENCE_OPACITY[level];
  return (
    <View style={styles.row} accessibilityLabel={label}>
      <View style={[styles.dot, { opacity }]} />
      <Text style={[styles.label, { opacity }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 5,
    backgroundColor: Colors.text.secondary,
  },
  label: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.secondary,
    letterSpacing: 1.2,
  },
});
