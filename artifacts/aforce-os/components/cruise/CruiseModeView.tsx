/**
 * CRUISE MODE (redesign) — pure presentational component.
 *
 * No store, flag, navigation, or data access — everything arrives via props.
 * Renders the resolved `CruiseModeView` in the Black Issue language (PR 3,
 * 2026-10-07): AFMasthead, the GUEST READINESS numeral over a red progress
 * hairline, YOUR NEXT MOVE, the one red "Log water" CTA, then the existing
 * environment / day / recovery / checklist / badge / shortcut sections as
 * AFSectionLabel + hairline rows. Status colours (readiness state dot, heat
 * index, source pill, recovery tone) stay system-sourced via `TONE` (D3).
 *
 * Interactivity is prop-driven: the container owns all state. Self-log controls
 * emit `onLogChange(patch)`; the container merges + re-resolves.
 */

import React from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator,
  type StyleProp, type ViewStyle,
} from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { CommandConfidenceBadge } from '@/components/CommandConfidenceBadge';
import { AFMasthead } from '@/components/ui/AFMasthead';
import { AFSectionLabel } from '@/components/ui/AFSectionLabel';
import { useAFEyebrowType } from '@/hooks/useAFEyebrowType';
import { useAFGutter } from '@/hooks/useAFGutter';
import { Colors } from '@/theme/colors';
import { af, afType, afLayout, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme/afTokens';
import type { CommandConfidenceLevel } from '@/types';
import {
  nextGuestType,
  type CruiseModeView as CruiseModeViewModel,
  type CruiseTone,
  type CruiseSelfLog,
  type CruiseDeckExposure,
  type CruiseExcursionRisk,
  type CruiseDayMode,
} from '@/services/cruise/cruiseModeView';

const TONE: Record<CruiseTone, string> = {
  green: af.green,
  cyan: af.cyan,
  amber: af.amber,
  red: af.redText,
  neutral: af.textSecondary,
};

const DECK_CYCLE: CruiseDeckExposure[] = ['indoor', 'mixed', 'outdoor'];
const RISK_CYCLE: CruiseExcursionRisk[] = ['none', 'low', 'moderate', 'high'];

export interface CruiseCrossNavItem {
  key: string;
  icon: IconName;
  label: string;
  hint: string;
}

export interface CruiseModeViewProps {
  view: CruiseModeViewModel;
  log: CruiseSelfLog;
  ports: ReadonlyArray<{ id: string; label: string }>;
  selectedPortId: string;
  crossNav: ReadonlyArray<CruiseCrossNavItem>;
  /**
   * Section 58 — already-computed Command Confidence™ level, or null to hide
   * (flag off / no level yet). Anchors to the Guest Readiness card — the
   * recommendation OUTPUT — never an input-data card (founder ruling
   * 2026-07-18). The container reads flag + hook; this stays props-only.
   */
  confidence?: CommandConfidenceLevel | null;
  onBack: () => void;
  onSelectPort: (id: string) => void;
  onLogWater: () => void;
  onLogChange: (patch: Partial<CruiseSelfLog>) => void;
  onNavigate: (key: string) => void;
}

// ─── Small primitives ────────────────────────────────────────────────────────

/**
 * Black Issue section: red mono eyebrow over a hairline (AFSectionLabel), an
 * optional quiet one-line hint beneath it, then the content. The hint sits on
 * its own line rather than in the label row so it reflows at large Dynamic
 * Type instead of colliding with the label.
 */
function SectionBlock({
  label, hint, children, testID,
}: { label: string; hint?: string | null; children: React.ReactNode; testID?: string }) {
  return (
    <View style={styles.section} testID={testID}>
      <AFSectionLabel label={label} />
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

/** A bordered tile — kept for grouped content that is not a list (env cells, badges, alerts). */
function Tile({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.tile, style]}>{children}</View>;
}

/**
 * The Black Issue CTA shape (AFPrimaryButton / AFSecondaryButton: red fill,
 * label left, "+" flush right, 52pt, radius 10) as a plain Pressable. AFButton
 * is not imported because it rides AFMotionPressable → reanimated/worklets,
 * which the non-shipping render harness (cruiseModeView.render.test.tsx — a
 * lock file) cannot load. The container already fires the success haptic, so
 * nothing is lost; swap to AFPrimaryButton when the harness can mount it.
 */
function CtaButton({
  label, onPress, disabled, trailingIcon, testID,
}: { label: string; onPress?: () => void; disabled?: boolean; trailingIcon?: IconName; testID: string }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.ctaBtn,
        disabled ? styles.ctaBtnPreview : styles.ctaBtnLive,
        pressed && !disabled && styles.ctaBtnPressed,
      ]}
    >
      <Text style={[styles.ctaLabel, { color: disabled ? af.textTertiary : af.onRed }]}>{label}</Text>
      {trailingIcon ? <Icon name={trailingIcon} size={18} color={disabled ? af.textTertiary : af.onRed} /> : null}
    </Pressable>
  );
}

