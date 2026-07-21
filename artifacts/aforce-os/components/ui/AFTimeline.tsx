/**
 * AFTimeline — ordered steps with completed / current / upcoming / locked / hold
 * states (spec §5, §8.2 Protocol). A vertical rail of nodes + connectors; only
 * the current step carries emphasis. Locked/hold steps explain themselves via
 * subtitle rather than a red action.
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
  testID?: string;
}

const NODE: Record<AFTimelineStepState, { color: string; icon?: IconName; filled: boolean }> = {
  completed: { color: af.green, icon: 'check', filled: true },
  current: { color: af.red, filled: true },
  upcoming: { color: af.textTertiary, filled: false },
  locked: { color: af.textTertiary, icon: 'lock', filled: false },
  hold: { color: af.amber, icon: 'pause', filled: false },
};

export function AFTimeline({ steps, testID }: AFTimelineProps) {
  return (
    <View testID={testID}>
      {steps.map((step, i) => {
        const node = NODE[step.state];
        const isLast = i === steps.length - 1;
        const emphasized = step.state === 'current';
        return (
          <View key={`${step.title}-${i}`} style={styles.row}>
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
