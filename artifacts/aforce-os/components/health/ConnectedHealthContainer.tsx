/**
 * ConnectedHealthContainer — thin, real-data container for the Connected
 * Health command center (W3.6 live wiring).
 *
 * NOT REGISTERED TO ANY ROUTE. This component is exported but unmounted —
 * no screen under `app/` imports it, and it appears in no nav/tab bar. It
 * exists so the full real-data wiring (store → cloud probes → the honest
 * per-provider status → the pure resolver → the pure presentational
 * `ConnectedHealthView`) can be built, tested, and reviewed as one unit
 * ahead of a future PR that actually mounts it behind a route. This mirrors
 * how `scoringEngine.ts` / `statusColor.ts` stay untouched by feature work —
 * here the boundary is "no navigation surface until product/legal sign off
 * on where Connected Health lives" rather than an off-limits file.
 *
 * STILL NO PROVIDER ACTIVATION:
 *   - Every `health_*` feature flag defaults OFF. This container never
 *     flips one; it only reads them. WHOOP keeps its documented flag-immune
 *     carve-out (the one provider that can show a real Connect/Connected
 *     row today) — see `utils/health/providerRowStatus.ts`.
 *   - `onTroubleshoot` is intentionally a no-op today. Wiring a real
 *     Connect/Reconnect OAuth flow from this screen is next-phase
 *     activation work, out of scope for this pass.
 *   - Apple Health's real link signal (`appleHealthLinked`) comes from
 *     genuine captured biometrics (`state.userState.biometrics.apple_health`
 *     present), never a mocked/demo toggle — Connected Health has no demo
 *     concept anywhere in its view model (see connectedHealthView.ts).
 *
 * All the actual data transformation and network orchestration lives in
 * `services/health/connectedHealthContainerModel.ts` (pure model +
 * injectable I/O layer) so it can be unit-tested without mounting this
 * component — see that file's header for why the split is drawn there.
 *
 * PROBE RESILIENCE (fix/health-connected-probe-resilience,
 * fix/health-probe-truthful-fallback):
 *   `loadConnectedHealthCloudFacts` is structurally built to never reject
 *   (see its own header) — every cloud probe is bounded by
 *   `CLOUD_PROBE_TIMEOUT_MS` and any rejection/throw is caught internally.
 *   `refreshCloudFacts` below still wraps the call in try/catch as defense
 *   in depth: this container must never assume that invariant holds forever
 *   just because it holds today. A probe rejection, timeout, or missing
 *   bridge maps to `cloudProbeStatus: 'retry'` → `mode: 'offline'`, the
 *   existing, honest "showing the last known connection status" shell —
 *   never a fabricated `disconnected`/`denied`/`unsupported` row state. That
 *   "last known" claim is genuinely implemented, not just asserted:
 *   `refreshCloudFacts` merges each cycle's facts on top of the previous
 *   cycle's (`mergeCloudFacts`) rather than replacing the whole `cloud`
 *   object, and a provider whose probe fails a given cycle is OMITTED from
 *   that cycle's facts (never overwritten with a fabricated "disconnected"
 *   guess) — so a provider connected on cycle 1 stays rendered as connected
 *   through a cycle-2 timeout, instead of being downgraded to dormant.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { af } from '@/theme';
import { useAppStore } from '@/store/useAppStore';
import { isAppleHealthSupported } from '@/services/appleHealth';
import { HEALTH_PROVIDERS, type HealthProviderId } from '@/data/healthProviders';
import { resolveConnectedHealthView } from '@/services/health/connectedHealthView';
import {
  buildConnectedHealthInput,
  loadConnectedHealthCloudFacts,
  mergeCloudFacts,
  performConnectedHealthDisconnect,
  revocationCopyKey,
  type ConnectedHealthCloudFacts,
} from '@/services/health/connectedHealthContainerModel';
import { ConnectedHealthView } from './ConnectedHealthView';

const EMPTY_CLOUD_FACTS: ConnectedHealthCloudFacts = {};

function toConnectedHealthPlatform(os: typeof Platform.OS): 'ios' | 'android' | 'web' {
  return os === 'ios' ? 'ios' : os === 'android' ? 'android' : 'web';
}

export interface ConnectedHealthContainerProps {
  /** No route owns this surface yet (see file header). Defaults to a no-op
   *  so the component renders standalone until a screen wrapper supplies a
   *  real back handler. */
  onBack?: () => void;
}

