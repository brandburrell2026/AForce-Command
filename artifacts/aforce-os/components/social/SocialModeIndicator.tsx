/**
 * Social Mode indicator — one hairline row on Home whenever a session is open.
 *
 * Two states, both honest:
 *   - LIVE   ("Social Mode is on since 9:40 PM · End the night") — the engine
 *             is applying the social command and decay.
 *   - STALE  ("A Social Mode session has been open since Aug 12 and no longer
 *             counts. End it to clear it.") — `active: true` persisted but
 *             older than SOCIAL_SESSION_MAX_MS; the engine already ignores it,
 *             and the member can close it so the row stops carrying it.
 *
 * Found 2026-10-06: a Developer-pane demo session from 2026-08-12 had steered
 * the founder's command for eight weeks with nothing on Home saying so.
 * "End the night" calls the store's deactivateSocialMode (POST
 * /aforce/social/deactivate) — the same path the Developer pane uses. No
 * flag: an open session is a fact about the member's state, not a feature.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { af, afLayout, afType } from '@/theme';
import { Icon } from '@/components/Icon';
import { useActionsSlice, useUserSlice } from '@/store/slices';
import { isSocialSessionLive } from '@/services/socialModeEngine';

interface SocialActions {
  deactivateSocialMode: () => Promise<unknown>;
}

export interface SocialModeIndicatorProps {
  /** Injectable clock for tests / fixtures. */
  now?: number;
  testID?: string;
}

export function SocialModeIndicator({ now, testID = 'social-mode-indicator' }: SocialModeIndicatorProps) {
  const { t, i18n } = useTranslation();
  const userState = useUserSlice();
  const { deactivateSocialMode } = useActionsSlice<SocialActions>();
  const [busy, setBusy] = React.useState(false);

  const sm = userState.socialMode;
  if (!sm || !sm.active) return null;

  const nowMs = now ?? Date.now();
  const live = isSocialSessionLive(sm, nowMs);
  const started = sm.startedAt instanceof Date ? sm.startedAt : new Date(sm.startedAt);
  const label = live
    ? t('social.indicator_on', { time: started.toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' }) })
    : t('social.indicator_stale', { date: started.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' }) });

  const onEnd = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await deactivateSocialMode();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.row} accessibilityRole="text" testID={testID}>
      <Icon name="wineglass" size={14} color={live ? af.amber : af.textTertiary} />
      <Text style={[styles.text, !live && styles.textStale]} testID={`${testID}-${live ? 'live' : 'stale'}`}>
        {label}
      </Text>
      <Pressable
        onPress={() => void onEnd()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t('social.end_night')}
        accessibilityState={{ disabled: busy, busy }}
        hitSlop={8}
        style={styles.endBtn}
        testID={`${testID}-end`}
      >
        <Text style={styles.end}>{t('social.end_night')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: afLayout.hairline,
    borderTopColor: af.divider,
    borderBottomWidth: afLayout.hairline,
    borderBottomColor: af.divider,
  },
  text: { ...afType.caption, color: af.textSecondary, flex: 1 },
  textStale: { color: af.textTertiary },
  endBtn: { minHeight: afLayout.controlMinHeight - 12, justifyContent: 'center' },
  end: { ...afType.caption, color: af.textPrimary },
});
