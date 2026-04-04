/**
 * admin.spec.ts
 * Module: Admin Panel & Site Administration
 * Risk Level: CRITICAL (Score 15)
 * Test Cases: TC18–TC22
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, ADMIN_USER, apiRequest, uniqueName } from './helpers';

test('TC18 - Admin dashboard is accessible to admin user', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/-/admin/');
  await expect(page).not.toHaveURL(/\/user\/login/);
  await expect(page.locator('.admin-setting-content')).toBeVisible({ timeout: 8000 });
});

test('TC19 - Unauthenticated access to admin panel redirects to login', async ({ page }) => {
  await page.goto('/-/admin/users');
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
  expect(data.login).toBe(username);
  // Cleanup
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
  expect(status).toBe(204);
});

test('TC22 - Admin API endpoint /admin/users requires authentication', async ({ request }) => {
  // Use Playwright's request context (no session cookies) to verify the endpoint requires auth
  const response = await request.get('http://localhost:8080/api/v1/admin/users');
  expect(response.status()).toBe(401);
});
