/**
 * Brain Energy™ — pure derivation layer (NEW).
 *
 * A display-only morning cognitive-readiness ESTIMATE (0–100) blended from
 * the Voice Check-In self-report (reported energy + reported stress) and,
 * when available, the recovery engine's recovery capacity. It is a strictly
 * READ-ONLY downstream of the check-in + recovery signals:
 *
 *   • Imports nothing from services, stores, React, or I/O.
 *   • Never awards or mutates a hydration point, performance band, or
 *     recovery score (Score-Protection) — the dependency is one-way.
 *
 * Missing-data discipline (mirrors Performance Age): absent signals are
 * DROPPED and the remaining weights renormalized — never substituted with a
 * favourable default that would fabricate an unearned "sharp" result. When NO
 * signal is present at all the result is neutral ('collecting', score null).
 */

/** Weighted blend; weights sum to 1.0. */
export const BRAIN_ENERGY_WEIGHTS = {
  energy: 0.5,
  stress: 0.3,
  recovery: 0.2,
} as const;

export type BrainEnergyBand = 'PRIMED' | 'STEADY' | 'FOGGY' | 'LOW';

export interface BrainEnergyInputs {
  /** Reported morning energy 1–5 (check-in). Optional ⇒ weight renormalizes. */
  energy?: number;
  /** Reported morning stress 1–5 (check-in). Optional ⇒ weight renormalizes. */
  stress?: number;
  /** Recovery capacity 0–100 from the recovery engine, or null/absent. */
  recoveryCapacity?: number | null;
}

export interface BrainEnergyResult {
  /** 'collecting' until at least one signal exists, then 'ready'. */
  status: 'collecting' | 'ready';
  /** 0–100 cognitive-readiness estimate, or null when no signal. */
  score: number | null;
  band: BrainEnergyBand | null;
  /** Short uppercase band label for the card hero (e.g. 'PRIMED'). */
  label: string;
  /** One-line plain caption; Water-First for the low states. */
  caption: string;
  /** How many of the (energy, stress, recovery) signals were present (0–3). */
  availableSignals: number;
}

/** Map a 1–5 scale value to 0–100. */
function scale5to100(n: number): number {
  const v = clamp(n, 1, 5);
  return ((v - 1) / 4) * 100;
}

/** Band for a 0–100 brain-energy score. */
export function brainEnergyBand(score: number): BrainEnergyBand {
  const s = clamp(score, 0, 100);
  if (s >= 75) return 'PRIMED';
  if (s >= 55) return 'STEADY';
  if (s >= 35) return 'FOGGY';
  return 'LOW';
}

function captionForBand(band: BrainEnergyBand): string {
  switch (band) {
    case 'PRIMED':
      return 'Cognitive readiness is high — protect it with steady water.';
    case 'STEADY':
      return 'Holding steady — keep water in the loop to stay sharp.';
    case 'FOGGY':
      return 'Start with water — clarity usually follows rehydration.';
    case 'LOW':
    default:
      return 'Hydrate now — low morning clarity tends to ease with water.';
  }
}

/**
 * Compute the display-only Brain Energy estimate. Pure + deterministic.
 *
 * Stress is inverted (higher reported stress lowers cognitive readiness).
 * Recovery capacity, when present, nudges the estimate. The composite uses
 * drop-and-renormalize so a missing signal never silently defaults to a
 * flattering midpoint.
 */
export function computeBrainEnergy(inputs: BrainEnergyInputs): BrainEnergyResult {
  const signals = [
    {
      v: isFiniteNumber(inputs.energy) ? scale5to100(inputs.energy as number) : undefined,
      w: BRAIN_ENERGY_WEIGHTS.energy,
    },
    {
      // Inverted: stress 5 → 0, stress 1 → 100.
      v: isFiniteNumber(inputs.stress)
        ? 100 - scale5to100(inputs.stress as number)
        : undefined,
      w: BRAIN_ENERGY_WEIGHTS.stress,
    },
    {
      v: isFiniteNumber(inputs.recoveryCapacity)
        ? clamp(inputs.recoveryCapacity as number, 0, 100)
        : undefined,
      w: BRAIN_ENERGY_WEIGHTS.recovery,
    },
  ];

  const available = signals.filter((s) => isFiniteNumber(s.v));
  const availableSignals = available.length;

  if (availableSignals === 0) {
    return {
      status: 'collecting',
      score: null,
      band: null,
      label: 'COLLECTING',
      caption: 'Complete your morning check-in to read Brain Energy.',
      availableSignals: 0,
    };
  }

  const totalWeight = available.reduce((acc, s) => acc + s.w, 0);
  const raw = available.reduce(
    (acc, s) => acc + (s.w / totalWeight) * (s.v as number),
    0,
  );
  const score = clamp(Math.round(raw), 0, 100);
  const band = brainEnergyBand(score);

  return {
    status: 'ready',
    score,
    band,
    label: band,
    caption: captionForBand(band),
    availableSignals,
  };
}

// ─── internals ────────────────────────────────────────────────────────

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
