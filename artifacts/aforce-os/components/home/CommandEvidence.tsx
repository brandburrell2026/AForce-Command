/**
 * CommandEvidence — the "Why this command" explainability surface for the
 * Evidence Engine™. Sits inside the CommandConsole frame, directly under the
 * AForce Command, as an expandable (collapsed-by-default) section.
 *
 * ── Lockstep + fail-closed ────────────────────────────────────────────────
 * Reads the SAME engine output the command card renders and asks the pure
 * `deriveCommandEvidence` selector WHY that exact command fired. The selector
 * mirrors copy.ts precedence and asserts its choice equals the command that
 * actually fired; on any mismatch it returns `integrity !== 'matched'` with no
 * items. This component renders NOTHING unless `integrity === 'matched'` and
 * there is at least one real item — so it can never show a reason that did not
 * drive the recommendation.
 *
 * ── Score-Protection ──────────────────────────────────────────────────────
 * Pure display projection of signals already in state. It never reads into,
 * awards, mutates, or fabricates the score. Stale / missing signals are shown
 * honestly (a per-row LIVE/STALE chip on timestamped sources) — never invented.
 *
 * ── Flag-gated ────────────────────────────────────────────────────────────
 * Gated by `evidence_engine_enabled` (OFF in the production binary). The parent
 * only mounts it when the flag is on, so the production surface is unchanged.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import { Icon } from '../Icon';
import { Colors } from '../../theme/colors';
import i18n from '../../services/i18nService';
import { useEngineSlice, useUserSlice } from '../../store/slices';
import {
  deriveCommandEvidence,
  type EvidenceItem,
  type EvidenceDirection,
} from '../../utils/scoring/commandEvidence';

// Monochrome opacity ramp keyed by how strongly a signal drove the read. Kept
// deliberately palette-neutral (one tone) so the evidence dots never collide
// with the urgency band or the WHOOP recovery colours.
const DIRECTION_OPACITY: Record<EvidenceDirection, number> = {
  raises_demand: 1,
  lowers_readiness: 1,
  protective: 1,
  positive_reinforcement: 0.8,
  maintains_state: 0.6,
  context: 0.45,
};

/** Localize the readiness level word in-place (states.depleted → "Depleted"). */
function labelParamsFor(item: EvidenceItem): Record<string, string | number> | undefined {
  if (!item.labelParams) return undefined;
  const level = item.labelParams.level;
  if (item.key.startsWith('readiness_') && typeof level === 'string') {
    return { ...item.labelParams, level: i18n.t(`states.${level}`) };
  }
  return item.labelParams;
}

function EvidenceRow({ item }: { item: EvidenceItem }) {
  const showFreshness = item.freshness.fetchedAtMs != null;
  const stale = item.freshness.status === 'stale';
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { opacity: DIRECTION_OPACITY[item.direction] }]} />
      <Text style={styles.rowText}>{i18n.t(item.labelKey, labelParamsFor(item))}</Text>
      {showFreshness ? (
        <View style={[styles.freshChip, stale && styles.freshChipStale]}>
          <Text style={[styles.freshChipText, stale && styles.freshChipTextStale]}>
            {i18n.t(stale ? 'evidence.freshness.stale' : 'evidence.freshness.fresh')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function CommandEvidenceImpl() {
  const engine = useEngineSlice();
  const userState = useUserSlice();
  const [expanded, setExpanded] = useState(false);

  const evidence = deriveCommandEvidence({
    command: engine.command,
    state: userState,
    engineOutput: engine,
  });

  // Fail closed: only a matched, item-bearing read is ever shown.
  if (evidence.integrity !== 'matched' || evidence.items.length === 0) return null;

  const items = evidence.items.slice(0, 3);

  return (
    <View style={[styles.wrap, { borderTopColor: Colors.border.subtle }]}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={i18n.t('evidence.header')}
        hitSlop={8}
      >
        <Text style={styles.headerLabel}>{i18n.t('evidence.header')}</Text>
        <View style={expanded ? styles.chevronOpen : undefined}>
          <Icon name="chevron-right" size={14} color={Colors.text.muted} />
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          <Text style={styles.summary}>{i18n.t(evidence.summaryKey, evidence.summaryParams)}</Text>
          {items.map((item) => (
            <EvidenceRow key={item.key} item={item} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export const CommandEvidence = React.memo(CommandEvidenceImpl);

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 12,
    borderTopWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 2.5,
  },
  chevronOpen: {
    transform: [{ rotate: '90deg' }],
  },
  body: {
    marginTop: 12,
    gap: 10,
  },
  summary: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary,
    lineHeight: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 5,
    backgroundColor: Colors.text.secondary,
  },
  rowText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary,
    lineHeight: 16,
  },
  freshChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  freshChipStale: {
    borderColor: `${Colors.text.muted}55`,
  },
  freshChipText: {
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.secondary,
    letterSpacing: 1,
  },
  freshChipTextStale: {
    color: Colors.text.muted,
  },
});
