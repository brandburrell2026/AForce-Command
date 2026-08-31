/**
 * RP-3 — ONE HYDRATION ACTION (founder ruling, Wave 3, 2026-08-31).
 *
 * Planted BEFORE implementation. The architectural law:
 *
 *   Moments owns context. RecoveryCommand owns the hydration action.
 *
 * The E7 reproduction (executed, not inferred): the BALANCED member state
 * renders the canonical "Sip 12 oz of water now." on HomeScreenV2's command
 * card while, one card below in the same viewport, NextMomentCard says
 * "DO THIS NOW · Hydrate 14 oz" — MOMENT_HYDRATE_OZ.work[0], a parallel
 * dose authority computed blind to the command, for every member state.
 *
 * The remediation removes the parallel authority underneath, not the string:
 *  - MOMENT_HYDRATE_OZ is DELETED (its only production importer was the
 *    recommendation engine's dose path);
 *  - a Moment's hydration action is a VERBATIM MIRROR of the guarded
 *    canonical command, passed in as MomentSignals.canonicalCommand by the
 *    callers that hold the guarded engine slice;
 *  - with no eligible canonical command, a Moment renders NO hydration
 *    action — silence is valid, and the hydrate ritual stage is omitted;
 *  - the guard's degrade path no longer mints "Hydrate — water first"
 *    (a Moment-originated hydration action): a blocked mirror is DROPPED;
 *  - scheduled OS notifications are CONTEXT-ONLY (prep window, timing) —
 *    a body frozen at schedule time cannot track the live command, so it
 *    carries no hydration action at all.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { buildRecommendation } from '@/services/momentRecommendation';
import { guardMomentRecommendation } from '@/utils/intelligence/decisionGuard';
import { planMomentNotifications, DEFAULT_MOMENT_NOTIFY_PREFS } from '@/services/momentNotifications';
import type { Moment, MomentType } from '@/types/moments';

const AOS = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(AOS, p), 'utf8');

const TYPES: MomentType[] = ['work', 'performance', 'training', 'travel', 'recovery', 'personal'];
const NOW = '2026-08-31T12:00:00.000Z';
const IN_45_MIN = '2026-08-31T12:45:00.000Z';

const moment = (type: MomentType, over: Partial<Moment> = {}): Moment =>
  ({
    id: `m-${type}`,
    source: 'manual',
    title: 'Focus block',
    type,
    importance: 'high',
    startAtIso: IN_45_MIN,
    ...over,
  }) as Moment;

/** The canonical guarded command, as callers mirror it. */
const CMD = { id: 'cmd-balanced', action: 'Sip 12 oz of water now.' };
const CMD_B = { id: 'cmd-depleted', action: 'Recovery needed: 20 oz water + 2 sticks.' };

const OZ_TOKEN = /\d+\s*oz\b/i;

// ─────────────────────────── the parallel authority is gone

