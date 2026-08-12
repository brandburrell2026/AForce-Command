/**
 * useMomentPrepScheduling — keeps the OS-level Moments prep notifications in
 * sync with the store (Phase 3a, DR-010). Full resync on every relevant
 * change: wipe our own `aforce.moment.*` tags, reschedule the current plan.
 * That makes every mutation self-healing (I'M READY, deletes, edits, pref
 * changes) without per-path cancel bookkeeping.
 *
 * Delivery requires ALL of: `moments_enabled`, `moments_notifications_enabled`
 * (both OFF in production), and the user's `momentPrep` toggle. When any is
 * off we still resync with an empty plan so previously scheduled tags are
 * cleaned up.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useFeatureFlags, useAppStore } from '@/store/useAppStore';
import { useMomentsStore } from '@/services/momentsStore';
import {
  planMomentNotifications,
  getMomentNotifyPrefs,
  syncMomentNotifications,
} from '@/services/momentNotifications';
import { primePushPermission } from '@/services/pushNotifications';
import {
  hydrateMomentFeedback,
  useMomentFeedback,
  deriveLeadAdjustments,
} from '@/services/momentFeedback';

export function useMomentPrepScheduling(): void {
  const { t } = useTranslation();
  const flags = useFeatureFlags();
  const { notificationSettings } = useAppStore();
  const { moments, hydrated } = useMomentsStore();
  const feedback = useMomentFeedback();
  const learningOn = flags.moments_learning_enabled;
  React.useEffect(() => {
    if (learningOn) void hydrateMomentFeedback();
  }, [learningOn]);

  const enabled =
    flags.moments_enabled &&
    flags.moments_notifications_enabled &&
    notificationSettings.momentPrep;

  React.useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    void (async () => {
      if (!enabled) {
        await syncMomentNotifications([], t as never);
        return;
      }
      const granted = await primePushPermission();
      if (cancelled || !granted) return;
      const prefs = await getMomentNotifyPrefs();
      if (cancelled) return;
      const nowIso = new Date().toISOString();
      // DR-012: adjustments apply only with the learning flag AND the user's
      // adaptive preference; zero-adjustment otherwise (hard no-op gate).
      const adjustments =
        learningOn && prefs.adaptive ? deriveLeadAdjustments(feedback, nowIso) : undefined;
      const plan = planMomentNotifications(moments, prefs, nowIso, adjustments);
      await syncMomentNotifications(plan, t as never);
    })();
    return () => { cancelled = true; };
  }, [enabled, hydrated, moments, feedback, learningOn, t]);
}