export function ConnectedHealthContainer({ onBack }: ConnectedHealthContainerProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { state, setProviderBiometrics } = useAppStore();

  const [cloud, setCloud] = useState<ConnectedHealthCloudFacts>(EMPTY_CLOUD_FACTS);
  /**
   * 'loading'  — no probe cycle has completed yet (initial mount shell).
   * 'ready'    — the most recent probe cycle completed with every cloud
   *              probe resolving honestly (a negative/ambiguous per-provider
   *              result still counts as "resolved" — see the model's header).
   * 'retry'    — the most recent probe cycle had at least one probe that
   *              REJECTED, THREW, or TIMED OUT — a client-side failure to
   *              even ask, distinct from a real-but-ambiguous server answer.
   *              Maps to `mode: 'offline'` below, never to a fabricated
   *              per-row `disconnected`/`denied`/`unsupported`.
   */
  const [cloudProbeStatus, setCloudProbeStatus] = useState<'loading' | 'ready' | 'retry'>('loading');
  const [now, setNow] = useState<number>(() => Date.now());

  // Tick once a minute so "Synced Xm ago" freshness text can't go stale
  // while the screen sits open (mirrors screens/CruiseModeScreen.tsx).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const refreshCloudFacts = useCallback(async () => {
    try {
      const { facts, anyProbeFailed } = await loadConnectedHealthCloudFacts(Date.now());
      // Genuinely MERGE this cycle's facts on top of whatever we already had
      // (`mergeCloudFacts`) rather than replacing the whole object. A
      // provider whose probe resolved this cycle (successfully or to a real
      // negative/ambiguous result) updates immediately. A provider whose
      // probe failed to complete this cycle (rejected/threw/timed out) is
      // OMITTED from `facts` entirely by `loadConnectedHealthCloudFacts`, so
      // the merge leaves that provider's prior, real value untouched — this
      // is what makes "showing the last known connection status" (this
      // container's `mode: 'offline'` copy) an accurate description of the
      // screen instead of an unimplemented claim.
      setCloud((prev) => mergeCloudFacts(prev, facts));
      setCloudProbeStatus(anyProbeFailed ? 'retry' : 'ready');
    } catch {
      // Defense in depth only — see file header. `loadConnectedHealthCloudFacts`
      // is built to never reach this catch, but this container must not
      // depend on that invariant holding forever: keep whatever cloud facts
      // are already known (never overwrite good data with a worse guess) and
      // surface the same honest retry state.
      setCloudProbeStatus('retry');
    }
  }, []);

  useEffect(() => {
    void refreshCloudFacts();
  }, [refreshCloudFacts]);

  const appleHealthNativeReady = useMemo(() => isAppleHealthSupported(), []);
  const appleHealthLinked = state.userState.biometrics?.apple_health != null;
  const platform = toConnectedHealthPlatform(Platform.OS);

  const view = useMemo(() => {
    const input = buildConnectedHealthInput({
      nowMs: now,
      mode: cloudProbeStatus === 'loading' ? 'loading' : cloudProbeStatus === 'retry' ? 'offline' : 'ready',
      platform,
      featureFlags: state.featureFlags,
      biometrics: state.userState.biometrics,
      cloud,
      appleHealthLinked,
      appleHealthNativeReady,
    });
    return resolveConnectedHealthView(input);
  }, [now, cloudProbeStatus, platform, state.featureFlags, state.userState.biometrics, cloud, appleHealthLinked, appleHealthNativeReady]);

  const onTroubleshoot = useCallback((_providerId: HealthProviderId) => {
    // See file header — connect/reconnect activation is next-phase work.
  }, []);

  const onDisconnect = useCallback(
    (providerId: HealthProviderId) => {
      const providerName = HEALTH_PROVIDERS.find((p) => p.id === providerId)?.name ?? providerId;

      const runDisconnect = () => {
        void (async () => {
          const outcome = await performConnectedHealthDisconnect(providerId);
          if (outcome === 'succeeded') {
            // Score-Protection / stale-data hygiene: a genuinely revoked
            // provider must stop contributing anything, immediately.
            setProviderBiometrics(providerId, null);
            await refreshCloudFacts();
          }
          const copy = revocationCopyKey(outcome);
          Alert.alert(t(copy.key, { name: providerName, ...(copy.params ?? {}) }));
        })();
      };

      Alert.alert(
        t('connected_health.revocation.confirm_title', { name: providerName }),
        t('connected_health.revocation.confirm_body', { name: providerName }),
        [
          { text: t('connected_health.revocation.confirm_cancel'), style: 'cancel' },
          { text: t('connected_health.revocation.confirm_cta'), style: 'destructive', onPress: runDisconnect },
        ],
      );
    },
    [t, setProviderBiometrics, refreshCloudFacts],
  );

  const topPadding = Platform.OS === 'web' ? 24 : insets.top;

  return (
    <View style={[styles.root, { paddingTop: topPadding }]}>
      <ConnectedHealthView
        view={view}
        onBack={onBack ?? (() => {})}
        onTroubleshoot={onTroubleshoot}
        onDisconnect={onDisconnect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: af.canvas },
});
