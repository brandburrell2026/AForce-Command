/**
 * ScreenErrorBoundary — a per-screen render-crash boundary (stop-ship SS-18).
 *
 * The root boundary in `app/_layout.tsx` replaces the WHOLE app with a
 * "reload" screen. Wrapping a route in this boundary contains a render crash
 * to that screen: the tab bar and every other route keep working, and the
 * member can retry in place.
 *
 * Logging is device-local only, same as the root boundary. Nothing is
 * transmitted (a crash-reporting endpoint is a separate founder decision).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { ErrorFallbackProps } from '@/components/ErrorFallback';
import { af } from '@/theme/afTokens';

export const SCREEN_ERROR_TITLE = "This screen didn't load";
export const SCREEN_ERROR_BODY = 'The rest of the app is still working. Try again, or come back to this screen later.';
export const SCREEN_ERROR_RETRY = 'Try again';

export function ScreenErrorFallback({ resetError }: ErrorFallbackProps) {
  return (
    <View style={styles.container} accessibilityRole="alert" testID="screen-error-fallback">
      <Text style={styles.title}>{SCREEN_ERROR_TITLE}</Text>
      <Text style={styles.body}>{SCREEN_ERROR_BODY}</Text>
      <Pressable
        onPress={resetError}
        accessibilityRole="button"
        accessibilityLabel={SCREEN_ERROR_RETRY}
        testID="screen-error-retry"
        style={({ pressed }) => [styles.button, { opacity: pressed ? 0.85 : 1 }]}
      >
        <Text style={styles.buttonText}>{SCREEN_ERROR_RETRY}</Text>
      </Pressable>
    </View>
  );
}

export function ScreenErrorBoundary({
  screen,
  children,
}: React.PropsWithChildren<{ /** Route name, for the device-local log line only. */ screen: string }>) {
  return (
    <ErrorBoundary
      FallbackComponent={ScreenErrorFallback}
      onError={(error, componentStack) => {
        console.error(`[AForce] render crash on ${screen}:`, error?.message, componentStack);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
    backgroundColor: af.canvas,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: af.textPrimary,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
    color: af.textSecondary,
    textAlign: 'center',
  },
  button: {
    marginTop: 12,
    minHeight: 48,
    minWidth: 160,
    paddingHorizontal: 24,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: af.red,
  },
  buttonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: af.onRed,
  },
});
