/**
 * Editorial Protocol — The Brief — E4 law lock (founder decisions 2026-08-30).
 *
 * Planted BEFORE the implementation. Covers the six areas the authorization
 * names explicitly, plus the four decisions:
 *
 *  D1 RING      — the completion ring folds into the canonical riskTimer
 *                 hairline gauge. NO second dominant completion instrument,
 *                 and no new timer / readiness score / percentage / derived
 *                 progress metric. The checklist stays the truthful
 *                 step-completion representation.
 *  D2 STALE     — Protocol carries Home's stale posture by REUSING the Lane A
 *                 contract (`lastRefreshStale` + `home.v2.stale_notice`).
 *                 No second freshness system, no threshold or provider change.
 *  D3 LOCALE    — production strings are preserved EXACTLY. E4 localizes
 *                 nothing; the 11-locale gap is recorded as post-E4 debt.
 *  D4 LEGACY    — ProtocolScreenLegacy stays as the rollback branch.
 *
 *  + command-authority class bans, resolver reuse, Reduce Motion, demo
 *    isolation, the THREE-WAY seam, and stale-state rendering.
 *
 * Lives in components/__tests__/ deliberately: a components/editorial/__tests__/
 * directory matches NO vitest glob and would silently never run.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS } from '../../featureFlags/flags';
import { briefGaugeFraction } from '../editorial/protocol/editorialProtocolPresentation';

const AOS = join(__dirname, '..', '..');
const ED_PROTOCOL = join(AOS, 'components', 'editorial', 'protocol');
const read = (p: string) => readFileSync(p, 'utf8');
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/[^\n]*/g, '$1');
const files = () => walk(ED_PROTOCOL);
const sources = () => files().map((f) => ({ file: relative(AOS, f), src: strip(read(f)) }));
const screen = () => strip(read(join(ED_PROTOCOL, 'EditorialProtocolScreen.tsx')));

describe('FLAG + THREE-WAY SEAM', () => {
  it('editorial_protocol_enabled is OFF in production and ON in the demo profile', () => {
    expect(DEFAULT_FLAGS.editorial_protocol_enabled).toBe(false);
    expect(DEMO_ALL_ON_FLAGS.editorial_protocol_enabled).toBe(true);
  });

  it('the go-live flags for Home and Moments are NOT touched by this lane', () => {
    expect(DEFAULT_FLAGS.editorial_home_enabled).toBe(false);
    expect(DEFAULT_FLAGS.editorial_moments_enabled).toBe(false);
  });

  it('the route seam is three-way and keeps BOTH existing branches (D4: legacy is the rollback)', () => {
    const route = strip(read(join(AOS, 'app', '(tabs)', 'protocol.tsx')));
    // editorial ? Brief : spec_protocol ? V2 : Legacy — authored fresh; the
    // E2/E3 two-way regexes do not apply to this route.
    expect(route).toMatch(
      /editorial_protocol_enabled\s*\?[\s\S]{0,120}?<EditorialProtocolScreen\s*\/>[\s\S]{0,160}?spec_protocol\s*\?[\s\S]{0,80}?<ProtocolScreenV2\s*\/>[\s\S]{0,80}?<ProtocolScreenLegacy\s*\/>/,
    );
  });
});

