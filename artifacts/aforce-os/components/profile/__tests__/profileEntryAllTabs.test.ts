/**
 * V6 — Profile opens from the member photo on every tab header that has one
 * (Screen Upgrade v1.1). Home had the only entry; Hydration, Moments and
 * Circle now carry the same control.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('V6 Profile entry on every tab header', () => {
  it('the shared button opens the Profile route with the member photo and a label', () => {
    const src = read('components/profile/ProfileEntryButton.tsx');
    expect(src).toContain("PROFILE_ROUTE = '/(tabs)/profile'");
    expect(src).toContain('router.push(PROFILE_ROUTE)');
    expect(src).toContain("accessibilityLabel={t('tabs.profile')}");
    // Only the member's own photo, never a stand-in.
    expect(src).toContain('member?.hasImage ? member.imageUrl : null');
  });

  it.each([
    ['Home', 'components/editorial/home/EditorialHomeScreen.tsx', 'home-profile-entry'],
    ['Hydration', 'components/hydration/HydrationScreenV2.tsx', 'hydration-profile-entry'],
    ['Moments', 'components/editorial/moments/EditorialMomentsScreen.tsx', 'moments-profile-entry'],
    ['Circle', 'components/community/CircleScreenV4.tsx', 'circle-profile-entry'],
  ])('%s carries a Profile entry', (_tab, file, testID) => {
    expect(read(file)).toContain(`testID="${testID}"`);
  });

  it('Moments shows it only as a tab root, not when pushed with a back control', () => {
    expect(read('components/editorial/moments/EditorialMomentsScreen.tsx')).toMatch(
      /accessory=\{tabRoot \? <ProfileEntryButton[^}]*\/> : undefined\}/,
    );
  });

  it('the Profile tab route still exists', () => {
    expect(read('app/(tabs)/profile.tsx').length).toBeGreaterThan(0);
  });
});
