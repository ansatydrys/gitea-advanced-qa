# Gitea QA Test Suite — Assignment 2

Automated test suite for **Gitea 1.25.5** using Playwright (TypeScript) and Newman (Postman).

**Team A | AITU | April 2026**

---

## Quick Start

```bash
# 1. Install dependencies
npm install
npx playwright install chromium

# 2. Ensure Gitea is running at localhost:8080
docker compose up -d

# 3. Run all E2E tests (91 test cases)
npx playwright test

# 4. Run API tests (25 Newman cases)
npm run test:api

# 5. Open HTML report
npm run report
```

---

## Project Structure

```
.
├── helpers.ts                  # Shared POMs: AuthPage, RepoPage, IssuePage, apiRequest()
├── auth.spec.ts                # TC01–TC20  User Authentication (CRITICAL)
├── repository.spec.ts          # TC21–TC36  Repository Access Control (CRITICAL)
├── admin.spec.ts               # TC37–TC46  Admin Panel (CRITICAL)
├── issues.spec.ts              # TC47–TC54  Issue Tracker (HIGH)
├── input-validation.spec.ts    # TC55–TC69  XSS / Injection (CRITICAL)
├── user-management.spec.ts     # TC70–TC79  User & Org Management (HIGH)
├── git-operations.spec.ts      # TC80–TC91  Git Operations HTTP (CRITICAL)
├── playwright.config.ts
├── package.json
├── tsconfig.json
├── tests/
│   └── api/
│       ├── gitea_api.postman_collection.json   # 25 API tests
│       └── environment.json
└── .github/
    └── workflows/
        └── ci.yml              # GitHub Actions pipeline
```

---

## Test Coverage

| Module | Risk | Test Cases | Script |
|---|---|---|---|
| User Authentication | CRITICAL | TC01–TC20 (20) | auth.spec.ts |
| Repository Access Control | CRITICAL | TC21–TC36 (16) | repository.spec.ts |
| Admin Panel | CRITICAL | TC37–TC46 (10) | admin.spec.ts |
| Issue Tracker | HIGH | TC47–TC54 (8) | issues.spec.ts |
| Input Validation / XSS | CRITICAL | TC55–TC69 (15) | input-validation.spec.ts |
| User & Org Management | HIGH | TC70–TC79 (10) | user-management.spec.ts |
| Git Operations (HTTP) | CRITICAL | TC80–TC91 (12) | git-operations.spec.ts |
| REST API (Newman) | CRITICAL | API01–API25 (25) | gitea_api.postman_collection.json |
| **Total** | | **116** | |

---

## Environment

| Setting | Value |
|---|---|
| Gitea URL | `http://localhost:8080` |
| Admin username | `ansat` |
| Admin password | `Ansat12345` |
| Gitea version | 1.25.5 |
| Node.js | 18 LTS |
| Playwright | 1.42+ |

> **Important:** Gitea's login button has no `type="submit"` attribute.
> All specs use the explicit CSS selector `button.ui.primary.button`.

---

## Run Individual Suites

```bash
npm run test:auth     # Authentication only
npm run test:repo     # Repositories only
npm run test:admin    # Admin panel only
npm run test:issues   # Issue tracker only
npm run test:input    # XSS / input validation
npm run test:users    # User & org management
npm run test:git      # Git operations
npm run test:api      # Newman REST API tests
```
