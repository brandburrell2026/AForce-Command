/**
 * AFDisclosureSheet — a bottom sheet for "why this command", methodology, and
 * detail/legal context (spec §5). Native modal presentation, af.surfaceRaised,
 * a clear drag affordance, and a single close control (spec §3.5).
 */
import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  return (
    <AFModal visible={visible} transparent animationType="slide" onRequestClose={onClose} testID={testID}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss" />
      <View style={[styles.panel, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
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
