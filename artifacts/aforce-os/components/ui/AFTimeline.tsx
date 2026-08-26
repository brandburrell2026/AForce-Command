/**
 * AFTimeline — ordered steps with completed / current / upcoming / locked / hold
 * states (spec §5, §8.2 Protocol). A vertical rail of nodes + connectors; only
 * the current step carries emphasis. Locked/hold steps explain themselves via
 * subtitle rather than a red action.
 *
 * A11y (Wave-5 Phase-1 pass) — two defects, both fixed here in the primitive
 * rather than on Protocol, so every future consumer inherits the fix:
 *
 *  1. STATE BY APPEARANCE ONLY. Which step is done, current, upcoming, locked
 *     or on hold was carried entirely by the node's fill colour and a 10pt
 *     decorative glyph. Nothing in the accessibility tree said it, so the
 *     ordering that IS the point of a timeline was invisible to a screen
 *     reader and rested on hue for everyone else. Each step now SAYS its state.
 *  2. LOOSE FRAGMENTS. Title, meta and subtitle were three unlinked Texts, so
 *     a step was read as three separate swipes — the same defect already fixed
 *     for AFCard's composed labels and Circle's leader rows. Each step is now
 *     one accessibility element carrying one sentence.
 *
 * State WORDS are supplied by the caller (`stateLabels`) because this module is
 * i18n-free by design; the English state key is the documented fallback, the
 * same convention AFStatusBadge uses for its tone word.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { af, afType } from '@/theme';
import type { AFTimelineStepState } from './afPrimitives.logic';

export interface AFTimelineStep {
  title: string;
  subtitle?: string;
  state: AFTimelineStepState;
  meta?: string;
}

export interface AFTimelineProps {
  steps: AFTimelineStep[];
  /**
   * Translated word for each step state, spoken as part of the step's
   * announcement. Partial maps are fine — anything omitted falls back to the
   * state key itself, so a caller that passes nothing still gets a state word
   * rather than silence.
   */
  stateLabels?: Partial<Record<AFTimelineStepState, string>>;
  testID?: string;
}

/**
 * "Hydrate 16 oz, 2:00 PM, in 40 min, upcoming" — title first (it is what the
 * member is looking for), state last (it qualifies everything before it).
 */
export function timelineStepA11yLabel(
  step: AFTimelineStep,
  stateLabels?: Partial<Record<AFTimelineStepState, string>>,
): string {
  return [step.title, step.subtitle, step.meta, stateLabels?.[step.state] ?? step.state]
    .filter(Boolean)
    .join(', ');
}

const NODE: Record<AFTimelineStepState, { color: string; icon?: IconName; filled: boolean }> = {
  completed: { color: af.green, icon: 'check', filled: true },
  current: { color: af.red, filled: true },
  upcoming: { color: af.textTertiary, filled: false },
  locked: { color: af.textTertiary, icon: 'lock', filled: false },
  hold: { color: af.amber, icon: 'pause', filled: false },
};

export function AFTimeline({ steps, stateLabels, testID }: AFTimelineProps) {
  return (
    <View testID={testID}>
      {steps.map((step, i) => {
        const node = NODE[step.state];
        const isLast = i === steps.length - 1;
        const emphasized = step.state === 'current';
        return (
          // One element, one sentence — including the state word the node's
          // colour used to carry alone.
          <View
            key={`${step.title}-${i}`}
            style={styles.row}
            accessible
            accessibilityLabel={timelineStepA11yLabel(step, stateLabels)}
          >
            <View style={styles.rail}>
              <View
                style={[
                  styles.node,
                  { borderColor: node.color },
                  node.filled && { backgroundColor: node.color },
                ]}
              >
                {node.icon && (
                  <Icon name={node.icon} size={10} color={node.filled ? af.canvas : node.color} />
                )}
              </View>
              {!isLast && <View style={styles.connector} />}
            </View>
            <View style={[styles.content, isLast && styles.contentLast]}>
              <View style={styles.headerRow}>
                <Text style={[emphasized ? styles.titleCurrent : styles.title]} numberOfLines={2}>
                  {step.title}
                </Text>
                {step.meta && <Text style={styles.meta}>{step.meta}</Text>}
              </View>
              {step.subtitle && (
                <Text style={styles.subtitle} numberOfLines={2}>
                  {step.subtitle}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const NODE_SIZE = 20;
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: NODE_SIZE },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: { flex: 1, width: 2, backgroundColor: af.divider, marginVertical: 2 },
  content: { flex: 1, paddingBottom: 20 },
  contentLast: { paddingBottom: 0 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  title: { ...afType.body, color: af.textSecondary, flex: 1 },
  titleCurrent: { ...afType.bodyStrong, color: af.textPrimary, flex: 1 },
  subtitle: { ...afType.caption, color: af.textTertiary, marginTop: 2 },
  meta: { ...afType.caption, color: af.textTertiary },
});
