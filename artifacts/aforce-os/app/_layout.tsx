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

import { ClerkAuthBridge } from '@/components/ClerkAuthBridge';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { InvestorDemoOverlay } from '@/components/investorDemo/InvestorDemoOverlay';
import { AppProvider, useAppStore } from '@/store/useAppStore';
import { CartProvider } from '@/store/useCartStore';
import { initI18n } from '@/services/i18nService';

// Bootstrap i18next as soon as the JS bundle loads so even the first
// frame (SplashScreen, ErrorBoundary fallbacks) has access to t(). The
// server-persisted language replaces this initial value via the effect
// in useAppStore once /state lands.
initI18n();

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const publishableKey = process.env['EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY'];
const proxyUrl = process.env['EXPO_PUBLIC_CLERK_PROXY_URL'] || undefined;

/**
 * SplashGate — on the very first launch, redirects the user into the
 * single Welcome screen at `/welcome`. Once the user taps BEGIN
 * PROTOCOL, `welcome.tsx` persists `aforce.hasCompletedOnboarding=true`
 * to AsyncStorage, so every subsequent launch skips the welcome and
 * the existing app boots normally.
 */
function SplashGate() {
  const pathname = usePathname();
  const checkedRef = React.useRef(false);
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    // DEMO_MODE: always replay the welcome on cold start.
    if (DEMO_MODE) {
      AsyncStorage.removeItem('aforce.hasCompletedOnboarding').catch(() => {});
      if (pathname !== '/welcome') router.replace('/welcome');
      return;
    }
    AsyncStorage.getItem('aforce.hasCompletedOnboarding')
      .then((v) => {
        if (v !== 'true' && pathname !== '/welcome') {
          router.replace('/welcome');
        }
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
      <Stack.Screen name="welcome" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="competition" options={{ headerShown: false, presentation: 'card' }} />
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

function AppShell() {
  return (
    <SafeAreaProvider>
      {/* Phase 1 (Opening Screen Safe-Area Fix): force light system
          status-bar glyphs (clock, battery, signal) on every screen so
          they remain visible against the pure-black opening canvas
          (splash + welcome) and every other dark surface. Without this
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
                  <RootLayoutNav />
                  <SplashGate />
                  <InvestorDemoMount />
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
