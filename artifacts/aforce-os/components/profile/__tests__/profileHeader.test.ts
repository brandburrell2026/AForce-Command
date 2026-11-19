/** Profile header and pills, laid out as the approved prototype. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import en from '@/locales/en.json';

const header = readFileSync(join(__dirname, '..', 'ProfileHeader.tsx'), 'utf8');
const kit = readFileSync(join(__dirname, '..', 'profileKit.tsx'), 'utf8');
const screen = readFileSync(join(__dirname, '..', 'ProfileScreenV2.tsx'), 'utf8');

// Restated so it runs without loading React Native.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function memberLine(place: string | null, joinedAt: Date | null): string {
  const where = (place ?? '').trim();
  const since = joinedAt && !Number.isNaN(joinedAt.getTime()) ? `${MONTHS[joinedAt.getMonth()]} ${joinedAt.getFullYear()}` : '';
  if (where && since) return `${where} · member since ${since}`;
  if (since) return `Member since ${since}`;
  return where;
}

describe('Profile header', () => {
  it('writes where and since when, and never invents either', () => {
    expect(memberLine('New York', new Date(2026, 10, 3))).toBe('New York · member since Nov 2026');
    expect(memberLine('', new Date(2026, 10, 3))).toBe('Member since Nov 2026');
    expect(memberLine('New York', null)).toBe('New York');
    expect(memberLine(null, null)).toBe('');
    expect(header).toContain('return `${where} · member since ${since}`;');
  });

  it('has the prototype parts: Back, "Profile", an 84pt ringed photo, the name at 34pt', () => {
    expect(header).toContain('>PROFILE</Text>');
    expect(header).toContain('PROFILE_PHOTO_SIZE = 84');
    expect(header).toContain('borderColor: af.textPrimary');
    expect(header).toContain('fontSize: 34');
  });

  it("shows the member's own photo or their initials, never a stand-in", () => {
    expect(header).toContain('p.photoUri.length > 0 && !failed');
    expect(header).toContain('{p.initials}');
  });

  it('uses no red', () => {
    expect(header).not.toMatch(/af\.red(Text)?\b/);
  });
});

describe('Profile pills', () => {
  it('are equal-width, and the selected one is warm white with black text', () => {
    expect(kit).toMatch(/tabPill: \{\s*minHeight: 44,\s*flex: 1,/);
    expect(kit).toMatch(/tabPillActive: \{ backgroundColor: af\.primaryFill, borderColor: af\.primaryFill \}/);
    expect(kit).toMatch(/tabPillLabelActive: \{[\s\S]{0,200}?color: af\.onPrimaryFill,/);
  });

  it('are labelled in sentence case', () => {
    const v2 = (en as { profile: { v2: Record<string, string> } }).profile.v2;
    expect([v2['tab_performance'], v2['tab_devices'], v2['tab_account']]).toEqual(['Performance', 'Devices', 'Account']);
  });
});

describe('Profile screen', () => {
  it('no rank, streak or aura chips', () => {
    expect(screen).not.toMatch(/<IdentityChip/);
  });
  it('every feature that sat above the pills is still reachable, from Account', () => {
    expect(screen).toContain('const accountBlocks: Record<string, React.ReactNode> = { identityBlock, gentleEntry, skinIAEntry };');
    expect(screen).toContain('...ACCOUNT_VIEW_BLOCKS[accountView].map((name) => accountBlocks[name])');
  });
});
