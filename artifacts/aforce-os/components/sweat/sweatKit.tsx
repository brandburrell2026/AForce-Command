/**
 * sweatKit — S2-9b: the Sweat calculator's private shadow-kit, retired into a
 * real kit file (the profileKit/scanKit pattern; deferred from S2-9 #829).
 *
 * ONE-WAY RULE: the screen imports from this kit; this kit must never import
 * from the screen or from sweatResultKit (pinned by `sweatKitS29b.test.ts`).
 *
 * Byte-moved: the stylesheet, the live-loss snapshot, and the form
 * primitives. The one deliberate transform in the move: hand-written
 * 'Inter_*' family string literals become Typography.fonts.* tokens — the
 * token VALUES are those exact strings, so rendered output is unchanged
 * (S2-4/S2-8b precedent). Sizes/tracking untouched: like Scan, this sheet
 * speaks a tracked-micro dialect mostly off the afType scale (61 sites,
 * 8 exact matches) — on-scale consolidation awaits the founder/design ruling
 * requested in S2-8b.
 */
/**
 * Sweat Calculator Screen — AForce OS.
 *
 * Three input modes share one results pane:
 *   QUICK     — pre/post weight + duration + (optional) fluid intake.
 *   PRECISION — full ACSM protocol: + urine, sport, climate, sodium tier.
 *   ESTIMATE  — no scale: weight, height, sport, intensity, climate.
 *
 * Outputs sweat rate, hydration deficit %, sodium loss, and a
 * personalized AForce prescription (sticks + water for the next 4h
 * recovery window plus per-hour intake target for similar sessions).
 *
 * Computation is delegated entirely to services/sweatRateEngine.ts —
 * this screen only renders inputs, results, and citations.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  TextInput,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, router as globalRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '@/components/Icon';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Polygon, Stop } from 'react-native-svg';

import { GradientBackground } from '@/components/GradientBackground';
import { HeightField, WeightField } from '@/components/bodyModel';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { AdaptiveScreenWrapper } from '@/components/AdaptiveScreenWrapper';
import { af, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { AFDisclosureSheet, AFListRow } from '@/components/ui';
import { Typography } from '@/theme/typography';
import {
  AFORCE_SODIUM_PER_UNIT_MG,
  computeSweatSession,
  DEFICIT_BANDS,
  SODIUM_BANDS,
} from '@/services/sweatRateEngine';
import { SWEAT_SPORTS } from '@/data/sweatSports';
import {
  pickRecoveryProtocol,
  type RecoveryProtocolPlan,
} from '@/services/recoveryProtocolService';
import {
  useActionsSlice,
  useInventorySlice,
  useProfileIdentitySlice,
  useUnitPreferencesSlice,
  useUserSlice,
} from '@/store/slices';
import { deriveSweatLoss, qualifySweatLossEstimate } from '@/services/biometricIntelligence';
import {
  getCurrentCityClimate,
  getCurrentCityClimateSync,
  type CityClimate,
} from '@/services/cityClimateService';
import type {
  EstimateInputs,
  PrecisionInputs,
  QuickInputs,
  SodiumProfile,
  SweatInputMode,
  SweatSession,
} from '@/types/sweat';
import type { ProfileIdentity } from '@/utils/profileIdentity';

// ── Live Sweat Loss snapshot ─────────────────────────────────────────
// Mirrors what the home Sweat tile used to surface in its detail sheet
// — projected fluid loss, sodium, efficiency, intensity — so the user
// lands on the calculator with the live read already in view.
export function SweatLossSnapshot() {
  const { t } = useTranslation();
  const user = useUserSlice();
  const profileIdentity = useProfileIdentitySlice();
  const snap = React.useMemo(() => deriveSweatLoss(user), [user]);
  // S2-14b — the S1-2 qualifier decides how this card may present itself:
  // 'ok' -> LIVE, 'limited' -> EST., 'unavailable' -> honest needs-input
  // state with no numbers. An unqualified value can never be labeled LIVE.
  const qualification = React.useMemo(
    () => qualifySweatLossEstimate(snap, profileIdentity.bodyWeightLbs),
    [snap, profileIdentity.bodyWeightLbs],
  );

  if (qualification.status === 'unavailable') {
    return (
      <View style={[styles.snapshotCard, { borderColor: af.border }]}>
        <View style={styles.snapshotHeaderRow}>
          <Text style={styles.snapshotEyebrow}>{t('sweat.v2.snap_eyebrow_unqualified')}</Text>
        </View>
        <View
          style={styles.snapshotHeroRow}
          accessible
          accessibilityLabel={t('sweat.v2.snap_unavailable_body')}
        >
          <Text style={styles.snapshotHero}>{'\u2014'}</Text>
        </View>
        <Text style={styles.snapshotHint}>{t('sweat.v2.snap_unavailable_body')}</Text>
      </View>
    );
  }

  const accent =
    snap.efficiencyPct >= 100 ? af.green
    : snap.efficiencyPct >= 60 ? af.cyan
    : af.amber;

  const intensityLabel =
    snap.intensity.charAt(0).toUpperCase() + snap.intensity.slice(1);

  return (
    <View style={[styles.snapshotCard, { borderColor: accent + '55' }]}>
      <View style={styles.snapshotHeaderRow}>
        <Text style={[styles.snapshotEyebrow, { color: accent }]}>
          {qualification.status === 'ok' ? t('sweat.v2.snap_eyebrow') : t('sweat.v2.snap_eyebrow_unqualified')}
        </Text>
        {qualification.status !== 'ok' || snap.confidence === 'low' ? (
          <Text style={styles.snapshotConfidence}>{t('sweat.v2.snap_est')}</Text>
        ) : null}
      </View>
      <View
        style={styles.snapshotHeroRow}
        accessible
        accessibilityLabel={`${snap.fluidLossOz} ${t('sweat.v2.snap_oz_projected')}`}
      >
        <Text style={styles.snapshotHero}>{snap.fluidLossOz}</Text>
        <Text style={styles.snapshotHeroUnit}>{t('sweat.v2.snap_oz_projected')}</Text>
      </View>
      <View style={styles.snapshotMetricsRow}>
        <View
          style={styles.snapshotMetric}
          accessible
          accessibilityLabel={`${t('sweat.v2.snap_sodium')} ${t('sweat.v2.unit_mg', { value: snap.sodiumLossMg })}`}
        >
          <Text style={styles.snapshotMetricLabel} numberOfLines={1}>{t('sweat.v2.snap_sodium')}</Text>
          <Text
            style={styles.snapshotMetricValue}
            numberOfLines={1}
            maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
          >
            {t('sweat.v2.unit_mg', { value: snap.sodiumLossMg })}
          </Text>
        </View>
        <View style={styles.snapshotMetricDivider} />
        <View
          style={styles.snapshotMetric}
          accessible
          accessibilityLabel={`${t('sweat.v2.snap_efficiency')} ${t('sweat.v2.unit_pct', { value: snap.efficiencyPct })}`}
        >
          <Text style={styles.snapshotMetricLabel} numberOfLines={1}>{t('sweat.v2.snap_efficiency')}</Text>
          <Text
            style={[styles.snapshotMetricValue, { color: accent }]}
            numberOfLines={1}
            maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
          >
            {t('sweat.v2.unit_pct', { value: snap.efficiencyPct })}
          </Text>
        </View>
        <View style={styles.snapshotMetricDivider} />
        <View
          style={styles.snapshotMetric}
          accessible
          accessibilityLabel={`${t('sweat.v2.snap_intensity')} ${intensityLabel}`}
        >
          <Text style={styles.snapshotMetricLabel} numberOfLines={1}>{t('sweat.v2.snap_intensity')}</Text>
          <Text
            style={styles.snapshotMetricValue}
            numberOfLines={1}
            maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
          >
            {intensityLabel}
          </Text>
        </View>
      </View>
      <Text style={styles.snapshotHint}>{t('sweat.v2.snap_hint')}</Text>
    </View>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

export function num(s: string): number {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function ModeSegment({
  mode,
  onChange,
}: {
  mode: SweatInputMode;
  onChange: (m: SweatInputMode) => void;
}) {
  const { t } = useTranslation();
  const items: { id: SweatInputMode; label: string }[] = [
    { id: 'quick', label: t('sweat.v2.mode_quick') },
    { id: 'precision', label: t('sweat.v2.mode_precision') },
    { id: 'estimate', label: t('sweat.v2.mode_estimate') },
  ];
  return (
    <View style={styles.segment}>
      {items.map((it) => {
        const active = mode === it.id;
        return (
          <Pressable
            key={it.id}
            onPress={() => onChange(it.id)}
            hitSlop={8}
            style={[styles.segmentBtn, active && styles.segmentBtnActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function SubLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subLabel}>{children}</Text>;
}

export function Helper({ children }: { children: React.ReactNode }) {
  return <Text style={styles.helper}>{children}</Text>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function NumberRow({
  label,
  suffix,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.numberRow}>
      <Text style={styles.numberLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.numberInputWrap}>
        <TextInput
          style={styles.numberInput}
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder={t('sweat.v2.number_placeholder')}
          placeholderTextColor={af.textTertiary}
          accessibilityLabel={label}
        />
        <Text style={styles.numberSuffix}>{suffix}</Text>
      </View>
    </View>
  );
}

export function SportPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {SWEAT_SPORTS.map((s) => {
        const active = s.id === value;
        return (
          <Pressable
            key={s.id}
            onPress={() => onChange(s.id)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {s.emoji}  {s.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function SodiumPicker({
  value,
  onChange,
}: {
  value: SodiumProfile;
  onChange: (v: SodiumProfile) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 6 }}>
      {SODIUM_BANDS.map((b) => {
        const active = b.id === value;
        return (
          <Pressable
            key={b.id}
            onPress={() => onChange(b.id)}
            style={[styles.sodiumRow, active && styles.sodiumRowActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <View style={styles.sodiumDot}>
              <View style={[styles.sodiumDotInner, active && { backgroundColor: af.cyan }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sodiumLabel}>{b.label}</Text>
              <Text style={styles.sodiumDesc}>
                {t('sweat.v2.sodium_band_desc', { mg: b.mgPerLiter, desc: b.description })}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function IntensityPicker({
  value,
  onChange,
}: {
  value: 1 | 2 | 3 | 4 | 5;
  onChange: (v: 1 | 2 | 3 | 4 | 5) => void;
}) {
  const { t } = useTranslation();
  const labels = [
    t('sweat.v2.intensity_light'),
    t('sweat.v2.intensity_easy'),
    t('sweat.v2.intensity_moderate'),
    t('sweat.v2.intensity_hard'),
    t('sweat.v2.intensity_max'),
  ];
  return (
    <View style={styles.intensityRow}>
      {[1, 2, 3, 4, 5].map((n) => {
        const active = value === n;
        return (
          <Pressable
            key={n}
            onPress={() => onChange(n as 1 | 2 | 3 | 4 | 5)}
            style={[styles.intensityBtn, active && styles.intensityBtnActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.intensityNum, active && styles.intensityNumActive]}>{n}</Text>
            <Text style={[styles.intensityLabel, active && styles.intensityLabelActive]}>
              {labels[n - 1]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint && <Text style={styles.toggleHint}>{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        accessibilityHint={hint}
        thumbColor={af.textPrimary}
        trackColor={{ true: af.cyan, false: af.surface }}
      />
    </View>
  );
}

export function ClimateLine({ climate, ambientTempC }: { climate: CityClimate; ambientTempC: number }) {
  const { t } = useTranslation();
  return (
    <View style={styles.climateLine}>
      <Icon name="sun" size={12} color={af.textTertiary} />
      <Text style={styles.climateText}>
        {t('sweat.v2.climate_line', {
          city: climate.city,
          tempF: Math.round(climate.tempF),
          tempC: ambientTempC,
          humidity: climate.humidityPct,
        })}
      </Text>
    </View>
  );
}

/* ─── Result Pane — Sweat Intelligence v2 ──────────────────────────────
 * Nine spec cards (A–I), in order. Every card sources from the engine
 * output + inventory slice; nothing is hardcoded except the verbatim
 * positioning copy required by the upgrade brief.
 */
