/**
 * LegalDocumentScreen — shared chrome for all `/legal/*` routes.
 *
 * One layout, one back button, one scroll container so every legal
 * document (Terms, Privacy, Health Disclaimer) reads the same way.
 *
 * Callers pass:
 *   - eyebrow   : the tracked all-caps category, e.g. "LEGAL"
 *   - title     : the document title, e.g. "Terms of Service"
 *   - updatedAt : human-readable revision date, e.g. "May 2026"
 *   - sections  : ordered list of { heading, body } blocks
 *
 * Tone: clean and minimal, no scare-tactic boxes. The brand voice is
 * performance / recovery / wellness — never medical / diagnostic.
 */

import { af } from '@/theme';
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { Icon } from '@/components/Icon';
import { GradientBackground } from '@/components/GradientBackground';
import { WEB_TOP_PADDING, WEB_BOTTOM_PADDING } from '@/constants/layout';

export interface LegalSection {
  heading: string;
  body: string;
}

interface Props {
  eyebrow: string;
  title: string;
  updatedAt: string;
  intro?: string;
  sections: LegalSection[];
  /** Optional footer line shown after the last section, e.g. contact line. */
  footer?: string;
}

export function LegalDocumentScreenV2({
  eyebrow,
  title,
  updatedAt,
  intro,
  sections,
  footer,
}: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? WEB_TOP_PADDING : insets.top + 12;
  const bottomPad = Platform.OS === 'web' ? WEB_BOTTOM_PADDING : insets.bottom + 32;

  return (
    <GradientBackground>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t('legal.v2.back_a11y')}
            testID="legal-back"
          >
            <Icon name="chevron-left" size={20} color={af.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
        </View>

        <Text style={styles.meta}>{t('legal.v2.updated', { date: updatedAt })}</Text>

        {intro && <Text style={styles.intro}>{intro}</Text>}

        {sections.map((s) => (
          <View key={s.heading} style={styles.section}>
            <Text style={styles.sectionHeading}>{s.heading}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}

        {footer && <Text style={styles.footer}>{footer}</Text>}
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: af.canvas },
  content: { paddingHorizontal: 20 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: af.surface,
    borderWidth: 1,
    borderColor: af.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: af.textTertiary,
    letterSpacing: 2.5,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: af.textPrimary,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  meta: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: af.textTertiary,
    letterSpacing: 0.4,
    marginTop: 6,
    marginBottom: 18,
  },
  intro: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: af.textSecondary,
    lineHeight: 21,
    marginBottom: 22,
  },
  section: {
    marginBottom: 22,
  },
  sectionHeading: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: af.textPrimary,
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: af.textSecondary,
    lineHeight: 20,
  },
  footer: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: af.textTertiary,
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 24,
  },
});
