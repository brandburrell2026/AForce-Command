/**
 * Editorial Scan — THE TOOL — E6-B law lock (founder authorization 2026-08-30).
 *
 * Planted BEFORE implementation. Scan is the last screen in the migration
 * annex and the one where the product law bites hardest:
 *
 *   "Scan is The Tool, not The Diagnostician."
 *
 * E6-A protected its three producers; E6-B0 corrected its data and decision
 * truth. This file governs the PRESENTATION built on top of them — and the
 * central risk is that a premium editorial register makes a catalog lookup
 * *look* like a measurement of the member.
 *
 * Lives in components/__tests__/ deliberately: components/editorial/__tests__/
 * and components/scan/__tests__/ match NO vitest glob and would silently never
 * run.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS } from '../../featureFlags/flags';
import { PROVENANCE_LABEL, matchQualifier } from '../editorial/scan/editorialScanPresentation';

const AOS = join(__dirname, '..', '..');
const ED_SCAN = join(AOS, 'components', 'editorial', 'scan');
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
const sources = () => walk(ED_SCAN).map((f) => ({ file: relative(AOS, f), src: strip(read(f)) }));
const screen = () => strip(read(join(ED_SCAN, 'EditorialScanScreen.tsx')));
/** The screen WITHOUT imports — an import is not a use. */
const body = () => screen().replace(/^\s*import[\s\S]*?from\s+'[^']+';\s*$/gm, '');
const routes = () => [join('app', 'scan.tsx'), join('app', '(tabs)', 'scan.tsx')];

// ───────────────────────────────────────── flag + both seams

describe('FLAG + BOTH ROUTE SEAMS — no route may bypass the flag', () => {
  it('editorial_scan_enabled is OFF in production and ON in the demo profile', () => {
    expect(DEFAULT_FLAGS.editorial_scan_enabled).toBe(false);
    expect(DEMO_ALL_ON_FLAGS.editorial_scan_enabled).toBe(true);
  });

  it('the four earlier go-live flags are untouched, and HydroScan 2 stays off', () => {
    expect(DEFAULT_FLAGS.editorial_home_enabled).toBe(false);
    expect(DEFAULT_FLAGS.editorial_moments_enabled).toBe(false);
    expect(DEFAULT_FLAGS.editorial_protocol_enabled).toBe(false);
    expect(DEFAULT_FLAGS.editorial_weekly_enabled).toBe(false);
    expect(DEFAULT_FLAGS.hydro_scan_2_enabled).toBe(false);
  });

  it('BOTH routes gate on the flag — neither can drift from the other', () => {
    for (const r of routes()) {
      const src = strip(read(join(AOS, r)));
      expect(src, `${r} must consult the flag`).toContain('editorial_scan_enabled');
      expect(src, `${r} must reach the editorial screen`).toContain('EditorialScanScreen');
      expect(src, `${r} must keep the rollback branch`).toContain('HydrationScanScreenV2');
    }
  });

  it('no OTHER route mounts a Scan implementation outside the seam', () => {
    // A third entry point that renders the production screen directly would
    // silently bypass the flag for that path.
    const appDir = join(AOS, 'app');
    const offenders: string[] = [];
    for (const f of walk(appDir)) {
      const rel = relative(AOS, f);
      if (routes().includes(rel)) continue;
      const src = strip(read(f));
      if (/<\s*(HydrationScanScreenV2|EditorialScanScreen)\b/.test(src)) offenders.push(rel);
    }
    expect(offenders, 'these routes bypass the editorial seam').toEqual([]);
  });
});

// ───────────────────────────────────────── D1 · PRODUCT MATCH

