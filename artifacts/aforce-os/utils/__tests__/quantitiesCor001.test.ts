/**
 * COR-001 — the typed units-and-quantities layer (directive §4).
 *
 * The directive's battery: boundary validation, explicit-conversion
 * correctness, property-based cross-unit round-trips, malformed input,
 * overflow/underflow — plus the two locks that keep the layer honest:
 * a single source of conversion truth, and the saturation bug's death
 * certificate (the 0-10 scale can never read as 1.0 across the board
 * again).
 *
 * Property tests use a seeded LCG (no new dependency, deterministic —
 * Date.now/Math.random-free by design).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import {
  oz, ml, liters, lb, kg, mg, minutes, hours,
  ozToL, lToOz, mlToL, lToMl, lbToKg, kgToLb, minToHr, hrToMin, lPerHr,
  fraction01, fraction01FromScale10,
  KG_PER_LB, L_PER_OZ, OZ_PER_L, ML_PER_L, MIN_PER_HR,
} from '../quantities';

/** Deterministic LCG — same sequence every run. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

describe('COR-001 — constructors validate at the boundary', () => {
  const CONSTRUCTORS: ReadonlyArray<[string, (n: number) => number]> = [
    ['oz', oz], ['ml', ml], ['liters', liters], ['lb', lb],
    ['kg', kg], ['mg', mg], ['minutes', minutes], ['hours', hours],
  ];
  for (const [name, ctor] of CONSTRUCTORS) {
    it(`${name}: NaN, Infinity, and negative magnitudes throw`, () => {
      expect(() => ctor(Number.NaN)).toThrow(TypeError);
      expect(() => ctor(Number.POSITIVE_INFINITY)).toThrow(TypeError);
      expect(() => ctor(-1)).toThrow(RangeError);
      expect(ctor(0)).toBe(0);
    });
  }

  it('lPerHr refuses a non-positive duration', () => {
    expect(() => lPerHr(liters(1), hours(0))).toThrow(RangeError);
    expect(lPerHr(liters(3), hours(2))).toBeCloseTo(1.5, 12);
  });
});

describe('COR-001 — explicit conversions carry the canonical constants', () => {
  it('the constants are the engine-canonical values, byte-identical', () => {
    expect(KG_PER_LB).toBe(0.45359237);
    expect(L_PER_OZ).toBe(0.0295735);
    expect(OZ_PER_L).toBe(1 / 0.0295735);
  });

  it('unit conversions produce the expected values', () => {
    expect(lbToKg(lb(1))).toBeCloseTo(0.45359237, 12);
    expect(ozToL(oz(1))).toBeCloseTo(0.0295735, 12);
    expect(mlToL(ml(500))).toBeCloseTo(0.5, 12);
    expect(minToHr(minutes(90))).toBeCloseTo(1.5, 12);
  });
});

describe('COR-001 — property: cross-unit round-trips are identity within 1e-9 relative', () => {
  const PAIRS: ReadonlyArray<[string, (n: number) => number]> = [
    ['oz->L->oz', (n) => lToOz(ozToL(oz(n)))],
    ['lb->kg->lb', (n) => kgToLb(lbToKg(lb(n)))],
    ['ml->L->ml', (n) => lToMl(mlToL(ml(n)))],
    ['min->hr->min', (n) => hrToMin(minToHr(minutes(n)))],
  ];
  for (const [name, roundTrip] of PAIRS) {
    it(name, () => {
      const rand = lcg(0xc0ffee);
      for (let i = 0; i < 500; i += 1) {
        const magnitude = rand() * 10 ** Math.floor(rand() * 7); // 0 .. ~10^7
        const back = roundTrip(magnitude);
        const scale = Math.max(1, Math.abs(magnitude));
        expect(Math.abs(back - magnitude) / scale).toBeLessThan(1e-9);
      }
    });
  }
});

describe('COR-001 — overflow and underflow stay finite and ordered', () => {
  it('huge magnitudes convert without reaching Infinity', () => {
    const huge = Number.MAX_VALUE / 1e6;
    expect(Number.isFinite(ozToL(oz(huge)))).toBe(true);
    expect(Number.isFinite(lToOz(liters(huge)))).toBe(true);
    expect(Number.isFinite(kgToLb(kg(huge)))).toBe(true);
  });

  it('tiny magnitudes stay non-negative and finite', () => {
    const tiny = Number.MIN_VALUE;
    const l = ozToL(oz(tiny));
    expect(Number.isFinite(l)).toBe(true);
    expect(l).toBeGreaterThanOrEqual(0);
  });
});

describe("COR-001 — the 0-10 scale bridge (the 600 oz bug's death certificate)", () => {
  it('maps the store scale honestly: 0->0, 3->0.3, 5->0.5, 10->1', () => {
    expect(fraction01FromScale10(0)).toBe(0);
    expect(fraction01FromScale10(3)).toBeCloseTo(0.3, 12);
    expect(fraction01FromScale10(5)).toBeCloseTo(0.5, 12);
    expect(fraction01FromScale10(10)).toBe(1);
  });

  it('REGRESSION: a real-scale value no longer saturates to 1.0 (clamp01 did exactly that)', () => {
    expect(fraction01FromScale10(3)).not.toBe(1);
    expect(fraction01FromScale10(5)).not.toBe(1);
    expect(fraction01FromScale10(4)).not.toBe(1);
  });

  it('runtime junk degrades safely: clamps, never throws on finite input', () => {
    expect(fraction01FromScale10(-2)).toBe(0);
    expect(fraction01FromScale10(14)).toBe(1);
    expect(() => fraction01FromScale10(Number.NaN)).toThrow(TypeError);
    expect(() => fraction01FromScale10(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });

  it('fraction01 clamps an already-normalized factor', () => {
    expect(fraction01(0.4)).toBeCloseTo(0.4, 12);
    expect(fraction01(1.2)).toBe(1);
    expect(fraction01(-0.1)).toBe(0);
  });
});

describe('COR-001 — one source of conversion truth', () => {
  it('no stray conversion-constant literal survives outside quantities.ts', () => {
    const ROOT = resolve(__dirname, '..', '..');
    const offenders: string[] = [];
    const visit = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === '__tests__' || entry === '.expo') continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) { visit(full); continue; }
        if (!['.ts', '.tsx'].includes(extname(entry)) || entry === 'quantities.ts') continue;
        const code = readFileSync(full, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, ' ')
          .replace(/(^|[^:])\/\/.*$/gm, '$1');
        if (code.includes('0.45359237') || code.includes('0.0295735')) {
          offenders.push(full.slice(ROOT.length + 1));
        }
      }
    };
    for (const top of ['services', 'utils', 'components', 'app']) visit(join(ROOT, top));
    expect(offenders).toEqual([]);
  });
});
