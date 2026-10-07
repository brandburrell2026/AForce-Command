/**
 * SLEEP MODE (redesign) — pure presentational component.
 *
 * Renders a fully-resolved `SleepModeView` (see services/sleep/sleepModeView).
 * No store, flag, navigation, or data access — everything arrives via props, so
 * it is testable in isolation (render harness) and can never enable a gated
 * feature.
 *
 * Black Issue (PR 4, 2026-10-07): AFMasthead, the current-state numeral over a
 * red progress hairline, the recovery metric row, the sleep-target plan card,
 * the one red protocol CTA, then the existing recovery / health source /
 * protocol checklist / lifecycle / guidance sections as AFSectionLabel +
 * hairline rows (relocated, never dropped). Status colours (health chip,
 * recovery posture dot) stay system-sourced (D3). Sleep data is never
 * fabricated: an absent night renders the resolver's em-dash / "no signal"
 * treatment and an empty progress track, never a zero. Reduced-motion aware
 * (nothing animates here; the prop is retained for the container contract);
 * 44pt targets; Dynamic Type (display numerals clamped, body text unclamped);
 * colour-independent status.
 */
import React from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { af, afType, afLayout, afAlpha, withAlpha, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { Icon, type IconName } from '@/components/Icon';
import { AFMasthead } from '@/components/ui/AFMasthead';
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
}

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

