/**
 * user-management.spec.ts
 * Module: User & Organisation Management
 * Risk Level: HIGH (Score 12)
 * Test Cases: TC35–TC39
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, ADMIN_USER, AuthPage, apiRequest, uniqueName } from './helpers';

test('TC35 - Admin can view user list via API', async ({ page }) => {
  await loginAsAdmin(page);
  const { status, data } = await apiRequest(page, 'GET', '/admin/users?limit=10');
  expect(status).toBe(200);
  expect(Array.isArray(data)).toBeTruthy();
  const names = data.map((u: any) => u.login);
  expect(names).toContain(ADMIN_USER);
});

test('TC36 - Admin can create user via API with all fields', async ({ page }) => {
  await loginAsAdmin(page);
  const username = uniqueName('newuser');
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
  expect(data.email).toBe(`${username}@test.local`);
  // Cleanup
  await apiRequest(page, 'DELETE', `/admin/users/${username}`);
});

test('TC37 - Non-admin cannot access /-/admin/users', async ({ page }) => {
  await loginAsAdmin(page);
  const username = uniqueName('regularuser');
  await apiRequest(page, 'POST', '/admin/users', {
    username,
    email: `${username}@test.local`,
    password: 'TestPass123!',
    login_name: username,
    source_id: 0,
    must_change_password: false,
  });

  // Logout admin first so the login page is available
  const auth = new AuthPage(page);
  await auth.logout();
  await page.goto('/user/login');
  await page.fill('input[name="user_name"]', username);
  await page.fill('input[name="password"]', 'TestPass123!');
  await page.click('button.ui.primary.button');

  await page.goto('/-/admin/users');
  const url = page.url();
  const bodyText = await page.content();
  const isBlocked = url.includes('/user/login') ||
    bodyText.includes('Forbidden') ||
    bodyText.includes('Not Found') ||
    await page.locator('.not-found').isVisible({ timeout: 3000 }).catch(() => false);
  expect(isBlocked).toBeTruthy();

  // Cleanup
  await loginAsAdmin(page);
  await apiRequest(page, 'DELETE', `/admin/users/${username}`);
});

test('TC38 - Create an organisation via API', async ({ page }) => {
  await loginAsAdmin(page);
  const orgName = uniqueName('testorg');
  const { status, data } = await apiRequest(page, 'POST', '/orgs', {
    username: orgName,
    visibility: 'public',
  });
  expect(status).toBe(201);
  expect(data.username ?? data.name).toBe(orgName);
  // Cleanup
  await apiRequest(page, 'DELETE', `/orgs/${orgName}`);
});

test('TC39 - GET /api/v1/admin/orgs returns list of organisations', async ({ page }) => {
  await loginAsAdmin(page);
  const { status, data } = await apiRequest(page, 'GET', '/admin/orgs?limit=5');
  expect(status).toBe(200);
  expect(Array.isArray(data)).toBeTruthy();
});