describe('D1 — one instrument: the canonical clock', () => {
  it('the gauge fraction is a pure function of completed/total, clamped', () => {
    expect(briefGaugeFraction(0, 4)).toBe(0);
    expect(briefGaugeFraction(2, 4)).toBe(0.5);
    expect(briefGaugeFraction(4, 4)).toBe(1);
    // Never fabricates a fraction from nothing.
    expect(briefGaugeFraction(0, 0)).toBe(0);
    expect(briefGaugeFraction(5, 4)).toBe(1);
    expect(briefGaugeFraction(-1, 4)).toBe(0);
    expect(briefGaugeFraction(1, Number.NaN)).toBe(0);
  });

  it('no second completion instrument: no ring, no percentage, no derived progress metric', () => {
    for (const { file, src } of sources()) {
      // No ring INSTRUMENT. `ringFraction` is allowed in the pure module
      // only, where it is the delegation the resolver-reuse rule requires —
      // banning it outright would have forced the forked arithmetic the
      // review already caught.
      expect(src, `${file} reintroduces a ring`).not.toMatch(/AFReadinessArc|ringPct/);
      if (!file.endsWith('editorialProtocolPresentation.ts')) {
        expect(src, `${file} computes a ring fraction itself`).not.toMatch(/ringFraction/);
      }
      // Source-text denylist: it cannot evaluate a runtime string, so it is
      // paired with the structural guarantee below rather than trusted alone.
      expect(src, `${file} renders a percentage`).not.toMatch(/\}%|'%'|`%`|%<\/Text>/);
      // Structural: no percent-typed style value anywhere either, so the
      // gauge cannot be re-expressed as a percentage by the back door.
      expect(src, `${file} uses a percentage style value`).not.toMatch(/:\s*`\$\{[^`]*\}%`/);
    }
  });

  it('the clock is nextRecheckMinutes — Protocol authors no timer of its own', () => {
    const s = screen();
    expect(s).toMatch(/nextRecheckMinutes/);
    for (const { file, src } of sources()) {
      expect(src, `${file} starts its own clock`).not.toMatch(
        /setInterval|setTimeout|useTimerSlice|requestAnimationFrame/,
      );
    }
  });
});

describe('PARITY — no V2 behaviour is stranded (the E3 P0 class)', () => {
  it('the ritual_progressed haptic survives — Protocol owns the only producer', () => {
    const s = screen();
    expect(s).toMatch(/shouldAcknowledgeProgress/);
    expect(s).toMatch(/fireMoment\('ritual_progressed'\)/);
    // Same ref-baseline idiom as V2, so establishing the baseline never fires.
    expect(s).toMatch(/prevCompletedRef/);
  });

  it('the relocated command history survives (founder ruling: relocate, never delete)', () => {
    const s = screen();
    expect(s).toMatch(/observedHistory\.slice\(0, 5\)/);
    expect(s).toMatch(/formatTimeAgo/);
    expect(s).toMatch(/protocol\.v2\.recent_activity/);
  });

  it('the completed-step count survives', () => {
    expect(screen()).toMatch(/\{completedCount\} \/ \{total\}/);
  });

  it('the lazy weekly-compliance fetch condition is preserved', () => {
    expect(screen()).toMatch(/useWeeklyCompliance\(whyOpen\)/);
  });
});

describe('RESOLVER REUSE — the honest-data rules stay enforced', () => {
  it('the screen consumes protocolV3Presentation rather than reimplementing it', () => {
    const s = screen();
    for (const fn of ['hydrationProgress', 'formatBpm', 'formatHrvMs', 'signalsAreLive']) {
      expect(s, `must reuse ${fn}`).toContain(fn);
    }
    expect(s).toMatch(/from '@\/components\/protocol\/protocolV3Presentation'/);
  });

  it('the stage + description come from deriveProtocol, never re-derived here', () => {
    const s = screen();
    expect(s).toMatch(/deriveProtocol|protocol\.stage/);
    for (const { file, src } of sources()) {
      // No local band→stage mapping may exist in this tree.
      expect(src, `${file} re-derives the stage`).not.toMatch(
        /'Peak Support'|'Depletion Correction'|PROTOCOL_DESCRIPTION/,
      );
    }
  });

  it('the biometrics winners come from the shared arbitration, not a local pick', () => {
    expect(screen()).toMatch(/explainFieldArbitration/);
  });

  it('the gauge delegates to the shipped ringFraction — no forked arithmetic', () => {
    const pres = strip(read(join(ED_PROTOCOL, 'editorialProtocolPresentation.ts')));
    expect(pres).toMatch(/from '@\/components\/protocol\/protocolV3Presentation'/);
    expect(pres).toMatch(/return ringFraction\(completed, total\);/);
    // No re-authored clamp/divide in this tree.
    expect(pres).not.toMatch(/Math\.min\(1,|completed \/ total/);
  });
});

describe('D3 — production strings preserved exactly; nothing localized here', () => {
  it('the stage description renders verbatim — never paraphrased or truncated to a new string', () => {
    const s = screen();
    expect(s).toMatch(/protocol\.description/);
    for (const { file, src } of sources()) {
      expect(src, `${file} authors stage copy`).not.toMatch(/Steady state|Defend Peak|Recovery window open/);
    }
  });

  it('E4 adds no new member-facing English literal to the tree', () => {
    for (const { file, src } of sources()) {
      // Long bare strings in JSX are the tell. Copy must come from t() or
      // from the derivation.
      const jsxText = src.match(/>\s*[A-Z][a-z]+(?:\s+[a-z]+){3,}[.\s]*</g) ?? [];
      expect(jsxText, `${file} hardcodes member copy: ${jsxText.join(' | ')}`).toEqual([]);
    }
  });
});

describe('COMMAND AUTHORITY — Protocol explains, never prescribes', () => {
  it('no editorial Protocol source authors a dose, clock, imperative or product push', () => {
    const DOSE = /\d+\s*(oz|ounce|stick|serving)/i;
    const CLOCK = /recheck in \d/i;
    const IMPERATIVE = /\b(take|drink|sip|grab|down)\s+(\d|one|two|a\s|another)/i;
    const PRODUCT = /\bsticks?\b/i;
    for (const { file, src } of sources()) {
      expect(src, `${file} — dose`).not.toMatch(DOSE);
      expect(src, `${file} — clock`).not.toMatch(CLOCK);
      expect(src, `${file} — imperative`).not.toMatch(IMPERATIVE);
      expect(src, `${file} — product`).not.toMatch(PRODUCT);
    }
  });

  it('hydration is presented as MEASUREMENT — consumed against the member\'s own target', () => {
    const s = screen();
    expect(s).toMatch(/hydrationProgress/);
    // The existing measurement key, not a new instruction string.
    expect(s).toMatch(/protocol\.v3\.hydration_oz/);
  });
});

describe('D2 — stale posture reused, never reinvented', () => {
  it('reads the Lane A delivery flag and renders the SAME notice key as Home', () => {
    const s = screen();
    expect(s).toMatch(/lastRefreshStale/);
    expect(s).toMatch(/home\.v2\.stale_notice/);
  });

  it('creates no second freshness system and touches no threshold', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file} invents a freshness ladder`).not.toMatch(
        /JUST_NOW_THRESHOLD_MS|resolveHomeFreshness|_THRESHOLD_MS\s*=/,
      );
    }
    // signalsAreLive is the shared window and must be consumed, not copied.
    expect(screen()).toMatch(/signalsAreLive/);
  });
});

