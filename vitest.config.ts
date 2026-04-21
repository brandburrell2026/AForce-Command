import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['artifacts/aforce-os/services/__tests__/**/*.test.ts'],
    environment: 'node',
    reporters: 'default',
  },
});
