import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Feather } from '@expo/vector-icons';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ClerkProvider, ClerkLoaded } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Text, View } from 'react-native';

import { ClerkAuthBridge } from '@/components/ClerkAuthBridge';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppProvider } from '@/store/useAppStore';
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

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="competition" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="scan" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="subscription" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="subscription/manage" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="cart" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="heat" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="heat/guardian" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="phantom" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="cruise" options={{ headerShown: false, presentation: 'card' }} />
    </Stack>
  );
}

function AppShell() {
  return (
    <SafeAreaProvider>
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
