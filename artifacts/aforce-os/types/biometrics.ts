/**
 * Cross-provider biometric snapshot — CANONICAL MODEL MOVED, NOT FORKED.
 *
 * The `ProviderSnapshot` / `ProviderBiometrics` model that lived here is now
 * owned by `@workspace/health-core` (the provider-neutral AForce Health
 * Integration Layer), so the mobile app and the api-server share one source
 * of truth. This module re-exports it verbatim — every existing import path
 * keeps working unchanged.
 *
 * What health-core added (additive only):
 *   - `hrvRmssdMs` / `hrvSdnnMs` — honest HRV statistics. The legacy
 *     `hrvSdnn` field is @deprecated: WHOOP/Oura/Garmin actually populate it
 *     with RMSSD-based values. Read HRV via `resolveHrv()` or the new fields;
 *     never place RMSSD in an SDNN field (or vice versa).
 *   - `schemaVersion` — stamped by the normalization boundary.
 *
 * Any field a provider doesn't expose stays null — never substituted with a
 * placeholder. That keeps every consumer honest about what's connected.
 */

export type { ProviderSnapshot, ProviderBiometrics } from '@workspace/health-core';
