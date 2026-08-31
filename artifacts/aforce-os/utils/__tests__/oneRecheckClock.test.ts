/**
 * RP-2 — ONE RECHECK CLOCK (founder ruling R2, Wave 2, 2026-08-31).
 *
 * Planted BEFORE implementation. The owner is proven from architecture:
 * `engineOutput.riskTimer` is produced inside engine-output assembly
 * (scoringEngine.ts:56 → calculateRiskTimer, copy.ts) and already drives the
 * countdown (appStoreReducer seeds timerSeconds from it), Protocol's
 * EdCanonicalClock, and the Recovery Coach window. Everything else was a
 * squatter:
 *
 *   (a) static "Recheck in N min" clauses baked into the locale values of the
 *       coach command family — five band/social actions across 11 locales plus
 *       two en-only loop keys — spoken RAW by the voice channel and rendered
 *       raw on UrineCheckScreenV2, while four screens stripped them with an
 *       ENGLISH-ONLY regex ("Vuelve a comprobar en 45 minutos." survived);
 *   (b) generateNextCycleHint's hardcoded 20/15/10/5-minute copy printed by
 *       CycleSuccessOverlay at the moment of logging, beside a countdown
 *       seeded from the real riskTimer (60/42/24/13-class values).
 *
 * The remediation REMOVES the competing authorities underneath rather than
 * hiding them: the clock sentences leave the locale data (the actual
 * authority — the plan's original "strip in copy.ts, not locales" premise
 * assumed English literals that do not exist; the deviation is deliberate and
 * documented in the PR), and the overlay states the live riskTimer minutes of
 * the SAME adapted engine output the reducer commits as the countdown — the
 * two can no longer disagree by construction.
 *
 * DELIBERATELY NOT CLOCKS (documented so a future sweep does not overreach):
 *   - coach.consequence_drop "…in the next {{minutes}} min" — a decay
 *     PROJECTION horizon, parameterized, not a recheck instruction.
 *   - voice.drink_now / drink_water_now "{{recheck}}" — parameterized from
 *     riskTimer.minutes via buildPersonaContext (canonical, not static).
 *   - coach.v2.recheck_in_progress — a status TITLE, not a clock.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const AOS = join(__dirname, '..', '..');
const LOCALES_DIR = join(AOS, 'locales');
const read = (p: string) => readFileSync(p, 'utf8');

const localeFiles = () => readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));
const localeJson = (f: string) => JSON.parse(read(join(LOCALES_DIR, f)));

/**
 * The two static-clock pattern classes, across every live locale's grammar.
 * Class 1: a number wearing a minute unit (min/minutos/Minuten/分/دقيقة…).
 * Class 2: a recheck verb-phrase carrying a bare number — "I'll recheck in
 * 15." has NO minute token and taught this law its second class.
 */
// `\+?` — the adversarial review found '30+ minutes' (all 11 locales'
// social_slow_intake_explanation) invisible to the original token: the plus
// sat between the digits and the unit. The law must see that grammar class.
const MINUTE_TOKEN =
  /\d+\s*\+?\s*(?:min(?:ute)?s?\b|minutos?\b|minuti\b|Minuten\b|минут\w*|分钟|分|분|मिनट|دقائق|دقيقة)/i;
const RECHECK_PHRASE =
  /(?:recheck in|vuelve a comprobar en|erneut prüfen in|reprends dans|ricontrolla tra|verifique novamente em)\s*\d/i;

const isClocked = (v: string) => MINUTE_TOKEN.test(v) || RECHECK_PHRASE.test(v);

/** The command family: every coach.*_action / coach.*_explanation key. */
function commandFamily(coach: Record<string, unknown>): Array<[string, string]> {
  return Object.entries(coach).filter(
    (e): e is [string, string] =>
      typeof e[1] === 'string' && (e[0].endsWith('_action') || e[0].endsWith('_explanation')),
  );
}

// ───────────────────────────── the locale data carries no static clock

describe('R2 — the coach command family is clock-free in every locale', () => {
  it('11 locales × the whole *_action/*_explanation family: no static clock clause', () => {
    const files = localeFiles();
    expect(files.length).toBe(11);
    const offenders: string[] = [];
    for (const f of files) {
      const coach = localeJson(f).coach ?? {};
      for (const [k, v] of commandFamily(coach)) {
        if (isClocked(v)) offenders.push(`${f} coach.${k} :: ${v}`);
      }
    }
    expect(offenders, `static clock clauses in command copy:\n  ${offenders.join('\n  ')}`).toEqual(
      [],
    );
  });

  it('the cleaned en command values are pinned byte-exact — re-adding ANY sentence fails', () => {
    const coach = localeJson('en.json').coach;
    // The five values the clock left, plus the untouched PEAK control.
    expect(coach.morning_action).toBe('Open a water cycle: 16 oz water + 1 stick.');
    expect(coach.balanced_action).toBe('Sip 12 oz of water now.');
    expect(coach.recovering_action).toBe('Open a water cycle: 16 oz water + 1 stick.');
    expect(coach.depleted_action).toBe('Recovery needed: 20 oz water + 2 sticks.');
    expect(coach.peak_action).toBe('Maintain. Sip 8 oz of water before your next session.');
    // The pacing cue survives; only its static number leaves (safety substance
    // preserved — the WHEN belongs to the canonical timer, the HOW stays).
    expect(coach.social_drink_water_action).toBe('Sip 12 ounces of water now. Then pace your next drink.');
    expect(coach.social_recovery_loop_action).toBe('Start with water — 20 oz now.');
    expect(coach.social_recovery_loop_explanation).toBe(
      'Recovery window is open. Ease in — 20 oz now keeps you ahead.',
    );
    // The review-found twin: the pacing-education line loses its static
    // number the same way its sibling action did.
    expect(coach.social_slow_intake_explanation).toBe(
      'Spacing your drinks keeps the rhythm steady and the morning clean.',
    );
  });
});

