import { describe, it, expect } from 'vitest';

import {
  activationDedupeKey,
  activationEventPayload,
  attributionFromPayload,
  parseActivationLink,
} from '../attribution';

describe('activationEventPayload', () => {
  it('includes only the attribution dimensions that are present', () => {
    const attr = parseActivationLink(
      'aforce-os://activate?sku=AF1&loc=STORE9&geo=US-CA&c=BATCH7&qr=Q123',
    );
    expect(activationEventPayload(attr)).toEqual({
      sku: 'AF1',
      retailLocationId: 'STORE9',
      geo: 'US-CA',
      campaign: 'BATCH7',
      qrId: 'Q123',
    });
  });

  it('drops null dimensions so the payload stays compact', () => {
    const attr = parseActivationLink('aforce-os://activate?sku=AF1');
    expect(activationEventPayload(attr)).toEqual({ sku: 'AF1' });
  });

  it('round-trips through attributionFromPayload', () => {
    const attr = parseActivationLink(
      'https://aforce.app/activate?sku=AF1&geo=US&qr=Q9',
    );
    const payload = activationEventPayload(attr);
    expect(attributionFromPayload(payload)).toEqual(attr);
  });

  it('re-sanitizes a tampered stored payload (never trusts stored values)', () => {
    const cleaned = attributionFromPayload({
      sku: 'OK_1',
      geo: '37.7749,-122.4194', // looks like GPS → dropped
      retailLocationId: 'bad value!', // illegal token → dropped
      qrId: 42, // wrong type → dropped
    });
    expect(cleaned.sku).toBe('OK_1');
    expect(cleaned.geo).toBeNull();
    expect(cleaned.retailLocationId).toBeNull();
    expect(cleaned.qrId).toBeNull();
  });
});

describe('activationDedupeKey', () => {
  it('prefers the per-QR id', () => {
    const url = 'aforce-os://activate?qr=Q123&sku=AF1';
    expect(activationDedupeKey(parseActivationLink(url), url)).toBe('qr_Q123');
  });

  it('falls back to a stable url hash when no qrId (case-insensitive)', () => {
    const url = 'https://aforce.app/activate?sku=AF1&c=BATCH7';
    const attr = parseActivationLink(url);
    const k1 = activationDedupeKey(attr, url);
    const k2 = activationDedupeKey(attr, url.toUpperCase());
    expect(k1.startsWith('url_')).toBe(true);
    expect(k1).toBe(k2);
  });

  it('gives different campaigns without a qrId different keys', () => {
    const a = 'https://aforce.app/activate?c=A';
    const b = 'https://aforce.app/activate?c=B';
    expect(activationDedupeKey(parseActivationLink(a), a)).not.toBe(
      activationDedupeKey(parseActivationLink(b), b),
    );
  });
});
