/**
 * WaterAmountModal — Manual oz picker for water logging.
 *
 * Surfaced when the user taps LOG WATER. Plain water is logged with a
 * user-supplied amount because real bottles vary widely (8 oz cup,
 * 16.9 oz disposable, 24 oz tumbler, 32 oz Nalgene…). Sticks and RTD
 * keep their fixed serving size — those are pre-portioned products.
 *
 * Presets cover the common sizes for fast taps; the manual stepper
 * (+/- 2 oz) covers anything else without forcing a keyboard.
 */

import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';

interface Props {
  visible: boolean;
  accentColor: string;
  onCancel: () => void;
  onConfirm: (oz: number) => void;
}

const PRESETS = [8, 12, 16, 20, 24, 32];
const MIN_OZ = 4;
const MAX_OZ = 64;
const STEP_OZ = 2;

export function WaterAmountModal({ visible, accentColor, onCancel, onConfirm }: Props) {
  const [oz, setOz] = React.useState<number>(16);

  // Reset to the default whenever the modal re-opens so a previous
  // session's value doesn't leak into the next log.
  React.useEffect(() => {
    if (visible) setOz(16);
  }, [visible]);

  const adjust = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    setOz((prev) => Math.max(MIN_OZ, Math.min(MAX_OZ, prev + delta)));
  };

  const choose = (value: number) => {
    Haptics.selectionAsync().catch(() => {});
    setOz(value);
  };

  const confirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onConfirm(oz);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/*
          Inner Pressable swallows taps so tapping inside the sheet
          doesn't dismiss it; only backdrop taps cancel.
        */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>LOG WATER</Text>
            <Pressable onPress={onCancel} hitSlop={12} accessibilityLabel="Cancel">
              <Feather name="x" size={20} color={Colors.text.secondary} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>How much water did you drink?</Text>

          <View style={styles.amountRow}>
            <Pressable
              onPress={() => adjust(-STEP_OZ)}
              style={styles.stepperBtn}
              accessibilityLabel="Decrease ounces"
              hitSlop={8}
            >
              <Feather name="minus" size={20} color={Colors.text.primary} />
            </Pressable>
            <View style={styles.amountDisplay}>
              <Text style={[styles.amountValue, { color: accentColor }]}>{oz}</Text>
              <Text style={styles.amountUnit}>oz</Text>
            </View>
            <Pressable
              onPress={() => adjust(STEP_OZ)}
              style={styles.stepperBtn}
              accessibilityLabel="Increase ounces"
              hitSlop={8}
            >
              <Feather name="plus" size={20} color={Colors.text.primary} />
            </Pressable>
          </View>

          <View style={styles.presetsRow}>
            {PRESETS.map((p) => {
              const active = p === oz;
              return (
                <Pressable
                  key={p}
                  onPress={() => choose(p)}
                  style={[
                    styles.preset,
                    active && {
                      borderColor: accentColor,
                      backgroundColor: `${accentColor}1A`,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${p} ounces`}
                  accessibilityState={{ selected: active }}
                  testID={`water-preset-${p}`}
                >
                  <Text style={[styles.presetText, active && { color: accentColor }]}>
                    {p}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={confirm}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: accentColor },
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Log ${oz} ounces of water`}
            testID="water-confirm"
          >
            <Feather name="droplet" size={16} color={Colors.text.inverse} />
            <Text style={styles.ctaText}>LOG {oz} OZ WATER</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background.elevated,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 3,
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.secondary,
    marginTop: -4,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  amountValue: {
    fontSize: 56,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -1,
  },
  amountUnit: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.muted,
    letterSpacing: 1,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  preset: {
    minWidth: 52,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.medium,
    alignItems: 'center',
    flexGrow: 1,
  },
  presetText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    letterSpacing: 0.4,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
  },
  ctaText: {
    color: Colors.text.inverse,
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
  },
});
