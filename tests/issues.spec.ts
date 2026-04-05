/**
 * issues.spec.ts
 * Module: Issue Tracker (Create / Assign / Close)
 * Risk Level: HIGH (Score 9)
 * Test Cases: TC23–TC27
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, ADMIN_USER, apiRequest, uniqueName } from './helpers';

async function ensureRepo(page: any, name: string) {
  await apiRequest(page, 'POST', '/user/repos', {
    name, private: false, auto_init: true, default_branch: 'main',
  });
  return name;
}

test('TC23 - Create a new issue in a repository', async ({ page }) => {
  await loginAsAdmin(page);
  const repo = await ensureRepo(page, uniqueName('iss-repo'));

  await page.goto(`/${ADMIN_USER}/${repo}/issues/new`);
  await page.fill('input[name="title"]', 'Test Issue TC23');
  await page.click('button.ui.primary.button:has-text("Create Issue")');

  await expect(page).toHaveURL(new RegExp(`/${ADMIN_USER}/${repo}/issues/\\d+`));
  await expect(page.locator('.issue-title, h1').first()).toContainText('Test Issue TC23');
});

test('TC24 - Issue list shows created issues', async ({ page }) => {
  await loginAsAdmin(page);
  const repo = await ensureRepo(page, uniqueName('iss-list'));
  await apiRequest(page, 'POST', `/repos/${ADMIN_USER}/${repo}/issues`, {
    title: 'Listed Issue TC24',
  });

  await page.goto(`/${ADMIN_USER}/${repo}/issues`);
  await expect(page.locator('a:has-text("Listed Issue TC24")')).toBeVisible({ timeout: 8000 });
});

test('TC25 - Issue with empty title is rejected', async ({ page }) => {
  await loginAsAdmin(page);
  const repo = await ensureRepo(page, uniqueName('iss-empty'));

  await page.goto(`/${ADMIN_USER}/${repo}/issues/new`);
  await page.click('button.ui.primary.button:has-text("Create Issue")');

  await expect(page).toHaveURL(new RegExp(`issues/new`));
});

test('TC26 - Close an open issue via UI', async ({ page }) => {
  await loginAsAdmin(page);
  const repo = await ensureRepo(page, uniqueName('iss-close'));
  const { data } = await apiRequest(page, 'POST', `/repos/${ADMIN_USER}/${repo}/issues`, {
    title: 'Issue to close TC26',
  });
  const issueNumber = data.number;

  await page.goto(`/${ADMIN_USER}/${repo}/issues/${issueNumber}`);
  await page.click('button:has-text("Close Issue"), .close-issue-btn');
  await expect(page.locator('.ui.label:has-text("Closed"), .status-label:has-text("Closed")')).toBeVisible({ timeout: 8000 });
});

test('TC27 - Close issue via API and verify state', async ({ page }) => {
  await loginAsAdmin(page);
  const repo = await ensureRepo(page, uniqueName('iss-api-close'));
  const { data: issue } = await apiRequest(page, 'POST', `/repos/${ADMIN_USER}/${repo}/issues`, {
    title: 'API Close TC27',
  });
  const { status, data } = await apiRequest(
    page, 'PATCH',
    `/repos/${ADMIN_USER}/${repo}/issues/${issue.number}`,
    { state: 'closed' }
  );
  expect(status).toBe(201);
  expect(data.state).toBe('closed');
});
