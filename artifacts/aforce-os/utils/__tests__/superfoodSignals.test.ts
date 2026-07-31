import { describe, it, expect } from 'vitest';
import {
  AFORCE_POSITIONING,
  allSuperfoodCopy,
  buildSuperfoodSignalsBlock,
  SODIUM_BALANCE_NOTE,
  SUPERFOOD_LEARN_CTA,
  SUPERFOOD_SIGNALS_HEADER,
  superfoodEducationEntries,
  superfoodSignalsList,
} from '../superfoodSignals';

describe('Superfood Signals — canonical strings', () => {
  it('exposes the exact header / CTA / positioning / sodium note', () => {
    expect(SUPERFOOD_SIGNALS_HEADER).toBe('SUPERFOOD SIGNALS ACTIVE');
    expect(SUPERFOOD_LEARN_CTA).toBe('TAP TO LEARN WHY');
    expect(AFORCE_POSITIONING).toBe(
      'Balanced hydration support with mineral-rich superfoods designed to support recovery, hydration efficiency, and performance.',
    );
    expect(SODIUM_BALANCE_NOTE).toBe('Hydration requires balance, not just sodium loading.');
  });
});

describe('Superfood Signals — chip list', () => {
  it('returns the five required signal chips in stable order', () => {
    const labels = superfoodSignalsList().map((s) => s.label);
    expect(labels).toEqual([
      'Mineral Support',
      'Recovery Support',
      'Electrolyte Efficiency',
      'Mineral + Hydration Support',
      'Performance Support',
    ]);
  });

  it('keys are stable machine ids for telemetry', () => {
    const keys = superfoodSignalsList().map((s) => s.key);
    expect(keys).toEqual([
      'mineralSupport',
      'recoverySupport',
      'electrolyteEfficiency',
      'cellularHydrationSupport',
      'performanceSupport',
    ]);
  });
});

describe('Superfood Signals — education layer', () => {
  it('covers seamoss, dulse, chlorella, mineral support, balanced hydration support', () => {
    const keys = superfoodEducationEntries().map((e) => e.key);
    expect(keys).toEqual([
      'seamoss',
      'dulse',
      'chlorella',
      'mineralSupport',
      'balancedHydrationSupport',
    ]);
  });

  it('every entry has a title and a non-empty body', () => {
    for (const entry of superfoodEducationEntries()) {
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.body.length).toBeGreaterThan(20);
    }
  });
});

describe('buildSuperfoodSignalsBlock — gating', () => {
  it('returns null for non-AForce scans', () => {
    expect(buildSuperfoodSignalsBlock({ isAForce: false })).toBeNull();
  });

  it('returns the full block for AForce scans', () => {
    const block = buildSuperfoodSignalsBlock({ isAForce: true });
    expect(block).not.toBeNull();
    expect(block!.header).toBe(SUPERFOOD_SIGNALS_HEADER);
    expect(block!.learnCta).toBe(SUPERFOOD_LEARN_CTA);
    expect(block!.positioning).toBe(AFORCE_POSITIONING);
    expect(block!.sodiumNote).toBe(SODIUM_BALANCE_NOTE);
    expect(block!.signals).toHaveLength(5);
    expect(block!.education).toHaveLength(5);
  });
});

describe('Superfood Signals — compliant-language guarantee', () => {
  // Hard regression: every user-facing string this module emits is
  // scanned for banned words. Add a new copy string? It must flow
  // through `allSuperfoodCopy()` so this gate covers it.
  const BANNED = [
    'cure', 'cures', 'cured',
    'treat', 'treats', 'treated', 'treatment',
    'prevent disease', 'prevents disease', 'prevent diseases',
    'diagnose', 'diagnoses', 'diagnosis',
    'heal', 'heals', 'healed',
    'fixes', 'fix your',
    'eliminate symptoms', 'eliminates symptoms',
    'fda approved', 'medical grade',
  ];

  it('NEVER uses cures / treats / prevents-disease wording in any emitted string', () => {
    for (const line of allSuperfoodCopy()) {
      const lower = line.toLowerCase();
      for (const word of BANNED) {
        expect(lower, `"${line}" must not contain "${word}"`).not.toContain(word);
      }
    }
  });

  it('uses compliant verbs (supports / assists / may help / contributes to) somewhere in the education layer', () => {
    const allBody = superfoodEducationEntries()
      .map((e) => e.body.toLowerCase())
      .join(' ');
    // At least one compliant verb must appear across the education
    // surface — this is the actual product-mandated framing.
    const compliantHits = [
      allBody.includes('support'),
      allBody.includes('assist'),
      allBody.includes('may help'),
      allBody.includes('contributes to'),
    ].filter(Boolean).length;
    expect(compliantHits).toBeGreaterThanOrEqual(1);
  });

  it('NEVER frames sodium as bad — sodium copy is balance-focused', () => {
    const sodiumLines = allSuperfoodCopy().filter((s) => s.toLowerCase().includes('sodium'));
    expect(sodiumLines.length).toBeGreaterThan(0);
    for (const line of sodiumLines) {
      const lower = line.toLowerCase();
      // The framing is always about BALANCE, never about sodium being
      // harmful, toxic, excessive, or something to avoid.
      for (const banned of ['bad', 'toxic', 'harmful', 'avoid', 'too much', 'excess', 'dangerous']) {
        expect(lower, `"${line}" must not frame sodium as ${banned}`).not.toContain(banned);
      }
      expect(lower).toContain('balance');
    }
  });
});
