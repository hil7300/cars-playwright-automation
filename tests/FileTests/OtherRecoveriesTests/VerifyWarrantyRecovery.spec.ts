import { test, expect } from '../../../fixtures';
import { openFileViaSearchbar } from '../../../helpers';
import { logoutAsCurrentUser, navigateToLoginPage } from '../../../navigation-helpers';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { OtherRecoveries } from '../../../pages/FilePages/OtherRecoveries';
import { FilesPage } from '../../../pages/FilesPage';
import { LoginPage } from '../../../pages/LoginPage';
import { APIServices } from '../../../services/apiServices';

const STATUS_UPDATES = [
    'Claim Submitted',
    'First Follow Up',
    'Second Follow Up',
    'Declined',
    'No Response',
    'Refund Received',
] as const;

const WARRANTY_DATA = {
    initialStatus: 'Warranty Rebate Required',
    companyName: 'Warranty Testing Company',
    policyNumber: 'TESTPOLICY123',
    warrantyAmount: '1000',
    refundAmount: '500.00',
    formattedRefundAmount: '$ 500.00',
    errorMessage: 'First warranty request status must be: Warranty Rebate Required.',
} as const;

test.describe('Verify Warranty Status Updates on Other Recoveries', () => {
    let apiService: APIServices;
    let fileRef = '';

    test.afterEach(async () => {
        if (fileRef && apiService) {
            console.log(`Cleaning up file: ${fileRef}`);
            await apiService.deleteFile(fileRef).catch((e) => console.error(`Cleanup failed: ${e.message}`));
        }
    });

    test('Verify sequential Warranty Status Updates', async ({ page, request, loginAs }) => {
        apiService = await APIServices.create(request);
        let otherRecoveries: OtherRecoveries;

        await test.step('Setup: Create file, log in as Admin, and navigate to Other Recoveries', async () => {
            const fileDetails = await apiService.createNewAutoAssetFileViaAPI();

            await navigateToLoginPage(page);
            const loginPage = await LoginPage.getInstance(page);
            await expect(loginPage.login_button).toBeVisible();

            await loginAs('super_admin');
            fileRef = await openFileViaSearchbar(page, fileDetails.accountNumber);

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
            await expect(fileHomePage.otherRecoveriesOption).toBeVisible();
            await fileHomePage.otherRecoveriesOption.click();

            otherRecoveries = await OtherRecoveries.getInstance(page);
            await expect(otherRecoveries.warranty_heading).toBeVisible();
            await expect(otherRecoveries.warranty_request_tracking_dropdown).toBeHidden();
        });

        await test.step('Negative Cases: Verify error when first status is invalid', async () => {
            const invalidInitialStatuses = STATUS_UPDATES.filter((status) => status !== 'Refund Received');

            for (const invalidStatus of invalidInitialStatuses) {
                await otherRecoveries.clickStatusButton('Add Warranty Status Update');
                await expect(otherRecoveries.status_dropdown).toBeVisible();

                await otherRecoveries.status_dropdown.click();
                await page.getByRole('option', { name: invalidStatus, exact: true }).click();
                await otherRecoveries.save_button.click();

                const errorToast = page.locator(otherRecoveries.toast_message_selector);
                await expect(errorToast).toBeVisible();
                await expect(errorToast).toContainText(WARRANTY_DATA.errorMessage);

                await errorToast.locator('[aria-label="Close"]').click();
                await expect(errorToast).toBeHidden();

                await page.keyboard.press('Escape');
                await expect(otherRecoveries.status_dropdown).toBeHidden();
            }
        });

        await test.step(`Action: Set Initial Status to ${WARRANTY_DATA.initialStatus}`, async () => {
            await otherRecoveries.clickStatusButton('Add Warranty Status Update');
            await expect(otherRecoveries.status_dropdown).toBeVisible();
            await expect(otherRecoveries.additional_notes_textbox).toBeVisible();
            await expect(otherRecoveries.save_button).toBeDisabled();

            await otherRecoveries.status_dropdown.click();
            const warrantyRebateOption = page.getByRole('option', { name: WARRANTY_DATA.initialStatus, exact: true });
            await expect(warrantyRebateOption).toBeVisible();
            await warrantyRebateOption.click();

            await expect(otherRecoveries.company_dropdown).toBeVisible();
            await expect(otherRecoveries.policy_number_textbox).toBeVisible();
            await expect(otherRecoveries.warranty_amount_textbox).toBeVisible();

            await otherRecoveries.company_dropdown.click();
            const companyOption = page.getByRole('option', { name: WARRANTY_DATA.companyName, exact: true });
            await expect(companyOption).toBeVisible();
            await companyOption.click();

            await otherRecoveries.policy_number_textbox.fill(WARRANTY_DATA.policyNumber);
            await otherRecoveries.warranty_amount_textbox.fill(WARRANTY_DATA.warrantyAmount);

            await expect(otherRecoveries.save_button).toBeEnabled();
            await otherRecoveries.save_button.click();

            await expect(otherRecoveries.warranty_request_tracking_dropdown).toBeVisible();
            await expect(otherRecoveries.refund_requested_date).toBeVisible();
        });

        let currentStatusButtonText: string = WARRANTY_DATA.initialStatus;

        for (const targetStatus of STATUS_UPDATES) {
            await test.step(`Action & Verification: Update status to '${targetStatus}'`, async () => {
                const isRefundReceived = targetStatus === 'Refund Received';

                const refundOpts = isRefundReceived
                    ? {
                        amount: WARRANTY_DATA.refundAmount,
                        formattedAmount: WARRANTY_DATA.formattedRefundAmount,
                    }
                    : undefined;

                const issuedTo = isRefundReceived ? 'RecoveryHub' : undefined;

                await otherRecoveries.applyStatusUpdate(
                    currentStatusButtonText,
                    targetStatus,
                    refundOpts,
                    issuedTo,
                );
                currentStatusButtonText = targetStatus;
            });
        }

        await test.step('Final Verification: Ensure Warranty Request Tracker logs all history', async () => {
            await otherRecoveries.warranty_request_tracking_dropdown.click();
            const trackingSection = page.locator('[id="warrantyRequestTracker"]');
            await expect(trackingSection).toBeVisible();

            await expect(trackingSection, 'Tracker should contain initial status').toContainText(
                WARRANTY_DATA.initialStatus
            );

            for (const status of STATUS_UPDATES) {
                await expect(trackingSection, `Tracker should log status: ${status}`).toContainText(status);

                const fullNote = `Applying status: ${status}`;
                const expectedNote = fullNote.length > 25 ? `${fullNote.substring(0, 25)}...` : fullNote;

                await expect(trackingSection, `Tracker should log note: ${expectedNote}`).toContainText(expectedNote);
            }
        });
    });
});
