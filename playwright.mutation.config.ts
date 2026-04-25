import { defineConfig, devices } from '@playwright/test';

// Dedicated config for the mutation-testing exercise (Assignment 3, Phase 2).
// The default playwright.config.ts excludes tests/mutation/** so CI stays green;
// run mutation tests on demand with:
//   npx playwright test --config=playwright.mutation.config.ts
// or target a single file:
//   npx playwright test --config=playwright.mutation.config.ts tests/mutation/auth.mutant.spec.ts
export default defineConfig({
  testDir: './tests/mutation',
  testMatch: '*.mutant.spec.ts',
  timeout: 60000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