describe('D1 — PRODUCT MATCH is a contextualized result, never a score of the member', () => {
  it('the banned score vocabulary appears nowhere in the layer', () => {
    for (const { file, src } of sources()) {
      for (const banned of [
        /hydration\s+score/i,
        /health\s+score/i,
        /recovery\s+score/i,
        /readiness\s+score/i,
        /physiological\s+score/i,
      ]) {
        expect(src, `${file} — banned naming: ${banned}`).not.toMatch(banned);
      }
    }
  });

  it('the approved label is used', () => {
    expect(body()).toMatch(/PRODUCT MATCH/);
  });

  it('the contextual posture travels WITH the value — visibly AND spoken', () => {
    // "Contextualized for this Moment" is the approved supporting posture. The
    // number may not render without it, in text and to a screen reader.
    //
    // An earlier version of this test matched `matchQualifier()` anywhere in
    // the file, so deleting the VISIBLE qualifier passed — the call survived
    // in the a11y label alone. Both carriers are now pinned separately.
    expect(matchQualifier()).toBe('Contextualized for this Moment');
    const flat = body().replace(/\s+/g, ' ');
    const block = /testID="ed-scan-match"[\s\S]*?<\/View>\s*<Text/.exec(flat)?.[0] ?? '';
    // The fallback used to be the WHOLE FILE, which re-armed the very vacuity
    // this test exists to close: any match anywhere satisfied it.
    expect(block, 'the match block must be locatable').not.toBe('');

    // Spoken: folded into the grouped label beside the number.
    expect(block, 'the qualifier must be spoken with the value').toMatch(
      /accessibilityLabel=\{[^}]*matchQualifier\(\)/,
    );
    // Visible: rendered as its own Text inside the match block.
    expect(block, 'the qualifier must be VISIBLE beside the value').toMatch(
      /<Text[^>]*>\s*\{matchQualifier\(\)\}\s*<\/Text>/,
    );
    // Belt and braces: at least two call sites, so removing one still fails.
    expect((body().match(/matchQualifier\(\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('the match is never presented as an intrinsic product grade', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file}`).not.toMatch(/product\s+(grade|rating)/i);
    }
  });
});

// ───────────────────────────────────────── D2 · camera truth

describe('D2 — the scanner reads a barcode; it takes no photograph', () => {
  it('the layer contains no capture path and no photographic vocabulary', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file} — no capture`).not.toMatch(/takePicture|takePhoto|captureAsync/);
      expect(src, `${file} — no photographic grammar`).not.toMatch(
        /\bphoto\b|\bphotograph|\bshutter\b|\bcamera roll\b|\bsnapshot\b/i,
      );
    }
  });

  it('and the production scanner it mirrors genuinely never captures either', () => {
    // The claim the copy rests on, verified against the real modal.
    const modal = strip(read(join(AOS, 'components', 'CameraScanModal.tsx')));
    expect(modal).not.toMatch(/takePicture|takePhoto|captureAsync/);
    expect(modal).toMatch(/onBarcodeScanned/);
  });

  it('the target reads as barcode detection', () => {
    expect(body()).toMatch(/POINT AT BARCODE/);
  });

  it('any on-device claim is technically exact — no upload, no storage', () => {
    const src = body();
    if (/ON DEVICE/i.test(src)) {
      const modal = strip(read(join(AOS, 'components', 'CameraScanModal.tsx')));
      expect(modal, 'an ON DEVICE claim requires there to be no upload').not.toMatch(
        /fetch\(|upload|FormData/,
      );
    }
  });
});

// ───────────────────────────────────────── D3 · provenance

describe('D3 — provenance is consumed honestly, never cosmetically upgraded', () => {
  it('the layer reads the E6-B0 provenance system rather than inventing one', () => {
    expect(body()).toMatch(/attributeProvenance/);
  });

  it('every provenance state has a member-facing label', () => {
    expect(PROVENANCE_LABEL.verified).toBeTruthy();
    expect(PROVENANCE_LABEL.estimated).toBeTruthy();
    expect(PROVENANCE_LABEL.unknown).toBeTruthy();
    expect(PROVENANCE_LABEL.estimated).not.toBe(PROVENANCE_LABEL.verified);
  });

  it('nothing upgrades a provenance state, and brand never influences it', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file} — provenance may not be overridden`).not.toMatch(
        /provenance\s*=\s*'verified'|'verified'\s*:\s*true/,
      );
      expect(src, `${file} — brand must not touch provenance`).not.toMatch(
        /isAForce[\s\S]{0,80}provenance|provenance[\s\S]{0,80}isAForce/,
      );
    }
  });
});

// ───────────────────────────────────────── D4 · claims

describe('D4 — no physiological claim is reintroduced through editorial copy', () => {
  it('the layer asserts nothing about the member’s body', () => {
    for (const { file, src } of sources()) {
      for (const banned of [
        /increase[sd]?\s.{0,24}(hydration|fluid)\s(demand|need|loss)/i,
        /\bdehydrat/i,
        /your body (will|may|is)/i,
        /\brehydrate[sd]? you\b/i,
        /\b(measured|detected|diagnosed|analy[sz]ed)\s+(your|you)\b/i,
        /\bwill (improve|restore|fix|boost)\b/i,
      ]) {
        expect(src, `${file} — banned claim: ${banned}`).not.toMatch(banned);
      }
    }
  });

  it('the retired sentence stays retired upstream', () => {
    const svc = strip(read(join(AOS, 'services', 'hydrationScanService.ts')));
    expect(svc).not.toMatch(/may increase hydration demand/);
  });
});

// ───────────────────────────────────────── D5 · unknown ≠ zero

describe('D5 — missing data never looks like a favourable measurement', () => {
  it('an unknown attribute renders the honest-absence dash and no bar', () => {
    // The behaviour lives in EdProductFactors, not the screen. Reading only
    // the screen made this pass on incidental `== null` checks elsewhere.
    const factors = strip(read(join(ED_SCAN, 'EdProductFactors.tsx')));
    expect(factors, 'unknown must be detected').toMatch(/const unknown = f\.value == null/);
    expect(factors, 'unknown must print the em dash').toMatch(/unknown \? '—' : f\.value/);
    expect(factors, 'and must NOT print a bar or a width').not.toMatch(/width:\s*`\$\{/);
    // Spoken too — a dash that says nothing is not honest absence.
    expect(factors).toMatch(/not on file/i);
  });

  it('the layer never coerces a missing value into a number', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file} — no ?? 0 laundering`).not.toMatch(/\?\?\s*0\b/);
      expect(src, `${file} — no falsy-default laundering`).not.toMatch(/\|\|\s*0\b/);
    }
  });

  it('a measured zero is still rendered as data', () => {
    // The truthful-neutral rule: absence is the dash, zero is zero. The old
    // form matched `!= null` anywhere in the screen — satisfied by an
    // unrelated coverage check while the distinction itself was gone.
    const factors = strip(read(join(ED_SCAN, 'EdProductFactors.tsx')));
    // The ONLY thing that produces the dash is a null value…
    expect(factors).toMatch(/f\.value == null/);
    // …so a zero necessarily falls through to the value branch. Guard the
    // regression directly: nothing may treat falsiness as absence.
    expect(factors, 'falsy is not absent — 0 is data').not.toMatch(/!f\.value|f\.value \?\?|f\.value \|\|/);
  });
});

// ───────────────────────────────────────── D6 · neutrality in presentation

describe('D6 — presentation may not undo the neutralized decision path', () => {
  it('the layer branches on no brand flag at all', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file} — no brand-conditional presentation logic`).not.toMatch(
        /if\s*\([^)]*isAForce|isAForce\s*\?/,
      );
    }
  });

  it('nor does any COPY MODULE this screen speaks or renders from', () => {
    // The gap that let a real D6 violation through. This sweep walked only
    // components/editorial/scan/, so a brand gate reached through an IMPORT
    // passed clean — and the coach voice held one: the warmer "is locked in…"
    // register was reachable by AForce products only, while a rival with an
    // IDENTICAL verdict got "fits…". The visible composition was neutral; the
    // spoken one was not, and the lock could not see it.
    //
    // Presentation is wherever the member meets the words, including audio.
    const SPOKEN_SOURCES = [join('services', 'scanCoachVoice.ts')];
    for (const rel of SPOKEN_SOURCES) {
      const src = strip(read(join(AOS, rel)));
      expect(src, `${rel} — copy may not branch on brand`).not.toMatch(
        /if\s*\([^)]*\bisAForce\b|\bisAForce\s*\?/,
      );
    }
  });

  it('the alternative is rendered from the canonical field, whatever brand won', () => {
    const src = body();
    expect(src).toMatch(/alternativeProductId/);
    expect(src, 'no AForce-specific alternative component').not.toMatch(/AForceReplacement/);
  });

  it('NO CHANGE NEEDED is renderable as a real outcome', () => {
    expect(body()).toMatch(/noChangeNeeded/);
  });

  it('no CTA is conditioned on brand', () => {
    // The screen has several Pressables; an earlier regex matched only some of
    // them, so a brand-conditional CTA could hide in the ones it missed. The
    // whole-layer ban above already covers `isAForce`, so this asserts the
    // stronger structural fact: every Pressable is FOUND, and none mentions it.
    const src = body();
    const opens = (src.match(/<Pressable\b/g) ?? []).length;
    expect(opens, 'the screen must have interactive controls to check').toBeGreaterThanOrEqual(3);
    const blocks = src.match(/<Pressable[\s\S]*?<\/Pressable>/g) ?? [];
    expect(blocks.length, 'every Pressable must be inspectable').toBe(opens);
    for (const b of blocks) {
      expect(b, 'a CTA must not vary by brand').not.toMatch(/isAForce/);
    }
  });
});

