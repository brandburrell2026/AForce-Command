/**
 * Shared AForce cinematic primitives for the hidden Cruise screens.
 *
 * Pure layout — no engine, no data. Sections are visual placeholders
 * that later rules will fill with real content. Keeping these
 * primitives local to the hidden group prevents them from leaking
 * into the visible app surface.
 *
 * Black Issue (PR 3, 2026-10-07): re-pointed from raw white-alpha literals
 * to the `af.*` tokens and the AF* primitives — AFMasthead for the head,
 * AFSectionLabel + hairline rows for the sections. The props are unchanged.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { AFMasthead } from '@/components/ui/AFMasthead';
import { AFSectionLabel } from '@/components/ui/AFSectionLabel';
import { useAFGutter } from '@/hooks/useAFGutter';
import { af, afType, afLayout, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { useAFEyebrowType } from '@/hooks/useAFEyebrowType';

interface ScreenProps {
  eyebrow: string;
  title: string;
  hero?: { value: string; unit?: string; caption?: string };
  children: React.ReactNode;
}

export function CruiseScreen({ eyebrow, title, hero, children }: ScreenProps) {
  const gutter = useAFGutter();
  const eyebrowType = useAFEyebrowType();
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, { paddingHorizontal: gutter }]}
      showsVerticalScrollIndicator={false}>
      <AFMasthead breadcrumb={eyebrow} title={title} />

      {hero ? (
        <View style={styles.heroBlock}>
          <View style={styles.heroRow}>
            <Text style={styles.heroValue} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
              {hero.value}
            </Text>
            {hero.unit ? <Text style={[styles.heroUnit, eyebrowType]}>{hero.unit.toUpperCase()}</Text> : null}
          </View>
          {hero.caption ? <Text style={styles.heroCaption}>{hero.caption}</Text> : null}
        </View>
      ) : null}

      <View style={styles.body}>{children}</View>
    </ScrollView>
  );
}

interface SectionProps {
  label: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Section({ label, children, style }: SectionProps) {
  return (
    <View style={[styles.section, style]}>
      <AFSectionLabel label={label} />
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

interface RowProps {
  label: string;
  value: string;
  emphasis?: boolean;
}

export function Row({ label, value, emphasis }: RowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, emphasis && styles.rowValueEmphasis]}>{value}</Text>
    </View>
  );
}

export function Placeholder({ children }: { children: string }) {
  return <Text style={styles.placeholder}>{children}</Text>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: af.canvas },
  scrollContent: { paddingTop: 64, paddingBottom: 80 },

  heroBlock: { marginTop: 24, marginBottom: 8 },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8 },
  heroValue: { ...afType.displayScore, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  heroUnit: { ...afType.eyebrow, color: af.textTertiary },
  heroCaption: { ...afType.caption, color: af.textTertiary, marginTop: 8 },

  body: { gap: 28, marginTop: 24 },

  section: {},
  sectionBody: { marginTop: 4 },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: 12,
    paddingVertical: 8,
    minHeight: 48,
    borderBottomWidth: afLayout.hairline,
    borderBottomColor: af.divider,
  },
  rowLabel: { ...afType.secondary, color: af.textSecondary, flexShrink: 1 },
  rowValue: { ...afType.secondary, color: af.textPrimary, fontVariant: ['tabular-nums'], flexShrink: 1, textAlign: 'right' },
  rowValueEmphasis: { color: af.redText, fontFamily: afType.bodyStrong.fontFamily },

  placeholder: { ...afType.secondary, color: af.textSecondary, paddingTop: 10 },
});
