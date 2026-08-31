/**
 * Moments hardening — regression lock (founder Lane B, 2026-08-30).
 *
 * Three findings surfaced by the E3 review, fixed here and nowhere else. No
 * visual redesign, no Editorial OS expansion, no §10 reconciliation.
 *
 *  1. MASKED TITLE LEAK. The overview's priority card masked the VISIBLE
 *     title but interpolated the RAW `moment.title` into the AFCard's
 *     `accessibilityLabel` seven lines above. `AFCard` with `onPress`
 *     renders a Pressable, which is an accessibility element, so that label
 *     REPLACES its children for a screen reader — the masked Text below is
 *     never spoken and the private title is. Latent in production only
 *     because `calendarMoments` masks a real event's title to `''`; a
 *     demo/fixture moment carries a real one.
 *
 *  2. UNGUARDED BACK ON A DEEP-LINKABLE ROUTE. `/moments` is deep-linkable
 *     AND is the redirect target of `app/moment/[id].tsx` for an unknown id,
 *     so its history can be empty — where a bare `router.back()` is inert.
 *     The repo's own idiom (WeeklyReportV3, ReadinessInsightsV2, both
 *     wiring-pinned) is the guarded ternary.
 *
 *  3. UNGUARDED RECOMMENDATION IN THE GALLERY. The legacy `momentDetail`
 *     stage built a recommendation with a raw `buildRecommendation`, so the
 *     one surface reviewers use to judge Moment Detail showed copy the
 *     Decision Guard had never seen — while production
 *     (`useMomentsData.recFor`) and the editorial stage both guard.
 *
 * The assertion is deliberately scoped to the gallery: `momentNotifications`
 * also calls `buildRecommendation` directly and is guarded a DIFFERENT,
 * correct way (`evaluateMomentAction` per candidate + `evaluateDeliverableCopy`
 * at the sync seam, locked by decisionGuardSeam.lock.test.ts). A repo-wide
 * "every buildRecommendation is wrapped" scan would break CI on a correct file.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const AOS = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

const OVERVIEW = () => strip(read(join(AOS, 'components', 'moments', 'MomentsScreen.tsx')));
const GALLERY = () => strip(read(join(AOS, 'demo', 'AForceScreenGallery.tsx')));

describe('1 — a masked moment never leaks its real title', () => {
  it('the raw title is read exactly ONCE on this screen — inside the mask itself', () => {
    // Counting is the robust form here: a regex over the label expression
    // has to span a template literal with nested `${}`, and a version of
    // this assertion that tried it silently passed against the leak. Every
    // read of the unmasked field must be the mask's own else-branch.
    const src = OVERVIEW();
    const reads = [...src.matchAll(/\bmoment\.title\b/g)];
    expect(reads.length, 'moment.title is read more than once — one of them is unmasked').toBe(1);
    const only = reads[0]!;
    const before = src.slice(Math.max(0, only.index! - 80), only.index!);
    expect(before, 'the single read is not the mask else-branch').toMatch(/moment\.masked\s*\?/);
  });

  it('the priority card resolves ONE masked title and uses it for both the label and the text', () => {
    const src = OVERVIEW();
    // A single hoisted resolution is what makes the two uses impossible to
    // diverge again — the exact shape the other six masking sites use.
    expect(src).toMatch(
      /const\s+title\s*=\s*moment\.masked\s*\?\s*t\('moments\.private_event'\)\s*:\s*moment\.title;/,
    );
  });

  it('every masking decision on this screen still goes through the private-event key', () => {
    expect(OVERVIEW()).toMatch(/moments\.private_event/);
  });
});

describe('2 — the deep-linkable overview has valid back behaviour', () => {
  const GUARDED_BACK =
    /onBack=\{\(\)\s*=>\s*\(router\.canGoBack\(\)\s*\?\s*router\.back\(\)\s*:\s*router\.replace\('\/'\)\)\}/;

  it('uses the repo\'s guarded idiom, byte-shaped like WeeklyReportV3 / ReadinessInsightsV2', () => {
    expect(OVERVIEW()).toMatch(GUARDED_BACK);
  });

  it('no bare router.back() remains on the screen', () => {
    const src = OVERVIEW();
    const bare = [...src.matchAll(/router\.back\(\)/g)];
    // Every occurrence must sit inside the guarded ternary.
    for (const m of bare) {
      const window = src.slice(Math.max(0, m.index! - 60), m.index! + 20);
      expect(window, 'an unguarded router.back() survives').toMatch(/canGoBack\(\)/);
    }
  });
});

describe('3 — the gallery cannot show unguarded recommendation copy', () => {
  it('every buildRecommendation in the gallery is wrapped by guardMomentRecommendation', () => {
    const src = GALLERY();
    const calls = [...src.matchAll(/buildRecommendation\(/g)];
    expect(calls.length, 'expected the gallery to build recommendations').toBeGreaterThan(0);
    for (const m of calls) {
      const before = src.slice(Math.max(0, m.index! - 120), m.index!);
      expect(before, 'a gallery buildRecommendation escapes the guard').toMatch(
        /guardMomentRecommendation\(/,
      );
    }
  });

  it('the production seam is untouched — recFor still guards exactly once', () => {
    const hook = strip(read(join(AOS, 'components', 'moments', 'useMomentsData.ts')));
    expect(hook).toMatch(/guardMomentRecommendation\(buildRecommendation\(/);
  });

  it('the notification lane keeps its own (different, correct) guard', () => {
    // Scope proof: this file calls buildRecommendation directly by design
    // (window math only — RP-3 made notifications CONTEXT-ONLY, so the old
    // per-candidate evaluateMomentAction step had nothing left to judge;
    // the rendered-copy guards at the sync seam are the lane's protection).
    const notif = strip(read(join(AOS, 'services', 'momentNotifications.ts')));
    expect(notif).toMatch(/buildRecommendation\(/);
    expect(notif).toMatch(/evaluateDeliverableLabel\(/);
    expect(notif).toMatch(/evaluateDeliverableCopy\(/);
  });
});

describe('SCOPE — Lane B changed nothing else', () => {
  it('no visual redesign: the overview keeps its shipped composition', () => {
    const src = OVERVIEW();
    for (const kept of ['AFTopBar', 'AFCard', 'AFEmptyState', 'AFSectionLabel', 'MomentsOverviewSkeleton']) {
      expect(src, `${kept} was removed — that is a redesign, not hardening`).toContain(kept);
    }
  });

  it('no Editorial OS expansion: the legacy screen imports none of it', () => {
    expect(OVERVIEW()).not.toMatch(/components\/editorial|editorialTokens/);
  });

  it('no §10 reconciliation: the dose still renders exactly as production builds it', () => {
    expect(OVERVIEW()).toMatch(/rec\.primaryAction\.labelKey/);
  });
});
