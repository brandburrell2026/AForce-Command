/**
 * Community Sharing relocation — founder ruling 2026-08-27.
 *
 * The circle privacy-visibility control moved out of the stranded /circles
 * island into one canonical route with two entries and a PRIVATE default.
 * These locks pin the ruling's terms:
 *
 *   1. PRIVATE-BY-DEFAULT — client DEFAULT_PRIVACY and the api-server seed
 *      both say 'private' (the recorded 'circle' default is superseded).
 *   2. One durable authority — the screen drives services/privacyService
 *      (setScope/setField/subscribe/projectSharedStatus); no second store.
 *   3. Two entries, no new tab — Profile → Privacy row and the Circle V3
 *      top-bar action both push /privacy/community-sharing.
 *   4. Truth in the preview — real complianceStreak feeds it; the island
 *      screen's fabricated `streakDays: 9` / `protocolComplete: true` /
 *      hardcoded `trend: 'up'` do NOT relocate.
 *   5. The island is HELD, not retired — /circles and MySharedStatusScreen
 *      still exist until the founder's deletion-eligibility call.
 *   6. Every locale carries the screen's keys.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_PRIVACY } from '../../data/mockCircleData';

const read = (rel: string): string =>
  readFileSync(resolve(__dirname, '..', '..', rel), 'utf8');
const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

const screen = stripComments(read('app/privacy/community-sharing.tsx'));

describe('community sharing — private by default', () => {
  it("client DEFAULT_PRIVACY.scope is 'private'", () => {
    expect(DEFAULT_PRIVACY.scope).toBe('private');
  });

  it("the api-server privacy seed is 'private' too", () => {
    const server = stripComments(
      readFileSync(resolve(__dirname, '..', '..', '..', 'api-server', 'src', 'routes', 'privacy.ts'), 'utf8'),
    );
    expect(server).toMatch(/scope:\s*"private"/);
    expect(server).not.toMatch(/scope:\s*"circle"/);
  });
});

describe('community sharing — one durable authority', () => {
  it('the screen drives privacyService verbatim', () => {
    for (const fn of ['getPrivacy', 'setScope', 'setField', 'projectSharedStatus', 'subscribePrivacy']) {
      expect(screen).toContain(fn);
    }
    expect(screen).toContain("from '@/services/privacyService'");
  });

  it('no second privacy store — the screen persists nothing itself', () => {
    expect(screen).not.toMatch(/AsyncStorage|scopedStorage|putJson|getJson/);
  });
});

describe('community sharing — two entries, no new tab', () => {
  it('Profile → Privacy carries the row', () => {
    const pane = stripComments(read('components/profile/panes/AccountPane.tsx'));
    expect(pane).toContain('testID="profile-community-sharing-row"');
    expect(pane).toContain("router.push('/privacy/community-sharing')");
  });

  it('Circle V3 carries the top-bar action', () => {
    const v3 = stripComments(read('components/community/CircleScreenV3.tsx'));
    expect(v3).toContain("router.push('/privacy/community-sharing')");
  });

  it('the tab manifest gained nothing', () => {
    const layout = stripComments(read('app/(tabs)/_layout.tsx'));
    expect(layout).not.toContain('community-sharing');
  });
});

describe('community sharing — the preview tells the truth', () => {
  it('streak comes from the canonical complianceStreak', () => {
    expect(screen).toContain('complianceStreak');
  });

  it("the island's fabrications did not relocate", () => {
    expect(screen).not.toMatch(/streakDays:\s*9\b/);
    expect(screen).not.toMatch(/protocolComplete:\s*true\b/);
    expect(screen).not.toMatch(/trend:\s*'up'/);
  });

  it('trend derives from the one forecast authority, not copied thresholds', () => {
    expect(screen).toContain('derivePerformanceForecast');
    expect(screen).not.toMatch(/0\.25|decayPerMinute/);
  });
});

describe('community sharing — the preview eyebrow tells the scope truth', () => {
  it('the card label is scope-driven on the new screen (private default reads PRIVATE)', () => {
    expect(screen).toContain('visibilityLabel={t(`communitySharing.visibility_${privacy.scope}`)}');
  });

  it("the shared card's island default is untouched — the new prop is additive", () => {
    const card = stripComments(read('components/SharedStatusCard.tsx'));
    expect(card).toContain("visibilityLabel ?? 'VISIBLE TO YOUR CIRCLE'");
  });
});

describe('community sharing — the island is held, not retired', () => {
  it('/circles and its screens still exist pending the deletion-eligibility call', () => {
    for (const rel of [
      'app/circles.tsx',
      'screens/CirclesScreen.tsx',
      'screens/MySharedStatusScreen.tsx',
      'screens/ManageCircleScreen.tsx',
      'screens/FriendDetailScreen.tsx',
    ]) {
      expect(existsSync(resolve(__dirname, '..', '..', rel)), rel).toBe(true);
    }
  });
});

describe('community sharing — locales', () => {
  it('every locale carries the screen keys', () => {
    for (const loc of ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'hi', 'ar']) {
      const d = JSON.parse(read(`locales/${loc}.json`)) as { communitySharing?: Record<string, string> };
      expect(d.communitySharing?.title, loc).toBeTruthy();
      expect(d.communitySharing?.scope_private, loc).toBeTruthy();
      expect(d.communitySharing?.field_trend, loc).toBeTruthy();
    }
  });
});