// ───────────────────────────────────────── command authority

describe('COMMAND AUTHORITY — Scan explains; RecoveryCommand decides (DR-013)', () => {
  it('the layer prescribes no dose, quantity, timing, recheck or urgency of its own', () => {
    for (const { file, src } of sources()) {
      for (const banned of [
        /\b\d+\s?(oz|ml|mL|litre|liter)\b/,
        /\brecheck\b/i,
        /\bin \d+ minutes?\b/i,
        /\bdrink now\b/i,
        /\bimmediately\b/i,
        /\bright now\b/i,
      ]) {
        expect(src, `${file} — Scan may not prescribe: ${banned}`).not.toMatch(banned);
      }
    }
  });

  it('any action it shows is mirrored from the canonical recommendation', () => {
    expect(body()).toMatch(/recommendation\./);
  });
});

// ───────────────────────────────────────── hydration credit

describe('HYDRATION CREDIT — recognition is not consumption', () => {
  it('the layer never writes intake itself', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file} — Scan may not log intake directly`).not.toMatch(/logIntake\s*\(/);
    }
  });

  it('logging stays behind the canonical confirmation the production screen owns', () => {
    // The editorial screen may PRESENT the log affordance, but the write goes
    // through the same reviewed pipeline — never fired by identification.
    const src = body();
    if (/shouldLog/.test(src)) {
      expect(src, 'a log affordance must be gated on the canonical flag').toMatch(
        /recommendation\.shouldLog/,
      );
    }
  });
});

// ───────────────────────────────────────── a11y + motion + isolation

describe('A11Y · MOTION · ISOLATION — the standing editorial rules', () => {
  it('the provenance and classification cues reach assistive tech, not colour alone', () => {
    const src = body();
    expect(src.match(/accessibilityLabel=/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    // The provenance word itself must be SPOKEN, not merely printed — this
    // test was named for provenance and never opened the file that carries it.
    const factors = strip(read(join(ED_SCAN, 'EdProductFactors.tsx')));
    expect(factors, 'the provenance state must be in the spoken label').toMatch(
      /accessibilityLabel=\{spoken\}/,
    );
    expect(factors).toMatch(/PROVENANCE_LABEL\[f\.provenance\]/);
  });

  it('the statement is a header landmark', () => {
    expect(body()).toMatch(/accessibilityRole="header"/);
  });

  it('every interactive target meets the 44pt floor and is labelled', () => {
    // The Scan layer is exempted from the foundation lock's non-interactivity
    // ban. That exemption must not also lose the target floor the ban was
    // standing in for.
    const src = body();
    const blocks = src.match(/<Pressable[\s\S]*?<\/Pressable>/g) ?? [];
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    for (const b of blocks) {
      expect(b, 'every control needs a spoken label').toMatch(/accessibilityLabel=/);
      expect(b, 'every control needs a role').toMatch(/accessibilityRole="button"/);
    }
    // The shared target style carries the floor.
    expect(src).toMatch(/minHeight: edRhythm\.minTarget/);
  });

  it('no hand-rolled font cap, raw size or hex in the layer', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file}`).not.toMatch(/maxFontSizeMultiplier=\{[0-9]/);
      if (/\.tsx$/.test(file)) {
        expect(src, `${file} — sizes come from edType`).not.toMatch(/fontSize\s*:/);
        expect(src, `${file} — colors come from editorialTokens`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      }
    }
  });

  it('motion runs through the shared hooks; production never imports demo', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file}`).not.toMatch(/Animated\.(timing|spring|loop)\(/);
      expect(src, `${file}`).not.toMatch(/from '@\/demo/);
    }
  });

  it('the black stock is restated on the AFScreen shell', () => {
    // AFScreen paints af.canvas on its own root. Scan is BLACK stock so the
    // E5 paper defect cannot recur — but the stock is stated explicitly
    // rather than relied upon by coincidence.
    expect(body()).toMatch(/edStock\.black|stock="black"/);
  });
});
