import { describe, expect, it } from 'vitest';

import type { CoachArchetype } from '@/services/voiceCatalog';
import {
  ALL_GENERIC_STATEMENT_IDS,
  dedupeIds,
  laterDayKey,
  mergeRecentlyUsed,
  RECENT_USED_CAP,
  selectDataDrivenStatement,
  selectGenericStatement,
  selectPerformanceStatement,
  statementI18nKey,
  type SelectStatementInput,
} from '../performanceStatements';
import en from '../../locales/en.json';
import es from '../../locales/es.json';
import fr from '../../locales/fr.json';
import de from '../../locales/de.json';
import pt from '../../locales/pt.json';
import itLocale from '../../locales/it.json';

const ARCHETYPES: readonly CoachArchetype[] = [
  'push',
  'precision',
  'ignite',
  'recovery',
];

function input(
  archetype: CoachArchetype,
  recentlyUsedIds: readonly string[] = [],
): SelectStatementInput {
  return {
    archetype,
    recentlyUsedIds,
    signals: { recovery: null, recoveryTrend: null, complianceStreak: 0 },
  };
}

describe('selectGenericStatement', () => {
  it('returns an archetype-appropriate descriptor for every archetype', () => {
    for (const archetype of ARCHETYPES) {
      const d = selectGenericStatement(input(archetype));
      expect(d).not.toBeNull();
      expect(d?.kind).toBe('generic');
      expect(d?.id.startsWith(`${archetype}.`)).toBe(true);
      expect(d?.i18nKey).toBe(statementI18nKey(d!.id));
    }
  });

  it('skips recently-used ids (de-duplication)', () => {
    const d = selectGenericStatement(input('push', ['push.1']));
    expect(d?.id).toBe('push.2');
  });

  it('rotates deterministically across consecutive days', () => {
    // Simulate the service prepending each spoken id to a most-recent-first list.
    let recent: string[] = [];
    const picked: string[] = [];
    for (let day = 0; day < 4; day++) {
      const d = selectGenericStatement(input('push', recent));
      picked.push(d!.id);
      recent = [d!.id, ...recent];
    }
    // First three days exhaust the pool in order, day 4 avoids repeating day 3.
    expect(picked.slice(0, 3)).toEqual(['push.1', 'push.2', 'push.3']);
    expect(picked[3]).not.toBe('push.3');
  });

  it('never repeats the single most-recent line when the pool is exhausted', () => {
    const d = selectGenericStatement(
      input('ignite', ['ignite.3', 'ignite.2', 'ignite.1']),
    );
    expect(d?.id).not.toBe('ignite.3');
  });
});

describe('selectDataDrivenStatement', () => {
  it('is inert in V1 — never fabricates a personalised claim', () => {
    for (const archetype of ARCHETYPES) {
      expect(
        selectDataDrivenStatement({
          ...input(archetype),
          signals: { recovery: 99, recoveryTrend: 'rising', complianceStreak: 30 },
        }),
      ).toBeNull();
    }
  });
});

describe('selectPerformanceStatement', () => {
  it('falls back to a generic line while the data path is inert', () => {
    const d = selectPerformanceStatement(input('precision'));
    expect(d?.kind).toBe('generic');
    expect(d?.id.startsWith('precision.')).toBe(true);
  });
});

describe('recently-used helpers', () => {
  it('dedupes preserving most-recent-first order', () => {
    expect(dedupeIds(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c']);
  });

  it('drops empty / non-string ids', () => {
    expect(dedupeIds(['a', '', 'b'])).toEqual(['a', 'b']);
  });

  it('merges in-memory before disk, deduping and capping', () => {
    const merged = mergeRecentlyUsed(['x'], ['x', 'y', 'z']);
    expect(merged).toEqual(['x', 'y', 'z']);
  });

  it('caps the merged list', () => {
    const a = ['a0', 'a1', 'a2', 'a3', 'a4'];
    const b = ['b0', 'b1', 'b2', 'b3', 'b4'];
    expect(mergeRecentlyUsed(a, b).length).toBe(RECENT_USED_CAP);
  });

  it('laterDayKey returns the later key, null-safe', () => {
    expect(laterDayKey('2026-06-20', '2026-06-21')).toBe('2026-06-21');
    expect(laterDayKey('2026-06-21', '2026-06-20')).toBe('2026-06-21');
    expect(laterDayKey(null, '2026-06-21')).toBe('2026-06-21');
    expect(laterDayKey('2026-06-21', null)).toBe('2026-06-21');
    expect(laterDayKey(null, null)).toBeNull();
  });
});

describe('i18n coverage', () => {
  const locales: Record<string, Record<string, unknown>> = {
    en,
    es,
    fr,
    de,
    pt,
    it: itLocale,
  };

  it('every generic id has spoken copy in all six launch locales', () => {
    for (const [name, bundle] of Object.entries(locales)) {
      const ns = bundle['performanceStatements'] as
        | Record<string, unknown>
        | undefined;
      expect(ns, `${name}.json is missing performanceStatements`).toBeDefined();
      for (const id of ALL_GENERIC_STATEMENT_IDS) {
        // ids are dotted ('push.1'); the namespace nests by archetype.
        const [archetype, variant] = id.split('.');
        const group = ns?.[archetype] as Record<string, unknown> | undefined;
        const line = group?.[variant];
        expect(
          typeof line === 'string' && line.length > 0,
          `${name}.json missing performanceStatements.${id}`,
        ).toBe(true);
      }
    }
  });
});
