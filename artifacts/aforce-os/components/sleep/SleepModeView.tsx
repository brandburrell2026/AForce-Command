/**
 * SLEEP MODE (redesign) — pure presentational component.
 *
 * Renders a fully-resolved `SleepModeView` (see services/sleep/sleepModeView).
 * No store, flag, navigation, or data access — everything arrives via props, so
 * it is testable in isolation (render harness) and can never enable a gated
 * feature. Within-brand palette only (af.* tokens): Cinematic Black canvas,
 * cyan/teal as the calm recovery accent, green connected, amber caution, Signal
 * Red for error/disconnected only. Reduced-motion aware; 44×44 targets; Dynamic
 * Type (display numerals clamped, body text unclamped); color-independent status.
 */
import React from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { af, afType, afLayout, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { Icon } from '@/components/Icon';
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

export function SleepModeView({
  view, reducedMotion, editingTarget, targetDraft,
  onBack, onEditTarget, onChangeTargetDraft, onSaveTarget,
  onToggleChecklist, onPrimaryCta, onHealthCta,
}: SleepModeViewProps) {
  const { header, hero, target, recovery, health, checklist, lifecycle, guidance, mode } = view;

  return (
    <View style={styles.root} testID="sleep-mode-view">
      {/* 1 · Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.iconBtn}>
          <Icon name="chevron-left" size={22} color={af.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <Icon name="moon" size={14} color={af.cyan} />
            <Text style={styles.headerTitle} accessibilityRole="header">{header.title}</Text>
          </View>
          <Text style={styles.headerTagline}>{header.tagline}</Text>
        </View>
        <View style={styles.iconBtn} />
      </View>

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

      {/* 2 · Current-state hero */}
      <View style={styles.heroCard} testID={`sleep-hero-${lifecycle.states[lifecycle.activeIndex]?.key ?? 'idle'}`}>
        <View style={styles.heroLeft}>
          <Text style={styles.eyebrow}>{hero.eyebrow}</Text>
          <Text style={styles.heroState} accessibilityRole="header" maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
            {hero.state}
          </Text>
          <Text style={styles.heroDesc}>{hero.description}</Text>
        </View>
        <SleepRing
          kind={hero.ring.kind}
          valueLabel={hero.ring.valueLabel}
          caption={hero.ring.caption}
          progress={hero.ring.progress}
          reducedMotion={reducedMotion}
        />
      </View>

      {/* 3 · Sleep target */}
      <Card label="SLEEP TARGET">
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
              <Text style={styles.saveBtnText}>SAVE</Text>
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
            <View style={styles.editChip}><Text style={styles.editChipText}>EDIT TARGET</Text></View>
          </Pressable>
        )}
        <Text style={styles.targetCopy}>{target.countdownCopy}</Text>
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
      </Card>

      {/* 4 · Recovery readiness */}
      <Card label="RECOVERY READINESS">
        <View style={styles.postureRow}>
          <View style={[styles.dot, { backgroundColor: POSTURE_COLOR[recovery.posture] }]} />
          <Text style={styles.confidenceLabel}>{recovery.confidenceLabel}</Text>
        </View>
        <Text style={styles.interpretation}>{recovery.interpretation}</Text>
        {recovery.metrics.length > 0 ? (
          <View style={styles.metricRow}>
            {recovery.metrics.map((m) => (
              <View key={m.label} style={styles.metric} accessible accessibilityLabel={`${m.label}: ${m.value}`}>
                <Text style={styles.metricValue} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>{m.value}</Text>
                <Text style={styles.metricLabel}>{m.label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.metricEmpty}>No recovery metrics available yet.</Text>
        )}
      </Card>

      {/* 5 · Health source */}
      <Card label="HEALTH SOURCE">
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
      </Card>

      {/* 6 · Pre-sleep protocol checklist */}
      <Card label="PRE-SLEEP PROTOCOL">
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>{checklist.progressLabel}</Text>
        </View>
        <View style={styles.checklist}>
          {checklist.items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => onToggleChecklist(item.id)}
              style={styles.checkItem}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.done }}
              accessibilityLabel={`${item.label}${item.target ? `, ${item.target}` : ''}`}
              testID={`sleep-check-${item.id}`}
            >
              <View style={[styles.checkbox, item.done && styles.checkboxDone]}>
                {item.done ? <Icon name="check" size={14} color={af.canvas} /> : <Icon name={item.icon} size={15} color={af.textSecondary} />}
              </View>
              <View style={styles.checkTextWrap}>
                <Text style={[styles.checkLabel, item.done && styles.checkLabelDone]}>{item.label}</Text>
                {item.target ? <Text style={styles.checkTarget}>{item.target}</Text> : null}
              </View>
              {item.primary ? <View style={styles.primaryTag}><Text style={styles.primaryTagText}>PRIMARY</Text></View> : null}
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={onPrimaryCta}
          style={styles.primaryCta}
          accessibilityRole="button"
          accessibilityLabel={checklist.primaryCtaLabel}
          testID="sleep-primary-cta"
        >
          <Text style={styles.primaryCtaText}>{checklist.primaryCtaLabel}</Text>
        </Pressable>
      </Card>

      {/* 7 · Lifecycle indicator (system-derived — not tabs) */}
      <View style={styles.lifecycle} accessibilityLabel={`Sleep lifecycle, current: ${lifecycle.states[lifecycle.activeIndex]?.label}`}>
        {lifecycle.states.map((s) => (
          <View key={s.key} style={styles.lifecycleItem}>
            <View style={[styles.lifecycleDot, s.active && styles.lifecycleDotActive, s.done && styles.lifecycleDotDone]} />
            <Text style={[styles.lifecycleLabel, s.active && styles.lifecycleLabelActive]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* 8 · Guidance */}
      <View style={styles.guidance}>
        <Text style={styles.guidanceTitle}>{guidance.title}</Text>
        <Text style={styles.guidanceBody}>{guidance.body}</Text>
        <Text style={styles.guidanceSecondary}>{guidance.secondary}</Text>
      </View>
    </View>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel} accessibilityRole="header">{label}</Text>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function SleepRing({
  kind, valueLabel, caption, progress, reducedMotion,
}: { kind: 'countdown' | 'readiness' | 'none'; valueLabel: string; caption: string; progress: number; reducedMotion: boolean }) {
  // View-based ring (no SVG) so it renders in the harness. Reduced-motion has no
  // effect on a still ring; the animated draw-in lives at the container edge.
  const ringColor = kind === 'none' ? af.border : af.cyan;
  return (
    <View style={styles.ringWrap} accessible accessibilityLabel={`${caption}: ${valueLabel}`}>
      <View style={[styles.ring, { borderColor: ringColor, opacity: kind === 'none' ? 0.5 : 1 }]}>
        <Text style={styles.ringValue} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>{valueLabel}</Text>
      </View>
      <Text style={styles.ringCaption}>{caption}</Text>
      {!reducedMotion ? <View style={[styles.ringGlow, { opacity: 0.14 * progress }]} pointerEvents="none" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: afLayout.cardGap + 4, paddingHorizontal: afLayout.screenPaddingX, paddingBottom: 24 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center', gap: 2 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { ...afType.eyebrow, color: af.textPrimary, letterSpacing: 3 },
  headerTagline: { ...afType.caption, color: af.textTertiary },

  shell: { padding: 16, borderRadius: afLayout.radiusCard, borderWidth: 1, borderColor: af.border, backgroundColor: af.surface, flexDirection: 'row', alignItems: 'center', gap: 10 },
  shellError: { borderColor: af.redHairline, backgroundColor: af.redDim },
  shellText: { ...afType.secondary, color: af.textSecondary, flex: 1 },

  heroCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    padding: afLayout.cardPaddingLarge, borderRadius: afLayout.radiusHero,
    borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  heroLeft: { flex: 1, gap: 6 },
  eyebrow: { ...afType.eyebrow, color: af.cyan },
  heroState: { ...afType.title1, color: af.textPrimary },
  heroDesc: { ...afType.secondary, color: af.textSecondary },

  ringWrap: { width: 92, alignItems: 'center', gap: 6 },
  ring: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: af.canvasElevated },
  ringValue: { ...afType.title3, color: af.textPrimary },
  ringCaption: { ...afType.eyebrow, color: af.textTertiary, textAlign: 'center' },
  ringGlow: { position: 'absolute', width: 92, height: 92, borderRadius: 46, backgroundColor: af.cyan, top: -4 },

  card: { gap: 8 },
  cardLabel: { ...afType.eyebrow, color: af.textTertiary },
  cardBody: {
    padding: afLayout.cardPaddingLarge, borderRadius: afLayout.radiusCard,
    borderWidth: 1, borderColor: af.border, backgroundColor: af.surface, gap: 12,
  },

  targetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  targetEditRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  targetTime: { ...afType.displayHero, fontSize: 40, lineHeight: 44, color: af.textPrimary },
  targetInput: { flex: 1, ...afType.displayHero, fontSize: 40, lineHeight: 44, color: af.textPrimary, paddingVertical: 0 },
  editChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: afLayout.radiusPill, borderWidth: 1, borderColor: af.border, minHeight: 44, justifyContent: 'center' },
  editChipText: { ...afType.eyebrow, color: af.textSecondary },
  saveBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: afLayout.radiusPill, backgroundColor: af.cyan, minHeight: 44, justifyContent: 'center' },
  saveBtnText: { ...afType.eyebrow, color: af.canvas },
  targetCopy: { ...afType.secondary, color: af.textSecondary },
  timeline: { gap: 6, marginTop: 4 },
  timelineTrack: { height: 6, borderRadius: 3, backgroundColor: af.surfaceRaised, justifyContent: 'center' },
  timelineFill: { position: 'absolute', left: 0, height: 6, borderRadius: 3, backgroundColor: af.cyan },
  timelineDot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: af.textPrimary, marginLeft: -6, top: -3 },
  timelineLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  timelineLabel: { ...afType.caption, color: af.textTertiary },

  postureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  confidenceLabel: { ...afType.eyebrow, color: af.textSecondary },
  interpretation: { ...afType.body, color: af.textPrimary },
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  metric: { gap: 2 },
  metricValue: { ...afType.title3, color: af.textPrimary },
  metricLabel: { ...afType.caption, color: af.textTertiary },
  metricEmpty: { ...afType.secondary, color: af.textTertiary },

  healthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  healthLeft: { flex: 1, gap: 2 },
  healthProvider: { ...afType.bodyStrong, color: af.textPrimary },
  healthFreshness: { ...afType.caption, color: af.textTertiary },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: afLayout.radiusPill, borderWidth: 1 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { ...afType.caption, fontSize: 12 },
  healthCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, borderTopWidth: 1, borderTopColor: af.divider, paddingTop: 10 },
  healthCtaText: { ...afType.secondary, color: af.textSecondary },

  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { ...afType.eyebrow, color: af.cyan },
  checklist: { gap: 8 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  checkbox: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: af.border, alignItems: 'center', justifyContent: 'center', backgroundColor: af.canvasElevated },
  checkboxDone: { backgroundColor: af.cyan, borderColor: af.cyan },
  checkTextWrap: { flex: 1, gap: 1 },
  checkLabel: { ...afType.bodyStrong, color: af.textPrimary },
  checkLabelDone: { color: af.textSecondary, textDecorationLine: 'line-through' },
  checkTarget: { ...afType.caption, color: af.textTertiary },
  primaryTag: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: afLayout.radiusPill, backgroundColor: af.surfaceRaised },
  primaryTagText: { ...afType.eyebrow, fontSize: 9, color: af.cyan },
  primaryCta: { height: afLayout.buttonHeight, borderRadius: afLayout.radiusButton, backgroundColor: af.cyan, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryCtaText: { ...afType.bodyStrong, color: af.canvas, letterSpacing: 0.5 },

  lifecycle: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingVertical: 8 },
  lifecycleItem: { alignItems: 'center', gap: 6, flex: 1 },
  lifecycleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: af.border },
  lifecycleDotActive: { backgroundColor: af.cyan, width: 10, height: 10, borderRadius: 5 },
  lifecycleDotDone: { backgroundColor: af.textTertiary },
  lifecycleLabel: { ...afType.caption, fontSize: 10, color: af.textTertiary, textAlign: 'center' },
  lifecycleLabelActive: { color: af.textPrimary },

  guidance: { padding: 16, borderRadius: afLayout.radiusCard, borderWidth: 1, borderColor: af.divider, backgroundColor: af.canvasElevated, gap: 6 },
  guidanceTitle: { ...afType.eyebrow, color: af.textTertiary },
  guidanceBody: { ...afType.caption, color: af.textSecondary, lineHeight: 18 },
  guidanceSecondary: { ...afType.caption, color: af.textTertiary },
});
