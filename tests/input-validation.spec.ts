/**
 * input-validation.spec.ts
 * Module: Input Validation & XSS / Injection Prevention
 * Risk Level: CRITICAL (Score 16)
 * Test Cases: TC28–TC34
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, ADMIN_USER, apiRequest, uniqueName } from './helpers';

const XSS_BASIC   = '<script>alert("xss")</script>';
const XSS_IMG     = '<img src=x onerror=alert(1)>';
const SQL_INJECT  = "'; DROP TABLE users; --";

// ─── TC28–TC29: XSS Prevention ───────────────────────────────────────────────

test('TC28 - XSS payload in issue title is escaped, not executed', async ({ page }) => {
  await loginAsAdmin(page);
  const repo = uniqueName('xss-issues');
  await apiRequest(page, 'POST', '/user/repos', { name: repo, auto_init: false });

  await page.goto(`/${ADMIN_USER}/${repo}/issues/new`);
  await page.fill('input[name="title"]', XSS_BASIC);
  await page.click('button.ui.primary.button:has-text("Create Issue")');

  let alerted = false;
  page.on('dialog', async (dialog) => {
    alerted = true;
    await dialog.dismiss();
  });

  await expect(page).toHaveURL(new RegExp(`issues/\\d+`));
  expect(alerted).toBe(false);
  const content = await page.locator('.issue-title, h1').first().textContent();
  expect(content).not.toBeNull();
});

test('TC29 - XSS img payload in issue body is sanitised', async ({ page }) => {
  await loginAsAdmin(page);
  const repo = uniqueName('xss-body');
  await apiRequest(page, 'POST', '/user/repos', { name: repo, auto_init: false });

  const { data: issue } = await apiRequest(page, 'POST', `/repos/${ADMIN_USER}/${repo}/issues`, {
    title: 'XSS Body Test TC29',
    body: XSS_IMG,
  });

  let alerted = false;
  page.on('dialog', async (d) => { alerted = true; await d.dismiss(); });

  await page.goto(`/${ADMIN_USER}/${repo}/issues/${issue.number}`);
  await page.waitForLoadState('domcontentloaded');
  expect(alerted).toBe(false);
});

// ─── TC30–TC32: Injection & Boundary Handling ────────────────────────────────

test('TC30 - SQL injection in login field does not return 500', async ({ page }) => {
  await page.goto('/user/login');
  await page.fill('input[name="user_name"]', SQL_INJECT);
  await page.fill('input[name="password"]', SQL_INJECT);
  await page.click('button.ui.primary.button');
  await expect(page.locator('body')).not.toContainText('500');
  await expect(page.locator('body')).not.toContainText('Internal Server Error');
});

test('TC31 - SQL injection in registration username is rejected gracefully', async ({ page }) => {
  await page.goto('/user/sign_up');
  await page.fill('input[name="user_name"]', SQL_INJECT);
  await page.fill('input[name="email"]', 'sqli@test.local');
  await page.fill('input[name="password"]', 'Password123!');
  await page.fill('input[name="retype"]', 'Password123!');
  await page.click('button.ui.primary.button');
  await expect(page.locator('body')).not.toContainText('500');
});

test('TC32 - Long string in input fields does not crash the server', async ({ page }) => {
  const longStr = 'A'.repeat(5000);
  await loginAsAdmin(page);
  await page.goto('/repo/create');
  await page.fill('input[name="repo_name"]', longStr);
  await page.click('button.ui.primary.button');
  await expect(page.locator('body')).not.toContainText('500');
  await expect(page.locator('body')).not.toContainText('panic');
});

// ─── TC33–TC34: Security Headers ─────────────────────────────────────────────

test('TC33 - CSRF token is present on repo creation form', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/repo/create');
  const csrf = await page.locator('input[name="_csrf"]').getAttribute('value');
  expect(csrf).toBeTruthy();
  expect(csrf!.length).toBeGreaterThan(10);
});

test('TC34 - Content-Type header is set on API responses', async ({ page }) => {
  await loginAsAdmin(page);
  const response = await page.goto('/api/v1/version');
  expect(response).not.toBeNull();
  const ct = response!.headers()['content-type'] ?? '';
  expect(ct).toContain('application/json');
});

// ─── TC47: Path-Traversal in Repo Name (Unit) ─────────────────────────────────

test('TC47 - Repository name with path-traversal characters is rejected by API', async ({ page }) => {
  // Unit-level: single API call, no UI.
  // Path-traversal names like "../evil" must not succeed (not 201) and must not panic (not 500).
  await loginAsAdmin(page);
  const { status } = await apiRequest(page, 'POST', '/user/repos', {
    name: '../evil-traversal',
    auto_init: false,
  });
  expect(status).not.toBe(201);
  expect(status).not.toBe(500);
  expect([400, 422]).toContain(status);
});
