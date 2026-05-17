/**
 * Profile identity — user-editable fields that appear on the premium
 * profile card (Profile tab > top section).
 *
 * Why this lives next to `utils/units.ts` rather than `types/index.ts`:
 *   - It owns its own sanitiser used by the AsyncStorage hydration
 *     effect, identical to the unit-preferences pattern.
 *   - It owns the canonical aura-state list so both the modal editor
 *     and the chip-strip renderer pull from a single source.
 *   - Keeping the shape + defaults + sanitiser co-located makes the
 *     reducer test contract trivial.
 *
 * What's NOT here:
 *   - `name` — the display name comes from Clerk (see profile.tsx),
 *     so editing it would diverge from the auth source of truth.
 *   - `subscriptionTier` — Stripe-derived; mutating it from the
 *     client would create a paywall escape hatch.
 *   - `streakDays` — engine-computed from compliance history, not a
 *     vanity field the user gets to set.
 */

import type { AuraState } from '../types';

export interface ProfileIdentity {
  /** Short alias / handle shown under the display name (e.g. "MiamiPulse"). */
  nickname: string;
  /** City or territory the user reps (e.g. "Miami"). */
  city: string;
  /** Country (display name, e.g. "USA"). */
  country: string;
  /** Team / Circle affiliation shown as a chip. */
  teamCircle: string;
  /** Short territory badge label (e.g. "MIAMI HEAT ZONE"). */
  territoryBadge: string;
  /** User-selected aura mode — see `AURA_STATES` for the canonical set. */
  auraState: AuraState;
}

/**
 * Canonical aura list. Order is the on-screen order in the editor's
 * segmented control — keep IGNITE first (most energetic) through CALM
 * (most restful) so the gradient reads intuitively.
 */
export const AURA_STATES: readonly AuraState[] = [
  'IGNITE',
  'FLOW',
  'STORM',
  'CALM',
  'APEX',
] as const;

/**
 * Empty-string defaults for the free-text fields so the card degrades
 * to "no chip rendered" rather than literal whitespace. `auraState`
 * defaults to FLOW because it's the most neutral mode and matches the
 * mock demo persona — the editor lets the user change it instantly.
 */
export const DEFAULT_PROFILE_IDENTITY: ProfileIdentity = {
  nickname: '',
  city: '',
  country: '',
  teamCircle: '',
  territoryBadge: '',
  auraState: 'FLOW',
};

/** Hard cap so a runaway paste can't blow out the chip strip layout. */
const MAX_FIELD_LENGTH = 48;

function isAura(v: unknown): v is AuraState {
  return (
    v === 'IGNITE' ||
    v === 'FLOW' ||
    v === 'STORM' ||
    v === 'CALM' ||
    v === 'APEX'
  );
}

function asTrimmedString(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback;
  // Strip control chars + trim, then cap. We keep emoji + extended
  // unicode so handles like "@miami☀️" survive the round-trip.
  const cleaned = v.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  return cleaned.slice(0, MAX_FIELD_LENGTH);
}

/**
 * Per-field sanitiser used by the AsyncStorage hydration path. Tolerates
 * a partial / corrupt payload by falling back to defaults per-field —
 * identical to `sanitizeUnitPreferences`.
 */
export function sanitizeProfileIdentity(raw: unknown): ProfileIdentity {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PROFILE_IDENTITY };
  const r = raw as Record<string, unknown>;
  return {
    nickname: asTrimmedString(r.nickname, DEFAULT_PROFILE_IDENTITY.nickname),
    city: asTrimmedString(r.city, DEFAULT_PROFILE_IDENTITY.city),
    country: asTrimmedString(r.country, DEFAULT_PROFILE_IDENTITY.country),
    teamCircle: asTrimmedString(r.teamCircle, DEFAULT_PROFILE_IDENTITY.teamCircle),
    territoryBadge: asTrimmedString(
      r.territoryBadge,
      DEFAULT_PROFILE_IDENTITY.territoryBadge,
    ),
    auraState: isAura(r.auraState) ? r.auraState : DEFAULT_PROFILE_IDENTITY.auraState,
  };
}
