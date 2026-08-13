import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  assetsInclude: ['**/*.png', '**/*.jpg', '**/*.webp'],
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: [
      // Wave-4 Part 3: the real products module executes RN asset
      // require('*.png') at import — unparseable in node. Redirect ANY
      // specifier for it (relative or @/-aliased) to the node stub;
      // per-suite vi.mock still wins where present.
      {
        find: /^(.*\/)?data\/products$/,
        replacement: path.resolve(__dirname, 'artifacts/aforce-os/data/products.node-stub.ts'),
      },
      // Mirror the aforce-os tsconfig path alias so tests can resolve
      // `@/services/...`, `@/types/...`, `@/data/...` the same way the app does.
      { find: /^@\//, replacement: path.resolve(__dirname, 'artifacts/aforce-os') + '/' },
      // React Native → React Native Web, so the NON-SHIPPING Night Out render
      // harness can render RN presentational components to a real DOM (happy-dom)
      // for render-level a11y evidence. Harmless to node suites: they never import
      // `react-native`. This alias affects tests only, never the app bundle.
      { find: /^react-native$/, replacement: 'react-native-web' },
    ],
  },
  test: {
    setupFiles: ['./vitest.setup.ts'],
    // RN-style require('*.png') in data modules — treat as vite assets
    // (returns a path string in node, matching the Metro contract shape).
    include: [
      'artifacts/aforce-os/services/**/__tests__/**/*.test.ts',
      'artifacts/aforce-os/analytics/**/__tests__/**/*.test.ts',
      'artifacts/aforce-os/utils/__tests__/**/*.test.ts',
      'artifacts/aforce-os/theme/**/__tests__/**/*.test.ts',
      'artifacts/aforce-os/components/ui/__tests__/**/*.test.ts',
      'artifacts/aforce-os/components/ui/__tests__/**/*.render.test.tsx',
      'artifacts/aforce-os/components/home/__tests__/**/*.test.ts',
      'artifacts/aforce-os/components/home/__tests__/**/*.render.test.tsx',
      'artifacts/aforce-os/components/protocol/__tests__/**/*.test.ts',
      // Build 61 correction: the cold-launch cinematic had no suite at all, and
      // shipped a fabricated readiness number for two builds as a result.
      'artifacts/aforce-os/components/opening/__tests__/**/*.test.ts',
      'artifacts/aforce-os/components/opening/__tests__/**/*.render.test.tsx',
      'artifacts/aforce-os/components/hydration/__tests__/**/*.test.ts',
      'artifacts/aforce-os/components/hydration/__tests__/**/*.render.test.tsx',
      'artifacts/aforce-os/components/insights/__tests__/**/*.test.ts',
      'artifacts/aforce-os/components/insights/__tests__/**/*.render.test.tsx',
      'artifacts/aforce-os/components/community/__tests__/**/*.test.ts',
      'artifacts/aforce-os/components/moments/__tests__/**/*.test.ts',
      'artifacts/aforce-os/components/moments/__tests__/**/*.render.test.tsx',
      'artifacts/aforce-os/components/notifications/__tests__/**/*.test.ts',
      'artifacts/aforce-os/components/profile/__tests__/**/*.test.ts',
      'artifacts/aforce-os/components/profile/__tests__/**/*.render.test.tsx',
      'artifacts/aforce-os/components/cart/__tests__/**/*.test.ts',
      'artifacts/aforce-os/components/subscription/__tests__/**/*.test.ts',
      // Wave-5 Phase-1 a11y pass: `components/__tests__/` was matched for
      // `*.render.test.tsx` ONLY, so the Wave-5 Parts 20/21 accessibility lock
      // (`a11yContrastAndTargets.test.ts`, a plain `.test.ts` source scan)
      // silently never ran — an unenforced beta gate. Accessibility is a beta
      // gate; its lock has to be able to fail CI.
      'artifacts/aforce-os/components/__tests__/**/*.test.ts',
      'artifacts/aforce-os/components/__tests__/**/*.render.test.tsx',
      'artifacts/aforce-os/components/nightOut/__tests__/**/*.render.test.tsx',
      'artifacts/aforce-os/components/cruise/__tests__/**/*.render.test.tsx',
      'artifacts/aforce-os/components/health/__tests__/**/*.render.test.tsx',
      'artifacts/aforce-os/components/sleep/__tests__/**/*.render.test.tsx',
      'artifacts/aforce-os/components/journal/__tests__/**/*.render.test.tsx',
      'artifacts/aforce-os/store/__tests__/**/*.test.ts',
      'artifacts/aforce-os/store/__tests__/**/*.render.test.tsx',
      'artifacts/aforce-os/hooks/__tests__/**/*.test.ts',
      'artifacts/aforce-os/lib/__tests__/**/*.test.ts',
      'artifacts/aforce-os/featureFlags/**/__tests__/**/*.test.ts',
      'artifacts/aforce-os/data/**/__tests__/**/*.test.ts',
      'artifacts/aforce-os/demo/**/__tests__/**/*.test.ts',
      'artifacts/api-server/src/**/__tests__/**/*.test.ts',
      'artifacts/api-server/src/lib/__tests__/**/*.test.ts',
      'artifacts/aforce-site/src/**/__tests__/**/*.test.{ts,tsx}',
      'lib/**/src/**/__tests__/**/*.test.ts',
      'scripts/src/__tests__/**/*.test.ts',
    ],
    environment: 'node',
    environmentMatchGlobs: [
      ['artifacts/aforce-site/**', 'happy-dom'],
      // The Night Out render harness renders to a DOM.
      ['artifacts/aforce-os/components/nightOut/__tests__/**', 'happy-dom'],
      // The Cruise Mode render harness renders to a DOM.
      ['artifacts/aforce-os/components/cruise/__tests__/**', 'happy-dom'],
      // The Connected Health render harness renders to a DOM.
      ['artifacts/aforce-os/components/health/__tests__/**', 'happy-dom'],
      // The Sleep Mode render harness renders to a DOM.
      ['artifacts/aforce-os/components/sleep/__tests__/**', 'happy-dom'],
      // Squad-F HIGH a11y remediation render harnesses (WhoopSnapshotCard,
      // AFListRow, BiometricDetailSheet) render to a DOM. Scoped to
      // `*.render.test.tsx` only so the existing `.test.ts` pure-logic suites
      // in components/ui/__tests__ and components/home/__tests__ keep running
      // under `node`, unaffected.
      ['artifacts/aforce-os/components/__tests__/**/*.render.test.tsx', 'happy-dom'],
      ['artifacts/aforce-os/components/ui/__tests__/**/*.render.test.tsx', 'happy-dom'],
      ['artifacts/aforce-os/components/home/__tests__/**/*.render.test.tsx', 'happy-dom'],
      // RC-1 Wave-2B — Readiness Insights loading skeleton + Profile
      // provider-section skeleton render harnesses (pure subcomponents only;
      // the connected screens themselves stay source-guard-tested per the
      // convention documented in homeScreenV2Wiring.test.ts).
      ['artifacts/aforce-os/components/insights/__tests__/**/*.render.test.tsx', 'happy-dom'],
      ['artifacts/aforce-os/components/profile/__tests__/**/*.render.test.tsx', 'happy-dom'],
      // Wave 5 loading-state pass — the Performance Signal and Moments loading
      // skeletons (pure, store-free subcomponents, same convention as the two
      // lines above; their connected screens stay source-guard-tested).
      ['artifacts/aforce-os/components/hydration/__tests__/**/*.render.test.tsx', 'happy-dom'],
      ['artifacts/aforce-os/components/moments/__tests__/**/*.render.test.tsx', 'happy-dom'],
      // VS 3.0 P2 — Journal summary-widget render harnesses render to a DOM.
      ['artifacts/aforce-os/components/journal/__tests__/**/*.render.test.tsx', 'happy-dom'],
      // Build 61 — the cold-launch cinematic's readiness-number lock renders
      // the real overlay to a DOM (its stage timeline is the thing under test).
      ['artifacts/aforce-os/components/opening/__tests__/**/*.render.test.tsx', 'happy-dom'],
    ],
    reporters: 'default',
  },
});
