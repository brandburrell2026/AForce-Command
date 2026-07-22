/**
 * AnalyticsConsentRow — the single consent affordance for the INTERNAL
 * analytics pipeline (Task #39).
 *
 * Privacy before collection: the dispatcher emits nothing until the
 * user flips this on. Toggling on grants consent (creating the
 * pseudonymous analytics id) and emits the first `consent_granted`
 * event; toggling off revokes consent and stops all emission. The
 * delete-my-data action erases server rows for this device's
 * pseudonymous id, clears the local outbox, and turns analytics off.
 *
 * Self-contained so it can drop into the existing Profile settings card
 * without adding navigation (replit.md build lock).
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import {
  CONSENT_VERSION,
  grantConsent,
  revokeConsent,
  isConsentGranted,
  deleteMyData,
} from '@/analytics/privacy_manager';
import { emit, clearOutbox } from '@/analytics/event_dispatcher';
import { flushPendingActivation } from '@/analytics/activation_tracker';

export function AnalyticsConsentRow() {
  const { t } = useTranslation();
  const [granted, setGranted] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void isConsentGranted().then((v) => {
      if (!cancelled) setGranted(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onToggle = React.useCallback(async (next: boolean) => {
    setBusy(true);
    try {
      if (next) {
        await grantConsent();
        setGranted(true);
        // First event after opt-in. Best-effort; consent is already saved.
        void emit('consent_granted', { consentVersion: CONSENT_VERSION });
        // Flush any acquisition QR scan that was buffered awaiting consent.
        void flushPendingActivation();
      } else {
        await revokeConsent();
        setGranted(false);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const runDelete = React.useCallback(async () => {
    setBusy(true);
    try {
      await deleteMyData(clearOutbox);
    } catch {
      /* deleteMyData already cleared local state in its finally */
    } finally {
      setGranted(false);
      setBusy(false);
    }
  }, []);

  const onDelete = React.useCallback(() => {
    if (Platform.OS === 'web') {
      void runDelete();
      return;
    }
    Alert.alert(
      t('settings.analyticsConsent.delete_title'),
      t('settings.analyticsConsent.delete_body'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.analyticsConsent.delete_confirm'),
          style: 'destructive',
          onPress: () => {
            void runDelete();
          },
        },
      ],
    );
  }, [runDelete]);

  return (
    <View style={styles.wrap} testID="analytics-consent">
      <View style={styles.row}>
        <View style={styles.left}>
          <Icon name="lock" size={16} color={Colors.text.secondary} />
          <View style={styles.textWrap}>
            <Text style={styles.label}>{t('settings.analyticsConsent.label')}</Text>
            <Text style={styles.subLabel}>{t('settings.analyticsConsent.sublabel')}</Text>
          </View>
        </View>
        <Switch
          value={granted}
          disabled={busy}
          onValueChange={(v) => {
            void onToggle(v);
          }}
          trackColor={{ false: 'rgba(255,255,255,0.12)', true: '#C1281B' }}
          thumbColor={Platform.OS === 'android' ? '#0a0014' : undefined}
          accessibilityLabel={t('settings.analyticsConsent.toggle_a11y')}
          testID="analytics-consent-switch"
        />
      </View>
      {granted ? (
        <Pressable
          onPress={onDelete}
          disabled={busy}
          style={styles.deleteBtn}
          accessibilityRole="button"
          accessibilityLabel={t('settings.analyticsConsent.delete_a11y')}
          testID="analytics-consent-delete"
        >
          <Text style={styles.deleteLabel}>{t('settings.analyticsConsent.delete_btn')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  textWrap: { flex: 1 },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  subLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: Colors.text.secondary,
  },
  deleteBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  deleteLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.2,
    color: '#FF2800',
  },
});

export default AnalyticsConsentRow;
