/**
 * QR Activation — attribution parser (PURE).
 *
 * The acquisition QR printed on a product can deep-links into the app as
 * `aforce-os://activate?sku=...&loc=...&geo=...&c=...&qr=...` (a web
 * universal link `https://<host>/activate?...` carries the same query).
 * This module turns that raw link into a normalized, privacy-safe
 * `ActivationAttribution`. It is the *underneath* half of the activation
 * funnel: no React, no react-native, no storage, no `Date.now()` — every
 * output is a deterministic function of the input string, so it is fully
 * unit-testable.
 *
 * Privacy / Score-Protection: attribution is descriptive metadata only.
 * It never awards or mutates score, and never carries PII or precise
 * location — only a coarse, allow-listed geo code is accepted; anything
 * resembling GPS coordinates is dropped.
 */

export interface ActivationAttribution {
  /** Product SKU the scanned can belongs to (normalized token) or null. */
  sku: string | null;
  /** Retail location / store identifier or null. */
  retailLocationId: string | null;
  /** COARSE geography code (e.g. "US", "US-CA"); never precise GPS. */
  geo: string | null;
  /** Marketing campaign / production-batch identifier or null. */
  campaign: string | null;
  /** Per-QR unique id (lets a single physical code be de-duped) or null. */
  qrId: string | null;
}

export const EMPTY_ATTRIBUTION: ActivationAttribution = {
  sku: null,
  retailLocationId: null,
  geo: null,
  campaign: null,
  qrId: null,
};

/** Max accepted length for any single attribution value; longer → dropped. */
const MAX_VALUE_LENGTH = 64;
/** Max accepted length for a coarse geo code. */
const MAX_GEO_LENGTH = 16;

/** Canonical attribution key → accepted (lower-cased) query aliases. */
const KEY_ALIASES: Record<keyof ActivationAttribution, readonly string[]> = {
  sku: ['sku'],
  retailLocationId: ['retaillocationid', 'loc', 'location', 'store'],
  geo: ['geo', 'region', 'country'],
  campaign: ['campaign', 'c', 'batch'],
  qrId: ['qrid', 'qr', 'qrcode'],
};

const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const GEO_RE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,3})?$/;
/** A decimal-degree pattern → looks like a GPS coordinate; reject it. */
const COORDINATE_RE = /-?\d{1,3}\.\d+/;

/** The app's registered custom URL scheme (see app.json `scheme`). */
const APP_SCHEME = 'aforce-os';

/**
 * Web hosts whose `/activate` links are trusted as genuine activation
 * links. An untrusted host (e.g. `https://evil.com/activate`) is rejected
 * so it cannot poison acquisition attribution. Phase 2 MUST keep this in
 * lockstep with the app's iOS `associatedDomains` and Android App-Links
 * host list.
 */
export const TRUSTED_ACTIVATION_HOSTS: readonly string[] = [
  'aforce.app',
  'www.aforce.app',
  'aforce.com',
  'www.aforce.com',
  'drinkaforce.com',
  'www.drinkaforce.com',
];

function sanitizeToken(raw: string): string | null {
  const v = raw.trim();
  if (v.length === 0 || v.length > MAX_VALUE_LENGTH) return null;
  return TOKEN_RE.test(v) ? v : null;
}

function sanitizeGeo(raw: string): string | null {
  const v = raw.trim();
  if (v.length === 0 || v.length > MAX_GEO_LENGTH) return null;
  if (COORDINATE_RE.test(v)) return null; // never store precise coordinates
  return GEO_RE.test(v) ? v.toUpperCase() : null;
}

/** Extract raw `key=value` query pairs from any URL-ish string. */
function parseQuery(url: string): Map<string, string> {
  const out = new Map<string, string>();
  const qIndex = url.indexOf('?');
  if (qIndex < 0) return out;
  let query = url.slice(qIndex + 1);
  const hashIndex = query.indexOf('#');
  if (hashIndex >= 0) query = query.slice(0, hashIndex);
  for (const pair of query.split('&')) {
    if (pair.length === 0) continue;
    const eq = pair.indexOf('=');
    const rawKey = eq < 0 ? pair : pair.slice(0, eq);
    const rawVal = eq < 0 ? '' : pair.slice(eq + 1);
    let key: string;
    let val: string;
    try {
      key = decodeURIComponent(rawKey).trim().toLowerCase();
      val = decodeURIComponent(rawVal.replace(/\+/g, ' '));
    } catch {
      continue; // malformed percent-encoding → skip this pair, never throw
    }
    if (key.length === 0) continue;
    if (!out.has(key)) out.set(key, val); // first value wins
  }
  return out;
}

