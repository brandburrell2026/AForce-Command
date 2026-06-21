import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Icon } from '../components/Icon';
import { Feather } from '@expo/vector-icons';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { DEMO_MODE } from '../services/demoMode';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ClerkProvider, ClerkLoaded } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, usePathname } from 'expo-router';

import { ActivationDeepLinkObserver } from '@/components/ActivationDeepLinkObserver';
import { useCommandLedgerSync } from '@/hooks/useCommandLedgerSync';
import { ClerkAuthBridge } from '@/components/ClerkAuthBridge';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { InvestorDemoOverlay } from '@/components/investorDemo/InvestorDemoOverlay';
import { OpeningSequence } from '@/components/opening/OpeningSequence';
import { readinessLabel, type PerformanceLevel } from '@/utils/homeDashboard';
import { AppProvider, useAppStore, useFeatureFlags } from '@/store/useAppStore';
import { useEngineSlice } from '@/store/slices';
import { CartProvider } from '@/store/useCartStore';
import { initI18n } from '@/services/i18nService';
import { firstRunRoute } from '@/utils/firstRunRoute';
import { snoozeRevalidationDelay } from '@/utils/voiceCheckIn';
import { useVoiceCheckIn } from '@/hooks/useVoiceCheckIn';
import { VoiceCheckInOverlay } from '@/components/voiceCheckIn/VoiceCheckInOverlay';

// Bootstrap i18next as soon as the JS bundle loads so even the first
// frame (SplashScreen, ErrorBoundary fallbacks) has access to t(). The
// server-persisted language replaces this initial value via the effect
// in useAppStore once /state lands.
initI18n();

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const publishableKey = process.env['EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY'];
const proxyUrl = process.env['EXPO_PUBLIC_CLERK_PROXY_URL'] || undefined;

const ONBOARDING_DONE_KEY = 'aforce.hasCompletedOnboarding';

/**
 * SplashGate — first-run router. A single flag drives it:
 *   - `hasCompletedOnboarding` set only when the onboarding wizard
 *                             finishes / is skipped (onboarding.tsx).
 *
 * Decision logic lives in the pure `firstRunRoute` helper so it can be
 * unit-tested. A cold start before onboarding completes correctly
 * resumes at `/onboarding` instead of silently skipping setup. The
 * cinematic intro is the OpeningSequence overlay, so there is no
 * separate welcome lobby. DEMO_MODE wipes the flag and replays
 * onboarding every cold start.
 */
function SplashGate() {
  const pathname = usePathname();
  const checkedRef = React.useRef(false);
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    if (DEMO_MODE) {
      AsyncStorage.removeItem(ONBOARDING_DONE_KEY).catch(() => {});
      if (pathname !== '/onboarding') router.replace('/onboarding');
      return;
    }
    AsyncStorage.getItem(ONBOARDING_DONE_KEY)
      .then((value) => {
        const target = firstRunRoute({
          completedOnboarding: value === 'true',
        });
        if (target && pathname !== target) router.replace(target);
      })
      .catch(() => {
        // Storage failure is non-fatal: fall through into the regular
        // app rather than blocking the user behind a missing flag.
      });
  }, [pathname]);
  return null;
}

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Force every screen container to pure black (#000000) so the
        // brief frame between mount and the screen's own background
        // paint matches the WHOOP-cinematic canvas. Without this,
        // React Navigation's default light-gray (rgb(242,242,242)) on
        // iOS / web shows through and reads as a "blank white flash"
        // in the Replit preview iframe before the splash fades in.
        contentStyle: { backgroundColor: '#000000' },
      }}
    >
      <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="scan" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="subscription" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="subscription/manage" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="store" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="cart" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="heat" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="urine-check" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="heat/guardian" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="phantom" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="cruise" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="ring" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="ring/session" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="notifications" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="leaderboard" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="legal" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="modules" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="weekly-report" options={{ headerShown: false, presentation: 'card' }} />
    </Stack>
  );
}

