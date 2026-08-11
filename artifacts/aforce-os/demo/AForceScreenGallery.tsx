/**
 * demo/AForceScreenGallery.tsx — P0 Screen Gallery (visual-audit §8).
 *
 * Dev/demo-only harness that renders the shipped `…ScreenV2` surfaces in the
 * 13 deterministic states from `./galleryFixtures.ts`, framed at one of three
 * viewport presets, for side-by-side diffing against `design/aforce-os-reference/`.
 *
 * How a fixture is "applied": for store-driven surfaces (Home / Hydration /
 * Guardian / Activation) this component nests a fixture-scoped
 * `<AppContext.Provider>` + `<SliceProvider>` — the exact same context
 * objects `AppProvider` uses app-wide — around just that screen. Because
 * React context resolves to the *nearest* provider, the real app's live
 * `AppProvider` (mounted once at the root layout) is shadowed for this
 * subtree only; nothing here touches the live store, the network, or a
 * timer. Prop-driven surfaces (RecoveryCoachScreen, VoiceCheckInOverlay)
 * skip the store entirely and take the fixture as a direct prop, exactly as
 * they do in production.
 *
 * Isolation: only demo/ code imports production screens — no production
 * module imports anything from demo/ (enforced by
 * `demo/__tests__/galleryFixtures.guard.test.ts`).
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';

import { af, afType } from '../theme';
import {
  AFScreen,
  AFSectionLabel,
  AFListRow,
  AFCard,
  AFSegmentedControl,
  AFEmptyState,
  AFErrorState,
  AFStatusBadge,
} from '../components/ui';

import { AppContext } from '../store/useAppStore';
import { SliceProvider, type ActionsSlice } from '../store/slices';
import type { AppContextValue } from '../store/app/types';
import type { AppState as StoreAppState } from '../store/appStoreTypes';

import { HomeScreenV2 } from '../components/home/HomeScreenV2';
import { HydrationScreenV2 } from '../components/hydration/HydrationScreenV2';
import { PerformanceSignalV3 } from '../components/hydration/PerformanceSignalV3';
import { RecoveryCoachScreen } from '../components/recoveryCoach/RecoveryCoachScreen';
import { ManageSubscriptionScreenV2 } from '../components/subscription/ManageSubscriptionScreenV2';
import { VoiceCheckInOverlay } from '../components/voiceCheckIn/VoiceCheckInOverlay';
import GuardianScreen from '../app/guardian';

import {
  GALLERY_FIXTURES,
  GALLERY_VIEWPORTS,
  GALLERY_NOW,
  type GalleryFixture,
  type GalleryViewport,
} from './galleryFixtures';

// ─── No-op store bridge ────────────────────────────────────────────────────
// A function with fewer parameters is structurally assignable to every
// `AppContextValue` action field regardless of its declared arity — so two
// no-ops cover the entire action surface with zero `any`. The gallery is
// read-only/inspection-only: no fixture should ever mutate real state.
const noop = (): void => {};
const asyncNoop = async (): Promise<void> => {};

function buildDemoContextValue(state: StoreAppState): AppContextValue {
  return {
    state,
    // The gallery's fixtures ARE the "loaded" state by construction (no real
    // network round-trip ever runs here) — always hydrated so screens render
    // their real content for visual inspection instead of a permanent
    // pre-hydration skeleton.
    isHydrated: true,
    logIntake: asyncNoop,
    completeCycle: asyncNoop,
    snooze: noop,
    dismissSuccess: noop,
    updateSymptoms: asyncNoop,
    updateUrineSignal: asyncNoop,
    updateEnergyState: asyncNoop,
    confirmStatus: asyncNoop,
    setFeatureFlags: noop,
    setSubscription: noop,
    completeOnboarding: noop,
    setAppleHealthSnapshot: noop,
    setProviderBiometrics: noop,
    confirmCommand: asyncNoop,
    setLanguage: asyncNoop,
    activateSocialMode: asyncNoop,
    logSocialDrink: asyncNoop,
    confirmSocialHydration: asyncNoop,
    deactivateSocialMode: asyncNoop,
    activateCruiseMode: asyncNoop,
    activateVoyageShield: asyncNoop,
    setSocialContext: asyncNoop,
    setSweatAutopilot: noop,
    // Muted — the gallery must never speak; screens are rendered purely for
    // visual inspection.
    voiceCoachEnabled: false,
    setVoiceCoachEnabled: noop,
    selectedVoiceId: null,
    setSelectedVoiceId: noop,
    voiceIntensity: 'standard',
    setVoiceIntensity: noop,
    voiceScope: 'muted',
    setVoiceScope: noop,
    notificationSettings: state.notificationSettings,
    setNotificationSetting: noop,
    unitPreferences: state.unitPreferences,
    setUnitPreference: noop,
    profileIdentity: state.profileIdentity,
    setProfileIdentity: noop,
    isInvestorDemoActive: false,
    setInvestorDemoActive: noop,
  };
}

function buildDemoActionsSlice(): ActionsSlice {
  return {
    logIntake: asyncNoop,
    completeCycle: asyncNoop,
    snooze: noop,
    dismissSuccess: noop,
    updateSymptoms: asyncNoop,
    updateUrineSignal: asyncNoop,
    updateEnergyState: asyncNoop,
    confirmStatus: asyncNoop,
    setFeatureFlags: noop,
    setSubscription: noop,
    confirmCommand: asyncNoop,
  };
}

/** Shadows the live app store for the wrapped subtree with a fixture snapshot. */
function StoreOverride({ state, children }: { state: StoreAppState; children: React.ReactNode }) {
  const contextValue = React.useMemo(() => buildDemoContextValue(state), [state]);
  const actions = React.useMemo(() => buildDemoActionsSlice(), []);
  return (
    <AppContext.Provider value={contextValue}>
      <SliceProvider
        state={state}
        actions={actions}
        isHydrated={contextValue.isHydrated}
        selectedVoiceId={contextValue.selectedVoiceId}
        voiceCoachEnabled={contextValue.voiceCoachEnabled}
        voiceIntensity={contextValue.voiceIntensity}
        voiceScope={contextValue.voiceScope}
      >
        {children}
      </SliceProvider>
    </AppContext.Provider>
  );
}

