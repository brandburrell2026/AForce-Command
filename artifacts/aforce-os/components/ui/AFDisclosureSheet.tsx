/**
 * AFDisclosureSheet — a bottom sheet for "why this command", methodology, and
 * detail/legal context (spec §5). Native modal presentation, af.surfaceRaised,
 * a clear drag affordance, and a single close control (spec §3.5).
 *
 * Wave-5 Phase-1 accessibility pass closed two defects here. This is now the
 * ONE disclosure surface behind Performance Signal (day + week detail) and
 * Protocol's WHY, so both were on the critical path:
 *
 *  1. TOUCH TARGET — the close control was an 18pt icon with `hitSlop={12}`:
 *     42×42pt, under the 44pt floor. hitSlop is the right lever (it costs no
 *     layout, matching the Circle-tab / subscription-filter fixes); it just
 *     needed to be 14.
 *  2. FOCUS ORDER — the backdrop was an absolutely-filled Pressable labelled
 *     "Dismiss", declared BEFORE the panel, so a screen reader entering the
 *     sheet landed on a full-screen control instead of the sheet's title, and
 *     heard an untranslated English word while doing it. The backdrop is now
 *     hidden from assistive tech: tap-outside still dismisses for sighted
 *     members, the header's Close button is the reader's dismiss path, and
 *     `onRequestClose` still covers the Android back gesture. Nothing is lost
 *     and the sheet reads title-first.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from '../Icon';
import { af, afType, afLayout } from '@/theme';
import { AFModal } from './AFModal';

export interface AFDisclosureSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  testID?: string;
}

export function AFDisclosureSheet({ visible, onClose, title, children, testID }: AFDisclosureSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <AFModal visible={visible} transparent animationType="slide" onRequestClose={onClose} testID={testID}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View style={[styles.panel, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {/* 18pt glyph + 14pt hitSlop on every edge = a 46pt target. */}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            hitSlop={14}
          >
            <Icon name="x" size={18} color={af.textSecondary} />
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
      </View>
    </AFModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '80%',
    backgroundColor: af.surfaceRaised,
    borderTopLeftRadius: afLayout.radiusHero,
    borderTopRightRadius: afLayout.radiusHero,
    paddingHorizontal: afLayout.screenPaddingX,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: af.border,
    marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { ...afType.title3, color: af.textPrimary },
});
