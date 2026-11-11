/**
 * AForce Concierge — contextual "Ask Concierge" entry for AFTopBar.
 *
 * Returns an AFTopBar `actions` array (empty when the flag is off) so a screen
 * adds the affordance with one prop and no layout change. `seed` is the
 * question the concierge composer opens with — the member still presses Send,
 * so nothing is asked on their behalf.
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { AFTopBarAction } from '@/components/ui';
import { useFeatureFlags } from '@/store/useAppStore';

export type ConciergeSeed = 'hydration' | 'signal' | 'weekly';

export function useAskConciergeActions(seed: ConciergeSeed): AFTopBarAction[] {
  const flags = useFeatureFlags();
  const router = useRouter();
  const { t } = useTranslation();
  const enabled = flags.ai_concierge_enabled;
  return React.useMemo<AFTopBarAction[]>(() => {
    if (!enabled) return [];
    return [
      {
        icon: 'message-circle',
        label: t('concierge.ask_action_label'),
        onPress: () => router.push({ pathname: '/concierge', params: { seed } }),
      },
    ];
  }, [enabled, router, seed, t]);
}
