/**
 * QR Activation — Day-7 subscription OFFER timer (PURE).
 *
 * The activation funnel's final stage is the Day-7 Subscription Offer: a
 * limited-time offer that opens a fixed number of days after the user's
 * activation anchor (first command completed — the owner-annotated start of
 * the habit loop) and stays claimable for a fixed window.
 *
 * Like the rest of activation-core this is the *underneath*: no React, no
 * react-native, no storage, no `Date.now()`. The "now" instant is injected
 * so the result is a deterministic function of its inputs and fully
 * unit-testable; a UI layer ticks a clock and re-derives.
 *
 * Score-Protection / no-fabrication: this only computes a countdown from
 * already-recorded timestamps. It never awards, mutates, or fabricates
 * score, and an absent / invalid anchor yields `phase: 'unanchored'` with
 * null timings — never a fabricated open offer.
 */

export const MS_PER_HOUR = 60 * 60 * 1000;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Days after the activation anchor when the offer opens. */
export const DEFAULT_OFFER_DAY = 7;
/** Hours the offer stays claimable once open. */
export const DEFAULT_WINDOW_HOURS = 72;

export type Day7OfferPhase = 'unanchored' | 'pending' | 'open' | 'expired';

export interface Day7OfferOptions {
  /** Days after the anchor when the offer opens (default 7). */
  offerDay?: number;
  /** Hours the offer remains claimable once open (default 72). */
  windowHours?: number;
}

export interface Day7OfferState {
  phase: Day7OfferPhase;
  /** ISO instant the offer opens, or null when unanchored. */
  opensAt: string | null;
  /** ISO instant the offer closes, or null when unanchored. */
  closesAt: string | null;
  /** ms until the offer opens (>= 0); non-null only while `pending`. */
  msUntilOpen: number | null;
  /** ms until the offer closes (> 0); non-null only while `open`. */
  msUntilClose: number | null;
  /** True only during the claimable window. */
  isOpen: boolean;
  /** True once the claim window has elapsed. */
  hasExpired: boolean;
}

const UNANCHORED: Day7OfferState = {
  phase: 'unanchored',
  opensAt: null,
  closesAt: null,
  msUntilOpen: null,
  msUntilClose: null,
  isOpen: false,
  hasExpired: false,
};

function parseMs(iso: string | null | undefined): number | null {
  if (iso == null) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/** offerDay: finite, >= 0 → else default. */
function resolveOfferDay(raw: number | undefined): number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0
    ? raw
    : DEFAULT_OFFER_DAY;
}

/** windowHours: finite, > 0 → else default. */
function resolveWindowHours(raw: number | undefined): number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0
    ? raw
    : DEFAULT_WINDOW_HOURS;
}

/**
 * Derive the Day-7 offer state from an activation anchor + the current
 * instant. Both must be parseable ISO timestamps; an absent/invalid anchor
 * (or now) yields the `unanchored` state rather than a fabricated offer.
 */
export function deriveDay7Offer(
  anchorIso: string | null | undefined,
  nowIso: string,
  options?: Day7OfferOptions,
): Day7OfferState {
  const anchor = parseMs(anchorIso);
  const now = parseMs(nowIso);
  if (anchor == null || now == null) return { ...UNANCHORED };

  const offerDay = resolveOfferDay(options?.offerDay);
  const windowHours = resolveWindowHours(options?.windowHours);

  const opensMs = anchor + offerDay * MS_PER_DAY;
  const closesMs = opensMs + windowHours * MS_PER_HOUR;
  const opensAt = new Date(opensMs).toISOString();
  const closesAt = new Date(closesMs).toISOString();

  if (now < opensMs) {
    return {
      phase: 'pending',
      opensAt,
      closesAt,
      msUntilOpen: opensMs - now,
      msUntilClose: null,
      isOpen: false,
      hasExpired: false,
    };
  }
  if (now < closesMs) {
    return {
      phase: 'open',
      opensAt,
      closesAt,
      msUntilOpen: null,
      msUntilClose: closesMs - now,
      isOpen: true,
      hasExpired: false,
    };
  }
  return {
    phase: 'expired',
    opensAt,
    closesAt,
    msUntilOpen: null,
    msUntilClose: null,
    isOpen: false,
    hasExpired: true,
  };
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** The original (clamped >= 0) duration in ms. */
  totalMs: number;
}

/**
 * Break a millisecond duration into whole d/h/m/s parts for display.
 * Negative or non-finite input clamps to zero (never a negative countdown).
 * Pure presentation math — the caller chooses how to format it per locale.
 */
export function countdownParts(ms: number | null | undefined): CountdownParts {
  const total = typeof ms === 'number' && Number.isFinite(ms) && ms > 0 ? ms : 0;
  const days = Math.floor(total / MS_PER_DAY);
  const hours = Math.floor((total % MS_PER_DAY) / MS_PER_HOUR);
  const minutes = Math.floor((total % MS_PER_HOUR) / (60 * 1000));
  const seconds = Math.floor((total % (60 * 1000)) / 1000);
  return { days, hours, minutes, seconds, totalMs: total };
}
