/**
 * ProfileEntryButton — the member photo that opens Profile, ready to drop into
 * any tab header.
 *
 * The five-tab bar has no Profile tab; the navigation rule is "Profile opens
 * from the member photo" (Screen Upgrade v1.1). Home had the only one, so a
 * member on Hydration, Moments or Circle had to go back to Home first. This
 * wraps the presentation-only AFMemberPhotoButton with the signed-in member's
 * photo and the route, so every tab header uses the same control.
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useUser } from '@clerk/expo';
import { AFMemberPhotoButton, memberInitials } from '@/components/ui/AFMemberPhotoButton';

export const PROFILE_ROUTE = '/(tabs)/profile';

export function ProfileEntryButton({ testID }: { testID?: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const member = useUser().user;
  return (
    <AFMemberPhotoButton
      imageUrl={member?.hasImage ? member.imageUrl : null}
      initials={memberInitials(member?.firstName, member?.lastName)}
      onPress={() => router.push(PROFILE_ROUTE)}
      accessibilityLabel={t('tabs.profile')}
      testID={testID}
    />
  );
}
