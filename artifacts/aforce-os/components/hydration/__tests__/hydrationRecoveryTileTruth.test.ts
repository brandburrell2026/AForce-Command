/**
 * Hydration Recovery-tile truth lock (command-authority wave 1,
 * founder-authorized) — the Correction-6 twin.
 *
 * The Hydration screen's "Recovery" row rendered
 * `titleCase(engine.performanceState.level)` in an AFStatusBadge — the
 * band the engine already owns, restated as if it were a recovery
 * reading: a second verdict beside the intake hero, presenting a
 * measurement nobody took. Home's identical Recovery tile was ruled out
 * twice (founder §1 2026-08-13 trend-verb withholding; Correction 6,
 * build-61 device QA — pinned in homeScreenV2Wiring.test.ts). This pins
 * the same resolution here: the honest-data em dash until a real
 * recovery input exists.
 *
 * Source-scan idiom (store+router containers are never mounted directly —
 * house convention).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(__dirname, '..', 'HydrationScreenV2.tsx'), 'utf8');

describe('Hydration "Recovery" row — honest em dash, never a second verdict', () => {
  it('renders the honest-data em dash as the value', () => {
    expect(SRC).toMatch(/statValue}>\{EM_DASH\}/);
    expect(SRC).toContain("import { EM_DASH } from './signalV3Presentation'");
  });

  it('the band word can no longer be restated as a "Recovery" reading', () => {
    // The defect's exact mechanism: performanceState.level fed into a status
    // badge under the recovery label. Neither half may return.
    expect(SRC).not.toMatch(/AFStatusBadge/);
    expect(SRC).not.toMatch(/titleCase\(engine\.performanceState\.level\)/);
  });

  it('the accessibility label matches the visual truth (label + em dash, no band word)', () => {
    expect(SRC).toMatch(/accessibilityLabel=\{`\$\{t\('hydration\.v2\.recovery_label'\)} \$\{EM_DASH\}`\}/);
  });
});
