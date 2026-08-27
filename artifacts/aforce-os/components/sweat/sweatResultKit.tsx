/**
 * sweatResultKit — S2-9b: the Sweat result pane and its card family,
 * byte-moved from SweatCalculatorScreenV2.tsx.
 *
 * ONE-WAY CHAIN: screen -> sweatResultKit -> sweatKit (styles). This file
 * must never import from the screen (pinned by `sweatKitS29b.test.ts`).
 * ResultPane and CitationCard are the screen's entry points; every other
 * card is private.
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

import { styles } from './sweatKit';

const DEFICIT_COLOR: Record<string, string> = {
  optimal: af.green,
  mild: af.cyan,
  impaired: af.amber,
  danger: af.red,
};

export function ResultPane({ result }: { result: SweatSession }) {
  const { t } = useTranslation();
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const inventory = useInventorySlice();
  const protocol = useMemo(
    () => pickRecoveryProtocol(result, inventory),
    [result, inventory],
  );

  return (
    <View style={styles.resultsWrap}>
      {result.qualification?.status === 'limited' && (
        <Text style={styles.qualLimitedNote} testID="sweat-qual-limited">
          {t('sweat.v2.qual_limited_note')}
        </Text>
      )}
      {/* S2-9: ten equal cards → one hero (the reading), one command
          (decision + protocol), two quiet disclosures, share. The
          founder-commissioned positioning copy (Recovery Intelligence,
          AForce System, comparison) moves BEHIND a tap — evicted from the
          computed-result surface, preserved verbatim inside it. */}
      <PerformanceHeader result={result} />
      <AIRecoveryDecision result={result} protocol={protocol} />
      <RecoveryProtocolCard protocol={protocol} result={result} />

      <AFListRow
        icon="bar-chart-2"
        title={t('sweat.v2.full_analysis_title')}
        subtitle={t('sweat.v2.full_analysis_hint')}
        disclosure
        onPress={() => setAnalysisOpen(true)}
        testID="sweat-full-analysis"
      />
      <AFListRow
        icon="info"
        title={t('sweat.v2.why_aforce_title')}
        subtitle={t('sweat.v2.why_aforce_hint')}
        disclosure
        onPress={() => setWhyOpen(true)}
        testID="sweat-why-aforce"
      />

      <ShareCardHandoff result={result} />

      <AFDisclosureSheet
        visible={analysisOpen}
        onClose={() => setAnalysisOpen(false)}
        title={t('sweat.v2.full_analysis_title')}
        testID="sweat-analysis-sheet"
      >
        <SodiumGapCard result={result} />
        <OptionalSupportCard result={result} />
        <AdvancedDataCard result={result} />
      </AFDisclosureSheet>

      <AFDisclosureSheet
        visible={whyOpen}
        onClose={() => setWhyOpen(false)}
        title={t('sweat.v2.why_aforce_title')}
        testID="sweat-why-sheet"
      >
        <RecoveryIntelligenceCard />
        <AForceSystemCard />
        <ComparisonTable />
      </AFDisclosureSheet>
    </View>
  );
}

