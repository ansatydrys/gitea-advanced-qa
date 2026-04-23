/**
 * admin.mutant.spec.ts
 * MUTANT COPY of admin.spec.ts with 5 intentional mutations (one per test).
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, ADMIN_USER, apiRequest, uniqueName } from '../helpers';

test('TC18 - Admin dashboard is accessible to admin user', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/-/admin/');
  // MUTATION-4: [Logical negation] — original: await expect(page).not.toHaveURL(/\/user\/login/);
  await expect(page).toHaveURL(/\/user\/login/);
  await expect(page.locator('.admin-setting-content')).toBeVisible({ timeout: 8000 });
});

test('TC19 - Unauthenticated access to admin panel redirects to login', async ({ page }) => {
  // MUTATION-5: [URL change] — original: await page.goto('/-/admin/users');
  await page.goto('/-/admin/configuration');
  await expect(page).toHaveURL(/\/user\/login/);
});

test('TC20 - Admin can create a new user via API', async ({ page }) => {
  await loginAsAdmin(page);
  const username = uniqueName('adminmade');
  const { status, data } = await apiRequest(page, 'POST', '/admin/users', {
    username,
    email: `${username}@test.local`,
    password: 'TestPass123!',
    login_name: username,
    source_id: 0,
    must_change_password: false,
  });
  expect(status).toBe(201);
  // MUTATION-2: [String change] — original: expect(data.login).toBe(username);
  expect(data.login).toBe('completely-wrong-name-xyz');
  await apiRequest(page, 'DELETE', `/admin/users/${username}`);
});

test('TC21 - Admin can delete a user via API', async ({ page }) => {
  await loginAsAdmin(page);
  const username = uniqueName('todelete');
  await apiRequest(page, 'POST', '/admin/users', {
    username,
    email: `${username}@test.local`,
    password: 'TestPass123!',
    login_name: username,
    source_id: 0,
    must_change_password: false,
  });
  const { status } = await apiRequest(page, 'DELETE', `/admin/users/${username}`);
  // MUTATION-3: [Assertion removal] — original: expect(status).toBe(204);
});

test('TC22 - Admin API endpoint /admin/users requires authentication', async ({ request }) => {
  const response = await request.get('http://localhost:8080/api/v1/admin/users');
  expect(response.status()).toBe(401);
});

test('TC49 - Admin API returns conflict when creating duplicate username', async ({ page }) => {
  await loginAsAdmin(page);
  const username = uniqueName('dup-user');
  const userPayload = {
    username,
    email: `${username}@test.local`,
    password: 'TestPass123!',
    login_name: username,
    source_id: 0,
    must_change_password: false,
  };

  const first = await apiRequest(page, 'POST', '/admin/users', userPayload);
  // MUTATION-1: [Status code] — original: expect(first.status).toBe(201);
  expect(first.status).toBe(200);

  const second = await apiRequest(page, 'POST', '/admin/users', userPayload);
  expect(second.status).not.toBe(201);
  expect(second.status).not.toBe(500);
  expect(second.status).toBe(422);

  await apiRequest(page, 'DELETE', `/admin/users/${username}`);
});
