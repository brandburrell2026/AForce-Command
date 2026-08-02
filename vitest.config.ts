import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      // Mirror the aforce-os tsconfig path alias so tests can resolve
      // `@/services/...`, `@/types/...`, `@/data/...` the same way the app does.
      '@/': path.resolve(__dirname, 'artifacts/aforce-os') + '/',
      // React Native → React Native Web, so the NON-SHIPPING Night Out render
      // harness can render RN presentational components to a real DOM (happy-dom)
      // for render-level a11y evidence. Harmless to node suites: they never import
      // `react-native`. This alias affects tests only, never the app bundle.
      'react-native': 'react-native-web',
    },
  },
  test: {
    include: [
      'artifacts/aforce-os/services/**/__tests__/**/*.test.ts',
      'artifacts/aforce-os/analytics/**/__tests__/**/*.test.ts',
      'artifacts/aforce-os/utils/__tests__/**/*.test.ts',
      'artifacts/aforce-os/theme/**/__tests__/**/*.test.ts',
      'artifacts/aforce-os/components/ui/__tests__/**/*.test.ts',
      'artifacts/aforce-os/components/home/__tests__/**/*.test.ts',
      'artifacts/aforce-os/components/insights/__tests__/**/*.test.ts',
      'artifacts/aforce-os/components/nightOut/__tests__/**/*.render.test.tsx',
      'artifacts/aforce-os/store/__tests__/**/*.test.ts',
      'artifacts/aforce-os/hooks/__tests__/**/*.test.ts',
      'artifacts/aforce-os/featureFlags/**/__tests__/**/*.test.ts',
      'artifacts/aforce-os/data/**/__tests__/**/*.test.ts',
      'artifacts/aforce-os/demo/**/__tests__/**/*.test.ts',
      'artifacts/api-server/src/**/__tests__/**/*.test.ts',
      'artifacts/api-server/src/lib/__tests__/**/*.test.ts',
      'artifacts/aforce-site/src/**/__tests__/**/*.test.{ts,tsx}',
      'lib/**/src/**/__tests__/**/*.test.ts',
    ],
    environment: 'node',
    environmentMatchGlobs: [
      ['artifacts/aforce-site/**', 'happy-dom'],
      // The Night Out render harness renders to a DOM.
      ['artifacts/aforce-os/components/nightOut/__tests__/**', 'happy-dom'],
    ],
    reporters: 'default',
  },
});
