/**
 * repository.spec.ts
 * Module: Repository Access Control (Public / Private)
 * Risk Level: CRITICAL (Score 20)
 * Test Cases: TC11–TC17
 */

import { test, expect } from '@playwright/test';
import {
  loginAsAdmin, ADMIN_USER, BASE_URL,
  AuthPage, RepoPage, uniqueName, apiRequest
} from './helpers';

// ─── TC11–TC12: Repository Creation ──────────────────────────────────────────

test('TC11 - Create a public repository successfully', async ({ page }) => {
  await loginAsAdmin(page);
  const name = uniqueName('pub-repo');
  const repo = new RepoPage(page);
  await repo.createRepo(name, 'Public repo test', false);
  await expect(page).toHaveURL(new RegExp(`/${ADMIN_USER}/${name}`));
  expect(await page.title()).toContain(name);
});

test('TC12 - Create a private repository successfully', async ({ page }) => {
  await loginAsAdmin(page);
  const name = uniqueName('priv-repo');
  const repo = new RepoPage(page);
  await repo.createRepo(name, 'Private repo test', true);
  await expect(page).toHaveURL(new RegExp(`/${ADMIN_USER}/${name}`));
  expect(await page.title()).toContain(name);
});

// ─── TC13–TC14: Access Control ───────────────────────────────────────────────

test('TC13 - Public repository is accessible without login', async ({ page }) => {
  const name = uniqueName('open-repo');
  await loginAsAdmin(page);
  await apiRequest(page, 'POST', '/user/repos', {
    name, private: false, auto_init: true, default_branch: 'main',
  });
  const auth = new AuthPage(page);
  await auth.logout();
  await page.goto(`/${ADMIN_USER}/${name}`);
  await expect(page).not.toHaveURL(/\/user\/login/);
  await expect(page.locator('h1, .repository-title')).toContainText(name);
});

test('TC14 - Private repository is NOT accessible without login', async ({ page }) => {
  const name = uniqueName('secret-repo');
  await loginAsAdmin(page);
  await apiRequest(page, 'POST', '/user/repos', {
    name, private: true, auto_init: false,
  });
  const auth = new AuthPage(page);
  await auth.logout();
  await page.goto(`/${ADMIN_USER}/${name}`);
  const url = page.url();
  const bodyText = await page.content();
  // Gitea returns plain-text "Not found." (no HTML) for private repos accessed anonymously
  const isBlocked = url.includes('/user/login') ||
    bodyText.includes('Not found') ||
    bodyText.includes('Not Found') ||
    bodyText.includes('Forbidden') ||
    await page.locator('.not-found').isVisible({ timeout: 3000 }).catch(() => false);
  expect(isBlocked).toBeTruthy();
});

// ─── TC15–TC17: Repository API ───────────────────────────────────────────────

test('TC15 - API GET /repos/{owner}/{repo} returns 200 for public repo', async ({ page }) => {
  const name = uniqueName('api-pub');
  await loginAsAdmin(page);
  await apiRequest(page, 'POST', '/user/repos', {
    name, private: false, auto_init: false,
  });
  const { status, data } = await apiRequest(page, 'GET', `/repos/${ADMIN_USER}/${name}`);
  expect(status).toBe(200);
  expect(data.name).toBe(name);
});

test('TC16 - API GET /repos/{owner}/{repo} returns 404 for nonexistent repo', async ({ page }) => {
  await loginAsAdmin(page);
  const { status } = await apiRequest(page, 'GET', `/repos/${ADMIN_USER}/this-repo-does-not-exist-xyz`);
  expect(status).toBe(404);
});

test('TC17 - Repo deletion via API removes it from listing', async ({ page }) => {
  const name = uniqueName('del-repo');
  await loginAsAdmin(page);
  await apiRequest(page, 'POST', '/user/repos', {
    name, private: false, auto_init: false,
  });
  const del = await apiRequest(page, 'DELETE', `/repos/${ADMIN_USER}/${name}`);
  expect(del.status).toBe(204);
  const check = await apiRequest(page, 'GET', `/repos/${ADMIN_USER}/${name}`);
  expect(check.status).toBe(404);
});

// ─── TC48: Cross-User Private Repo Access (Integration) ──────────────────────

test('TC48 - Authenticated non-owner cannot access private repo via API', async ({ page }) => {
  // Integration-level: Auth module (who you are) × Repository AC module (what you can see).
  // TC14 covers unauthenticated access; this covers the real-world case of a logged-in
  // but unauthorised user. Gitea intentionally returns 404 (not 403) to avoid leaking repo existence.
  await loginAsAdmin(page);
  const repoName = uniqueName('priv-cross');
  const otherUser = uniqueName('nonowner');

  await apiRequest(page, 'POST', '/user/repos', { name: repoName, private: true, auto_init: false });
  await apiRequest(page, 'POST', '/admin/users', {
    username: otherUser,
    email: `${otherUser}@test.local`,
    password: 'TestPass123!',
    login_name: otherUser,
    source_id: 0,
    must_change_password: false,
  });

  // Fetch the private repo using the non-owner's credentials (inline — one-off, no helper needed)
  const { status } = await page.evaluate(
    async ({ base, owner, repo, user }: { base: string; owner: string; repo: string; user: string }) => {
      const token = btoa(`${user}:TestPass123!`);
      const res = await fetch(`${base}/api/v1/repos/${owner}/${repo}`, {
        headers: { Authorization: `Basic ${token}` },
      });
      return { status: res.status };
    },
    { base: BASE_URL, owner: ADMIN_USER, repo: repoName, user: otherUser }
  );

  expect(status).toBe(404);

  // Cleanup
  await apiRequest(page, 'DELETE', `/repos/${ADMIN_USER}/${repoName}`);
  await apiRequest(page, 'DELETE', `/admin/users/${otherUser}`);
});
