/**
 * Private v1.7 Circle: members and consented Moments only.
 *
 * Laid out as the approved prototype's Circles tab: the mark and member
 * photo, "Your people. Your Moments.", the status line, "Start a Moment" and
 * "Invite someone", then people, pending invitations and one card on what a
 * Circle can see. The people, invitations and their controls are the same
 * ones as before (CircleMembersPanel); only the layout changed.
 */
import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AFScreen } from '@/components/ui';
import { AFMark } from '@/components/ui/AFMark';
import { Icon } from '@/components/Icon';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { af, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { useMomentsData } from '@/components/moments/useMomentsData';
import { homeStatusLine } from '@/components/home/cinematic/homeCinematicLogic';
import { CircleMembersPanel } from './CircleMembersPanel';
import { ProfileEntryButton } from '@/components/profile/ProfileEntryButton';

/** Side gutter of the Circles tab, as in the reference (20pt). */
export const CIRCLES_GUTTER = 20;

export function CircleScreenV4() {
  const tabClearance = useTabBarClearance();
  const router = useRouter();
  const moments = useMomentsData();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [privacyOpen, setPrivacyOpen] = React.useState(false);
  const statusLine = homeStatusLine(
    moments.hydrated ? moments.surfaced : [],
    moments.hydrated ? moments.next ?? null : null,
  );
  return (
    <AFScreen
      scroll
      padded={false}
      contentContainerStyle={{ paddingBottom: tabClearance, paddingHorizontal: CIRCLES_GUTTER }}
      testID="circle-v4-screen"
    >
      <View style={styles.topRow}>
        <View style={styles.markRow}>
          <AFMark size={15} decorative />
          <Text style={styles.eyebrowBright}>CIRCLES</Text>
        </View>
        <ProfileEntryButton testID="circle-profile-entry" />
      </View>

      <View style={styles.hero}>
        <Text accessibilityRole="header" style={styles.title} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
          Your people.{'\n'}Your Moments.
        </Text>
        <Text style={styles.heroSub}>Plans you make together, then both make it back.</Text>
      </View>

      {statusLine ? (
        <View style={styles.statusLine}>
          <View style={styles.statusLeft}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{statusLine.left.toUpperCase()}</Text>
          </View>
          <Text style={[styles.statusText, styles.statusRight]}>{statusLine.right.toUpperCase()}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={() => router.push('/one-breath')}
          accessibilityRole="button"
          accessibilityLabel="Start a Moment"
          style={({ pressed }) => [styles.btn, styles.primary, pressed && styles.pressed]}
          testID="circle-start-moment"
        >
          <Text style={styles.primaryLabel}>Start a Moment</Text>
        </Pressable>
        <Pressable
          onPress={() => setInviteOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: inviteOpen }}
          accessibilityLabel="Invite someone"
          style={({ pressed }) => [styles.btn, styles.ghost, pressed && styles.pressed]}
          testID="circle-invite"
        >
          <Text style={styles.ghostLabel}>Invite someone</Text>
        </Pressable>
      </View>

      <CircleMembersPanel showLegacySharing={false} layout="demo" inviteOpen={inviteOpen} />

      <Pressable
        onPress={() => setPrivacyOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: privacyOpen }}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        testID="circle-v4-privacy"
      >
        <View style={styles.cardRow}>
          <Icon name="shield" size={18} color={af.textPrimary} />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Choose what your Circle can see</Text>
            <Text style={styles.cardSub}>Private by default</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </View>
        {privacyOpen ? (
          <View style={styles.cardBody}>
            <Text style={styles.cardBodyTitle}>Nothing is shared by default.</Text>
            <Text style={styles.cardBodyText}>
              You choose the Moments and updates you share. Scores, HydroState, ranks, streaks, and health data never appear in a Circle.
            </Text>
          </View>
        ) : null}
      </Pressable>
    </AFScreen>
  );
}

const MONO = 'IBMPlexMono_400Regular';

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrowBright: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: af.textPrimary, opacity: 0.92 },
  hero: { paddingTop: 44, paddingBottom: 26 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 40, lineHeight: 42, letterSpacing: -0.8, color: af.textPrimary },
  heroSub: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.textPrimary, opacity: 0.92, marginTop: 8 },
  statusLine: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: af.border, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 14,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: af.textTertiary },
  statusText: { fontFamily: MONO, fontSize: 9.5, letterSpacing: 1.5, color: af.textSecondary },
  statusRight: { color: af.textPrimary },
  actions: { flexDirection: 'row', gap: 12, marginBottom: 22 },
  btn: { flex: 1, minHeight: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primary: { backgroundColor: af.primaryFill },
  primaryLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: af.onPrimaryFill },
  ghost: { borderWidth: 1, borderColor: af.border },
  ghostLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: af.textPrimary },
  pressed: { opacity: 0.72 },
  card: { backgroundColor: af.surface, borderWidth: 1, borderColor: af.border, borderRadius: 20, padding: 18, marginTop: 22, gap: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontFamily: 'Inter_400Regular', fontSize: 15, color: af.textPrimary },
  cardSub: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: af.textSecondary },
  chev: { fontFamily: 'Inter_400Regular', fontSize: 20, color: af.textTertiary },
  cardBody: { gap: 6 },
  cardBodyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: af.textPrimary },
  cardBodyText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.textSecondary },
});
