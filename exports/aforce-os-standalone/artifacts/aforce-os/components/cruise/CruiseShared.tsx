/**
 * Shared WHOOP-cinematic primitives for the hidden Cruise screens.
 *
 * Pure layout — no engine, no data. Sections are visual placeholders
 * that later rules will fill with real content. Keeping these
 * primitives local to the hidden group prevents them from leaking
 * into the visible app surface.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Colors } from '@/theme/colors';
import { Spacing } from '@/theme/spacing';

const ACCENT = Colors.accent.primary;
const BORDER = 'rgba(255,255,255,0.04)';
const LABEL_DIM = 'rgba(255,255,255,0.50)';
const COPY_DIM = 'rgba(255,255,255,0.72)';

interface ScreenProps {
  eyebrow: string;
  title: string;
  hero?: { value: string; unit?: string; caption?: string };
  children: React.ReactNode;
}

export function CruiseScreen({ eyebrow, title, hero, children }: ScreenProps) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>

      {hero ? (
        <View style={styles.heroBlock}>
          <View style={styles.heroRow}>
            <Text style={styles.heroValue}>{hero.value}</Text>
            {hero.unit ? <Text style={styles.heroUnit}>{hero.unit}</Text> : null}
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
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionCard}>{children}</View>
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
  scroll: { flex: 1, backgroundColor: Colors.background.primary },
  scrollContent: { paddingHorizontal: Spacing[5], paddingTop: Spacing[16], paddingBottom: Spacing[20] },

  headerBlock: { marginBottom: Spacing[8] },
  eyebrow: {
    color: ACCENT,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: Spacing[2],
  },
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -0.5,
  },

  heroBlock: { marginBottom: Spacing[10] },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing[2] },
  heroValue: {
    color: '#FFFFFF',
    fontSize: 72,
    lineHeight: 76,
    fontWeight: '300',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: {
    color: LABEL_DIM,
    fontSize: 16,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  heroCaption: {
    color: LABEL_DIM,
    fontSize: 13,
    letterSpacing: 0.6,
    marginTop: Spacing[2],
  },

  body: { gap: Spacing[6] },

  section: {},
  sectionLabel: {
    color: LABEL_DIM,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: Spacing[3],
    paddingHorizontal: Spacing[1],
  },
  sectionCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: Spacing[5],
    gap: Spacing[3],
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing[2],
  },
  rowLabel: {
    color: LABEL_DIM,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  rowValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  rowValueEmphasis: { color: ACCENT, fontWeight: '700' },

  placeholder: {
    color: COPY_DIM,
    fontSize: 14,
    lineHeight: 20,
  },
});
