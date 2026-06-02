/**
 * Smart Capture API client — POST /api/smart-capture.
 *
 * Sends a base64-encoded image to the server and returns the four-load
 * estimate + correction recommendation. Mirrors the response shape
 * defined by `SmartCaptureResponse` in `routes/smartCapture.ts`.
 *
 * Keeps a generous network timeout (45 s) because vision-capable models
 * occasionally take 20+ seconds on the first call to a fresh request.
 */

import { postJsonAforceApi } from './aforceApiClient';

export type LoadLevel = 'low' | 'moderate' | 'high' | 'very_high';

export type DrinkCategoryIdServer =
  | 'water'
  | 'bottled_water'
  | 'coffee'
  | 'tea'
  | 'pre_workout'
  | 'energy_drink'
  | 'sports_drink'
  | 'alcohol'
  | 'smoothie'
  | 'juice'
  | 'soda'
  | 'electrolyte'
  | 'custom';

export interface LoadEstimate {
  level: LoadLevel;
  score: number;
  note: string;
}

export interface SmartCaptureResult {
  itemSummary: string;
  hydrationDemand: LoadEstimate;
  recoveryLoad: LoadEstimate;
  stimulantLoad: LoadEstimate;
  acidicLoad: LoadEstimate;
  correctionRecommendation: {
    drinkCategory: DrinkCategoryIdServer;
    drinkName: string;
    oz: number;
    rationale: string;
  };
}

export interface SmartCaptureRequest {
  imageBase64: string;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic';
}

/**
 * Submit a photo for AI hydration analysis. Resolves with the parsed
 * result on 200, throws an Error with a human-readable message
 * otherwise. Caller should display the message and let the user retry.
 */
export async function postSmartCapture(req: SmartCaptureRequest): Promise<SmartCaptureResult> {
  return postJsonAforceApi<SmartCaptureResult>('/smart-capture', req);
}
