/**
 * Runtime reader for the internal-build gate inputs. Reads the DERIVED public
 * markers + the native bundle identity (the runtime trust anchor). The build-time
 * selector (`EAS_BUILD_PROFILE`/`APP_PROFILE`) is not a public marker and is
 * normally absent at runtime — the identity carries the proof there.
 */
import * as Application from 'expo-application';
import { DEMO_MODE } from '@/services/demoMode';
import type { InternalBuildInputs } from './internalGate';

export function readInternalBuildInputs(): InternalBuildInputs {
  return {
    buildProfile: process.env.EAS_BUILD_PROFILE ?? process.env.APP_PROFILE ?? null,
    appVariant: process.env.EXPO_PUBLIC_APP_VARIANT ?? null,
    internalPreview: process.env.EXPO_PUBLIC_INTERNAL_PREVIEW ?? null,
    demoMode: DEMO_MODE,
    applicationId: Application.applicationId ?? null,
  };
}