/**
 * Mounts the Investor Demo overlay just under AppProvider so it can
 * read `isInvestorDemoActive` from the store. Floats above every
 * screen via React Native's Modal so it works on any tab / route.
 */
function InvestorDemoMount() {
  const { isInvestorDemoActive, setInvestorDemoActive } = useAppStore();
  return (
    <InvestorDemoOverlay
      visible={isInvestorDemoActive}
      onClose={() => setInvestorDemoActive(false)}
    />
  );
}

/**
 * CommandLedgerSyncMount — read-only bridge that mirrors live runtime
 * sources (intake history, voice check-ins, context provenance) into the
 * Command-Event Ledger. Renders nothing. Mounted inside AppProvider so the
 * hook can read the store. Never dispatches / never touches score
 * (Score-Protection); see hooks/useCommandLedgerSync.ts.
 */
function CommandLedgerSyncMount() {
  useCommandLedgerSync();
  return null;
}

/**
 * OpeningMount — plays the cinematic opening sequence once per cold
 * launch on top of every screen, then unmounts to reveal whatever the
 * app routed to underneath. `useState(true)` is initialised once when
 * AppShell first mounts (a single time per JS launch), so the sequence
 * naturally replays on every cold start but never on in-app navigation.
 * The readiness number is a read-only projection of the live engine
 * score (Score-Protection): the opening never awards or mutates score.
 */
function OpeningMount({ onDone }: { onDone: () => void }) {
  const engine = useEngineSlice();
  const [visible, setVisible] = React.useState(true);
  // Stable identity: the engine score refreshes under this overlay, and
  // an inline callback would rebuild OpeningSequence's timeline mid-play.
  const handleFinish = React.useCallback(() => {
    setVisible(false);
    onDone();
  }, [onDone]);
  if (!visible) return null;
  return (
    <OpeningSequence
      readinessScore={engine.score}
      statusLabel={readinessLabel(
        engine.performanceState.level as PerformanceLevel,
      )}
      onFinish={handleFinish}
    />
  );
}

/**
 * VoiceCheckInMount — the once-per-morning Voice Check-In ritual overlay.
 *
 * Mirrors OpeningMount: a top-most overlay that touches NO routing. It is
 * gated on flag + due + onboarding complete + the opening having dismissed,
 * and only on real app routes (never onboarding / auth). The flag is OFF in
 * DEFAULT_FLAGS and ON in DEMO ("Build 100% · Show 10%").
 *
 * An `activated` latch keeps the overlay mounted through the closing screen:
 * recording the answers flips `isDue` to false, and without the latch the mount
 * would unmount mid-ritual and hide the calibration confirmation. The latch is
 * CLEARED (not permanently set) by close / snooze, so a later morning — or an
 * expired snooze within the same warm session — re-opens the ritual. Because
 * `isDue` is time-based and the store only notifies on writes, a snooze schedules
 * a single re-check timer at its expiry to nudge the recomputation.
 */
