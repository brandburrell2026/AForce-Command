// @vitest-environment happy-dom
/**
 * `JournalDayCard` on a day HydroState never observed.
 *
 * WHY THIS FILE EXISTS. The adversarial gate rendered this card with an
 * intake-only rollup and read back, under the heading "0 snapshots · 3
 * intakes", four fabricated measurements: "0 oz · 0 units · 0 mg sodium in ·
 * 0 mg sodium lost". The score above them was correctly withheld as an
 * em-dash, which made it worse — the card looked like it was being careful.
 * "0 mg sodium lost" is a physiological claim about a day nothing was
 * measured, and it is the same harm the PDF export withholds one file over.
 *
 * TWO THINGS MAKE THIS LAW HARD TO FOOL. The rollups are produced by the REAL
 * server aggregation (`buildJournalRollupsResponse`) rather than hand-built,
 * so a fixture cannot drift from the wire it claims to represent. And a
 * CONTROL day is rendered alongside — a day with a genuine snapshot whose
 * measured values really are zero — because the card must still print those
 * zeros. A measured 0 and an absent measurement are different facts, and
 * withholding both would be its own defect.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import en from '../../../locales/en.json';

vi.mock('@/components/Icon', () => ({ Icon: () => null }));
vi.mock('../Icon', () => ({ Icon: () => null }));
vi.mock('@/services/haptics', () => ({ hapticSelection: () => {} }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => {
      const flat = k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)?.[p], en);
      return typeof flat === 'string' ? flat : k;
    },
  }),
}));

import JournalDayCard from '../JournalDayCard';
import { buildJournalRollupsResponse } from '../../../../api-server/src/lib/journalRollupsAggregation';

const NOW = new Date('2026-09-02T12:00:00.000Z');

/** REAL server output for: 3 intakes on a day HydroState never captured. */
function wireRows(dense: boolean) {
  return buildJournalRollupsResponse({
    snapshots: [],
    intakes: [0, 1, 2].map((i) => ({
      id: `x${i}`, loggedAt: new Date(`2026-08-27T1${i}:00:00.000Z`),
      fluidType: 'WATER', ozAmount: 12, scoreBefore: 0, scoreAfter: 0,
    })) as never,
    correctionRows: [],
    historyStartAt: new Date('2026-06-01T00:00:00.000Z'),
    days: 7, dense, now: NOW,
  }).rollups;
}

/** CONTROL: a day with ONE real snapshot whose measured values are truly 0. */
function controlRow() {
  return buildJournalRollupsResponse({
    snapshots: [{
      capturedAt: new Date('2026-08-27T09:00:00.000Z'), score: 72, level: 'BALANCED',
      ozConsumedToday: 0, aforceUnitsToday: 0, unitsConsumedToday: 0,
      sodiumDeliveredMg: 0, sodiumLostMg: 0, deficitPct: 0,
      autopilotActive: false, socialActive: false, hydroStateModelVersion: 'hydrostate-v1.0',
    }] as never,
    intakes: [0, 1, 2].map((i) => ({
      id: `y${i}`, loggedAt: new Date(`2026-08-27T1${i}:00:00.000Z`),
      fluidType: 'WATER', ozAmount: 12, scoreBefore: 0, scoreAfter: 0,
    })) as never,
    correctionRows: [], historyStartAt: new Date('2026-06-01T00:00:00.000Z'),
    days: 7, dense: false, now: NOW,
  }).rollups.find((r) => r.date === '2026-08-27')!;
}

let host: HTMLElement;
let root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); });
afterEach(() => {
  // Guarded: not every law renders (the wire anti-vacuity check does not), and
  // an unconditional unmount made that test fail for a reason unrelated to
  // what it asserts.
  if (root) flushSync(() => root.unmount());
  root = undefined as unknown as Root;
  host.remove();
});

/** Labels carry regex metacharacters — "Sodium in (mg)". */
const esc = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function renderExpanded(rollup: unknown) {
  root = createRoot(host);
  flushSync(() => root.render(React.createElement(JournalDayCard, { rollup } as never)));
  const collapsed = (host.textContent ?? '').replace(/\s+/g, ' ').trim();
  const press = host.querySelector('[role="button"]') ?? host.firstElementChild?.firstElementChild ?? host.firstElementChild;
  flushSync(() => (press as HTMLElement)?.click());
  const expanded = (host.textContent ?? '').replace(/\s+/g, ' ').trim();
  return { collapsed, expanded };
}

describe('JournalDayCard withholds what was never measured', () => {
  const unobservedRow = () => wireRows(true).find((r) => r.date === '2026-08-27')!;
  const LABELS = [
    en.journal.day_card_oz, en.journal.day_card_aforce,
    en.journal.day_card_sodium_in, en.journal.day_card_sodium_lost,
  ];

  it('ANTI-VACUITY: the wire really does carry sentinel zeros on that day', () => {
    // If the aggregation ever stopped emitting them, this whole file would be
    // testing a case that no longer exists.
    const r = unobservedRow();
    expect(r.snapshotsCount).toBe(0);
    expect(r.intakeCount).toBe(3);
    expect([r.endOzConsumed, r.endAforceUnits, r.endSodiumDelivered, r.endSodiumLost])
      .toEqual([0, 0, 0, 0]);
  });

  it('every snapshot-derived row reads as no-reading, not as zero', () => {
    const { expanded } = renderExpanded(unobservedRow());
    for (const label of LABELS) {
      expect(expanded, `"${label}" must still be listed`).toContain(label);
      // The label is present; the VALUE beside it must not be a fabricated 0.
      expect(expanded).not.toMatch(new RegExp(`${esc(label)}\\s*0(?![.\\d])`));
    }
    expect(expanded).toContain('—');
  });

  it('the intake count is still reported — it is the one fact that IS known', () => {
    // Sourced from the intake table, not from a snapshot. Withholding it
    // would erase the member's actual participation.
    const { collapsed } = renderExpanded(unobservedRow());
    expect(collapsed).toMatch(/0 snapshots · 3 intakes/);
  });

  it('CONTROL: a day with a real snapshot whose values ARE zero still prints them', () => {
    // The distinction the whole fix rests on. Suppressing these too would
    // make a measured zero indistinguishable from an absent measurement in
    // the other direction, which is the same defect mirrored.
    const { expanded } = renderExpanded(controlRow());
    for (const label of LABELS) {
      expect(expanded, `"${label}" must print its measured 0`).toMatch(
        new RegExp(`${esc(label)}\\s*0`),
      );
    }
    // ...and its score is a real number, not an em-dash.
    expect(expanded).toMatch(/72/);
  });
});