/** Black Issue section: red mono eyebrow over a hairline, then the content. */
function SectionBlock({
  label, meta, children, testID,
}: { label: string; meta?: string; children: React.ReactNode; testID?: string }) {
  return (
    <View style={styles.section} testID={testID}>
      <AFSectionLabel label={label} meta={meta} />
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
function CtaButton({
  label, onPress, trailingIcon, testID,
}: { label: string; onPress: () => void; trailingIcon?: IconName; testID: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [styles.ctaBtn, pressed && styles.ctaBtnPressed]}
    >
      <Text style={styles.ctaLabel}>{label}</Text>
      {trailingIcon ? <Icon name={trailingIcon} size={18} color={af.onRed} /> : null}
    </Pressable>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────

export function SleepModeView({
  view, editingTarget, targetDraft,
  onBack, onEditTarget, onChangeTargetDraft, onSaveTarget,
  onToggleChecklist, onPrimaryCta, onHealthCta, onChecklistLayout,
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
      <AFMasthead
        breadcrumb={header.title}
        title={header.tagline}
        subtitle={hero.description}
        onBack={onBack}
        testID="sleep"
      />

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
      <View style={styles.rule} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
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
        <View style={styles.metricRow}>
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
        <AFSectionLabel label="Sleep target" rule={false} />
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
              <Text style={[styles.saveBtnText, eyebrowType]}>SAVE</Text>
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
            <View style={styles.editChip}><Text style={[styles.editChipText, eyebrowType]}>EDIT TARGET</Text></View>
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
        <CtaButton label={checklist.primaryCtaLabel} onPress={onPrimaryCta} trailingIcon="plus" testID="sleep-primary-cta" />
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
          <View style={[styles.chip, { borderColor: CHIP_COLOR[health.chip] }]} accessible accessibilityLabel={`Status: ${health.chipLabel}`}>
            <View style={[styles.chipDot, { backgroundColor: CHIP_COLOR[health.chip] }]} />
            <Text style={[styles.chipText, { color: CHIP_COLOR[health.chip] }]}>{health.chipLabel}</Text>
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
          <View>
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

  rule: { height: afLayout.hairline, backgroundColor: af.divider, marginVertical: 20 },

  gatedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: afLayout.radiusCard, minHeight: 44,
    borderWidth: 1, borderColor: withAlpha(af.amber, afAlpha.a50), backgroundColor: withAlpha(af.amber, afAlpha.a08),
  },
  gatedBannerText: { ...afType.eyebrow, color: af.amber, flex: 1 },

  shell: {
    marginTop: 16, padding: 16, borderRadius: afLayout.radiusCard, borderWidth: 1,
    borderColor: af.border, backgroundColor: af.surface, flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  shellError: { borderColor: af.borderAlert, backgroundColor: af.surfaceAlert },
  shellText: { ...afType.secondary, color: af.textSecondary, flex: 1 },

  // Current-state readout
  hero: {},
  heroLabel: { ...afType.eyebrow, color: af.textTertiary },
  numeralRow: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', columnGap: 16, rowGap: 4, marginTop: 8 },
  numeral: { ...afType.displayScore, color: af.textPrimary, fontVariant: ['tabular-nums'], flexShrink: 1 },
  stateCol: { paddingBottom: 10, gap: 4, flexShrink: 1 },
  stateEyebrow: { ...afType.micro, color: af.textTertiary },
  stateWord: { ...afType.eyebrow, color: af.textSecondary },
  track: { height: 4, borderRadius: 2, backgroundColor: af.divider, overflow: 'hidden', marginTop: 20 },
  trackFill: { height: 4, borderRadius: 2, backgroundColor: af.red },

  // Metric row
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 28, rowGap: 16, marginTop: 28 },
  metric: { gap: 6, flexShrink: 1 },
  metricLabel: { ...afType.micro, color: af.textTertiary, textTransform: 'uppercase' },
  metricValue: { ...afType.title3, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  metricEmpty: { ...afType.secondary, color: af.textTertiary, marginTop: 28 },

  // Plan card
  planCard: { marginTop: 28, gap: 12 },
  planSentence: { ...afType.bodyStrong, color: af.textPrimary },
  targetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: 12, rowGap: 8, minHeight: 44 },
  targetEditRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  targetTime: { ...afType.displayHero, fontSize: 40, lineHeight: 44, color: af.textPrimary, fontVariant: ['tabular-nums'], flexShrink: 1 },
  targetInput: { flex: 1, ...afType.displayHero, fontSize: 40, lineHeight: 44, color: af.textPrimary, paddingVertical: 0 },
  editChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: afLayout.radiusPill, borderWidth: 1, borderColor: af.border, minHeight: 44, justifyContent: 'center' },
  editChipText: { ...afType.eyebrow, color: af.textSecondary },
  saveBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: afLayout.radiusPill, backgroundColor: af.red, minHeight: 44, justifyContent: 'center' },
  saveBtnText: { ...afType.eyebrow, color: af.onRed },
  timeline: { gap: 6, marginTop: 4 },
  timelineTrack: { height: 4, borderRadius: 2, backgroundColor: af.divider, justifyContent: 'center' },
  timelineFill: { position: 'absolute', left: 0, height: 4, borderRadius: 2, backgroundColor: af.red },
  timelineDot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: af.textPrimary, marginLeft: -6, top: -4 },
  timelineLabels: { flexDirection: 'row', justifyContent: 'space-between', columnGap: 8 },
  timelineLabel: { ...afType.caption, color: af.textTertiary, flexShrink: 1 },

  // CTA
  cta: { marginTop: 20 },
  ctaBtn: {
    minHeight: afLayout.buttonHeight, borderRadius: afLayout.radiusButton, paddingHorizontal: 20, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', columnGap: 12,
    backgroundColor: af.red,
  },
  ctaBtnPressed: { opacity: 0.85 },
  ctaLabel: { ...afType.bodyStrong, color: af.onRed, flexShrink: 1 },

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
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: afLayout.radiusPill, borderWidth: 1, flexShrink: 1 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { ...afType.caption, fontSize: 12, flexShrink: 1 },
  healthCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, borderTopWidth: 1, borderTopColor: af.divider },
  healthCtaText: { ...afType.secondary, color: af.textSecondary },

  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6 },
  checkItemRuled: { borderTopWidth: 1, borderTopColor: af.divider },
  checkbox: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: af.border, alignItems: 'center', justifyContent: 'center', backgroundColor: af.canvasElevated },
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
  lifecycleDotActive: { backgroundColor: af.red, width: 10, height: 10, borderRadius: 5 },
  lifecycleDotDone: { backgroundColor: af.textTertiary },
  lifecycleLabel: { ...afType.micro, color: af.textTertiary, textAlign: 'center' },
  lifecycleLabelActive: { color: af.textPrimary },

  guidance: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: af.divider, gap: 6 },
  guidanceTitle: { ...afType.eyebrow, color: af.textTertiary },
  guidanceBody: { ...afType.caption, color: af.textSecondary, lineHeight: 18 },
  guidanceSecondary: { ...afType.caption, color: af.textTertiary },
});
