/**
 * AddDrinkModal — HydroScan "Personalized Hydration Intelligence" (Slice 1)
 *
 * Manual search + custom drinks. Lets the user log any drink across the
 * 13 supported categories with the correct hydration coefficient applied
 * to the score impact. The actual drink name is preserved in history
 * (e.g. "Coffee · Starbucks Pike Place 16 oz") so a glance tells the
 * full story.
 *
 * Flow:
 *   1. Search bar (debounce-free; small dataset) + category chip filter
 *   2. Result list → tap a drink → oz stepper sheet → confirm
 *   3. "Add custom drink" CTA → category + name + oz form → confirm
 *
 * Logging path uses the existing store `logIntake` with:
 *   - ozOverride = computeEffectiveOz(category, enteredOz, perDrinkCoef)
 *   - displayNameOverride = "{Category} · {Drink Name} ({entered} oz)"
 *
 * No scoring engine or server changes. Everything else (success flash,
 * voice command, history feed) is reused as-is from the existing log
 * pipeline.
 */

import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Icon } from './Icon';
import { Colors } from '../theme/colors';
import {
  CATEGORY_ORDER,
  DRINK_CATEGORIES,
  computeEffectiveOz,
  formatDrinkDisplayName,
  getDrinkCoefficient,
  sanitizeCustomDrinkName,
  type CatalogDrink,
  type DrinkCategoryId,
} from '../data/drinkCatalog';
import { searchDrinks } from '../utils/drinkSearch';

interface Props {
  visible: boolean;
  accentColor: string;
  onCancel: () => void;
  /**
   * Called when the user confirms. Parent owns the actual `logIntake`
   * call so this component stays decoupled from the store.
   */
  onConfirm: (args: {
    categoryId: DrinkCategoryId;
    name: string;          // user-facing drink name (no category prefix)
    displayName: string;   // "{Category} · {Name}" — ready for history
    enteredOz: number;     // what the user actually drank
    effectiveOz: number;   // score-equivalent oz (oz × coefficient)
    hydrationCoefficient: number;
  }) => void;
}

const OZ_MIN = 1;
const OZ_MAX = 64;
const OZ_STEP = 1;
const OZ_PRESETS = [8, 12, 16, 20, 24, 32];
const CUSTOM_NAME_MAX = 60;

type Stage =
  | { kind: 'browse' }
  | { kind: 'pick-oz'; drink: CatalogDrink; oz: number }
  | { kind: 'custom'; categoryId: DrinkCategoryId; name: string; oz: number };