// ───────────────────────────── executed: the assembly is clock-free

// copy.ts → services/i18nService → react-native, which vitest can't collect.
// Stub ONLY the plumbing: `t` resolves against the REAL locale JSON with the
// active test locale + en fallback and {{param}} interpolation — so this law
// executes the real generateCommand over the real locale data.
let activeLocale = 'en';
vi.mock('../../services/i18nService', () => ({
  default: {
    t: (key: string, params?: Record<string, unknown>) => {
      const resolve = (loc: string): unknown =>
        key.split('.').reduce<unknown>((acc, part) => {
          if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
          return undefined;
        }, JSON.parse(readFileSync(join(__dirname, '..', '..', 'locales', `${loc}.json`), 'utf8')));
      const raw = resolve(activeLocale) ?? resolve('en');
      let out = typeof raw === 'string' ? raw : key;
      for (const [p, v] of Object.entries(params ?? {})) {
        out = out.split(`{{${p}}}`).join(String(v));
      }
      return out;
    },
  },
}));

import { generateCommand } from '../scoring/copy';

describe('R2 — executed: every band command assembles clock-free in every locale', () => {
  const baseState = {
    overnightLossOz: 0,
    hasSeenMorningCommand: true,
    lastIntakeTime: new Date(),
    isSnoozed: false,
    complianceStreak: 0,
    heatIndex: 0,
    sleepHours: 8,
  } as never;
  const morningState = { ...(baseState as object), overnightLossOz: 12, hasSeenMorningCommand: false } as never;

  it('four bands + the morning command, all 11 locales', () => {
    const offenders: string[] = [];
    for (const f of localeFiles()) {
      activeLocale = f.replace('.json', '');
      for (const level of ['PEAK', 'BALANCED', 'RECOVERING', 'DEPLETED'] as const) {
        const cmd = generateCommand(level, baseState, 75, null);
        for (const text of [cmd.action, cmd.explanation ?? '']) {
          if (isClocked(text)) offenders.push(`${activeLocale} ${level} :: ${text}`);
        }
      }
      const morning = generateCommand('BALANCED', morningState, 75, null);
      if (isClocked(morning.action)) offenders.push(`${activeLocale} morning :: ${morning.action}`);
    }
    activeLocale = 'en';
    expect(offenders, `assembled commands still carry a clock:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });
});

// ───────────────────────────── the overlay speaks the canonical timer

describe('R2 — the post-log overlay clock IS the committed riskTimer', () => {
  const ACTIONS = () => read(join(AOS, 'store', 'app', 'actions.ts'));
  const OVERLAY = () => read(join(AOS, 'components', 'CycleSuccessOverlay.tsx'));
  const TYPES = () => read(join(AOS, 'types', 'index.ts'));

  it('CycleResult carries the timer MINUTES, not a pre-rendered hint string', () => {
    expect(TYPES()).toMatch(/nextCheckMinutes:\s*number/);
    expect(TYPES()).not.toMatch(/nextCycleHint/);
  });

  it('actions.ts derives the minutes from the SAME adapted engine output the reducer commits', () => {
    const src = ACTIONS();
    // Initial build: from the server-returned engine output.
    expect(src).toContain('nextCheckMinutes: engineOutput.riskTimer.minutes');
    // Merge path: adaptEngineOutput may LENGTHEN riskTimer.minutes, and the
    // reducer seeds the countdown from the ADAPTED object — so the overlay
    // must read the adapted minutes or the two clocks diverge one layer down.
    expect(src).toMatch(/const adapted = adaptEngineOutput\(mergedEngine\)/);
    expect(src).toContain('result.nextCheckMinutes = adapted.riskTimer.minutes');
    expect(src).toMatch(/engineOutput:\s*adapted[,\s]/);
    // The competing authority is not consulted at all.
    expect(src).not.toContain('generateNextCycleHint');
  });

  it('the overlay renders the minutes through the localized key — no baked string', () => {
    const src = OVERLAY();
    expect(src).toContain("t('coach.next_check', { minutes: result.nextCheckMinutes })");
    expect(src).not.toContain('nextCycleHint');
  });

  it('coach.next_check exists in all 11 locales and interpolates the live minutes', () => {
    for (const f of localeFiles()) {
      const v = localeJson(f).coach?.next_check;
      expect(v, `${f} coach.next_check`).toBeTruthy();
      expect(v, `${f} must interpolate — a static number here recreates the defect`).toContain(
        '{{minutes}}',
      );
      expect(MINUTE_TOKEN.test(v), `${f} must not bake digits into the clock line`).toBe(false);
    }
  });
});

// ───────────────────────────── the squatter is dead

describe('R2 — generateNextCycleHint has zero consumers', () => {
  it('the identifier survives ONLY in copy.ts (definition) and the off-limits scoringEngine re-export', () => {
    // scoringEngine.ts is off-limits (CLAUDE.md): its import/re-export line is
    // left in place, unconsumed, flagged for founder removal. Nothing else may
    // reference the hint — the overlay data path now carries minutes.
    const ALLOWED = new Set(['utils/scoring/copy.ts', 'utils/scoringEngine.ts']);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        if (name.name.startsWith('.') || name.name === 'node_modules' || name.name === '__tests__') continue;
        const full = join(dir, name.name);
        if (name.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name.name)) {
          const rel = relative(AOS, full);
          if (ALLOWED.has(rel)) continue;
          if (read(full).includes('generateNextCycleHint')) offenders.push(rel);
        }
      }
    };
    walk(AOS);
    expect(offenders, `generateNextCycleHint is still consumed by:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });
});
