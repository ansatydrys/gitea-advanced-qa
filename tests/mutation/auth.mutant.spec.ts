/**
 * auth.mutant.spec.ts
 * MUTANT COPY of auth.spec.ts with 5 intentional mutations.
 * Each mutation is labeled. Tests that fail = mutation killed.
 */

import { test, expect } from '@playwright/test';
import { AuthPage, loginAsAdmin, ADMIN_USER, ADMIN_PASS, uniqueName } from '../helpers';

test('TC01 - Valid admin login redirects to dashboard', async ({ page }) => {
  const auth = new AuthPage(page);
  await auth.login(ADMIN_USER, ADMIN_PASS);
  await expect(page).not.toHaveURL(/\/user\/login/);
  // MUTATION-3: [Assertion removal] — original: await expect(page.locator('body')).toBeVisible();
});

test('TC02 - Logout clears session and redirects to login or home', async ({ page }) => {
  await loginAsAdmin(page);
  const auth = new AuthPage(page);
  await auth.logout();
  await page.goto('/issues');
  await expect(page).toHaveURL(/\/user\/login|\/$/);
});

test('TC03 - Wrong password shows error message', async ({ page }) => {
  const auth = new AuthPage(page);
  await auth.login(ADMIN_USER, 'WrongPassword999!');
  await expect(page).toHaveURL(/\/user\/login/);
  const errorEl = page.locator('.ui.negative.message, .ui.error.message, .flash-error, p.error');
  await expect(errorEl.first()).toBeVisible({ timeout: 8000 });
});

test('TC04 - Empty username field prevents login', async ({ page }) => {
  // MUTATION-5: [URL change] — original: await page.goto('/user/login');
  await page.goto('/user/signin');
  await page.fill('input[name="password"]', ADMIN_PASS);
  await page.click('button.ui.primary.button');
  await expect(page).toHaveURL(/\/user\/login/);
});

test('TC05 - SQL injection in username field does not crash app', async ({ page }) => {
  const auth = new AuthPage(page);
  await auth.login("' OR '1'='1", "' OR '1'='1");
  await expect(page).toHaveURL(/\/user\/login/);
  // MUTATION-4: [Logical negation] — original: await expect(page.locator('body')).not.toContainText('500');
  await expect(page.locator('body')).toContainText('500');
});

test('TC06 - Registration with mismatched passwords shows error', async ({ page }) => {
  const name = uniqueName('testuser');
  await page.goto('/user/sign_up');
  await page.fill('input[name="user_name"]', name);
  await page.fill('input[name="email"]', `${name}@test.local`);
  await page.fill('input[name="password"]', 'Password123!');
  await page.fill('input[name="retype"]', 'DifferentPass123!');
  await page.click('button.ui.primary.button');
  await expect(page).toHaveURL(/\/user\/sign_up/);
});

test('TC07 - Registration with existing username shows error', async ({ page }) => {
  await page.goto('/user/sign_up');
  await page.fill('input[name="user_name"]', ADMIN_USER);
  await page.fill('input[name="email"]', 'taken@test.local');
  await page.fill('input[name="password"]', 'Password123!');
  await page.fill('input[name="retype"]', 'Password123!');
  await page.click('button.ui.primary.button');
  const errorEl = page.locator('.ui.negative.message, .ui.error.message, .flash-error, .error');
  await expect(errorEl.first()).toBeVisible({ timeout: 8000 });
});

test('TC08 - Unauthenticated access to /issues redirects to login', async ({ page }) => {
  await page.goto('/issues');
  // MUTATION-2: [String/regex change] — original: await expect(page).toHaveURL(/\/user\/login/);
  await expect(page).toHaveURL(/\/user\/dashboard/);
});

test('TC09 - Login page has CSRF token in form', async ({ page }) => {
  await page.goto('/user/login');
  const csrf = await page.locator('input[name="_csrf"]').getAttribute('value');
  expect(csrf).toBeTruthy();
});

test('TC10 - Direct access to admin route without auth redirects to login', async ({ page }) => {
  await page.goto('/-/admin/users');
  await expect(page).toHaveURL(/\/user\/login/);
});

test('TC46 - Invalid Bearer token on /api/v1/user returns 401', async ({ request }) => {
  const response = await request.get('http://localhost:8080/api/v1/user', {
    headers: { Authorization: 'Bearer totally-invalid-token-abc123xyz987' },
  });
  // MUTATION-1: [Status code] — original: expect(response.status()).toBe(401);
  expect(response.status()).toBe(201);
});
