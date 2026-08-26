import '../polyfills';
import { setBaseUrl } from '@workspace/api-client-react';
import { apiOrigin } from '@/lib/apiBase';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
  IBMPlexMono_700Bold,
} from '@expo-google-fonts/ibm-plex-mono';
import { Icon } from '../components/Icon';
import { Feather } from '@expo/vector-icons';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { DEMO_MODE, CAPTURE_MODE } from '../services/demoMode';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ClerkProvider, ClerkLoaded } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { safeTokenCache } from '@/featureFlags/safeTokenCache';
import { Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, usePathname } from 'expo-router';

import { ActivationDeepLinkObserver } from '@/components/ActivationDeepLinkObserver';
import { CoachModeVoiceSync } from '@/components/CoachModeVoiceSync';
import { useCommandLedgerSync } from '@/hooks/useCommandLedgerSync';
import { ClerkAuthBridge } from '@/components/ClerkAuthBridge';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { InvestorDemoOverlay } from '@/components/investorDemo/InvestorDemoOverlay';
import { OpeningSequence } from '@/components/opening/OpeningSequence';
import { WelcomeHero } from '@/components/welcome/WelcomeHero';
import { useTranslation } from 'react-i18next';
import { readinessLabel, type PerformanceLevel } from '@/utils/homeDashboard';
import { AppProvider, useAppStore, useFeatureFlags } from '@/store/useAppStore';
import { shouldShowInvestorDemo } from '@/featureFlags/flags';
import { useEngineSlice, useUserSlice, useHistorySlice, useBootstrapSlice } from '@/store/slices';
import { countRealHistoryEntries, resolveHomeEvidence } from '@/components/home/homeBaselineState';
import { CartProvider } from '@/store/useCartStore';
import { initI18n } from '@/services/i18nService';
import { firstRunRoute } from '@/utils/firstRunRoute';
import { snoozeRevalidationDelay } from '@/utils/voiceCheckIn';
import { useVoiceCheckIn } from '@/hooks/useVoiceCheckIn';
import { VoiceCheckInOverlay } from '@/components/voiceCheckIn/VoiceCheckInOverlay';
import { PerformanceStatementMount } from '@/components/performanceStatement/PerformanceStatementMount';
import { enableScreens } from 'react-native-screens';
import { DEFAULT_FLAGS } from '@/featureFlags/flags';

// iOS 26 + react-native-screens (#3940): native screens throw a void
// NSException at startup via RCTTurboModule performVoidMethodInvocation,
// crashing Release/TestFlight builds. Disabling native screens is the
// maintainer-documented workaround. Gated by native_screens_enabled;
// flip to true to restore native screens once the upstream fix lands.
// Runs at module load — before any <Stack>/<Screen> mounts — and nothing
// in expo-router / react-navigation calls enableScreens(true) to override it.
enableScreens(DEFAULT_FLAGS.native_screens_enabled);

// Bootstrap i18next as soon as the JS bundle loads so even the first
// frame (SplashScreen, ErrorBoundary fallbacks) has access to t(). The
// server-persisted language replaces this initial value via the effect
// in useAppStore once /state lands.
initI18n();

SplashScreen.preventAutoHideAsync();

