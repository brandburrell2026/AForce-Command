/**
 * AFStatPair — a numeral + label composed as ONE screen-reader announcement
 * (RC-1 Wave-5, a11y-breadth item 1).
 *
 * The RC-1 audit found ~18 hand-rolled "numeral + label" call sites
 * (RecoveryCapacityCard's Breakdown, StreakCard's
 * day count, KPISummary, ScanResultCard,
 * ProfileScreenV2/ProfileLegacy's SnapshotCell, ...) each rendering two
 * separate, unlinked `<Text>` nodes. VoiceOver/TalkBack reads them as two
 * disconnected swipes (or skips them outright when neither carries an
 * accessibilityLabel) instead of one "label, value" statement — mirrors the
 * fix already shipped for money in `AFPrice` (see its doc-comment).
 *
 * Presentation-only, like AFPrice/AFMetric: value/label arrive pre-formatted,
 * nothing here computes or fetches. Every text node accepts a style override
 * so an existing bespoke card (custom font sizes/colors baked into its own
 * StyleSheet) can adopt the primitive with the visual output byte-identical —
 * only the accessibility tree and the numeral's font-scale ceiling change.
 * Sites that cannot adopt without a visual redesign (3+ fused elements, e.g.
 * an icon fused into the same announcement) are left as a documented skip
 * rather than forced into this primitive.
 */
import React from 'react';
import { View, Text, StyleSheet, type TextStyle, type ViewStyle, type StyleProp } from 'react-native';
import { af, afType, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';

export interface AFStatPairProps {
  label: string;
  value: string | number;
  /** Optional trailing unit/qualifier rendered next to the value in a muted
   *  style (e.g. "/100", "%", or a band word like "STABLE"). */
  unit?: string;
  /**
   * 'inline' (default) nests the unit inside the value's own Text run —
   * tight, no gap — for a suffix like "/ 60" or "%". 'adjacent' renders the
   * unit as a sibling Text in its own row with `valueGroupStyle`'s gap
   * (mirrors AFMetric's value+unit row) — for a distinct second data point
   * like a band word ("78" + "STABLE").
   */
  unitLayout?: 'inline' | 'adjacent';
  /** Flex direction of the pair. 'row' = label/value on one line;
   *  'column' = value stacked over (or under) label. Default 'row'. */
  direction?: 'row' | 'column';
  /** Element order within the direction. false (default) = label then
   *  value (e.g. "WATER … 82oz"); true = value then label (e.g.
   *  "34  DAY STREAK"). */
  reverseOrder?: boolean;
  valueStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
  unitStyle?: StyleProp<TextStyle>;
  /** Style for the value+unit row wrapper — only used when unitLayout='adjacent'. */
  valueGroupStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  /** Overrides the composed announcement entirely; defaults to
   *  "label, value unit". */
  accessibilityLabel?: string;
  testID?: string;
}

export function AFStatPair({
  label,
  value,
  unit,
  unitLayout = 'inline',
  direction = 'row',
  reverseOrder = false,
  valueStyle,
  labelStyle,
  unitStyle,
  valueGroupStyle,
  style,
  accessibilityLabel,
  testID,
}: AFStatPairProps) {
  const composed =
    accessibilityLabel ?? `${label}, ${value}${unit ? ` ${unit}` : ''}`;

  const numeral = (
    <Text
      style={[styles.value, valueStyle]}
      allowFontScaling
      maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
    >
      {value}
      {unit && unitLayout === 'inline' ? (
        <Text style={[styles.unit, unitStyle]}> {unit}</Text>
      ) : null}
    </Text>
  );

  const valueNode =
    unit && unitLayout === 'adjacent' ? (
      <View key="value" style={[styles.valueGroup, valueGroupStyle]}>
        {numeral}
        <Text style={[styles.unit, unitStyle]}>{unit}</Text>
      </View>
    ) : (
      <React.Fragment key="value">{numeral}</React.Fragment>
    );
  const labelNode = (
    <Text key="label" style={[styles.label, labelStyle]}>
      {label}
    </Text>
  );

  const children = reverseOrder ? [valueNode, labelNode] : [labelNode, valueNode];

  return (
    <View
      style={[direction === 'column' ? styles.column : styles.row, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={composed}
      testID={testID}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  column: { flexDirection: 'column', alignItems: 'flex-start' },
  valueGroup: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  value: {
    fontFamily: afType.title3.fontFamily,
    fontSize: afType.title3.fontSize,
    color: af.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontFamily: afType.secondary.fontFamily,
    fontSize: afType.secondary.fontSize,
    color: af.textTertiary,
  },
  label: {
    fontFamily: afType.eyebrow.fontFamily,
    fontSize: afType.eyebrow.fontSize,
    color: af.textTertiary,
  },
});
