import { test, expect } from '../../fixtures';
import { navigateToLoginPage } from '../../navigation-helpers';
import { LoginPage } from '../../pages/LoginPage';
import { FilesPage } from '../../pages/FilesPage';
import { CompaniesPage } from '../../pages/CompaniesPage';
import { selectRandomFilterOption, verifyFilterAppliedSuccessfully } from '../../helpers';

test.describe('Companies Page Filters Validation', () => {
    test('Check Activity Type and Province Filters on Companies Page', async ({ page, loginAs }) => {
        let companiesPage: CompaniesPage;

        await test.step('Setup: Log in as Super Admin and navigate to Companies page', async () => {
            await navigateToLoginPage(page);
            const loginPage = await LoginPage.getInstance(page);
            await expect(loginPage.login_button).toBeVisible();

            await loginAs('super_admin');

            const filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.search_textbox).toBeVisible();
            await filesPage.companies_button.click();

            companiesPage = await CompaniesPage.getInstance(page);
        });

        await test.step('Apply and verify Activity Type filter', async () => {
            await companiesPage.activity_type_filter_option.click();
            const filterApplied = await selectRandomFilterOption(page);

            // Wait briefly for the network request/UI rendering to trigger
            await page.waitForTimeout(500);

            const activityTypeCells = page.locator(companiesPage.activity_type_cell_selector);
            await expect(activityTypeCells.first()).toBeVisible({ timeout: 5000 });

            await verifyFilterAppliedSuccessfully(page, activityTypeCells, filterApplied.filterOption, true);
        });

        await test.step('Clear filters and apply Province filter', async () => {
            await companiesPage.clear_all_filters.click();

            await companiesPage.province_filter_option.click();
            const filterApplied = await selectRandomFilterOption(page);

            // Wait briefly for the network request/UI rendering to trigger
            await page.waitForTimeout(500);

            const addressCells = page.locator(companiesPage.address_cell_selector);
            await expect(addressCells.first()).toBeVisible({ timeout: 5000 });

            await verifyFilterAppliedSuccessfully(page, addressCells, filterApplied.filterOption, true);
        });
    });
});
