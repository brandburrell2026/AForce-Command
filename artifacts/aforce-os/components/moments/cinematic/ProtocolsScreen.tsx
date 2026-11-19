/**
 * Protocols — the approved prototype's list page, opened from Moments.
 *
 * "Back · Moments", the title, then one tile each for Recovery, Sleep and
 * Travel. Presentation only: each tile opens a screen that already exists
 * (see protocolsListLogic). Each tile sits on its World photograph in builds
 * that may show them (internal builds); elsewhere the tile is plain.
 */
import React from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { Icon } from '@/components/Icon';
import { AFScreen } from '@/components/ui';
import { travelPilotAvailable } from '@/featureFlags/flags';
import { useFeatureFlags } from '@/store/useAppStore';
import { af, withAlpha, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { worldPhoto } from '@/components/world/worldPhotoSources';
import { PROTOCOL_SCENES } from '@/utils/worldPhoto';
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
        {tiles.map((tile) => {
          const photo = worldPhoto(PROTOCOL_SCENES[tile.key]);
          const hasPhoto = photo != null;
          const words = (
            <>
              <Text style={[styles.tileEyebrow, hasPhoto && styles.onPhoto]}>{tile.eyebrow.toUpperCase()}</Text>
              <Text style={styles.tileName}>{tile.name}</Text>
              <Text style={[styles.tileNote, hasPhoto && styles.onPhoto]}>{tile.note}</Text>
            </>
          );
          return (
            <Pressable
              key={tile.key}
              onPress={() => router.push(tile.route as never)}
              accessibilityRole="button"
              accessibilityLabel={`${tile.name}. ${tile.eyebrow}. ${tile.note}`}
              style={({ pressed }) => [styles.tile, hasPhoto && styles.tileWithPhoto, pressed && styles.pressed]}
              testID={`protocols-tile-${tile.key}`}
            >
              {hasPhoto ? (
                <ImageBackground
                  source={photo}
                  style={styles.tilePhoto}
                  imageStyle={styles.tilePhotoImage}
                  resizeMode="cover"
                  testID={`protocols-tile-photo-${tile.key}`}
                >
                  {/* Darkens the foot of the photograph so the words hold. */}
                  <LinearGradient
                    pointerEvents="none"
                    colors={[withAlpha(af.canvas, 0.05), withAlpha(af.canvas, 0.45), withAlpha(af.canvas, 0.9)]}
                    locations={[0, 0.5, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                  {words}
                </ImageBackground>
              ) : (
                words
              )}
            </Pressable>
          );
        })}
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
  // With a photograph the tile is the demo's taller card and the picture fills it.
  tileWithPhoto: { minHeight: 190, padding: 0, overflow: 'hidden' },
  tilePhoto: { flex: 1, minHeight: 190, padding: 18, justifyContent: 'flex-end', gap: 4 },
  tilePhotoImage: { borderRadius: 21 },
  onPhoto: { color: af.textPrimary, opacity: 0.9 },
  pressed: { opacity: 0.72 },
  tileEyebrow: { fontFamily: MONO, fontSize: 11, lineHeight: 14, letterSpacing: 2, color: af.textSecondary },
  tileName: { fontFamily: 'Inter_600SemiBold', fontSize: 28, lineHeight: 32, letterSpacing: -0.56, color: af.textPrimary },
  tileNote: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.textSecondary },
});
