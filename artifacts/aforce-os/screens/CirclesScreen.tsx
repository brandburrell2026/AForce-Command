/**
 * Circles screen — My Circle feed + open challenges + group filter.
 * Premium dark, never a public feed. Tap a card to open friend detail.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Colors } from '@/theme/colors';
import type { CircleGroup } from '@/types/circle';
import {
  getCircleFeed, listChallenges, acceptChallenge, listPending,
} from '@/services/circleService';
import { useCircleSubscription } from '@/hooks/useCircleSubscription';
import CircleUserCard from '@/components/CircleUserCard';
import CircleChallengeCard from '@/components/CircleChallengeCard';

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

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={12} accessibilityLabel="Back">
          <Feather name="chevron-left" size={22} color={Colors.text.primary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.eyebrow}>AFORCE</Text>
          <Text style={styles.title}>CIRCLES</Text>
        </View>
        <Pressable
          onPress={() => router.push('/circles/manage')}
          style={styles.iconBtn} hitSlop={12} accessibilityLabel="Manage circle"
        >
          <Feather name="user-plus" size={20} color={Colors.text.primary} />
        </Pressable>
      </View>

      <View style={styles.subHeader}>
        <Pressable
          onPress={() => router.push('/circles/shared')}
          style={({ pressed }) => [styles.sharedBtn, pressed && { opacity: 0.85 }]}
          accessibilityLabel="Preview what others see about you"
        >
          <Feather name="eye" size={14} color={Colors.text.primary} />
          <Text style={styles.sharedBtnText}>WHAT OTHERS SEE</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.tabs} contentContainerStyle={styles.tabsContent}
      >
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
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{g.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
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
          {feed.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No active members in this group.</Text>
              <Pressable
                onPress={() => router.push('/circles/manage')}
                style={({ pressed }) => [styles.emptyCta, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.emptyCtaText}>INVITE</Text>
              </Pressable>
            </View>
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
  tabs: { flexGrow: 0 },
  tabsContent: { paddingHorizontal: 20, gap: 6, paddingVertical: 8 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100,
    borderWidth: 1, borderColor: Colors.border.medium, backgroundColor: Colors.fill.light,
  },
  tabActive: { backgroundColor: Colors.text.primary, borderColor: Colors.text.primary },
  tabText: { color: Colors.text.primary, fontSize: 11, letterSpacing: 2, fontWeight: '600' },
  tabTextActive: { color: Colors.text.inverse },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 24 },
  section: { gap: 12 },
  sectionLabel: { color: Colors.text.muted, fontSize: 11, letterSpacing: 3, fontWeight: '600' },
  list: { gap: 12 },
  empty: {
    padding: 20, gap: 12, alignItems: 'center',
    borderRadius: 18, borderWidth: 1, borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.card,
  },
  emptyText: { color: Colors.text.muted, fontSize: 13 },
  emptyCta: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 100,
    backgroundColor: Colors.text.primary,
  },
  emptyCtaText: { color: Colors.text.inverse, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  hint: { color: Colors.text.muted, fontSize: 13 },
});

export default CirclesScreen;
