/**
 * git-operations.spec.ts
 * Module: Git Operations (HTTP) — Push / Pull / Clone
 * Risk Level: CRITICAL (Score 16)
 * Test Cases: TC40–TC45
 *
 * These tests validate the API surface for file and branch operations
 * (equivalent to git push/pull) via the Gitea Contents API.
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, ADMIN_USER, apiRequest, uniqueName } from './helpers';

const b64 = (str: string) => Buffer.from(str).toString('base64');

// ─── TC40–TC42: File Operations ───────────────────────────────────────────────

test('TC40 - Create repo with auto-init and verify default branch exists', async ({ page }) => {
  await loginAsAdmin(page);
  const name = uniqueName('git-init');
  const { status, data } = await apiRequest(page, 'POST', '/user/repos', {
    name,
    auto_init: true,
    default_branch: 'main',
  });
  expect(status).toBe(201);
  expect(data.default_branch).toBe('main');

  const { status: branchStatus } = await apiRequest(page, 'GET', `/repos/${ADMIN_USER}/${name}/branches/main`);
  expect(branchStatus).toBe(200);
});

test('TC41 - Create a file via Contents API (equivalent to push)', async ({ page }) => {
  await loginAsAdmin(page);
  const name = uniqueName('git-file');
  await apiRequest(page, 'POST', '/user/repos', {
    name, auto_init: true, default_branch: 'main',
  });

  const { status, data } = await apiRequest(page, 'POST', `/repos/${ADMIN_USER}/${name}/contents/hello.txt`, {
    message: 'Add hello.txt',
    content: b64('Hello from automated test\n'),
    branch: 'main',
  });
  expect(status).toBe(201);
  expect(data.content?.name).toBe('hello.txt');
});

test('TC42 - Read file content from repository via API', async ({ page }) => {
  await loginAsAdmin(page);
  const name = uniqueName('git-read');
  await apiRequest(page, 'POST', '/user/repos', {
    name, auto_init: true, default_branch: 'main',
  });
  await apiRequest(page, 'POST', `/repos/${ADMIN_USER}/${name}/contents/readme.md`, {
    message: 'Add readme',
    content: b64('# Test Repository\n'),
    branch: 'main',
  });

  const { status, data } = await apiRequest(page, 'GET', `/repos/${ADMIN_USER}/${name}/contents/readme.md`);
  expect(status).toBe(200);
  const decoded = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString();
  expect(decoded).toContain('# Test Repository');
});

// ─── TC43–TC45: Branch & Commit Operations ───────────────────────────────────

test('TC43 - Create a new branch via API', async ({ page }) => {
  await loginAsAdmin(page);
  const name = uniqueName('git-branch');
  await apiRequest(page, 'POST', '/user/repos', {
    name, auto_init: true, default_branch: 'main',
  });

  const { status, data } = await apiRequest(page, 'POST', `/repos/${ADMIN_USER}/${name}/branches`, {
    new_branch_name: 'feature/test-branch',
    old_branch_name: 'main',
  });
  expect(status).toBe(201);
  expect(data.name).toBe('feature/test-branch');
});

test('TC44 - List branches returns array including main', async ({ page }) => {
  await loginAsAdmin(page);
  const name = uniqueName('git-branches');
  await apiRequest(page, 'POST', '/user/repos', {
    name, auto_init: true, default_branch: 'main',
  });

  const { status, data } = await apiRequest(page, 'GET', `/repos/${ADMIN_USER}/${name}/branches`);
  expect(status).toBe(200);
  expect(Array.isArray(data)).toBeTruthy();
  const branchNames = data.map((b: any) => b.name);
  expect(branchNames).toContain('main');
});

test('TC45 - Commit history is accessible via API', async ({ page }) => {
  await loginAsAdmin(page);
  const name = uniqueName('git-commits');
  await apiRequest(page, 'POST', '/user/repos', {
    name, auto_init: true, default_branch: 'main',
  });
  await apiRequest(page, 'POST', `/repos/${ADMIN_USER}/${name}/contents/file.txt`, {
    message: 'First commit',
    content: b64('data\n'),
    branch: 'main',
  });

  const { status, data } = await apiRequest(page, 'GET', `/repos/${ADMIN_USER}/${name}/commits?limit=5`);
  expect(status).toBe(200);
  expect(Array.isArray(data)).toBeTruthy();
  expect(data.length).toBeGreaterThan(0);
});

// ─── TC50: Duplicate Branch + Stale SHA (E2E) ────────────────────────────────

test('TC50 - Duplicate branch creation and stale-SHA file update both return conflict errors', async ({ page }) => {
  // E2E-level: full user flow — init repo → create branch → collision → create file → stale SHA update.
  // TC43 covers only the success path. This covers concurrency risk (branch collision)
  // and data integrity (stale SHA), both of which must return structured errors, not 500 panics.
  await loginAsAdmin(page);
  const name = uniqueName('git-conflict');

  await apiRequest(page, 'POST', '/user/repos', { name, auto_init: true, default_branch: 'main' });

  // First branch creation must succeed
  const { status: s1 } = await apiRequest(page, 'POST', `/repos/${ADMIN_USER}/${name}/branches`, {
    new_branch_name: 'feature-collision',
    old_branch_name: 'main',
  });
  expect(s1).toBe(201);

  // Duplicate branch creation must fail with 409 Conflict, not 500
  const { status: s2 } = await apiRequest(page, 'POST', `/repos/${ADMIN_USER}/${name}/branches`, {
    new_branch_name: 'feature-collision',
    old_branch_name: 'main',
  });
  expect(s2).not.toBe(201);
  expect(s2).not.toBe(500);
  expect(s2).toBe(409);

  // Create a file and capture its real SHA
  const { data: fileData } = await apiRequest(page, 'POST', `/repos/${ADMIN_USER}/${name}/contents/data.txt`, {
    message: 'add data',
    content: b64('initial content\n'),
    branch: 'main',
  });
  expect(fileData.content?.sha).toBeTruthy();

  // Attempt to update the file with a completely fabricated (stale/wrong) SHA
  const { status: s3 } = await apiRequest(page, 'PUT', `/repos/${ADMIN_USER}/${name}/contents/data.txt`, {
    message: 'update with wrong sha',
    content: b64('updated content\n'),
    sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    branch: 'main',
  });
  expect(s3).not.toBe(200);
  expect(s3).not.toBe(500);
  expect([409, 422]).toContain(s3);

  // Cleanup
  await apiRequest(page, 'DELETE', `/repos/${ADMIN_USER}/${name}`);
});