/** First path segment must be exactly `activate` or `activation`. */
function isActivationSegment(segment: string): boolean {
  return segment === 'activate' || segment === 'activation';
}

/** Split a URL into { scheme, authority, path }, or null when it has no scheme. */
function dissectUrl(
  url: string,
): { scheme: string; authority: string; path: string } | null {
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//.exec(url);
  if (m == null) return null;
  const scheme = (m[1] ?? '').toLowerCase();
  const afterScheme = url.slice(m[0].length).split(/[?#]/)[0] ?? '';
  const slash = afterScheme.indexOf('/');
  const authority = (
    slash < 0 ? afterScheme : afterScheme.slice(0, slash)
  ).toLowerCase();
  const path = slash < 0 ? '' : afterScheme.slice(slash);
  return { scheme, authority, path };
}

/** First non-empty path segment, lower-cased (`/activate/x` → `activate`). */
function firstPathSegment(path: string): string {
  return path.replace(/^\/+/, '').split('/')[0]?.toLowerCase() ?? '';
}

/** Authority with any `:port` stripped. */
function hostOf(authority: string): string {
  return authority.split(':')[0] ?? '';
}

/**
 * True only for a *trusted* activation link:
 *   • the custom scheme `aforce-os://activate` (or `…/activation`), or
 *   • an `http(s)` universal link on a TRUSTED host whose first path
 *     segment is `activate` (or `activation`).
 *
 * Substring look-alikes (`/deactivate`, `?activate=1`), bare paths with no
 * scheme, and untrusted hosts (`https://evil.com/activate`,
 * `https://aforce.app.evil.com/activate`) are all rejected so they cannot
 * poison acquisition attribution.
 */
export function isActivationLink(url: string): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;
  const d = dissectUrl(url);
  if (d == null) return false;
  if (d.scheme === APP_SCHEME) {
    // aforce-os://activate  → "activate" is the authority
    // aforce-os:///activate → empty authority, "/activate" is the path
    return (
      isActivationSegment(d.authority) ||
      isActivationSegment(firstPathSegment(d.path))
    );
  }
  if (d.scheme === 'https' || d.scheme === 'http') {
    if (!TRUSTED_ACTIVATION_HOSTS.includes(hostOf(d.authority))) return false;
    return isActivationSegment(firstPathSegment(d.path));
  }
  return false;
}

/**
 * Parse a scanned activation link into normalized attribution. Returns
 * fully-null attribution for any non-activation or malformed link. Every
 * field is independently validated, so one bad value never voids the rest.
 */
export function parseActivationLink(url: string): ActivationAttribution {
  if (!isActivationLink(url)) return { ...EMPTY_ATTRIBUTION };
  const q = parseQuery(url);
  const pick = (aliases: readonly string[]): string | null => {
    for (const a of aliases) {
      const raw = q.get(a);
      if (raw != null && raw.length > 0) return raw;
    }
    return null;
  };
  const rawSku = pick(KEY_ALIASES.sku);
  const rawLoc = pick(KEY_ALIASES.retailLocationId);
  const rawGeo = pick(KEY_ALIASES.geo);
  const rawCampaign = pick(KEY_ALIASES.campaign);
  const rawQr = pick(KEY_ALIASES.qrId);
  return {
    sku: rawSku != null ? sanitizeToken(rawSku) : null,
    retailLocationId: rawLoc != null ? sanitizeToken(rawLoc) : null,
    geo: rawGeo != null ? sanitizeGeo(rawGeo) : null,
    campaign: rawCampaign != null ? sanitizeToken(rawCampaign) : null,
    qrId: rawQr != null ? sanitizeToken(rawQr) : null,
  };
}

/** True when any attribution dimension is present. */
export function hasAttribution(a: ActivationAttribution): boolean {
  return (
    a.sku != null ||
    a.retailLocationId != null ||
    a.geo != null ||
    a.campaign != null ||
    a.qrId != null
  );
}
