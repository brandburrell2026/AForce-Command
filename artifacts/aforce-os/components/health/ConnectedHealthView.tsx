/**
 * CONNECTED HEALTH — pure presentational component.
 *
 * Renders a fully-resolved `ConnectedHealthView` (see
 * services/health/connectedHealthView). No store, flag, navigation, or data
 * access — everything arrives via props, so it is testable in isolation
 * (render harness) and can never enable a gated feature or a live connection.
 *
 * Within-brand palette only (af.* tokens) — no new colors. Status is
 * communicated by TEXT + SHAPE, never color alone: every status pill carries
 * its honest label, and the dot/border color is a reinforcement, not the
 * only signal. 44pt touch targets on every affordance. Reduced-motion has no
 * bearing here (this surface is static; no decorative motion to suppress).
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { af, afType, afLayout, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { Icon } from '@/components/Icon';
import type {
  ConnectedHealthView as ConnectedHealthVM,
  ConnectedHealthRowView,
  StatusTone,
  PullChipStatus,
} from '@/services/health/connectedHealthView';

export interface ConnectedHealthViewProps {
  view: ConnectedHealthVM;
  onBack: () => void;
  onTroubleshoot: (providerId: ConnectedHealthRowView['providerId']) => void;
  onDisconnect: (providerId: ConnectedHealthRowView['providerId']) => void;
}

const TONE_COLOR: Record<StatusTone, string> = {
  green: af.green,
  cyan: af.cyan,
  amber: af.amber,
  red: af.redText,
  neutral: af.textTertiary,
};

const CHIP_STATUS_LABEL: Record<PullChipStatus, string> = {
  granted: 'granted',
  denied: 'denied',
  unknown: 'unknown',
};

export function ConnectedHealthView({ view, onBack, onTroubleshoot, onDisconnect }: ConnectedHealthViewProps) {
  const { header, mode, offlineNotice, rows, emptyCopy, footer } = view;

  return (
    <View style={styles.root} testID="connected-health-view">
      {/* 1 · Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.iconBtn}>
          <Icon name="chevron-left" size={22} color={af.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <Icon name="activity" size={14} color={af.cyan} />
            <Text style={styles.headerTitle} accessibilityRole="header">{header.title}</Text>
          </View>
          <Text style={styles.headerTagline}>{header.tagline}</Text>
        </View>
        <View style={styles.iconBtn} />
      </View>

      {/* Offline notice — loud, never silent; text carries the meaning. */}
      {offlineNotice ? (
        <View style={styles.offlineBanner} testID="connected-health-offline-banner" accessible accessibilityRole="alert" accessibilityLabel={offlineNotice}>
          <Icon name="wifi-off" size={14} color={af.amber} />
          <Text style={styles.offlineBannerText}>{offlineNotice}</Text>
        </View>
      ) : null}

      {mode === 'loading' ? (
        <View style={styles.shell} testID="connected-health-loading" accessible accessibilityLabel="Loading connected health sources">
          <Text style={styles.shellText}>Checking your connected sources…</Text>
        </View>
      ) : emptyCopy ? (
        <View style={styles.shell} testID="connected-health-empty" accessible accessibilityLabel={emptyCopy}>
          <Icon name="link" size={18} color={af.textSecondary} />
          <Text style={styles.shellText}>{emptyCopy}</Text>
        </View>
      ) : (
        <View style={styles.rows}>
          {rows.map((row) => (
            <ProviderRow key={row.providerId} row={row} onTroubleshoot={onTroubleshoot} onDisconnect={onDisconnect} />
          ))}
        </View>
      )}

      {/* Footer — the Score-Protection truth. Always visible, never conditional. */}
      <View style={styles.footer} testID="connected-health-footer">
        <Text style={styles.footerTitle} accessibilityRole="header">{footer.title}</Text>
        <Text style={styles.footerScoreLine}>{footer.scoreProtectionLine}</Text>
        <Text style={styles.footerBody}>{footer.body}</Text>
      </View>
    </View>
  );
}

