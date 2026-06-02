/**
 * Health-platform integration catalog.
 *
 * AForce ingests biometrics (HR / HRV / steps / sleep / strain / GPS)
 * from third-party health platforms. Each entry below describes a
 * provider the user can link from the Profile screen. Real OAuth /
 * SDK integration happens elsewhere (Samsung Health SDK, Google
 * Health Connect, Garmin Connect IQ OAuth, Whoop API, Strava API);
 * the catalog drives the UI surface and the mocked connect flow.
 */

import type { Feather } from '@expo/vector-icons';

export type HealthProviderId =
  | 'apple_health'
  | 'oura'
  | 'samsung_health'
  | 'google_health'
  | 'garmin'
  | 'whoop'
  | 'strava';

export interface HealthProvider {
  id: HealthProviderId;
  name: string;
  /** Short pitch for what AForce pulls from this provider. */
  pulls: string;
  /** Brand-accurate accent (used for dot, status, glow). */
  brand: string;
  icon: keyof typeof Feather.glyphMap;
}

export const HEALTH_PROVIDERS: HealthProvider[] = [
  {
    id: 'apple_health',
    name: 'Apple Health',
    pulls: 'HR · HRV · sleep · workouts',
    brand: '#FF2800',
    icon: 'heart',
  },
  {
    id: 'oura',
    name: 'Oura Ring',
    pulls: 'Readiness · sleep · HRV',
    brand: '#9B8CFF',
    icon: 'circle',
  },
  {
    id: 'samsung_health',
    name: 'Samsung Health',
    pulls: 'HR · sleep · workouts',
    brand: '#1428A0',
    icon: 'smartphone',
  },
  {
    id: 'google_health',
    name: 'Google Health Connect',
    pulls: 'Steps · HR · hydration',
    brand: '#4285F4',
    icon: 'activity',
  },
  {
    id: 'garmin',
    name: 'Garmin Connect',
    pulls: 'HRV · stress · GPS workouts',
    brand: '#007CC3',
    icon: 'watch',
  },
  {
    id: 'whoop',
    name: 'WHOOP',
    pulls: 'Strain · recovery · sleep',
    brand: '#B8FF35',
    icon: 'zap',
  },
  {
    id: 'strava',
    name: 'Strava',
    pulls: 'Runs · rides · training load',
    brand: '#FC4C02',
    icon: 'map',
  },
];
