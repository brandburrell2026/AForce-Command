/**
 * HeightField — the shared, unit-aware height stepper.
 *
 * The single height-entry control used by onboarding, Edit Profile, and
 * the Sweat Calculator so every surface behaves identically:
 *   - Imperial: ± half-inch stepper (e.g. 5'10", 5'10.5", 5'11").
 *   - Metric:   ± 1 cm stepper.
 *
 * Fully controlled from canonical cm — it holds no internal state, so
 * the parent's value (and a unit switch) always wins. All stepping math
 * lives in the pure `utils/bodyMeasurements` helpers; this is the view
 * layer only. Emits canonical integer cm via `onChange`.
 *
 * Score-Protection: this is body-model input only. It never reads,
 * awards, or mutates score.
 */

import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/theme/colors';
import { formatHeightValue, stepHeightCm } from '@/utils/bodyMeasurements';
import type { HeightUnit } from '@/utils/units';

interface HeightFieldProps {
  /** Canonical height in centimetres, or `null` when unset. */
  heightCm: number | null;
  /** Display unit (`'ft'` = imperial half-inch, `'cm'` = metric). */
  unit: HeightUnit;
  /** Emits the next canonical cm value on each step (or `null` when cleared). */
  onChange: (cm: number | null) => void;
  /** Field label. Pass `''` to render the stepper with no label. */
  label?: string;
  /** Placeholder shown when `heightCm` is null. */
  placeholder?: string;
  /**
   * When true and a value is set, show a "Clear" affordance that emits
   * `null` — matching the optional/null-clear body-model contract on
   * surfaces (e.g. Edit Profile) where height is skippable.
   */
  allowClear?: boolean;
  testID?: string;
}

export function HeightField({
  heightCm,
  unit,
  onChange,
  label = 'HEIGHT',
  placeholder = 'Tap to set',
  allowClear = false,
  testID,
}: HeightFieldProps) {
  const isSet = heightCm != null;
  const display = isSet ? formatHeightValue(heightCm as number, unit) : placeholder;

  const step = React.useCallback(
    (direction: 1 | -1) => {
      Haptics.selectionAsync().catch(() => {});
      onChange(stepHeightCm(heightCm, direction, unit));
    },
    [heightCm, unit, onChange],
  );

  const clear = React.useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    onChange(null);
  }, [onChange]);

  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={styles.stepper}>
        <Pressable
          onPress={() => step(-1)}
          style={styles.stepperBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Decrease height"
        >
          <Text style={styles.stepperBtnLabel}>−</Text>
        </Pressable>
        <View style={styles.stepperValueWrap}>
          <Text
            style={[styles.stepperValue, !isSet && styles.stepperValueMuted]}
            accessibilityLabel={`Height ${isSet ? display : 'not set'}`}
            testID={testID}
          >
            {display}
          </Text>
        </View>
        <Pressable
          onPress={() => step(1)}
          style={styles.stepperBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Increase height"
        >
          <Text style={styles.stepperBtnLabel}>+</Text>
        </Pressable>
      </View>
      {allowClear && isSet ? (
        <Pressable
          onPress={clear}
          hitSlop={8}
          style={styles.clearBtn}
          accessibilityRole="button"
          accessibilityLabel="Clear height"
          testID={testID ? `${testID}-clear` : undefined}
        >
          <Text style={styles.clearLabel}>Clear</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 22 },
  fieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.5,
    color: Colors.text.muted,
    marginBottom: 10,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    width: 54,
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    lineHeight: 30,
    color: Colors.text.primary,
  },
  stepperValueWrap: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: Colors.text.primary,
  },
  stepperValueMuted: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: Colors.text.ghost,
  },
  clearBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  clearLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.5,
    color: Colors.text.muted,
  },
});
