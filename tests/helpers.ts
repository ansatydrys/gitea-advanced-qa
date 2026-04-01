import { Page, expect } from '@playwright/test';

// ─── Constants ────────────────────────────────────────────────────────────────
export const BASE_URL   = 'http://localhost:8080';
export const ADMIN_USER = 'ansat';
export const ADMIN_PASS = 'Ansat12345';

// ─── Page Object: Auth ────────────────────────────────────────────────────────
export class AuthPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/user/login');
  }

  async login(username: string, password: string) {
    await this.page.goto('/user/login');
    await this.page.waitForLoadState('domcontentloaded');
    // If Gitea redirected us away (already authenticated), we're done
    if (!this.page.url().includes('/user/login')) return;
    await this.page.fill('input[name="user_name"]', username);
    await this.page.fill('input[name="password"]', password);
    // Gitea's login button lacks type="submit" — must target by CSS class
    await this.page.click('button.ui.primary.button');
  }

  async logout() {
    // Clear all browser cookies — the most reliable way to end the session.
    // Gitea 1.25.5+ uses POST-only logout with CSRF, which is fragile to automate;
    // clearing cookies achieves the same result (session cookie removed).
    await this.page.context().clearCookies();
    await this.page.goto('/user/login');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async register(username: string, email: string, password: string) {
    await this.page.goto('/user/sign_up');
    await this.page.fill('input[name="user_name"]', username);
    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
    await this.page.fill('input[name="retype"]', password);
    await this.page.click('button.ui.primary.button');
  }

  async isLoggedIn(): Promise<boolean> {
    return this.page.locator('.dashboard, .user-menu, [data-url="/user/settings"]').isVisible({ timeout: 5000 }).catch(() => false);
  }
}

// ─── Page Object: Repository ──────────────────────────────────────────────────
export class RepoPage {
  constructor(private page: Page) {}

  async createRepo(name: string, description = '', isPrivate = false) {
    await this.page.goto('/repo/create');
    await this.page.fill('input[name="repo_name"]', name);
    if (description) {
      await this.page.fill('textarea[name="description"], input[name="description"]', description);
    }
    if (isPrivate) {
      await this.page.check('input[name="private"]');
    }
    await this.page.click('button.ui.primary.button');
    await this.page.waitForURL(`**/${ADMIN_USER}/${name}**`);
  }

  async deleteRepo(owner: string, repoName: string) {
    await this.page.goto(`/${owner}/${repoName}/settings`);
    await this.page.click('button.ui.red.button:has-text("Delete This Repository"), .danger button:has-text("Delete")');
    // Fill the confirmation input
    const confirmInput = this.page.locator('input#repo-name');
    if (await confirmInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmInput.fill(repoName);
    }
    await this.page.click('.ui.red.button:has-text("Understand"), button:has-text("I understand")');
  }

  repoUrl(owner: string, name: string) {
    return `${BASE_URL}/${owner}/${name}`;
  }
}

// ─── Page Object: Issue ───────────────────────────────────────────────────────
export class IssuePage {
  constructor(private page: Page) {}

  async create(owner: string, repo: string, title: string, body = '') {
    await this.page.goto(`/${owner}/${repo}/issues/new`);
    await this.page.fill('input[name="title"]', title);
    if (body) {
      await this.page.fill('.CodeMirror-scroll, textarea[name="content"]', body);
    }
    await this.page.click('button.ui.primary.button:has-text("Submit")');
  }

  async closeIssue(owner: string, repo: string, issueNumber: number) {
    await this.page.goto(`/${owner}/${repo}/issues/${issueNumber}`);
    await this.page.click('button:has-text("Close Issue"), .close-issue');
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Generate a unique name to avoid state collisions between test runs */
export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

/** Login as admin and return the page (already authenticated) */
export async function loginAsAdmin(page: Page): Promise<void> {
  const auth = new AuthPage(page);
  await auth.login(ADMIN_USER, ADMIN_PASS);
  // If Gitea redirected away from login (already authenticated), we're good.
  // If we're still on login page, the fill+click above should have logged us in.
  await page.waitForLoadState('domcontentloaded');
  await expect(page).not.toHaveURL(/\/user\/login/);
}

/** Assert an alert/flash message contains text */
export async function expectFlash(page: Page, text: string): Promise<void> {
  const flash = page.locator('.ui.message, .flash-message, .ui.positive.message, .ui.negative.message, .ui.error.message');
  await expect(flash).toContainText(text, { timeout: 8000 });
}

/** Call Gitea REST API and return parsed JSON */
export async function apiRequest(
  page: Page,
  method: string,
  path: string,
  body?: object
): Promise<{ status: number; data: any }> {
  const token = Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64');
  const result = await page.evaluate(
    async ({ method, path, body, token, base }) => {
      const res = await fetch(`${base}/api/v1${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      let data: any;
      try { data = await res.json(); } catch { data = null; }
      return { status: res.status, data };
    },
    { method, path, body, token, base: BASE_URL }
  );
  return result;
}
