/**
 * LocationInsightBanner — Location Intelligence™ "Show 10%" surface.
 *
 * The single visible home surface for the headless Location Intelligence
 * engine. Behind `location_intelligence_enabled` it surfaces ONE quiet,
 * Water-First line describing what the user's current environment
 * (altitude / UV / air quality / heat+humidity) means for hydration today,
 * resolved from the pure engine's `noteKey` via i18n.
 *
 * Self-hides (returns null) when:
 *   - the flag is OFF (hook is inert → no note),
 *   - the snapshot hasn't loaded yet,
 *   - or the environment isn't notable (noteKey === null).
 * So with the flag OFF the home surface is byte-identical to today.
 *
 * Travel is intentionally NOT surfaced here: a real location / time-zone
 * change already flips the Travel smart mode, which the SmartModesBanner
 * renders as the one-line Travel Protocol advisory. Keeping travel in one
 * place avoids a duplicate banner.
 *
 * Score-Protection: read-only projection of the pure engine's context.
 * It renders copy only — it never awards, mutates, or fabricates score.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { useLocationIntelligence } from '@/hooks/useLocationIntelligence';

export function LocationInsightBanner() {
  const { t } = useTranslation();
  const { enabled, context } = useLocationIntelligence();

  // Inert when the flag is off, the snapshot hasn't loaded, or the
  // environment isn't notable — byte-identical to pre-feature home.
  if (!enabled || !context.available || !context.noteKey) return null;

  const insight = t(`locationIntel.note.${context.noteKey}`);

  return (
    <View style={styles.wrap}>
      <View style={styles.card} testID="location-insight-banner">
        <Icon name="map-pin" size={14} color={Colors.accent.primary} />
        <Text style={styles.insight} numberOfLines={2}>
          {insight}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${Colors.accent.primary}40`,
    backgroundColor: `${Colors.accent.primary}10`,
  },
  insight: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary,
    letterSpacing: -0.1,
  },
});

export default LocationInsightBanner;
