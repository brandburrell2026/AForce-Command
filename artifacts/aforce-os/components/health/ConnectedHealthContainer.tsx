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
  const [probesLoaded, setProbesLoaded] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());

  // Tick once a minute so "Synced Xm ago" freshness text can't go stale
  // while the screen sits open (mirrors screens/CruiseModeScreen.tsx).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const refreshCloudFacts = useCallback(async () => {
    const facts = await loadConnectedHealthCloudFacts(Date.now());
    setCloud(facts);
    setProbesLoaded(true);
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
      mode: probesLoaded ? 'ready' : 'loading',
      platform,
      featureFlags: state.featureFlags,
      biometrics: state.userState.biometrics,
      cloud,
      appleHealthLinked,
      appleHealthNativeReady,
    });
    return resolveConnectedHealthView(input);
  }, [now, probesLoaded, platform, state.featureFlags, state.userState.biometrics, cloud, appleHealthLinked, appleHealthNativeReady]);

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
