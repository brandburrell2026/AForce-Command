/**
 * ProfileHeader — the top of Profile, laid out as the approved prototype:
 * "Back" and the word "Profile", an 84pt photo with a warm-white ring, the
 * member's name at 34pt, one line for where and since when, and one quiet
 * link under it.
 *
 * Presentation only. It shows the member's own photo when they have one,
 * otherwise their initials — never a stand-in face.
 */
import React from 'react';
import { WorldPhotoHero } from '@/components/world/WorldPhoto';
import { worldPhoto } from '@/components/world/worldPhotoSources';
import { PROFILE_SCENE } from '@/utils/worldPhoto';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { af, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';

export const PROFILE_PHOTO_SIZE = 84;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "New York · member since Nov 2026", "Member since Nov 2026", or the place alone. */
export function profileMemberLine(place: string | null | undefined, joinedAt: Date | null | undefined): string {
  const where = (place ?? '').trim();
  const since =
    joinedAt && !Number.isNaN(joinedAt.getTime()) ? `${MONTHS[joinedAt.getMonth()]} ${joinedAt.getFullYear()}` : '';
  if (where && since) return `${where} · member since ${since}`;
  if (since) return `Member since ${since}`;
  return where;
}

export interface ProfileHeaderProps {
  onBack: () => void;
  backLabel: string;
  backAccessibilityLabel: string;
  /** Identifies the Back control. */
  testID?: string;
  photoUri?: string | null;
  initials: string;
  name: string;
  memberLine: string;
  editLabel: string;
  onEdit: () => void;
}

export function ProfileHeader(p: ProfileHeaderProps) {
  const [failed, setFailed] = React.useState(false);
  const showPhoto = typeof p.photoUri === 'string' && p.photoUri.length > 0 && !failed;
  return (
    <View testID="profile-header">
      <WorldPhotoHero source={worldPhoto(PROFILE_SCENE)} bleed={40} lift={80} height={320} dim testID="profile-photo" />
      <View style={styles.topRow}>
        <Pressable
          onPress={p.onBack}
          accessibilityRole="button"
          accessibilityLabel={p.backAccessibilityLabel}
          hitSlop={8}
          style={styles.back}
          testID={p.testID}
        >
          <Icon name="chevron-left" size={18} color={af.textPrimary} />
          <Text style={styles.backText}>{p.backLabel}</Text>
        </Pressable>
        <Text style={styles.eyebrow}>PROFILE</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.photo} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {showPhoto ? (
            <Image source={{ uri: p.photoUri! }} style={styles.photoImage} onError={() => setFailed(true)} />
          ) : (
            <Text style={styles.initials} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>{p.initials}</Text>
          )}
        </View>
        <View style={styles.text}>
          <Text accessibilityRole="header" style={styles.name} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
            {p.name}
          </Text>
          {p.memberLine ? <Text style={styles.memberLine}>{p.memberLine}</Text> : null}
          <Pressable
            onPress={p.onEdit}
            accessibilityRole="button"
            accessibilityLabel={p.editLabel}
            hitSlop={8}
            style={styles.editHit}
            testID="profile-edit"
          >
            <Text style={styles.edit}>{p.editLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  backText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: af.textPrimary },
  eyebrow: { fontFamily: 'IBMPlexMono_400Regular', fontSize: 11, letterSpacing: 2, color: af.textPrimary, opacity: 0.92 },
  // The prototype leaves a tall quiet space above the photo.
  body: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginTop: 110 },
  photo: {
    width: PROFILE_PHOTO_SIZE,
    height: PROFILE_PHOTO_SIZE,
    borderRadius: PROFILE_PHOTO_SIZE / 2,
    borderWidth: 2,
    borderColor: af.textPrimary,
    backgroundColor: af.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImage: { width: PROFILE_PHOTO_SIZE, height: PROFILE_PHOTO_SIZE },
  initials: { fontFamily: 'Inter_600SemiBold', fontSize: 26, color: af.textPrimary },
  text: { flex: 1 },
  name: { fontFamily: 'Inter_600SemiBold', fontSize: 34, lineHeight: 35, letterSpacing: -0.68, color: af.textPrimary },
  memberLine: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.textPrimary, opacity: 0.92, marginTop: 6 },
  editHit: { minHeight: 28, justifyContent: 'center', alignSelf: 'flex-start' },
  edit: { fontFamily: 'Inter_400Regular', fontSize: 13, color: af.textPrimary, opacity: 0.92, textDecorationLine: 'underline' },
});