function Rule() {
  return <View style={styles.rule} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}

function Stepper({
  value, unit, onStep, testID,
}: { value: number; unit: string; onStep: (delta: number) => void; testID: string }) {
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => onStep(-1)}
        style={styles.stepBtn}
        accessibilityRole="button"
        accessibilityLabel={`Decrease, currently ${value}${unit}`}
        testID={`${testID}-minus`}
      >
        <Icon name="minus" size={14} color={af.textPrimary} />
      </Pressable>
      <Text style={styles.stepValue}>{value}{unit}</Text>
      <Pressable
        onPress={() => onStep(1)}
        style={styles.stepBtn}
        accessibilityRole="button"
        accessibilityLabel={`Increase, currently ${value}${unit}`}
        testID={`${testID}-plus`}
      >
        <Icon name="plus" size={14} color={af.textPrimary} />
      </Pressable>
    </View>
  );
}

// ─── Sections ────────────────────────────────────────────────────────────────

/** "Guest readiness" caption → "Guest readiness" for the screen reader (the caption itself is shown in caps). */
function sentenceCase(s: string): string {
  return s.length ? s.charAt(0) + s.slice(1).toLowerCase() : s;
}

/**
 * GUEST READINESS — mono label, the readiness numeral, a red progress hairline
 * on a grey track (score / 100), then the quiet "{state word} · {confidence}"
 * line. The label and numeral are ONE spoken element; the progress track is
 * decoration (the number is the information).
 */
