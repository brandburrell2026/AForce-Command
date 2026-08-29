/**
 * PROVENANCE CONTRACT — one vocabulary, client and server.
 *
 * Build 65 recorded two 12 oz intakes from one reported tap, and neither could
 * be attributed to a surface because every row carried `entry_source = NULL`.
 * The column, the wire contract and the server write all existed; no client call
 * site populated it. These tests exist so that stays impossible: the enum cannot
 * drift from the server's, and every entry point that can create a NEW intake
 * event must name its surface.
 *
 * This is diagnostics, not a remedy. It does not fix the duplicate defect — it
 * guarantees the next occurrence is attributable from data alone.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { INTAKE_SOURCES, NEW_INTAKE_SURFACES, isIntakeSource } from '../intakeSource';

const PKG = resolve(__dirname, '..', '..');
const SERVER_SCHEMA = resolve(PKG, '..', 'api-server', 'src', 'routes', 'aforce', 'intakeSchema.ts');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** The literals inside the server's `entrySource: z.enum([...])`. */
function serverEnumValues(): string[] {
  const src = stripComments(readFileSync(SERVER_SCHEMA, 'utf8'));
  const block = /entrySource:\s*z\s*\.?\s*enum\(\s*\[([\s\S]*?)\]/.exec(src);
  if (!block?.[1]) throw new Error('could not locate the server entrySource enum');
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
}

describe('intake provenance contract', () => {
  it('client and server accept exactly the same values', () => {
    // Drift here is silent and one-directional: the client would send a value
    // the server rejects, and zod's failure surfaces as `400 intake_failed` —
    // the same opaque status that hid the missing-column fault for a full QA
    // cycle.
    expect([...serverEnumValues()].sort()).toEqual([...INTAKE_SOURCES].sort());
  });

  it('retains the legacy capture modes so historical rows stay valid', () => {
    // These predate the surface vocabulary. Dropping them would invalidate rows
    // already written and break older clients still in the field.
    for (const legacy of ['tap', 'scan_log', 'voice', 'offline_replay', 'sensor']) {
      expect(INTAKE_SOURCES, `legacy value "${legacy}" must not be removed`).toContain(legacy);
    }
  });

  it('covers the surfaces the founder named', () => {
    for (const surface of ['home', 'hydration', 'scan', 'protocol', 'recovery', 'manual']) {
      expect(INTAKE_SOURCES).toContain(surface);
    }
  });

  it('is a closed vocabulary — it cannot become a free-text or PII channel', () => {
    expect(isIntakeSource('home')).toBe(true);
    expect(isIntakeSource('user_3FjQDHNJakRe4CfDPvmSgNw4piC')).toBe(false);
    expect(isIntakeSource('')).toBe(false);
    expect(isIntakeSource(undefined)).toBe(false);
    expect(isIntakeSource({ toString: () => 'home' })).toBe(false);
  });

  it('every new-intake surface is a member of the canonical list', () => {
    for (const s of NEW_INTAKE_SURFACES) expect(INTAKE_SOURCES).toContain(s);
  });
});

/**
 * Source-scanning the call sites. Rendering every screen to assert one string
 * would be far more machinery for a weaker guarantee — what matters is that the
 * call site DECLARES its surface, which is exactly what is read here.
 */
describe('every intake entry point names its surface', () => {
  const SITES: ReadonlyArray<{ file: string; expected: string; what: string }> = [
    { file: 'components/home/HomeScreenV2.tsx', expected: 'home', what: 'Home Log Water' },
    { file: 'components/hydration/HydrationScreenV2.tsx', expected: 'hydration', what: 'Hydration' },
    { file: 'components/scan/HydrationScanScreenV2.tsx', expected: 'scan', what: 'Scan' },
    { file: 'app/recovery-coach.tsx', expected: 'recovery', what: 'Recovery Coach' },
    // VoiceOverlay ruling (founder, 2026-08-28): the voice capture sheet
    // (source 'voice') was unmounted since #858 and is RETIRED with its
    // exclusive STT stack; its row retires with the subject, same
    // protocol as the rows below. A future voice-input surface must add
    // its own row here when it lands.
    // S2-13: LogIntakeRow (source 'manual') was a proven orphan — mounted
    // nowhere since Build 61 — and is deleted; the live member-initiated
    // entries are the Home/Hydration picker rows above.
    // Orphan-tree retirement (founder-authorized): SmartQuickActions
    // (source 'home') and CommandStack (source 'protocol') were legacy-Home
    // orphans — zero importers — and are deleted; their rows retire with
    // their subjects, same protocol as LogIntakeRow above.
  ];

  it.each(SITES)('$what declares source: $expected', ({ file, expected, what }) => {
    const src = stripComments(readFileSync(resolve(PKG, file), 'utf8'));
    expect(
      new RegExp(`source:\\s*'${expected}'`).test(src),
      `${what} (${file}) calls logIntake without source: '${expected}'. An untagged intake ` +
        'writes entry_source = NULL, which is the un-attributable state that made the Build-65 ' +
        'duplicate impossible to narrow from data.',
    ).toBe(true);
  });

  it('no intake call site is left untagged', () => {
    // A bare `logIntake(x)` with no options object cannot carry provenance.
    // Nested calls (`parseDoseOz(...)`) mean the argument list cannot be matched
    // with a character class — walk paren depth to find the real closing paren.
    function callArgs(src: string, openIdx: number): string {
      let depth = 0;
      for (let i = openIdx; i < src.length; i++) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')') {
          depth--;
          if (depth === 0) return src.slice(openIdx + 1, i);
        }
      }
      return '';
    }

    const offenders: string[] = [];
    for (const { file } of SITES) {
      const src = stripComments(readFileSync(resolve(PKG, file), 'utf8'));
      for (const m of src.matchAll(/logIntake\(/g)) {
        const args = callArgs(src, m.index + 'logIntake'.length);
        // Type declarations and prop signatures are not calls.
        if (/:\s*\(/.test(args) || args.includes('fluidType:')) continue;
        // An options VARIABLE (e.g. `logIntake(x, opts)`) carries provenance
        // where the object is built; the per-file assertion above covers it.
        const isIdentifierArg = /^[^{]*,\s*[A-Za-z_$][\w$]*\s*$/.test(args);
        if (args.trim() && !args.includes('source:') && !args.includes('...') && !isIdentifierArg) {
          offenders.push(`${file}: logIntake(${args.replace(/\s+/g, ' ').slice(0, 70)})`);
        }
      }
    }
    expect(offenders, `untagged intake calls:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });
});

/**
 * REPLAY PRESERVES THE ORIGINATING SURFACE.
 *
 * The subtle failure here is not losing the field — it is overwriting it. A
 * queued intake that comes back as "offline_replay" reports HOW it reached the
 * server, discarding WHICH surface created it, and it does so precisely for the
 * events whose timeline is hardest to reconstruct. Provenance is frozen into the
 * outbox payload alongside `clientEventId` and replayed verbatim.
 */
describe('outbox replay preserves provenance', () => {
  const realApi = readFileSync(resolve(PKG, 'services', 'realApi.ts'), 'utf8');
  const outboxTypes = readFileSync(
    resolve(PKG, 'utils', 'intakeOutbox', 'types.ts'),
    'utf8',
  );

  it('the frozen outbox payload carries the source', () => {
    expect(
      /entrySource\?: IntakeSource/.test(outboxTypes),
      'PreparedIntake must carry entrySource so a queued intake replays with the surface that ' +
        'created it.',
    ).toBe(true);
  });

  it('prepareIntake freezes the source into the outbox payload', () => {
    const prepared = /outbox:\s*\{[\s\S]*?\}/.exec(realApi)?.[0] ?? '';
    expect(prepared).toMatch(/entrySource/);
  });

  it('replayPreparedIntake sends the frozen source, not "offline_replay"', () => {
    const fn = /export async function replayPreparedIntake[\s\S]*?\n}/.exec(realApi)?.[0] ?? '';
    expect(fn, 'replayPreparedIntake must forward prepared.entrySource').toMatch(
      /prepared\.entrySource/,
    );
    expect(
      /entrySource:\s*'offline_replay'/.test(fn),
      'replay must NOT overwrite the originating surface with offline_replay',
    ).toBe(false);
  });

  it('provenance never rides on the idempotency key', () => {
    // clientEventId is the dedupe contract; mixing provenance into it would make
    // a surface change look like a different event.
    expect(/cid-\$\{now\.getTime\(\)\}-\$\{Math\.random/.test(realApi)).toBe(true);
  });
});
