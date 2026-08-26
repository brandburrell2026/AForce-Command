/**
 * Circles screen — My Circle feed + open challenges + group filter.
 * Premium dark, never a public feed. Tap a card to open friend detail.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Icon } from '../components/Icon';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Colors } from '@/theme/colors';
import type { CircleGroup } from '@/types/circle';
import {
  getCircleFeed, listChallenges, acceptChallenge, listPending,
  getCircleLoadState, retryCircleHydration,
} from '@/services/circleService';
import { useCircleSubscription } from '@/hooks/useCircleSubscription';
import CircleUserCard from '@/components/CircleUserCard';
import CircleChallengeCard from '@/components/CircleChallengeCard';
import { AFEmptyState, AFErrorState, AFSkeleton } from '@/components/ui';
import { useEngineSlice } from '@/store/slices';

const GROUPS: { id: CircleGroup | 'all'; label: string }[] = [
  { id: 'all',     label: 'ALL' },
  { id: 'friends', label: 'FRIENDS' },
  { id: 'team',    label: 'TEAM' },
  { id: 'coach',   label: 'COACH' },
  { id: 'family',  label: 'FAMILY' },
];

export const CirclesScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [group, setGroup] = React.useState<CircleGroup | 'all'>('all');
  // Subscribe to the circle store so this screen refreshes whenever ANY
  // mutation runs — including from Manage Circle on a different screen.
  const v = useCircleSubscription();

  const feed = React.useMemo(
    () => getCircleFeed(group === 'all' ? undefined : group),
    [group, v],
  );
  const challenges = React.useMemo(() => listChallenges(), [v]);
  const pending = React.useMemo(() => listPending(), [v]);
  // Read AFTER the feed read above, which is what kicks the fetch off.
  // An empty feed means one of three different things and this is how we
  // tell them apart — "we couldn't reach your circle" must never be drawn
  // as "you have no one".
  const loadState = React.useMemo(() => getCircleLoadState(), [v]);

  // CIRCLE PULSE — surface the highest-scoring friend across the full
  // circle (not just the current group filter) plus the user's own
  // score so the comparison is always meaningful. Drives the headline
  // card above OPEN CHALLENGES per the polish spec.
  const engine = useEngineSlice();
  const userScore = engine.score;
  const pulseLeader = React.useMemo(() => {
    const all = getCircleFeed();
    if (all.length === 0) return null;
    return all.reduce((best, cur) => (cur.score > best.score ? cur : best), all[0]!);
  }, [v]);
  const pulseDelta = pulseLeader ? pulseLeader.score - userScore : 0;
  const pulseColor = pulseDelta > 0
    ? Colors.states.RECOVERING.primary
    : Colors.states.PEAK.primary;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={12} accessibilityLabel="Back">
          <Icon name="chevron-left" size={22} color={Colors.text.primary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.eyebrow}>AFORCE</Text>
          <Text style={styles.title}>CIRCLES</Text>
        </View>
        <Pressable
          onPress={() => router.push('/circles/manage')}
          style={styles.iconBtn} hitSlop={12} accessibilityLabel="Manage circle"
        >
          <Icon name="user-plus" size={20} color={Colors.text.primary} />
        </Pressable>
      </View>

      <View style={styles.subHeader}>
        <Pressable
          onPress={() => router.push('/circles/shared')}
          style={({ pressed }) => [styles.sharedBtn, pressed && { opacity: 0.85 }]}
          accessibilityLabel="Preview what others see about you"
        >
          <Icon name="eye" size={14} color={Colors.text.primary} />
          <Text style={styles.sharedBtnText}>WHAT OTHERS SEE</Text>
        </Pressable>
      </View>

      {/*
        Group filter row — five short labels distributed evenly across the
        full screen width. We deliberately do NOT use a horizontal ScrollView
        here: with a fixed, small number of options, scrolling caused both
        edges to clip and made the active tab look truncated. A flex row
        keeps every label fully visible on every screen size.
      */}
      <View style={styles.tabs}>
        {GROUPS.map(g => {
          const active = group === g.id;
          return (
            <Pressable
              key={g.id}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                setGroup(g.id);
              }}
              style={[styles.tab, active && styles.tabActive]}
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[styles.tabText, active && styles.tabTextActive]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {g.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {pulseLeader && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CIRCLE PULSE</Text>
            <Pressable
              onPress={() => router.push(`/circles/${pulseLeader.userId}`)}
              style={({ pressed }) => [styles.pulseCard, pressed && { opacity: 0.85 }]}
              testID="circle-pulse-card"
            >
              <View style={styles.pulseHeaderRow}>
                <View style={[styles.pulseDot, { backgroundColor: pulseColor }]} />
                <Text style={styles.pulseEyebrow}>TOP IN CIRCLE</Text>
                <Text style={[styles.pulseDelta, { color: pulseColor }]}>
                  {pulseDelta > 0 ? `+${pulseDelta}` : pulseDelta < 0 ? `${pulseDelta}` : 'TIED'}
                </Text>
              </View>
              <Text style={styles.pulseName} numberOfLines={1}>{pulseLeader.user.name}</Text>
              <View style={styles.pulseScoresRow}>
                <View style={styles.pulseScoreCol}>
                  <Text style={styles.pulseScoreLabel}>THEM</Text>
                  <Text style={[styles.pulseScoreVal, { color: pulseColor }]}>{pulseLeader.score}</Text>
                </View>
                <View style={styles.pulseScoreSeparator} />
                <View style={styles.pulseScoreCol}>
                  <Text style={styles.pulseScoreLabel}>YOU</Text>
                  <Text style={styles.pulseScoreVal}>{userScore}</Text>
                </View>
              </View>
              <Text style={styles.pulseHint}>
                {pulseDelta > 0
                  ? 'Study their cadence.'
                  : pulseDelta < 0
                    ? 'You\'re leading the circle right now — keep the rhythm.'
                    : 'Dead even. One AForce stick decides the day.'}
              </Text>
            </Pressable>
          </View>
        )}

        {challenges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>OPEN CHALLENGES</Text>
            <View style={styles.list}>
              {challenges.map(c => (
                <CircleChallengeCard
                  key={c.id}
                  challenge={c}
                  onAccept={(id) => acceptChallenge(id)}
                />
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MY CIRCLE</Text>
          {loadState === 'unavailable' ? (
            <AFErrorState
              variant="unavailable"
              title="Circle unavailable"
              message="We couldn't reach your circle just now. Nothing is being shown in its place."
              action={{ label: 'Try again', onPress: () => retryCircleHydration() }}
              testID="circle-feed-unavailable"
            />
          ) : loadState === 'loading' ? (
            <View style={styles.list} accessibilityLabel="Loading your circle">
              <AFSkeleton height={72} radius={18} />
              <AFSkeleton height={72} radius={18} />
            </View>
          ) : feed.length === 0 ? (
            <AFEmptyState
              icon="users"
              title="No one here yet"
              message={group === 'all'
                ? 'Your circle is empty. Invite the people whose cadence you actually want to match.'
                : 'No active members in this group yet.'}
              action={{ label: 'Invite', onPress: () => router.push('/circles/manage') }}
              testID="circle-feed-empty"
            />
          ) : (
            <View style={styles.list}>
              {feed.map(item => (
                <CircleUserCard
                  key={item.userId}
                  item={item}
                  onPress={() => router.push(`/circles/${item.userId}`)}
                />
              ))}
            </View>
          )}
        </View>

        {pending.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PENDING REQUESTS</Text>
            <Text style={styles.hint}>
              {pending.length} {pending.length === 1 ? 'request' : 'requests'} waiting in Manage Circle.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 4 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: Colors.text.muted, fontSize: 10, letterSpacing: 3, fontWeight: '600' },
  title:   { color: Colors.text.primary, fontSize: 14, letterSpacing: 4, fontWeight: '700' },
  subHeader: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8, alignItems: 'flex-end' },
  sharedBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100,
    borderWidth: 1, borderColor: Colors.border.medium, backgroundColor: Colors.fill.medium,
  },
  sharedBtnText: { color: Colors.text.primary, fontSize: 10, letterSpacing: 2, fontWeight: '700' },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  tab: {
    flex: 1,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: Colors.text.primary, borderColor: Colors.text.primary },
  tabText: {
    color: Colors.text.primary,
    fontSize: 10,
    letterSpacing: 0.4,
    fontWeight: '700',
    textAlign: 'center',
  },
  tabTextActive: { color: Colors.text.inverse },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 24 },
  section: { gap: 12 },
  sectionLabel: { color: Colors.text.muted, fontSize: 11, letterSpacing: 3, fontWeight: '600' },
  list: { gap: 12 },
  hint: { color: Colors.text.muted, fontSize: 13 },
  pulseCard: {
    padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.card,
    gap: 8,
  },
  pulseHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pulseDot: { width: 6, height: 6, borderRadius: 3 },
  pulseEyebrow: { flex: 1, color: Colors.text.muted, fontSize: 9, letterSpacing: 1.6, fontWeight: '700' },
  pulseDelta: { fontSize: 11, letterSpacing: 1, fontWeight: '700' },
  pulseName: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' },
  pulseScoresRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    marginTop: 4,
  },
  pulseScoreCol: { alignItems: 'flex-start' },
  pulseScoreSeparator: { width: 1, height: 28, backgroundColor: Colors.border.subtle },
  pulseScoreLabel: { color: Colors.text.muted, fontSize: 9, letterSpacing: 1.4, fontWeight: '700' },
  pulseScoreVal: { color: Colors.text.primary, fontSize: 26, fontFamily: 'Inter_700Bold', marginTop: 2 },
  pulseHint: { color: Colors.text.muted, fontSize: 11, lineHeight: 15, marginTop: 4 },
});

export default CirclesScreen;
