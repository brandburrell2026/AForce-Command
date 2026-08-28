/**
 * HomeFreshnessLabel — self-ticking "Checked …" text (RC-2 ruling E, item 1).
 *
 * Isolated into its own leaf component specifically so a periodic re-render
 * NEVER propagates to `HomeScreenV2` itself. `HomeScreenV2`'s render-count
 * guarantee — zero re-renders across a TICK_TIMER burst, proven by
 * `homeScreenV2RenderCount.render.test.tsx` — is about the screen body's
 * OWN hook subscriptions; it says nothing about (and is not regressed by) an
 * isolated child ticking on its own clock. Mirrors this repo's established
 * pattern for exactly this class of problem: `components/LocalTimeBar.tsx`
 * (a small ticking text label inside an otherwise static screen, driven by
 * its own local `setInterval`; that component has since been retired with
 * the orphan tree — the pattern lives on here).
 *
 * Uses `useAppStateGatedInterval` (not a raw `setInterval`) — the same
 * house primitive `useAppStore.tsx` uses for its own periodic timers — so
 * this produces zero background re-renders and refreshes immediately on
 * foreground return rather than showing a stale age for up to a full
 * interval. The 15s cadence is well under the coarsest bucket boundary this
 * label can cross (1 minute), so the displayed age is never more than one
 * cadence stale, while staying far cheaper than the global 1s TICK_TIMER
 * this file deliberately does NOT hook into (ruling E: "do NOT add a new
 * timer" — this reuses the existing gated-interval primitive at a much
 * coarser cadence, scoped to one Text node).
 */
import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppStateGatedInterval } from '@/hooks/useAppStateGatedInterval';
import { resolveHomeFreshness } from './homeFreshness';

/** Coarser than the 1-minute bucket boundary this label can cross, cheap enough to run always-on. */
const RECHECK_INTERVAL_MS = 15_000;

export interface HomeFreshnessLabelProps {
  /** Freshest known biometrics fetch time (epoch ms), or null when nothing has ever synced. */
  fetchedAtMs: number | null;
  /**
   * Whether ANY provider artifact exists (Apple Health snapshot or a
   * provider biometrics snapshot). Never-connected members render NOTHING
   * here — "Awaiting first sync" was a permanent false promise for them
   * (P1 trust set, founder-authorized).
   */
  hasProviderArtifact: boolean;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

export function HomeFreshnessLabel({ fetchedAtMs, hasProviderArtifact, style, testID }: HomeFreshnessLabelProps) {
  const { t } = useTranslation();
  const [now, setNow] = React.useState(() => Date.now());

  useAppStateGatedInterval(() => setNow(Date.now()), RECHECK_INTERVAL_MS);

  const freshness = resolveHomeFreshness(now, fetchedAtMs, hasProviderArtifact);
  if (freshness === null) return null; // never-connected: no claim at all
  return (
    <Text style={style} testID={testID}>
      {t(freshness.key, freshness.params)}
    </Text>
  );
}
