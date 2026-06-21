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
import { Icon, type IconName } from '../components/Icon';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Polygon, Stop } from 'react-native-svg';

import { GradientBackground } from '@/components/GradientBackground';
import { HeightField, WeightField } from '@/components/bodyModel';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { AdaptiveScreenWrapper } from '@/components/AdaptiveScreenWrapper';
import { Colors } from '@/theme/colors';
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

const DEFICIT_COLOR: Record<string, string> = {
  optimal: Colors.states.PEAK.primary,
  mild: Colors.states.BALANCED.primary,
  impaired: Colors.states.RECOVERING.primary,
  danger: Colors.states.DEPLETED.primary,
};

// ── Live Sweat Loss snapshot ─────────────────────────────────────────
// Mirrors what the home Sweat tile used to surface in its detail sheet
// — projected fluid loss, sodium, efficiency, intensity — so the user
// lands on the calculator with the live read already in view.
function SweatLossSnapshot() {
  const user = useUserSlice();
  const snap = React.useMemo(() => deriveSweatLoss(user), [user]);

  const accent =
    snap.efficiencyPct >= 100 ? Colors.states.PEAK.primary
    : snap.efficiencyPct >= 60 ? Colors.states.BALANCED.primary
    : Colors.states.RECOVERING.primary;

  const intensityLabel =
    snap.intensity.charAt(0).toUpperCase() + snap.intensity.slice(1);

  return (
    <View style={[styles.snapshotCard, { borderColor: accent + '55' }]}>
      <View style={styles.snapshotHeaderRow}>
        <Text style={[styles.snapshotEyebrow, { color: accent }]}>SWEAT LOSS · LIVE</Text>
        {snap.confidence === 'low' ? (
          <Text style={styles.snapshotConfidence}>EST.</Text>
        ) : null}
      </View>
      <View style={styles.snapshotHeroRow}>
        <Text style={styles.snapshotHero}>{snap.fluidLossOz}</Text>
        <Text style={styles.snapshotHeroUnit}>oz projected</Text>
      </View>
      <View style={styles.snapshotMetricsRow}>
        <View style={styles.snapshotMetric}>
          <Text style={styles.snapshotMetricLabel} numberOfLines={1}>SODIUM</Text>
          <Text
            style={styles.snapshotMetricValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {snap.sodiumLossMg} mg
          </Text>
        </View>
        <View style={styles.snapshotMetricDivider} />
        <View style={styles.snapshotMetric}>
          <Text style={styles.snapshotMetricLabel} numberOfLines={1}>EFFICIENCY</Text>
          <Text
            style={[styles.snapshotMetricValue, { color: accent }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {snap.efficiencyPct}%
          </Text>
        </View>
        <View style={styles.snapshotMetricDivider} />
        <View style={styles.snapshotMetric}>
          <Text style={styles.snapshotMetricLabel} numberOfLines={1}>INTENSITY</Text>
          <Text
            style={styles.snapshotMetricValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {intensityLabel}
          </Text>
        </View>
      </View>
      <Text style={styles.snapshotHint}>
        Run a calculation below for a calibrated reading.
      </Text>
    </View>
  );
}

export default function SweatCalculatorScreen() {
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
  const [qPre, setQPre] = useState('170');
  const [qPost, setQPost] = useState('167.5');
  const [qHeight, setQHeight] = useState('5.8');
  const [qDuration, setQDuration] = useState('60');
  const [qFluid, setQFluid] = useState('16');

  // Precision mode state.
  const [pPre, setPPre] = useState('170');
  const [pPost, setPPost] = useState('167');
  const [pHeight, setPHeight] = useState('5.8');
  const [pDuration, setPDuration] = useState('90');
  const [pFluid, setPFluid] = useState('20');
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
  const [eDuration, setEDuration] = useState('60');
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
      if (pre <= 0 || pre > 700) return 'Enter a pre-weight between 1 and 700 lbs.';
      if (post <= 0 || post > 700) return 'Enter a post-weight between 1 and 700 lbs.';
      if (post > pre + 5) return 'Post-weight is higher than pre-weight — check your numbers.';
      if (h !== 0 && (h <= 0 || h > 8)) return 'Height should be 0.5–8 ft (or leave blank).';
      if (dur <= 0 || dur > 600) return 'Enter a duration between 1 and 600 minutes.';
      if (fluid < 0 || fluid > 500) return 'Fluid intake should be 0–500 ounces.';
      return null;
    }
    if (mode === 'precision') {
      const pre = num(pPre);
      const post = num(pPost);
      const dur = num(pDuration);
      const fluid = num(pFluid);
      const urine = num(pUrine);
      const h = num(pHeight);
      if (pre <= 0 || pre > 700) return 'Enter a pre-weight between 1 and 700 lbs.';
      if (post <= 0 || post > 700) return 'Enter a post-weight between 1 and 700 lbs.';
      if (post > pre + 5) return 'Post-weight is higher than pre-weight — check your numbers.';
      if (h !== 0 && (h <= 0 || h > 8)) return 'Height should be 0.5–8 ft (or leave blank).';
      if (dur <= 0 || dur > 600) return 'Enter a duration between 1 and 600 minutes.';
      if (fluid < 0 || fluid > 500) return 'Fluid intake should be 0–500 ounces.';
      if (urine < 0 || urine > 100) return 'Urine output should be 0–100 ounces.';
      return null;
    }
    const dur = num(eDuration);
    if (eWeightLbs == null || eWeightLbs <= 0)
      return 'Enter your body weight to estimate without a scale.';
    if (eHeightCm == null) return 'Set your height to estimate without a scale.';
    if (dur <= 0 || dur > 600) return 'Enter a duration between 1 and 600 minutes.';
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

  function commitSession(session: SweatSession) {
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
                accessibilityLabel="Back"
              >
                <Icon name="chevron-left" size={20} color={Colors.text.primary} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>SWEAT INTELLIGENCE</Text>
                <Text style={styles.title}>Sweat Calculator</Text>
              </View>
            </View>

            <Text style={styles.subhead}>
              Measure your sweat rate, sodium loss, and the exact AForce
              replacement protocol — calibrated to ACSM and Baker 2017.
            </Text>

            <SweatLossSnapshot />

            <ModeSegment mode={mode} onChange={setMode} />

            {mode === 'quick' && (
              <Card>
                <SectionTitle>Inputs</SectionTitle>
                <NumberRow label="Pre-weight" suffix="lbs" value={qPre} onChange={setQPre} />
                <NumberRow label="Post-weight" suffix="lbs" value={qPost} onChange={setQPost} />
                <NumberRow label="Height" suffix="ft" value={qHeight} onChange={setQHeight} />
                <NumberRow label="Duration" suffix="min" value={qDuration} onChange={setQDuration} />
                <NumberRow label="Fluid intake" suffix="ounces" value={qFluid} onChange={setQFluid} />
                <Helper>Weigh nude or in dry clothing for accuracy. 1 lb of weight loss ≈ 16 ounces of sweat.</Helper>
              </Card>
            )}

            {mode === 'precision' && (
              <Card>
                <SectionTitle>Inputs</SectionTitle>
                <NumberRow label="Pre-weight" suffix="lbs" value={pPre} onChange={setPPre} />
                <NumberRow label="Post-weight" suffix="lbs" value={pPost} onChange={setPPost} />
                <NumberRow label="Height" suffix="ft" value={pHeight} onChange={setPHeight} />
                <NumberRow label="Duration" suffix="min" value={pDuration} onChange={setPDuration} />
                <NumberRow label="Fluid intake" suffix="ounces" value={pFluid} onChange={setPFluid} />
                <NumberRow label="Urine output" suffix="ounces" value={pUrine} onChange={setPUrine} />
                <Divider />
                <SubLabel>Sport</SubLabel>
                <SportPicker value={pSportId} onChange={setPSportId} />
                <Divider />
                <SubLabel>Sweat-sodium profile</SubLabel>
                <SodiumPicker value={pSodium} onChange={setPSodium} />
                <Divider />
                <ToggleRow
                  label="Heat-acclimatized"
                  value={pAcclimatized}
                  onChange={setPAcclimatized}
                  hint="≥ 10 days of heat exposure / training in current climate"
                />
                <ClimateLine climate={climate} ambientTempC={ambientTempC} />
              </Card>
            )}

            {mode === 'estimate' && (
              <Card>
                <SectionTitle>Inputs</SectionTitle>
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
                <NumberRow label="Session duration" suffix="min" value={eDuration} onChange={setEDuration} />
                <Divider />
                <SubLabel>Sport</SubLabel>
                <SportPicker value={eSportId} onChange={setESportId} />
                <Divider />
                <SubLabel>Intensity</SubLabel>
                <IntensityPicker value={eIntensity} onChange={setEIntensity} />
                <Divider />
                <SubLabel>Sweat-sodium profile</SubLabel>
                <SodiumPicker value={eSodium} onChange={setESodium} />
                <Divider />
                <ToggleRow
                  label="Heat-acclimatized"
                  value={eAcclimatized}
                  onChange={setEAcclimatized}
                  hint="≥ 10 days of heat exposure / training in current climate"
                />
                <ClimateLine climate={climate} ambientTempC={ambientTempC} />
                <Helper>
                  Estimate path uses your sport&apos;s population-mean sweat rate
                  (Baker 2017) scaled by body surface area, intensity, and
                  climate. Measure with a scale for the most accurate number.
                </Helper>
              </Card>
            )}

            {validationError && (
              <View style={styles.errorRow} accessibilityLiveRegion="polite">
                <Icon name="alert-circle" size={14} color={Colors.states.DEPLETED.primary} />
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
                color={canCalculate ? Colors.text.inverse : Colors.text.muted}
              />
              <Text style={[styles.calcBtnText, !canCalculate && styles.calcBtnTextDisabled]}>
                Calculate
              </Text>
            </Pressable>

            {result && canCalculate && <ResultPane result={result} />}

            <Pressable
              onPress={() => setShowCitations((s) => !s)}
              style={styles.citationToggle}
              accessibilityRole="button"
            >
              <Icon
                name={showCitations ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={Colors.text.muted}
              />
              <Text style={styles.citationToggleText}>
                {showCitations ? 'Hide' : 'Show'} methodology &amp; citations
              </Text>
            </Pressable>
            {showCitations && <CitationCard />}
          </KeyboardAwareScrollViewCompat>
        </AdaptiveScreenWrapper>
      </GradientBackground>
    </View>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function num(s: string): number {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function ModeSegment({
  mode,
  onChange,
}: {
  mode: SweatInputMode;
  onChange: (m: SweatInputMode) => void;
}) {
  const items: { id: SweatInputMode; label: string }[] = [
    { id: 'quick', label: 'Quick' },
    { id: 'precision', label: 'Precision' },
    { id: 'estimate', label: 'Estimate' },
  ];
  return (
    <View style={styles.segment}>
      {items.map((it) => {
        const active = mode === it.id;
        return (
          <Pressable
            key={it.id}
            onPress={() => onChange(it.id)}
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

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subLabel}>{children}</Text>;
}

function Helper({ children }: { children: React.ReactNode }) {
  return <Text style={styles.helper}>{children}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function NumberRow({
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
          placeholder="0"
          placeholderTextColor={Colors.text.muted}
          accessibilityLabel={label}
        />
        <Text style={styles.numberSuffix}>{suffix}</Text>
      </View>
    </View>
  );
}

function SportPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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

function SodiumPicker({
  value,
  onChange,
}: {
  value: SodiumProfile;
  onChange: (v: SodiumProfile) => void;
}) {
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
              <View style={[styles.sodiumDotInner, active && { backgroundColor: Colors.states.BALANCED.primary }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sodiumLabel}>{b.label}</Text>
              <Text style={styles.sodiumDesc}>
                {b.mgPerLiter} mg/L sweat — {b.description}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function IntensityPicker({
  value,
  onChange,
}: {
  value: 1 | 2 | 3 | 4 | 5;
  onChange: (v: 1 | 2 | 3 | 4 | 5) => void;
}) {
  const labels = ['Light', 'Easy', 'Moderate', 'Hard', 'Max'];
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

function ToggleRow({
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
        thumbColor={Colors.text.primary}
        trackColor={{ true: Colors.states.BALANCED.primary, false: Colors.fill.medium }}
      />
    </View>
  );
}

function ClimateLine({ climate, ambientTempC }: { climate: CityClimate; ambientTempC: number }) {
  return (
    <View style={styles.climateLine}>
      <Icon name="sun" size={12} color={Colors.text.muted} />
      <Text style={styles.climateText}>
        Climate: {climate.city} · {Math.round(climate.tempF)}°F ({ambientTempC}°C) · {climate.humidityPct}% RH
      </Text>
    </View>
  );
}

/* ─── Result Pane — Sweat Intelligence v2 ──────────────────────────────
 * Nine spec cards (A–I), in order. Every card sources from the engine
 * output + inventory slice; nothing is hardcoded except the verbatim
 * positioning copy required by the upgrade brief.
 */
function ResultPane({ result }: { result: SweatSession }) {
  const inventory = useInventorySlice();
  const protocol = useMemo(
    () => pickRecoveryProtocol(result, inventory),
    [result, inventory],
  );

  return (
    <View style={styles.resultsWrap}>
      <PerformanceHeader result={result} />
      <RecoveryIntelligenceCard />
      <AForceSystemCard />
      <AIRecoveryDecision result={result} protocol={protocol} />
      <RecoveryProtocolCard protocol={protocol} result={result} />
      <SodiumGapCard result={result} />
      <OptionalSupportCard result={result} />
      <AdvancedDataCard result={result} />
      <ComparisonTable />
      <ShareCardHandoff result={result} />
    </View>
  );
}

/* ── A. Performance Header ──────────────────────────────────────────── */
function PerformanceHeader({ result }: { result: SweatSession }) {
  const bandColor = DEFICIT_COLOR[result.deficitBand] ?? Colors.text.primary;
  const bandSpec = DEFICIT_BANDS.find((b) => b.id === result.deficitBand);
  const sportLabel = result.audit.sport?.label;

  return (
    <View style={styles.heroCard}>
      <Text style={styles.heroEyebrow}>PERFORMANCE SUMMARY</Text>

      <View style={styles.heroNumbers}>
        <Text style={[styles.heroBig, { color: bandColor }]}>
          {result.deficitPct.toFixed(1)}
        </Text>
        <View style={{ marginLeft: 6 }}>
          <Text style={[styles.heroUnitTop, { color: bandColor }]}>%</Text>
          <Text style={styles.heroUnitBottom}>fluid deficit</Text>
        </View>
      </View>

      <View style={[styles.bandPill, { backgroundColor: bandColor, alignSelf: 'flex-start', marginTop: 6 }]}>
        <Text style={styles.bandPillText}>{bandSpec?.label ?? result.deficitBand}</Text>
      </View>

      <View style={styles.perfMetaRow}>
        <PerfMeta label="Sweat rate" value={`${result.sweatRateLh.toFixed(2)} L/h`} />
        <PerfMeta label="Total loss" value={`${result.sweatLossL.toFixed(2)} L`} />
        <PerfMeta label="Sodium loss" value={`${(result.sodiumLossMg / 1000).toFixed(2)} g`} />
      </View>

      {sportLabel && (
        <Text style={styles.heroSub}>{sportLabel}</Text>
      )}

      {result.audit.source === 'estimated' && (
        <View style={styles.estimatedBadge}>
          <Icon name="info" size={10} color={Colors.states.RECOVERING.primary} />
          <Text style={styles.estimatedBadgeText}>ESTIMATED — measure with scale for precision</Text>
        </View>
      )}

      <Text style={styles.intentionalSodiumLine}>
        AForce formula sodium: {AFORCE_SODIUM_PER_UNIT_MG}mg per serving — intentional by design
      </Text>
    </View>
  );
}

function PerfMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.perfMeta}>
      <Text style={styles.perfMetaValue}>{value}</Text>
      <Text style={styles.perfMetaLabel}>{label}</Text>
    </View>
  );
}

/* ── B. Recovery Intelligence — verbatim positioning copy ───────────── */
function RecoveryIntelligenceCard() {
  return (
    <View style={styles.intelCard}>
      <Text style={styles.intelEyebrow}>RECOVERY INTELLIGENCE</Text>
      <Text style={styles.intelHeadline}>
        Recovery is not driven by sodium alone.
      </Text>
      <Text style={styles.intelBody}>
        AForce uses {AFORCE_SODIUM_PER_UNIT_MG}mg of sodium paired with marine
        bioavailable minerals and pH 8.8 alkaline structuring to drive
        cellular recovery — not flood you with salt.
      </Text>
      <View style={styles.intelChipRow}>
        <View style={styles.intelChip}><Text style={styles.intelChipText}>{AFORCE_SODIUM_PER_UNIT_MG}mg sodium</Text></View>
        <View style={styles.intelChip}><Text style={styles.intelChipText}>Marine minerals</Text></View>
        <View style={styles.intelChip}><Text style={styles.intelChipText}>pH 8.8</Text></View>
      </View>
    </View>
  );
}

/* ── C. AForce System — 4 spec rows + 3 verbatim ingredient lines ───── */
function AForceSystemCard() {
  return (
    <View style={styles.systemCard}>
      <Text style={styles.cardEyebrow}>AFORCE SYSTEM</Text>

      <SystemRow k={`${AFORCE_SODIUM_PER_UNIT_MG}mg Sodium`} v="Per serving — controlled, not bombarding." />
      <SystemRow k="72 Trace Minerals" v="Marine source (Irish Seamoss)." />
      <SystemRow k="pH 8.8 Alkaline" v="Structured water for cellular uptake." />
      <SystemRow k="4-Hour Recovery Window" v="Time-released absorption profile." />

      <View style={styles.systemDivider} />

      <Text style={styles.systemSubhead}>Ingredient Detail</Text>
      <IngredientLine name="Irish Seamoss" line="Marine source of 72 trace minerals critical to cellular function." />
      <IngredientLine name="Chlorella" line="Binds heavy metals and supports oxygen transport." />
      <IngredientLine name="Atlantic Dulse" line="Iodine-rich for thyroid + metabolic recovery." />
    </View>
  );
}

function SystemRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.systemRow}>
      <Text style={styles.systemRowKey}>{k}</Text>
      <Text style={styles.systemRowValue}>{v}</Text>
    </View>
  );
}

function IngredientLine({ name, line }: { name: string; line: string }) {
  return (
    <View style={styles.ingredientRow}>
      <Text style={styles.ingredientName}>{name}</Text>
      <Text style={styles.ingredientLine}>{line}</Text>
    </View>
  );
}

/* ── D. AI Recovery Decision ────────────────────────────────────────── */
function AIRecoveryDecision({
  result,
  protocol,
}: {
  result: SweatSession;
  protocol: RecoveryProtocolPlan;
}) {
  const urgencyLabel =
    result.autopilot.urgency === 'critical' ? 'Critical recovery'
    : result.autopilot.urgency === 'high' ? 'High priority'
    : 'Steady recovery';

  const urgencyColor =
    result.autopilot.urgency === 'critical' ? Colors.states.DEPLETED.primary
    : result.autopilot.urgency === 'high' ? Colors.states.RECOVERING.primary
    : Colors.states.PEAK.primary;

  return (
    <View style={styles.aiCard}>
      <View style={styles.aiHeader}>
        <Icon name="cpu" size={14} color={urgencyColor} />
        <Text style={[styles.aiEyebrow, { color: urgencyColor }]}>AI RECOVERY DECISION</Text>
      </View>

      <Text style={styles.aiHeadline}>{urgencyLabel} · recheck every {result.autopilot.intervalMin} min</Text>

      <View style={styles.aiBullets}>
        <BulletRow text={`${result.deficitPct.toFixed(1)}% deficit triggered ${result.autopilot.urgency} cadence (${result.autopilot.recoveryWindowHours}h window).`} />
        <BulletRow text={`Sodium loss ${result.sodiumLossMg} mg → ${result.aforceSodiumTotalMg} mg delivered by ${result.prescription.aforceSticks} unit${result.prescription.aforceSticks === 1 ? '' : 's'}; gap ${result.sodiumGapMg} mg covered by structured-water absorption.`} />
        <BulletRow text={protocol.reasoning} />
      </View>
    </View>
  );
}

function BulletRow({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

/* ── E. Recovery Protocol — inventory-gated ─────────────────────────── */
function RecoveryProtocolCard({
  protocol,
  result,
}: {
  protocol: RecoveryProtocolPlan;
  result: SweatSession;
}) {
  if (protocol.reason === 'restock') {
    return (
      <View style={[styles.protocolCard, styles.protocolRestock]}>
        <Text style={styles.cardEyebrow}>RECOVERY PROTOCOL</Text>
        <Text style={styles.protocolHeadline}>{protocol.headline}</Text>
        <Text style={styles.protocolReasoning}>{protocol.reasoning}</Text>
        <Pressable
          style={styles.restockBtn}
          accessibilityRole="button"
          accessibilityLabel="Restock AForce — open AForce Fuel"
          testID="recovery-restock-cta"
          onPress={() => globalRouter.push('/store')}
        >
          <Icon name="shopping-bag" size={14} color={Colors.text.inverse} />
          <Text style={styles.restockBtnText}>Restock AForce</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.protocolCard}>
      <Text style={styles.cardEyebrow}>RECOVERY PROTOCOL · NEXT {result.prescription.windowHours}H</Text>
      <Text style={styles.protocolHeadline}>{protocol.headline}</Text>

      <View style={styles.protocolSteps}>
        {protocol.steps.map((s, i) => (
          <View key={`${s.productId}-${i}`} style={styles.protocolStep}>
            <View style={styles.protocolStepIdx}><Text style={styles.protocolStepIdxText}>{i + 1}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.protocolStepLabel}>{s.label}</Text>
              <Text style={styles.protocolStepHint}>{labelForProduct(s.productId)}</Text>
            </View>
          </View>
        ))}
        <View style={styles.protocolStep}>
          <View style={[styles.protocolStepIdx, { backgroundColor: Colors.fill.medium }]}>
            <Icon name="droplet" size={11} color={Colors.text.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.protocolStepLabel}>{protocol.waterOz} ounces water</Text>
            <Text style={styles.protocolStepHint}>Pair across the {result.autopilot.recoveryWindowHours}h window.</Text>
          </View>
        </View>
      </View>

      <Text style={styles.protocolReasoning}>{protocol.reasoning}</Text>
    </View>
  );
}

function labelForProduct(id: 'rtd' | 'stick' | 'canister'): string {
  if (id === 'rtd') return 'Ready-to-drink — fastest start.';
  if (id === 'stick') return 'Single-serve stick — pour into water.';
  return 'Canister scoop — bulk option.';
}

/* ── F. Optional Support ────────────────────────────────────────────── */
function OptionalSupportCard({ result }: { result: SweatSession }) {
  // Symptom-aware add-ons. Light, optional, never prescriptive — these
  // amplify the protocol when conditions warrant.
  const items: { icon: IconName; label: string; hint: string }[] = [];

  if (result.deficitPct >= 2) {
    items.push({ icon: 'moon', label: 'Cool-down rest', hint: '15–20 min low HR before next bout.' });
  }
  if (result.sodiumGapMg > 100) {
    items.push({ icon: 'coffee', label: 'Salty whole food', hint: 'Olives, broth, or pickle juice closes the sodium gap.' });
  }
  if (result.deficitBand === 'mild' || result.deficitBand === 'optimal') {
    items.push({ icon: 'sun', label: 'Daylight + slow breath', hint: 'Parasympathetic restart — accelerates absorption.' });
  } else {
    items.push({ icon: 'thermometer', label: 'Cooling shower', hint: 'Drop core temp 1–2°F to free up cardiac output.' });
  }

  return (
    <View style={styles.supportCard}>
      <Text style={styles.cardEyebrow}>OPTIONAL SUPPORT</Text>
      <View style={{ gap: 10 }}>
        {items.map((it, i) => (
          <View key={i} style={styles.supportRow}>
            <View style={styles.supportIcon}>
              <Icon name={it.icon} size={13} color={Colors.text.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.supportLabel}>{it.label}</Text>
              <Text style={styles.supportHint}>{it.hint}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={styles.supportFooter}>
        For higher-output sessions, add a small pinch of Celtic sea salt if needed.
      </Text>
    </View>
  );
}

/* ── E2. Sodium Gap Protocol — Celtic sea salt card ─────────────────── */
function SodiumGapCard({ result }: { result: SweatSession }) {
  return (
    <View style={styles.sodiumGapCard}>
      <Text style={styles.sodiumGapEyebrow}>⚡ SODIUM GAP PROTOCOL</Text>

      <View style={styles.sodiumGapRows}>
        <View style={styles.sodiumGapRow}>
          <Text style={styles.sodiumGapKey}>Your sweat sodium loss</Text>
          <Text style={styles.sodiumGapValue}>{result.sodiumLossMg} mg</Text>
        </View>
        <View style={styles.sodiumGapRow}>
          <Text style={styles.sodiumGapKey}>AForce provides</Text>
          <Text style={styles.sodiumGapValue}>{result.aforceSodiumTotalMg} mg</Text>
        </View>
        <View style={styles.sodiumGapRow}>
          <Text style={styles.sodiumGapKey}>Remaining gap</Text>
          <Text style={[styles.sodiumGapValue, styles.sodiumGapValueAccent]}>
            {result.sodiumGapMg} mg
          </Text>
        </View>
      </View>

      <Text style={styles.sodiumGapBody}>
        For sessions with high sodium loss add ¼ tsp of Celtic sea salt to your
        water between each AForce unit over the next 4 hours.
      </Text>
      <Text style={styles.sodiumGapNote}>
        Celtic sea salt is minimally processed and retains a broad spectrum of
        naturally occurring trace minerals. It is philosophically aligned with
        AForce — unprocessed and ocean-sourced like our algae ingredients.
      </Text>
    </View>
  );
}

/* ── G. Advanced Data — collapsible audit ───────────────────────────── */
function AdvancedDataCard({ result }: { result: SweatSession }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.advCard}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={styles.advHeader}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.cardEyebrow}>ADVANCED DATA</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.text.muted} />
      </Pressable>

      {open && (
        <View style={{ marginTop: 6 }}>
          <AuditRow k="Sweat-sodium concentration" v={`${result.sodiumConcentrationMgL} mg/L`} />
          <AuditRow k="Sodium profile assumed" v={result.sodiumProfile.replace('_', ' ')} />
          <AuditRow k="AForce sodium delivered" v={`${result.aforceSodiumTotalMg} mg (${result.prescription.aforceSticks} × ${AFORCE_SODIUM_PER_UNIT_MG} mg)`} />
          <AuditRow k="Sodium gap" v={`${result.sodiumGapMg} mg`} />
          {result.audit.sport && <AuditRow k="Sport reference" v={`${result.audit.sport.label} · ${result.audit.sport.meanSweatRateLh} L/h`} />}
          {result.audit.heatFactor !== undefined && <AuditRow k="Climate factor" v={`×${result.audit.heatFactor.toFixed(2)}`} />}
          {result.audit.acclimFactor !== undefined && <AuditRow k="Acclim. factor" v={`×${result.audit.acclimFactor.toFixed(2)}`} />}
          {result.audit.bsaM2 !== undefined && <AuditRow k="Body surface area" v={`${result.audit.bsaM2.toFixed(2)} m² (Du Bois)`} />}
          <AuditRow k="Method" v={result.audit.source === 'measured' ? 'Direct measurement (ACSM)' : 'Anchored estimate (Baker 2017)'} />
          <AuditRow k="Autopilot" v={`${result.autopilot.intervalMin} min · ${result.autopilot.urgency}`} />
        </View>
      )}
    </View>
  );
}

function AuditRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.auditRow}>
      <Text style={styles.auditKey}>{k}</Text>
      <Text style={styles.auditValue}>{v}</Text>
    </View>
  );
}

/* ── H. Comparison Table — the only brand-comparison surface ────────── */
const COMPARISON_ROWS: { brand: string; sodium: string; profile: string; you: boolean }[] = [
  { brand: 'AForce',     sodium: '25 mg',     profile: 'Marine · pH 8.8 · structured', you: true  },
  { brand: 'Gatorade',   sodium: '~270 mg',   profile: 'Sugar-driven · table salt',     you: false },
  { brand: 'LMNT',       sodium: '1000 mg',   profile: 'Salt-bomb · no minerals',       you: false },
  { brand: 'Liquid IV',  sodium: '~500 mg',   profile: 'Sugar + salt · no structuring', you: false },
];

function ComparisonTable() {
  return (
    <View style={styles.compareCard}>
      <Text style={styles.cardEyebrow}>HOW AFORCE COMPARES</Text>

      <View style={[styles.compareRow, styles.compareHead]}>
        <Text style={[styles.compareCell, styles.compareCellBrand, styles.compareHeadText]}>Brand</Text>
        <Text style={[styles.compareCell, styles.compareCellSodium, styles.compareHeadText]}>Sodium</Text>
        <Text style={[styles.compareCell, styles.compareCellProfile, styles.compareHeadText]}>Profile</Text>
      </View>

      {COMPARISON_ROWS.map((r) => (
        <View key={r.brand} style={[styles.compareRow, r.you && styles.compareRowYou]}>
          <View style={[styles.compareCellBrand, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
            <Text style={[styles.compareCell, r.you && styles.compareYouText]}>{r.brand}</Text>
            {r.you && (
              <View style={styles.youDot}><Text style={styles.youDotText}>YOU</Text></View>
            )}
          </View>
          <Text style={[styles.compareCell, styles.compareCellSodium, r.you && styles.compareYouText]}>{r.sodium}</Text>
          <Text style={[styles.compareCell, styles.compareCellProfile, r.you && styles.compareYouText]}>{r.profile}</Text>
        </View>
      ))}

      <Text style={styles.compareCloser}>
        More sodium is not always the goal. Better recovery is.
      </Text>
    </View>
  );
}

/* ── I. Share Card hand-off ─────────────────────────────────────────── */
function ShareCardHandoff({ result }: { result: SweatSession }) {
  const headline =
    result.deficitPct >= 4 ? 'Recovery on autopilot.'
    : result.deficitPct >= 2 ? 'Sodium gap closed — smarter, not saltier.'
    : 'Hydration held. Sweat decoded.';

  return (
    <Pressable style={styles.shareCard} accessibilityRole="button">
      <View style={styles.shareGlow} />

      <View style={styles.shareTriangleMark} pointerEvents="none">
        <Svg width={28} height={28} viewBox="0 0 28 28">
          <Defs>
            <SvgLinearGradient id="aforceTriGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={Colors.states.BALANCED.primary} stopOpacity="1" />
              <Stop offset="1" stopColor={Colors.states.PEAK.primary} stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
          <Polygon points="14,3 26,25 2,25" fill="url(#aforceTriGrad)" />
        </Svg>
      </View>

      <View style={styles.shareTopRow}>
        <View style={styles.shareDot} />
        <Text style={styles.shareEyebrow}>AFORCE · SWEAT SESSION</Text>
      </View>
      <Text style={styles.shareHeadline}>{headline}</Text>
      <Text style={styles.shareSub}>
        {result.deficitPct.toFixed(1)}% deficit · {result.prescription.aforceSticks} units · {result.autopilot.intervalMin} min recheck
      </Text>
      <View style={styles.shareCTA}>
        <Icon name="share-2" size={13} color={Colors.text.primary} />
        <Text style={styles.shareCTAText}>SHARE RECAP</Text>
      </View>

      <Text style={styles.shareUrl}>drinkaforce.com</Text>
    </Pressable>
  );
}

function CitationCard() {
  return (
    <View style={styles.citationCard}>
      <Text style={styles.citationTitle}>Methodology</Text>
      <Text style={styles.citationBody}>
        <Text style={styles.citationBold}>Sweat-rate formula (Quick &amp; Precision):</Text>{'\n'}
        Sweat (L) = (Pre-weight − Post-weight) + Fluid intake − Urine{'\n'}
        Sweat rate (L/h) = Sweat / duration (h){'\n'}
        Source: Sawka MN et al. 2007. ACSM Position Stand. Med Sci Sports Exerc 39(2):377–390.
      </Text>
      <Text style={styles.citationBody}>
        <Text style={styles.citationBold}>Hydration-deficit thresholds:</Text>{'\n'}
        &gt;2% body weight loss → measurable performance decline; &gt;4% → heat-illness risk.{'\n'}
        Sources: ACSM 2007 §C; Cheuvront SN, Kenefick RW. 2014. Compr Physiol 4(1):257–285.
      </Text>
      <Text style={styles.citationBody}>
        <Text style={styles.citationBold}>Sweat-sodium ranges:</Text>{'\n'}
        Population mean ≈ 50 mmol/L (1150 mg/L); range 200–2300 mg/L.{'\n'}
        Source: Baker LB. 2017. Sports Med 47(Suppl 1):111–128, Table 2.
      </Text>
      <Text style={styles.citationBody}>
        <Text style={styles.citationBold}>Replacement strategy:</Text>{'\n'}
        Replace 100–150% of fluid loss within 4–6 h post-exercise; pair sodium intake with fluid for full re-equilibration.{'\n'}
        Source: Sawka 2007 §G; Maughan RJ &amp; Shirreffs SM. 2010. Scand J Med Sci Sports 20(s2):31–42.
      </Text>
      <Text style={styles.citationBody}>
        <Text style={styles.citationBold}>Estimate path:</Text>{'\n'}
        Anchored to per-sport population-mean sweat rates (Baker 2017), scaled by Du Bois body-surface area, RPE-mapped intensity, USARIEM-style climate factors, and Périard 2015 acclimatization adjustment.
      </Text>
      <Text style={styles.citationDisclaimer}>
        Calibration target: ±15% of measured rate at moderate intensity, thermoneutral conditions. Always confirm with a scale for clinical decisions. Not a medical device.
      </Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 14 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.fill.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: Colors.states.BALANCED.primary,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: '700',
  },
  title: { color: Colors.text.primary, fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  subhead: { color: Colors.text.secondary, fontSize: 13, lineHeight: 18 },

  snapshotCard: {
    backgroundColor: Colors.background.card,
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
    fontWeight: '700',
  },
  snapshotConfidence: {
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  snapshotHeroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  snapshotHero: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: Colors.text.primary,
  },
  snapshotHeroUnit: {
    fontSize: 13,
    color: Colors.text.secondary,
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
    backgroundColor: Colors.border.medium,
    marginHorizontal: 8,
  },
  snapshotMetricLabel: {
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  snapshotMetricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  snapshotHint: {
    fontSize: 11,
    color: Colors.text.secondary,
    lineHeight: 15,
  },

  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.fill.light,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 9 },
  segmentBtnActive: { backgroundColor: Colors.background.elevated },
  segmentText: { color: Colors.text.secondary, fontSize: 13, fontWeight: '600', letterSpacing: 0.4 },
  segmentTextActive: { color: Colors.text.primary },

  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    gap: 10,
  },
  sectionTitle: {
    color: Colors.text.muted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: 4,
  },
  subLabel: {
    color: Colors.text.muted,
    fontSize: 11,
    letterSpacing: 1.0,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 6,
  },
  helper: {
    color: Colors.text.muted,
    fontSize: 11,
    lineHeight: 15,
    fontStyle: 'italic',
    marginTop: 4,
  },
  divider: { height: 1, backgroundColor: Colors.border.subtle, marginVertical: 4 },

  numberRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  numberLabel: { color: Colors.text.primary, fontSize: 14, flex: 1 },
  numberInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.fill.medium,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: 110,
  },
  numberInput: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    paddingVertical: 0,
    minWidth: 0,
  },
  numberSuffix: { color: Colors.text.muted, fontSize: 11, marginLeft: 6, fontWeight: '600' },

  chipRow: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.fill.light,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  chipActive: {
    backgroundColor: Colors.states.BALANCED.dim,
    borderColor: Colors.states.BALANCED.primary,
  },
  chipText: { color: Colors.text.secondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: Colors.text.primary },

  sodiumRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.fill.light,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'flex-start',
  },
  sodiumRowActive: {
    backgroundColor: Colors.states.BALANCED.dim,
    borderColor: Colors.states.BALANCED.primary,
  },
  sodiumDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  sodiumDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'transparent' },
  sodiumLabel: { color: Colors.text.primary, fontSize: 13, fontWeight: '700' },
  sodiumDesc: { color: Colors.text.muted, fontSize: 11, lineHeight: 14, marginTop: 2 },

  intensityRow: { flexDirection: 'row', gap: 6 },
  intensityBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.fill.light,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
  },
  intensityBtnActive: {
    backgroundColor: Colors.states.BALANCED.dim,
    borderColor: Colors.states.BALANCED.primary,
  },
  intensityNum: { color: Colors.text.secondary, fontSize: 18, fontWeight: '800' },
  intensityNumActive: { color: Colors.text.primary },
  intensityLabel: { color: Colors.text.muted, fontSize: 9, marginTop: 2, letterSpacing: 0.4, fontWeight: '700' },
  intensityLabelActive: { color: Colors.text.secondary },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' },
  toggleHint: { color: Colors.text.muted, fontSize: 11, marginTop: 2 },

  climateLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  climateText: { color: Colors.text.muted, fontSize: 11 },

  calcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.text.primary,
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
  calcBtnText: { color: Colors.text.inverse, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  calcBtnDisabled: { backgroundColor: Colors.fill.medium },
  calcBtnTextDisabled: { color: Colors.text.muted },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.background.elevated,
    borderWidth: 1,
    borderColor: Colors.states.DEPLETED.primary,
  },
  errorText: { color: Colors.text.primary, fontSize: 12, flex: 1, lineHeight: 16 },

  resultsWrap: { gap: 14, marginTop: 4 },

  heroCard: {
    backgroundColor: Colors.background.elevated,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  heroEyebrow: {
    color: Colors.states.BALANCED.primary,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '800',
  },
  heroNumbers: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 },
  heroBig: { color: Colors.text.primary, fontSize: 56, fontWeight: '800', lineHeight: 56, letterSpacing: -2 },
  heroUnitTop: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' },
  heroUnitBottom: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  heroSub: { color: Colors.text.secondary, fontSize: 12, marginTop: 8 },
  heroSubBold: { color: Colors.text.primary, fontWeight: '700' },
  estimatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.states.RECOVERING.dim,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 10,
  },
  estimatedBadgeText: {
    color: Colors.states.RECOVERING.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  intentionalSodiumLine: {
    color: Colors.text.muted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    fontStyle: 'italic',
  },

  // E2 — Sodium Gap Protocol (Celtic sea salt)
  sodiumGapCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderLeftWidth: 4,
    borderLeftColor: Colors.states.BALANCED.primary,
    gap: 10,
  },
  sodiumGapEyebrow: {
    color: Colors.states.BALANCED.primary,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: '800',
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
    color: Colors.text.secondary,
    fontSize: 12,
  },
  sodiumGapValue: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  sodiumGapValueAccent: {
    color: Colors.states.BALANCED.primary,
  },
  sodiumGapBody: {
    color: Colors.text.primary,
    fontSize: 13,
    lineHeight: 18,
  },
  sodiumGapNote: {
    color: Colors.text.muted,
    fontSize: 11,
    lineHeight: 15,
    fontStyle: 'italic',
  },

  bandCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    gap: 8,
  },
  bandHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bandPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  bandPillText: { color: Colors.text.inverse, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  bandPct: { fontSize: 28, fontWeight: '800' },
  bandMessage: { color: Colors.text.primary, fontSize: 13, lineHeight: 18 },
  bandReference: { color: Colors.text.muted, fontSize: 10, marginTop: 4 },

  rxCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.states.PEAK.primary,
  },
  rxEyebrow: {
    color: Colors.states.PEAK.primary,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '800',
  },
  rxHeadline: {
    color: Colors.text.primary,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 8,
    lineHeight: 22,
  },
  rxGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  rxStat: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: Colors.fill.light,
    padding: 12,
    borderRadius: 10,
  },
  rxStatValue: { color: Colors.text.primary, fontSize: 22, fontWeight: '800' },
  rxStatUnit: { color: Colors.text.muted, fontSize: 12, fontWeight: '600' },
  rxStatLabel: { color: Colors.text.muted, fontSize: 10, letterSpacing: 0.6, marginTop: 4, fontWeight: '700' },

  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.states.PEAK.primary,
    marginTop: 7,
  },
  bulletText: { color: Colors.text.secondary, fontSize: 12, lineHeight: 17, flex: 1 },

  auditCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  auditTitle: {
    color: Colors.text.muted,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: 8,
  },
  auditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    gap: 12,
  },
  auditKey: { color: Colors.text.secondary, fontSize: 11, flex: 1 },
  auditValue: { color: Colors.text.primary, fontSize: 11, fontWeight: '600', textAlign: 'right' },

  citationToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8 },
  citationToggleText: { color: Colors.text.muted, fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },

  citationCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    gap: 10,
  },
  citationTitle: {
    color: Colors.text.muted,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: 4,
  },
  citationBody: { color: Colors.text.secondary, fontSize: 11, lineHeight: 16 },
  citationBold: { color: Colors.text.primary, fontWeight: '700' },
  citationDisclaimer: {
    color: Colors.text.muted,
    fontSize: 10,
    lineHeight: 14,
    fontStyle: 'italic',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },

  // ── Sweat Intelligence v2 cards ───────────────────────────────────
  cardEyebrow: {
    color: Colors.text.muted,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '800',
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
    backgroundColor: Colors.fill.light,
    borderRadius: 10,
    padding: 10,
  },
  perfMetaValue: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  perfMetaLabel: {
    color: Colors.text.muted,
    fontSize: 9,
    letterSpacing: 0.8,
    fontWeight: '700',
    marginTop: 3,
    textTransform: 'uppercase',
  },

  // B — Recovery Intelligence
  intelCard: {
    backgroundColor: '#0A0B10',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.states.PEAK.primary,
  },
  intelEyebrow: {
    color: Colors.states.PEAK.primary,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '800',
  },
  intelHeadline: {
    color: Colors.text.primary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 28,
    marginTop: 10,
  },
  intelBody: {
    color: Colors.text.secondary,
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
    color: Colors.text.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // C — AForce System
  systemCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  systemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    gap: 12,
  },
  systemRowKey: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 0,
  },
  systemRowValue: {
    color: Colors.text.muted,
    fontSize: 11,
    textAlign: 'right',
    flex: 1,
  },
  systemDivider: { height: 14 },
  systemSubhead: {
    color: Colors.text.muted,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '800',
    marginBottom: 8,
  },
  ingredientRow: { paddingVertical: 6 },
  ingredientName: {
    color: Colors.text.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  ingredientLine: {
    color: Colors.text.secondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },

  // D — AI Recovery Decision
  aiCard: {
    backgroundColor: Colors.background.elevated,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
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
    fontWeight: '800',
  },
  aiHeadline: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 10,
  },
  aiBullets: { gap: 8 },

  // E — Recovery Protocol
  protocolCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.states.PEAK.primary,
  },
  protocolRestock: {
    borderColor: Colors.states.RECOVERING.primary,
  },
  protocolHeadline: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  protocolReasoning: {
    color: Colors.text.muted,
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
    backgroundColor: Colors.states.PEAK.dim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  protocolStepIdxText: {
    color: Colors.states.PEAK.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  protocolStepLabel: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  protocolStepHint: {
    color: Colors.text.muted,
    fontSize: 11,
    marginTop: 2,
  },
  restockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.text.primary,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 14,
  },
  restockBtnText: {
    color: Colors.text.inverse,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  // F — Optional Support
  supportCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  supportFooter: {
    color: Colors.text.muted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    fontStyle: 'italic',
  },
  supportIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.fill.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportLabel: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  supportHint: {
    color: Colors.text.muted,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },

  // G — Advanced Data
  advCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  advHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // H — Comparison Table
  compareCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    gap: 8,
  },
  compareHead: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  compareHeadText: {
    color: Colors.text.muted,
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  compareRowYou: {
    backgroundColor: Colors.states.PEAK.dim,
    borderRadius: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 0,
    marginVertical: 2,
  },
  compareCell: {
    color: Colors.text.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  compareCellBrand: { width: 92 },
  compareCellSodium: { width: 76 },
  compareCellProfile: { flex: 1 },
  compareYouText: {
    color: Colors.states.PEAK.primary,
    fontWeight: '800',
  },
  youDot: {
    backgroundColor: Colors.states.PEAK.primary,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  youDotText: {
    color: Colors.text.inverse,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  compareCloser: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '800',
    fontStyle: 'italic',
    letterSpacing: -0.1,
    lineHeight: 18,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
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
    backgroundColor: Colors.states.BALANCED.primary,
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
    fontWeight: '600',
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
    backgroundColor: Colors.states.BALANCED.primary,
  },
  shareEyebrow: {
    color: Colors.text.muted,
    fontSize: 10,
    letterSpacing: 2.4,
    fontWeight: '800',
  },
  shareHeadline: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 30,
    textTransform: 'uppercase',
  },
  shareSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    letterSpacing: 0.5,
    fontWeight: '600',
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
    color: Colors.text.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
