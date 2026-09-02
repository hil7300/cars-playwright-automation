import { test, expect } from '../../../fixtures';
import { openFileViaSearchbar } from '../../../helpers';
import { navigateToLoginPage } from '../../../navigation-helpers';
import { CompaniesPage } from '../../../pages/CompaniesPage';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { OtherRecoveries } from '../../../pages/FilePages/OtherRecoveries';
import { FilesPage } from '../../../pages/FilesPage';
import { LoginPage } from '../../../pages/LoginPage';
import { APIServices } from '../../../services/apiServices';

// Base static data that remains constant across all tiers
const INSURANCE_DATA = {
    initialStatus: 'Insurance Rebate Required',
    companyName: 'Insurance Testing Company',
    policyNumber: 'TESTPOLICY123',
    insuranceAmount: '1500', // Set high enough to cover all test scenarios
    errorMessage: 'First insurance request status must be: "Insurance Rebate Required".',
    invoiceNumber: 'TESTINVOICE123',
} as const;

// Parameterized data for the 3 fee tiers
const TIER_TEST_CASES = [
    {
        tier: 'Tier 1 (<= $75)',
        refundAmount: '50.00',
        formattedRefundAmount: '$ 50.00',
        expectedFee: '50', // 100% of 50
    },
    {
        tier: 'Tier 2 (Flat Fee)',
        refundAmount: '500.00',
        formattedRefundAmount: '$ 500.00',
        expectedFee: '75', // Flat $75 fee
    },
    {
        tier: 'Tier 3 (>= $750.01)',
        refundAmount: '1000.00',
        formattedRefundAmount: '$ 1,000.00', // Adjust comma based on your UI's formatting
        expectedFee: '100', // 10% of 1000
    },
];

test.describe('Verify Insurance Status Updates on Other Recoveries', () => {
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

    // Loop through the tiers to dynamically generate a test for each one
    for (const data of TIER_TEST_CASES) {
        test(`Verify sequential Insurance Status Updates - ${data.tier}`, async ({ page, loginAs }) => {
            let fileHomePage: FileHomePage;
            let filesPage: FilesPage;
            let otherRecoveries: OtherRecoveries;
            let companiesPage: CompaniesPage;

            await test.step('Setup: Create file and log in as Admin', async () => {
                const fileDetails = await apiService.createNewAutoAssetFileViaAPI('Automated Fee Bank');
                fileRef = fileDetails.accountNumber;

                await navigateToLoginPage(page);
                const loginPage = await LoginPage.getInstance(page);
                await expect(loginPage.login_button).toBeVisible();

                await loginAs('super_admin');
                fileRef = await openFileViaSearchbar(page, fileRef);
            });

            await test.step('Verify Company Fee Schedule configuration', async () => {
                filesPage = await FilesPage.getInstance(page);
                await filesPage.companies_button.click();

                companiesPage = await CompaniesPage.getInstance(page);
                await companiesPage.searchCompanyByName('Automated Fee Bank');

                const companyRow = page
                    .locator(companiesPage.company_row_selector)
                    .filter({ hasText: 'Automated Fee Bank' });
                await companyRow.locator(companiesPage.edit_company_button).click();

                await companiesPage.fees_tab.click();

                // Verify expected fees are present in the schedule
                await expect(
                    page.locator(companiesPage.fee_schedule_row_selector).filter({ hasText: 'Warranty Fee' })
                ).toBeVisible();
                await expect(
                    page.locator(companiesPage.fee_schedule_row_selector).filter({ hasText: 'Insurance Fee' })
                ).toBeVisible();
            });

            await test.step('Navigate to Other Recoveries tab', async () => {
                await filesPage.files_button.click();
                await openFileViaSearchbar(page, fileRef);

                fileHomePage = await FileHomePage.getInstance(page);
                await fileHomePage.otherRecoveriesOption.click();

                otherRecoveries = await OtherRecoveries.getInstance(page);
                await expect(otherRecoveries.insurance_heading).toBeVisible();
                await expect(otherRecoveries.insurance_request_tracking_dropdown).toBeHidden();
            });

            await test.step(`Action: Set Initial Status to ${INSURANCE_DATA.initialStatus}`, async () => {
                await otherRecoveries.clickStatusButton('Add Insurance Status Update');

                await expect(otherRecoveries.save_button).toBeDisabled();

                await otherRecoveries.status_dropdown.click();
                await page.getByRole('option', { name: INSURANCE_DATA.initialStatus, exact: true }).click();

                await otherRecoveries.company_dropdown.click();
                await page.getByRole('option', { name: INSURANCE_DATA.companyName, exact: true }).click();

                await otherRecoveries.policy_number_textbox.fill(INSURANCE_DATA.policyNumber);
                await otherRecoveries.insurance_amount_textbox.fill(INSURANCE_DATA.insuranceAmount);

                await expect(otherRecoveries.save_button).toBeEnabled();
                await otherRecoveries.save_button.click();

                // Verify UI updates after saving initial status
                await expect(otherRecoveries.insurance_request_tracking_dropdown).toBeVisible();
                await expect(otherRecoveries.refund_requested_date).toBeVisible();
            });

            await test.step(`Progress Insurance Status to Refund Received (${data.formattedRefundAmount})`, async () => {
                await otherRecoveries.applyStatusUpdate(INSURANCE_DATA.initialStatus, 'Claim Submitted');
                await otherRecoveries.applyStatusUpdate('Claim Submitted', 'Refund Received', {
                    amount: data.refundAmount,
                    formattedAmount: data.formattedRefundAmount,
                }, 'RecoveryHub');
            });

            await test.step(`Verify Insurance Fee is calculated correctly for ${data.tier}`, async () => {
                const feeRow = page.locator(otherRecoveries.fee_row_selector).filter({ hasText: 'Insurance Fee' });

                // Assert dynamic fee generation based on the current tier's expected amount
                await expect(feeRow).toBeVisible();
                await expect(feeRow).toContainText(data.expectedFee);

                await expect(feeRow.locator(otherRecoveries.mark_as_paid_icon_selector)).toBeVisible();
                await expect(feeRow.locator(otherRecoveries.edit_fee_icon_selector)).toBeVisible();
                await expect(feeRow.locator(otherRecoveries.delete_fee_icon_selector)).toBeVisible();

                // Edit the fee
                await feeRow.locator(otherRecoveries.edit_fee_icon_selector).click();

                const invoiceTextbox = page.getByRole('textbox', { name: 'Invoice Number' });
                const saveButton = page.locator('[id*="headlessui-dialog-"]').getByRole('button', { name: 'Save' });

                await invoiceTextbox.fill(INSURANCE_DATA.invoiceNumber);
                await saveButton.click();

                // Verify the edit was successful
                await expect(feeRow).toContainText(INSURANCE_DATA.invoiceNumber);
            });
        });
    }
});
