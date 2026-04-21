/**
 * Hydration Scan — type contracts.
 *
 * Real-time barcode / QR / AForce-product recognition. Returns a
 * physiology-aware fit score + AForce-equivalent recommendation.
 * NFC is reserved for future hardware integrations; the placeholder
 * field here lets the recognition service stay forward-compatible.
 */

import type { CompareProduct } from './comparison';
import type { FluidType, PerformanceLevel } from './index';

export type ScanSourceKind = 'barcode' | 'qr' | 'aforce_product' | 'nfc' | 'manual';

export interface ScanSource {
  kind: ScanSourceKind;
  /** Raw value as captured (barcode digits, QR payload, NFC tag id, or product slug). */
  rawValue: string;
}

export interface ScannedProduct {
  /** Stable id matching the comparison product database. */
  productId: string;
  productName: string;
  brand: string;
  category: CompareProduct['category'];
  /** 0-100 sub-scores (mirrors comparison engine model). */
  hydrationSpeed: number;
  electrolyteDensity: number;
  sugarLevel: number;        // higher = more sugar (worse)
  stimulantLevel: number;    // 0 = none. Reserved for future stim products.
  recoveryFit: number;
  performanceFit: number;
  isAForce: boolean;
  /** Mapped fluid type (only set for items the user can log). */
  fluidType?: FluidType;
}

export interface ScanRecommendation {
  /** Plain-language verdict tied to the user's current state. */
  headline: string;
  /** Detailed explanation. */
  detail: string;
  /** Suggested AForce alternative product id (when scanned product is non-AForce). */
  aforceEquivalentId?: string;
  /** Decisive AI command (WHAT + WHEN + OUTCOME). */
  command: string;
  /** Whether logging the scanned product as-is is recommended. */
  shouldLog: boolean;
}

export interface ScanResult {
  /** ISO timestamp of recognition. */
  scannedAt: string;
  source: ScanSource;
  product: ScannedProduct;
  /** 0-100. Reflects fit for the user's CURRENT state. */
  currentFitScore: number;
  /** Coarse verdict bucket. */
  verdict: 'optimal' | 'strong' | 'acceptable' | 'suboptimal' | 'avoid';
  /** State the score was generated against (so the UI can label the verdict). */
  evaluatedAgainstState: PerformanceLevel;
  recommendation: ScanRecommendation;
}

export interface ScanFailure {
  scannedAt: string;
  source: ScanSource;
  reason: 'unknown_barcode' | 'unrecognized_qr' | 'invalid_payload' | 'camera_unavailable';
  message: string;
}

export type ScanOutcome =
  | { ok: true; result: ScanResult }
  | { ok: false; failure: ScanFailure };
