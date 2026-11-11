/**
 * Circle v1.7 privacy regression locks. The former score/state sharing page
 * is retained only as a compatibility redirect while server grant migration is
 * delivered. The member-facing Circle surface must keep legacy sharing hidden.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string): string =>
  readFileSync(resolve(__dirname, '..', '..', rel), 'utf8');
const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('Circle v1.7 removes legacy score-and-state sharing from member flows', () => {
  it('Profile no longer links to the legacy community-sharing settings page', () => {
    const pane = stripComments(read('components/profile/panes/AccountPane.tsx'));
    expect(pane).not.toContain('profile-community-sharing-row');
    expect(pane).not.toContain("router.push('/privacy/community-sharing')");
  });

  it('legacy deep links safely land on the Circle v1.7 surface', () => {
    const route = stripComments(read('app/privacy/community-sharing.tsx'));
    expect(route).toContain("import { Redirect } from 'expo-router'");
    expect(route).toContain('<Redirect href="/competition" />');
    expect(route).not.toContain('privacyService');
  });

  it('the current Circle keeps old sharing controls out of its member UI', () => {
    const circle = stripComments(read('components/community/CircleScreenV4.tsx'));
    expect(circle).toContain('showLegacySharing={false}');
    expect(circle).toContain('Nothing is shared by default.');
    expect(circle).toContain('Scores, HydroState, ranks, streaks, and health data never appear in a Circle.');
  });
});