function VoiceCheckInMount({ openingDone }: { openingDone: boolean }) {
  const flags = useFeatureFlags();
  const pathname = usePathname();
  const { isDue, hydrated, complete, snooze, snoozedUntilMs } = useVoiceCheckIn();

  const [onboardingComplete, setOnboardingComplete] = React.useState(false);
  const [activated, setActivated] = React.useState(false);
  // Bumped to re-evaluate the time-based `isDue` when a snooze window expires.
  const [, setRevalidateTick] = React.useState(0);

  // Re-read the onboarding flag whenever the route changes so it flips true
  // immediately after the wizard finishes and routes into the tabs.
  React.useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(ONBOARDING_DONE_KEY)
      .then((v) => {
        if (alive) setOnboardingComplete(v === 'true');
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  const routeOk =
    !pathname.startsWith('/onboarding') && !pathname.startsWith('/sign');

  const gatesOpen =
    flags.voice_checkin_enabled &&
    hydrated &&
    onboardingComplete &&
    openingDone &&
    routeOk;

  React.useEffect(() => {
    if (!activated && gatesOpen && isDue) setActivated(true);
  }, [activated, gatesOpen, isDue]);

  // While snoozed (gates open, not yet due, not active), schedule one re-check
  // at the snooze expiry so the ritual can re-open later in the same session.
  // An already-expired snooze yields a null delay and schedules nothing — the
  // ordinary `isDue` computation on the next render already covers that case,
  // so we never re-enter this effect with a redundant state update.
  React.useEffect(() => {
    if (activated || !gatesOpen || isDue) return;
    const delay = snoozeRevalidationDelay(snoozedUntilMs);
    if (delay == null) return;
    const id = setTimeout(() => setRevalidateTick((t) => t + 1), delay);
    return () => clearTimeout(id);
  }, [activated, gatesOpen, isDue, snoozedUntilMs]);

  if (!activated) return null;

  return (
    <VoiceCheckInOverlay
      onComplete={(answers) => {
        void complete(answers);
      }}
      onSnooze={() => {
        void snooze();
        setActivated(false);
      }}
      onClose={() => setActivated(false)}
    />
  );
}

function AppShell() {
  // The Voice Check-In overlay waits for the cinematic opening to dismiss so
  // the two top-most overlays never stack on a cold launch.
  const [openingDone, setOpeningDone] = React.useState(false);
  const handleOpeningDone = React.useCallback(() => setOpeningDone(true), []);
  return (
    <SafeAreaProvider>
      {/* Phase 1 (Opening Screen Safe-Area Fix): force light system
          status-bar glyphs (clock, battery, signal) on every screen so
          they remain visible against the pure-black opening canvas
          (splash + opening) and every other dark surface. Without this
          the default dark glyphs render invisibly against #000000 in
          the top safe-area chrome zone. */}
      <StatusBar style="light" />
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AppProvider>
                <CartProvider>
                  {/* Mounted *inside* AppProvider so the entitlement
                      hook can call useAppStore() safely. */}
                  <ClerkAuthBridge />
                  {/* Records acquisition QR / activation deep-links; no routing. */}
                  <ActivationDeepLinkObserver />
                  {/* Read-only bridge: mirrors live runtime sources into the
                      Command-Event Ledger (sandbox). No routing, no score. */}
                  <CommandLedgerSyncMount />
                  <RootLayoutNav />
                  <SplashGate />
                  <InvestorDemoMount />
                  {/* Top-most overlay: cinematic cold-launch opening. */}
                  <OpeningMount onDone={handleOpeningDone} />
                  {/* Voice Check-In ritual — shows after the opening, gated. */}
                  <VoiceCheckInMount openingDone={openingDone} />
                </CartProvider>
              </AppProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    // Pre-load the Feather icon font *before* the splash screen hides.
    // Without this, Android (and the first paint of iOS dev builds)
    // briefly renders empty boxes instead of glyphs because @expo/vector-
    // icons loads its font lazily on first <Icon> mount.
    ...Feather.font,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  // ClerkProvider is required: every screen below uses Clerk hooks
  // (`useAuth`, `useUser`) directly. Rather than guard each call site
  // with try/catch, surface a clear configuration error when the
  // EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY env var hasn't been wired up.
  if (!publishableKey) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0A0A0F',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 18,
            textAlign: 'center',
            fontFamily: 'Inter_600SemiBold',
            marginBottom: 8,
          }}
        >
          Auth is not configured
        </Text>
        <Text
          style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: 13,
            textAlign: 'center',
            fontFamily: 'Inter_400Regular',
            lineHeight: 18,
          }}
        >
          Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in this app&apos;s environment
          to enable sign-in.
        </Text>
      </View>
    );
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      tokenCache={tokenCache}
      proxyUrl={proxyUrl}
    >
      <ClerkLoaded>
        <AppShell />
      </ClerkLoaded>
    </ClerkProvider>
  );
}
