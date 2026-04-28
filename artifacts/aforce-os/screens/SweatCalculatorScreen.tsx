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
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { GradientBackground } from '@/components/GradientBackground';
import { Colors } from '@/theme/colors';
import {
  computeSweatSession,
  DEFICIT_BANDS,
  SODIUM_BANDS,
} from '@/services/sweatRateEngine';
import { SWEAT_SPORTS } from '@/data/sweatSports';
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

const DEFICIT_COLOR: Record<string, string> = {
  optimal: Colors.states.PEAK.primary,
  mild: Colors.states.BALANCED.primary,
  impaired: Colors.states.RECOVERING.primary,
  danger: Colors.states.DEPLETED.primary,
};

export default function SweatCalculatorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const [qDuration, setQDuration] = useState('60');
  const [qFluid, setQFluid] = useState('16');

  // Precision mode state.
  const [pPre, setPPre] = useState('170');
  const [pPost, setPPost] = useState('167');
  const [pDuration, setPDuration] = useState('90');
  const [pFluid, setPFluid] = useState('20');
  const [pUrine, setPUrine] = useState('0');
  const [pSportId, setPSportId] = useState('soccer');
  const [pAcclimatized, setPAcclimatized] = useState(false);
  const [pSodium, setPSodium] = useState<SodiumProfile>('moderate');

  // Estimate mode state.
  const [eWeight, setEWeight] = useState('170');
  const [eHeight, setEHeight] = useState('70');
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
      if (pre <= 0 || pre > 700) return 'Enter a pre-weight between 1 and 700 lbs.';
      if (post <= 0 || post > 700) return 'Enter a post-weight between 1 and 700 lbs.';
      if (post > pre + 5) return 'Post-weight is higher than pre-weight — check your numbers.';
      if (dur <= 0 || dur > 600) return 'Enter a duration between 1 and 600 minutes.';
      if (fluid < 0 || fluid > 500) return 'Fluid intake should be 0–500 oz.';
      return null;
    }
    if (mode === 'precision') {
      const pre = num(pPre);
      const post = num(pPost);
      const dur = num(pDuration);
      const fluid = num(pFluid);
      const urine = num(pUrine);
      if (pre <= 0 || pre > 700) return 'Enter a pre-weight between 1 and 700 lbs.';
      if (post <= 0 || post > 700) return 'Enter a post-weight between 1 and 700 lbs.';
      if (post > pre + 5) return 'Post-weight is higher than pre-weight — check your numbers.';
      if (dur <= 0 || dur > 600) return 'Enter a duration between 1 and 600 minutes.';
      if (fluid < 0 || fluid > 500) return 'Fluid intake should be 0–500 oz.';
      if (urine < 0 || urine > 100) return 'Urine output should be 0–100 oz.';
      return null;
    }
    const w = num(eWeight);
    const h = num(eHeight);
    const dur = num(eDuration);
    if (w <= 0 || w > 700) return 'Enter a body weight between 1 and 700 lbs.';
    if (h <= 0 || h > 96) return 'Enter a height between 1 and 96 inches.';
    if (dur <= 0 || dur > 600) return 'Enter a duration between 1 and 600 minutes.';
    return null;
  })();
  const canCalculate = validationError === null;

  function calculate() {
    if (!canCalculate) return;
    if (mode === 'quick') {
      const inputs: QuickInputs = {
        mode: 'quick',
        preWeight: num(qPre),
        postWeight: num(qPost),
        weightUnit: 'lbs',
        durationMinutes: num(qDuration),
        fluidIntake: num(qFluid),
        fluidUnit: 'oz',
      };
      setResult(computeSweatSession(inputs));
    } else if (mode === 'precision') {
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
      };
      setResult(computeSweatSession(inputs));
    } else {
      const inputs: EstimateInputs = {
        mode: 'estimate',
        bodyWeight: num(eWeight),
        weightUnit: 'lbs',
        height: num(eHeight),
        heightUnit: 'in',
        sportId: eSportId,
        durationMinutes: num(eDuration),
        intensity: eIntensity,
        ambientTempC,
        ambientHumidityPct: climate.humidityPct,
        acclimatized: eAcclimatized,
        sodiumProfile: eSodium,
      };
      setResult(computeSweatSession(inputs));
    }
  }

  const topPadding = Platform.OS === 'web' ? 24 : insets.top;

  return (
    <View style={styles.root}>
      <GradientBackground>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.content,
              { paddingTop: topPadding + 8, paddingBottom: insets.bottom + 32 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
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
                <Feather name="chevron-left" size={20} color={Colors.text.primary} />
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

            <ModeSegment mode={mode} onChange={setMode} />

            {mode === 'quick' && (
              <Card>
                <SectionTitle>Inputs</SectionTitle>
                <NumberRow label="Pre-weight" suffix="lbs" value={qPre} onChange={setQPre} />
                <NumberRow label="Post-weight" suffix="lbs" value={qPost} onChange={setQPost} />
                <NumberRow label="Duration" suffix="min" value={qDuration} onChange={setQDuration} />
                <NumberRow label="Fluid intake" suffix="oz" value={qFluid} onChange={setQFluid} />
                <Helper>Weigh nude or in dry clothing for accuracy. 1 lb of weight loss ≈ 16 oz of sweat.</Helper>
              </Card>
            )}

            {mode === 'precision' && (
              <Card>
                <SectionTitle>Inputs</SectionTitle>
                <NumberRow label="Pre-weight" suffix="lbs" value={pPre} onChange={setPPre} />
                <NumberRow label="Post-weight" suffix="lbs" value={pPost} onChange={setPPost} />
                <NumberRow label="Duration" suffix="min" value={pDuration} onChange={setPDuration} />
                <NumberRow label="Fluid intake" suffix="oz" value={pFluid} onChange={setPFluid} />
                <NumberRow label="Urine output" suffix="oz" value={pUrine} onChange={setPUrine} />
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
                <NumberRow label="Body weight" suffix="lbs" value={eWeight} onChange={setEWeight} />
                <NumberRow label="Height" suffix="in" value={eHeight} onChange={setEHeight} />
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
                <Feather name="alert-circle" size={14} color={Colors.states.DEPLETED.primary} />
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
              <Feather
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
              <Feather
                name={showCitations ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={Colors.text.muted}
              />
              <Text style={styles.citationToggleText}>
                {showCitations ? 'Hide' : 'Show'} methodology &amp; citations
              </Text>
            </Pressable>
            {showCitations && <CitationCard />}
          </ScrollView>
        </KeyboardAvoidingView>
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
      <Feather name="sun" size={12} color={Colors.text.muted} />
      <Text style={styles.climateText}>
        Climate: {climate.city} · {Math.round(climate.tempF)}°F ({ambientTempC}°C) · {climate.humidityPct}% RH
      </Text>
    </View>
  );
}

function ResultPane({ result }: { result: SweatSession }) {
  const bandColor = DEFICIT_COLOR[result.deficitBand] ?? Colors.text.primary;
  const bandSpec = DEFICIT_BANDS.find((b) => b.id === result.deficitBand);

  return (
    <View style={styles.resultsWrap}>
      {/* Hero — sweat rate */}
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>SWEAT RATE</Text>
        <View style={styles.heroNumbers}>
          <Text style={styles.heroBig}>{result.sweatRateLh.toFixed(2)}</Text>
          <View style={{ marginLeft: 6 }}>
            <Text style={styles.heroUnitTop}>L/h</Text>
            <Text style={styles.heroUnitBottom}>{Math.round(result.sweatRateOzh)} oz/h</Text>
          </View>
        </View>
        <Text style={styles.heroSub}>
          Total loss this session: <Text style={styles.heroSubBold}>{result.sweatLossL.toFixed(2)} L</Text>
          {' '}· Sodium: <Text style={styles.heroSubBold}>{(result.sodiumLossMg / 1000).toFixed(2)} g</Text>
        </Text>
        {result.audit.source === 'estimated' && (
          <View style={styles.estimatedBadge}>
            <Feather name="info" size={10} color={Colors.states.RECOVERING.primary} />
            <Text style={styles.estimatedBadgeText}>ESTIMATED — measure with scale for precision</Text>
          </View>
        )}
      </View>

      {/* Hydration deficit band */}
      <View style={[styles.bandCard, { borderColor: bandColor }]}>
        <View style={styles.bandHeader}>
          <View style={[styles.bandPill, { backgroundColor: bandColor }]}>
            <Text style={styles.bandPillText}>{bandSpec?.label ?? result.deficitBand}</Text>
          </View>
          <Text style={[styles.bandPct, { color: bandColor }]}>
            {result.deficitPct.toFixed(1)}%
          </Text>
        </View>
        <Text style={styles.bandMessage}>{bandSpec?.message}</Text>
        <Text style={styles.bandReference}>
          ACSM 2007 thresholds: &lt;1% optimal · 2% impaired · 4%+ danger
        </Text>
      </View>

      {/* Prescription */}
      <View style={styles.rxCard}>
        <Text style={styles.rxEyebrow}>AFORCE PRESCRIPTION · NEXT {result.prescription.windowHours}H</Text>
        <Text style={styles.rxHeadline}>{result.prescription.headline}</Text>

        <View style={styles.rxGrid}>
          <RxStat label="Sticks" value={String(result.prescription.aforceSticks)} unit="" />
          <RxStat label="Pair Water" value={String(result.prescription.pairWaterOz)} unit="oz" />
          <RxStat label="Sodium" value={String(result.prescription.replacementSodiumMg)} unit="mg" />
          <RxStat label="Per-hr next time" value={String(result.prescription.ongoingOzPerHour)} unit="oz/h" />
        </View>

        <View style={{ marginTop: 12, gap: 6 }}>
          {result.prescription.rationale.map((r, i) => (
            <View key={i} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>{r}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Audit */}
      <View style={styles.auditCard}>
        <Text style={styles.auditTitle}>Session detail</Text>
        <AuditRow k="Sweat-sodium concentration" v={`${result.sodiumConcentrationMgL} mg/L`} />
        <AuditRow k="Sodium profile assumed" v={result.sodiumProfile.replace('_', ' ')} />
        {result.audit.sport && <AuditRow k="Sport reference" v={`${result.audit.sport.label} · ${result.audit.sport.meanSweatRateLh} L/h (${result.audit.sport.citation})`} />}
        {result.audit.heatFactor !== undefined && <AuditRow k="Climate factor" v={`×${result.audit.heatFactor.toFixed(2)}`} />}
        {result.audit.acclimFactor !== undefined && <AuditRow k="Acclim. factor" v={`×${result.audit.acclimFactor.toFixed(2)}`} />}
        {result.audit.bsaM2 !== undefined && <AuditRow k="Body surface area (Du Bois)" v={`${result.audit.bsaM2.toFixed(2)} m²`} />}
        <AuditRow k="Method" v={result.audit.source === 'measured' ? 'Direct measurement (ACSM)' : 'Anchored estimate (Baker 2017)'} />
      </View>
    </View>
  );
}

function RxStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.rxStat}>
      <Text style={styles.rxStatValue}>
        {value}
        {unit ? <Text style={styles.rxStatUnit}> {unit}</Text> : null}
      </Text>
      <Text style={styles.rxStatLabel}>{label}</Text>
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
});
