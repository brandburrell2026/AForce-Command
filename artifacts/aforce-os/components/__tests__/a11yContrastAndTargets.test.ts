/**
 * Contrast + touch-target locks for the Phase-1 surfaces (Wave-5 Parts 20/21).
 *
 * Source-scan rather than render: these are static style/prop facts, and a
 * scan holds for every state of the screen rather than the one a harness
 * happens to mount. The contrast case in particular is a VALUE choice
 * (`af.red` vs `af.redText`) that no render assertion would catch, because
 * both render "some red text".
 *
 * Accessibility is a beta gate, so these fail CI rather than living in a doc.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PKG = resolve(__dirname, '..', '..');
const read = (rel: string): string => readFileSync(resolve(PKG, rel), 'utf8');

const manageSub = read('components/subscription/ManageSubscriptionScreenV2.tsx');
const subscription = read('components/subscription/SubscriptionScreenV2.tsx');
const circle = read('components/community/CircleScreenV3.tsx');
const tokens = read('theme/afTokens.ts');

describe('contrast — Signal Red is never TEXT on a dark surface', () => {
  it('the token file still documents the failure and still provides redText', () => {
    // If this ever stops being true the rule below is arguing with nothing.
    expect(tokens).toMatch(/fails WCAG AA/i);
    expect(tokens).toMatch(/redText:\s*'#E4564A'/);
  });

  it('subscription status TEXT uses the AA token, not the brand fill red', () => {
    // A canceled or past-due subscription is the status a member most needs
    // to be able to read; it was rendering at ~3.1:1 in 9px type.
    expect(manageSub).toContain('const statusTextColor =');
    expect(manageSub).toMatch(/statusTextColor\s*=\s*statusColor === af\.red \? af\.redText/);
    expect(manageSub).toContain('color: statusTextColor');
    expect(manageSub).not.toMatch(/styles\.statusText,\s*\{\s*color: statusColor\s*\}/);
  });

  it('the pill fill, border and dot still use brand red (fills are exempt)', () => {
    // The token guidance is explicit: fills/borders/dots keep `red`; only
    // text and icons move to redText. Over-applying redText would drift the
    // brand mark.
    expect(manageSub).toContain('backgroundColor: statusColor');
    expect(manageSub).toMatch(/borderColor: `\$\{statusColor\}/);
  });
});

describe('touch targets + tab semantics', () => {
  it('Circle scope tabs are tabs inside a tablist, per the repo idiom', () => {
    // AFSegmentedControl is the house pattern: role="tab" within role="tablist".
    expect(circle).toContain('accessibilityRole="tablist"');
    expect(circle).toContain('accessibilityRole="tab"');
    expect(circle).not.toMatch(/accessibilityRole="button"\n\s*accessibilityState=\{\{ selected: tab === key \}\}/);
  });

  it('Circle scope tabs carry hitSlop to reach the 44pt minimum', () => {
    // 9pt padding + an 18pt caption line is ~36pt of real estate.
    const tabBlock = circle.slice(circle.indexOf('circle-v3-tabs'), circle.indexOf('circle-v3-tab-') + 400);
    expect(tabBlock).toContain('hitSlop');
  });

  it('subscription category filters are a tablist and carry hitSlop', () => {
    expect(subscription).toMatch(/styles\.filterRow\} accessibilityRole="tablist"/);
    const filterBlock = subscription.slice(
      subscription.indexOf('availableFilters.map'),
      subscription.indexOf('filterTextActive'),
    );
    expect(filterBlock).toContain('hitSlop');
    expect(filterBlock).toContain('accessibilityRole="tab"');
  });
});
