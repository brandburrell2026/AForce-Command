/**
 * editorial-sheet route — dev/demo-only Editorial OS E1 reference sheet.
 *
 * The deterministic primitive sheet the founder reviews for E1 acceptance:
 * both stocks, every type role, editorial number (measured + truthful
 * neutral), statement + red word, command presentation, kicker,
 * caption/evidence, folio, rules, state eyebrows (incl. Lock-In), and the
 * four C signatures — pressure field, И state word, node spine, stock
 * turn. Sample strings only — nothing here reads product state, so the
 * sheet renders identically on every launch.
 *
 * Guarded with the gallery idiom (see hiddenRouteGuards.test.ts structural
 * sweep): redirect home unless __DEV__ or DEMO_MODE, and the sheet module
 * itself loads via React.lazy so it is never evaluated on a production
 * launch.
 */
import React from 'react';
import { Redirect } from 'expo-router';

import { DEMO_MODE } from '@/services/demoMode';

const LazySheet = React.lazy(() =>
  import('@/components/editorial/EditorialReferenceSheet').then((m) => ({
    default: m.EditorialReferenceSheet,
  })),
);

export default function EditorialSheetRoute() {
  if (!__DEV__ && !DEMO_MODE) return <Redirect href="/" />;
  return (
    <React.Suspense fallback={null}>
      <LazySheet />
    </React.Suspense>
  );
}
