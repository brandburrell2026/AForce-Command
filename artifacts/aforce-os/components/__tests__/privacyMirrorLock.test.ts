/**
 * Privacy-policy MIRROR LOCK (founder-authorized, 2026-08-28).
 *
 * Three surfaces publish the privacy story: the canonical document
 * (legal/privacy-policy.md), the in-app screen (app/legal/privacy.tsx —
 * whose own header mandates "the two surfaces must tell the identical
 * story"), and the marketing-site page (aforce-site Privacy.tsx). They had
 * silently diverged for months: the rendered pair carried a personal
 * cross-brand contact address (bburrell@alkalineforce.com) while the
 * canonical doc said privacy@drinkaforce.com, and the doc's stale April
 * template said "under 13" while both member-facing surfaces published
 * "under 16" — so a member's deletion request could route two ways, and
 * the recorded age floor depended on which surface you read.
 *
 * FOUNDER RULINGS (2026-08-28): contact = privacy@drinkaforce.com on all
 * three; age floor = under 16 on all three (the deliberately-published
 * claim; the doc catches up). Changing either is a legal-copy decision:
 * update ALL THREE surfaces and these constants in the same commit.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const AOS = join(__dirname, '..', '..');
const SITE = join(AOS, '..', 'aforce-site');

/** The founder-ruled canonical values. A conscious edit point, not config. */
const PRIVACY_CONTACT = 'privacy@drinkaforce.com';
const AGE_FLOOR_CLAIM = 'under 16';
const RETIRED_CONTACTS = ['bburrell@alkalineforce.com'];
const RETIRED_AGE_CLAIM = 'under 13';

const SURFACES = [
  { name: 'canonical doc', path: join(AOS, 'legal', 'privacy-policy.md') },
  { name: 'in-app screen', path: join(AOS, 'app', 'legal', 'privacy.tsx') },
  { name: 'site page', path: join(SITE, 'src', 'pages', 'Privacy.tsx') },
];

describe('privacy surfaces tell the identical story', () => {
  for (const { name, path } of SURFACES) {
    const src = readFileSync(path, 'utf8');

    it(`${name} routes privacy requests to the one ruled mailbox`, () => {
      expect(src).toContain(PRIVACY_CONTACT);
      for (const retired of RETIRED_CONTACTS) {
        expect(src, `${name} still carries the retired contact ${retired}`).not.toContain(retired);
      }
    });

    it(`${name} states the ruled age floor (and not the stale one)`, () => {
      expect(src.toLowerCase()).toContain(AGE_FLOOR_CLAIM);
      expect(src.toLowerCase(), `${name} still carries the stale age claim`).not.toContain(
        RETIRED_AGE_CLAIM,
      );
    });
  }
});
