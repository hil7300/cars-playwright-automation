import { test, expect } from '../../../fixtures';
import { extractPdfText, openFileViaSearchbar } from '../../../helpers';
import { navigateToLoginPage } from '../../../navigation-helpers';
import { CompaniesPage } from '../../../pages/CompaniesPage';
import { Accounting } from '../../../pages/FilePages/Accounting';
import { Assignments } from '../../../pages/FilePages/Assignments';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { AssetDetails } from '../../../pages/FilePages/AssetDetails';
import { RelatedParties } from '../../../pages/FilePages/RelatedParties';
import { FilesPage } from '../../../pages/FilesPage';
import { LoginPage } from '../../../pages/LoginPage';
import { APIServices } from '../../../services/apiServices';

const TEST_DATA = {
    clientUsers: ['Automated Fee Bank User'],
    adminUsers: ['Auto Admin-Basic'],
    companyName: 'Automated Fee Bank',
    firstName: 'Thomas',
    lastName: 'Anderson',
    roles: { admin: 'Admin', client: 'Client' },
    fees: { ppsa: 'PPSA Search Fee', vin: 'VIN Search Fee' },
    invoice: {
        number: 'INV-001',
        description: 'VIN Search Fee for Automated Test',
        amount: '$20.00',
        type: 'Sold',
    },
    timeouts: { backendProcess: 120000, statusUpdate: 10000 },
};

test.describe('Verify VIN and PPSA Fees are generated after Request is Approved @requires-triggers', () => {
    let apiService: APIServices;
    let fileRef = '';

    test.beforeEach(async ({ request }) => {
        apiService = await APIServices.create(request);
    });

    test.afterEach(async () => {
        if (fileRef && apiService) {
            console.log(`Cleaning up file: ${fileRef}`);
            try {
                await apiService.deleteFile(fileRef);
            } catch (error) {
                console.error(`Cleanup failed for file ${fileRef}:`, error);
            }
        }
    });

    test('Verify VIN and PPSA Fees are generated after Request is Approved for Sold File', async ({
        page,
        loginAs,
    }) => {
        test.setTimeout(TEST_DATA.timeouts.backendProcess);

        let filesPage: FilesPage;
        let fileHomePage: FileHomePage;

        await test.step('Setup: Create file, log in as Admin, and assign roles', async () => {
            const fileDetails = await apiService.createNewAutoAssetFileViaAPI(
                TEST_DATA.companyName,
                TEST_DATA.firstName,
                TEST_DATA.lastName
            );
            fileRef = fileDetails.accountNumber;

            await navigateToLoginPage(page);
            const loginPage = await LoginPage.getInstance(page);
            await expect(loginPage.login_button).toBeVisible();

            await loginAs('super_admin');

            filesPage = await FilesPage.getInstance(page);
            fileRef = await openFileViaSearchbar(page, fileRef);

            fileHomePage = await FileHomePage.getInstance(page);
            await fileHomePage.assignmentOption.click();

            const assignments = await Assignments.getInstance(page);
            await assignments.assignUsersToAssignedCompany(TEST_DATA.adminUsers, 'Admin');
            await assignments.assignUsersToAssignedCompany(TEST_DATA.clientUsers, 'Client');
        });

        await test.step('Verify Company Fee Schedule', async () => {
            await filesPage.companies_button.click();

            const companiesPage = await CompaniesPage.getInstance(page);
            await companiesPage.searchCompanyByName(TEST_DATA.companyName);

            const companyRow = page.locator(companiesPage.company_row_selector).filter({ hasText: TEST_DATA.companyName });
            await companyRow.locator(companiesPage.edit_company_button).click();

            await companiesPage.fees_tab.click();

            await expect(page.locator(companiesPage.fee_schedule_row_selector).filter({ hasText: TEST_DATA.fees.ppsa })).toBeVisible();
            await expect(page.locator(companiesPage.fee_schedule_row_selector).filter({ hasText: TEST_DATA.fees.vin })).toBeVisible();
        });

        await test.step('Request VIN Search and confirm completion', async () => {
            await filesPage.files_button.click();
            await openFileViaSearchbar(page, fileRef);

            await fileHomePage.assetDetailsOption.click();
            const assetDetails = await AssetDetails.getInstance(page);

            await assetDetails.request_VIN_search_button.click();
            await expect(assetDetails.request_VIN_search_button).toContainText('Pending', { timeout: TEST_DATA.timeouts.statusUpdate });
            await expect(assetDetails.request_VIN_search_button).toBeDisabled();

            await apiService.triggerVinSearchForAssetViaAPI();
            await page.reload();
            await assetDetails.confirmVinSearchCompleted(apiService);
        });

        await test.step('Request PPSA Search and confirm completion', async () => {
            await fileHomePage.relatedPartiesOption.click();
            const relatedParties = await RelatedParties.getInstance(page);

            await relatedParties.request_ppsa_search_button.last().click();
            await expect(relatedParties.request_ppsa_search_button.last()).toContainText('Pending', { timeout: TEST_DATA.timeouts.statusUpdate });
            await expect(relatedParties.request_ppsa_search_button.last()).toBeDisabled();

            await apiService.triggerPpsaSearchForAsset();
            await page.reload();
            await relatedParties.confirmPPSASearchCompleted(apiService);
        });

        await test.step('Navigate to Accounting and update fee details', async () => {
            await fileHomePage.accountingOption.click();
            const accounting = await Accounting.getInstance(page);

            const vinSearchFeeRow = page.locator(accounting.fee_row_selector).filter({ hasText: TEST_DATA.fees.vin });
            const ppsaSearchFeeRow = page.locator(accounting.fee_row_selector).filter({ hasText: 'PPSA Search' });

            await expect(vinSearchFeeRow).toBeVisible();
            await expect(ppsaSearchFeeRow).toBeVisible();

            await vinSearchFeeRow.locator(accounting.edit_fee_icon_selector).click();
            await accounting.invoice_number_textbox.fill(TEST_DATA.invoice.number);
            await accounting.description_textbox.fill(TEST_DATA.invoice.description);
            await accounting.save_fee_button.click();

            await expect(vinSearchFeeRow).toContainText(TEST_DATA.invoice.number);
            await expect(vinSearchFeeRow).toContainText(TEST_DATA.invoice.description);
            await expect(vinSearchFeeRow).toContainText(TEST_DATA.invoice.amount);
        });

        await test.step('Generate Invoice and verify contents', async () => {
            const accounting = await Accounting.getInstance(page);

            await accounting.add_invoice_button.click();
            await accounting.select_invoice_dropdown.click();
            await page.getByRole('option', { name: TEST_DATA.invoice.type, exact: true }).click();

            const invoiceContainer = page.locator(accounting.invoice_preview_container_selector);
            await expect(accounting.generate_invoice_button).toBeEnabled();

            await expect(invoiceContainer).toContainText(TEST_DATA.fees.vin);
            await expect(invoiceContainer).toContainText('PPSA Search');
            await expect(invoiceContainer).toContainText(TEST_DATA.companyName);
        });
    });
});