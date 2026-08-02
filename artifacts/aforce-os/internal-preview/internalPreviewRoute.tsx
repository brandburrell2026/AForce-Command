/**
 * NO-c native-evidence enabler — internal route source (lives OUTSIDE `app/`).
 *
 * `routeSync.mjs` GENERATES `app/internal-preview.tsx` (a thin re-export of this)
 * ONLY for the internal-native build. This module imports only the internal
 * evidence entry; it never enables Night Out by itself and never touches the
 * `/night-out` route guard. The control fails closed unless the internal-build
 * gate passes.
 */
import React from 'react';
import { AFScreen } from '@/components/ui';
import { NightOutEvidenceModeControl } from './NightOutEvidenceModeControl';

export default function InternalPreviewRoute() {
  return (
    <AFScreen scroll>
      <NightOutEvidenceModeControl />
    </AFScreen>
  );
}
