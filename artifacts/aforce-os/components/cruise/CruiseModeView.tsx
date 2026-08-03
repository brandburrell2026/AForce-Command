/**
 * CRUISE MODE (redesign) — pure presentational component.
 *
 * No store, flag, navigation, or data access — everything arrives via props.
 * Renders the resolved `CruiseModeView` in the FROZEN AForce brand system
 * (Cinematic Black canvas + cyan/teal glass + amber/green/red state tokens via
 * `af.*`). The "ocean" feel is expressed through brand depth + cyan glass, NOT
 * the spec's off-brand navy/gold (founder ruling: within-brand).
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
import { Colors } from '@/theme/colors';
import { af, afType, afLayout, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme/afTokens';
import type { CommandConfidenceLevel } from '@/types';
import {
  type CruiseModeView as CruiseModeViewModel,
  type CruiseTone,
  type CruiseSelfLog,
  type CruiseDeckExposure,
  type CruiseExcursionRisk,
  type CruiseDayMode,
} from '@/services/cruise/cruiseModeView';
import { type CruiseGuestType } from '@/services/cruiseModeService';

const TONE: Record<CruiseTone, string> = {
  green: af.green,
  cyan: af.cyan,
  amber: af.amber,
  red: af.redText,
  neutral: af.textSecondary,
};

const GUEST_CYCLE: CruiseGuestType[] = ['family', 'athlete', 'older_traveler', 'party', 'excursion'];
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

function SectionHeader({ label, hint }: { label: string; hint?: string | null }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {hint ? <Text style={styles.sectionHint} numberOfLines={1}>{hint}</Text> : null}
    </View>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
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
        hitSlop={8}
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
        hitSlop={8}
      >
        <Icon name="plus" size={14} color={af.textPrimary} />
      </Pressable>
    </View>
  );
}

// ─── Sections ────────────────────────────────────────────────────────────────

function ReadinessHero({ view, confidence }: { view: CruiseModeViewModel; confidence?: CommandConfidenceLevel | null }) {
  const r = view.readiness;
  const tone = TONE[r.tone];
  const building = r.posture === 'building';
  return (
    <Card style={styles.heroCard} >
      {!view.reducedMotion && !building ? (
        <View pointerEvents="none" testID="cruise-hero-glow" style={[styles.heroGlow, { backgroundColor: tone }]} />
      ) : null}
      <View style={styles.orbRow}>
        <View style={[styles.orb, { borderColor: tone + '66', backgroundColor: tone + '14' }]}>
          <Text
            style={[styles.orbScore, { color: building ? af.textSecondary : tone }]}
            maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
            testID="cruise-readiness-score"
          >
            {r.scoreLabel}
          </Text>
          {!building ? <Text style={styles.orbScale}>/ 100</Text> : null}
        </View>
        <View style={styles.orbCopy}>
          <View style={[styles.statusPill, { borderColor: tone + '66', backgroundColor: tone + '1F' }]}>
            <View style={[styles.statusDot, { backgroundColor: tone }]} />
            <Text style={[styles.statusPillText, { color: tone }]}>{r.statusLabel}</Text>
          </View>
          <Text style={styles.recommendation}>{r.recommendation}</Text>
          {r.recheckLabel ? <Text style={styles.recheck}>{r.recheckLabel}</Text> : null}
        </View>
      </View>
      {/* Readiness fill — a slim, honest progress track (no SVG). */}
      <View style={styles.ringTrack}>
        <View style={[styles.ringFill, { width: `${Math.round(r.ring.progress * 100)}%`, backgroundColor: tone }]} />
      </View>
      <View style={styles.ringCaptionRow}>
        <Text style={styles.ringCaption}>{r.ring.caption}</Text>
        {r.usesLiveConditions ? (
          <Text style={styles.ringCaptionSoft}>· adjusted for live conditions</Text>
        ) : null}
      </View>
      {confidence ? (
        <View style={styles.confidenceRow}>
          {/* Command Confidence anchors to the recommendation OUTPUT (this
              Guest Readiness card), not an input-data card (founder ruling
              2026-07-18). Near-black pill keeps the monochrome ramp on the
              exact surface it was tuned for (PR #285/#288) — reference the
              token, not a literal, so it tracks if background.card moves. */}
          <View style={styles.confidencePill} testID="cruise-confidence">
            <CommandConfidenceBadge level={confidence} />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

function EnvironmentCard({
  view, ports, selectedPortId, onSelectPort,
}: {
  view: CruiseModeViewModel;
  ports: CruiseModeViewProps['ports'];
  selectedPortId: string;
  onSelectPort: (id: string) => void;
}) {
  const env = view.environment;
  const srcTone = TONE[env.source.tone];
  return (
    <Card>
      <View style={styles.liveStrip}>
        <View style={[styles.sourcePill, { borderColor: srcTone + '66', backgroundColor: srcTone + '1A' }]} testID={`cruise-source-${env.source.key}`}>
          {env.source.key === 'loading' ? (
            <ActivityIndicator size="small" color={srcTone} />
          ) : (
            <View style={[styles.sourceDot, { backgroundColor: srcTone }]} />
          )}
          <Text style={[styles.sourcePillText, { color: srcTone }]}>{env.source.label}</Text>
        </View>
        <Text style={styles.liveStripCaption} numberOfLines={1}>{env.source.caption}</Text>
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
              <Icon name="map-pin" size={11} color={active ? af.cyan : af.textTertiary} />
              <Text style={[styles.portChipText, active && { color: af.cyan }]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {env.hasLiveData ? (
        <View style={styles.envGrid}>
          {env.cells.map((c) => {
            const accent = c.accentTone ? TONE[c.accentTone] : undefined;
            return (
              <View key={c.key} style={styles.envCell} testID={`cruise-env-${c.key}`}>
                <View style={[styles.envIcon, { backgroundColor: af.cyan + '1A' }]}>
                  <Icon name={c.icon as IconName} size={13} color={accent ?? af.cyan} />
                </View>
                <Text style={styles.envLabel}>{c.label}</Text>
                <Text style={[styles.envValue, accent ? { color: accent } : null]}>{c.value}</Text>
              </View>
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
        <View style={[styles.inlineBanner, { borderColor: TONE[env.journeyIntensity.tone] + '55', backgroundColor: TONE[env.journeyIntensity.tone] + '12' }]}>
          <Icon name="activity" size={13} color={TONE[env.journeyIntensity.tone]} />
          <Text style={styles.inlineBannerText}>
            Journey Intensity: <Text style={{ color: TONE[env.journeyIntensity.tone] }}>{env.journeyIntensity.label}</Text>
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

function DayCard({
  view, log, onLogChange,
}: { view: CruiseModeViewModel; log: CruiseSelfLog; onLogChange: (p: Partial<CruiseSelfLog>) => void; }) {
  const day = view.day;
  const cycle = <T,>(arr: T[], cur: T): T => arr[(arr.indexOf(cur) + 1) % arr.length];
  const guestLabel = day.rows.find((r) => r.id === 'guest_type')?.value ?? 'Not set';
  const deckLabel = day.rows.find((r) => r.id === 'deck')?.value ?? '';

  return (
    <Card>
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
              <Text style={[styles.segText, active && { color: af.cyan }]}>
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
          <Icon name="edit-3" size={13} color={af.cyan} />
          <Text style={styles.hintText}>{day.emptyHint}</Text>
        </View>
      ) : null}

      {/* Self-log controls */}
      <View style={styles.logGroup}>
        <LogControl
          icon="user" label="Guest type" value={guestLabel} set={log.guestType != null}
          onPress={() => onLogChange({ guestType: log.guestType == null ? GUEST_CYCLE[0] : cycle(GUEST_CYCLE, log.guestType) })}
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
    </Card>
  );
}

function LogControl({
  icon, label, value, set, onPress, testID,
}: { icon: IconName; label: string; value: string; set: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable onPress={onPress} style={styles.logRow} accessibilityRole="button" accessibilityLabel={`${label}: ${value}. Tap to change.`} testID={testID}>
      <View style={styles.logIcon}><Icon name={icon} size={13} color={af.cyan} /></View>
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
      <View style={styles.logIcon}><Icon name={icon} size={13} color={af.cyan} /></View>
      <Text style={styles.logLabel}>{label}</Text>
      <Stepper value={value} unit={unit} onStep={onStep} testID={testID} />
      {tone ? <View style={[styles.logFlag, { backgroundColor: tone }]} /> : null}
    </View>
  );
}

function RecoveryCard({ view }: { view: CruiseModeViewModel }) {
  const rec = view.recovery;
  const tone = TONE[rec.tone];
  if (!rec.hasSignal) {
    return (
      <Card>
        <View style={styles.recoveryEmpty}>
          <Icon name="check-circle" size={16} color={af.green} />
          <Text style={styles.recoveryEmptyText}>{rec.emptyCopy}</Text>
        </View>
      </Card>
    );
  }
  return (
    <Card style={{ borderColor: tone + '55', borderWidth: 1.5 }}>
      <View style={styles.riskHeader}>
        <View>
          <Text style={styles.riskLabel}>COMPOSITE RECOVERY DEMAND</Text>
          <Text style={[styles.riskValue, { color: tone }]}>{rec.riskLabel}</Text>
        </View>
        <View style={[styles.riskBadge, { backgroundColor: tone + '1F', borderColor: tone + '55' }]}>
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
    </Card>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────

export function CruiseModeView({
  view, log, ports, selectedPortId, crossNav, confidence,
  onBack, onSelectPort, onLogWater, onLogChange, onNavigate,
}: CruiseModeViewProps) {
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      testID="cruise-mode-view"
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.backBtn} testID="cruise-back">
          <Icon name="chevron-left" size={22} color={af.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.eyebrow}>{view.header.eyebrow}</Text>
          <Text style={styles.title}>{view.header.title}</Text>
          <Text style={styles.subtitle}>{view.header.subtitle}</Text>
        </View>
        <View style={{ width: 22 }} />
      </View>

      <SectionHeader label="GUEST READINESS SIGNAL" />
      <ReadinessHero view={view} confidence={confidence} />

      {/* Real self-report water CTA (or honest preview) */}
      <Pressable
        onPress={view.logWater.available ? onLogWater : undefined}
        disabled={!view.logWater.available}
        style={[styles.waterCta, !view.logWater.available && styles.waterCtaPreview]}
        accessibilityRole="button"
        accessibilityLabel={view.logWater.available ? 'Log water' : view.logWater.previewNote ?? 'Preview'}
        testID="cruise-log-water"
      >
        <Icon name="droplet" size={16} color={view.logWater.available ? af.onRed : af.textTertiary} />
        <Text style={[styles.waterCtaText, !view.logWater.available && { color: af.textTertiary }]}>
          {view.logWater.available ? view.logWater.label : view.logWater.previewNote}
        </Text>
      </Pressable>

      <SectionHeader label="SHIP ENVIRONMENT" hint={view.environment.portName || 'Live port conditions'} />
      <EnvironmentCard view={view} ports={ports} selectedPortId={selectedPortId} onSelectPort={onSelectPort} />

      <SectionHeader label="YOUR DAY" hint="Self-logged · you control it" />
      <DayCard view={view} log={log} onLogChange={onLogChange} />

      <SectionHeader label="RECOVERY DEMAND" />
      <RecoveryCard view={view} />

      <SectionHeader label="PORT DAY CHECKLIST" hint="Before you leave the ship" />
      <Card>
        {view.checklist.map((item, i) => (
          <View key={item.id} style={[styles.checklistRow, i === view.checklist.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={styles.checklistIcon}><Icon name={item.icon as IconName} size={13} color={af.cyan} /></View>
            <Text style={styles.checklistLabel}>{item.label}</Text>
          </View>
        ))}
      </Card>

      <SectionHeader label="GUEST ENGAGEMENT" hint="Cruise wellness badges" />
      <Card>
        <View style={styles.badgeGrid}>
          {view.badges.map((b) => (
            <View key={b.id} style={styles.badgeCell}>
              <View style={styles.badgeIcon}><Icon name="award" size={16} color={af.cyan} /></View>
              <Text style={styles.badgeTitle}>{b.title}</Text>
              <Text style={styles.badgeHint}>{b.hint}</Text>
            </View>
          ))}
        </View>
      </Card>

      <SectionHeader label="CONNECT TO" hint="Cross-feature shortcuts" />
      <Card style={{ paddingVertical: 6 }}>
        {crossNav.map((n, i) => (
          <Pressable
            key={n.key}
            onPress={() => onNavigate(n.key)}
            style={({ pressed }) => [styles.navRow, i === crossNav.length - 1 && { borderBottomWidth: 0 }, pressed && { backgroundColor: af.cyan + '10' }]}
            accessibilityRole="button"
            accessibilityLabel={n.label}
            testID={`cruise-nav-${n.key}`}
          >
            <View style={styles.navIcon}><Icon name={n.icon} size={14} color={af.cyan} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navLabel}>{n.label}</Text>
              <Text style={styles.navHint}>{n.hint}</Text>
            </View>
            <Icon name="chevron-right" size={14} color={af.textTertiary} />
          </Pressable>
        ))}
      </Card>

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
  content: { paddingHorizontal: afLayout.screenPaddingX, paddingTop: 8, paddingBottom: 48, gap: 4 },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  backBtn: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  eyebrow: { ...afType.eyebrow, color: af.cyan },
  title: { ...afType.title2, color: af.textPrimary },
  subtitle: { ...afType.caption, color: af.textSecondary },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    marginTop: 20, marginBottom: 8, paddingHorizontal: 2,
  },
  sectionLabel: { ...afType.eyebrow, color: af.textSecondary },
  sectionHint: { ...afType.caption, color: af.textTertiary, flexShrink: 1, marginLeft: 12, textAlign: 'right' },

  card: {
    backgroundColor: af.surface, borderRadius: afLayout.radiusCard,
    borderWidth: afLayout.hairline, borderColor: af.border, padding: afLayout.cardPadding,
  },

  // Readiness hero
  heroCard: { overflow: 'hidden' },
  heroGlow: {
    position: 'absolute', top: -70, right: -50, width: 220, height: 220,
    borderRadius: 110, opacity: 0.14,
  },
  orbRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  orb: {
    width: 104, height: 104, borderRadius: 52, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  orbScore: { ...afType.displayScore, fontSize: 40, lineHeight: 44 },
  orbScale: { ...afType.caption, color: af.textTertiary, marginTop: -2 },
  orbCopy: { flex: 1, gap: 7 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: afLayout.radiusPill, borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { ...afType.eyebrow, letterSpacing: 1.2 },
  recommendation: { ...afType.secondary, color: af.textPrimary },
  recheck: { ...afType.caption, color: af.textTertiary },
  ringTrack: {
    height: 6, borderRadius: 3, backgroundColor: af.surfaceRaised, marginTop: 16, overflow: 'hidden',
  },
  ringFill: { height: 6, borderRadius: 3 },
  ringCaptionRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 8, flexWrap: 'wrap' },
  ringCaption: { ...afType.eyebrow, color: af.textTertiary },
  ringCaptionSoft: { ...afType.caption, color: af.textTertiary, fontSize: 11 },
  confidenceRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  // The exact surface the §58 confidence ramp is tuned for (#285/#288).
  confidencePill: {
    backgroundColor: Colors.background.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: afLayout.radiusPill,
  },

  // Live env strip
  liveStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sourcePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: afLayout.radiusPill, borderWidth: 1,
  },
  sourceDot: { width: 6, height: 6, borderRadius: 3 },
  sourcePillText: { ...afType.eyebrow, fontSize: 9, letterSpacing: 1.4 },
  liveStripCaption: { ...afType.caption, color: af.textTertiary, flex: 1, textAlign: 'right', marginLeft: 12 },

  // Port chips
  portRow: { gap: 8, paddingBottom: 12, paddingRight: 8 },
  portChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 10, borderWidth: 1, borderColor: af.border, backgroundColor: af.surfaceRaised,
    minHeight: 34,
  },
  portChipActive: { borderColor: af.cyan + '88', backgroundColor: af.cyan + '1A' },
  portChipText: { ...afType.caption, color: af.textSecondary },

  // Env grid
  envGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  envCell: {
    width: '31%', flexGrow: 1, minWidth: 92, paddingVertical: 10, paddingHorizontal: 9,
    borderRadius: 12, backgroundColor: af.surfaceRaised, gap: 4,
  },
  envIcon: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  envLabel: { ...afType.caption, color: af.textTertiary, fontSize: 9, letterSpacing: 0.6, textTransform: 'uppercase' },
  envValue: { ...afType.bodyStrong, fontSize: 15, color: af.textPrimary },
  envEmpty: {
    flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4,
  },
  envEmptyText: { ...afType.caption, color: af.textSecondary, flex: 1 },
  inlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 10, borderWidth: 1, marginTop: 12,
  },
  inlineBannerText: { ...afType.caption, color: af.textSecondary },

  // Day / self-log
  segRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  segBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 12,
    borderWidth: 1, borderColor: af.border, backgroundColor: af.surfaceRaised, minHeight: 44, justifyContent: 'center',
  },
  segBtnActive: { borderColor: af.cyan + '88', backgroundColor: af.cyan + '14' },
  segText: { ...afType.caption, color: af.textSecondary, fontFamily: afType.bodyStrong.fontFamily },
  rhythmCaption: { ...afType.caption, color: af.textTertiary, marginBottom: 8 },
  flowRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', rowGap: 8 },
  flowBeat: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: afLayout.radiusPill, borderWidth: 1, borderColor: af.cyan + '33', backgroundColor: af.cyan + '12',
  },
  flowDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: af.cyan },
  flowBeatLabel: { ...afType.caption, color: af.textPrimary, fontSize: 11 },
  flowConnector: { width: 10, height: 1, backgroundColor: af.divider, marginHorizontal: 2 },
  hintBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 14, padding: 12,
    borderRadius: 12, borderWidth: 1, borderColor: af.cyan + '33', backgroundColor: af.cyan + '0D',
  },
  hintText: { ...afType.caption, color: af.textSecondary, flex: 1 },
  logGroup: { marginTop: 14, gap: 2 },
  logRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, minHeight: 44,
    borderBottomWidth: afLayout.hairline, borderBottomColor: af.divider,
  },
  logIcon: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: af.cyan + '14' },
  logLabel: { ...afType.caption, color: af.textSecondary, flex: 1 },
  logValue: { ...afType.caption, color: af.textPrimary, fontFamily: afType.bodyStrong.fontFamily },
  logValueMuted: { color: af.textTertiary, fontFamily: afType.caption.fontFamily },
  logFlag: { width: 6, height: 6, borderRadius: 3, marginLeft: 8 },
  selfReportNote: { ...afType.caption, color: af.textTertiary, marginTop: 12, fontSize: 11 },

  // Stepper
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: af.border,
    backgroundColor: af.surfaceRaised, alignItems: 'center', justifyContent: 'center',
  },
  stepValue: { ...afType.caption, color: af.textPrimary, minWidth: 40, textAlign: 'center', fontFamily: afType.bodyStrong.fontFamily },

  // Water CTA
  waterCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: afLayout.buttonHeight, borderRadius: afLayout.radiusButton, backgroundColor: af.red, marginTop: 12,
  },
  waterCtaPreview: { backgroundColor: 'transparent', borderWidth: 1, borderColor: af.border },
  waterCtaText: { ...afType.bodyStrong, color: af.onRed },

  // Recovery
  recoveryEmpty: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  recoveryEmptyText: { ...afType.caption, color: af.textSecondary, flex: 1 },
  riskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  riskLabel: { ...afType.eyebrow, color: af.textTertiary },
  riskValue: { ...afType.title3, marginTop: 3 },
  riskBadge: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  reasonList: { marginTop: 12, gap: 7 },
  reasonItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reasonDot: { width: 5, height: 5, borderRadius: 3 },
  reasonText: { ...afType.caption, color: af.textSecondary },

  // Checklist
  checklistRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    borderBottomWidth: afLayout.hairline, borderBottomColor: af.divider,
  },
  checklistIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: af.cyan + '14' },
  checklistLabel: { ...afType.caption, color: af.textPrimary, flex: 1 },

  // Badges
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCell: { width: '47%', flexGrow: 1, padding: 12, borderRadius: 12, backgroundColor: af.surfaceRaised, gap: 6 },
  badgeIcon: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: af.border, alignItems: 'center', justifyContent: 'center', backgroundColor: af.cyan + '14' },
  badgeTitle: { ...afType.caption, color: af.textPrimary, fontFamily: afType.bodyStrong.fontFamily },
  badgeHint: { ...afType.caption, color: af.textTertiary, fontSize: 10 },

  // Cross-nav
  navRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: afLayout.hairline, borderBottomColor: af.divider,
  },
  navIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: af.cyan + '14' },
  navLabel: { ...afType.caption, color: af.textPrimary, fontFamily: afType.bodyStrong.fontFamily },
  navHint: { ...afType.caption, color: af.textTertiary, fontSize: 10 },

  // Disclaimer
  disclaimer: { marginTop: 20, padding: 14, borderRadius: 12, borderWidth: afLayout.hairline, borderColor: af.border },
  disclaimerText: { ...afType.caption, color: af.textTertiary },
});
