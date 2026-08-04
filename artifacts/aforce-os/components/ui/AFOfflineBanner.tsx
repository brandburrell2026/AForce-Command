/**
 * AFOfflineBanner — honest offline-intake-outbox visibility (RC-1 audit's
 * worst gap: the store's offline intake outbox — `store/useAppStore.tsx`'s
 * `flushOutbox` + `services/intakeOutbox.ts` — was invisible in the UI).
 *
 * Modeled exactly on `ConnectedHealthView`'s offline banner (same af.* tokens,
 * same `accessibilityRole="alert"`, same "icon + one line of text" shape) but
 * pulled out into a shared primitive since two screens (Home, Hydration) need
 * it. Pure and presentational — no store/hook reads here — so it renders off
 * of exactly the two numbers that describe the honest signal:
 *
 *   - `pendingCount`: items in the outbox not yet confirmed synced (pending +
 *     syncing + failed — see `selectPendingCount` / `countPending`).
 *   - `hasFailedItem`: true when at least one queued item's most recent send
 *     attempt failed (`selectHasFailedItem`).
 *
 * The copy is deliberately narrow: it says "N intake(s) queued — not yet
 * synced" (or, once `hasFailedItem`, that the last attempt failed and AForce
 * is retrying), never a general "you're offline" claim — this banner has no
 * connectivity signal of its own (no NetInfo), only the outbox's queue state,
 * so it must never claim more than that.
 *
 * `pendingCount <= 0` renders nothing — callers don't need to gate the
 * mount, only compute the two numbers (typically flag-gated: see
 * `HomeScreenV2` / `HydrationScreenV2` for the `offline_intake_outbox_enabled`
 * check that keeps this fully inert while the flag is off).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { af, afType, afLayout } from '@/theme';

export interface AFOfflineBannerProps {
  /** Unsynced items in the outbox (pending + syncing + failed). */
  pendingCount: number;
  /** True when the most recent send attempt for a queued item failed. */
  hasFailedItem?: boolean;
  testID?: string;
}

export function AFOfflineBanner({
  pendingCount,
  hasFailedItem = false,
  testID = 'af-offline-banner',
}: AFOfflineBannerProps) {
  const { t } = useTranslation();
  if (pendingCount <= 0) return null;

  const key = hasFailedItem ? 'common.offline_banner.failed' : 'common.offline_banner.queued';
  const text = t(key, { count: pendingCount });

  return (
    <View
      style={styles.banner}
      testID={testID}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={text}
    >
      <Icon name="wifi-off" size={14} color={af.amber} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: afLayout.radiusCard - 6,
    borderWidth: 1,
    borderColor: 'rgba(255,160,30,0.4)',
    backgroundColor: 'rgba(255,160,30,0.08)',
    marginBottom: 12,
  },
  text: { ...afType.eyebrow, fontSize: 10, color: af.amber, flex: 1 },
});
