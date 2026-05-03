import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the aforce-os tsconfig path alias so tests can resolve
      // `@/services/...`, `@/types/...`, `@/data/...` the same way the app does.
      '@/': path.resolve(__dirname, 'artifacts/aforce-os') + '/',
    },
  },
  test: {
    include: [
      'artifacts/aforce-os/services/**/__tests__/**/*.test.ts',
      'artifacts/aforce-os/utils/__tests__/**/*.test.ts',
      'artifacts/aforce-os/store/__tests__/**/*.test.ts',
      'artifacts/aforce-os/hooks/__tests__/**/*.test.ts',
      'artifacts/api-server/src/**/__tests__/**/*.test.ts',
      'artifacts/api-server/src/lib/__tests__/**/*.test.ts',
    ],
    environment: 'node',
    reporters: 'default',
  },
});
