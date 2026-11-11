/**
 * AForce Concierge — context builder bound to the live store.
 *
 * Reads the SAME slices and evidence inputs Home renders from, so the
 * concierge never sees a different picture of the member than the Home
 * screen does. Returns a stable builder function (the hook captures the
 * latest slices in a ref) so the conversation hook can call it per send.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useEngineSlice, useUserSlice, useHistorySlice, useBootstrapSlice } from '@/store/slices';
import { useFeatureFlags } from '@/store/useAppStore';
import { countRealHistoryEntries } from '@/components/home/homeBaselineState';
import { DEMO_MODE } from '@/services/demoMode';
import { buildConciergeContext } from '@/services/concierge/conciergeContext';
import type { ConciergeClientContext } from '@/services/concierge/conciergeTypes';

export function useConciergeDemoMode(): boolean {
  const flags = useFeatureFlags();
  return DEMO_MODE || flags.demo_mode_enabled || flags.health_demo_data_enabled;
}

export function useConciergeContext(stated?: ConciergeClientContext['stated']): () => ConciergeClientContext {
  const engine = useEngineSlice();
  const userState = useUserSlice();
  const history = useHistorySlice();
  const { isHydrated } = useBootstrapSlice();
  const flags = useFeatureFlags();
  const demoMode = useConciergeDemoMode();
  const { i18n } = useTranslation();

  const latest = React.useRef({ engine, userState, history, isHydrated, flags, demoMode, locale: i18n.language, stated });
  latest.current = { engine, userState, history, isHydrated, flags, demoMode, locale: i18n.language, stated };

  return React.useCallback(() => {
    const s = latest.current;
    return buildConciergeContext({
      engine: s.engine,
      userState: s.userState,
      history: s.history,
      flags: s.flags,
      demoMode: s.demoMode,
      locale: s.locale || 'en',
      loggedDayCount: s.isHydrated ? countRealHistoryEntries(s.history) : null,
      ...(s.stated ? { stated: s.stated } : {}),
    });
  }, []);
}