function ReadinessBlock({ view, confidence }: { view: CruiseModeViewModel; confidence?: CommandConfidenceLevel | null }) {
  const r = view.readiness;
  const tone = TONE[r.tone];
  const building = r.posture === 'building';
  const eyebrowType = useAFEyebrowType();
  const spoken = building
    ? `${sentenceCase(r.ring.caption)}, signal still building`
    : `${sentenceCase(r.ring.caption)}, ${r.scoreLabel} out of 100`;
  return (
    <View style={styles.readiness}>
      {!view.reducedMotion && !building ? (
        <View testID="cruise-hero-glow" style={[styles.heroGlow, { backgroundColor: tone }]} />
      ) : null}

      <View accessible accessibilityRole="text" accessibilityLabel={spoken}>
        <Text style={[styles.readinessLabel, eyebrowType]}>{r.ring.caption}</Text>
        <View style={styles.numeralRow}>
          <Text
            style={[styles.numeral, building && { color: af.textSecondary }]}
            maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
            testID="cruise-readiness-score"
          >
            {r.scoreLabel}
          </Text>
          {!building ? <Text style={[styles.numeralScale, eyebrowType]}>/ 100</Text> : null}
        </View>
      </View>

      {/* Readiness fill — a slim, honest progress hairline (no SVG). Decorative. */}
      <View
        style={styles.track}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[styles.trackFill, { width: `${Math.round(r.ring.progress * 100)}%` }]} />
      </View>

      <View style={styles.stateRow}>
        {/* The system status colour rides on the dot; the word carries the meaning. */}
        <View style={[styles.stateDot, { backgroundColor: tone }]} />
        <Text style={[styles.stateWord, eyebrowType]}>{r.statusLabel}</Text>
        {confidence ? (
          <>
            <Text style={styles.stateSep} accessibilityElementsHidden importantForAccessibility="no">·</Text>
            {/* Command Confidence anchors to the recommendation OUTPUT (this
                Guest Readiness readout), not an input-data card (founder ruling
                2026-07-18). Near-black pill keeps the monochrome ramp on the
                exact surface it was tuned for (PR #285/#288) — reference the
                token, not a literal, so it tracks if background.card moves. */}
            <View style={styles.confidencePill} testID="cruise-confidence">
              <CommandConfidenceBadge level={confidence} />
            </View>
          </>
        ) : null}
      </View>
      {r.recheckLabel || r.usesLiveConditions ? (
        <Text style={styles.recheck}>
          {[r.recheckLabel, r.usesLiveConditions ? 'adjusted for live conditions' : null].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * YOUR NEXT MOVE — red eyebrow, the existing command as the bold statement, and
 * the conditions line built ONLY from the live environment cells that exist
 * (offline / loading → no line; nothing is invented).
 */
function NextMoveBlock({ view }: { view: CruiseModeViewModel }) {
  const r = view.readiness;
  const cells = view.environment.cells;
  const temp = cells.find((c) => c.key === 'temp');
  const heat = cells.find((c) => c.key === 'heat');
  const sun = cells.find((c) => c.key === 'sun');
  const heatAccent = heat?.accentTone ? TONE[heat.accentTone] : undefined;
  const parts: Array<{ key: string; text: string; accent?: string }> = [];
  if (temp) parts.push({ key: 'temp', text: temp.value });
  if (heat) parts.push({ key: 'heat', text: `${heat.label} ${heat.value}`, accent: heatAccent });
  if (sun) parts.push({ key: 'sun', text: `${sun.value} ${sun.label.toLowerCase()}` });
  return (
    <View style={styles.nextMove} testID="cruise-next-move">
      <AFSectionLabel label="Your next move" rule={false} />
      <Text style={styles.command}>{r.recommendation}</Text>
      {parts.length ? (
        <Text style={styles.conditions} testID="cruise-conditions">
          {parts.map((p, i) => (
            <Text key={p.key} style={p.accent ? { color: p.accent } : null}>
              {i > 0 ? ' · ' : ''}{p.text}
            </Text>
          ))}
        </Text>
      ) : null}
    </View>
  );
}

function EnvironmentBlock({
  view, ports, selectedPortId, onSelectPort,
}: {
  view: CruiseModeViewModel;
  ports: CruiseModeViewProps['ports'];
  selectedPortId: string;
  onSelectPort: (id: string) => void;
}) {
  const env = view.environment;
  const srcTone = TONE[env.source.tone];
  const eyebrowType = useAFEyebrowType();
  return (
    <View style={styles.blockGap}>
      <View style={styles.liveStrip}>
        <View style={[styles.sourcePill, { borderColor: srcTone + '88' }]} testID={`cruise-source-${env.source.key}`}>
          {env.source.key === 'loading' ? (
            <ActivityIndicator size="small" color={srcTone} />
          ) : (
            <View style={[styles.sourceDot, { backgroundColor: srcTone }]} />
          )}
          <Text style={[styles.sourcePillText, eyebrowType, { color: srcTone }]}>{env.source.label}</Text>
        </View>
        <Text style={styles.liveStripCaption}>{env.source.caption}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.portRow}>
        {ports.map((p) => {
          const active = p.id === selectedPortId;
          return (
            <Pressable
              key={p.id}
              onPress={() => onSelectPort(p.id)}
              style={[styles.portChip, active && styles.portChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Port ${p.label}`}
              testID={`cruise-port-${p.id}`}
            >
              <Icon name="map-pin" size={11} color={active ? af.redText : af.textTertiary} />
              <Text style={[styles.portChipText, active && styles.portChipTextActive]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {env.hasLiveData ? (
        <View style={styles.envGrid}>
          {env.cells.map((c) => {
            const accent = c.accentTone ? TONE[c.accentTone] : undefined;
            return (
              <Tile key={c.key} style={styles.envCell}>
                <View style={styles.envCellInner} testID={`cruise-env-${c.key}`}>
                  <View style={styles.envLabelRow}>
                    <Icon name={c.icon as IconName} size={12} color={accent ?? af.textTertiary} />
                    <Text style={[styles.envLabel, eyebrowType]}>{c.label}</Text>
                  </View>
                  <Text style={[styles.envValue, accent ? { color: accent } : null]}>{c.value}</Text>
                </View>
              </Tile>
            );
          })}
        </View>
      ) : (
        <View style={styles.envEmpty}>
          <Icon name="cloud-off" size={16} color={af.textTertiary} />
          <Text style={styles.envEmptyText}>
            {env.source.key === 'loading'
              ? 'Loading live port conditions…'
              : 'Live conditions are unavailable right now. Your readiness still reflects your hydration.'}
          </Text>
        </View>
      )}

      {env.journeyIntensity ? (
        <View style={[styles.inlineBanner, { borderColor: TONE[env.journeyIntensity.tone] + '88' }]}>
          <Icon name="activity" size={13} color={TONE[env.journeyIntensity.tone]} />
          <Text style={styles.inlineBannerText}>
            Journey Intensity: <Text style={{ color: TONE[env.journeyIntensity.tone] }}>{env.journeyIntensity.label}</Text>
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function DayBlock({
  view, log, onLogChange,
}: { view: CruiseModeViewModel; log: CruiseSelfLog; onLogChange: (p: Partial<CruiseSelfLog>) => void; }) {
  const day = view.day;
  const cycle = <T,>(arr: T[], cur: T): T => arr[(arr.indexOf(cur) + 1) % arr.length];
  const guestLabel = day.rows.find((r) => r.id === 'guest_type')?.value ?? 'Not set';
  const deckLabel = day.rows.find((r) => r.id === 'deck')?.value ?? '';

  return (
    <View style={styles.blockGap}>
      {/* Day-mode toggle */}
      <View style={styles.segRow}>
        {(['sea_day', 'port_day'] as CruiseDayMode[]).map((m) => {
          const active = day.dayMode === m;
          return (
            <Pressable
              key={m}
              onPress={() => onLogChange({ dayMode: m })}
              style={[styles.segBtn, active && styles.segBtnActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              testID={`cruise-daymode-${m}`}
            >
              <Text style={[styles.segText, active && styles.segTextActive]}>
                {m === 'sea_day' ? 'Sea Day' : 'Port Day'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Suggested rhythm (labelled template — not the guest's real schedule) */}
      <Text style={styles.rhythmCaption}>Suggested {day.dayModeLabel.toLowerCase()} rhythm</Text>
      <View style={styles.flowRow}>
        {day.rhythm.map((beat, i, arr) => (
          <React.Fragment key={beat}>
            <View style={styles.flowBeat}>
              <View style={styles.flowDot} />
              <Text style={styles.flowBeatLabel}>{beat}</Text>
            </View>
            {i < arr.length - 1 ? <View style={styles.flowConnector} /> : null}
          </React.Fragment>
        ))}
      </View>

      {day.emptyHint ? (
        <View style={styles.hintBox}>
          <Icon name="edit-3" size={13} color={af.textSecondary} />
          <Text style={styles.hintText}>{day.emptyHint}</Text>
        </View>
      ) : null}

      {/* Self-log controls */}
      <View style={styles.logGroup}>
        <LogControl
          icon="user" label="Guest type" value={guestLabel} set={log.guestType != null}
          // Cycles through every type AND back to "Not set" (nextGuestType) —
          // self-report stays reversible; a mistaken tap is never stuck logged.
          onPress={() => onLogChange({ guestType: nextGuestType(log.guestType) })}
          testID="cruise-log-guest"
        />
        <LogControl
          icon={log.deckExposure === 'outdoor' ? 'sun' : 'home'} label="Sun exposure" value={deckLabel} set={log.deckExposure !== 'mixed'}
          onPress={() => onLogChange({ deckExposure: cycle(DECK_CYCLE, log.deckExposure) })}
          testID="cruise-log-deck"
        />
        {day.dayMode === 'port_day' ? (
          <LogControl
            icon="map" label="Excursion intensity" value={log.excursionRisk === 'none' ? 'None' : log.excursionRisk[0].toUpperCase() + log.excursionRisk.slice(1)} set={log.excursionRisk !== 'none'}
            onPress={() => onLogChange({ excursionRisk: cycle(RISK_CYCLE, log.excursionRisk) })}
            testID="cruise-log-risk"
          />
        ) : null}
        <LogStepperRow
          icon="droplet" label="Pool / deck time" value={log.poolHours} unit=" hr"
          onStep={(d) => onLogChange({ poolHours: Math.max(0, log.poolHours + d) })}
          testID="cruise-log-pool"
        />
        <LogStepperRow
          icon="coffee" label="Drinks" value={log.alcoholDrinks} unit=""
          tone={log.alcoholDrinks >= 3 ? af.amber : undefined}
          onStep={(d) => onLogChange({ alcoholDrinks: Math.max(0, log.alcoholDrinks + d) })}
          testID="cruise-log-drinks"
        />
        <LogStepperRow
          icon="map" label="Excursion time" value={log.excursionHours} unit=" hr"
          onStep={(d) => onLogChange({ excursionHours: Math.max(0, log.excursionHours + d) })}
          testID="cruise-log-excursion"
        />
      </View>
      <Text style={styles.selfReportNote}>You control every value here. Nothing is logged for you.</Text>
    </View>
  );
}

function LogControl({
  icon, label, value, set, onPress, testID,
}: { icon: IconName; label: string; value: string; set: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable onPress={onPress} style={styles.logRow} accessibilityRole="button" accessibilityLabel={`${label}: ${value}. Tap to change.`} testID={testID}>
      <View style={styles.logIcon}><Icon name={icon} size={14} color={af.textSecondary} /></View>
      <Text style={styles.logLabel}>{label}</Text>
      <Text style={[styles.logValue, !set && styles.logValueMuted]}>{value}</Text>
      <Icon name="chevron-right" size={14} color={af.textTertiary} />
    </Pressable>
  );
}

function LogStepperRow({
  icon, label, value, unit, onStep, testID, tone,
}: { icon: IconName; label: string; value: number; unit: string; onStep: (d: number) => void; testID: string; tone?: string }) {
  return (
    <View style={styles.logRow}>
      <View style={styles.logIcon}><Icon name={icon} size={14} color={af.textSecondary} /></View>
      <Text style={styles.logLabel}>{label}</Text>
      <Stepper value={value} unit={unit} onStep={onStep} testID={testID} />
      {tone ? <View style={[styles.logFlag, { backgroundColor: tone }]} /> : null}
    </View>
  );
}

function RecoveryBlock({ view }: { view: CruiseModeViewModel }) {
  const rec = view.recovery;
  const tone = TONE[rec.tone];
  const eyebrowType = useAFEyebrowType();
  if (!rec.hasSignal) {
    return (
      <View style={styles.recoveryEmpty}>
        <Icon name="check-circle" size={16} color={af.green} />
        <Text style={styles.recoveryEmptyText}>{rec.emptyCopy}</Text>
      </View>
    );
  }
  return (
    <Tile style={{ borderColor: tone + '88' }}>
      <View style={styles.riskHeader}>
        <View style={styles.riskCopy}>
          <Text style={[styles.riskLabel, eyebrowType]}>COMPOSITE RECOVERY DEMAND</Text>
          <Text style={[styles.riskValue, { color: tone }]}>{rec.riskLabel}</Text>
        </View>
        <View style={[styles.riskBadge, { borderColor: tone + '88' }]}>
          <Icon name={rec.tone === 'red' ? 'alert-octagon' : 'activity'} size={16} color={tone} />
        </View>
      </View>
      {rec.reasons.length ? (
        <View style={styles.reasonList}>
          {rec.reasons.map((reason, i) => (
            <View key={i} style={styles.reasonItem}>
              <View style={[styles.reasonDot, { backgroundColor: tone }]} />
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Tile>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────

export function CruiseModeView({
  view, log, ports, selectedPortId, crossNav, confidence,
  onBack, onSelectPort, onLogWater, onLogChange, onNavigate,
}: CruiseModeViewProps) {
  const gutter = useAFGutter();
  const eyebrowType = useAFEyebrowType();
  // Masthead right meta: the selected port, only when the port is known. The
  // view model carries no port-local clock (the fetch time already rides the
  // source strip below), so no time is shown rather than the device's.
  const portMeta = view.environment.portName || undefined;
  const water = view.logWater;
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}
      showsVerticalScrollIndicator={false}
      testID="cruise-mode-view"
    >
      <AFMasthead
        meta={portMeta}
        breadcrumb={`${view.header.title} / ${view.day.dayModeLabel}`}
        title={`${view.header.title}.`}
        subtitle={view.header.subtitle}
        onBack={onBack}
        testID="cruise"
      />

      <Rule />
      <ReadinessBlock view={view} confidence={confidence} />
      <Rule />
      <NextMoveBlock view={view} />

      {/* Real self-report water CTA (or honest preview) */}
      <View style={styles.cta}>
        {water.available ? (
          <CtaButton label={water.label} onPress={onLogWater} trailingIcon="plus" testID="cruise-log-water" />
        ) : (
          <CtaButton label={water.previewNote ?? 'Preview'} disabled testID="cruise-log-water" />
        )}
      </View>

      <SectionBlock label="Ship environment" hint={view.environment.portName || 'Live port conditions'}>
        <EnvironmentBlock view={view} ports={ports} selectedPortId={selectedPortId} onSelectPort={onSelectPort} />
      </SectionBlock>

      <SectionBlock label="Your day" hint="Self-logged · you control it">
        <DayBlock view={view} log={log} onLogChange={onLogChange} />
      </SectionBlock>

      <SectionBlock label="Recovery demand">
        <RecoveryBlock view={view} />
      </SectionBlock>

      <SectionBlock label="Port day checklist" hint="Before you leave the ship">
        <View>
          {view.checklist.map((item) => (
            <View key={item.id} style={styles.checklistRow}>
              <View style={styles.listIcon}><Icon name={item.icon as IconName} size={14} color={af.textSecondary} /></View>
              <Text style={styles.checklistLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </SectionBlock>

      <SectionBlock label="Guest engagement" hint="Cruise wellness badges">
        <View style={styles.badgeGrid}>
          {view.badges.map((b) => (
            <Tile key={b.id} style={styles.badgeCell}>
              <View style={styles.badgeIcon}><Icon name="award" size={16} color={af.textSecondary} /></View>
              <Text style={styles.badgeTitle}>{b.title}</Text>
              <Text style={styles.badgeHint}>{b.hint}</Text>
            </Tile>
          ))}
        </View>
      </SectionBlock>

      <SectionBlock label="Connect to" hint="Cross-feature shortcuts">
        <View>
          {crossNav.map((n) => (
            <Pressable
              key={n.key}
              onPress={() => onNavigate(n.key)}
              style={({ pressed }) => [styles.navRow, pressed && styles.navRowPressed]}
              accessibilityRole="button"
              accessibilityLabel={n.label}
              testID={`cruise-nav-${n.key}`}
            >
              <View style={styles.listIcon}><Icon name={n.icon} size={14} color={af.textSecondary} /></View>
              <View style={styles.navCopy}>
                <Text style={styles.navLabel}>{n.label}</Text>
                <Text style={styles.navHint}>{n.hint}</Text>
              </View>
              <Icon name="chevron-right" size={14} color={af.textTertiary} />
            </Pressable>
          ))}
        </View>
      </SectionBlock>

      {/* Tier label — the former header eyebrow, relocated (preserved, not dropped). */}
      <Text style={[styles.tier, eyebrowType]} testID="cruise-tier">{view.header.eyebrow}</Text>

      {/* Compliance disclaimer — always renders */}
      <View style={styles.disclaimer} accessibilityRole="text">
        <Text style={styles.disclaimerText}>{view.disclaimer}</Text>
      </View>
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: af.canvas },
  content: { paddingTop: 8, paddingBottom: 48 },

  rule: { height: afLayout.hairline, backgroundColor: af.divider, marginVertical: 20 },

  // Section (AFSectionLabel + quiet hint + body)
  section: { marginTop: 32 },
  sectionHint: { ...afType.caption, color: af.textTertiary, marginTop: 8 },
  sectionBody: { marginTop: 14 },
  blockGap: { gap: 14 },

  tile: {
    backgroundColor: af.surface, borderRadius: afLayout.radiusCard,
    borderWidth: afLayout.hairline, borderColor: af.border, padding: afLayout.cardPadding,
  },

  // Readiness block
  readiness: { overflow: 'hidden' },
  heroGlow: {
    position: 'absolute', top: 6, left: '50%', marginLeft: -110, width: 220, height: 220,
    borderRadius: 110, opacity: 0.08, pointerEvents: 'none',
  },
  readinessLabel: { ...afType.eyebrow, color: af.textTertiary },
  numeralRow: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', flexWrap: 'wrap',
    columnGap: 8, marginTop: 8,
  },
  numeral: { ...afType.displayScore, color: af.textPrimary, fontVariant: ['tabular-nums'], textAlign: 'center' },
  numeralScale: { ...afType.eyebrow, color: af.textTertiary },
  track: {
    height: 4, borderRadius: 2, backgroundColor: af.divider, overflow: 'hidden', marginTop: 20,
  },
  trackFill: { height: 4, borderRadius: 2, backgroundColor: af.red },
  stateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
    columnGap: 8, rowGap: 6, marginTop: 14,
  },
  stateDot: { width: 6, height: 6, borderRadius: 3 },
  stateWord: { ...afType.eyebrow, color: af.textSecondary, flexShrink: 1 },
  stateSep: { ...afType.secondary, color: af.textTertiary },
  recheck: { ...afType.caption, color: af.textTertiary, textAlign: 'center', marginTop: 8 },
  // The exact surface the §58 confidence ramp is tuned for (#285/#288).
  confidencePill: {
    backgroundColor: Colors.background.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: afLayout.radiusPill,
  },

  // Next move
  nextMove: { gap: 10 },
  command: { ...afType.title2, color: af.textPrimary },
  conditions: { ...afType.secondary, color: af.textSecondary },

  // CTA
  cta: { marginTop: 28 },
  ctaBtn: {
    minHeight: afLayout.buttonHeight, borderRadius: afLayout.radiusButton, paddingHorizontal: 20, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', columnGap: 12,
  },
  ctaBtnLive: { backgroundColor: af.red },
  ctaBtnPreview: { backgroundColor: af.surface, borderWidth: 1, borderColor: af.border },
  ctaBtnPressed: { opacity: 0.85 },
  ctaLabel: { ...afType.bodyStrong, flexShrink: 1 },

  // Live env strip
  liveStrip: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 12, rowGap: 6 },
  sourcePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: afLayout.radiusPill, borderWidth: 1,
  },
  sourceDot: { width: 6, height: 6, borderRadius: 3 },
  sourcePillText: { ...afType.micro, fontSize: 11, lineHeight: 14 },
  liveStripCaption: { ...afType.caption, color: af.textTertiary, flexShrink: 1 },

  // Port chips
  portRow: { gap: 8, paddingRight: 8 },
  portChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: afLayout.radiusPill, borderWidth: 1, borderColor: af.border,
    minHeight: 44,
  },
  portChipActive: { borderColor: af.red },
  portChipText: { ...afType.caption, color: af.textSecondary },
  portChipTextActive: { color: af.textPrimary, fontFamily: afType.bodyStrong.fontFamily },

  // Env grid
  envGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  envCell: { width: '31%', flexGrow: 1, minWidth: 104, padding: 12 },
  envCellInner: { gap: 6 },
  envLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  envLabel: { ...afType.micro, fontSize: 10, color: af.textTertiary, textTransform: 'uppercase', flexShrink: 1 },
  envValue: { ...afType.title3, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  envEmpty: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 6 },
  envEmptyText: { ...afType.caption, color: af.textSecondary, flex: 1 },
  inlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: afLayout.radiusCard, borderWidth: 1, minHeight: 44,
  },
  inlineBannerText: { ...afType.caption, color: af.textSecondary, flex: 1 },

  // Day / self-log
  segRow: { flexDirection: 'row', gap: 8 },
  segBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9,
    borderRadius: afLayout.radiusPill, borderWidth: 1, borderColor: af.border, minHeight: 44,
  },
  segBtnActive: { borderColor: af.red },
  segText: { ...afType.caption, color: af.textSecondary },
  segTextActive: { color: af.textPrimary, fontFamily: afType.bodyStrong.fontFamily },
  rhythmCaption: { ...afType.caption, color: af.textTertiary },
  flowRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', rowGap: 8 },
  flowBeat: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: afLayout.radiusPill, borderWidth: 1, borderColor: af.border,
  },
  flowDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: af.textSecondary },
  flowBeatLabel: { ...afType.caption, color: af.textPrimary, fontSize: 12 },
  flowConnector: { width: 10, height: 1, backgroundColor: af.divider, marginHorizontal: 2 },
  hintBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 12,
    borderRadius: afLayout.radiusCard, borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  hintText: { ...afType.caption, color: af.textSecondary, flex: 1 },
  logGroup: { marginTop: 2 },
  logRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4, minHeight: 52,
    borderBottomWidth: afLayout.hairline, borderBottomColor: af.divider,
  },
  logIcon: { width: 24, alignItems: 'center', justifyContent: 'center' },
  logLabel: { ...afType.secondary, color: af.textPrimary, flex: 1 },
  logValue: { ...afType.caption, color: af.textPrimary, fontFamily: afType.bodyStrong.fontFamily, flexShrink: 1, textAlign: 'right' },
  logValueMuted: { color: af.textTertiary, fontFamily: afType.caption.fontFamily },
  logFlag: { width: 6, height: 6, borderRadius: 3, marginLeft: 4 },
  selfReportNote: { ...afType.caption, color: af.textTertiary, fontSize: 12 },

  // Stepper
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: af.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepValue: { ...afType.caption, color: af.textPrimary, minWidth: 44, textAlign: 'center', fontFamily: afType.bodyStrong.fontFamily, fontVariant: ['tabular-nums'] },

  // Recovery
  recoveryEmpty: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  recoveryEmptyText: { ...afType.caption, color: af.textSecondary, flex: 1 },
  riskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  riskCopy: { flex: 1 },
  riskLabel: { ...afType.eyebrow, color: af.textTertiary },
  riskValue: { ...afType.title3, marginTop: 3 },
  riskBadge: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  reasonList: { marginTop: 12, gap: 8 },
  reasonItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reasonDot: { width: 5, height: 5, borderRadius: 3 },
  reasonText: { ...afType.caption, color: af.textSecondary, flex: 1 },

  // Checklist + shared list icon
  listIcon: { width: 24, alignItems: 'center', justifyContent: 'center' },
  checklistRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 48,
    borderBottomWidth: afLayout.hairline, borderBottomColor: af.divider,
  },
  checklistLabel: { ...afType.secondary, color: af.textPrimary, flex: 1 },

  // Badges
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCell: { width: '47%', flexGrow: 1, minWidth: 140, padding: 14, gap: 6 },
  badgeIcon: { width: 24, alignItems: 'flex-start', justifyContent: 'center' },
  badgeTitle: { ...afType.caption, color: af.textPrimary, fontFamily: afType.bodyStrong.fontFamily },
  badgeHint: { ...afType.caption, color: af.textTertiary, fontSize: 12 },

  // Cross-nav
  navRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 56,
    borderBottomWidth: afLayout.hairline, borderBottomColor: af.divider,
  },
  navRowPressed: { backgroundColor: af.surfacePressed },
  navCopy: { flex: 1 },
  navLabel: { ...afType.secondary, color: af.textPrimary, fontFamily: afType.bodyStrong.fontFamily },
  navHint: { ...afType.caption, color: af.textTertiary, fontSize: 12 },

  // Tier + disclaimer
  tier: { ...afType.micro, color: af.textTertiary, textAlign: 'center', marginTop: 32 },
  disclaimer: { marginTop: 14, padding: 14, borderRadius: afLayout.radiusCard, borderWidth: afLayout.hairline, borderColor: af.border },
  disclaimerText: { ...afType.caption, color: af.textTertiary },
});
