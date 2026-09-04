/**
 * The blocking "update required" surface — rendered only when a member's build
 * is genuinely below the minimum AND the founder has activated the UI.
 *
 * IT IS OFF. `FORCED_UPDATE_UI_ENABLED` ships false, so this renders its
 * children and nothing else, always. It exists now so that activation is a
 * one-line founder decision against code that has already been reviewed and
 * tested, rather than a screen written under pressure during an incident.
 *
 * THE FAILURE THAT MATTERS IS THE FALSE POSITIVE. Blocking a member whose app
 * is fine is worse than failing to block one whose app is stale: there is no
 * OTA, so a wrongly-blocked member waits for App Store review. Every path that
 * is not a definite `unsupported` renders the app.
 */
import React from 'react';
import { View, Text, StyleSheet, Linking, Pressable, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { af } from '@/theme/afTokens';
import { evaluateOwnSupport, shouldBlockForUpgrade, getLastClientPolicy } from '@/services/clientSupport';

/** Resolved per render, not at module load — a module-scope constant is fixed
 *  at import time and cannot be exercised by a test. Empty on web, which has
 *  no store; the gate is a native surface. */
function storeUrl(): string {
  return Platform.select({
    ios: 'https://apps.apple.com/app/id0000000000',
    android: 'market://details?id=com.aforce.os',
    default: '',
  }) ?? '';
}

export function ForcedUpdateGate({ children }: { children: React.ReactNode }): React.ReactElement {
  const { t } = useTranslation();
  // Re-evaluated on render from whatever policy has arrived. No fetch, no
  // retry, no loading state of its own — if nothing has arrived the verdict is
  // `unknown` and the app renders exactly as it does today.
  const verdict = evaluateOwnSupport(getLastClientPolicy());
  if (!shouldBlockForUpgrade(verdict)) return <>{children}</>;
  const STORE_URL = storeUrl();

  return (
    <View style={styles.root} accessibilityRole="alert" accessibilityViewIsModal testID="forced-update-gate">
      <Text style={styles.title} accessibilityRole="header">{t('update.required_title')}</Text>
      <Text style={styles.body}>{t('update.required_body')}</Text>
      {STORE_URL ? (
        <Pressable
          style={styles.cta}
          accessibilityRole="button"
          accessibilityLabel={t('update.required_cta')}
          accessibilityHint={t('update.required_hint')}
          onPress={() => { void Linking.openURL(STORE_URL).catch(() => undefined); }}
        >
          <Text style={styles.ctaText}>{t('update.required_cta')}</Text>
        </Pressable>
      ) : null}
      {/* OFFLINE / STORE-UNREACHABLE. The member is blocked from the app, so
          this screen must still be useful with no network and must never
          imply their data is gone. */}
      <Text style={styles.note}>{t('update.required_offline_note')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Brand tokens, not literals — the token ratchet rejects new raw hex, and
  // rightly: a blocking screen is the last place to invent a palette.
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: af.canvas, gap: 16 },
  title: { color: af.textPrimary, fontSize: 22, textAlign: 'center' },
  body: { color: af.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  cta: { backgroundColor: af.red, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 8, marginTop: 8 },
  ctaText: { color: af.onRed, fontSize: 16 },
  note: { color: af.textTertiary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 },
});

export default ForcedUpdateGate;
