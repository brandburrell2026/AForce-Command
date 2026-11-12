import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = readFileSync(join(__dirname, '..', 'ProfileScreenV2.tsx'), 'utf8');

describe('Profile trademark footer (spec v1.8.2 Part 8.6, decision C5)', () => {
  it('carries the exact approved line', () => {
    expect(SRC).toContain(
      "'AFORCE OS™ · Beta preview · AFORCE, AFORCE OS and the N–И mark are trademarks of AFORCE Hydration, Inc.'",
    );
  });
  it('renders it once, after every Profile section, inside the scroll view', () => {
    expect(SRC.match(/\{PROFILE_TRADEMARK_LINE\}/g)).toHaveLength(1);
    const footer = SRC.indexOf('{PROFILE_TRADEMARK_LINE}');
    expect(footer).toBeGreaterThan(SRC.lastIndexOf('activeSections.map'));
    expect(footer).toBeLessThan(SRC.indexOf('</ScrollView>'));
  });
  it('uses ™, never ®, and marks AFORCE OS only in the footer line', () => {
    expect(SRC).not.toContain('®');
    expect(SRC.split('AFORCE OS™').length - 1).toBe(1);
  });
});
