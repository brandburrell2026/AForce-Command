/**
 * Black Issue Protocol — pure presentation helpers (masthead day, signals
 * clock, recheck numeral). The screen is a store-connected container this
 * suite never mounts; what it renders from these helpers is decided here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { formatMastheadDay, formatSignalsClock, recheckDisplay } from '../protocolV3Presentation';

const PKG = join(__dirname, '..', '..', '..');
const SRC = readFileSync(join(PKG, 'components', 'protocol', 'ProtocolScreenV2.tsx'), 'utf8');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
const EN = JSON.parse(readFileSync(join(PKG, 'locales', 'en.json'), 'utf8')) as {
  protocol: { v3: Record<string, string> };
};

describe('formatMastheadDay', () => {
  it('formats weekday, month and day without the locale comma', () => {
    // Noon UTC keeps the calendar day stable across any host timezone.
    const noon = Date.UTC(2026, 7, 29, 12, 0, 0);
    expect(formatMastheadDay(noon, 'en-US')).toBe('Sat Aug 29');
  });

  it('falls back to en-US for an unusable locale tag instead of throwing', () => {
    const noon = Date.UTC(2026, 7, 29, 12, 0, 0);
    expect(() => formatMastheadDay(noon, 'not a locale')).not.toThrow();
  });
});

describe('formatSignalsClock', () => {
  it('returns null for an absent, zero, negative or non-finite stamp', () => {
    expect(formatSignalsClock(null, 'en-US')).toBeNull();
    expect(formatSignalsClock(undefined, 'en-US')).toBeNull();
    expect(formatSignalsClock(0, 'en-US')).toBeNull();
    expect(formatSignalsClock(-5, 'en-US')).toBeNull();
    expect(formatSignalsClock(Number.NaN, 'en-US')).toBeNull();
  });

  it('formats a real stamp as a wall-clock time', () => {
    const out = formatSignalsClock(Date.UTC(2026, 7, 29, 16, 41), 'en-US');
    expect(out).toMatch(/\d{1,2}:41/);
  });
});

describe('recheckDisplay', () => {
  it('reads in minutes under two hours', () => {
    expect(recheckDisplay(45)).toEqual({ value: 45, unit: 'min' });
    expect(recheckDisplay(119)).toEqual({ value: 119, unit: 'min' });
  });

  it('reads in hours from two hours up, rounded', () => {
    expect(recheckDisplay(120)).toEqual({ value: 2, unit: 'hr' });
    expect(recheckDisplay(300)).toEqual({ value: 5, unit: 'hr' });
  });

  it('never goes negative or non-finite', () => {
    expect(recheckDisplay(-10)).toEqual({ value: 0, unit: 'min' });
    expect(recheckDisplay(Number.NaN)).toEqual({ value: 0, unit: 'min' });
  });
});

describe('ProtocolScreenV2 — Black Issue source facts', () => {
  it('derives the masthead date from the clock, never a literal', () => {
    expect(CODE).toContain('formatMastheadDay(Date.now(), i18n.language)');
    expect(CODE).not.toMatch(/SAT AUG|Aug 29/i);
  });

  it('reuses the Lane A stale contract and key instead of a second freshness system', () => {
    expect(CODE).toContain('useBootstrapSlice()');
    expect(CODE).toContain("t('home.v2.stale_notice')");
    expect(CODE).toMatch(/lastRefreshStale \? \(/);
  });

  it('says "checked", never "updated", for the signals clock', () => {
    expect(EN.protocol.v3.signals_checked).toMatch(/^Signals checked /);
    expect(EN.protocol.v3.signals_checked).not.toMatch(/updated|refresh/i);
  });

  it('keeps Dynamic Type on: no opt-out, no shrink-to-fit', () => {
    expect(CODE).not.toContain('allowFontScaling={false}');
    expect(CODE).not.toContain('adjustsFontSizeToFit');
  });
});
