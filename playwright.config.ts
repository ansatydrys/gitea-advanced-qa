import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  // Mutation tests are intentionally failing copies used only for the mutation-testing
  // exercise (Assignment 3, Phase 2). Run them on demand via:
  //   npx playwright test tests/mutation/<file>.mutant.spec.ts
  testIgnore: ['**/tests/mutation/**'],
  timeout: 60000,
  retries: 1,
  workers: 1, // Sequential — SQLite can't handle parallel writes
  reporter: [['html', { open: 'never' }], ['list']],
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