export function AddDrinkModal({ visible, accentColor, onCancel, onConfirm }: Props) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<DrinkCategoryId | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'browse' });

  // Reset state every time the modal opens so a previous session's
  // search query / oz pick doesn't leak into the next intake log.
  React.useEffect(() => {
    if (visible) {
      setQuery('');
      setActiveCategory(null);
      setStage({ kind: 'browse' });
    }
  }, [visible]);

  const results = useMemo(
    () =>
      searchDrinks(query, {
        categoryId: activeCategory ?? undefined,
        limit: 60,
      }),
    [query, activeCategory],
  );

  const hapticTap = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  };

  const onPickDrink = (drink: CatalogDrink) => {
    hapticTap();
    setStage({ kind: 'pick-oz', drink, oz: drink.ozPerServing });
  };

  const onStartCustom = () => {
    hapticTap();
    const cat = activeCategory ?? 'custom';
    setStage({
      kind: 'custom',
      categoryId: cat,
      name: '',
      oz: DRINK_CATEGORIES[cat].defaultOz,
    });
  };

  const back = () => {
    hapticTap();
    setStage({ kind: 'browse' });
  };

  const adjustOz = (delta: number) => {
    hapticTap();
    setStage((prev) => {
      if (prev.kind === 'pick-oz' || prev.kind === 'custom') {
        const next = Math.max(OZ_MIN, Math.min(OZ_MAX, prev.oz + delta));
        return { ...prev, oz: next };
      }
      return prev;
    });
  };

  const setOzPreset = (oz: number) => {
    hapticTap();
    setStage((prev) => {
      if (prev.kind === 'pick-oz' || prev.kind === 'custom') return { ...prev, oz };
      return prev;
    });
  };

  const confirmDrink = () => {
    if (stage.kind === 'pick-oz') {
      const { drink, oz } = stage;
      const coef = getDrinkCoefficient(drink);
      const effective = computeEffectiveOz(drink.categoryId, oz, drink.hydrationCoefficient);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      onConfirm({
        categoryId: drink.categoryId,
        name: drink.brand ? `${drink.brand} ${drink.name}`.trim() : drink.name,
        displayName: formatDrinkDisplayName({ categoryId: drink.categoryId, name: drink.name }),
        enteredOz: oz,
        effectiveOz: effective,
        hydrationCoefficient: coef,
      });
    } else if (stage.kind === 'custom') {
      const clean = sanitizeCustomDrinkName(stage.name);
      if (!clean) return;
      const coef = DRINK_CATEGORIES[stage.categoryId].hydrationCoefficient;
      const effective = computeEffectiveOz(stage.categoryId, stage.oz);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      onConfirm({
        categoryId: stage.categoryId,
        name: clean,
        displayName: formatDrinkDisplayName({ categoryId: stage.categoryId, name: clean }),
        enteredOz: stage.oz,
        effectiveOz: effective,
        hydrationCoefficient: coef,
      });
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {/* Header */}
          <View style={styles.headerRow}>
            {stage.kind !== 'browse' ? (
              <Pressable onPress={back} hitSlop={12} accessibilityLabel="Back">
                <Icon name="chevron-left" size={20} color={Colors.text.secondary} />
              </Pressable>
            ) : (
              <View style={{ width: 20 }} />
            )}
            <Text style={styles.title}>
              {stage.kind === 'browse'
                ? 'LOG ANY DRINK'
                : stage.kind === 'pick-oz'
                ? 'HOW MUCH?'
                : 'CUSTOM DRINK'}
            </Text>
            <Pressable onPress={onCancel} hitSlop={12} accessibilityLabel="Close">
              <Icon name="x" size={20} color={Colors.text.secondary} />
            </Pressable>
          </View>

          {stage.kind === 'browse' && (
            <BrowseStage
              query={query}
              onQueryChange={setQuery}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              results={results}
              onPickDrink={onPickDrink}
              onStartCustom={onStartCustom}
              accentColor={accentColor}
            />
          )}

          {stage.kind === 'pick-oz' && (
            <PickOzStage
              drink={stage.drink}
              oz={stage.oz}
              accentColor={accentColor}
              onAdjust={adjustOz}
              onPreset={setOzPreset}
              onConfirm={confirmDrink}
            />
          )}

          {stage.kind === 'custom' && (
            <CustomStage
              categoryId={stage.categoryId}
              name={stage.name}
              oz={stage.oz}
              accentColor={accentColor}
              onCategoryChange={(id) =>
                setStage({ kind: 'custom', categoryId: id, name: stage.name, oz: stage.oz })
              }
              onNameChange={(v) =>
                setStage({ ...stage, name: v.slice(0, CUSTOM_NAME_MAX) })
              }
              onAdjust={adjustOz}
              onPreset={setOzPreset}
              onConfirm={confirmDrink}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Browse stage ─────────────────────────────────────────────────────

function BrowseStage(props: {
  query: string;
  onQueryChange: (v: string) => void;
  activeCategory: DrinkCategoryId | null;
  onCategoryChange: (id: DrinkCategoryId | null) => void;
  results: CatalogDrink[];
  onPickDrink: (d: CatalogDrink) => void;
  onStartCustom: () => void;
  accentColor: string;
}) {
  const {
    query, onQueryChange, activeCategory, onCategoryChange,
    results, onPickDrink, onStartCustom, accentColor,
  } = props;

  return (
    <View style={{ gap: 12 }}>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <Icon name="search" size={14} color={Colors.text.muted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search drinks, brands, categories…"
          placeholderTextColor={Colors.text.muted}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          testID="add-drink-search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => onQueryChange('')} hitSlop={8} accessibilityLabel="Clear search">
            <Icon name="x" size={14} color={Colors.text.muted} />
          </Pressable>
        )}
      </View>

      {/* Category chip strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipStrip}
      >
        <CategoryChip
          label="ALL"
          active={activeCategory === null}
          accentColor={accentColor}
          onPress={() => onCategoryChange(null)}
        />
        {CATEGORY_ORDER.filter((id) => id !== 'custom').map((id) => (
          <CategoryChip
            key={id}
            label={DRINK_CATEGORIES[id].shortLabel}
            active={activeCategory === id}
            accentColor={accentColor}
            onPress={() => onCategoryChange(id === activeCategory ? null : id)}
          />
        ))}
      </ScrollView>

      {/* Results */}
      <ScrollView
        style={styles.resultsScroll}
        contentContainerStyle={styles.resultsContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {results.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.emptyHint}>
              Try a different word, switch category, or add a custom drink below.
            </Text>
          </View>
        )}
        {results.map((d) => (
          <Pressable
            key={d.id}
            onPress={() => onPickDrink(d)}
            style={({ pressed }) => [styles.resultRow, pressed && { opacity: 0.7 }]}
            testID={`drink-row-${d.id}`}
          >
            <View style={styles.resultIcon}>
              <Icon
                name={DRINK_CATEGORIES[d.categoryId].icon}
                size={14}
                color={Colors.text.secondary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultName} numberOfLines={1}>
                {d.name}
              </Text>
              <Text style={styles.resultMeta} numberOfLines={1}>
                {DRINK_CATEGORIES[d.categoryId].label} · {d.ozPerServing} oz
                {d.brand ? ` · ${d.brand}` : ''}
              </Text>
            </View>
            <Icon name="chevron-right" size={16} color={Colors.text.muted} />
          </Pressable>
        ))}
      </ScrollView>

      {/* Custom CTA — always visible at the bottom */}
      <Pressable
        onPress={onStartCustom}
        style={({ pressed }) => [styles.customCta, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        testID="add-drink-custom"
      >
        <Icon name="plus-circle" size={16} color={accentColor} />
        <Text style={[styles.customCtaText, { color: accentColor }]}>
          ADD CUSTOM DRINK
        </Text>
      </Pressable>
    </View>
  );
}

function CategoryChip(props: {
  label: string;
  active: boolean;
  accentColor: string;
  onPress: () => void;
}) {
  const { label, active, accentColor, onPress } = props;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active && {
          borderColor: accentColor,
          backgroundColor: `${accentColor}1A`,
        },
      ]}
    >
      <Text style={[styles.chipText, active && { color: accentColor }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Pick oz stage ────────────────────────────────────────────────────

function PickOzStage(props: {
  drink: CatalogDrink;
  oz: number;
  accentColor: string;
  onAdjust: (delta: number) => void;
  onPreset: (oz: number) => void;
  onConfirm: () => void;
}) {
  const { drink, oz, accentColor, onAdjust, onPreset, onConfirm } = props;
  const cat = DRINK_CATEGORIES[drink.categoryId];
  const coef = getDrinkCoefficient(drink);
  const effective = computeEffectiveOz(drink.categoryId, oz, drink.hydrationCoefficient);

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.previewCard}>
        <Text style={styles.previewEyebrow}>{cat.label.toUpperCase()}</Text>
        <Text style={styles.previewName} numberOfLines={2}>
          {drink.brand ? `${drink.brand} — ` : ''}{drink.name}
        </Text>
        <Text style={styles.previewCoef}>
          Hydration credit · {Math.round(coef * 100)}% of plain water
        </Text>
      </View>

      <OzStepper
        oz={oz}
        accentColor={accentColor}
        onAdjust={onAdjust}
        onPreset={onPreset}
      />

      <View style={styles.impactCard}>
        <Text style={styles.impactLabel}>SCORE IMPACT</Text>
        <Text style={[styles.impactValue, { color: accentColor }]}>
          ≈ {effective} oz water-equivalent
        </Text>
      </View>

      <Pressable
        onPress={onConfirm}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: accentColor },
          pressed && { opacity: 0.85 },
        ]}
        accessibilityRole="button"
        testID="add-drink-confirm-catalog"
      >
        <Icon name="check-circle" size={16} color={Colors.text.inverse} />
        <Text style={styles.ctaText}>LOG {oz} OZ</Text>
      </Pressable>
    </View>
  );
}

