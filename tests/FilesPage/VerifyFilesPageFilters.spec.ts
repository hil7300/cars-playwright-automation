import { test, expect } from '../../fixtures';
import { openFileViaSearchbar, selectRandomFilterOption, verifyFilterAppliedSuccessfully } from '../../helpers';
import { logoutAsCurrentUser, navigateToLoginPage } from '../../navigation-helpers';
import { FilesPage } from '../../pages/FilesPage';
import { LoginPage } from '../../pages/LoginPage';
import { APIServices } from '../../services/apiServices';

test.describe('Verify Filter/Sorting on Files Page', () => {
    test('Verify Admin, Bailiff, and Client Roles can sort/search/filter files', async ({ page, request, loginAs }) => {
        test.setTimeout(90 * 1000); // Set timeout to 90 seconds for this test

        // Define the roles to test iteratively
        const rolesToTest = ['basic_admin', 'bailiff', 'client'];

       // Read the environment from process.env (defaults to 'dev' if not set)
        const currentEnv = (process.env.ENV || 'dev').toLowerCase();

        // The specific file we expect to find based on the environment
        const expectedFileRef = currentEnv === 'stg' ? 'BA3AU15725' : 'BA3AU161';

        // Define Search Test Data
        const searchTestCases = [
            { label: 'File Id', value: expectedFileRef },
            { label: 'Account', value: '5195497915008512' },
            { label: 'Serial Number', value: 'KNDPM3AC8N7972487' },
            { label: 'Phone Number', value: '5196581150' },
            { label: 'First Name', value: 'SAMANTHA' },
            { label: 'Last Name', value: 'MCKILLOP' },
        ];

        for (const role of rolesToTest) {
            await test.step(`Action: ${role.toUpperCase()} logs in, searches, and filters files`, async () => {
                // 1. Setup & Login for the current role in the loop
                await navigateToLoginPage(page);
                const loginPage = await LoginPage.getInstance(page);
                await expect(loginPage.login_button).toBeVisible();

                await loginAs(role);

                const filesPage = await FilesPage.getInstance(page);
                await expect(filesPage.search_textbox).toBeVisible();
                await expect(filesPage.clear_all_filters_button).toBeVisible();

                // 2. Execute Searches Iteratively
                for (const testCase of searchTestCases) {
                    await test.step(`Search and validate by ${testCase.label}`, async () => {
                        await filesPage.filterFileBySearching(testCase.value);

                        const filterCardLocator = page
                            .locator('.capitalize')
                            .filter({ hasText: testCase.label })
                            .locator('..');
                        await expect(filterCardLocator).toBeVisible();
                        await expect(filterCardLocator).toContainText(testCase.value);

                        const targetRow = page
                            .locator(filesPage.file_ref_id_cell_selector)
                            .filter({ hasText: new RegExp(`^${expectedFileRef}$`) });
                        await expect(targetRow).toBeVisible();

                        await filesPage.clear_all_filters_button.click();
                        await expect(filterCardLocator).toBeHidden();
                        await expect(filesPage.search_textbox).toBeVisible();
                    });
                }

                // 3. Execute Single Filters

                // --- Province Filter ---
                await filesPage.province_filter_option.click();
                let filterApplied = await selectRandomFilterOption(page);
                await page.waitForTimeout(500);
                const provinceFileCell = page.locator(filesPage.file_province_cell_selector);
                await verifyFilterAppliedSuccessfully(page, provinceFileCell, filterApplied.filterOption, true);
                await filesPage.clear_all_filters_button.click();

                // --- Stage Filter ---
                await filesPage.stage_filter_option.click();
                filterApplied = await selectRandomFilterOption(page);
                await page.waitForTimeout(250);
                const fileStageCells = page.locator(filesPage.file_stage_cell_selector);
                await verifyFilterAppliedSuccessfully(page, fileStageCells, filterApplied.filterOption, true);
                await filesPage.clear_all_filters_button.click();

                // --- Status Filter (Conditional check added here too) ---
                let isStatusFilterVisible = await filesPage.status_filter_option.isVisible();
                if (isStatusFilterVisible) {
                    await filesPage.status_filter_option.click();
                    filterApplied = await selectRandomFilterOption(page);
                    await page.waitForTimeout(250);
                    const fileStatusCells = page.locator(filesPage.file_status_cell_selector);
                    await verifyFilterAppliedSuccessfully(page, fileStatusCells, filterApplied.filterOption, true);
                    await filesPage.clear_all_filters_button.click();
                }

                // --- Client Filter (Condition: Only if role is NOT 'client') ---
                if (role !== 'client') {
                    await filesPage.client_filter_option.click();
                    filterApplied = await selectRandomFilterOption(page);
                    await page.waitForTimeout(250);
                    const fileClientCell = page.locator(filesPage.file_client_cell_selector);
                    await verifyFilterAppliedSuccessfully(page, fileClientCell, filterApplied.filterOption, true);
                    await filesPage.clear_all_filters_button.click();
                }

                // 4. Execute Multi-Filters
                await test.step(`Apply Multi-Filters for ${role.toUpperCase()}`, async () => {
                    let firstFilterApplied, secondFilterApplied;
                    let firstFilterName = role !== 'client' ? 'Client' : 'Province';
                    let firstFilterSelector =
                        role !== 'client' ? filesPage.file_client_cell_selector : filesPage.file_province_cell_selector;

                    // Apply First Filter (Client for Admin/Bailiff, Province for Client)
                    if (role !== 'client') {
                        await expect(filesPage.client_filter_option).toBeVisible();
                        await filesPage.client_filter_option.click();
                        firstFilterApplied = await selectRandomFilterOption(page);
                    } else {
                        await expect(filesPage.province_filter_option).toBeVisible();
                        await filesPage.province_filter_option.click();
                        firstFilterApplied = await selectRandomFilterOption(page);
                    }
                    await page.waitForTimeout(1000);
                    // Apply Second Filter (Conditional)
                    isStatusFilterVisible = await filesPage.status_filter_option.isVisible();
                    if (isStatusFilterVisible) {
                        await expect(filesPage.status_filter_option).toBeVisible();
                        await filesPage.status_filter_option.click();
                        secondFilterApplied = await selectRandomFilterOption(page);
                        await page.waitForTimeout(250);
                    }

                    // Validate First Filter Card & Data (Always Happens)
                    const firstFilterCard = page
                        .locator('.capitalize')
                        .filter({ hasText: firstFilterName })
                        .locator('..');
                    await expect(firstFilterCard).toBeVisible();
                    await expect(firstFilterCard).toContainText(firstFilterApplied.filterOption);

                    const multiFirstCells = page.locator(firstFilterSelector);
                    await verifyFilterAppliedSuccessfully(page, multiFirstCells, firstFilterApplied.filterOption, true);

                    // Validate Second Filter Card & Data (Only if Status was visible and applied)
                    isStatusFilterVisible = await filesPage.status_filter_option.isVisible();
                    if (isStatusFilterVisible && secondFilterApplied) {
                        const statusFilterCard = page
                            .locator('.capitalize')
                            .filter({ hasText: 'Status' })
                            .locator('..')
                            .last();
                        await expect(statusFilterCard).toBeVisible();
                        await expect(statusFilterCard).toContainText(secondFilterApplied.filterOption);

                        const multiStatusCells = page.locator(filesPage.file_status_cell_selector);
                        await verifyFilterAppliedSuccessfully(
                            page,
                            multiStatusCells,
                            secondFilterApplied.filterOption,
                            true
                        );
                    }

                    // Clean up Multi-Filters
                    await filesPage.clear_all_filters_button.click();
                });

                // 5. Logout before next iteration
                await logoutAsCurrentUser(page);
            });
        }
    });
});
