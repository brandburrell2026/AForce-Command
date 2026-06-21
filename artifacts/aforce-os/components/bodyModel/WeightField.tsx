/**
 * WeightField — the shared, unit-aware body-weight input.
 *
 * The single body-weight-entry control used by onboarding, Edit Profile,
 * and the Sweat Calculator. Accepts free-typed input in the user's
 * chosen unit (lbs or kg) and emits canonical integer POUNDS — `null`
 * when the field is empty or out of range (matching the profile
 * sanitiser's "unset" semantics).
 *
 * It keeps a small local text buffer so mid-typing never fights a
 * controlled value, but re-seeds from the canonical prop whenever the
 * unit switches or an external reset arrives (e.g. a draft revert). It
 * never calls `onChange` from those re-seeds, so there is no feedback
 * loop with the parent.
 *
 * Score-Protection: body-model input only. It never reads, awards, or
 * mutates score.
 */

import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors } from '@/theme/colors';
import {
  formatWeightInputValue,
  parseWeightToLbs,
} from '@/utils/bodyMeasurements';
import type { WeightUnit } from '@/utils/units';

interface WeightFieldProps {
  /** Canonical body weight in pounds, or `null` when unset. */
  bodyWeightLbs: number | null;
  /** Display unit (`'lbs'` or `'kg'`). */
  unit: WeightUnit;
  /** Emits canonical pounds (or `null` when cleared / invalid). */
  onChange: (lbs: number | null) => void;
  /** Field label. Defaults to `BODY WEIGHT (LBS|KG)`; pass `''` for none. */
  label?: string;
  testID?: string;
}

export function WeightField({
  bodyWeightLbs,
  unit,
  onChange,
  label,
  testID,
}: WeightFieldProps) {
  const resolvedLabel =
    label ?? `BODY WEIGHT (${unit === 'kg' ? 'KG' : 'LBS'})`;

  const [text, setText] = React.useState(() =>
    formatWeightInputValue(bodyWeightLbs, unit),
  );

  // Re-seed when the unit switches: the canonical pounds are unchanged,
  // but the displayed number must flip into the new unit.
  React.useEffect(() => {
    setText(formatWeightInputValue(bodyWeightLbs, unit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  // Re-seed on an EXTERNAL canonical change (e.g. draft revert / profile
  // load) — but only when the current text doesn't already represent it,
  // so typing is never clobbered and our own onChange never echoes back.
  React.useEffect(() => {
    setText((prev) =>
      parseWeightToLbs(prev, unit) === bodyWeightLbs
        ? prev
        : formatWeightInputValue(bodyWeightLbs, unit),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyWeightLbs]);

  const handleChange = React.useCallback(
    (next: string) => {
      setText(next);
      onChange(parseWeightToLbs(next, unit));
    },
    [unit, onChange],
  );

  return (
    <View style={styles.field}>
      {resolvedLabel ? <Text style={styles.fieldLabel}>{resolvedLabel}</Text> : null}
      <TextInput
        value={text}
        onChangeText={handleChange}
        keyboardType="number-pad"
        placeholder={unit === 'kg' ? 'e.g. 80' : 'e.g. 175'}
        placeholderTextColor={Colors.text.ghost}
        style={styles.input}
        maxLength={3}
        accessibilityLabel={`Body weight in ${unit === 'kg' ? 'kilograms' : 'pounds'}`}
        testID={testID}
      />
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
  input: {
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.text.primary,
  },
});
