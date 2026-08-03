/**
 * CONNECTED HEALTH — pure presentational component.
 *
 * Renders a fully-resolved `ConnectedHealthView` (see
 * services/health/connectedHealthView). No store, flag, navigation, or data
 * access — everything arrives via props, so it is testable in isolation
 * (render harness) and can never enable a gated feature or a live connection.
 *
 * I18N: every string the resolver emits is an `I18nText` (`{ key, params? }`)
 * — this component is the ONLY place in the Connected Health surface that
 * calls `t()`. Static chrome that the resolver has no state-dependent copy
 * for (the Back button, the Disconnect button, accessibility templates) is
 * translated here directly under the same `connected_health.*` namespace.
 * See services/health/connectedHealthView.ts's file header for why the
 * split is drawn this way.
 *
 * Within-brand palette only (af.* tokens) — no new colors. Status is
 * communicated by TEXT + SHAPE, never color alone: every status pill carries
 * its honest label, and the dot/border color is a reinforcement, not the
 * only signal. 44pt touch targets on every affordance. Reduced-motion has no
 * bearing here (this surface is static; no decorative motion to suppress).
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { af, afType, afLayout, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { Icon } from '@/components/Icon';
import type {
  ConnectedHealthView as ConnectedHealthVM,
  ConnectedHealthRowView,
  I18nText,
  StatusTone,
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

export function ConnectedHealthView({ view, onBack, onTroubleshoot, onDisconnect }: ConnectedHealthViewProps) {
  const { t } = useTranslation();
  const tt = (text: I18nText) => t(text.key, text.params);

  const { header, mode, offlineNotice, rows, emptyCopy, footer } = view;

  return (
    <View style={styles.root} testID="connected-health-view">
      {/* 1 · Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('connected_health.back')} style={styles.iconBtn}>
          <Icon name="chevron-left" size={22} color={af.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <Icon name="activity" size={14} color={af.cyan} />
            <Text style={styles.headerTitle} accessibilityRole="header">{tt(header.title)}</Text>
          </View>
          <Text style={styles.headerTagline}>{tt(header.tagline)}</Text>
        </View>
        <View style={styles.iconBtn} />
      </View>

      {/* Offline notice — loud, never silent; text carries the meaning. */}
      {offlineNotice ? (
        <View style={styles.offlineBanner} testID="connected-health-offline-banner" accessible accessibilityRole="alert" accessibilityLabel={tt(offlineNotice)}>
          <Icon name="wifi-off" size={14} color={af.amber} />
          <Text style={styles.offlineBannerText}>{tt(offlineNotice)}</Text>
        </View>
      ) : null}

      {mode === 'loading' ? (
        <View style={styles.shell} testID="connected-health-loading" accessible accessibilityLabel={t('connected_health.loading')}>
          <Text style={styles.shellText}>{t('connected_health.loading')}</Text>
        </View>
      ) : emptyCopy ? (
        <View style={styles.shell} testID="connected-health-empty" accessible accessibilityLabel={tt(emptyCopy)}>
          <Icon name="link" size={18} color={af.textSecondary} />
          <Text style={styles.shellText}>{tt(emptyCopy)}</Text>
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
        <Text style={styles.footerTitle} accessibilityRole="header">{tt(footer.title)}</Text>
        <Text style={styles.footerScoreLine}>{tt(footer.scoreProtectionLine)}</Text>
        <Text style={styles.footerBody}>{tt(footer.body)}</Text>
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
  const { t } = useTranslation();
  const tt = (text: I18nText) => t(text.key, text.params);

  const toneColor = TONE_COLOR[row.statusPill.tone];
  const hasAction = row.troubleshoot.kind !== 'none' && row.troubleshoot.label != null;
  const statusLabel = tt(row.statusPill.label);

  return (
    <View style={styles.card} testID={`ch-row-${row.providerId}`}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.providerName}>{row.displayName}</Text>
          <Text style={styles.provenance}>{tt(row.provenance)}</Text>
        </View>
        <View
          style={[styles.pill, { borderColor: toneColor }]}
          testID={`ch-status-${row.providerId}`}
          accessible
          accessibilityLabel={t('connected_health.status_a11y', { label: statusLabel })}
        >
          <View style={[styles.pillDot, { backgroundColor: toneColor }]} />
          <Text style={[styles.pillText, { color: toneColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <Text style={styles.subCopy}>{tt(row.subCopy)}</Text>
      <Text style={styles.freshness}>{tt(row.freshness)}</Text>

      {row.pulls.length > 0 ? (
        // Review #460 item 3: no container-level accessibilityLabel. A denied
        // chip must never be summarized into a "pulled" announcement — each
        // chip carries its own honest label instead (below).
        <View style={styles.chipRow} testID={`ch-pulls-${row.providerId}`}>
          {row.pulls.map((chip) => {
            const chipLabel = tt(chip.label);
            const chipStatus = t(`connected_health.pull_chip_status.${chip.status}`);
            return (
              <View
                key={chip.type}
                style={[styles.dataChip, chip.status === 'denied' && styles.dataChipDenied]}
                accessible
                accessibilityLabel={t('connected_health.pull_chip_a11y', { label: chipLabel, status: chipStatus })}
              >
                {chip.status === 'denied' ? <Icon name="slash" size={10} color={af.textTertiary} /> : null}
                <Text style={[styles.dataChipText, chip.status === 'denied' && styles.dataChipTextDenied]}>
                  {chipLabel}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {(hasAction || row.canDisconnect) ? (
        <View style={styles.actionsRow}>
          {hasAction && row.troubleshoot.label ? (
            <Pressable
              onPress={() => onTroubleshoot(row.providerId)}
              style={styles.actionBtn}
              accessibilityRole="button"
              accessibilityLabel={tt(row.troubleshoot.label)}
              testID={`ch-action-${row.providerId}`}
            >
              <Text style={styles.actionBtnText} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
                {tt(row.troubleshoot.label)}
              </Text>
              <Icon name="chevron-right" size={14} color={af.cyan} />
            </Pressable>
          ) : null}
          {row.canDisconnect ? (
            <Pressable
              onPress={() => onDisconnect(row.providerId)}
              style={styles.disconnectBtn}
              accessibilityRole="button"
              accessibilityLabel={t('connected_health.disconnect_a11y', { name: row.displayName })}
              testID={`ch-disconnect-${row.providerId}`}
            >
              <Text style={styles.disconnectBtnText}>{t('connected_health.disconnect')}</Text>
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