// ─── Custom stage ─────────────────────────────────────────────────────

function CustomStage(props: {
  categoryId: DrinkCategoryId;
  name: string;
  oz: number;
  accentColor: string;
  onCategoryChange: (id: DrinkCategoryId) => void;
  onNameChange: (v: string) => void;
  onAdjust: (delta: number) => void;
  onPreset: (oz: number) => void;
  onConfirm: () => void;
}) {
  const {
    categoryId, name, oz, accentColor,
    onCategoryChange, onNameChange, onAdjust, onPreset, onConfirm,
  } = props;
  const canConfirm = !!sanitizeCustomDrinkName(name);
  const effective = computeEffectiveOz(categoryId, oz);

  return (
    <View style={{ gap: 14 }}>
      <View>
        <Text style={styles.fieldLabel}>NAME</Text>
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={onNameChange}
          placeholder="e.g. Mom's Lemonade, Cold Brew with oat milk"
          placeholderTextColor={Colors.text.muted}
          maxLength={CUSTOM_NAME_MAX}
          autoFocus
          testID="add-drink-custom-name"
        />
      </View>

      <View>
        <Text style={styles.fieldLabel}>CATEGORY</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipStrip}
        >
          {CATEGORY_ORDER.map((id) => (
            <CategoryChip
              key={id}
              label={DRINK_CATEGORIES[id].shortLabel}
              active={categoryId === id}
              accentColor={accentColor}
              onPress={() => onCategoryChange(id)}
            />
          ))}
        </ScrollView>
        <Text style={styles.fieldHint}>
          {DRINK_CATEGORIES[categoryId].description}
        </Text>
      </View>

      <OzStepper
        oz={oz}
        accentColor={accentColor}
        onAdjust={onAdjust}
        onPreset={onPreset}
      />

      <View style={styles.impactCard}>
        <Text style={styles.impactLabel}>SCORE IMPACT</Text>
        <Text style={[styles.impactValue, { color: accentColor }]}>
          ≈ {effective} oz water-equivalent
        </Text>
      </View>

      <Pressable
        onPress={onConfirm}
        disabled={!canConfirm}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: accentColor },
          (!canConfirm || pressed) && { opacity: !canConfirm ? 0.35 : 0.85 },
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canConfirm }}
        testID="add-drink-confirm-custom"
      >
        <Icon name="check-circle" size={16} color={Colors.text.inverse} />
        <Text style={styles.ctaText}>LOG {oz} OZ</Text>
      </Pressable>
    </View>
  );
}

