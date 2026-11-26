/**
 * WaterAmountModal — the manual amount sheet for logging water.
 *
 * Laid out as the approved prototype's log sheet: title and Close, round
 * steppers either side of a 64pt light number with "fl oz · mL" beneath it,
 * pill amounts, and one "Log N oz" button. The prototype's drink chips
 * (AFORCE, coffee, other) are not here: this sheet logs water only, and the
 * other drinks wait on their own rules.
 *
 * Explicit presets (including 4 oz), a ±2 oz stepper clamped to
 * 4–64 oz, and `onConfirm` as the only way anything is logged.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { AFModal } from './ui/AFModal';
import { hapticImpact, hapticSelection } from '@/services/haptics';
import { af, withAlpha } from '@/theme';

interface Props {
  visible: boolean;
  /** No longer drawn: the sheet is neutral, as in the prototype. Kept so callers do not change. */
  accentColor?: string;
  onCancel: () => void;
  onConfirm: (oz: number) => void;
}

const PRESETS = [4, 8, 12, 16, 20, 24, 32];
const MIN_OZ = 4;
const MAX_OZ = 64;
const STEP_OZ = 2;

/** Millilitres shown beside the ounces. Display only. */
export const ML_PER_FL_OZ = 29.57;

export function WaterAmountModal({ visible, onCancel, onConfirm }: Props) {
  const [oz, setOz] = React.useState<number>(16);
  // Native selection and submit events can arrive before React commits a new
  // render. Keep the selected value synchronous so Confirm never reads the
  // previous render's amount.
  const selectedOzRef = React.useRef(16);

  // Reset to the default whenever the modal re-opens so a previous
  // session's value doesn't leak into the next log.
  React.useLayoutEffect(() => {
    if (visible) {
      selectedOzRef.current = 16;
      setOz(16);
    }
  }, [visible]);

  const adjust = (delta: number) => {
    hapticSelection();
    selectedOzRef.current = Math.max(MIN_OZ, Math.min(MAX_OZ, selectedOzRef.current + delta));
    setOz(selectedOzRef.current);
  };

  const choose = (value: number) => {
    hapticSelection();
    selectedOzRef.current = value;
    setOz(value);
  };

  const confirm = () => {
    const amount = selectedOzRef.current;
    hapticImpact('medium');
    onConfirm(amount);
  };

  return (
    <AFModal
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
        <Pressable style={styles.sheet} onPress={() => {}} testID="water-sheet">
          <View style={styles.headerRow}>
            <Text style={styles.title} accessibilityRole="header">Log water</Text>
            <Pressable
              onPress={onCancel}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={styles.close}
            >
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>

          <View style={styles.amountRow}>
            <Pressable
              onPress={() => adjust(-STEP_OZ)}
              style={({ pressed }) => [styles.stepperBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Decrease ounces"
              hitSlop={8}
            >
              <Text style={styles.stepperGlyph}>−</Text>
            </Pressable>
            <View style={styles.amountDisplay}>
              <Text style={styles.amountValue} testID="water-amount">{oz}</Text>
              <Text style={styles.amountUnit}>
                fl oz · {Math.round(oz * ML_PER_FL_OZ)} mL
              </Text>
            </View>
            <Pressable
              onPress={() => adjust(STEP_OZ)}
              style={({ pressed }) => [styles.stepperBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Increase ounces"
              hitSlop={8}
            >
              <Text style={styles.stepperGlyph}>+</Text>
            </Pressable>
          </View>

          <View style={styles.presetsRow}>
            {PRESETS.map((p) => {
              const active = p === oz;
              return (
                <Pressable
                  key={p}
                  onPress={() => choose(p)}
                  style={[styles.preset, active && styles.presetOn]}
                  accessibilityRole="button"
                  accessibilityLabel={`${p} ounces`}
                  accessibilityState={{ selected: active }}
                  testID={`water-preset-${p}`}
                >
                  <Text style={styles.presetText}>{p}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={confirm}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Log ${oz} ounces of water`}
            testID="water-confirm"
          >
            <Text style={styles.ctaText}>Log {oz} oz</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </AFModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: withAlpha(af.canvas, 0.55),
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: af.surface,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 34,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: af.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: -0.18,
    color: af.textPrimary,
  },
  close: { minHeight: 44, justifyContent: 'center' },
  closeText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: af.textSecondary,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    marginBottom: 8,
  },
  // 44pt, not the prototype's 40: the iOS minimum touch target.
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: af.border,
    backgroundColor: af.surfacePressed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperGlyph: {
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
    color: af.textPrimary,
  },
  pressed: { opacity: 0.7 },
  amountDisplay: { alignItems: 'center', minWidth: 120 },
  amountValue: {
    fontSize: 64,
    lineHeight: 68,
    fontFamily: 'Inter_300Light',
    letterSpacing: -2.56,
    color: af.textPrimary,
  },
  amountUnit: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'IBMPlexMono_400Regular',
    color: af.textTertiary,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    marginBottom: 22,
  },
  preset: {
    minHeight: 44,
    minWidth: 64,
    width: '22%',
    maxWidth: 84,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: af.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetOn: {
    borderColor: af.textPrimary,
    backgroundColor: withAlpha(af.textPrimary, 0.08),
  },
  presetText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: af.textPrimary,
  },
  cta: {
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: af.primaryFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: {
    color: af.onPrimaryFill,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
});
