/**
 * AFMemberPhotoButton — the member's photo, top right of Home, opens Profile.
 *
 * The five-tab bar (Home · Hydration · One Breath · Moments · Circles) has no
 * Profile tab; the navigation rule is "Profile opens from the member photo".
 * When the Profile tab was removed (2026-11-06) this control was never added,
 * so Profile and everything under it (devices, Coach Mode, sweat calculator,
 * developer controls) could not be reached at all. This is that control.
 *
 * Presentation-only: the caller supplies the photo, the initials and where it
 * goes. It shows the member's own photo when they have set one, otherwise
 * their initials, otherwise a person glyph. It never shows a stock avatar as
 * if it were the member.
 *
 * Accessibility: a real button with the caller's label; a 36pt ring with
 * hitSlop to a 52pt target, matching the masthead's back control.
 */
import React from 'react';
import { Image, Pressable, StyleSheet, Text } from 'react-native';
import { Icon } from '../Icon';
import { af, afType, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';

export interface AFMemberPhotoButtonProps {
  /** The member's own photo. Pass null when they have not set one. */
  imageUrl?: string | null;
  /** Up to two letters shown when there is no photo. */
  initials?: string;
  onPress: () => void;
  /** Already-translated label, e.g. "Profile". */
  accessibilityLabel: string;
  testID?: string;
}

/** Up to two uppercase initials from a first and last name; '' when neither is known. */
export function memberInitials(firstName?: string | null, lastName?: string | null): string {
  const first = (firstName ?? '').trim();
  const last = (lastName ?? '').trim();
  const letter = (s: string): string => (s ? Array.from(s)[0]!.toUpperCase() : '');
  return `${letter(first)}${letter(last)}`;
}

export function AFMemberPhotoButton({
  imageUrl,
  initials,
  onPress,
  accessibilityLabel,
  testID,
}: AFMemberPhotoButtonProps) {
  const [failed, setFailed] = React.useState(false);
  const showPhoto = typeof imageUrl === 'string' && imageUrl.length > 0 && !failed;
  const letters = (initials ?? '').trim().slice(0, 2);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [styles.ring, pressed && styles.pressed]}
      testID={testID}
    >
      {showPhoto ? (
        <Image
          source={{ uri: imageUrl as string }}
          style={styles.photo}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : letters ? (
        <Text style={styles.initials} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
          {letters}
        </Text>
      ) : (
        <Icon name="user" size={16} color={af.textPrimary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: af.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pressed: { backgroundColor: af.surfacePressed },
  photo: { width: 36, height: 36, borderRadius: 18 },
  initials: { ...afType.micro, color: af.textPrimary, letterSpacing: 0.6 },
});
