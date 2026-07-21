/**
 * AFProductCard — a product/SKU card for the storefront (spec §5, Phase 3).
 * Composes AFCard; the price slot takes an <AFPrice/> (or any node) so pricing
 * stays presentation-only. Selectable (subscribe/bundle) via `selected`.
 */
import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  type ImageSourcePropType,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { af, afType } from '@/theme';
import { AFCard } from './AFCard';

export interface AFProductCardProps {
  title: string;
  subtitle?: string;
  image?: ImageSourcePropType;
  /** Pass an <AFPrice/> element. */
  price?: React.ReactNode;
  /** Small eyebrow badge, e.g. "SUBSCRIBE & SAVE". */
  badge?: string;
  selected?: boolean;
  onPress?: () => void;
  /** Extra content / CTA row rendered below. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function AFProductCard({
  title,
  subtitle,
  image,
  price,
  badge,
  selected,
  onPress,
  children,
  style,
  testID,
}: AFProductCardProps) {
  return (
    <AFCard
      variant={selected ? 'raised' : 'standard'}
      onPress={onPress}
      accessibilityLabel={title}
      style={[selected && styles.selected, style]}
      testID={testID}
    >
      {badge && <Text style={styles.badge}>{badge.toUpperCase()}</Text>}
      <View style={styles.top}>
        {image && <Image source={image} style={styles.image} resizeMode="contain" />}
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          )}
          {price}
        </View>
      </View>
      {children}
    </AFCard>
  );
}

const styles = StyleSheet.create({
  selected: { borderColor: af.red },
  badge: { ...afType.eyebrow, color: af.red, marginBottom: 8 },
  top: { flexDirection: 'row', gap: 14 },
  image: { width: 64, height: 64, borderRadius: 12 },
  body: { flex: 1, gap: 4 },
  title: { ...afType.bodyStrong, color: af.textPrimary },
  subtitle: { ...afType.caption, color: af.textTertiary },
});
