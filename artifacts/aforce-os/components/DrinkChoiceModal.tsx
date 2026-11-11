/**
 * DrinkChoiceModal — records a beverage without inventing a HydroState rule.
 *
 * Water stays on the existing WaterAmountModal → logIntake path. Every other
 * choice is a separate, private drink log: it never changes HydroState, score,
 * streaks, or Circle data until its rule is deliberately approved.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { AFModal } from './ui/AFModal';
import { Icon } from './Icon';
import { hapticImpact, hapticSelection } from '@/services/haptics';
import { Colors } from '@/theme/colors';

export type NonWaterDrinkChoice = {
  categoryId: 'aforce' | 'coffee_or_tea' | 'custom';
  displayName: 'AFORCE' | 'Coffee or tea' | 'Other';
};

interface Props {
  visible: boolean;
  onCancel: () => void;
  onWater: () => void;
  onRecord: (choice: NonWaterDrinkChoice, ozAmount: number) => void;
  isSaving?: boolean;
}

const CHOICES: Array<{ id: 'water' | NonWaterDrinkChoice['categoryId']; label: string; detail: string }> = [
  { id: 'water', label: 'Water', detail: 'Moves HydroState today.' },
  { id: 'aforce', label: 'AFORCE', detail: 'Saved to your log. Rule approval pending.' },
  { id: 'coffee_or_tea', label: 'Coffee or tea', detail: 'Saved to your log. Rule approval pending.' },
  { id: 'custom', label: 'Other', detail: 'Saved to your log. Rule approval pending.' },
];

const CHOICE_BY_ID: Record<NonWaterDrinkChoice['categoryId'], NonWaterDrinkChoice> = {
  aforce: { categoryId: 'aforce', displayName: 'AFORCE' },
  coffee_or_tea: { categoryId: 'coffee_or_tea', displayName: 'Coffee or tea' },
  custom: { categoryId: 'custom', displayName: 'Other' },
};

const MIN_OZ = 4;
const MAX_OZ = 64;
const STEP_OZ = 2;

export function DrinkChoiceModal({ visible, onCancel, onWater, onRecord, isSaving = false }: Props) {
  const [selected, setSelected] = React.useState<NonWaterDrinkChoice['categoryId'] | null>(null);
  const [oz, setOz] = React.useState(12);

  React.useEffect(() => {
    if (visible) {
      setSelected(null);
      setOz(12);
    }
  }, [visible]);

  const choose = (id: (typeof CHOICES)[number]['id']) => {
    hapticSelection();
    if (id === 'water') {
      onWater();
      return;
    }
    setSelected(id);
  };

  const adjust = (delta: number) => {
    hapticSelection();
    setOz((current) => Math.max(MIN_OZ, Math.min(MAX_OZ, current + delta)));
  };

  const save = () => {
    if (!selected || isSaving) return;
    hapticImpact('medium');
    onRecord(CHOICE_BY_ID[selected], oz);
  };

  return (
    <AFModal visible={visible} animationType="fade" transparent onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>LOG A DRINK</Text>
            <Pressable onPress={onCancel} hitSlop={12} accessibilityLabel="Cancel">
              <Icon name="x" size={20} color={Colors.text.secondary} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>Choose what you drank. Water is the only drink that moves HydroState today.</Text>

          {!selected ? (
            <View style={styles.choices}>
              {CHOICES.map((choice) => (
                <Pressable
                  key={choice.id}
                  onPress={() => choose(choice.id)}
                  style={styles.choice}
                  accessibilityRole="button"
                  accessibilityLabel={`${choice.label}. ${choice.detail}`}
                  testID={`drink-choice-${choice.id}`}
                >
                  <View>
                    <Text style={styles.choiceLabel}>{choice.label}</Text>
                    <Text style={styles.choiceDetail}>{choice.detail}</Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={Colors.text.muted} />
                </Pressable>
              ))}
            </View>
          ) : (
            <>
              <Pressable onPress={() => setSelected(null)} style={styles.back} accessibilityLabel="Choose a different drink">
                <Icon name="chevron-left" size={16} color={Colors.text.secondary} />
                <Text style={styles.backText}>CHANGE DRINK</Text>
              </Pressable>
              <Text style={styles.selectedTitle}>{CHOICE_BY_ID[selected].displayName}</Text>
              <Text style={styles.pending}>This is saved privately to your log. It does not change HydroState today.</Text>
              <View style={styles.amountRow}>
                <Pressable onPress={() => adjust(-STEP_OZ)} style={styles.stepper} accessibilityLabel="Decrease ounces">
                  <Icon name="minus" size={20} color={Colors.text.primary} />
                </Pressable>
                <View style={styles.amount}>
                  <Text style={styles.amountValue}>{oz}</Text>
                  <Text style={styles.amountUnit}>ounces</Text>
                </View>
                <Pressable onPress={() => adjust(STEP_OZ)} style={styles.stepper} accessibilityLabel="Increase ounces">
                  <Icon name="plus" size={20} color={Colors.text.primary} />
                </Pressable>
              </View>
              <Pressable
                onPress={save}
                disabled={isSaving}
                style={({ pressed }) => [styles.cta, (pressed || isSaving) && styles.ctaPressed]}
                accessibilityRole="button"
                accessibilityLabel={`Save ${oz} ounces of ${CHOICE_BY_ID[selected].displayName} to your log`}
                testID="record-non-water-drink"
              >
                <Text style={styles.ctaText}>{isSaving ? 'SAVING…' : `SAVE ${oz} OUNCES TO LOG`}</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </AFModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.background.elevated, paddingTop: 16, paddingHorizontal: 20, paddingBottom: 28, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 3, color: Colors.text.primary },
  subtitle: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium', color: Colors.text.secondary },
  choices: { borderWidth: 1, borderColor: Colors.border.medium, borderRadius: 14, overflow: 'hidden' },
  choice: { minHeight: 66, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border.medium },
  choiceLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: Colors.text.primary },
  choiceDetail: { marginTop: 3, fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.text.secondary },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  backText: { fontSize: 11, letterSpacing: 1.2, fontFamily: 'Inter_700Bold', color: Colors.text.secondary },
  selectedTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.text.primary, marginTop: -4 },
  pending: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_500Medium', color: Colors.text.secondary, marginTop: -8 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  stepper: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: Colors.border.medium, backgroundColor: Colors.fill.light, alignItems: 'center', justifyContent: 'center' },
  amount: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  amountValue: { color: Colors.accent.primary, fontSize: 56, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  amountUnit: { color: Colors.text.muted, fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  cta: { backgroundColor: Colors.accent.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaPressed: { opacity: 0.85 },
  ctaText: { color: Colors.text.inverse, fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
});
