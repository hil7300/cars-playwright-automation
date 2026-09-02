import { test, expect } from '../../fixtures';
import { navigateToLoginPage } from '../../navigation-helpers';
import { LoginPage } from '../../pages/LoginPage';
import { FilesPage } from '../../pages/FilesPage';
import { CompaniesPage } from '../../pages/CompaniesPage';

test.describe('Company Creation Fields Validation', () => {
    test('Validate Company Creation and Deletion in a single flow', async ({ page, loginAs }) => {
        let companiesPage: CompaniesPage;
        // Declare the company name at the top so all steps can access it
        const companyName = 'Auto Test Company Ltd.';

        await test.step('Setup: Log in as Super Admin and navigate to Create Company form', async () => {
            await navigateToLoginPage(page);
            const loginPage = await LoginPage.getInstance(page);
            await expect(loginPage.login_button).toBeVisible();

            await loginAs('super_admin');

            const filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.companies_button).toBeVisible();
            await expect(filesPage.notifications_button).toBeVisible();
            await expect(filesPage.create_file_button).toBeVisible();
            await page.waitForTimeout(500); // Added wait to ensure page is fully loaded before clicking
            await filesPage.companies_button.click({ delay: 250 }); // Added delay to ensure the click is registered

            companiesPage = await CompaniesPage.getInstance(page);
            await expect(companiesPage.create_company_button).toBeVisible();
            await expect(companiesPage.search_textbox).toBeVisible();
            await companiesPage.create_company_button.click();
            await expect(companiesPage.company_name_textbox).toBeVisible();
        });

        await test.step('1: Successfully create a company with all fields filled', async () => {
            await companiesPage.company_name_textbox.fill(companyName);

            await companiesPage.activity_type_dropdown.click();
            await page.getByRole('option', { name: 'Client' }).click();
            await expect(companiesPage.sage_vendor_id_textbox).toBeHidden();

            await companiesPage.company_code_textbox.fill('ATC');
            await companiesPage.phone_number_textbox.fill('4379874567');

            await companiesPage.country_dropdown.click();
            await page.getByRole('option', { name: 'Canada' }).click();

            await companiesPage.province_dropdown.click();
            await page.getByRole('option', { name: 'Ontario' }).click();

            await companiesPage.city_textbox.fill('Toronto');
            await companiesPage.postal_code_textbox.fill('M5V 2K7');
            await companiesPage.street_textbox.fill('123 Test Ave');

            await companiesPage.taxation_province_dropdown.click();
            await page.getByRole('option', { name: 'Ontario' }).click();
            await companiesPage.notification_email_textbox.fill('billing@autotest.com');
            await companiesPage.website_textbox.fill('www.autotest.com');

            // Submit
            await companiesPage.save_company_button.click();
        });

        await test.step('2: Search and verify the newly created company', async () => {
            await expect(companiesPage.search_textbox).toBeVisible();
            await companiesPage.search_textbox.fill(companyName);

            // Note: Removed 'await' here since page.locator() is synchronous
            let searchresult = page
                .locator(companiesPage.search_results_rows_selector)
                .filter({ hasText: companyName });

            await expect(searchresult).toHaveCount(1);
            await searchresult.click();
        });

        await test.step('3: Delete the company and verify removal (Teardown)', async () => {
            let companyRow = page.locator(companiesPage.company_row_selector).filter({ hasText: companyName });
            await expect(companyRow).toBeVisible();

            const deleteButton = companyRow.locator(companiesPage.delete_company_button);
            await expect(deleteButton).toBeVisible();

            // Set up the listener BEFORE clicking the delete button
            page.once('dialog', async (dialog) => {
                console.log(`Dialog message: ${dialog.message()}`);
                await dialog.accept(); // Clicks "OK"
            });

            await deleteButton.click();

            // Re-verify the search results are now empty
            let searchresult = page
                .locator(companiesPage.search_results_rows_selector)
                .filter({ hasText: companyName });
            await expect(searchresult).toHaveCount(0);

            // Note: You might need to escape the single quote if your editor complains, or use double quotes for the string
            await expect(page.getByText("You don't have any companies")).toBeVisible();
        });
    });
});
