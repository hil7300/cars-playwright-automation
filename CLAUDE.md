# CARS Playwright Automation — Project Guide

## Project Overview

This is a Playwright-based end-to-end test automation framework for the CARS (Canadian Asset Recovery System) web application. It tests file management, vendor invoices, user roles, accounting workflows, and remarketing flows across `dev`, `stg`, and `prod` environments.

---

## Architecture

```
cars_playwright_automation/
├── tests/                          # All test spec files
│   ├── FileStagesAndStatusesTests/ # File stage/status lifecycle tests
│   ├── FiltersAndNavigationTests/  # UI filter and nav visibility tests
│   ├── VendorInvoiceTests/         # Vendor invoice workflow tests
│   ├── CreateAllAssetTypeFiles.spec.ts
│   └── FileFormGeneration.spec.ts
├── pages/                          # Page Object Model (POM) classes
│   ├── FilePages/                  # File-level sub-page objects
│   │   ├── FileHomePage.ts         # Base class for all file sub-pages
│   │   ├── FileSideBar.ts          # Sidebar with stage/status controls
│   │   ├── Assignments.ts
│   │   ├── Accounting.ts
│   │   ├── VendorInvoices.ts
│   │   ├── Remarketing.ts
│   │   ├── RepoDetails.ts
│   │   ├── AssetDetails.ts
│   │   ├── RelatedParties.ts
│   │   ├── SkipTraces.ts
│   │   ├── OtherRecoveries.ts
│   │   ├── Requests.ts
│   │   ├── Documents.ts
│   │   ├── Forms.ts
│   │   └── Notes.ts
│   ├── FilesPage.ts                # Main files listing page
│   ├── LoginPage.ts
│   ├── CreateFilePage.ts
│   ├── InvoicePage.ts
│   ├── MessagesPage.ts
│   ├── CompaniesPage.ts
│   ├── UsersPage.ts
│   ├── RemarketingPage.ts
│   ├── ReportsPage.ts
│   ├── SettingsPage.ts
│   └── MyAccountPage.ts
├── services/
│   └── apiServices.ts              # API layer for test setup/teardown
├── fixtures.ts                     # Custom Playwright fixtures (loginAs)
├── credential-manager.ts           # Handles local + CI credential resolution
├── helpers.ts                      # Shared utility functions
├── navigation-helpers.ts           # Page navigation utilities
├── globals.ts                      # Global re-exports (links, credentials, allure)
├── env.ts                          # Environment variable accessors
├── links.json                      # URLs per environment (login, API)
├── credentials.json                # Local credentials (gitignored, NOT for CI)
├── playwright.config.ts            # Playwright configuration
├── tsconfig.json                   # TypeScript configuration
├── parse-summary.ts                # Parses test report JSON into summary.txt
├── rename-report.ts                # Renames allure report with date
├── test-resources/                 # Static test files (PDFs, images)
└── .github/workflows/              # CI pipelines (dev, stg, prod)
```

---

## Critical Conventions

### 1. Imports — Always Use Custom Fixtures

```typescript
// CORRECT — always import from fixtures.ts
import { test, expect } from '../fixtures';
// or
import { test, expect } from '../../fixtures';

// WRONG — never import test directly from Playwright
import { test, expect } from '@playwright/test';
```

The custom `test` object provides the `loginAs` fixture for parallel-safe authentication.

### 2. Page Object Pattern — Singleton with `getInstance()`

Every page object follows this exact pattern:

```typescript
import { expect, Locator, Page } from '@playwright/test';

export class ExamplePage {
    protected page: Page;

    // Locators as class properties
    some_button: Locator;
    some_textbox: Locator;
    some_cell_selector: string = '[data-cy="some-cell"]'; // CSS selectors as strings

    // Use 'protected' constructor if this class will be extended, 'private' otherwise
    protected constructor(page: Page) {
        this.page = page;
    }

    // Initialize locators here — NOT in the constructor
    protected async initialize() {
        this.some_button = this.page.getByRole('button', { name: 'Example' });
        this.some_textbox = this.page.getByRole('textbox', { name: 'Example' });
    }

    // Static factory — this is how tests create page instances
    static async getInstance(page: Page) {
        const instance = new ExamplePage(page);
        await instance.initialize();
        return instance;
    }

    // Action methods encapsulate multi-step workflows
    async doSomething(param: string) {
        await expect(this.some_button).toBeVisible();
        await this.some_button.click();
        // ...
    }
}
```

**Key rules:**
- Locators are assigned in `initialize()`, not the constructor.
- Locator assignments do NOT need `await` — Playwright locators are synchronous.
- Use `getByRole`, `getByPlaceholder`, `getByText` over raw CSS selectors when possible.
- Store raw CSS selectors as `string` class properties (with `_selector` suffix) for cases where you need `page.locator(selector)` dynamically.

