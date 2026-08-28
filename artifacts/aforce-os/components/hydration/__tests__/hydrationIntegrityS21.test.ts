/**
 * S2-1 — Hydration intake integrity (Stage-1-severity carryover from the
 * world-class-release Stage-2 audit).
 *
 * The defect: "Log manually" was tap-is-the-commit with a dose scraped from
 * command copy (`parseDoseOz(engine.command.action)`) — a fabricated amount
 * with no picker, no confirmation and no acknowledgement — and because the
 * write was non-silent while this screen mounted no `CycleSuccessOverlay`,
 * the raised `showCycleSuccess` stranded until the member visited Home,
 * where it disabled the primary CTA (`HomeScreenV2` refuses `openWaterPicker`
 * while `showCycleSuccess` is up).
 *
 * Locked here, per the founder's S2-1 requirements:
 *   1. No intake can be created without an explicit member-chosen quantity.
 *   2. Hydration and Home use the same canonical write behavior.
 *   3. A success state cannot strand Home's CTA: every non-silent intake
 *      writer mounts the overlay that renders and dismisses that state.
 *   4. One confirmation creates one durable event (synchronous double-tap
 *      guard, same contract as Home).
 *
 * Source-scanned per the documented house convention for store+router
 * containers (see `hydrationScreenV2OfflineBannerWiring.test.ts` header —
 * these containers are deliberately never mounted directly). The shared
 * pieces have their own behavioral coverage: `WaterAmountModal` /
 * `CycleSuccessOverlay` render tests and the reducer's cycle tests.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PKG = resolve(__dirname, '..', '..', '..');

function read(rel: string): string {
  return readFileSync(resolve(PKG, rel), 'utf8');
}
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');
}

const hydration = stripComments(read('components/hydration/HydrationScreenV2.tsx'));
const home = stripComments(read('components/home/HomeScreenV2.tsx'));

describe('S2-1.1 — no intake without an explicit quantity', () => {
  it('the scraped-dose path is gone', () => {
    expect(hydration).not.toContain('parseDoseOz');
    expect(hydration).not.toMatch(/engine\.command\.action/);
  });

  it('the manual-log button opens the picker and writes nothing', () => {
    const button = /<AFSecondaryButton[\s\S]{0,300}?\/>/.exec(hydration)?.[0] ?? '';
    expect(button).toContain('testID="hydration-log-manually"');
    expect(button).toContain('onPress={openWaterPicker}');
    expect(button).not.toContain('logIntake');
  });

  it("the screen's ONLY intake write takes the member's picker amount", () => {
    const calls = hydration.match(/logIntake\('water'/g) ?? [];
    expect(calls).toHaveLength(1);
    expect(hydration).toMatch(
      /confirmWaterAmount[\s\S]{0,500}?logIntake\('water',\s*\{\s*ozOverride:\s*oz,\s*source:\s*'hydration'\s*\}\)/,
    );
  });
});

describe('S2-1.2 — Hydration and Home share the canonical write behavior', () => {
  it('both screens commit through the same picker → guarded confirm shape', () => {
    for (const [src, source] of [
      [hydration, 'hydration'],
      [home, 'home'],
    ] as const) {
      expect(src).toMatch(
        new RegExp(
          String.raw`logIntake\('water',\s*\{\s*ozOverride:\s*oz,\s*source:\s*'${source}'\s*\}\)`,
        ),
      );
      expect(src).toMatch(/<WaterAmountModal[\s\S]{0,200}?onConfirm=\{confirmWaterAmount\}/);
    }
  });

  it('neither member-initiated log is silent (the confirmation must render)', () => {
    expect(hydration).not.toMatch(/logIntake\('water',[^)]*silent/);
    expect(home).not.toMatch(/logIntake\('water',[^)]*silent/);
  });
});

describe("S2-1.3 — a success state cannot strand Home's CTA", () => {
  it('Hydration mounts the overlay for the state its own write raises', () => {
    expect(hydration).toMatch(
      /showCycleSuccess\s*&&\s*lastCycleResult\s*&&[\s\S]{0,200}?<CycleSuccessOverlay[\s\S]{0,200}?onDismiss=\{dismissSuccess\}/,
    );
  });

  it('Scan mounts the overlay for the state its five writes raise (strand-proof closure)', () => {
    // The scan closure (founder-authorized): all five scan writes are
    // NON-silent and variable-first-arg — the original sweep regex below
    // only matched string-literal first args, so they escaped it, mounted
    // no overlay, and stranded showCycleSuccess across the §11 auto-back.
    const scan = stripComments(read('components/scan/HydrationScanScreenV2.tsx'));
    expect(scan).toMatch(
      /state\.showCycleSuccess\s*&&\s*state\.lastCycleResult\s*&&[\s\S]{0,200}?<CycleSuccessOverlay[\s\S]{0,200}?onDismiss=\{dismissSuccess\}/,
    );
  });

  it('every REACHABLE non-silent intake writer in components/ mounts CycleSuccessOverlay', () => {
    // Walk all component sources; any file whose CODE calls logIntake( without
    // passing `silent` in that call must render the overlay locally — the
    // structural guarantee that no screen can raise a confirmation it cannot
    // show. (Genuinely silent writers — e.g. app/recovery-coach.tsx's
    // silent:true log — are exempt by the reducer's own contract: silent
    // never sets showCycleSuccess. NOTE this comment previously listed
    // "scan auto-log" as a silent exemplar — that premise was WRONG: scan's
    // five writes are non-silent, and the sweep's old first-arg regex,
    // `logIntake\((?:'|")`, matched only string-literal first args, so
    // scan's variable-first-arg calls were invisible to it. The sweep now
    // matches ANY first arg.)
    //
    // Orphan exemption, proven in-test: a writer imported by NO production
    // module can never render, so it can never strand the state (today:
    // `LogIntakeRow.tsx`, which HomeScreenV2's own comments record as dead).
    // The exemption is structural, not a name list — the moment anyone
    // imports an overlay-less writer, this lock trips.
    const files: Array<{ rel: string; code: string }> = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          if (name === '__tests__' || name === 'node_modules') continue;
          walk(p);
          continue;
        }
        if (!/\.tsx?$/.test(name) || name.includes('.test.')) continue;
        files.push({ rel: p.slice(PKG.length + 1), code: stripComments(readFileSync(p, 'utf8')) });
      }
    };
    walk(resolve(PKG, 'components'));
    walk(resolve(PKG, 'app'));
    walk(resolve(PKG, 'screens'));

    const isImported = (rel: string): boolean => {
      const base = rel.replace(/\.tsx?$/, '').split('/').pop()!;
      const needle = new RegExp(String.raw`from\s+['"][^'"]*${base}['"]`);
      return files.some((f) => f.rel !== rel && needle.test(f.code));
    };

    const offenders = files
      .filter((f) => {
        // ANY first arg — string literal OR variable. The original
        // `logIntake\((?:'|")` shape silently exempted every
        // variable-first-arg writer (the scan gap this closure fixed).
        const calls = [...f.code.matchAll(/logIntake\([\s\S]{0,300}?\)/g)];
        if (calls.length === 0) return false;
        const hasNonSilent = calls.some((m) => !/silent/.test(m[0]));
        return hasNonSilent && !f.code.includes('<CycleSuccessOverlay') && isImported(f.rel);
      })
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });
});

describe('S2-1.4 — one confirmation creates one durable event', () => {
  it('the confirm handler carries the synchronous in-flight guard, set before the write', () => {
    const handler =
      /const confirmWaterAmount = React\.useCallback\(([\s\S]*?)\[logIntake/.exec(hydration)?.[1] ??
      '';
    expect(handler).toMatch(
      /if \(confirmInFlightRef\.current \|\| isCompletingCycle \|\| showCycleSuccess\) return;/,
    );
    const setIdx = handler.indexOf('confirmInFlightRef.current = true');
    const writeIdx = handler.indexOf("logIntake('water'");
    expect(setIdx).toBeGreaterThan(-1);
    expect(writeIdx).toBeGreaterThan(setIdx);
  });

  it('the picker cannot reopen while a write is in flight or unacknowledged', () => {
    expect(hydration).toMatch(
      /openWaterPicker[\s\S]{0,200}?if \(isCompletingCycle \|\| confirmInFlightRef\.current \|\| showCycleSuccess\) return;/,
    );
  });

  it('the in-flight guard clears only on the settled cycle (same contract as Home)', () => {
    expect(hydration).toMatch(
      /if \(isCompletingCycle\) return;\s*confirmInFlightRef\.current = false;/,
    );
  });
});
