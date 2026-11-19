/**
 * AccountHome — the Account section of Profile, laid out as the approved
 * prototype: a short card (Plan, Settings), "Privacy" (what a Circle can see,
 * body details, your data), then Help.
 *
 * Every control that used to sit directly on the Account section still
 * exists. Each row here opens one named view that holds the same blocks,
 * unchanged (`ACCOUNT_VIEW_BLOCKS` is the full map; a test checks that no
 * block is left without a home).
 *
 * Two prototype rows are not drawn because nothing real is behind them:
 * "Shop AFORCE", and "Download or delete your data" (the app has no in-app
 * download or deletion yet — the row here is "Your data" and opens what the
 * app really has).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { af } from '@/theme';

export type AccountViewId = 'plan' | 'settings' | 'body' | 'data' | 'help';

/** The blocks each view holds, by the names they are declared under. */
export const ACCOUNT_VIEW_BLOCKS: Record<AccountViewId, readonly string[]> = {
  plan: ['subscriptionBlock', 'phaseEntryRow', 'inviteCard'],
  settings: ['notificationsBlock', 'settingsBlock', 'gentleEntry', 'skinIAEntry'],
  body: ['identityBlock'],
  data: ['privacyBlock'],
  help: ['legalBlock'],
};

export const ACCOUNT_VIEW_TITLE: Record<AccountViewId, string> = {
  plan: 'Plan',
  settings: 'Settings',
  body: 'Body details',
  data: 'Your data',
  help: 'Help',
};

interface RowProps {
  title: string;
  sub?: string;
  onPress: () => void;
  testID: string;
  last?: boolean;
}

function Row({ title, sub, onPress, testID, last }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${title}. ${sub}` : title}
      style={({ pressed }) => [styles.row, !last && styles.ruled, pressed && styles.pressed]}
      testID={testID}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <Icon name="chevron-right" size={18} color={af.textTertiary} />
    </Pressable>
  );
}

export interface AccountHomeProps {
  onOpen: (view: AccountViewId) => void;
  /** Opens the Circles tab, where what a Circle can see is explained and chosen. */
  onOpenCircle: () => void;
}

export function AccountHome({ onOpen, onOpenCircle }: AccountHomeProps) {
  return (
    <View testID="profile-account-home">
      <View style={styles.card}>
        <Row title="Plan" sub="Subscription and invites" onPress={() => onOpen('plan')} testID="account-row-plan" />
        <Row
          title="Settings"
          sub="Reminders, voice, units, language, sign out"
          onPress={() => onOpen('settings')}
          testID="account-row-settings"
          last
        />
      </View>

      <Text style={styles.eyebrow}>PRIVACY</Text>
      <View style={styles.card}>
        <Row title="What your Circle can see" sub="Private by default" onPress={onOpenCircle} testID="account-row-circle" />
        <Row title="Body details" sub="Private" onPress={() => onOpen('body')} testID="account-row-body" />
        <Row title="Your data" sub="What AFORCE collects and remembers" onPress={() => onOpen('data')} testID="account-row-data" last />
      </View>

      <View style={styles.card}>
        <Row title="Help" sub="Terms, privacy, support" onPress={() => onOpen('help')} testID="account-row-help" last />
      </View>
    </View>
  );
}

/** "‹ Account" and the view's name, above the blocks of an opened view. */
export function AccountViewHeader({ view, onBack }: { view: AccountViewId; onBack: () => void }) {
  return (
    <View style={styles.viewHeader}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to Account"
        hitSlop={8}
        style={styles.back}
        testID="account-view-back"
      >
        <Icon name="chevron-left" size={18} color={af.textPrimary} />
        <Text style={styles.backText}>Account</Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.viewTitle}>{ACCOUNT_VIEW_TITLE[view].toUpperCase()}</Text>
    </View>
  );
}

const MONO = 'IBMPlexMono_400Regular';

const styles = StyleSheet.create({
  card: { backgroundColor: af.surface, borderWidth: 1, borderColor: af.border, borderRadius: 20, paddingHorizontal: 18, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 12 },
  ruled: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: af.divider },
  pressed: { opacity: 0.72 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: 'Inter_400Regular', fontSize: 15, color: af.textPrimary },
  rowSub: { fontFamily: 'Inter_400Regular', fontSize: 12.5, lineHeight: 17, color: af.textSecondary },
  eyebrow: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: af.textSecondary, marginTop: 4, marginBottom: 6 },
  viewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, marginBottom: 8 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  backText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: af.textPrimary },
  viewTitle: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: af.textSecondary },
});
