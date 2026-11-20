/**
 * SLEEP MODE (redesign) — pure presentational component.
 *
 * Renders a fully-resolved `SleepModeView` (see services/sleep/sleepModeView).
 * No store, flag, navigation, or data access — everything arrives via props, so
 * it is testable in isolation (render harness) and can never enable a gated
 * feature.
 *
 * Styled after the approved prototype (2026-11-19): back + mono name, the
 * Inter 600 title, then cards with the demo's 20pt corner — the current-state
 * numeral over a red progress line, the recovery metric row, the sleep-target
 * plan card and a single pill button — then the existing recovery / health
 * source / protocol checklist / lifecycle / guidance sections. Presentation
 * only: every word, value, action and test id is the one it was
 * (relocated, never dropped). Status colours (health chip,
 * recovery posture dot) stay system-sourced (D3). Sleep data is never
 * fabricated: an absent night renders the resolver's em-dash / "no signal"
 * treatment and an empty progress track, never a zero. Reduced-motion aware
 * (nothing animates here; the prop is retained for the container contract);
 * 44pt targets; Dynamic Type (display numerals clamped, body text unclamped);
 * colour-independent status.
 */
import React from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, type ImageSourcePropType } from 'react-native';
import { WorldPhotoGap, WorldPhotoHero } from '@/components/world/WorldPhoto';
import { af, afType, afLayout, afAlpha, withAlpha, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { Icon, type IconName } from '@/components/Icon';
import { AFSectionLabel } from '@/components/ui/AFSectionLabel';
import { AFCard } from '@/components/ui/AFCard';
import { useAFEyebrowType } from '@/hooks/useAFEyebrowType';
import { useAFGutter } from '@/hooks/useAFGutter';
import type {
  SleepModeView as SleepModeVM,
  HealthChip,
  RecoveryPosture,
  ChecklistItemDef,
} from '@/services/sleep/sleepModeView';

export interface SleepModeViewProps {
  view: SleepModeVM;
  reducedMotion: boolean;
  editingTarget?: boolean;
  targetDraft?: string;
  onBack: () => void;
  onEditTarget: () => void;
  onChangeTargetDraft?: (s: string) => void;
  onSaveTarget?: () => void;
  onToggleChecklist: (id: ChecklistItemDef['id']) => void;
  onPrimaryCta: () => void;
  onHealthCta: () => void;
  /**
   * Reports the checklist card's y-offset (relative to this view's root) so
   * the container can scroll it into view for the H3 focus-checklist action.
   */
  onChecklistLayout?: (y: number) => void;
  /** The World photograph behind the top of the screen. Optional. */
  photo?: ImageSourcePropType;
}

/** The demo's card corner and mono furniture face. */
const CARD_RADIUS = 20;
/** The view sits below the status bar; the photograph runs up behind it. */
const SLEEP_PHOTO_LIFT = 80;
const MONO = 'IBMPlexMono_400Regular';

const CHIP_COLOR: Record<HealthChip, string> = {
  connected: af.green,
  waiting: af.cyan,
  needs_attention: af.amber,
  not_connected: af.redText, // disconnected → Signal Red (chip only, short)
};

const POSTURE_COLOR: Record<RecoveryPosture, string> = {
  ready: af.cyan,
  limited: af.amber,
  waiting: af.cyan,
  connect: af.textSecondary,
};

// ─── Small primitives ────────────────────────────────────────────────────────

/** A section: quiet mono eyebrow over a hairline, then the content. */
function SectionBlock({
  label, meta, children, testID,
}: { label: string; meta?: string; children: React.ReactNode; testID?: string }) {
  return (
    <View style={styles.section} testID={testID}>
      <AFSectionLabel label={label} meta={meta} tone="quiet" />
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

/**
 * The Black Issue CTA shape (red fill, label left, "+" flush right, 52pt min,
 * radius 10) as a plain Pressable. AFButton is not imported because it rides
 * AFMotionPressable → reanimated, which the non-shipping render harness cannot
 * load (same finding as the Cruise restyle, PR 3). The container fires the
 * haptic, so nothing is lost.
 */
/** "START PRE-SLEEP PROTOCOL" → "Start pre-sleep protocol". The words are the
 *  service's; only the lettering changes, as on the app's other buttons. */
export function sentenceCase(label: string): string {
  return label.length > 0 ? label[0]!.toUpperCase() + label.slice(1).toLowerCase() : label;
}

function CtaButton({
  label, onPress, testID,
}: { label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [styles.ctaBtn, pressed && styles.ctaBtnPressed]}
    >
      <Text style={styles.ctaLabel}>{sentenceCase(label)}</Text>
    </Pressable>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────

export function SleepModeView({
  view, editingTarget, targetDraft,
  onBack, onEditTarget, onChangeTargetDraft, onSaveTarget,
  onToggleChecklist, onPrimaryCta, onHealthCta, onChecklistLayout, photo,
}: SleepModeViewProps) {
  const { header, hero, target, recovery, health, checklist, lifecycle, guidance, mode, gatedNotice } = view;
  const gutter = useAFGutter();
  const eyebrowType = useAFEyebrowType();
  const ring = hero.ring;
  // The numeral + its caption + the phase word are ONE spoken element; the
  // progress track is decoration (the number is the information).
  const heroSpoken = `${hero.eyebrow}: ${hero.state}. ${ring.caption}: ${ring.valueLabel}`;

  return (
    <View style={[styles.root, { paddingHorizontal: gutter }]} testID="sleep-mode-view">
      {/* 1 · Masthead — wordmark, breadcrumb, statement, quiet line. Every
          string is the existing header / hero copy (relocated, not rewritten). */}
      <WorldPhotoHero source={photo} bleed={gutter} lift={SLEEP_PHOTO_LIFT} testID="sleep-photo" />
      <View style={styles.topRow} testID="sleep">
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          style={styles.back}
          testID="sleep-back"
        >
          <Icon name="chevron-left" size={18} color={af.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.topEyebrow}>{header.title}</Text>
      </View>
      <WorldPhotoGap source={photo} />
      <Text accessibilityRole="header" style={styles.title} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
        {header.tagline}
      </Text>
      <Text style={styles.subtitle}>{hero.description}</Text>

      {/* Kill switch (sleep_mode_enabled) — legacy-banner parity. Rendered
          loud so the gated state is never silent; text carries the meaning
          (color-independent), amber signals caution. */}
      {gatedNotice ? (
        <View
          style={styles.gatedBanner}
          testID="sleep-gated-banner"
          accessible
          accessibilityRole="alert"
          accessibilityLabel={gatedNotice}
        >
          <Icon name="alert-triangle" size={14} color={af.amber} />
          <Text style={[styles.gatedBannerText, eyebrowType]}>{gatedNotice}</Text>
        </View>
      ) : null}

      {mode === 'loading' ? (
        <View style={styles.shell} testID="sleep-loading" accessible accessibilityLabel="Loading sleep mode">
          <Text style={styles.shellText}>Loading recovery signals…</Text>
        </View>
      ) : mode === 'offline' ? (
        <View style={[styles.shell, styles.shellError]} testID="sleep-offline" accessible accessibilityLabel="Offline. Recovery signals unavailable.">
          <Icon name="wifi-off" size={18} color={af.redText} />
          <Text style={[styles.shellText, { color: af.redText }]}>Offline — recovery signals unavailable. Your sleep target is saved.</Text>
        </View>
      ) : null}

      {/* 2 · Current-state readout — caption, numeral, phase word, red hairline */}
      <View style={styles.hero} testID={`sleep-hero-${lifecycle.states[lifecycle.activeIndex]?.key ?? 'idle'}`}>
        <View accessible accessibilityRole="text" accessibilityLabel={heroSpoken}>
          <Text style={[styles.heroLabel, eyebrowType]}>{ring.caption}</Text>
          <View style={styles.numeralRow}>
            <Text style={styles.numeral} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE} testID="sleep-hero-value">
              {ring.valueLabel}
            </Text>
            <View style={styles.stateCol}>
              <Text style={[styles.stateEyebrow, eyebrowType]}>{hero.eyebrow}</Text>
              <Text style={[styles.stateWord, eyebrowType]}>{hero.state}</Text>
            </View>
          </View>
        </View>
        {/* Honest progress: an absent signal has progress 0 → an empty track. */}
        <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.trackFill, { width: `${Math.round(ring.progress * 100)}%` }]} />
        </View>
      </View>

      {/* 3 · Recovery metric row — real values only (resolver contract) */}
      {recovery.metrics.length > 0 ? (
        <View style={styles.metricRow} testID="sleep-metric-row">
          {recovery.metrics.map((m) => (
            <View key={m.label} style={styles.metric} accessible accessibilityLabel={`${m.label}: ${m.value}`}>
              <Text style={[styles.metricLabel, eyebrowType]}>{m.label}</Text>
              <Text style={styles.metricValue} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>{m.value}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.metricEmpty}>No recovery metrics available yet.</Text>
      )}

      {/* 4 · Sleep target — the plan card (red eyebrow + the existing plan sentence) */}
      <AFCard style={styles.planCard} testID="sleep-target-card">
        <AFSectionLabel label="Sleep target" rule={false} tone="quiet" />
        <Text style={styles.planSentence}>{target.countdownCopy}</Text>
        {editingTarget ? (
          <View style={styles.targetEditRow}>
            <TextInput
              value={targetDraft}
              onChangeText={onChangeTargetDraft}
              placeholder="h:mm AM/PM"
              placeholderTextColor={af.textTertiary}
              autoFocus
              style={styles.targetInput}
              maxLength={8}
              onSubmitEditing={onSaveTarget}
              accessibilityLabel="Sleep target time, 12-hour, e.g. 11:00 PM"
              maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
            />
            <Pressable onPress={onSaveTarget} style={styles.saveBtn} accessibilityRole="button" accessibilityLabel="Save sleep target">
              <Text style={styles.saveBtnText}>Save</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={onEditTarget}
            disabled={!target.canEdit}
            style={styles.targetRow}
            accessibilityRole="button"
            accessibilityLabel={`Edit sleep target, currently ${target.timeLabel}`}
            testID="sleep-target-edit"
          >
            <Text style={styles.targetTime} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>{target.timeLabel}</Text>
            <View style={styles.editChip}><Text style={styles.editChipText}>Edit target</Text></View>
          </Pressable>
        )}
        {/* timeline */}
        <View style={styles.timeline} accessibilityLabel={`Now to ${target.timeline.targetLabel}`}>
          <View style={styles.timelineTrack}>
            <View style={[styles.timelineFill, { width: `${Math.round(target.timeline.nowFraction * 100)}%` }]} />
            <View style={[styles.timelineDot, { left: `${Math.round(target.timeline.nowFraction * 100)}%` }]} />
          </View>
          <View style={styles.timelineLabels}>
            <Text style={styles.timelineLabel}>{target.timeline.nowLabel}</Text>
            <Text style={styles.timelineLabel}>{target.timeline.preSleepLabel}</Text>
            <Text style={styles.timelineLabel}>{target.timeline.targetLabel}</Text>
          </View>
        </View>
      </AFCard>

      {/* 5 · The one red CTA — same action and label as before; the protocol
          checklist it points at follows below. */}
      <View style={styles.cta}>
        <CtaButton label={checklist.primaryCtaLabel} onPress={onPrimaryCta} testID="sleep-primary-cta" />
      </View>

      {/* 6 · Recovery readiness — posture + interpretation (metrics sit above) */}
      <SectionBlock label="Recovery readiness">
        <View style={styles.postureRow}>
          <View style={[styles.dot, { backgroundColor: POSTURE_COLOR[recovery.posture] }]} />
          <Text style={[styles.confidenceLabel, eyebrowType]}>{recovery.confidenceLabel}</Text>
        </View>
        <Text style={styles.interpretation}>{recovery.interpretation}</Text>
      </SectionBlock>

      {/* 7 · Health source */}
      <SectionBlock label="Health source">
        <View style={styles.healthRow}>
          <View style={styles.healthLeft}>
            <Text style={styles.healthProvider}>{health.provider}</Text>
            <Text style={styles.healthFreshness}>{health.freshness}</Text>
          </View>
          {/* The status colour is the dot only; the pill and its words are neutral. */}
          <View style={styles.chip} accessible accessibilityLabel={`Status: ${health.chipLabel}`}>
            <View style={[styles.chipDot, { backgroundColor: CHIP_COLOR[health.chip] }]} />
            <Text style={styles.chipText}>{health.chipLabel}</Text>
          </View>
        </View>
        <Pressable onPress={onHealthCta} style={styles.healthCta} accessibilityRole="button" accessibilityLabel={health.ctaLabel} testID="sleep-health-cta">
          <Text style={styles.healthCtaText}>{health.ctaLabel}</Text>
          <Icon name="chevron-right" size={16} color={af.textSecondary} />
        </Pressable>
      </SectionBlock>

      {/* 8 · Pre-sleep protocol checklist */}
      <View onLayout={(e) => onChecklistLayout?.(e.nativeEvent.layout.y)}>
        <SectionBlock label="Pre-sleep protocol" meta={checklist.progressLabel}>
          <View style={styles.checkCard}>
            {checklist.items.map((item, i) => (
              <Pressable
                key={item.id}
                onPress={() => onToggleChecklist(item.id)}
                style={[styles.checkItem, i > 0 && styles.checkItemRuled]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.done }}
                accessibilityLabel={`${item.label}${item.target ? `, ${item.target}` : ''}`}
                testID={`sleep-check-${item.id}`}
              >
                <View style={[styles.checkbox, item.done && styles.checkboxDone]}>
                  {item.done ? <Icon name="check" size={14} color={af.canvas} /> : <Icon name={item.icon as IconName} size={15} color={af.textSecondary} />}
                </View>
                <View style={styles.checkTextWrap}>
                  <Text style={[styles.checkLabel, item.done && styles.checkLabelDone]}>{item.label}</Text>
                  {item.target ? <Text style={styles.checkTarget}>{item.target}</Text> : null}
                </View>
                {item.primary ? <View style={styles.primaryTag}><Text style={[styles.primaryTagText, eyebrowType]}>PRIMARY</Text></View> : null}
              </Pressable>
            ))}
          </View>
        </SectionBlock>
      </View>

      {/* 9 · Lifecycle indicator (system-derived — not tabs) */}
      <View style={styles.lifecycle} accessibilityLabel={`Sleep lifecycle, current: ${lifecycle.states[lifecycle.activeIndex]?.label}`}>
        {lifecycle.states.map((s) => (
          <View key={s.key} style={styles.lifecycleItem}>
            <View style={[styles.lifecycleDot, s.active && styles.lifecycleDotActive, s.done && styles.lifecycleDotDone]} />
            <Text style={[styles.lifecycleLabel, s.active && styles.lifecycleLabelActive]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* 10 · Guidance */}
      <View style={styles.guidance}>
        <Text style={[styles.guidanceTitle, eyebrowType]}>{guidance.title}</Text>
        <Text style={styles.guidanceBody}>{guidance.body}</Text>
        <Text style={styles.guidanceSecondary}>{guidance.secondary}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingTop: 8, paddingBottom: 24 },

  // Top of the page, as on the Protocols list: back, the mono name, the title.
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: 12, minHeight: 44 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingRight: 8 },
  backText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: af.textPrimary },
  topEyebrow: { fontFamily: MONO, fontSize: 11, lineHeight: 14, letterSpacing: 2, color: af.textSecondary, flexShrink: 1 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 36, lineHeight: 38, letterSpacing: -0.72, color: af.textPrimary, marginTop: 14 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22, color: af.textSecondary, marginTop: 8 },

  gatedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: CARD_RADIUS, minHeight: 44,
    borderWidth: 1, borderColor: withAlpha(af.amber, afAlpha.a50), backgroundColor: withAlpha(af.amber, afAlpha.a08),
  },
  gatedBannerText: { ...afType.eyebrow, color: af.amber, flex: 1 },

  shell: {
    marginTop: 16, padding: 16, borderRadius: CARD_RADIUS, borderWidth: 1,
    borderColor: af.border, backgroundColor: af.surface, flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  shellError: { borderColor: af.borderAlert, backgroundColor: af.surfaceAlert },
  shellText: { ...afType.secondary, color: af.textSecondary, flex: 1 },

  // Current-state readout
  hero: { marginTop: 20, padding: 18, borderRadius: CARD_RADIUS, borderWidth: 1, borderColor: af.border, backgroundColor: af.surface },
  heroLabel: { ...afType.eyebrow, color: af.textTertiary },
  numeralRow: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', columnGap: 16, rowGap: 4, marginTop: 8 },
  numeral: { fontFamily: 'Inter_300Light', fontSize: 64, lineHeight: 68, letterSpacing: -1.9, color: af.textPrimary, fontVariant: ['tabular-nums'], flexShrink: 1 },
  stateCol: { paddingBottom: 10, gap: 4, flexShrink: 1 },
  stateEyebrow: { ...afType.micro, color: af.textTertiary },
  stateWord: { ...afType.eyebrow, color: af.textSecondary },
  track: { height: 4, borderRadius: 2, backgroundColor: af.divider, overflow: 'hidden', marginTop: 16 },
  trackFill: { height: 4, borderRadius: 2, backgroundColor: af.textPrimary },

  // Metric row
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 28, rowGap: 16, marginTop: 12, padding: 18, borderRadius: CARD_RADIUS, borderWidth: 1, borderColor: af.border, backgroundColor: af.surface },
  metric: { gap: 6, flexShrink: 1 },
  metricLabel: { ...afType.micro, color: af.textTertiary, textTransform: 'uppercase' },
  metricValue: { fontFamily: 'Inter_600SemiBold', fontSize: 20, lineHeight: 24, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  metricEmpty: { ...afType.secondary, color: af.textTertiary, marginTop: 16 },

  // Plan card
  planCard: { marginTop: 12, gap: 12, borderRadius: CARD_RADIUS },
  planSentence: { ...afType.bodyStrong, color: af.textPrimary },
  targetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: 12, rowGap: 8, minHeight: 44 },
  targetEditRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  targetTime: { fontFamily: 'Inter_300Light', fontSize: 40, lineHeight: 44, letterSpacing: -1.2, color: af.textPrimary, fontVariant: ['tabular-nums'], flexShrink: 1 },
  targetInput: { flex: 1, fontFamily: 'Inter_300Light', fontSize: 40, lineHeight: 44, letterSpacing: -1.2, color: af.textPrimary, paddingVertical: 0 },
  editChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: afLayout.radiusPill, borderWidth: 1, borderColor: af.border, minHeight: 44, justifyContent: 'center' },
  editChipText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: af.textPrimary },
  saveBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: afLayout.radiusPill, backgroundColor: af.primaryFill, minHeight: 44, justifyContent: 'center' },
  saveBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: af.onPrimaryFill },
  timeline: { gap: 6, marginTop: 4 },
  timelineTrack: { height: 4, borderRadius: 2, backgroundColor: af.divider, justifyContent: 'center' },
  timelineFill: { position: 'absolute', left: 0, height: 4, borderRadius: 2, backgroundColor: af.textSecondary },
  timelineDot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: af.textPrimary, marginLeft: -6, top: -4 },
  timelineLabels: { flexDirection: 'row', justifyContent: 'space-between', columnGap: 8 },
  timelineLabel: { ...afType.caption, color: af.textTertiary, flexShrink: 1 },

  // CTA
  cta: { marginTop: 20 },
  ctaBtn: {
    minHeight: afLayout.buttonHeight, borderRadius: afLayout.radiusPill, paddingHorizontal: 22, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', columnGap: 12,
    backgroundColor: af.primaryFill,
  },
  ctaBtnPressed: { opacity: 0.85 },
  ctaLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 20, color: af.onPrimaryFill, flexShrink: 1, textAlign: 'center' },

  // Sections
  section: { marginTop: 32 },
  sectionBody: { marginTop: 14, gap: 12 },

  postureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  confidenceLabel: { ...afType.eyebrow, color: af.textSecondary, flexShrink: 1 },
  interpretation: { ...afType.body, color: af.textPrimary },

  healthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  healthLeft: { flex: 1, gap: 2 },
  healthProvider: { ...afType.bodyStrong, color: af.textPrimary },
  healthFreshness: { ...afType.caption, color: af.textTertiary },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: afLayout.radiusPill, borderWidth: 1, borderColor: af.border, flexShrink: 1 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { ...afType.caption, fontSize: 12, color: af.textSecondary, flexShrink: 1 },
  healthCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, borderTopWidth: 1, borderTopColor: af.divider },
  healthCtaText: { ...afType.secondary, color: af.textSecondary },

  checkCard: { borderRadius: CARD_RADIUS, borderWidth: 1, borderColor: af.border, backgroundColor: af.surface, paddingHorizontal: 14, paddingVertical: 4 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6 },
  checkItemRuled: { borderTopWidth: 1, borderTopColor: af.divider },
  checkbox: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: af.border, alignItems: 'center', justifyContent: 'center', backgroundColor: af.canvasElevated },
  checkboxDone: { backgroundColor: af.textPrimary, borderColor: af.textPrimary },
  checkTextWrap: { flex: 1, gap: 1 },
  checkLabel: { ...afType.bodyStrong, color: af.textPrimary },
  checkLabelDone: { color: af.textSecondary, textDecorationLine: 'line-through' },
  checkTarget: { ...afType.caption, color: af.textTertiary },
  primaryTag: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: afLayout.radiusPill, borderWidth: 1, borderColor: af.border },
  primaryTagText: { ...afType.micro, color: af.textSecondary },

  lifecycle: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, marginTop: 24 },
  lifecycleItem: { alignItems: 'center', gap: 6, flex: 1 },
  lifecycleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: af.border },
  lifecycleDotActive: { backgroundColor: af.textPrimary, width: 10, height: 10, borderRadius: 5 },
  lifecycleDotDone: { backgroundColor: af.textTertiary },
  lifecycleLabel: { ...afType.micro, color: af.textTertiary, textAlign: 'center' },
  lifecycleLabelActive: { color: af.textPrimary },

  guidance: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: af.divider, gap: 6 },
  guidanceTitle: { ...afType.eyebrow, color: af.textTertiary },
  guidanceBody: { ...afType.caption, color: af.textSecondary, lineHeight: 18 },
  guidanceSecondary: { ...afType.caption, color: af.textTertiary },
});
