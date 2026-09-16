import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(__dirname, '..', 'ProfileScreenV2.tsx'), 'utf8');

describe('Profile SkinIA entry', () => {
  it('is rendered only after the internal TestFlight and server cohort gates grant access', () => {
    expect(source).toContain('const skinIAEnabled = isSkinIAAccessAllowed({');
    expect(source).toContain("internalTestflight: process.env['EXPO_PUBLIC_INTERNAL_TESTFLIGHT'] === 'true'");
    expect(source).toContain('const skinIAEntry = skinIAEnabled ? (');
  });

  it('navigates entitled internal testers to the canonical SkinIA route', () => {
    expect(source).toContain('testID="profile-skinia-entry"');
    expect(source).toContain("router.push('/skinia')");
    expect(source).toContain('Open SkinIA Visual Check');
  });
});