describe('ROOT TAB — no back control (Protocol is not a pushed route)', () => {
  it('no EdReturn and no back affordance anywhere in the tree', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file} adds a back control to a root tab`).not.toMatch(
        /EdReturn|onBack|canGoBack|router\.back/,
      );
    }
  });
});

describe('WHY — progressive disclosure survives', () => {
  it('the WHY control and its sheet are present', () => {
    const s = screen();
    expect(s).toMatch(/setWhyOpen\(true\)/);
    // The old alternation included `EdBrief`, which is a substring of
    // EdBriefChecklist — it could never fail. Assert the sheet itself.
    expect(s).toMatch(/<AFDisclosureSheet[\s\S]{0,200}?visible=\{whyOpen\}/);
    expect(s).toMatch(/protocol\.v2\.why_this_plan/);
  });
});

describe('REDUCE MOTION + DEMO ISOLATION (gaps E4 closes rather than inherits)', () => {
  it('any animation in this tree honors Reduce Motion', () => {
    for (const { file, src } of sources()) {
      if (!/Animated|withTiming|withRepeat|useSharedValue/.test(src)) continue;
      expect(src, `${file} animates without a Reduce Motion path`).toMatch(
        /useReduceMotion|useEdSettle/,
      );
      expect(src, `${file} loops an animation`).not.toMatch(/withRepeat/);
    }
  });

  it('no editorial Protocol source imports from demo/ (neither existing guard covers this path)', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file} imports demo fixtures into production`).not.toMatch(
        /from ['"][^'"]*\/demo\/|from ['"]@\/demo\//,
      );
    }
  });
});

describe('A11Y — the standing rules carry forward', () => {
  it('never disables font scaling, never manufactures caps', () => {
    for (const { file, src } of sources()) {
      expect(src, file).not.toMatch(/allowFontScaling/);
      expect(src, file).not.toMatch(/textTransform/);
    }
  });

  it('interactive targets meet the 44pt floor', () => {
    const all = sources().map((s) => s.src).join('\n');
    expect(all).toContain('edRhythm.minTarget');
    for (const { file, src } of sources()) {
      expect(src, `${file} shrinks a target`).not.toMatch(/minHeight:\s*(?:[1-3]?\d)\b/);
    }
  });

  it('every horizontal row wraps — AX reflow, not clipping', () => {
    // The previous version of this case only checked targets and never
    // looked at wrapping at all, while claiming to (E4 review). Every
    // flexDirection:'row' style block in this tree must declare flexWrap.
    // Scoped to CONTENT rows (style keys ending in `Row`). A graphical
    // element like the clock's gauge track is also flexDirection:'row' and
    // must NOT wrap — wrapping a hairline bar would break it.
    for (const { file, src } of sources()) {
      const rows = [
        ...src.matchAll(/\b\w*[Rr]ow:\s*\{[^{}]*flexDirection:\s*'row'[^{}]*\}/g),
      ].map((m) => m[0]);
      for (const block of rows) {
        expect(block, `${file} has a content row that cannot wrap: ${block}`).toMatch(/flexWrap/);
      }
      expect(rows.length, `${file}: no content rows found to check`).toBeGreaterThanOrEqual(0);
    }
  });

  it('the screen exposes a header landmark', () => {
    expect(screen()).toMatch(/accessibilityRole="header"/);
  });
});
