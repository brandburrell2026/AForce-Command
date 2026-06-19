import { describe, it, expect } from 'vitest';

import {
  EMPTY_ATTRIBUTION,
  hasAttribution,
  isActivationLink,
  parseActivationLink,
} from '../activation/attribution';

describe('isActivationLink', () => {
  it('accepts custom-scheme and web activation links', () => {
    expect(isActivationLink('aforce-os://activate?sku=ABC')).toBe(true);
    expect(isActivationLink('https://aforce.app/activate?sku=ABC')).toBe(true);
    expect(isActivationLink('https://aforce.app/activation')).toBe(true);
  });

  it('rejects non-activation links and a stray ?activate= query', () => {
    expect(isActivationLink('aforce-os://home')).toBe(false);
    expect(isActivationLink('https://aforce.app/scan?activate=1')).toBe(false);
    expect(isActivationLink('')).toBe(false);
    // @ts-expect-error — runtime guards non-string input
    expect(isActivationLink(null)).toBe(false);
  });

  it('rejects untrusted web hosts (attribution poisoning)', () => {
    expect(isActivationLink('https://evil.com/activate?sku=AF1')).toBe(false);
    // look-alike host that merely contains a trusted host is not trusted
    expect(isActivationLink('https://aforce.app.evil.com/activate')).toBe(false);
    expect(isActivationLink('https://evilaforce.app/activate')).toBe(false);
  });

  it('rejects substring look-alikes and bare paths', () => {
    expect(isActivationLink('https://aforce.app/deactivate')).toBe(false);
    expect(isActivationLink('aforce-os://deactivate')).toBe(false);
    expect(isActivationLink('/activate?sku=AF1')).toBe(false); // no scheme
    expect(isActivationLink('activate')).toBe(false);
  });

  it('accepts trusted hosts, subpaths, and the custom scheme', () => {
    expect(isActivationLink('https://drinkaforce.com/activate?sku=AF1')).toBe(
      true,
    );
    expect(isActivationLink('https://www.aforce.app/activation')).toBe(true);
    expect(isActivationLink('https://aforce.app/activate/v2?sku=AF1')).toBe(
      true,
    );
    expect(isActivationLink('aforce-os://activation?qr=Q1')).toBe(true);
  });
});

describe('parseActivationLink', () => {
  it('parses a full deep link with every dimension', () => {
    const a = parseActivationLink(
      'aforce-os://activate?sku=AF-CITRUS-12&loc=STORE_42&geo=US-CA&c=spring24&qr=QR_001',
    );
    expect(a).toEqual({
      sku: 'AF-CITRUS-12',
      retailLocationId: 'STORE_42',
      geo: 'US-CA',
      campaign: 'spring24',
      qrId: 'QR_001',
    });
  });

  it('parses a web universal link identically', () => {
    const a = parseActivationLink(
      'https://aforce.app/activate?sku=AF1&store=S9&country=US',
    );
    expect(a.sku).toBe('AF1');
    expect(a.retailLocationId).toBe('S9');
    expect(a.geo).toBe('US');
  });

  it('honors alias keys (loc/c/qr/region)', () => {
    const a = parseActivationLink(
      'aforce-os://activate?location=L1&campaign=BATCH7&qrcode=Q9&region=us-tx',
    );
    expect(a.retailLocationId).toBe('L1');
    expect(a.campaign).toBe('BATCH7');
    expect(a.qrId).toBe('Q9');
    expect(a.geo).toBe('US-TX');
  });

  it('returns all-null attribution for a non-activation link', () => {
    expect(parseActivationLink('aforce-os://home?sku=X')).toEqual(
      EMPTY_ATTRIBUTION,
    );
  });

  it('leaves missing dimensions null', () => {
    const a = parseActivationLink('aforce-os://activate?sku=ONLYSKU');
    expect(a.sku).toBe('ONLYSKU');
    expect(a.retailLocationId).toBeNull();
    expect(a.geo).toBeNull();
    expect(a.campaign).toBeNull();
    expect(a.qrId).toBeNull();
  });

  it('drops oversized and empty values, keeps the valid ones', () => {
    const bigSku = 'S'.repeat(65);
    const a = parseActivationLink(
      `aforce-os://activate?sku=${bigSku}&loc=&geo=US`,
    );
    expect(a.sku).toBeNull();
    expect(a.retailLocationId).toBeNull();
    expect(a.geo).toBe('US');
  });

  it('rejects values that look like GPS coordinates as geo (privacy)', () => {
    const a = parseActivationLink(
      'aforce-os://activate?geo=37.7749,-122.4194&sku=AF1',
    );
    expect(a.geo).toBeNull();
    expect(a.sku).toBe('AF1');
  });

  it('rejects tokens with unsafe characters', () => {
    const a = parseActivationLink('aforce-os://activate?sku=A B&loc=ok_1');
    expect(a.sku).toBeNull();
    expect(a.retailLocationId).toBe('ok_1');
  });

  it('decodes percent-encoding and ignores malformed pairs', () => {
    const a = parseActivationLink(
      'aforce-os://activate?campaign=spring%2D24&sku=%ZZbad&qr=Q1',
    );
    expect(a.campaign).toBe('spring-24');
    expect(a.sku).toBeNull(); // malformed %ZZ pair skipped → sku unset
    expect(a.qrId).toBe('Q1');
  });

  it('ignores unknown keys, a hash fragment, and takes first of duplicates', () => {
    const a = parseActivationLink(
      'aforce-os://activate?sku=FIRST&sku=SECOND&unknown=x#frag',
    );
    expect(a.sku).toBe('FIRST');
  });
});

describe('hasAttribution', () => {
  it('is false for empty and true when any dimension is set', () => {
    expect(hasAttribution(EMPTY_ATTRIBUTION)).toBe(false);
    expect(
      hasAttribution(parseActivationLink('aforce-os://activate?sku=AF1')),
    ).toBe(true);
  });
});
