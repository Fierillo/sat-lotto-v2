import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.ts', 'tests/integration/**/*.ts', 'tests/security/**/*.ts'],
    exclude: ['tests/debug/**', '**/node_modules/**'],
    environment: 'node',
    globals: true,
    testTimeout: 30000,
  },
});
