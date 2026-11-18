// @vitest-environment happy-dom
/**
 * The member photo is the only way into Profile: the tab bar has five tabs
 * and Profile is not one of them. From 2026-11-06 until this control was
 * added, Profile and everything under it could not be reached.
 *
 * Three laws: the control is a real, labelled button that calls its handler;
 * it never shows a stock avatar as if it were the member; and Home actually
 * mounts it pointing at Profile.
 */
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../Icon', () => ({
  Icon: ({ name }: { name: string }) => React.createElement('span', { 'data-icon': name }),
}));

import { AFMemberPhotoButton, memberInitials } from '../AFMemberPhotoButton';
import { AFMasthead } from '../AFMasthead';

let host: HTMLElement;
let root: Root;

function mount(node: React.ReactElement) {
  root = createRoot(host);
  flushSync(() => root.render(node));
  mounted = true;
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});

let mounted = false;

afterEach(() => {
  if (mounted) flushSync(() => root.unmount());
  mounted = false;
  host.remove();
});

describe('memberInitials', () => {
  it('takes one letter from each name, uppercased', () => {
    expect(memberInitials('brandon', 'burrell')).toBe('BB');
    expect(memberInitials('Julius', null)).toBe('J');
    expect(memberInitials(undefined, 'Ng')).toBe('N');
  });

  it('is empty when no name is known, and ignores blank names', () => {
    expect(memberInitials(null, null)).toBe('');
    expect(memberInitials('   ', '')).toBe('');
  });
});

describe('AFMemberPhotoButton', () => {
  it('is a labelled button that calls its handler', () => {
    const onPress = vi.fn();
    mount(<AFMemberPhotoButton initials="BB" onPress={onPress} accessibilityLabel="Profile" testID="entry" />);
    const button = host.querySelector('[role="button"]') as HTMLElement | null;
    expect(button).not.toBeNull();
    expect(button!.getAttribute('aria-label')).toBe('Profile');
    button!.click();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows the photo when the member has one', () => {
    mount(<AFMemberPhotoButton imageUrl="https://example.test/me.jpg" initials="BB" onPress={() => {}} accessibilityLabel="Profile" />);
    // The web renderer loads the image asynchronously, so assert what is NOT
    // shown in its place: neither the initials nor the person glyph.
    expect(host.textContent).not.toContain('BB');
    expect(host.querySelector('[data-icon="user"]')).toBeNull();
  });

  it('shows initials when there is no photo, never a stock image', () => {
    mount(<AFMemberPhotoButton imageUrl={null} initials="BB" onPress={() => {}} accessibilityLabel="Profile" />);
    expect(host.textContent).toContain('BB');
    expect(host.querySelector('img')).toBeNull();
  });

  it('shows a person glyph when neither a photo nor a name is known', () => {
    mount(<AFMemberPhotoButton initials="" onPress={() => {}} accessibilityLabel="Profile" />);
    expect(host.querySelector('[data-icon="user"]')).not.toBeNull();
  });
});

describe('AFMasthead accessory slot', () => {
  it('renders the accessory on the wordmark row, with or without meta', () => {
    mount(<AFMasthead breadcrumb="Home" accessory={<span data-testid="slot">x</span>} />);
    expect(host.querySelector('[data-testid="slot"]')).not.toBeNull();
    flushSync(() => root.unmount());
    mounted = false;
    mount(<AFMasthead breadcrumb="Home" meta="Wed · Nov 18" accessory={<span data-testid="slot">x</span>} />);
    expect(host.querySelector('[data-testid="slot"]')).not.toBeNull();
    expect(host.textContent).toContain('WED · NOV 18');
  });

  it('renders nothing extra when no accessory is given', () => {
    mount(<AFMasthead breadcrumb="Home" />);
    expect(host.querySelector('[role="button"]')).toBeNull();
  });
});

describe('Home mounts the Profile entry', () => {
  const root2 = path.resolve(__dirname, '..', '..', '..');
  const home = fs.readFileSync(path.join(root2, 'components/editorial/home/EditorialHomeScreen.tsx'), 'utf8');
  const layout = fs.readFileSync(path.join(root2, 'app/(tabs)/_layout.tsx'), 'utf8');

  it('the masthead carries the member photo, and it opens Profile', () => {
    expect(home).toContain('<AFMemberPhotoButton');
    expect(home).toContain("router.push('/(tabs)/profile')");
    expect(home).toContain('testID="home-profile-entry"');
    expect(home).toContain("accessibilityLabel={t('tabs.profile')}");
  });

  it('only the member\'s own photo is used, not the provider default avatar', () => {
    expect(home).toContain('clerkUser?.hasImage ? clerkUser.imageUrl : null');
  });

  it('this entry is needed: Profile is a route but not a tab', () => {
    expect(fs.existsSync(path.join(root2, 'app/(tabs)/profile.tsx'))).toBe(true);
    expect(layout).toMatch(/name="profile"\s*\n\s*options=\{\{\s*\n\s*href: null/);
  });
});
