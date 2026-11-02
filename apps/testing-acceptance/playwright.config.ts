import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/playwright',
  testMatch: '**/*.test.ts',
  timeout: 180_000,
  expect: { timeout: 30_000 },
  workers: 1,
  reporter: 'list',
  use: { trace: 'off' },
});