describe('R-P3 — the parallel dose authority is removed, not hidden', () => {
  it('MOMENT_HYDRATE_OZ no longer exists anywhere in the source tree', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(join(AOS, dir))) {
        if (name.startsWith('.') || name === 'node_modules' || name === '__tests__') continue;
        const rel = join(dir, name);
        if (statSync(join(AOS, rel)).isDirectory()) walk(rel);
        else if (/\.(ts|tsx)$/.test(name) && read(rel).includes('MOMENT_HYDRATE_OZ')) {
          offenders.push(rel);
        }
      }
    };
    walk('.');
    expect(offenders, `the dose table survives in:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });

  it('no moments module carries a literal oz dose in source', () => {
    const dirs = ['components/moments', 'components/editorial/moments'];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(join(AOS, dir))) {
        if (name.startsWith('.') || name === '__tests__') continue;
        const rel = join(dir, name);
        if (statSync(join(AOS, rel)).isDirectory()) walk(rel);
        else if (/\.(ts|tsx)$/.test(name)) files.push(rel);
      }
    };
    dirs.forEach(walk);
    for (const f of ['services/momentRecommendation.ts', 'services/momentNotifications.ts']) files.push(f);
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/[^\n]*/g, '$1');
    for (const f of files) {
      expect(strip(read(f)), `${f} — a Moment may not author a dose`).not.toMatch(/\b\d+\s?oz\b/i);
    }
  });
});

// ─────────────────────────── the mirror

describe('R-P3 — a Moment hydration action is a verbatim mirror of the canonical command', () => {
  it('every MomentType mirrors the SAME command byte-exact — type cannot change the dose', () => {
    for (const type of TYPES) {
      const rec = buildRecommendation(moment(type), { canonicalCommand: CMD }, NOW);
      expect(rec.primaryAction, `${type} must mirror`).toBeTruthy();
      expect(rec.primaryAction!.labelParams?.action, `${type}`).toBe(CMD.action);
      // The mirror carries NO independent quantity fields.
      expect(rec.primaryAction!.labelParams?.oz).toBeUndefined();
      expect(rec.primaryAction!.labelParams?.ozMin).toBeUndefined();
      expect(rec.primaryAction!.labelParams?.ozMax).toBeUndefined();
      const hydrate = rec.ritual.find((s) => s.key === 'hydrate');
      expect(hydrate, `${type} ritual mirrors the same command`).toBeTruthy();
      expect(hydrate!.instructionParams?.action).toBe(CMD.action);
    }
  });

  it('the canonical command changing propagates — nothing is retained', () => {
    const a = buildRecommendation(moment('work'), { canonicalCommand: CMD }, NOW);
    const b = buildRecommendation(moment('work'), { canonicalCommand: CMD_B }, NOW);
    expect(a.primaryAction!.labelParams?.action).toBe(CMD.action);
    expect(b.primaryAction!.labelParams?.action).toBe(CMD_B.action);
  });

  it('the E7 reproduction is impossible: the work moment says exactly what Home says', () => {
    // The original case: Home "Sip 12 oz of water now." beside Moments
    // "Hydrate 14 oz". Post-RP-3 the moment action IS the command.
    const rec = buildRecommendation(moment('work'), { canonicalCommand: CMD }, NOW);
    const rendered = String(rec.primaryAction!.labelParams?.action);
    expect(rendered).toBe('Sip 12 oz of water now.');
    expect(rendered).not.toContain('14');
    expect(JSON.stringify(rec)).not.toContain('14 oz');
  });

  it('a Moment cannot originate a hydration quantity: no command → no hydration action', () => {
    for (const type of TYPES) {
      const rec = buildRecommendation(moment(type), {}, NOW);
      expect(rec.primaryAction, `${type} must stay silent`).toBeUndefined();
      expect(rec.ritual.some((s) => s.key === 'hydrate'), `${type} ritual omits hydrate`).toBe(false);
      expect(JSON.stringify(rec)).not.toMatch(OZ_TOKEN);
    }
  });

  it('the electrolytes secondary is gone — a product-class recommendation was Moment-minted', () => {
    const rec = buildRecommendation(moment('training'), { canonicalCommand: CMD }, NOW);
    expect(rec.secondaryAction?.kind).not.toBe('electrolytes');
    // travel keeps breathe — context, not hydration.
    const travel = buildRecommendation(moment('travel'), { canonicalCommand: CMD }, NOW);
    expect(travel.secondaryAction?.kind).toBe('breathe');
  });

  it('one clock: the mirror carries no recheck clause in any form', () => {
    const MINUTE_TOKEN =
      /\d+\s*\+?\s*(?:min(?:ute)?s?\b|minutos?\b|minuti\b|Minuten\b|分钟|분|मिनट)/i;
    const rec = buildRecommendation(moment('work'), { canonicalCommand: CMD }, NOW);
    expect(MINUTE_TOKEN.test(String(rec.primaryAction!.labelParams?.action))).toBe(false);
    expect(/recheck in\s*\d/i.test(JSON.stringify(rec))).toBe(false);
  });
});

// ─────────────────────────── the guard on the mirror

describe('R-P3 — the Decision Guard judges the mirrored TEXT, and a blocked mirror is silence', () => {
  it('a dose-modifying fake "command" is dropped — never rewritten into a Moment-minted action', () => {
    const rec = buildRecommendation(
      moment('work'),
      { canonicalCommand: { id: 'evil', action: 'Add 20% to your intake.' } },
      NOW,
    );
    const { rec: guarded, result } = guardMomentRecommendation(rec);
    expect(result.verdict).toBe('blocked');
    expect(guarded.primaryAction, 'blocked mirror → silence, not fallback copy').toBeUndefined();
    expect(guarded.ritual.some((s) => s.key === 'hydrate')).toBe(false);
    expect(JSON.stringify(guarded)).not.toContain('water first');
  });

  it('the genuine guarded command is a fixed point — approved by reference', () => {
    const rec = buildRecommendation(moment('work'), { canonicalCommand: CMD }, NOW);
    const { rec: guarded, result } = guardMomentRecommendation(rec);
    expect(result.verdict).toBe('approved');
    expect(guarded).toBe(rec);
  });

  it('the source seam derives the mirror from the GUARDED engine slice', () => {
    const src = read('components/moments/useMomentsData.ts');
    expect(src).toMatch(/canonicalCommand/);
    expect(src).toMatch(/engine\.command/);
  });
});

// ─────────────────────────── notifications are context-only

describe('R-P3 — scheduled notifications carry context, never a hydration action', () => {
  it('planned notification params carry no action and no oz', () => {
    const planned = planMomentNotifications(
      [moment('work'), moment('training', { id: 'm-t', startAtIso: '2026-08-31T15:00:00.000Z' })],
      DEFAULT_MOMENT_NOTIFY_PREFS,
      NOW,
    );
    expect(planned.length).toBeGreaterThan(0);
    for (const p of planned) {
      const blob = JSON.stringify(p);
      expect(blob, 'no oz in scheduled copy').not.toMatch(OZ_TOKEN);
      expect(blob).not.toMatch(/hydrate_exact|hydrate_range|actionKey/);
    }
  });
});

// ─────────────────────────── Wave-3 review: the mirror carries NO deadline

describe('R-P3 review — the mirror is not re-qualified with a Moment-authored deadline', () => {
  // Adversarial finding: primaryActionFor attached bestBeforeIso (the
  // Moment's own prep-window midpoint) to the MIRRORED action, and every
  // surface rendered it as "Best before {{time}}" directly under the
  // command text — a Moment-authored timing claim laid over whatever the
  // command says. Executed against a real Social Mode safety command, this
  // produced "Please don't drive. Use a rideshare or call a friend." /
  // "Best before 5:15 PM" — the do-not-drive instruction was given an
  // expiry the command authority never gave it. RP-3 declares timing
  // unchangeable; the prep-window row (rendered separately, always) already
  // carries the Moment's own timing context.
  const SAFETY_CMD = {
    id: 'cmd-social-do-not-drive',
    action: "Please don't drive. Use a rideshare or call a friend.",
  };

  it('the mirrored primaryAction never carries bestBeforeIso — for any command, including safety commands', () => {
    for (const cmd of [CMD, CMD_B, SAFETY_CMD]) {
      const rec = buildRecommendation(moment('work'), { canonicalCommand: cmd }, NOW);
      expect(rec.primaryAction, cmd.id).toBeTruthy();
      expect(rec.primaryAction!.bestBeforeIso, `${cmd.id} must carry no deadline`).toBeUndefined();
    }
  });

  it('no surface can render "Best before" beside a mirrored command — the field does not exist to render', () => {
    const rec = buildRecommendation(moment('work'), { canonicalCommand: SAFETY_CMD }, NOW);
    expect(JSON.stringify(rec)).not.toMatch(/bestBeforeIso/);
  });
});

// ─────────────────────────── anti-evasion: no renamed/re-unit'd dose table

describe('R-P3 review — structural guard against a renamed or re-unit\'d dose table', () => {
  // The oz-literal source scan is real but narrow (it matches digit+"oz").
  // A regression could reintroduce a per-MomentType dose table under a
  // different name or unit (e.g. MOMENT_HYDRATE_ML) and evade it entirely.
  // This law is structural, not lexical: exactly ONE Record<MomentType, …>
  // export may exist in the config, and it must be the prep-window table —
  // context, not dose.
  it('hydroStateModel.ts exports exactly one Record<MomentType, …> table', () => {
    const src = read('config/hydroStateModel.ts');
    const matches = [...src.matchAll(/export const (\w+):\s*Record<\s*MomentType,/g)].map(
      (m) => m[1],
    );
    expect(matches, `MomentType-keyed exports:\n  ${matches.join('\n  ')}`).toEqual([
      'MOMENT_PREP_WINDOW_MIN',
    ]);
  });
});
