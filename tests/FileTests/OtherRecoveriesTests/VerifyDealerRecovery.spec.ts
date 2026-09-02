import { test, expect } from '../../../fixtures';
import { openFileViaSearchbar } from '../../../helpers';
import { navigateToLoginPage } from '../../../navigation-helpers';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { OtherRecoveries } from '../../../pages/FilePages/OtherRecoveries';
import { LoginPage } from '../../../pages/LoginPage';
import { APIServices } from '../../../services/apiServices';

const STATUS_UPDATES = ['Request Submitted', 'Follow Up', 'In Negotiation', 'In Repayment', 'Refund Received'] as const;

const DEALER_DATA = {
    initialStatus: 'Dealer Rebate Required',
    companyName: 'Dealer Testing Company',
    dealerAmount: '1000',
    refundAmount: '500.00',
    formattedRefundAmount: '$ 500.00',
    errorMessage: 'First dealer request status must be: "Dealer Rebate Required".',
} as const;

test.describe('Verify Dealer Status Updates on Other Recoveries', () => {
    let apiService: APIServices;
    let fileRef = '';

    test.afterEach(async () => {
        if (fileRef && apiService) {
            console.log(`Cleaning up file: ${fileRef}`);
            await apiService.deleteFile(fileRef).catch((e) => console.error(`Cleanup failed: ${e.message}`));
        }
    });

    test('Verify sequential Dealer Status Updates', async ({ page, request, loginAs }) => {
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
            await expect(otherRecoveries.dealer_heading).toBeVisible();
            await expect(otherRecoveries.dealer_request_tracking_dropdown).toBeHidden();
        });

        await test.step('Negative Cases: Verify error when first status is invalid', async () => {
            const invalidInitialStatuses = STATUS_UPDATES.filter((status) => status !== 'Refund Received');

            for (const invalidStatus of invalidInitialStatuses) {
                await otherRecoveries.clickStatusButton('Add Dealer Status Update');
                await expect(otherRecoveries.status_dropdown).toBeVisible();

                await otherRecoveries.status_dropdown.click();
                await page.getByRole('option', { name: invalidStatus, exact: true }).click();
                await otherRecoveries.save_button.click();

                const errorToast = page.locator(otherRecoveries.toast_message_selector);
                await expect(errorToast).toBeVisible();
                await expect(errorToast).toContainText(DEALER_DATA.errorMessage);

                await errorToast.locator('[aria-label="Close"]').click();
                await expect(errorToast).toBeHidden();

                await page.keyboard.press('Escape');
                await expect(otherRecoveries.status_dropdown).toBeHidden();
            }
        });

        await test.step(`Action: Set Initial Status to ${DEALER_DATA.initialStatus}`, async () => {
            await otherRecoveries.clickStatusButton('Add Dealer Status Update');
            await expect(otherRecoveries.status_dropdown).toBeVisible();
            await expect(otherRecoveries.additional_notes_textbox).toBeVisible();
            await expect(otherRecoveries.save_button).toBeDisabled();

            await otherRecoveries.status_dropdown.click();
            const dealerRebateOption = page.getByRole('option', { name: DEALER_DATA.initialStatus, exact: true });
            await expect(dealerRebateOption).toBeVisible();
            await dealerRebateOption.click();

            // Dealer flow uses free-text company + amount fields (not a company dropdown / policy number).
            await expect(otherRecoveries.dealer_company_textbox).toBeVisible();
            await expect(otherRecoveries.dealer_amount_textbox).toBeVisible();

            await otherRecoveries.dealer_company_textbox.fill(DEALER_DATA.companyName);
            await otherRecoveries.dealer_amount_textbox.fill(DEALER_DATA.dealerAmount);

            await expect(otherRecoveries.save_button).toBeEnabled();
            await otherRecoveries.save_button.click();

            await expect(otherRecoveries.dealer_request_tracking_dropdown).toBeVisible();
            await expect(otherRecoveries.refund_requested_date).toBeVisible();
        });

        let currentStatusButtonText: string = DEALER_DATA.initialStatus;

        for (const targetStatus of STATUS_UPDATES) {
            await test.step(`Action & Verification: Update status to '${targetStatus}'`, async () => {
                const refundOpts =
                    targetStatus === 'Refund Received'
                        ? {
                              amount: DEALER_DATA.refundAmount,
                              formattedAmount: DEALER_DATA.formattedRefundAmount,
                          }
                        : undefined;

                await otherRecoveries.applyStatusUpdate(currentStatusButtonText, targetStatus, refundOpts);
                currentStatusButtonText = targetStatus;
            });
        }

        await test.step('Final Verification: Ensure Dealer Request Tracker logs all history', async () => {
            await otherRecoveries.dealer_request_tracking_dropdown.click();
            const trackingSection = page.locator('[id="dealerRequestTracker"]');
            await expect(trackingSection).toBeVisible();

            await expect(trackingSection, 'Tracker should contain initial status').toContainText(
                DEALER_DATA.initialStatus
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
