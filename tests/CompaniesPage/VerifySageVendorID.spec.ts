import { test, expect } from '../../fixtures';
import { navigateToLoginPage, navigateToSection } from '../../navigation-helpers';
import { LoginPage } from '../../pages/LoginPage';
import { FilesPage } from '../../pages/FilesPage';
import { CompaniesPage } from '../../pages/CompaniesPage';

test('Verify Sage Vendor ID visibility and Transport company lifecycle', async ({ page, loginAs }) => {
    let companiesPage: CompaniesPage;
    const transportCompanyName = 'Auto Transport Company Ltd.';
    
    // Flag to track if the company was actually created
    let isCompanyCreated = false; 

    await test.step('Setup: Log in as Super Admin and navigate to Create Company form', async () => {
        await navigateToLoginPage(page);
        const loginPage = await LoginPage.getInstance(page);
        await expect(loginPage.login_button).toBeVisible();

        await loginAs('super_admin');

        const filesPage = await FilesPage.getInstance(page);
        await expect(filesPage.companies_button).toBeVisible();
        await expect(filesPage.notifications_button).toBeVisible();
        await expect(filesPage.create_file_button).toBeVisible();
        await filesPage.companies_button.click();

        companiesPage = await CompaniesPage.getInstance(page);
        await expect(companiesPage.create_company_button).toBeVisible();
        await companiesPage.create_company_button.click();
        await expect(companiesPage.company_name_textbox).toBeVisible();
    });

    await test.step('1: Verify Sage Vendor ID is hidden for Admin, Insurance, Warranty, and Trustee', async () => {
        const hiddenActivityTypes = ['Admin', 'Insurance', 'Warranty', 'Trustee'];

        for (const type of hiddenActivityTypes) {
            await companiesPage.activity_type_dropdown.click();
            await page.getByRole('option', { name: type, exact: true }).click();
            await expect(companiesPage.sage_vendor_id_textbox).toBeHidden();
        }
    });

    await test.step('2: Create a Transport company without Sage Vendor ID', async () => {
        await companiesPage.company_name_textbox.fill(transportCompanyName);

        await companiesPage.activity_type_dropdown.click();
        await page.getByRole('option', { name: 'Transport', exact: true }).click();

        await expect(companiesPage.sage_vendor_id_textbox).toBeVisible();

        await companiesPage.phone_number_textbox.fill('4379874567');
        await companiesPage.country_dropdown.click();
        await page.getByRole('option', { name: 'Canada' }).click();

        await companiesPage.province_dropdown.click();
        await page.getByRole('option', { name: 'Ontario' }).click();

        await companiesPage.city_textbox.fill('Toronto');
        await companiesPage.postal_code_textbox.fill('M5V 2K7');
        await companiesPage.street_textbox.fill('123 Transport Ave');

        await companiesPage.taxation_province_dropdown.click();
        await page.getByRole('option', { name: 'Ontario' }).click();
        await companiesPage.notification_email_textbox.fill('dispatch@autotransport.com');
        await companiesPage.website_textbox.fill('www.autotransport.com');

        await companiesPage.save_company_button.click();
        
        // Mark as true immediately after successful save
        isCompanyCreated = true; 
    });

    // Wrap the remainder of the test in a try/finally block
    try {
        await test.step('3: Search, Edit, and add Sage Vendor ID', async () => {
            await expect(companiesPage.search_textbox).toBeVisible();
            await companiesPage.search_textbox.fill(transportCompanyName);

            let searchresult = page
                .locator(companiesPage.search_results_rows_selector)
                .filter({ hasText: transportCompanyName });
            await expect(searchresult).toHaveCount(1);
            await searchresult.click();

            let companyRow = page.locator(companiesPage.company_row_selector).filter({ hasText: transportCompanyName });
            await expect(companyRow).toBeVisible();
            await companyRow.locator(companiesPage.edit_company_button).click();

            await expect(companiesPage.sage_vendor_id_textbox).toBeVisible();
            await companiesPage.sage_vendor_id_textbox.fill('SAGE-TRANS-001');

            await page.waitForTimeout(500); 
            await expect(companiesPage.save_company_button).toBeVisible();
            await companiesPage.save_company_button.click();
        });

        await test.step('4: Verify Sage Vendor ID was saved successfully', async () => {
            await expect(companiesPage.search_textbox).toBeVisible();
            await companiesPage.search_textbox.clear();
            await companiesPage.search_textbox.fill(transportCompanyName);

            let searchresult = page
                .locator(companiesPage.search_results_rows_selector)
                .filter({ hasText: transportCompanyName });
            await expect(searchresult).toHaveCount(1);
            await searchresult.click();

            let companyRow = page.locator(companiesPage.company_row_selector).filter({ hasText: transportCompanyName });
            await expect(companyRow).toBeVisible();
            await companyRow.locator(companiesPage.edit_company_button).click();

            await expect(companiesPage.sage_vendor_id_textbox).toBeVisible();
            await expect(companiesPage.sage_vendor_id_textbox).toHaveValue('SAGE-TRANS-001');

            await expect(companiesPage.cancel_button).toBeVisible();
            await companiesPage.cancel_button.click();
        });

    } finally {
        // This will always run, ensuring teardown happens if the creation was successful
        if (isCompanyCreated) {
            await test.step('5: Delete the Transport company (Teardown)', async () => {
                // Optional safety net: ensure we are on the Companies page view
                // (Useful if a failure happened while deep in another menu/modal)
                await navigateToSection(page, 'Companies');
                const filesPage = await FilesPage.getInstance(page);
                if (await filesPage.companies_button.isVisible()) {
                    await filesPage.companies_button.click();
                }

                await expect(companiesPage.search_textbox).toBeVisible();
                await companiesPage.search_textbox.clear();
                await companiesPage.search_textbox.fill(transportCompanyName);

                let searchresult = page
                    .locator(companiesPage.search_results_rows_selector)
                    .filter({ hasText: transportCompanyName });
                await expect(searchresult).toHaveCount(1);
                await searchresult.click();

                let companyRow = page.locator(companiesPage.company_row_selector).filter({ hasText: transportCompanyName });
                await expect(companyRow).toBeVisible();

                const deleteButton = companyRow.locator(companiesPage.delete_company_button);
                await expect(deleteButton).toBeVisible();

                page.once('dialog', async (dialog) => {
                    console.log(`Dialog message: ${dialog.message()}`);
                    await dialog.accept();
                });

                await deleteButton.click();

                searchresult = page
                    .locator(companiesPage.search_results_rows_selector)
                    .filter({ hasText: transportCompanyName });
                await expect(searchresult).toHaveCount(0);
            });
        }
    }
});