### 3. File Sub-Pages — Extend `FileHomePage`

All pages within an open file extend `FileHomePage`:

```typescript
import { FileHomePage } from './FileHomePage';

export class NewSection extends FileHomePage {

    some_locator: Locator;

    protected constructor(page: Page) {
        super(page);
    }

    protected async initialize() {
        // Do NOT call super.initialize() — FileHomePage locators are inherited
        this.some_locator = this.page.getByRole('heading', { name: 'Section Title' });
    }

    static async getInstance(page: Page) {
        const instance = new NewSection(page);
        await instance.initialize();
        return instance;
    }
}
```

### 4. Authentication — Use `loginAs` Fixture

```typescript
test('My test', async ({ page, request, loginAs }) => {
    await navigateToLoginPage(page);
    const loginPage = await LoginPage.getInstance(page);
    await expect(loginPage.login_button).toBeVisible();

    await loginAs('super_admin');   // Uses CredentialManager for parallel-safe login
    // Available roles: 'super_admin', 'basic_admin', 'manager_admin', 'bailiff', etc.
});
```

### 5. Test Data Setup — Use API Services

```typescript
// Create API service instance (auto-authenticates)
const apiService = await APIServices.create(request);

// Create a test file via API (returns account number)
const accountNumber = await apiService.createNewAutoAssetFileViaAPI();

// Navigate to the file in the UI
const fileRef = await openFileViaSearchbar(page, accountNumber);

// Cleanup after test
await apiService.deleteFile(fileRef);
```

### 6. Test Structure — Use `test.step()` Blocks

Every test with multiple logical phases must use named steps:

```typescript
test('Descriptive test name', async ({ page, request, loginAs }) => {
    test.setTimeout(60000); // Set timeout if test is long

    let apiService: APIServices;
    let fileRef: string;

    // ─── SETUP ────────────────────────────────────────────────
    await test.step('Setup: Create file and navigate', async () => {
        apiService = await APIServices.create(request);
        const accountNumber = await apiService.createNewAutoAssetFileViaAPI();
        await navigateToLoginPage(page);
        await loginAs('super_admin');
        fileRef = await openFileViaSearchbar(page, accountNumber);
    });

    // ─── ACTION & ASSERTION ───────────────────────────────────
    await test.step('Verify something specific', async () => {
        const fileHomePage = await FileHomePage.getInstance(page);
        await expect(fileHomePage.assignmentOption).toBeVisible();
        // ... actions and assertions
    });

    // ─── CLEANUP ──────────────────────────────────────────────
    await test.step('Cleanup: Delete test file via API', async () => {
        if (apiService && fileRef) {
            await apiService.deleteFile(fileRef);
        }
    });
});
```

### 7. Data-Driven Tests — Loop with Constant Mapping

For testing multiple variants of the same flow:

```typescript
const TEST_DATA: Record<string, string[]> = {
    "Stage Name": ["Status 1", "Status 2", "Status 3"],
    "Another Stage": ["Status A", "Status B"]
};

for (const [stage, statuses] of Object.entries(TEST_DATA)) {
    test(`Verify flow for: ${stage}`, async ({ page, request, loginAs }) => {
        // Each iteration gets its own independent test
        for (const status of statuses) {
            await test.step(`Check status: "${status}"`, async () => {
                // ... assertions per status
            });
        }
    });
}
```

### 8. Navigation Helpers

```typescript
import { navigateToLoginPage, navigateToSection, logoutAsCurrentUser, navigateToInvoicesPage } from '../navigation-helpers';
import { openFileViaSearchbar, openRandomFile } from '../helpers';

// Navigate to login page
await navigateToLoginPage(page);

// Open a specific file by account number or ref ID
const fileRef = await openFileViaSearchbar(page, accountNumber);

// Open a random file (for smoke tests)
await openRandomFile(page);

// Switch between users mid-test
await logoutAsCurrentUser(page);
await loginAs('another_role');
```

### 8a. Shared Helpers from `helpers.ts`

Prefer reusing these over inlining logic:

```typescript
import {
    getTodaysDate, getFutureDate, getPastDate,     // MM-DD-YYYY date strings
    getDaysDifference, getEndOfMonthDate,          // Date arithmetic
    generateRandomAccountNumber,                   // Unique numeric string
    approveVendorInvoice, extractPdfText,          // Workflow / PDF utilities
} from '../helpers';

// Example — use getTodaysDate() instead of hardcoding dates in tests
const today = await getTodaysDate();
await someDateTextbox.fill(today);
```

### 9. Page Object Method Design — Use Optional Params with Defaults