// Wave-3 PR1: the generated OpenAPI client emits absolute /api/* paths;
// on native there is no origin to resolve them against, so referrals were
// dead in TestFlight. Point it at the canonical origin once, at startup.
setBaseUrl(apiOrigin());

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
    if (CAPTURE_MODE) {
      // Dev-only capture bypass: mark onboarding done and land on the tabs,
      // but never hijack an explicit deep-link (e.g. /gallery) — leave any
      // non-root path where it is so screenshot harnesses render.
      AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true').catch(() => {});
      if (pathname === '/' || pathname === '/onboarding') router.replace('/(tabs)' as never);
      return;
    }
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
        // Force every screen container to near-black #0D0D0D (the AForce
        // canvas) so the brief frame between mount and the screen's own
        // background paint matches the AForce canvas. Without this,
        // React Navigation's default light-gray (rgb(242,242,242)) on
        // iOS / web shows through and reads as a "blank white flash"
        // in the Replit preview iframe before the splash fades in.
        contentStyle: { backgroundColor: '#0D0D0D' },
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
      {/* Build-61 correction: Performance Signal is a detail surface pushed
          from the Hydration root, not the Hydration tab itself. */}
      <Stack.Screen name="performance-signal" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="moments" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="moments-plan" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="moment/[id]" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="calendar-settings" options={{ headerShown: false, presentation: 'card' }} />
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
  const featureFlags = useFeatureFlags();
  // Phase 10 gate: the overlay can only ever mount when `demo_mode_enabled`
  // is ON (OFF in the production binary). Belt-and-suspenders with the
  // flag-gated Profile launcher, so production has no path to this overlay.
  return (
    <InvestorDemoOverlay
      visible={shouldShowInvestorDemo(featureFlags, isInvestorDemoActive)}
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
  const { t } = useTranslation();
  const engine = useEngineSlice();
  // WAVE-5 EVIDENCE GATE, applied here too. Build 60 opened on a confident
  // number for members AForce had never observed: the cinematic reads
  // `engine.score`, and on a cold first launch that is the seeded
  // defaultUserState projection (76 / BALANCED), not a measurement. Home
  // already withholds that number until there is evidence; the cinematic
  // plays BEFORE Home, so without the same gate it simply announced the
  // fabrication first. Same resolver, same store-only signals, no network.
  const userState = useUserSlice();
  const history = useHistorySlice();
  const { isHydrated } = useBootstrapSlice();
  const evidence = resolveHomeEvidence({
    intakeEventCount: userState.intakeEvents?.length ?? 0,
    loggedDayCount: isHydrated ? countRealHistoryEntries(history) : null,
  });
  // `undefined` is the component's documented "withhold the number" input —
  // it renders EM_DASH rather than substituting any figure.
  const shownScore = evidence === 'established' ? engine.score : undefined;
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
      readinessScore={shownScore}
      statusLabel={
        evidence === 'established'
          ? readinessLabel(engine.performanceState.level as PerformanceLevel)
          // Not `undefined`: the component's own fallback is "READY TO PERFORM",
          // which is itself a claim about a body AForce has not observed. Reuse
          // the approved Wave-5 phrase instead of inventing a second one.
          : t('opening.readiness_building')
      }
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

/**
 * WelcomeMount — the WHOOP-style photo Welcome Hero "front door".
 *
 * Plays AFTER the cinematic opening (OpeningSequence, untouched). It is
 * mounted UNDER the cinematic (zIndex 999 vs the cinematic's 1000) for the
 * whole `opening` + `welcome` window so that when the cinematic fades its
 * master layer to 0 it crossfades straight into this opaque photo surface —
 * no black flash, and the routed app never bleeds through. The staggered
 * entrance (eyebrow → wordmark → tagline → buttons) only fires once `active`
 * (i.e. the cinematic has handed off).
 *
 * It touches NO routing itself: the buttons call back into AppShell, which
 * navigates (GET STARTED → onboarding, SIGN IN → sign-in) and advances the
 * launch phase to `done`. Universal — shown on every cold launch with no
 * hardware / entitlement gate; Score-Protection is unaffected (pure UI).
 */
function WelcomeMount({
  phase,
  onEntered,
}: {
  phase: LaunchPhase;
  onEntered: () => void;
}) {
  const onGetStarted = React.useCallback(() => {
    router.replace('/onboarding' as never);
    onEntered();
  }, [onEntered]);
  const onSignIn = React.useCallback(() => {
    router.replace('/(auth)/sign-in' as never);
    onEntered();
  }, [onEntered]);

  if (phase === 'done') return null;
  return (
    <WelcomeHero
      active={phase === 'welcome'}
      onGetStarted={onGetStarted}
      onSignIn={onSignIn}
    />
  );
}

/**
 * Cold-launch overlay sequence. The cinematic plays first (`opening`); when
 * it finishes we hand off to the photo Welcome Hero (`welcome`); once the
 * user picks an entry the front door dismisses (`done`) and the downstream
 * voice overlays are allowed to mount.
 */
type LaunchPhase = 'opening' | 'welcome' | 'done';

function AppShell() {
  // Cold-launch front-door state machine: opening → welcome → done. The
  // Voice Check-In / Performance Statement overlays wait for `done` so the
  // top-most overlays never stack on a cold launch. CAPTURE_MODE (dev-only
  // screenshot bypass) starts at 'done' so the cinematic + Welcome Hero
  // overlays never cover the surface being captured.
  const [phase, setPhase] = React.useState<LaunchPhase>(CAPTURE_MODE ? 'done' : 'opening');
  // Cinematic finished → crossfade into the Welcome Hero.
  const handleOpeningDone = React.useCallback(() => setPhase('welcome'), []);
  // User picked an entry → dismiss the hero, ungate downstream overlays.
  const handleEntered = React.useCallback(() => setPhase('done'), []);
  const openingDone = phase === 'done';
  return (
    <SafeAreaProvider>
      {/* Phase 1 (Opening Screen Safe-Area Fix): force light system
          status-bar glyphs (clock, battery, signal) on every screen so
          they remain visible against the pure-black opening canvas
          (splash + opening) and every other dark surface. Without this
          the default dark glyphs render invisibly against #0D0D0D in
          the top safe-area chrome zone.
          The Welcome Hero (phase 'welcome') is a photo with a DARK gym top,
          so light glyphs read cleanly there too — every phase stays light. */}
      <StatusBar style="light" />
      <ErrorBoundary
      onError={(error, componentStack) => {
        // Wave-3 PR8: the root boundary previously swallowed every caught
        // render crash — not even a console line; the componentStack was
        // captured and discarded. Device-local logging only (NO
        // transmission — a crash-reporting endpoint/vendor is a founder
        // STOP decision recorded in the Wave-3 report).
        console.error('[AForce] render crash:', error?.message, componentStack);
      }}
    >
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
                  {/* Read-only bridge: mirrors the effective Coach Mode into
                      textToSpeech's single speak() gate. No routing, no score. */}
                  <CoachModeVoiceSync />
                  <RootLayoutNav />
                  <SplashGate />
                  <InvestorDemoMount />
                  {/* Photo Welcome Hero — mounted UNDER the cinematic
                      (zIndex 999) so the cinematic's fade-out crossfades into
                      it with no black flash; waits for GET STARTED / SIGN IN.
                      CAPTURE_MODE (dev-only screenshot bypass) skips both
                      front-door overlays entirely — the cinematic's onDone
                      would otherwise pull the phase back to 'welcome' and
                      cover the surface being captured. */}
                  {!CAPTURE_MODE && <WelcomeMount phase={phase} onEntered={handleEntered} />}
                  {/* Top-most overlay: cinematic cold-launch opening (zIndex
                      1000, renders above the Welcome Hero). */}
                  {!CAPTURE_MODE && <OpeningMount onDone={handleOpeningDone} />}
                  {/* Voice Check-In ritual — shows after the opening, gated. */}
                  {/* CAPTURE_MODE also suppresses the post-launch ceremony
                      overlays (voice check-in / performance statement) —
                      starting the phase at 'done' would otherwise ARM them on
                      every capture relaunch and cover the surface. */}
                  {!CAPTURE_MODE && <VoiceCheckInMount openingDone={openingDone} />}
                  {/* Performance Statement — once-per-day voice-only coach
                      identity line; speaks after the opening / check-in. */}
                  {!CAPTURE_MODE && <PerformanceStatementMount openingDone={openingDone} />}
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
    // AForce Brand System type roles: Archivo Black (display) + IBM Plex Mono
    // (eyebrows / metric labels). Inter stays the body face.
    ArchivoBlack_400Regular,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
    IBMPlexMono_700Bold,
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
      tokenCache={DEFAULT_FLAGS.secure_store_startup_guard ? safeTokenCache : tokenCache}
      proxyUrl={proxyUrl}
    >
      <ClerkLoaded>
        <AppShell />
      </ClerkLoaded>
    </ClerkProvider>
  );
}
