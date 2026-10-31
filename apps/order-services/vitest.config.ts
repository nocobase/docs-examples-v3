import { createNodeVitestConfig } from '@nocobase/dev-config/vitest/node';
export default createNodeVitestConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
