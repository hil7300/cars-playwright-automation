import { test, expect } from '../../fixtures';
import { navigateToLoginPage, navigateToSection } from '../../navigation-helpers';
import { LoginPage } from '../../pages/LoginPage';
import { FilesPage } from '../../pages/FilesPage';
import { CompaniesPage } from '../../pages/CompaniesPage';

// ─── TEST DATA ──────────────────────────────────────────────────────────────

const COMPANY_DATA = {
    name: 'Automated Fees Test Company Ltd.',
    activityType: 'Client',
    code: 'ATC',
    phone: '4379874567',
    country: 'Canada',
    province: 'Ontario',
    city: 'Toronto',
    postalCode: 'M5V 2K7',
    street: '123 Test Ave',
    taxationProvince: 'Ontario',
    email: 'billing@autotest.com',
    website: 'www.autotest.com'
} as const;

const FEE_DATA = {
    type: 'Admin Fee',
    fileTypes: ['Sold', 'Redemption'],
    flatRate: '20',
    tier2Min: '100',
    percentageRate: '10',
    basedOn: 'Sale Total'
} as const;

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

test.describe('Company Creation & Automated Fees Validation', () => {

    test('Validate Company Creation, Multi-Tier Fee Schedules, and Deletion', async ({ page, loginAs }) => {
        let companiesPage: CompaniesPage;
        let companyCreated = false; // Flag to ensure teardown only runs if needed

        await test.step('Setup: Log in as Super Admin and navigate to Companies', async () => {
            await navigateToLoginPage(page);
            const loginPage = await LoginPage.getInstance(page);
            await expect(loginPage.login_button).toBeVisible();

            await loginAs('super_admin');

            const filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.companies_button).toBeVisible();
            await expect(filesPage.notifications_button).toBeVisible();
            await expect(filesPage.create_file_button).toBeVisible();
            await page.waitForTimeout(500); // Adding slight delay to ensure page has fully loaded before navigating

            await filesPage.companies_button.click(); // Adding slight delay to ensure page transition
            companiesPage = await CompaniesPage.getInstance(page);

            await expect(companiesPage.create_company_button).toBeVisible();
            await expect(companiesPage.search_textbox).toBeVisible();
        });

        try {
            await test.step('1: Create a new company', async () => {
                await companiesPage.createCompany(COMPANY_DATA);
                companyCreated = true;
                await page.waitForTimeout(250); // Wait for company to be created and appear in search results
                // Verify company appears in search
                await expect(companiesPage.search_textbox).toBeVisible();
                await companiesPage.searchCompanyByName(COMPANY_DATA.name);

                const companyRow = page.locator(companiesPage.company_row_selector).filter({ hasText: COMPANY_DATA.name });
                await expect(companyRow).toBeVisible();
            });

            await test.step('2: Navigate to Automated Fees tab', async () => {
                const companyRow = page.locator(companiesPage.company_row_selector).filter({ hasText: COMPANY_DATA.name });
                const editButton = companyRow.locator(companiesPage.edit_company_button);

                await expect(editButton).toBeVisible();
                await editButton.click();

                await expect(companiesPage.fees_tab).toBeVisible();
                await companiesPage.fees_tab.click();
            });

            await test.step('3: Verify conditional visibility of File Type dropdown based on Fee Type', async () => {
                await expect(companiesPage.create_fee_schedule_button).toBeVisible();
                await companiesPage.create_fee_schedule_button.click();

                await expect(companiesPage.fee_type_dropdown).toBeVisible();
                await expect(companiesPage.file_type_dropdown).toBeHidden();

                // Helper function to test dynamic visibility
                const selectFeeAndVerifyFileTypeVisibility = async (feeName: string, shouldBeVisible: boolean) => {
                    await companiesPage.fee_type_dropdown.click();
                    await page.getByRole('option', { name: feeName, exact: true }).click();
                    if (shouldBeVisible) {
                        await expect(companiesPage.file_type_dropdown).toBeVisible();
                    } else {
                        await expect(companiesPage.file_type_dropdown).toBeHidden();
                    }
                };

                await selectFeeAndVerifyFileTypeVisibility('Admin Fee', true);
                await selectFeeAndVerifyFileTypeVisibility('Brokerage Fee', true);
                await selectFeeAndVerifyFileTypeVisibility('Carfax Fee', false);
                await selectFeeAndVerifyFileTypeVisibility('Credit Bureau Fee', false);
                await selectFeeAndVerifyFileTypeVisibility('Insurance Fee', false);
                await selectFeeAndVerifyFileTypeVisibility('Postage Fee', false);
                await selectFeeAndVerifyFileTypeVisibility('PPSA Amendment Fee', false);
                await selectFeeAndVerifyFileTypeVisibility('PPSA Search Fee', false);
                await selectFeeAndVerifyFileTypeVisibility('Redemption Fee', true);
                await selectFeeAndVerifyFileTypeVisibility('VIN Search Fee', false);
                await selectFeeAndVerifyFileTypeVisibility('Warranty Fee', false);
            });

            await test.step('4: Create a Flat Fee Schedule (Single Tier)', async () => {
                // Select target Fee Type
                await companiesPage.fee_type_dropdown.click();
                await page.getByRole('option', { name: FEE_DATA.type }).click();
                await expect(companiesPage.file_type_dropdown).toBeVisible();

                // Select File Types
                await companiesPage.file_type_dropdown.click();
                await page.getByRole('option', { name: FEE_DATA.fileTypes[0], exact: true }).click();
                await expect(page.locator(companiesPage.selected_file_type_card_selector).filter({ hasText: FEE_DATA.fileTypes[0] })).toBeVisible();

                await companiesPage.file_type_dropdown.click();
                await page.getByRole('option', { name: FEE_DATA.fileTypes[1], exact: true }).click();
                await expect(page.locator(companiesPage.selected_file_type_card_selector).filter({ hasText: FEE_DATA.fileTypes[1] })).toBeVisible();

                // Save Initial Schedule
                await expect(companiesPage.save_fee_schedule_button).toBeVisible();
                await companiesPage.save_fee_schedule_button.click();

                // Fill Flat Fee Amount
                const minTierTextbox = page.locator(companiesPage.tier_min_textbox_selector);
                const maxTierTextbox = page.locator(companiesPage.tier_max_textbox_selector);
                const unlimitedMaxTierTextbox = page.locator(companiesPage.tier_unlimited_max_textbox_selector);
                const tierValueFlatFeeTextbox = page.locator(companiesPage.tier_value_flat_fee_textbox_selector);
                const firstTypeDropdown = page.locator(companiesPage.getTypeDropdownSelector(0));

                await expect(minTierTextbox).toBeVisible();
                await expect(maxTierTextbox).toBeHidden();
                await expect(unlimitedMaxTierTextbox).toBeVisible();
                await expect(firstTypeDropdown).toBeVisible();
                await expect(tierValueFlatFeeTextbox).toBeVisible();

                await tierValueFlatFeeTextbox.fill(FEE_DATA.flatRate);
                await companiesPage.save_fee_schedule_button.click();

                // Assert Row Details
                const automatedFeeRow = page.locator(companiesPage.fee_schedule_row_selector).filter({ hasText: FEE_DATA.type });
                await expect(automatedFeeRow).toBeVisible();
                await expect(automatedFeeRow).toHaveText(/20.00/);
                await expect(automatedFeeRow).toHaveText(/Unlimited/);
                await expect(automatedFeeRow).toHaveText(/Sold/);
                await expect(automatedFeeRow).toHaveText(/Redemption/);
                await expect(automatedFeeRow).toHaveText(/Admin Fee/);
                await expect(automatedFeeRow).toHaveText(/Flat Fee/);
            });

            await test.step('5: Add a second tier (Percentage) and validate "Based On" requirements', async () => {
                const automatedFeeRow = page.locator(companiesPage.fee_schedule_row_selector).filter({ hasText: FEE_DATA.type });
                await automatedFeeRow.locator(companiesPage.fee_schedule_edit_button_selector).click();

                await expect(companiesPage.add_tier_button).toBeVisible();
                await expect(companiesPage.remove_tier_button).toBeHidden();
                await companiesPage.add_tier_button.click();

                const maxTierTextbox = page.locator(companiesPage.tier_max_textbox_selector);
                await expect(companiesPage.remove_tier_button).toBeVisible();
                await expect(maxTierTextbox).toBeVisible();

                // Add Tier 2 Values
                const minTierTextbox = page.locator(companiesPage.tier_min_textbox_selector);
                await minTierTextbox.nth(1).fill(FEE_DATA.tier2Min);

                const secondTypeDropdown = page.locator(companiesPage.getTypeDropdownSelector(1));
                await secondTypeDropdown.click();
                await page.getByRole('option', { name: 'Percentage' }).click();

                const tierValuePercentageTextbox = page.locator(companiesPage.tier_value_percentage_textbox_selector);
                await expect(tierValuePercentageTextbox).toBeVisible();
                await tierValuePercentageTextbox.fill(FEE_DATA.percentageRate);

                // Save and catch the expected validation error
                await companiesPage.save_fee_schedule_button.click();
                await expect(page.getByText('Based On required when multiple tiers or when using a percentage tier')).toBeVisible();

                // Fix validation error by providing a "Based On" value
                await companiesPage.fee_based_on_dropdown.click();
                await expect(page.getByRole('option', { name: FEE_DATA.basedOn })).toBeVisible();
                await page.getByRole('option', { name: FEE_DATA.basedOn }).click();
                await companiesPage.save_fee_schedule_button.click();

                // Assert Updated Row Details
                await expect(automatedFeeRow).toBeVisible();
                await expect(automatedFeeRow).toHaveText(/10%/);
                await expect(automatedFeeRow).toHaveText(/100.00/);
                await expect(automatedFeeRow).toHaveText(/Based On:Sale Total/);
                await expect(automatedFeeRow).toHaveText(/Tier 1/);
                await expect(automatedFeeRow).toHaveText(/Tier 2/);
            });

            await test.step('6: Delete the Fee Schedule', async () => {
                const automatedFeeRow = page.locator(companiesPage.fee_schedule_row_selector).filter({ hasText: FEE_DATA.type });
                const deleteButton = automatedFeeRow.locator(companiesPage.fee_schedule_delete_button_selector);

                await expect(deleteButton).toBeVisible();
                await deleteButton.click();

                const removeConfirmationButton = page.getByRole('button', { name: 'Remove', exact: true });
                await expect(removeConfirmationButton).toBeVisible();
                await removeConfirmationButton.click();

                await expect(automatedFeeRow).toBeHidden();
            });

        } finally {
            if (companyCreated) {
                await test.step('Teardown: Delete the test company', async () => {
                    await navigateToSection(page, 'Companies');

                    await companiesPage.searchCompanyByName(COMPANY_DATA.name);
                    const companyRow = page.locator(companiesPage.company_row_selector).filter({ hasText: COMPANY_DATA.name });
                    await expect(companyRow).toBeVisible();

                    const deleteCompanyButton = companyRow.locator(companiesPage.delete_company_button);
                    await expect(deleteCompanyButton).toBeVisible();

                    page.once('dialog', async (dialog) => {
                        console.log(`Cleanup Dialog message: ${dialog.message()}`);
                        await dialog.accept();
                    });

                    await deleteCompanyButton.click();
                    await expect(page.getByText("You don't have any companies")).toBeVisible();
                });
            }
        }
    });
});