```typescript
// Good: Optional object parameter with defaults
async addFeeEntry({
    feeCategory = 'Fee',
    corporationType = 'Admin',
    amount = '100',
}: {
    feeCategory?: 'Fee' | 'Credit',
    corporationType?: string,
    amount?: string,
} = {}) {
    // Can be called as: await accounting.addFeeEntry()
    // Or: await accounting.addFeeEntry({ amount: '500' })
}
```

### 10. Multi-Role Tests — Logout/Login Pattern

```typescript
// Admin does something
await loginAs('basic_admin');
// ... admin actions ...

// Switch to Bailiff
await logoutAsCurrentUser(page);
await loginAs('bailiff');
// ... bailiff actions ...

// Switch to Manager Admin
await logoutAsCurrentUser(page);
await loginAs('manager_admin');
// ... manager admin actions ...
```

### 11. Common UI Interaction Patterns

**React-select dropdowns** — click the dropdown locator, then pick the option by visible name:

```typescript
await remarketing.sale_channel_dropdown.click();
await page.getByRole('option', { name: 'Direct to Dealer', exact: true }).click();
```

**Date textboxes** — fill with MM-DD-YYYY, then press Tab so the date picker commits the value before the next action:

```typescript
await repoDetails.contract_date_textbox.fill('03-02-2024');
await page.keyboard.press('Tab');
```

**Save-button wait** — form submissions often re-render. Follow saves with `waitForTimeout(500–1000)` rather than asserting on the next field immediately:

```typescript
await someSaveButton.click();
await page.waitForTimeout(500);
```

### 12. Test Data Constants — Define at Top of Spec File

Use `const` objects declared above the `test.describe` block for any test data referenced more than once, or that future assertions will need to compare against. Values should be raw strings (UI form inputs) so the same constant feeds both the fill and the assertion.

```typescript
const VEHICLE_DATA = {
    vin: '5TFDY5F14LX945732',
    year: '2020',
    make: 'Toyota',
    // ...
};

const REMARKETING_DATA = {
    saleAmount: '25000',
    saleChannel: 'Direct to Dealer',
    // ...
};

// Fill once...
await remarketing.sale_amount_textbox.fill(REMARKETING_DATA.saleAmount);

// ...assert later without re-declaring values
await expect(dashboard.sale_amount_display).toContainText(REMARKETING_DATA.saleAmount);
```

For multi-variant data-driven tests use the `Record<string, string[]>` mapping pattern in section 7 instead.

---

## File Placement Rules

| What you're creating | Where it goes |
|---|---|
| New test file | `tests/` or `tests/<FeatureFolder>/` (PascalCase, no spaces) |
| New top-level page object | `pages/` |
| New file sub-page (within an open file) | `pages/FilePages/` — extend `FileHomePage` |
| New shared utility function | `helpers.ts` |
| New navigation function | `navigation-helpers.ts` |
| New API endpoint method | `services/apiServices.ts` |
| New test resource (PDF, image) | `test-resources/` |

---

## Environment Configuration

- **Environment variable:** `ENV` — values: `dev`, `stg`, `prod` (defaults to `dev`)
- **Login URLs:** Defined in `links.json` under `loginPages`
- **API base URLs:** Defined in `links.json` under `apiEndpoints`
- **Credentials (local):** `credentials.json` — structured as `{ env: { userType: [{ username, password }] } }`
- **Credentials (CI):** GitHub Secrets named `CARS_{ENV}_{USERTYPE}_USERNAME` / `PASSWORD`

---

## NPM Scripts

```bash
npm run dev:test          # Run all tests on dev
npm run stg:test          # Run all tests on stg
npm run prod:test         # Run all tests on prod
npm run dev:smoke         # Run @smoke tagged tests on dev
npm run stg:smoke         # Run @smoke tagged tests on stg
npm run prod:smoke        # Run @smoke tagged tests on prod
npm run smoke:test        # Run @smoke tests (default env)
```

Tag smoke tests with `@smoke` in the test name:
```typescript
test('My critical flow @smoke', async ({ page, loginAs }) => { ... });
```

---

## Checklist for Creating a New Test

1. Create the spec file in the correct `tests/` subfolder.
2. Import `test` and `expect` from `fixtures.ts` (never from `@playwright/test`).
3. Use `loginAs` fixture for authentication.
4. Use `APIServices.create(request)` for test data setup when needed.
5. Use `test.step()` for every logical phase.
6. Create or reuse page objects via `ClassName.getInstance(page)`.
7. If you need new locators, add them to the relevant page object's `initialize()` method.
8. If you need a new page object for a file sub-page, extend `FileHomePage`.
9. Clean up test data via `apiService.deleteFile(fileRef)`.
10. Tag with `@smoke` if it should run in production pipelines.
