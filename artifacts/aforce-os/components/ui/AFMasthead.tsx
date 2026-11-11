/**
 * AFMasthead — the Black Issue screen head (2026-10-06, founder decision D5).
 * The one pattern on all 27 reference screens:
 *
 *   AFORCE                              NEW YORK · 72°F     ← wordmark + meta
 *   (‹) CRUISE MODE / SEA DAY                               ← red breadcrumb
 *   Cruise Mode.                                            ← statement
 *   Hydration intelligence for life at sea.                 ← one quiet line
 *
 * Presentation-only: every string arrives formatted from the screen's own
 * data sources (city/temp from the weather source, dates from the clock);
 * the masthead never invents or defaults a value — an absent `meta` simply
 * renders nothing on the right. Built on the same tokens as AFTopBar and
 * AFSectionLabel so nothing is duplicated; AFTopBar remains the plain title
 * bar for sheets and sub-screens that do not carry the wordmark.
 *
 * Accessibility: the wordmark is decorative (hidden from the reader — the
 * statement is the screen's header); the breadcrumb + meta are read as plain
 * text; the back control is a 36pt ring with hitSlop to a 52pt target.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Icon } from '../Icon';
import { af, afType, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { useAFEyebrowType } from '@/hooks/useAFEyebrowType';

export interface AFMastheadProps {
  /** Red mono breadcrumb, e.g. "HOME / HYDROSTATE". Rendered uppercase. */
  breadcrumb?: string;
  /** The screen statement — Inter 700, sentence case ("Recovering."). */
  title?: string;
  /** One quiet line under the statement. */
  subtitle?: string;
  /** Right-aligned mono meta on the wordmark row ("NEW YORK · 72°F"). */
  meta?: string;
  /** Second mono meta line under the first ("SAT · AUG 29 · 9:41 AM"). */
  metaSecondary?: string;
  /** Quiet line under the wordmark ("Welcome Julius"). */
  greeting?: string;
  /** Back control on the breadcrumb row (detail screens only). */
  onBack?: () => void;
  /** Already-translated label for the back control. */
  backLabel?: string;
  /** Hide the wordmark row (for screens that render it elsewhere). */
  wordmark?: boolean;
  testID?: string;
}

export const AF_WORDMARK = 'AFORCE';

export function AFMasthead({
  breadcrumb,
  title,
  subtitle,
  meta,
  metaSecondary,
  greeting,
  onBack,
  backLabel = 'Back',
  wordmark = true,
  testID,
}: AFMastheadProps) {
  const eyebrowType = useAFEyebrowType();
  return (
    <View style={styles.wrap} testID={testID}>
      {wordmark && (
        <View style={styles.wordmarkRow}>
          <View style={styles.wordmarkGroup}>
            <Text style={styles.wordmark} aria-hidden>
              {AF_WORDMARK}
            </Text>
            {greeting ? <Text style={styles.greeting}>{greeting}</Text> : null}
          </View>
          {(meta || metaSecondary) && (
            <View style={styles.metaGroup}>
              {meta ? <Text style={[styles.meta, eyebrowType]}>{meta.toUpperCase()}</Text> : null}
              {metaSecondary ? (
                <Text style={[styles.meta, eyebrowType]}>{metaSecondary.toUpperCase()}</Text>
              ) : null}
            </View>
          )}
        </View>
      )}

      {(breadcrumb || onBack) && (
        <View style={styles.breadcrumbRow}>
          {onBack && (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={backLabel}
              hitSlop={8}
              style={({ pressed }) => [styles.backBtn, pressed && styles.backPressed]}
              testID={testID ? `${testID}-back` : undefined}
            >
              <Icon name="chevron-left" size={16} color={af.textPrimary} />
            </Pressable>
          )}
          {breadcrumb ? (
            <Text style={[styles.breadcrumb, eyebrowType]}>{breadcrumb.toUpperCase()}</Text>
          ) : null}
        </View>
      )}

      {title ? (
        <Text
          style={styles.title}
          accessibilityRole="header"
          maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
        >
          {title}
        </Text>
      ) : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  wordmarkGroup: { gap: 2, flexShrink: 1 },
  // The wordmark is a mark, not copy: 15pt Inter 700 in the AA red text
  // token (5.3:1 on the canvas); it is hidden from the screen reader.
  wordmark: { ...afType.bodyStrong, fontSize: 15, lineHeight: 20, letterSpacing: 0.4, color: af.redText },
  greeting: { ...afType.secondary, color: af.textSecondary },
  metaGroup: { alignItems: 'flex-end', gap: 4, flexShrink: 1 },
  meta: { ...afType.micro, color: af.textSecondary, textAlign: 'right' },
  breadcrumbRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  breadcrumb: { ...afType.eyebrow, color: af.redText, flexShrink: 1 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: af.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: { backgroundColor: af.surfacePressed },
  title: { ...afType.title1, color: af.textPrimary },
  subtitle: { ...afType.secondary, color: af.textSecondary, marginTop: 2 },
});