// ─── Permission-denied approximation (composed from existing AF* primitives —
// see the fixture's `limitation` note for why there is no first-class screen). ──
function PermissionDeniedApproximation() {
  return (
    <AFScreen scroll>
      <AFSectionLabel label="Health Platforms" />
      <AFCard style={{ marginTop: 12 }}>
        <AFErrorState
          variant="offline"
          title="Permission not granted"
          message="AForce can't read this signal without device permission. Nothing was connected — no data is estimated in its place."
          action={{ label: 'Try again', onPress: () => {} }}
        />
      </AFCard>
      <View style={{ height: 16 }} />
      <AFCard>
        <AFEmptyState
          icon="shield"
          title="No connected platforms"
          message="Every provider below reflects its real, honest connection state — never a simulated grant."
        />
      </AFCard>
    </AFScreen>
  );
}

function CalibrationScreen() {
  return (
    <VoiceCheckInOverlay onComplete={() => {}} onSnooze={() => {}} onClose={() => {}} />
  );
}

/** Renders the right existing surface for a fixture — never a fork. */
function FixtureStage({ fixture }: { fixture: GalleryFixture }) {
  switch (fixture.surface) {
    case 'home':
      return (
        <StoreOverride state={fixture.appState!}>
          <HomeScreenV2 />
        </StoreOverride>
      );
    case 'signal':
      return <PerformanceSignalV3 fixtureRollups={fixture.rollups} />;
    case 'hydration':
      return (
        <StoreOverride state={fixture.appState!}>
          <HydrationScreenV2 />
        </StoreOverride>
      );
    case 'guardian':
      return (
        <StoreOverride state={fixture.appState!}>
          <GuardianScreen />
        </StoreOverride>
      );
    case 'activation':
      return (
        <StoreOverride state={fixture.appState!}>
          <ManageSubscriptionScreenV2 />
        </StoreOverride>
      );
    case 'recoveryCoach':
      return (
        <RecoveryCoachScreen
          command={fixture.recoveryCommand!}
          offline={fixture.offline}
          onClose={() => {}}
          onPrimary={() => {}}
          onAdjust={() => {}}
          nowOverride={GALLERY_NOW.getTime()}
        />
      );
    case 'calibration':
      return <CalibrationScreen />;
    case 'permissions':
      return <PermissionDeniedApproximation />;
    default:
      return null;
  }
}