// ─── Shared oz stepper ────────────────────────────────────────────────

function OzStepper(props: {
  oz: number;
  accentColor: string;
  onAdjust: (delta: number) => void;
  onPreset: (oz: number) => void;
}) {
  const { oz, accentColor, onAdjust, onPreset } = props;
  return (
    <View>
      <View style={styles.amountRow}>
        <Pressable
          onPress={() => onAdjust(-OZ_STEP)}
          style={styles.stepperBtn}
          accessibilityLabel="Decrease ounces"
          hitSlop={8}
        >
          <Icon name="minus" size={20} color={Colors.text.primary} />
        </Pressable>
        <View style={styles.amountDisplay}>
          <Text style={[styles.amountValue, { color: accentColor }]}>{oz}</Text>
          <Text style={styles.amountUnit}>oz</Text>
        </View>
        <Pressable
          onPress={() => onAdjust(OZ_STEP)}
          style={styles.stepperBtn}
          accessibilityLabel="Increase ounces"
          hitSlop={8}
        >
          <Icon name="plus" size={20} color={Colors.text.primary} />
        </Pressable>
      </View>
      <View style={styles.presetsRow}>
        {OZ_PRESETS.map((p) => {
          const active = p === oz;
          return (
            <Pressable
              key={p}
              onPress={() => onPreset(p)}
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
              testID={`drink-oz-preset-${p}`}
            >
              <Text style={[styles.presetText, active && { color: accentColor }]}>
                {p}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background.elevated,
    paddingTop: 14,
    paddingHorizontal: 18,
    paddingBottom: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 12,
    maxHeight: '88%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  title: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 3,
    color: Colors.text.primary,
  },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.medium,
  },
  searchInput: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    padding: 0,
  },

  // Category chips
  chipStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.medium,
  },
  chipText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.4,
    color: Colors.text.secondary,
  },

  // Results
  resultsScroll: {
    maxHeight: 320,
  },
  resultsContent: {
    paddingBottom: 4,
    gap: 4,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  resultIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.fill.light,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  resultName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.primary,
  },
  resultMeta: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.muted,
    marginTop: 2,
    letterSpacing: 0.3,
  },

  emptyState: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
    color: Colors.text.secondary,
  },
  emptyHint: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.muted,
    textAlign: 'center',
    maxWidth: 260,
  },

  // Custom CTA
  customCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border.medium,
  },
  customCtaText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
  },

  // Oz stepper
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
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
    fontSize: 48,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -1,
  },
  amountUnit: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.muted,
    letterSpacing: 1,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  preset: {
    minWidth: 48,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.medium,
    alignItems: 'center',
    flexGrow: 1,
  },
  presetText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    letterSpacing: 0.4,
  },

  // Preview / impact cards
  previewCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.fill.light,
    gap: 4,
  },
  previewEyebrow: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
    color: Colors.text.muted,
  },
  previewName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.primary,
  },
  previewCoef: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.muted,
    marginTop: 2,
  },
  impactCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.fill.medium,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  impactLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
    color: Colors.text.muted,
  },
  impactValue: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },

  // Custom form
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
    color: Colors.text.muted,
    marginBottom: 6,
  },
  fieldHint: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.muted,
    marginTop: 8,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.medium,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: Colors.text.primary,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },

  // CTA
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
