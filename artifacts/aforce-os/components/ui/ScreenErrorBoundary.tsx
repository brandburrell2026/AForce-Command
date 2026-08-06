/**
 * ScreenErrorBoundary — VS 3.0 P1a.
 *
 * A per-tab error boundary. Wraps a tab's rendered content so a render crash
 * inside one tab shows a compact, recoverable in-tab fallback ("Reload tab")
 * instead of bubbling to the single app-root ErrorBoundary, which blanks the
 * ENTIRE app (the audit's worst reliability gap: `_layout.tsx` is the only
 * boundary in the tree). Reuses the vetted `ErrorBoundary` class verbatim — no
 * new error-catching logic here, only a lighter fallback than the full-screen
 * `ErrorFallback`. Applied in the (tabs) route files around the rendered screen;
 * it does NOT touch `(tabs)/_layout.tsx` (navigation structure is unchanged).
 *
 * Fully af.* / afType tokenized (0 raw color, on-scale type/spacing) so it
 * passes the VS 3.0 drift ratchets.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { ErrorFallbackProps } from '@/components/ErrorFallback';
import { AFPrimaryButton } from '@/components/ui/AFButton';
import { af, afType, afLayout } from '@/theme/afTokens';
import { Spacing } from '@/theme/spacing';

/** Compact, recoverable fallback shown when a single tab's content throws. */
export function ScreenErrorFallback({ resetError }: ErrorFallbackProps) {
  return (
    <View style={styles.root} accessibilityRole="alert">
      <Text style={styles.title}>This tab hit a snag.</Text>
      <Text style={styles.body}>
        The rest of the app is still running. Reload this tab to try again.
      </Text>
      <AFPrimaryButton label="Reload tab" onPress={resetError} />
    </View>
  );
}

export interface ScreenErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional crash reporter hook (componentStack), forwarded to ErrorBoundary. */
  onError?: (error: Error, componentStack: string) => void;
}

export function ScreenErrorBoundary({ children, onError }: ScreenErrorBoundaryProps) {
  return (
    <ErrorBoundary FallbackComponent={ScreenErrorFallback} onError={onError}>
      {children}
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: af.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: afLayout.screenPaddingX,
    gap: Spacing[4],
  },
  title: {
    ...afType.title3,
    color: af.textPrimary,
    textAlign: 'center',
  },
  body: {
    ...afType.secondary,
    color: af.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },
});
