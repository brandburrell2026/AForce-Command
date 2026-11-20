/**
 * V3 — primary button (Master Brief §2, Screen Upgrade v1.1).
 *
 * The primary action is a warm-white fill with black text. Signal Red is
 * reserved for the N–И mark, the One Breath orb, Lock In and real urgency.
 *
 * This is a ratchet: every solid red background fill left in the app is named
 * below with the reason it stays. A new red fill — or a reviewed button going
 * back to red — fails here and has to be added on purpose.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { af } from '@/theme/afTokens';

const ROOT = join(__dirname, '..', '..');

const RED_FILL =
  /backgroundColor:\s*(af\.red|T\.red|Colors\.accent\.primary|edAccent\.red)\b/g;

/** file → { count, why }. Count is the number of red fills allowed in the file. */
const ALLOWED: Record<string, { count: number; why: string }> = {
  // The orb and Lock In
  'app/(tabs)/_layout.tsx': { count: 1, why: 'One Breath orb' },
  'components/oneBreath/OneBreathScreen.tsx': { count: 5, why: 'orb, hold-to-seal fill, progress line, completion mark and rule' },
  'components/oneBreath/MomentPreparationScreen.tsx': { count: 1, why: 'safety line' },
  // Thin rules, progress fills and dots — not buttons
  'components/home/HomeBaselineHero.tsx': { count: 1, why: '2pt rule' },
  'components/auth/PromiseScreen.tsx': { count: 1, why: '2pt divider of the N–И brand mark' },
  'components/hydration/cinematic/HydrationHistory.tsx': { count: 1, why: '5pt Moment mark above a History bar (prototype)' },
  'components/home/NotificationBanner.tsx': { count: 1, why: '6pt unread dot' },
  'components/editorial/moments/EditorialMomentsScreen.tsx': { count: 1, why: 'live rule' },
  'components/editorial/instruments.tsx': { count: 1, why: 'timeline node' },
  'components/editorial/home/EditorialHomeScreen.tsx': { count: 2, why: 'readiness fill and focus rail' },
  'components/editorial/protocol/EdCanonicalClock.tsx': { count: 1, why: 'clock fill' },
  'components/protocol/ProtocolScreenV2.tsx': { count: 2, why: 'progress fills' },
  'components/community/CircleMembersPanel.tsx': { count: 1, why: 'pending dot' },
  'components/skinIntelligence/SkinIntelligenceEditorialSuite.tsx': { count: 1, why: '3pt rule' },
  'components/recoveryCoach/RecoveryCoachScreen.tsx': { count: 4, why: 'live dot, pulse core, timer hairline, track fill' },
  'components/onboarding/OnboardingScreenV2.tsx': { count: 1, why: 'step dot' },
  'components/concierge/conciergeKit.tsx': { count: 1, why: 'concierge avatar' },
  // Selected states — not primary buttons. Reviewed with the segmented-control
  // step (gap report V9), not here.
  'components/ui/AFSegmentedControl.tsx': { count: 1, why: 'selected pill (V9)' },
  'components/journal/JournalRangePicker.tsx': { count: 1, why: 'selected range (V9)' },
  'components/moments/MomentPrepPrefsCard.tsx': { count: 1, why: 'selected pill (V9)' },
  'components/moments/AddMomentSheet.tsx': { count: 1, why: 'selected pill (V9)' },
  'components/moments/PrepareMyDayScreen.tsx': { count: 1, why: 'selected day (V9)' },
  'components/community/CircleScreenV3.tsx': { count: 2, why: 'selected tab pill (V9), challenge fill' },
  'components/share/SharePreviewScreenV2.tsx': { count: 3, why: 'selected voice, format and radio (V9)' },
  'components/community/CompetitionScreenV2.tsx': { count: 1, why: 'selected section (V9)' },
  'components/oneBreath/ConfirmMomentScreen.tsx': { count: 1, why: 'selected option (V9)' },
};

const SKIP_DIRS = new Set(['node_modules', '__tests__', '.expo', 'dist', 'ios', 'android']);
// Developer-only galleries, not member screens.
const SKIP_FILES = new Set(['app/ui-gallery.tsx', 'app/(hidden)/motion-demo.tsx']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

function redFills(): Record<string, number> {
  const found: Record<string, number> = {};
  for (const top of ['app', 'components']) {
    for (const file of walk(join(ROOT, top))) {
      const rel = relative(ROOT, file);
      if (SKIP_FILES.has(rel)) continue;
      const n = (readFileSync(file, 'utf8').match(RED_FILL) ?? []).length;
      if (n > 0) found[rel] = n;
    }
  }
  return found;
}

describe('V3 primary button — warm white, black text', () => {
  it('defines the primary pair as warm white on black', () => {
    expect(af.primaryFill.toUpperCase()).toBe('#F7F4EF');
    expect(af.onPrimaryFill.toUpperCase()).toBe('#090A0A');
  });

  it('AFPrimaryButton uses the primary pair and no red', () => {
    const src = readFileSync(join(ROOT, 'components/ui/AFButton.tsx'), 'utf8');
    const primary = src.slice(src.indexOf('export function AFPrimaryButton'), src.indexOf('export function AFSecondaryButton'));
    expect(primary).toContain('af.onPrimaryFill');
    expect(primary).not.toMatch(/af\.(red|onRed)\b/);
    expect(src).toMatch(/primary:\s*\{\s*backgroundColor:\s*af\.primaryFill\s*\}/);
  });

  it('every remaining red fill is on the reviewed list', () => {
    const found = redFills();
    const unexpected = Object.entries(found)
      .filter(([file, n]) => n > (ALLOWED[file]?.count ?? 0))
      .map(([file, n]) => `${file}: ${n} red fill(s), ${ALLOWED[file]?.count ?? 0} allowed`);
    expect(unexpected).toEqual([]);
  });

  it('the reviewed list has no stale entries', () => {
    const found = redFills();
    const stale = Object.entries(ALLOWED)
      .filter(([file, { count }]) => (found[file] ?? 0) !== count)
      .map(([file, { count }]) => `${file}: list says ${count}, found ${found[file] ?? 0}`);
    expect(stale).toEqual([]);
  });
});