// ─── Gallery shell: index list → viewport-framed detail ──────────────────

export function AForceScreenGallery({ initialFixtureId }: { initialFixtureId?: string } = {}) {
  // Deterministic deep-link for screenshot harnesses: /gallery?fixture=<id>
  // opens straight into that fixture's detail view (dev/demo-only surface).
  const [selectedId, setSelectedId] = React.useState<string | null>(initialFixtureId ?? null);
  const [viewportId, setViewportId] = React.useState<GalleryViewport['id']>('standard');

  const selected = selectedId ? GALLERY_FIXTURES.find((f) => f.id === selectedId) : null;
  const viewport = GALLERY_VIEWPORTS.find((v) => v.id === viewportId) ?? GALLERY_VIEWPORTS[1];

  if (selected) {
    return (
      <View style={styles.detailRoot}>
        <View style={styles.detailHeader}>
          <Pressable onPress={() => setSelectedId(null)} hitSlop={12}>
            <Text style={styles.backLink}>{'‹ All states'}</Text>
          </Pressable>
          <Text style={styles.detailTitle}>{selected.label}</Text>
          <Text style={styles.detailDriver}>{selected.driver}</Text>
          {selected.limitation ? (
            <View style={styles.limitationBox}>
              <AFStatusBadge label="Approximated" tone="caution" />
              <Text style={styles.limitationText}>{selected.limitation}</Text>
            </View>
          ) : null}
          <AFSegmentedControl
            segments={GALLERY_VIEWPORTS.map((v) => ({ key: v.id, label: `${v.label} · ${v.width}×${v.height}` }))}
            value={viewportId}
            onChange={(key) => setViewportId(key as GalleryViewport['id'])}
          />
        </View>
        <ScrollView contentContainerStyle={styles.frameScroll} showsVerticalScrollIndicator={false}>
          <View
            style={[
              styles.frame,
              { width: viewport.width, height: viewport.height },
            ]}
          >
            <FixtureStage fixture={selected} />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <AFScreen scroll>
      <Text style={styles.h1}>Screen Gallery</Text>
      <Text style={styles.sub}>
        P0 · deterministic states of the shipped …ScreenV2 surfaces, for visual QA + screenshot
        diffing. Dev/demo-only — see docs/ui/AFORCE_OS_SCREEN_GALLERY.md.
      </Text>

      <AFSectionLabel label={`${GALLERY_FIXTURES.length} states`} />
      <AFCard padded={false} style={styles.listCard}>
        {GALLERY_FIXTURES.map((f) => (
          <AFListRow
            key={f.id}
            icon={f.limitation ? 'alert-triangle' : 'chevron-right'}
            title={f.label}
            subtitle={f.driver}
            disclosure
            onPress={() => setSelectedId(f.id)}
            testID={`gallery-row-${f.id}`}
          />
        ))}
      </AFCard>
      <View style={{ height: 48 }} />
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  h1: { ...afType.title1, color: af.textPrimary, marginTop: 8 },
  sub: { ...afType.secondary, color: af.textTertiary, marginBottom: 24 },
  listCard: { paddingHorizontal: 16 },
  detailRoot: { flex: 1, backgroundColor: af.canvas },
  detailHeader: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, gap: 10 },
  backLink: { ...afType.bodyStrong, color: af.red },
  detailTitle: { ...afType.title2, color: af.textPrimary },
  detailDriver: { ...afType.caption, color: af.textTertiary },
  limitationBox: { gap: 6, marginTop: 4, marginBottom: 4 },
  limitationText: { ...afType.caption, color: af.textSecondary, lineHeight: 18 },
  frameScroll: { alignItems: 'center', paddingVertical: 24, paddingBottom: 80 },
  frame: {
    borderWidth: 1,
    borderColor: af.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: af.canvas,
  },
});