export const styles = StyleSheet.create({
  qualBlockedCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: af.border,
    backgroundColor: af.surface,
    padding: 20,
    gap: 8,
  },
  qualBlockedTitle: { color: af.textPrimary, fontSize: 17, fontFamily: Typography.fonts.bold },
  qualBlockedBody: { color: af.textSecondary, fontSize: 14, lineHeight: 20 },
  qualLimitedNote: {
    fontSize: 12,
    color: af.textSecondary,
    borderWidth: 1,
    borderColor: af.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },

  root: { flex: 1, backgroundColor: af.canvas },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 14 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: af.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: af.cyan,
    fontSize: 11,
    letterSpacing: 1.4,
    fontFamily: Typography.fonts.bold,
  },
  title: { color: af.textPrimary, fontSize: 26, fontFamily: Typography.fonts.bold, letterSpacing: -0.4 },
  subhead: { color: af.textSecondary, fontSize: 13, lineHeight: 18 },

  snapshotCard: {
    backgroundColor: af.surface,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  snapshotHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  snapshotEyebrow: {
    fontSize: 10,
    letterSpacing: 1.6,
    fontFamily: Typography.fonts.bold,
  },
  snapshotConfidence: {
    fontSize: 9,
    letterSpacing: 1.2,
    fontFamily: Typography.fonts.bold,
    color: af.textSecondary,
  },
  snapshotHeroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  snapshotHero: {
    fontSize: 38,
    fontFamily: Typography.fonts.bold,
    letterSpacing: -0.6,
    color: af.textPrimary,
  },
  snapshotHeroUnit: {
    fontSize: 13,
    color: af.textSecondary,
  },
  snapshotMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  snapshotMetric: {
    flex: 1,
    gap: 4,
  },
  snapshotMetricDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: af.border,
    marginHorizontal: 8,
  },
  snapshotMetricLabel: {
    fontSize: 9,
    letterSpacing: 1.2,
    fontFamily: Typography.fonts.bold,
    color: af.textSecondary,
  },
  snapshotMetricValue: {
    fontSize: 14,
    fontFamily: Typography.fonts.bold,
    color: af.textPrimary,
  },
  snapshotHint: {
    fontSize: 11,
    color: af.textSecondary,
    lineHeight: 15,
  },

  segment: {
    flexDirection: 'row',
    backgroundColor: af.surface,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 9 },
  segmentBtnActive: { backgroundColor: af.surfaceRaised },
  segmentText: { color: af.textSecondary, fontSize: 13, fontFamily: Typography.fonts.semibold, letterSpacing: 0.4 },
  segmentTextActive: { color: af.textPrimary },

  card: {
    backgroundColor: af.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: af.divider,
    gap: 10,
  },
  sectionTitle: {
    color: af.textTertiary,
    fontSize: 11,
    letterSpacing: 1.2,
    fontFamily: Typography.fonts.bold,
    marginBottom: 4,
  },
  subLabel: {
    color: af.textTertiary,
    fontSize: 11,
    letterSpacing: 1.0,
    fontFamily: Typography.fonts.bold,
    marginTop: 2,
    marginBottom: 6,
  },
  helper: {
    color: af.textTertiary,
    fontSize: 11,
    lineHeight: 15,
    fontStyle: 'italic',
    marginTop: 4,
  },
  divider: { height: 1, backgroundColor: af.divider, marginVertical: 4 },

  numberRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  numberLabel: { color: af.textPrimary, fontSize: 14, flex: 1 },
  numberInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: af.surface,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: 110,
  },
  numberInput: {
    color: af.textPrimary,
    fontSize: 15,
    fontFamily: Typography.fonts.semibold,
    flex: 1,
    textAlign: 'right',
    paddingVertical: 0,
    minWidth: 0,
  },
  numberSuffix: { color: af.textTertiary, fontSize: 11, marginLeft: 6, fontFamily: Typography.fonts.semibold },

  chipRow: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: af.surface,
    borderWidth: 1,
    borderColor: af.divider,
  },
  chipActive: {
    backgroundColor: 'rgba(0,229,200,0.12)',
    borderColor: af.cyan,
  },
  chipText: { color: af.textSecondary, fontSize: 12, fontFamily: Typography.fonts.semibold },
  chipTextActive: { color: af.textPrimary },

  sodiumRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: af.surface,
    borderWidth: 1,
    borderColor: af.divider,
    alignItems: 'flex-start',
  },
  sodiumRowActive: {
    backgroundColor: 'rgba(0,229,200,0.12)',
    borderColor: af.cyan,
  },
  sodiumDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: af.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  sodiumDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'transparent' },
  sodiumLabel: { color: af.textPrimary, fontSize: 13, fontFamily: Typography.fonts.bold },
  sodiumDesc: { color: af.textTertiary, fontSize: 11, lineHeight: 14, marginTop: 2 },

  intensityRow: { flexDirection: 'row', gap: 6 },
  intensityBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: af.surface,
    borderWidth: 1,
    borderColor: af.divider,
    alignItems: 'center',
  },
  intensityBtnActive: {
    backgroundColor: 'rgba(0,229,200,0.12)',
    borderColor: af.cyan,
  },
  intensityNum: { color: af.textSecondary, fontSize: 18, fontFamily: Typography.fonts.bold },
  intensityNumActive: { color: af.textPrimary },
  intensityLabel: { color: af.textTertiary, fontSize: 9, marginTop: 2, letterSpacing: 0.4, fontFamily: Typography.fonts.bold },
  intensityLabelActive: { color: af.textSecondary },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { color: af.textPrimary, fontSize: 14, fontFamily: Typography.fonts.semibold },
  toggleHint: { color: af.textTertiary, fontSize: 11, marginTop: 2 },

  climateLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  climateText: { color: af.textTertiary, fontSize: 11 },

  calcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: af.red,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
    // Kill the browser :focus-visible ring on web preview — the
    // Pressable's white surface is high-contrast enough to stand on
    // its own, so the bright blue outline that RN-Web inherits from
    // the UA stylesheet is off-system. Same pattern as PlainTabButton
    // in app/(tabs)/_layout.tsx. RN native ignores unknown style keys
    // at runtime — these are no-ops off-web.
    ...(Platform.OS === 'web'
      ? ({
          outlineWidth: 0,
          outlineStyle: 'none',
          outlineColor: 'transparent',
          boxShadow: 'none',
          cursor: 'pointer',
        } as Record<string, unknown>)
      : {}),
  },
  calcBtnText: { color: af.onRed, fontSize: 15, fontFamily: Typography.fonts.bold, letterSpacing: 0.3 },
  calcBtnDisabled: { backgroundColor: af.surface },
  calcBtnTextDisabled: { color: af.textTertiary },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: af.surfaceRaised,
    borderWidth: 1,
    borderColor: af.red,
  },
  errorText: { color: af.textPrimary, fontSize: 12, flex: 1, lineHeight: 16 },

  resultsWrap: { gap: 14, marginTop: 4 },

  heroCard: {
    backgroundColor: af.surfaceRaised,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: af.divider,
  },
  heroEyebrow: {
    color: af.cyan,
    fontSize: 10,
    letterSpacing: 1.4,
    fontFamily: Typography.fonts.bold,
  },
  heroNumbers: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 },
  heroBig: { color: af.textPrimary, fontSize: 56, fontFamily: Typography.fonts.bold, lineHeight: 56, letterSpacing: -2 },
  heroUnitTop: { color: af.textPrimary, fontSize: 18, fontFamily: Typography.fonts.bold },
  heroUnitBottom: { color: af.textTertiary, fontSize: 12, marginTop: 2 },
  heroSub: { color: af.textSecondary, fontSize: 12, marginTop: 8 },
  heroSubBold: { color: af.textPrimary, fontFamily: Typography.fonts.bold },
  estimatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,160,30,0.12)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 10,
  },
  estimatedBadgeText: {
    color: af.amber,
    fontSize: 9,
    fontFamily: Typography.fonts.bold,
    letterSpacing: 0.6,
  },
  intentionalSodiumLine: {
    color: af.textTertiary,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: af.divider,
    fontStyle: 'italic',
  },

  // E2 — Sodium Gap Protocol (Celtic sea salt)
  sodiumGapCard: {
    backgroundColor: af.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: af.divider,
    borderLeftWidth: 4,
    borderLeftColor: af.cyan,
    gap: 10,
  },
  sodiumGapEyebrow: {
    color: af.cyan,
    fontSize: 11,
    letterSpacing: 1.4,
    fontFamily: Typography.fonts.bold,
  },
  sodiumGapRows: {
    gap: 6,
    paddingVertical: 6,
  },
  sodiumGapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sodiumGapKey: {
    color: af.textSecondary,
    fontSize: 12,
  },
  sodiumGapValue: {
    color: af.textPrimary,
    fontSize: 13,
    fontFamily: Typography.fonts.bold,
  },
  sodiumGapValueAccent: {
    color: af.cyan,
  },
  sodiumGapBody: {
    color: af.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
  sodiumGapNote: {
    color: af.textTertiary,
    fontSize: 11,
    lineHeight: 15,
    fontStyle: 'italic',
  },

  bandCard: {
    backgroundColor: af.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    gap: 8,
  },
  bandHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bandPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  bandPillText: { color: af.onRed, fontSize: 11, fontFamily: Typography.fonts.bold, letterSpacing: 0.6 },
  bandPct: { fontSize: 28, fontFamily: Typography.fonts.bold },
  bandMessage: { color: af.textPrimary, fontSize: 13, lineHeight: 18 },
  bandReference: { color: af.textTertiary, fontSize: 10, marginTop: 4 },

  rxCard: {
    backgroundColor: af.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: af.green,
  },
  rxEyebrow: {
    color: af.green,
    fontSize: 10,
    letterSpacing: 1.4,
    fontFamily: Typography.fonts.bold,
  },
  rxHeadline: {
    color: af.textPrimary,
    fontSize: 17,
    fontFamily: Typography.fonts.bold,
    marginTop: 8,
    lineHeight: 22,
  },
  rxGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  rxStat: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: af.surface,
    padding: 12,
    borderRadius: 10,
  },
  rxStatValue: { color: af.textPrimary, fontSize: 22, fontFamily: Typography.fonts.bold },
  rxStatUnit: { color: af.textTertiary, fontSize: 12, fontFamily: Typography.fonts.semibold },
  rxStatLabel: { color: af.textTertiary, fontSize: 10, letterSpacing: 0.6, marginTop: 4, fontFamily: Typography.fonts.bold },

  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: af.green,
    marginTop: 7,
  },
  bulletText: { color: af.textSecondary, fontSize: 12, lineHeight: 17, flex: 1 },

  auditCard: {
    backgroundColor: af.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: af.divider,
  },
  auditTitle: {
    color: af.textTertiary,
    fontSize: 10,
    letterSpacing: 1.2,
    fontFamily: Typography.fonts.bold,
    marginBottom: 8,
  },
  auditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    gap: 12,
  },
  auditKey: { color: af.textSecondary, fontSize: 11, flex: 1 },
  auditValue: { color: af.textPrimary, fontSize: 11, fontFamily: Typography.fonts.semibold, textAlign: 'right' },

  citationToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8 },
  citationToggleText: { color: af.textTertiary, fontSize: 11, fontFamily: Typography.fonts.semibold, letterSpacing: 0.4 },

  citationCard: {
    backgroundColor: af.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: af.divider,
    gap: 10,
  },
  citationTitle: {
    color: af.textTertiary,
    fontSize: 10,
    letterSpacing: 1.2,
    fontFamily: Typography.fonts.bold,
    marginBottom: 4,
  },
  citationBody: { color: af.textSecondary, fontSize: 11, lineHeight: 16 },
  citationBold: { color: af.textPrimary, fontFamily: Typography.fonts.bold },
  citationDisclaimer: {
    color: af.textTertiary,
    fontSize: 10,
    lineHeight: 14,
    fontStyle: 'italic',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: af.divider,
  },

  // ── Sweat Intelligence v2 cards ───────────────────────────────────
  cardEyebrow: {
    color: af.textTertiary,
    fontSize: 10,
    letterSpacing: 1.4,
    fontFamily: Typography.fonts.bold,
    marginBottom: 10,
  },

  // A — Performance Header extras
  perfMetaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  perfMeta: {
    flex: 1,
    backgroundColor: af.surface,
    borderRadius: 10,
    padding: 10,
  },
  perfMetaValue: {
    color: af.textPrimary,
    fontSize: 15,
    fontFamily: Typography.fonts.bold,
    letterSpacing: -0.2,
  },
  perfMetaLabel: {
    color: af.textTertiary,
    fontSize: 9,
    letterSpacing: 0.8,
    fontFamily: Typography.fonts.bold,
    marginTop: 3,
    textTransform: 'uppercase',
  },

  // B — Recovery Intelligence
  intelCard: {
    backgroundColor: af.canvasFocused,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: af.green,
  },
  intelEyebrow: {
    color: af.green,
    fontSize: 10,
    letterSpacing: 1.4,
    fontFamily: Typography.fonts.bold,
  },
  intelHeadline: {
    color: af.textPrimary,
    fontSize: 22,
    fontFamily: Typography.fonts.bold,
    letterSpacing: -0.4,
    lineHeight: 28,
    marginTop: 10,
  },
  intelBody: {
    color: af.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  intelChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  intelChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  intelChipText: {
    color: af.textPrimary,
    fontSize: 11,
    fontFamily: Typography.fonts.bold,
    letterSpacing: 0.4,
  },

  // C — AForce System
  systemCard: {
    backgroundColor: af.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: af.divider,
  },
  systemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: af.divider,
    gap: 12,
  },
  systemRowKey: {
    color: af.textPrimary,
    fontSize: 13,
    fontFamily: Typography.fonts.bold,
    flexShrink: 0,
  },
  systemRowValue: {
    color: af.textTertiary,
    fontSize: 11,
    textAlign: 'right',
    flex: 1,
  },
  systemDivider: { height: 14 },
  systemSubhead: {
    color: af.textTertiary,
    fontSize: 10,
    letterSpacing: 1.2,
    fontFamily: Typography.fonts.bold,
    marginBottom: 8,
  },
  ingredientRow: { paddingVertical: 6 },
  ingredientName: {
    color: af.textPrimary,
    fontSize: 12,
    fontFamily: Typography.fonts.bold,
    letterSpacing: 0.2,
  },
  ingredientLine: {
    color: af.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },

  // D — AI Recovery Decision
  aiCard: {
    backgroundColor: af.surfaceRaised,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: af.divider,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  aiEyebrow: {
    fontSize: 10,
    letterSpacing: 1.4,
    fontFamily: Typography.fonts.bold,
  },
  aiHeadline: {
    color: af.textPrimary,
    fontSize: 16,
    fontFamily: Typography.fonts.bold,
    letterSpacing: -0.2,
    marginBottom: 10,
  },
  aiBullets: { gap: 8 },

  // E — Recovery Protocol
  protocolCard: {
    backgroundColor: af.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: af.green,
  },
  protocolRestock: {
    borderColor: af.amber,
  },
  protocolHeadline: {
    color: af.textPrimary,
    fontSize: 15,
    fontFamily: Typography.fonts.bold,
    lineHeight: 21,
  },
  protocolReasoning: {
    color: af.textTertiary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 10,
  },
  protocolSteps: { marginTop: 14, gap: 10 },
  protocolStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  protocolStepIdx: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(31,163,90,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  protocolStepIdxText: {
    color: af.green,
    fontSize: 11,
    fontFamily: Typography.fonts.bold,
  },
  protocolStepLabel: {
    color: af.textPrimary,
    fontSize: 13,
    fontFamily: Typography.fonts.bold,
  },
  protocolStepHint: {
    color: af.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  restockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: af.red,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 14,
  },
  restockBtnText: {
    color: af.onRed,
    fontSize: 13,
    fontFamily: Typography.fonts.bold,
    letterSpacing: 0.4,
  },

  // F — Optional Support
  supportCard: {
    backgroundColor: af.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: af.divider,
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  supportFooter: {
    color: af.textTertiary,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: af.divider,
    fontStyle: 'italic',
  },
  supportIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: af.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportLabel: {
    color: af.textPrimary,
    fontSize: 13,
    fontFamily: Typography.fonts.bold,
  },
  supportHint: {
    color: af.textTertiary,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },

  // G — Advanced Data
  advCard: {
    backgroundColor: af.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: af.divider,
  },
  advHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // H — Comparison Table
  compareCard: {
    backgroundColor: af.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: af.divider,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: af.divider,
    gap: 8,
  },
  compareHead: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  compareHeadText: {
    color: af.textTertiary,
    fontSize: 9,
    letterSpacing: 1,
    fontFamily: Typography.fonts.bold,
    textTransform: 'uppercase',
  },
  compareRowYou: {
    backgroundColor: 'rgba(31,163,90,0.12)',
    borderRadius: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 0,
    marginVertical: 2,
  },
  compareCell: {
    color: af.textPrimary,
    fontSize: 12,
    fontFamily: Typography.fonts.semibold,
  },
  compareCellBrand: { width: 92 },
  compareCellSodium: { width: 76 },
  compareCellProfile: { flex: 1 },
  compareYouText: {
    color: af.green,
    fontFamily: Typography.fonts.bold,
  },
  youDot: {
    backgroundColor: af.green,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  youDotText: {
    color: af.onRed,
    fontSize: 8,
    fontFamily: Typography.fonts.bold,
    letterSpacing: 0.6,
  },
  compareCloser: {
    color: af.textPrimary,
    fontSize: 13,
    fontFamily: Typography.fonts.bold,
    fontStyle: 'italic',
    letterSpacing: -0.1,
    lineHeight: 18,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: af.divider,
  },

  // I — Share Card hand-off
  shareCard: {
    aspectRatio: 1.6,
    backgroundColor: '#06070A',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  shareGlow: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 200,
    backgroundColor: af.cyan,
    opacity: 0.16,
  },
  shareTriangleMark: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 28,
    height: 28,
    zIndex: 2,
  },
  shareUrl: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    letterSpacing: 1.6,
    fontFamily: Typography.fonts.semibold,
  },
  shareTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: af.cyan,
  },
  shareEyebrow: {
    color: af.textTertiary,
    fontSize: 10,
    letterSpacing: 2.4,
    fontFamily: Typography.fonts.bold,
  },
  shareHeadline: {
    color: '#FFFFFF',
    fontSize: 26,
    fontFamily: Typography.fonts.bold,
    letterSpacing: -0.5,
    lineHeight: 30,
    textTransform: 'uppercase',
  },
  shareSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    letterSpacing: 0.5,
    fontFamily: Typography.fonts.semibold,
  },
  shareCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  shareCTAText: {
    color: af.textPrimary,
    fontSize: 11,
    fontFamily: Typography.fonts.bold,
    letterSpacing: 0.4,
  },
});
