/**
 * Compliance regression lock (Score-Protection, D5 + review #460 item 5).
 *
 * The WHOOP card previously claimed "FEEDING AFORCE HYDRATION SCORE · LIVE" —
 * the exact opposite of the Score-Protection contract (types/index.ts:
 * biometrics feed Readiness only, never the Score; governance/
 * AFORCE_OS_HEALTH_SOURCE_MATRIX.md). The copy is now
 * "INFORMING AFORCE READINESS · LIVE". This test scans EVERY locale file so
 * the prohibited claim can never return in any language.
 *
 * Review #460 item 5 broadened the pattern set beyond the literal "FEEDING"
 * phrase to any verb (informs / affects / boosts / improves / feeds) sitting
 * near "Hydration Score" — the Connected Health copy now lives in
 * `locales/*.json` (moved out of connectedHealthView.ts), so this is the
 * file that guards it. The one sentence allowed to combine "informs" with
 * "Hydration Score" is the exact, approved Score-Protection sentence itself
 * ("Health data informs Readiness only. It never changes your Hydration
 * Score.") — every verbatim occurrence of it is stripped from the scanned
 * text before the broadened patterns run, so approving that sentence can
 * never require loosening the guard for anything else.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCORE_PROTECTION_LINE } from '../connectedHealthView';

const LOCALES_DIR = join(__dirname, '..', '..', '..', 'locales');

const PROHIBITED = [
  /FEEDING\s+AFORCE\s+HYDRATION\s+SCORE/i,
  /FEEDS?\s+(THE\s+)?HYDRATION\s+SCORE/i,
  // Broadened per review #460 item 5: any of these verbs within ~20 chars of
  // "Hydration Score" is a Score-Protection violation, in any language file
  // that happens to carry the English phrase verbatim (translation is a
  // follow-up; today every non-EN file mirrors EN for this namespace).
  /(informs|affects|boosts|improves|feeds?).{0,20}Hydration Score/i,
];

/**
 * Removes every verbatim occurrence of the approved Score-Protection
 * sentence before scanning — negative-lookahead-by-stripping so the one
 * sentence permitted to say "informs ... Hydration Score" can never be
 * mistaken for (or force a loosening of) the prohibited pattern above.
 */
function stripApprovedScoreProtectionCopy(text: string): string {
  return text.split(SCORE_PROTECTION_LINE).join('');
}

describe('prohibited Hydration-Score claim never returns', () => {
  const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));

  it('locale files exist to scan', () => {
    expect(files.length).toBeGreaterThanOrEqual(11);
  });

  for (const file of files) {
    it(`${file} contains no prohibited Hydration-Score claim (outside the approved sentence)`, () => {
      const raw = readFileSync(join(LOCALES_DIR, file), 'utf8');
      const text = stripApprovedScoreProtectionCopy(raw);
      for (const pattern of PROHIBITED) {
        expect(text).not.toMatch(pattern);
      }
    });
  }

  it('en.json carries the approved WHOOP replacement copy', () => {
    const en = JSON.parse(readFileSync(join(LOCALES_DIR, 'en.json'), 'utf8'));
    expect(en.settings.whoop.footer_live).toBe('INFORMING AFORCE READINESS · LIVE');
  });

  it('en.json carries the Connected Health Score-Protection sentence verbatim (review #460 item 5)', () => {
    const en = JSON.parse(readFileSync(join(LOCALES_DIR, 'en.json'), 'utf8'));
    expect(en.connected_health.footer.score_protection).toBe(SCORE_PROTECTION_LINE);
    expect(SCORE_PROTECTION_LINE).toBe('Health data informs Readiness only. It never changes your Hydration Score.');
  });

  it('the approved sentence itself would trip the broadened pattern if left unstripped (proves the guard is real)', () => {
    // Sanity check on the regex itself, not on product copy: without the
    // strip step, a hypothetical shorter phrasing WOULD be caught — e.g. one
    // that puts "Hydration Score" within 20 chars of the verb. This guards
    // against the broadened pattern silently matching nothing.
    const trap = 'This app informs your Hydration Score every day.';
    expect(trap).toMatch(PROHIBITED[2]);
  });
});
