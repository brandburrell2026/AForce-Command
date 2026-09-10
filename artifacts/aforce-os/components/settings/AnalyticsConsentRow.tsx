/**
 * AnalyticsConsentRow — the single consent affordance for the INTERNAL
 * analytics pipeline (Task #39).
 *
 * Privacy before collection: the dispatcher emits nothing until the user flips
 * this on. Toggling off revokes consent and stops all emission. The
 * delete-my-data action erases the member's server rows, clears the local
 * outbox, and turns analytics off.
 *
 * ── THE SWITCH IS NO LONGER A BOOLEAN ──────────────────────────────────────
 *
 * Consent now lives on the server, so a decision can be in four states, not
 * two, and the row must be honest about which:
 *
 *   settled           the server's answer, adopted.
 *   pending           recorded locally, still owed to the server. A revoke in
 *                     this state IS already in force — the position shown is
 *                     the truth, not an optimistic guess.
 *   needs_resolution  the server refused deterministically. Analytics stay OFF
 *                     and the member is offered an explicit retry. Nothing
 *                     retries automatically: a 403 that will never succeed must
 *                     not be re-POSTed on every foreground forever.
 *   unsynced          a member, but the server has not answered yet. The
 *                     switch stays OPERABLE: this state used to disable the
 *                     only control capable of leaving it.
 *   unreadable        a pending record on disk could not be read. The gate is
 *                     CLOSED — it might have said "revoke" — and deciding
 *                     again replaces the unreadable bytes.
 *   suppressed        the member has been forgotten. TERMINAL, and no retry is
 *                     offered because none could ever succeed.
 *   unknown           identity not resolved yet — the switch is disabled rather
 *                     than rendering a guess as a settled answer.
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
import { af } from '@/theme/afTokens';
import { Icon } from '@/components/Icon';
import {
  CONSENT_VERSION,
  grantConsent,
  revokeConsent,
  getConsentUiState,
  retryPendingDecision,
  subscribeConsentState,
  deleteMyData,
  syncAnalyticsAuthority,
  type ConsentUiState,
} from '@/analytics/privacy_manager';
import { emit, clearOutbox } from '@/analytics/event_dispatcher';
import { flushPendingActivation } from '@/analytics/activation_tracker';

const UNKNOWN: ConsentUiState = { status: 'unknown' };

export function AnalyticsConsentRow() {
  const { t } = useTranslation();
  const [ui, setUi] = React.useState<ConsentUiState>(UNKNOWN);
  const [busy, setBusy] = React.useState(false);
  const [deleteFailed, setDeleteFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const read = () => {
      void getConsentUiState().then((next) => {
        if (!cancelled) setUi(next);
      });
    };
    read();
    // Ask the server for the member's real state when this row opens. Without
    // this the row can only ever show `unsynced`, because nothing else in the
    // app currently calls reconcile — see the initAnalytics note in the PR.
    // This is the consent screen refreshing its own data, not a new app-wide
    // lifecycle hook.
    void syncAnalyticsAuthority();
    // The authority changes state without the UI asking — a reconcile adopts
    // the server's answer, an account switch wipes it. Subscribe rather than
    // hold a snapshot taken at mount.
    const unsubscribe = subscribeConsentState(read);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const granted = ui.status === 'unknown' || ui.status === 'not_a_member' ? false : ui.granted;
  // The switch is disabled ONLY where there is genuinely nothing to decide:
  // identity unresolved, signed out, or terminally suppressed. It is
  // deliberately ENABLED for `unsynced` — that state used to disable the only
  // control capable of leaving it, which made a first-time member's consent
  // decision unreachable. Nothing is auto-granted or auto-revoked; the member
  // decides, and `recordDecision` reconciles from whatever the server answers.
  const manageable =
    ui.status !== 'unknown' && ui.status !== 'not_a_member' && ui.status !== 'suppressed';

  const onToggle = React.useCallback(async (next: boolean) => {
    setBusy(true);
    try {
      const outcome = next ? await grantConsent() : await revokeConsent();
      setUi(await getConsentUiState());
      // The first event after opt-in is emitted only once the grant is
      // CONFIRMED by the server. A queued grant has not opened collection —
      // emitting here would produce an envelope the gate refuses anyway.
      if (next && outcome.outcome === 'confirmed') {
        void emit('consent_granted', { consentVersion: CONSENT_VERSION });
        // Flush any acquisition QR scan that was buffered awaiting consent.
        void flushPendingActivation();
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const onRetry = React.useCallback(async () => {
    setBusy(true);
    try {
      await retryPendingDecision();
      setUi(await getConsentUiState());
    } finally {
      setBusy(false);
    }
  }, []);

  const runDelete = React.useCallback(async () => {
    setBusy(true);
    setDeleteFailed(false);
    try {
      await deleteMyData(clearOutbox);
    } catch {
      // The server did NOT confirm the erasure. Say so. The durable ceiling
      // raised before the request keeps analytics closed meanwhile, so the
      // member is not collected while this is unresolved — but showing
      // success here would be a lie about their data.
      setDeleteFailed(true);
    } finally {
      setUi(await getConsentUiState());
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
          disabled={busy || !manageable}
          onValueChange={(v) => {
            void onToggle(v);
          }}
          trackColor={{ false: 'rgba(255,255,255,0.12)', true: '#C1281B' }}
          thumbColor={Platform.OS === 'android' ? '#0a0014' : undefined}
          accessibilityLabel={t('settings.analyticsConsent.toggle_a11y')}
          testID="analytics-consent-switch"
        />
      </View>
      {ui.status === 'not_a_member' ? (
        <Text style={styles.note} testID="analytics-consent-signed-out">
          {t('settings.analyticsConsent.signed_out_note')}
        </Text>
      ) : null}
      {ui.status === 'pending' ? (
        <Text style={styles.note} testID="analytics-consent-pending">
          {t('settings.analyticsConsent.pending_note')}
        </Text>
      ) : null}
      {ui.status === 'unsynced' ? (
        <Text style={styles.note} testID="analytics-consent-unsynced">
          {t('settings.analyticsConsent.unsynced_note')}
        </Text>
      ) : null}
      {ui.status === 'unreadable' ? (
        <Text style={styles.note} testID="analytics-consent-unreadable">
          {t('settings.analyticsConsent.unreadable_note')}
        </Text>
      ) : null}
      {/* TERMINAL. No retry is offered, because none could ever succeed. */}
      {ui.status === 'suppressed' ? (
        <Text style={styles.note} testID="analytics-consent-suppressed">
          {t('settings.analyticsConsent.suppressed_note')}
        </Text>
      ) : null}
      {deleteFailed ? (
        <Text style={styles.errorNote} testID="analytics-consent-delete-failed">
          {t('settings.analyticsConsent.delete_failed_note')}
        </Text>
      ) : null}
      {ui.status === 'needs_resolution' ? (
        <View style={styles.resolveWrap} testID="analytics-consent-needs-resolution">
          <Text style={styles.note}>{t('settings.analyticsConsent.needs_resolution_note')}</Text>
          <Pressable
            onPress={() => {
              void onRetry();
            }}
            disabled={busy}
            style={styles.retryBtn}
            accessibilityRole="button"
            accessibilityLabel={t('settings.analyticsConsent.retry_a11y')}
            testID="analytics-consent-retry"
          >
            <Text style={styles.retryLabel}>{t('settings.analyticsConsent.retry_btn')}</Text>
          </Pressable>
        </View>
      ) : null}
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
  errorNote: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    lineHeight: 16,
    color: af.redText,
    marginTop: 8,
  },
  note: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: Colors.text.secondary,
    marginTop: 8,
  },
  resolveWrap: {
    gap: 6,
  },
  retryBtn: {
    alignSelf: 'flex-start',
  },
  retryLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.2,
    // af.redText, not af.red: Signal Red is ~3.1:1 on these surfaces and fails
    // WCAG AA for TEXT. The fill red stays frozen for fills.
    color: af.redText,
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