/* ── A. Performance Header ──────────────────────────────────────────── */
function PerformanceHeader({ result }: { result: SweatSession }) {
  const { t } = useTranslation();
  const bandColor = DEFICIT_COLOR[result.deficitBand] ?? af.textPrimary;
  const bandSpec = DEFICIT_BANDS.find((b) => b.id === result.deficitBand);
  const sportLabel = result.audit.sport?.label;

  return (
    <View style={styles.heroCard}>
      <Text style={styles.heroEyebrow}>{t('sweat.v2.perf_eyebrow')}</Text>

      <View style={styles.heroNumbers}>
        <Text style={[styles.heroBig, { color: bandColor }]}>
          {result.deficitPct.toFixed(1)}
        </Text>
        <View style={{ marginLeft: 6 }}>
          <Text style={[styles.heroUnitTop, { color: bandColor }]}>{t('sweat.v2.perf_deficit_unit')}</Text>
          <Text style={styles.heroUnitBottom}>{t('sweat.v2.perf_fluid_deficit')}</Text>
        </View>
      </View>

      <View style={[styles.bandPill, { backgroundColor: bandColor, alignSelf: 'flex-start', marginTop: 6 }]}>
        <Text style={styles.bandPillText}>{bandSpec?.label ?? result.deficitBand}</Text>
      </View>

      <View style={styles.perfMetaRow}>
        <PerfMeta label={t('sweat.v2.perf_sweat_rate')} value={t('sweat.v2.unit_lh', { value: result.sweatRateLh.toFixed(2) })} />
        <PerfMeta label={t('sweat.v2.perf_total_loss')} value={t('sweat.v2.unit_l', { value: result.sweatLossL.toFixed(2) })} />
        <PerfMeta label={t('sweat.v2.perf_sodium_loss')} value={t('sweat.v2.unit_g', { value: (result.sodiumLossMg / 1000).toFixed(2) })} />
      </View>

      {sportLabel && (
        <Text style={styles.heroSub}>{sportLabel}</Text>
      )}

      {result.audit.source === 'estimated' && (
        <View style={styles.estimatedBadge}>
          <Icon name="info" size={10} color={af.amber} />
          <Text style={styles.estimatedBadgeText}>{t('sweat.v2.perf_estimated_badge')}</Text>
        </View>
      )}

      <Text style={styles.intentionalSodiumLine}>
        {t('sweat.v2.perf_formula_note', { mg: AFORCE_SODIUM_PER_UNIT_MG })}
      </Text>
    </View>
  );
}

function PerfMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.perfMeta} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={styles.perfMetaValue}>{value}</Text>
      <Text style={styles.perfMetaLabel}>{label}</Text>
    </View>
  );
}

/* ── B. Recovery Intelligence — verbatim positioning copy ───────────── */
function RecoveryIntelligenceCard() {
  const { t } = useTranslation();
  return (
    <View style={styles.intelCard}>
      <Text style={styles.intelEyebrow}>{t('sweat.v2.ri_eyebrow')}</Text>
      <Text style={styles.intelHeadline}>{t('sweat.v2.ri_headline')}</Text>
      <Text style={styles.intelBody}>{t('sweat.v2.ri_body', { mg: AFORCE_SODIUM_PER_UNIT_MG })}</Text>
      <View style={styles.intelChipRow}>
        <View style={styles.intelChip}><Text style={styles.intelChipText}>{t('sweat.v2.ri_chip_sodium', { mg: AFORCE_SODIUM_PER_UNIT_MG })}</Text></View>
        <View style={styles.intelChip}><Text style={styles.intelChipText}>{t('sweat.v2.ri_chip_minerals')}</Text></View>
        <View style={styles.intelChip}><Text style={styles.intelChipText}>{t('sweat.v2.ri_chip_ph')}</Text></View>
      </View>
    </View>
  );
}

/* ── C. AForce System — 4 spec rows + 3 verbatim ingredient lines ───── */
function AForceSystemCard() {
  const { t } = useTranslation();
  return (
    <View style={styles.systemCard}>
      <Text style={styles.cardEyebrow}>{t('sweat.v2.sys_eyebrow')}</Text>

      <SystemRow k={t('sweat.v2.sys_sodium_k', { mg: AFORCE_SODIUM_PER_UNIT_MG })} v={t('sweat.v2.sys_sodium_v')} />
      <SystemRow k={t('sweat.v2.sys_minerals_k')} v={t('sweat.v2.sys_minerals_v')} />
      <SystemRow k={t('sweat.v2.sys_ph_k')} v={t('sweat.v2.sys_ph_v')} />

      <View style={styles.systemDivider} />

      <Text style={styles.systemSubhead}>{t('sweat.v2.sys_ingredient_detail')}</Text>
      <IngredientLine name={t('sweat.v2.ing_seamoss_name')} line={t('sweat.v2.ing_seamoss_line')} />
      <IngredientLine name={t('sweat.v2.ing_chlorella_name')} line={t('sweat.v2.ing_chlorella_line')} />
      <IngredientLine name={t('sweat.v2.ing_dulse_name')} line={t('sweat.v2.ing_dulse_line')} />
    </View>
  );
}

function SystemRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.systemRow} accessible accessibilityLabel={`${k} ${v}`}>
      <Text style={styles.systemRowKey}>{k}</Text>
      <Text style={styles.systemRowValue}>{v}</Text>
    </View>
  );
}

function IngredientLine({ name, line }: { name: string; line: string }) {
  return (
    <View style={styles.ingredientRow} accessible accessibilityLabel={`${name} ${line}`}>
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
  const { t } = useTranslation();
  const urgencyLabel =
    result.autopilot.urgency === 'critical' ? t('sweat.v2.ai_urgency_critical')
    : result.autopilot.urgency === 'high' ? t('sweat.v2.ai_urgency_high')
    : t('sweat.v2.ai_urgency_steady');

  const urgencyColor =
    result.autopilot.urgency === 'critical' ? af.red
    : result.autopilot.urgency === 'high' ? af.amber
    : af.green;

  return (
    <View style={styles.aiCard}>
      <View style={styles.aiHeader}>
        <Icon name="cpu" size={14} color={urgencyColor} />
        <Text style={[styles.aiEyebrow, { color: urgencyColor }]}>{t('sweat.v2.ai_eyebrow')}</Text>
      </View>

      <Text style={styles.aiHeadline}>{t('sweat.v2.ai_subhead', { urgency: urgencyLabel, min: result.autopilot.intervalMin })}</Text>

      <View style={styles.aiBullets}>
        <BulletRow text={t('sweat.v2.ai_reason', { pct: result.deficitPct.toFixed(1), urgency: result.autopilot.urgency, hours: result.autopilot.recoveryWindowHours })} />
        <BulletRow text={t(result.prescription.aforceSticks === 1 ? 'sweat.v2.ai_sodium_line_one' : 'sweat.v2.ai_sodium_line_other', { loss: result.sodiumLossMg, delivered: result.aforceSodiumTotalMg, sticks: result.prescription.aforceSticks, gap: result.sodiumGapMg })} />
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
  const { t } = useTranslation();
  if (protocol.reason === 'restock') {
    return (
      <View style={[styles.protocolCard, styles.protocolRestock]}>
        <Text style={styles.cardEyebrow}>{t('sweat.v2.rp_eyebrow')}</Text>
        <Text style={styles.protocolHeadline}>{protocol.headline}</Text>
        <Text style={styles.protocolReasoning}>{protocol.reasoning}</Text>
        <Pressable
          style={styles.restockBtn}
          accessibilityRole="button"
          accessibilityLabel={t('sweat.v2.rp_restock_a11y')}
          testID="recovery-restock-cta"
          onPress={() => globalRouter.push('/store')}
        >
          <Icon name="shopping-bag" size={14} color={af.onRed} />
          <Text style={styles.restockBtnText}>{t('sweat.v2.rp_restock_btn')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.protocolCard}>
      <Text style={styles.cardEyebrow}>{t('sweat.v2.rp_eyebrow_next', { hours: result.prescription.windowHours })}</Text>
      <Text style={styles.protocolHeadline}>{protocol.headline}</Text>

      <View style={styles.protocolSteps}>
        {protocol.steps.map((s, i) => (
          <View key={`${s.productId}-${i}`} style={styles.protocolStep}>
            <View style={styles.protocolStepIdx}><Text style={styles.protocolStepIdxText}>{i + 1}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.protocolStepLabel}>{s.label}</Text>
              <Text style={styles.protocolStepHint}>{t(`sweat.v2.${labelForProductKey(s.productId)}`)}</Text>
            </View>
          </View>
        ))}
        <View style={styles.protocolStep}>
          <View style={[styles.protocolStepIdx, { backgroundColor: af.surface }]}>
            <Icon name="droplet" size={11} color={af.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.protocolStepLabel}>{t('sweat.v2.rp_water', { oz: protocol.waterOz })}</Text>
            <Text style={styles.protocolStepHint}>{t('sweat.v2.rp_pair', { hours: result.autopilot.recoveryWindowHours })}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.protocolReasoning}>{protocol.reasoning}</Text>
    </View>
  );
}

/** Product id → sweat.v2.product_* key suffix (translated at the call site). */
function labelForProductKey(id: 'rtd' | 'stick' | 'canister'): string {
  if (id === 'rtd') return 'product_rtd';
  if (id === 'stick') return 'product_stick';
  return 'product_canister';
}

/* ── F. Optional Support ────────────────────────────────────────────── */
function OptionalSupportCard({ result }: { result: SweatSession }) {
  // Symptom-aware add-ons. Light, optional, never prescriptive — these
  // amplify the protocol when conditions warrant.
  const { t } = useTranslation();
  const items: { icon: IconName; label: string; hint: string }[] = [];

  if (result.deficitPct >= 2) {
    items.push({ icon: 'moon', label: t('sweat.v2.opt_cooldown_label'), hint: t('sweat.v2.opt_cooldown_hint') });
  }
  if (result.sodiumGapMg > 100) {
    items.push({ icon: 'coffee', label: t('sweat.v2.opt_salty_label'), hint: t('sweat.v2.opt_salty_hint') });
  }
  if (result.deficitBand === 'mild' || result.deficitBand === 'optimal') {
    items.push({ icon: 'sun', label: t('sweat.v2.opt_daylight_label'), hint: t('sweat.v2.opt_daylight_hint') });
  } else {
    items.push({ icon: 'thermometer', label: t('sweat.v2.opt_shower_label'), hint: t('sweat.v2.opt_shower_hint') });
  }

  return (
    <View style={styles.supportCard}>
      <Text style={styles.cardEyebrow}>{t('sweat.v2.opt_eyebrow')}</Text>
      <View style={{ gap: 10 }}>
        {items.map((it, i) => (
          <View key={i} style={styles.supportRow}>
            <View style={styles.supportIcon}>
              <Icon name={it.icon} size={13} color={af.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.supportLabel}>{it.label}</Text>
              <Text style={styles.supportHint}>{it.hint}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={styles.supportFooter}>{t('sweat.v2.opt_footer')}</Text>
    </View>
  );
}

/* ── E2. Sodium Gap Protocol — Celtic sea salt card ─────────────────── */
function SodiumGapCard({ result }: { result: SweatSession }) {
  const { t } = useTranslation();
  return (
    <View style={styles.sodiumGapCard}>
      <Text style={styles.sodiumGapEyebrow}>{t('sweat.v2.gap_eyebrow')}</Text>

      <View style={styles.sodiumGapRows}>
        <View style={styles.sodiumGapRow}>
          <Text style={styles.sodiumGapKey}>{t('sweat.v2.gap_loss_k')}</Text>
          <Text style={styles.sodiumGapValue}>{t('sweat.v2.unit_mg', { value: result.sodiumLossMg })}</Text>
        </View>
        <View style={styles.sodiumGapRow}>
          <Text style={styles.sodiumGapKey}>{t('sweat.v2.gap_provides_k')}</Text>
          <Text style={styles.sodiumGapValue}>{t('sweat.v2.unit_mg', { value: result.aforceSodiumTotalMg })}</Text>
        </View>
        <View style={styles.sodiumGapRow}>
          <Text style={styles.sodiumGapKey}>{t('sweat.v2.gap_remaining_k')}</Text>
          <Text style={[styles.sodiumGapValue, styles.sodiumGapValueAccent]}>
            {t('sweat.v2.unit_mg', { value: result.sodiumGapMg })}
          </Text>
        </View>
      </View>

      <Text style={styles.sodiumGapBody}>{t('sweat.v2.gap_body')}</Text>
      <Text style={styles.sodiumGapNote}>{t('sweat.v2.gap_note')}</Text>
    </View>
  );
}

/* ── G. Advanced Data — collapsible audit ───────────────────────────── */
function AdvancedDataCard({ result }: { result: SweatSession }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.advCard}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={styles.advHeader}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.cardEyebrow}>{t('sweat.v2.adv_eyebrow')}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={af.textTertiary} />
      </Pressable>

      {open && (
        <View style={{ marginTop: 6 }}>
          <AuditRow k={t('sweat.v2.adv_concentration_k')} v={t('sweat.v2.unit_mgl', { value: result.sodiumConcentrationMgL })} />
          <AuditRow k={t('sweat.v2.adv_profile_k')} v={result.sodiumProfile.replace('_', ' ')} />
          <AuditRow k={t('sweat.v2.adv_delivered_k')} v={t('sweat.v2.adv_delivered_v', { total: result.aforceSodiumTotalMg, sticks: result.prescription.aforceSticks, per: AFORCE_SODIUM_PER_UNIT_MG })} />
          <AuditRow k={t('sweat.v2.adv_gap_k')} v={t('sweat.v2.unit_mg', { value: result.sodiumGapMg })} />
          {result.audit.sport && <AuditRow k={t('sweat.v2.adv_sport_ref_k')} v={t('sweat.v2.adv_sport_ref_v', { label: result.audit.sport.label, rate: result.audit.sport.meanSweatRateLh })} />}
          {result.audit.heatFactor !== undefined && <AuditRow k={t('sweat.v2.adv_climate_k')} v={`×${result.audit.heatFactor.toFixed(2)}`} />}
          {result.audit.acclimFactor !== undefined && <AuditRow k={t('sweat.v2.adv_acclim_k')} v={`×${result.audit.acclimFactor.toFixed(2)}`} />}
          {result.audit.bsaM2 !== undefined && <AuditRow k={t('sweat.v2.adv_bsa_k')} v={t('sweat.v2.adv_bsa_v', { value: result.audit.bsaM2.toFixed(2) })} />}
          <AuditRow k={t('sweat.v2.adv_method_k')} v={result.audit.source === 'measured' ? t('sweat.v2.adv_method_direct') : t('sweat.v2.adv_method_estimate')} />
          <AuditRow k={t('sweat.v2.adv_autopilot_k')} v={t('sweat.v2.adv_autopilot_v', { min: result.autopilot.intervalMin, urgency: result.autopilot.urgency })} />
        </View>
      )}
    </View>
  );
}

function AuditRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.auditRow} accessible accessibilityLabel={`${k} ${v}`}>
      <Text style={styles.auditKey}>{k}</Text>
      <Text style={styles.auditValue}>{v}</Text>
    </View>
  );
}