function ProviderRow({
  row, onTroubleshoot, onDisconnect,
}: {
  row: ConnectedHealthRowView;
  onTroubleshoot: (providerId: ConnectedHealthRowView['providerId']) => void;
  onDisconnect: (providerId: ConnectedHealthRowView['providerId']) => void;
}) {
  const toneColor = TONE_COLOR[row.statusPill.tone];
  const hasAction = row.troubleshoot.kind !== 'none' && row.troubleshoot.label != null;

  return (
    <View style={styles.card} testID={`ch-row-${row.providerId}`}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.providerName}>{row.displayName}</Text>
          <Text style={styles.provenance}>{row.provenanceLine}</Text>
        </View>
        <View
          style={[styles.pill, { borderColor: toneColor }]}
          testID={`ch-status-${row.providerId}`}
          accessible
          accessibilityLabel={`Status: ${row.statusPill.label}`}
        >
          <View style={[styles.pillDot, { backgroundColor: toneColor }]} />
          <Text style={[styles.pillText, { color: toneColor }]}>{row.statusPill.label}</Text>
        </View>
      </View>

      <Text style={styles.subCopy}>{row.subCopy}</Text>
      <Text style={styles.freshness}>{row.freshnessLine}</Text>

      {row.pulls.length > 0 ? (
        <View style={styles.chipRow} accessibilityLabel={`Data pulled: ${row.pulls.map((c) => c.label).join(', ')}`}>
          {row.pulls.map((chip) => (
            <View
              key={chip.type}
              style={[styles.dataChip, chip.status === 'denied' && styles.dataChipDenied]}
              accessible
              accessibilityLabel={`${chip.label}, ${CHIP_STATUS_LABEL[chip.status]}`}
            >
              {chip.status === 'denied' ? <Icon name="slash" size={10} color={af.textTertiary} /> : null}
              <Text style={[styles.dataChipText, chip.status === 'denied' && styles.dataChipTextDenied]}>
                {chip.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {(hasAction || row.canDisconnect) ? (
        <View style={styles.actionsRow}>
          {hasAction ? (
            <Pressable
              onPress={() => onTroubleshoot(row.providerId)}
              style={styles.actionBtn}
              accessibilityRole="button"
              accessibilityLabel={row.troubleshoot.label ?? undefined}
              testID={`ch-action-${row.providerId}`}
            >
              <Text style={styles.actionBtnText} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
                {row.troubleshoot.label}
              </Text>
              <Icon name="chevron-right" size={14} color={af.cyan} />
            </Pressable>
          ) : null}
          {row.canDisconnect ? (
            <Pressable
              onPress={() => onDisconnect(row.providerId)}
              style={styles.disconnectBtn}
              accessibilityRole="button"
              accessibilityLabel={`Disconnect ${row.displayName}`}
              testID={`ch-disconnect-${row.providerId}`}
            >
              <Text style={styles.disconnectBtnText}>Disconnect</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
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
  headerTagline: { ...afType.caption, color: af.textTertiary, textAlign: 'center' },

  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,160,30,0.4)', backgroundColor: 'rgba(255,160,30,0.08)',
  },
  offlineBannerText: { ...afType.eyebrow, fontSize: 10, color: af.amber, flex: 1 },

  shell: {
    padding: 16, borderRadius: afLayout.radiusCard, borderWidth: 1, borderColor: af.border,
    backgroundColor: af.surface, flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  shellText: { ...afType.secondary, color: af.textSecondary, flex: 1 },

  rows: { gap: afLayout.cardGap },

  card: {
    padding: afLayout.cardPaddingLarge, borderRadius: afLayout.radiusCard,
    borderWidth: 1, borderColor: af.border, backgroundColor: af.surface, gap: 10,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  cardTitleWrap: { flex: 1, gap: 2 },
  providerName: { ...afType.bodyStrong, color: af.textPrimary },
  provenance: { ...afType.caption, color: af.textTertiary },

  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: afLayout.radiusPill, borderWidth: 1,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { ...afType.caption, fontSize: 12 },

  subCopy: { ...afType.secondary, color: af.textPrimary },
  freshness: { ...afType.caption, color: af.textTertiary },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dataChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 5, paddingHorizontal: 10, borderRadius: afLayout.radiusPill,
    backgroundColor: af.surfaceRaised, borderWidth: 1, borderColor: af.divider,
  },
  dataChipDenied: { borderColor: af.borderStrong, opacity: 0.7 },
  dataChipText: { ...afType.caption, fontSize: 11, color: af.textSecondary },
  dataChipTextDenied: { color: af.textTertiary, textDecorationLine: 'line-through' },

  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: af.divider, paddingTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingVertical: 8 },
  actionBtnText: { ...afType.secondary, color: af.cyan },
  disconnectBtn: { minHeight: 44, paddingVertical: 8, paddingHorizontal: 4, justifyContent: 'center' },
  disconnectBtnText: { ...afType.caption, color: af.textTertiary },

  footer: {
    padding: 16, borderRadius: afLayout.radiusCard, borderWidth: 1, borderColor: af.divider,
    backgroundColor: af.canvasElevated, gap: 6,
  },
  footerTitle: { ...afType.eyebrow, color: af.textTertiary },
  footerScoreLine: { ...afType.bodyStrong, color: af.textPrimary, lineHeight: 22 },
  footerBody: { ...afType.caption, color: af.textSecondary, lineHeight: 18 },
});
