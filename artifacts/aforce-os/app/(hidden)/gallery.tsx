/**
 * gallery route — dev/demo-only P0 Screen Gallery (visual-audit §8).
 *
 * Mirrors `app/ui-gallery.tsx`'s guard pattern (`__DEV__` → redirect home),
 * extended with the `EXPO_PUBLIC_DEMO_MODE` check the app already uses for
 * internal pitch/demo builds (`services/demoMode.ts`) — a demo build has
 * `__DEV__` false but should still be able to open the gallery for a live
 * walkthrough. Only `demo/AForceScreenGallery` — and everything it
 * transitively imports, including `demo/galleryFixtures` — is loaded via
 * `React.lazy`, so the module is never *evaluated* on a normal production
 * launch: the guard below returns `<Redirect>` before the lazy factory is
 * ever invoked. `demo/galleryFixtures.ts` also carries its own hard
 * top-level throw as a second, independent guard (see that file and
 * `demo/__tests__/galleryFixtures.guard.test.ts`) in case anything else
 * ever imports it directly.
 */
import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { DEMO_MODE } from '@/services/demoMode';

const LazyGallery = React.lazy(() =>
  import('@/demo/AForceScreenGallery').then((m) => ({ default: m.AForceScreenGallery })),
);

export default function GalleryRoute() {
  const { fixture } = useLocalSearchParams<{ fixture?: string }>();
  if (!__DEV__ && !DEMO_MODE) return <Redirect href="/" />;
  return (
    <React.Suspense fallback={null}>
      <LazyGallery initialFixtureId={typeof fixture === 'string' ? fixture : undefined} />
    </React.Suspense>
  );
}