/* ── H. Comparison Table — the only brand-comparison surface ────────── */
// brand + sodium are DATA; `profileKey` resolves the descriptive profile
// column under sweat.v2.cmp_profile_* at render (authored English copy).
const COMPARISON_ROWS: { brand: string; sodium: string; profileKey: string; you: boolean }[] = [
  // Categories, not named brands (CR-1 ER-3): avoids Lanham/disparagement and
  // per-brand claims we can't source. Sodium values are category-typical (~), not
  // brand-specific. profileKey names are legacy identifiers; their copy is generic.
  { brand: 'AForce',            sodium: '25 mg',    profileKey: 'cmp_profile_aforce',    you: true  },
  { brand: 'Sports drinks', sodium: '~200 mg',  profileKey: 'cmp_profile_gatorade',  you: false },
  { brand: 'Salt mixes',    sodium: '~1000 mg', profileKey: 'cmp_profile_lmnt',      you: false },
  { brand: 'ORS mixes',     sodium: '~500 mg',  profileKey: 'cmp_profile_liquid_iv', you: false },
];

function ComparisonTable() {
  const { t } = useTranslation();
  return (
    <View style={styles.compareCard}>
      <Text style={styles.cardEyebrow}>{t('sweat.v2.cmp_eyebrow')}</Text>

      <View style={[styles.compareRow, styles.compareHead]}>
        <Text style={[styles.compareCell, styles.compareCellBrand, styles.compareHeadText]}>{t('sweat.v2.cmp_brand')}</Text>
        <Text style={[styles.compareCell, styles.compareCellSodium, styles.compareHeadText]}>{t('sweat.v2.cmp_sodium')}</Text>
        <Text style={[styles.compareCell, styles.compareCellProfile, styles.compareHeadText]}>{t('sweat.v2.cmp_profile')}</Text>
      </View>

      {COMPARISON_ROWS.map((r) => (
        <View key={r.brand} style={[styles.compareRow, r.you && styles.compareRowYou]}>
          <View style={[styles.compareCellBrand, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
            <Text style={[styles.compareCell, r.you && styles.compareYouText]}>{r.brand}</Text>
            {r.you && (
              <View style={styles.youDot}><Text style={styles.youDotText}>{t('sweat.v2.cmp_you')}</Text></View>
            )}
          </View>
          <Text style={[styles.compareCell, styles.compareCellSodium, r.you && styles.compareYouText]}>{r.sodium}</Text>
          <Text style={[styles.compareCell, styles.compareCellProfile, r.you && styles.compareYouText]}>{t(`sweat.v2.${r.profileKey}`)}</Text>
        </View>
      ))}

      <Text style={styles.compareCloser}>{t('sweat.v2.cmp_closer')}</Text>
    </View>
  );
}

/* ── I. Share Card hand-off ─────────────────────────────────────────── */
function ShareCardHandoff({ result }: { result: SweatSession }) {
  const { t } = useTranslation();
  const headline =
    result.deficitPct >= 4 ? t('sweat.v2.share_headline_autopilot')
    : result.deficitPct >= 2 ? t('sweat.v2.share_headline_gap')
    : t('sweat.v2.share_headline_default');

  return (
    <Pressable style={styles.shareCard} accessibilityRole="button">
      <View style={styles.shareGlow} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden />

      <View
        style={styles.shareTriangleMark}
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Svg width={28} height={28} viewBox="0 0 28 28">
          <Defs>
            <SvgLinearGradient id="aforceTriGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={af.cyan} stopOpacity="1" />
              <Stop offset="1" stopColor={af.green} stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
          <Polygon points="14,3 26,25 2,25" fill="url(#aforceTriGrad)" />
        </Svg>
      </View>

      <View style={styles.shareTopRow}>
        <View style={styles.shareDot} />
        <Text style={styles.shareEyebrow}>{t('sweat.v2.share_eyebrow')}</Text>
      </View>
      <Text style={styles.shareHeadline}>{headline}</Text>
      <Text style={styles.shareSub}>
        {t('sweat.v2.share_summary', { pct: result.deficitPct.toFixed(1), units: result.prescription.aforceSticks, min: result.autopilot.intervalMin })}
      </Text>
      <View style={styles.shareCTA}>
        <Icon name="share-2" size={13} color={af.textPrimary} />
        <Text style={styles.shareCTAText}>{t('sweat.v2.share_cta')}</Text>
      </View>

      <Text style={styles.shareUrl}>drinkaforce.com</Text>
    </Pressable>
  );
}

export function CitationCard() {
  const { t } = useTranslation();
  return (
    <View style={styles.citationCard}>
      <Text style={styles.citationTitle}>{t('sweat.v2.cite_title')}</Text>
      <Text style={styles.citationBody}>
        <Text style={styles.citationBold}>{t('sweat.v2.cite_formula_heading')}</Text>{'\n'}
        {t('sweat.v2.cite_formula_1')}{'\n'}
        {t('sweat.v2.cite_formula_2')}{'\n'}
        {t('sweat.v2.cite_formula_source')}
      </Text>
      <Text style={styles.citationBody}>
        <Text style={styles.citationBold}>{t('sweat.v2.cite_thresholds_heading')}</Text>{'\n'}
        {t('sweat.v2.cite_thresholds_body')}{'\n'}
        {t('sweat.v2.cite_thresholds_source')}
      </Text>
      <Text style={styles.citationBody}>
        <Text style={styles.citationBold}>{t('sweat.v2.cite_ranges_heading')}</Text>{'\n'}
        {t('sweat.v2.cite_ranges_body')}{'\n'}
        {t('sweat.v2.cite_ranges_source')}
      </Text>
      <Text style={styles.citationBody}>
        <Text style={styles.citationBold}>{t('sweat.v2.cite_strategy_heading')}</Text>{'\n'}
        {t('sweat.v2.cite_strategy_body')}{'\n'}
        {t('sweat.v2.cite_strategy_source')}
      </Text>
      <Text style={styles.citationBody}>
        <Text style={styles.citationBold}>{t('sweat.v2.cite_estimate_heading')}</Text>{'\n'}
        {t('sweat.v2.cite_estimate_body')}
      </Text>
      <Text style={styles.citationDisclaimer}>{t('sweat.v2.cite_calibration')}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
