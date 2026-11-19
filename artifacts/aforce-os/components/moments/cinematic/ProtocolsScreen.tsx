/**
 * Protocols — the approved prototype's list page, opened from Moments.
 *
 * "Back · Moments", the title, then one tile each for Recovery, Sleep and
 * Travel. Presentation only: each tile opens a screen that already exists
 * (see protocolsListLogic). No photographs sit behind the tiles; which
 * photographs builds may use is an open founder decision.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { Icon } from '@/components/Icon';
import { AFScreen } from '@/components/ui';
import { travelPilotAvailable } from '@/featureFlags/flags';
import { useFeatureFlags } from '@/store/useAppStore';
import { af, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { PROTOCOLS_TITLE, protocolTiles } from './protocolsListLogic';

const MONO = 'IBMPlexMono_400Regular';
const GUTTER = 20;

export function ProtocolsScreen() {
  const router = useRouter();
  const flags = useFeatureFlags();
  const { isSignedIn } = useAuth();
  if (!flags.moments_enabled) return <Redirect href="/" />;
  // The Travel page is for a signed-in member in a build where the pilot is on.
  const tiles = protocolTiles({ travelAvailable: travelPilotAvailable(flags) && !!isSignedIn });

  return (
    <AFScreen scroll padded={false} contentContainerStyle={styles.content} testID="protocols-screen">
      <View style={styles.topRow}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/moments' as never))}
          accessibilityRole="button"
          accessibilityLabel="Back to Moments"
          hitSlop={8}
          style={styles.back}
          testID="protocols-back"
        >
          <Icon name="chevron-left" size={18} color={af.textPrimary} />
          <Text style={styles.backText}>Moments</Text>
        </Pressable>
        <Text style={styles.eyebrow}>PROTOCOLS</Text>
      </View>

      <Text
        accessibilityRole="header"
        style={styles.title}
        maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
      >
        {PROTOCOLS_TITLE}
      </Text>

      <View style={styles.tiles}>
        {tiles.map((tile) => (
          <Pressable
            key={tile.key}
            onPress={() => router.push(tile.route as never)}
            accessibilityRole="button"
            accessibilityLabel={`${tile.name}. ${tile.eyebrow}. ${tile.note}`}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
            testID={`protocols-tile-${tile.key}`}
          >
            <Text style={styles.tileEyebrow}>{tile.eyebrow.toUpperCase()}</Text>
            <Text style={styles.tileName}>{tile.name}</Text>
            <Text style={styles.tileNote}>{tile.note}</Text>
          </Pressable>
        ))}
      </View>
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingBottom: 40 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingRight: 8 },
  backText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: af.textPrimary },
  eyebrow: { fontFamily: MONO, fontSize: 11, lineHeight: 14, letterSpacing: 2, color: af.textSecondary },
  title: {
    fontFamily: 'Inter_600SemiBold', fontSize: 36, lineHeight: 38, letterSpacing: -0.72,
    color: af.textPrimary, marginTop: 14, marginBottom: 20,
  },
  tiles: { gap: 12 },
  tile: {
    minHeight: 148, borderRadius: 22, borderWidth: 1, borderColor: af.border,
    backgroundColor: af.surface, padding: 18, justifyContent: 'flex-end', gap: 4,
  },
  pressed: { opacity: 0.72 },
  tileEyebrow: { fontFamily: MONO, fontSize: 11, lineHeight: 14, letterSpacing: 2, color: af.textSecondary },
  tileName: { fontFamily: 'Inter_600SemiBold', fontSize: 28, lineHeight: 32, letterSpacing: -0.56, color: af.textPrimary },
  tileNote: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.textSecondary },
});
