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
import { deriveSweatLoss } from '@/services/biometricIntelligence';
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

import {
  styles,
  num,
  SweatLossSnapshot,
  ModeSegment,
  Card,
  SectionTitle,
  SubLabel,
  Helper,
  Divider,
  NumberRow,
  SportPicker,
  SodiumPicker,
  IntensityPicker,
  ToggleRow,
  ClimateLine,
} from './sweatKit';
import { CitationCard, ResultPane } from './sweatResultKit';

export function SweatCalculatorScreenV2() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // `?demo=1` auto-runs Calculate on mount so previews / share screens
  // can render the result pane without user interaction. Inert in normal
  // navigation — the Calculate button is still required.
  const params = useLocalSearchParams<{ demo?: string }>();
  const demoMode = params?.demo === '1';
  const [mode, setMode] = useState<SweatInputMode>('quick');

  // Live climate snapshot — auto-fills temp/humidity for Precision + Estimate.
  const [climate, setClimate] = useState<CityClimate>(() => getCurrentCityClimateSync());
  useEffect(() => {
    let cancelled = false;
    void getCurrentCityClimate().then((c) => {
      if (!cancelled) setClimate(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const ambientTempC = useMemo(() => Math.round((climate.tempF - 32) * (5 / 9)), [climate]);

  // Quick mode state.
  const [qPre, setQPre] = useState('');
  const [qPost, setQPost] = useState('');
  const [qHeight, setQHeight] = useState('');
  const [qDuration, setQDuration] = useState('');
  const [qFluid, setQFluid] = useState('');

  // Precision mode state.
  const [pPre, setPPre] = useState('');
  const [pPost, setPPost] = useState('');
  const [pHeight, setPHeight] = useState('');
  const [pDuration, setPDuration] = useState('');
  const [pFluid, setPFluid] = useState('');
  const [pUrine, setPUrine] = useState('0');
  const [pSportId, setPSportId] = useState('soccer');
  const [pAcclimatized, setPAcclimatized] = useState(false);
  const [pSodium, setPSodium] = useState<SodiumProfile>('moderate');

  // Estimate mode state. Body weight + height are the user's canonical
  // body model, so they read straight from — and write back to — the
  // profile through the shared, unit-aware fields, keeping one source of
  // truth across onboarding, Edit Profile, and here. (Quick/Precision
  // pre/post weights stay local: they're per-session scale readings, not
  // body model.) Score-Protection: body-model only; never touches score.
  const profileIdentity = useProfileIdentitySlice();
  const unitPrefs = useUnitPreferencesSlice();
  const eWeightLbs = profileIdentity.bodyWeightLbs;
  const eHeightCm = profileIdentity.heightCm;
  const [eSportId, setESportId] = useState('basketball');
  const [eDuration, setEDuration] = useState('');
  const [eIntensity, setEIntensity] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [eAcclimatized, setEAcclimatized] = useState(false);
  const [eSodium, setESodium] = useState<SodiumProfile>('moderate');

  // Result.
  const [result, setResult] = useState<SweatSession | null>(null);
  const [showCitations, setShowCitations] = useState(false);

  // Input validation. Returns null when valid, otherwise a short error message.
  const validationError = ((): string | null => {
    if (mode === 'quick') {
      const pre = num(qPre);
      const post = num(qPost);
      const dur = num(qDuration);
      const fluid = num(qFluid);
      const h = num(qHeight);
      if (pre <= 0 || pre > 700) return t('sweat.v2.val_pre_weight');
      if (post <= 0 || post > 700) return t('sweat.v2.val_post_weight');
      if (post > pre + 5) return t('sweat.v2.val_post_higher');
      if (h !== 0 && (h <= 0 || h > 8)) return t('sweat.v2.val_height');
      if (dur <= 0 || dur > 600) return t('sweat.v2.val_duration');
      if (fluid < 0 || fluid > 500) return t('sweat.v2.val_fluid');
      return null;
    }
    if (mode === 'precision') {
      const pre = num(pPre);
      const post = num(pPost);
      const dur = num(pDuration);
      const fluid = num(pFluid);
      const urine = num(pUrine);
      const h = num(pHeight);
      if (pre <= 0 || pre > 700) return t('sweat.v2.val_pre_weight');
      if (post <= 0 || post > 700) return t('sweat.v2.val_post_weight');
      if (post > pre + 5) return t('sweat.v2.val_post_higher');
      if (h !== 0 && (h <= 0 || h > 8)) return t('sweat.v2.val_height');
      if (dur <= 0 || dur > 600) return t('sweat.v2.val_duration');
      if (fluid < 0 || fluid > 500) return t('sweat.v2.val_fluid');
      if (urine < 0 || urine > 100) return t('sweat.v2.val_urine');
      return null;
    }
    const dur = num(eDuration);
    if (eWeightLbs == null || eWeightLbs <= 0)
      return t('sweat.v2.val_need_weight');
    if (eHeightCm == null) return t('sweat.v2.val_need_height');
    if (dur <= 0 || dur > 600) return t('sweat.v2.val_duration');
    return null;
  })();
  const canCalculate = validationError === null;

  // Push the freshly-derived autopilot into the store so useHeatGuard
  // (and any other consumer driving recheck cadence) can reflect the
  // recovery window for the next 4 hours.
  const { setSweatAutopilot, setProfileIdentity } = useActionsSlice<{
    setSweatAutopilot: (a: SweatSession['autopilot'] | null) => void;
    setProfileIdentity: (patch: Partial<ProfileIdentity>) => void;
  }>();

  const [blockedQualification, setBlockedQualification] =
    useState<SweatSession['qualification'] | null>(null);

  function commitSession(session: SweatSession) {
    // S1-2 (COR-001): an implausible computed session must not become
    // an authoritative result — and must not drive recheck cadence.
    if (session.qualification?.status === 'unavailable') {
      setResult(null);
      setBlockedQualification(session.qualification);
      setSweatAutopilot(null);
      return;
    }
    setBlockedQualification(null);
    setResult(session);
    setSweatAutopilot(session.autopilot);
  }

  // Demo auto-trigger: only fires when the URL carries ?demo=1 and the
  // user has not yet pressed Calculate. Lets us snapshot the result
  // pane in previews + screenshots without changing production UX.
  useEffect(() => {
    if (demoMode && !result && canCalculate) calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, canCalculate]);

  function calculate() {
    if (!canCalculate) return;
    if (mode === 'quick') {
      const qH = num(qHeight);
      const inputs: QuickInputs = {
        mode: 'quick',
        preWeight: num(qPre),
        postWeight: num(qPost),
        weightUnit: 'lbs',
        durationMinutes: num(qDuration),
        fluidIntake: num(qFluid),
        fluidUnit: 'oz',
        ...(qH > 0 ? { height: qH, heightUnit: 'ft' as const } : {}),
      };
      commitSession(computeSweatSession(inputs));
    } else if (mode === 'precision') {
      const pH = num(pHeight);
      const inputs: PrecisionInputs = {
        mode: 'precision',
        preWeight: num(pPre),
        postWeight: num(pPost),
        weightUnit: 'lbs',
        durationMinutes: num(pDuration),
        fluidIntake: num(pFluid),
        fluidUnit: 'oz',
        urineLoss: num(pUrine),
        sportId: pSportId,
        ambientTempC,
        ambientHumidityPct: climate.humidityPct,
        acclimatized: pAcclimatized,
        sodiumProfile: pSodium,
        ...(pH > 0 ? { height: pH, heightUnit: 'ft' as const } : {}),
      };
      commitSession(computeSweatSession(inputs));
    } else {
      const inputs: EstimateInputs = {
        mode: 'estimate',
        bodyWeight: eWeightLbs ?? 0,
        weightUnit: 'lbs',
        height: eHeightCm ?? 0,
        heightUnit: 'cm',
        sportId: eSportId,
        durationMinutes: num(eDuration),
        intensity: eIntensity,
        ambientTempC,
        ambientHumidityPct: climate.humidityPct,
        acclimatized: eAcclimatized,
        sodiumProfile: eSodium,
      };
      commitSession(computeSweatSession(inputs));
    }
  }

  const topPadding = Platform.OS === 'web' ? 24 : insets.top;

  return (
    <View style={styles.root}>
      <GradientBackground>
        <AdaptiveScreenWrapper>
          <KeyboardAwareScrollViewCompat
            style={styles.scroll}
            contentContainerStyle={[
              styles.content,
              { paddingTop: topPadding + 8, paddingBottom: insets.bottom + 32 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bottomOffset={24}
          >
            <View style={styles.headerRow}>
              <Pressable
                onPress={() => {
                  if (router.canGoBack()) router.back();
                  else router.replace('/(tabs)/profile' as never);
                }}
                style={styles.backBtn}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t('sweat.v2.back_a11y')}
              >
                <Icon name="chevron-left" size={20} color={af.textPrimary} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>{t('sweat.v2.eyebrow')}</Text>
                <Text style={styles.title}>{t('sweat.v2.title')}</Text>
              </View>
            </View>

            <Text style={styles.subhead}>{t('sweat.v2.subhead')}</Text>

            <SweatLossSnapshot />

            <ModeSegment mode={mode} onChange={setMode} />

            {mode === 'quick' && (
              <Card>
                <SectionTitle>{t('sweat.v2.inputs')}</SectionTitle>
                <NumberRow label={t('sweat.v2.pre_weight')} suffix={t('sweat.v2.suffix_lbs')} value={qPre} onChange={setQPre} />
                <NumberRow label={t('sweat.v2.post_weight')} suffix={t('sweat.v2.suffix_lbs')} value={qPost} onChange={setQPost} />
                <NumberRow label={t('sweat.v2.height')} suffix={t('sweat.v2.suffix_ft')} value={qHeight} onChange={setQHeight} />
                <NumberRow label={t('sweat.v2.duration')} suffix={t('sweat.v2.suffix_min')} value={qDuration} onChange={setQDuration} />
                <NumberRow label={t('sweat.v2.fluid_intake')} suffix={t('sweat.v2.suffix_ounces')} value={qFluid} onChange={setQFluid} />
                <Helper>{t('sweat.v2.helper_quick')}</Helper>
              </Card>
            )}

            {mode === 'precision' && (
              <Card>
                <SectionTitle>{t('sweat.v2.inputs')}</SectionTitle>
                <NumberRow label={t('sweat.v2.pre_weight')} suffix={t('sweat.v2.suffix_lbs')} value={pPre} onChange={setPPre} />
                <NumberRow label={t('sweat.v2.post_weight')} suffix={t('sweat.v2.suffix_lbs')} value={pPost} onChange={setPPost} />
                <NumberRow label={t('sweat.v2.height')} suffix={t('sweat.v2.suffix_ft')} value={pHeight} onChange={setPHeight} />
                <NumberRow label={t('sweat.v2.duration')} suffix={t('sweat.v2.suffix_min')} value={pDuration} onChange={setPDuration} />
                <NumberRow label={t('sweat.v2.fluid_intake')} suffix={t('sweat.v2.suffix_ounces')} value={pFluid} onChange={setPFluid} />
                <NumberRow label={t('sweat.v2.urine_output')} suffix={t('sweat.v2.suffix_ounces')} value={pUrine} onChange={setPUrine} />
                <Divider />
                <SubLabel>{t('sweat.v2.sport')}</SubLabel>
                <SportPicker value={pSportId} onChange={setPSportId} />
                <Divider />
                <SubLabel>{t('sweat.v2.sodium_profile')}</SubLabel>
                <SodiumPicker value={pSodium} onChange={setPSodium} />
                <Divider />
                <ToggleRow
                  label={t('sweat.v2.heat_acclimatized')}
                  value={pAcclimatized}
                  onChange={setPAcclimatized}
                  hint={t('sweat.v2.heat_acclimatized_hint')}
                />
                <ClimateLine climate={climate} ambientTempC={ambientTempC} />
              </Card>
            )}

            {mode === 'estimate' && (
              <Card>
                <SectionTitle>{t('sweat.v2.inputs')}</SectionTitle>
                <WeightField
                  bodyWeightLbs={eWeightLbs}
                  unit={unitPrefs.weight}
                  onChange={(lbs) => setProfileIdentity({ bodyWeightLbs: lbs })}
                />
                <HeightField
                  heightCm={eHeightCm}
                  unit={unitPrefs.height}
                  onChange={(cm) => setProfileIdentity({ heightCm: cm })}
                />
                <NumberRow label={t('sweat.v2.session_duration')} suffix={t('sweat.v2.suffix_min')} value={eDuration} onChange={setEDuration} />
                <Divider />
                <SubLabel>{t('sweat.v2.sport')}</SubLabel>
                <SportPicker value={eSportId} onChange={setESportId} />
                <Divider />
                <SubLabel>{t('sweat.v2.intensity')}</SubLabel>
                <IntensityPicker value={eIntensity} onChange={setEIntensity} />
                <Divider />
                <SubLabel>{t('sweat.v2.sodium_profile')}</SubLabel>
                <SodiumPicker value={eSodium} onChange={setESodium} />
                <Divider />
                <ToggleRow
                  label={t('sweat.v2.heat_acclimatized')}
                  value={eAcclimatized}
                  onChange={setEAcclimatized}
                  hint={t('sweat.v2.heat_acclimatized_hint')}
                />
                <ClimateLine climate={climate} ambientTempC={ambientTempC} />
                <Helper>{t('sweat.v2.helper_estimate')}</Helper>
              </Card>
            )}

            {validationError && (
              <View style={styles.errorRow} accessibilityLiveRegion="polite">
                <Icon name="alert-circle" size={14} color={af.red} />
                <Text style={styles.errorText}>{validationError}</Text>
              </View>
            )}

            <Pressable
              style={[styles.calcBtn, !canCalculate && styles.calcBtnDisabled]}
              onPress={calculate}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canCalculate }}
              disabled={!canCalculate}
            >
              <Icon
                name="droplet"
                size={16}
                color={canCalculate ? af.onRed : af.textTertiary}
              />
              <Text style={[styles.calcBtnText, !canCalculate && styles.calcBtnTextDisabled]}>
                {t('sweat.v2.calculate')}
              </Text>
            </Pressable>

            {blockedQualification && !result && (
              <View style={styles.qualBlockedCard} testID="sweat-qual-unavailable">
                <Text style={styles.qualBlockedTitle}>{t('sweat.v2.qual_unavailable_title')}</Text>
                <Text style={styles.qualBlockedBody}>{t('sweat.v2.qual_unavailable_body')}</Text>
              </View>
            )}
            {result && canCalculate && <ResultPane result={result} />}

            <Pressable
              onPress={() => setShowCitations((s) => !s)}
              style={styles.citationToggle}
              accessibilityRole="button"
              accessibilityState={{ expanded: showCitations }}
            >
              <Icon
                name={showCitations ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={af.textTertiary}
              />
              <Text style={styles.citationToggleText}>
                {showCitations ? t('sweat.v2.methodology_hide') : t('sweat.v2.methodology_show')}
              </Text>
            </Pressable>
            {showCitations && <CitationCard />}
          </KeyboardAwareScrollViewCompat>
        </AdaptiveScreenWrapper>
      </GradientBackground>
    </View>
  );
}
