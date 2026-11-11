/**
 * Social Mode indicator — law lock (2026-10-06).
 *
 *  - mounted on all three Home surfaces (editorial, V2 fallback, internal SkinIA);
 *  - renders only when a session row is open, distinguishes live vs stale via the
 *    engine's own liveness rule, and ends through the store's deactivate action;
 *  - no flag (an open session is a fact, not a feature); af tokens only;
 *  - copy keys exist and pass the §42 scan.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { consumerCopyBlocked } from '../../utils/intelligence/languageGate/runtimeClaimScan';

const AOS = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(AOS, p), 'utf8');

describe('mounting', () => {
  it('all three Home surfaces mount the indicator', () => {
    expect(read('components/editorial/home/EditorialHomeScreen.tsx')).toContain('<SocialModeIndicator testID="editorial-social-indicator" />');
    expect(read('components/home/HomeScreenV2.tsx')).toContain('<SocialModeIndicator testID="home-social-indicator" />');
    expect(read('components/skinIntelligence/SkinIntelligenceEditorialSuite.tsx')).toContain('<SocialModeIndicator testID="skinia-social-indicator" />');
  });
});

describe('behaviour pinned on source', () => {
  const src = read('components/social/SocialModeIndicator.tsx');
  it('renders nothing without an open session row and uses the engine liveness rule', () => {
    expect(src).toMatch(/if \(!sm \|\| !sm\.active\) return null;/);
    expect(src).toMatch(/isSocialSessionLive\(sm, nowMs\)/);
  });
  it('ends the night through the store action (the deactivate route), never by writing state itself', () => {
    expect(src).toMatch(/deactivateSocialMode\(\)/);
    expect(src).not.toMatch(/fetch\(|updateUserState|socialMode\s*=/);
  });
  it('is not behind a feature flag and uses af tokens only', () => {
    expect(src).not.toMatch(/useFeatureFlags|flags\./);
    expect(src).not.toMatch(/editorialTokens|#[0-9a-fA-F]{3,8}\b/);
  });
});

describe('copy', () => {
  const en = JSON.parse(read('locales/en.json')) as { social: Record<string, string> };
  it('keys exist and pass the §42 scan', () => {
    for (const k of ['indicator_on', 'indicator_stale', 'end_night']) {
      expect(typeof en.social[k]).toBe('string');
      expect(consumerCopyBlocked(en.social[k]!), k).toBe(false);
    }
  });
});
