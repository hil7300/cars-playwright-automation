import { openFileViaSearchbar } from '../../../helpers';
import { navigateToLoginPage } from '../../../navigation-helpers';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { LoginPage } from '../../../pages/LoginPage';
import { expect, test } from '../../../fixtures';
import { APIServices } from '../../../services/apiServices';
import { FileSidebar } from '../../../pages/FilePages/FileSideBar';
import { Assignments } from '../../../pages/FilePages/Assignments';
import { Accounting } from '../../../pages/FilePages/Accounting';
import { FilesPage } from '../../../pages/FilesPage';
import { Remarketing } from '../../../pages/FilePages/Remarketing';

/**
 * TEST DATA CONSTANTS
 * Centralized mapping to easily add new Stages and their corresponding Statuses.
 * To add a new stage, simply add a new key-value pair below — the test generation
 * loop and final closure step will automatically pick it up.
 */
const STAGE_STATUS_MAPPING: Record<string, string[]> = {
    Closed: [
        'Bankruptcy - Vehicle Sold',
        'Insurance Cure',
        'Insurance Payout',
        'Loan Paid Out',
        'Loan Paid Out - 3rd Party Settlement',
        'Sold - Deficiency Recovery',
        'Sold - No Deficiency Recovery',
    ],
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

/**
 * Safely extracts the first numeric value from a string.
 * Throws a descriptive error instead of a cryptic null-reference crash.
 */
const parseCountFromText = (text: string): number => {
    const match = text.match(/\d+/);
    if (!match) {
        throw new Error(`Could not parse a numeric count from text: "${text}"`);
    }
    return parseInt(match[0], 10);
};

// ─── DYNAMIC TEST GENERATION ───────────────────────────────────────────────

for (const [stage, statuses] of Object.entries(STAGE_STATUS_MAPPING)) {
    test.describe(`File Stage Updates: ${stage}`, () => {
        let apiService: APIServices;
        let fileRef: string = '';

        test(`Verify all statuses and file closure for stage: ${stage}`, async ({ page, request, loginAs }) => {
            test.setTimeout(90000);

            let initialClosedCount: number = 0;

            // ── 1. SETUP: Create file via API, login, navigate ──────────────
            await test.step('Setup: Create file and navigate to file home', async () => {
                apiService = await APIServices.create(request);
                const fileDetails = await apiService.createNewAutoAssetFileViaAPI();

                await navigateToLoginPage(page);
                const loginPage = await LoginPage.getInstance(page);
                await expect(loginPage.login_button).toBeVisible();
                await loginAs('basic_admin');

                // Capture the baseline closed-file count before any mutations
                const filesPage = await FilesPage.getInstance(page);
                const closedFilesText = await filesPage.closed_files_button.innerText();
                initialClosedCount = parseCountFromText(closedFilesText);

                fileRef = await openFileViaSearchbar(page, fileDetails.accountNumber);
                const fileHomePage = await FileHomePage.getInstance(page);
                await expect(fileHomePage.assignmentOption).toBeVisible();
            });

            // ── 2. PRE-REQUISITE CHECK: Attempt closure BEFORE prerequisites ─
            // At this point, assignment and accounting data have NOT been filled.
            // The system should block closure with an *alert* modal (not a confirmation).
            // This loop validates that every status correctly triggers the alert.
            await test.step('Verify alert modal appears when prerequisites are missing', async () => {
                const fileSidebar = await FileSidebar.getInstance(page);

                for (const status of statuses) {
                    await test.step(`Alert expected for: "${status}"`, async () => {
                        await expect(fileSidebar.file_stage_dropdown).toBeVisible();
                        await expect(fileSidebar.file_status_dropdown).toBeVisible();
                        await fileSidebar.changeFileStageAndStatus(stage, status);

                        await expect(fileSidebar.close_file_alert_modal).toBeVisible();
                        await fileSidebar.close_file_alert_ok_button.click();
                    });
                }
            });

            // ── 3. PREREQUISITES: Fill Assignment and Accounting via UI ──────
            await test.step('Prerequisites: Fill assignment and accounting data', async () => {
                const fileHomePage = await FileHomePage.getInstance(page);

                // Assign a user to the file
                await fileHomePage.assignmentOption.click();
                const assignments = await Assignments.getInstance(page);
                await assignments.assignUsersToAssignedCompany('Auto Admin-Basic', 'Admin');

                // Populate accounting: arrears, fees, payments, and invoice
                await fileHomePage.accountingOption.click();
                const accounting = await Accounting.getInstance(page);
                await expect(accounting.arrears_radio_button).toBeVisible();

                await accounting.addFeeEntry();
                await accounting.addCollectedPaymentEntry({ amount: '500' });
                await accounting.generateInvoice('Sold');
            });

            // ── 5. PRE-REQUISITE CHECK TWO: Attempt closure BEFORE prerequisites ─
            // At this point, assignment and accounting data have been filled but the sale amount is missing.
            // The system should block closure with an *alert* modal (not a confirmation).
            // This loop validates that every status correctly triggers the alert.
            await test.step('Verify 2nd error happens that says ""Sale Amount is missing', async () => {
                const fileSidebar = await FileSidebar.getInstance(page);
                for (const status of statuses) {
                    await test.step(`Confirmation expected for: "${status}"`, async () => {
                        await expect(fileSidebar.file_stage_dropdown).toBeVisible();
                        await expect(fileSidebar.file_status_dropdown).toBeVisible();
                        await fileSidebar.changeFileStageAndStatus(stage, status);

                        await expect(fileSidebar.close_file_alert_modal).toBeVisible();
                        await fileSidebar.close_file_alert_ok_button.click();
                    });
                }

                let accountingSection = await Accounting.getInstance(page);
                await expect(accountingSection.delete_invoice_icon).toBeVisible();
                await accountingSection.delete_invoice_icon.click();
                await expect(accountingSection.delete_invoice_confirmation_button).toBeVisible();
                await accountingSection.delete_invoice_confirmation_button.click();

                await expect(accountingSection.delete_invoice_icon).toBeHidden();
            });

            // ── 6. PREREQUISITES: Add data to Remarketing - Sale Section ───────────────────
            await test.step('Add data to Remarketing - Sale Section and generate invoice in accounting section', async () => {
                const fileHomePage = await FileHomePage.getInstance(page);
                await expect(fileHomePage.remarketingOption).toBeVisible();
                await fileHomePage.remarketingOption.click();

                const remarketing = await Remarketing.getInstance(page);
                await expect(remarketing.sale_amount_textbox).toBeVisible();
                await remarketing.addDatatoSaleSection();

                await fileHomePage.accountingOption.click();
                const accounting = await Accounting.getInstance(page);
                await expect(accounting.add_invoice_button).toBeVisible();
                await accounting.generateInvoice('Sold');
            });

            // ── 7. PREREQUISITES: Add Sales Tax after Confirming the error message ───────────────────
            await test.step('Verify 2nd error happens that says ""Sales tax is missing.', async () => {
                const fileSidebar = await FileSidebar.getInstance(page);

                await test.step(`Confirmation expected for: "${statuses[0]}"`, async () => {
                    await expect(fileSidebar.file_stage_dropdown).toBeVisible();
                    await expect(fileSidebar.file_status_dropdown).toBeVisible();
                    await fileSidebar.changeFileStageAndStatus(stage, statuses[0]);

                    await expect(fileSidebar.close_file_alert_modal).toBeVisible();
                    await expect(fileSidebar.close_file_alert_modal).toContainText('Sales tax is missing.');
                    await fileSidebar.close_file_alert_ok_button.click();
                });

                let accountingSection = await Accounting.getInstance(page);
                await expect(accountingSection.delete_invoice_icon).toBeVisible();
                await accountingSection.delete_invoice_icon.click();
                await expect(accountingSection.delete_invoice_confirmation_button).toBeVisible();
                await accountingSection.delete_invoice_confirmation_button.click();

                await expect(accountingSection.delete_invoice_icon).toBeHidden();
            });

            // ── 8. PREREQUISITES: Add sales tax to Remarketing - Sale Section ───────────────────
            await test.step('Add sales tax to Remarketing - Sale Section and generate invoice in accounting section', async () => {
                const fileHomePage = await FileHomePage.getInstance(page);
                await expect(fileHomePage.remarketingOption).toBeVisible();
                await fileHomePage.remarketingOption.click();

                const remarketing = await Remarketing.getInstance(page);
                await expect(remarketing.sale_gst_textbox).toBeVisible();
                await remarketing.sale_gst_textbox.fill('1750');
                await expect(remarketing.sale_hst_textbox).toBeVisible();
                await remarketing.sale_hst_textbox.fill('1750');
                await remarketing.sale_save_button.click();

                await fileHomePage.accountingOption.click();
                const accounting = await Accounting.getInstance(page);
                await expect(accounting.add_invoice_button).toBeVisible();
                await accounting.generateInvoice('Sold');
            });

            // ── 7. FINAL CLOSURE: Actually close the file ───────────────────
            await test.step(`Close file with stage="${stage}", status="${statuses[0]}"`, async () => {
                const fileSidebar = await FileSidebar.getInstance(page);
                await fileSidebar.changeFileStageAndStatus(stage, statuses[0]);
                await expect(fileSidebar.close_file_confirmation_modal).toBeVisible();
                await expect(fileSidebar.close_file_button).toBeVisible();
                await fileSidebar.close_file_button.click();
            });

            // ── 8. ASSERTION: Dashboard count reflects the closure ───────────
            await test.step('Verify closed file count increased on dashboard', async () => {
                const filesPage = await FilesPage.getInstance(page);
                await filesPage.files_button.click();
                await expect(filesPage.search_textbox).toBeVisible();

                // Polling accounts for UI refresh delay and parallel test runs
                await expect(async () => {
                    const updatedText = await filesPage.closed_files_button.innerText();
                    const updatedCount = parseCountFromText(updatedText);
                    expect(updatedCount).toBeGreaterThan(initialClosedCount);
                }).toPass({ timeout: 10000 });
            });

            // ── 9. ASSERTION: Go to Closed Files section and verify the file exists there ───────────
            await test.step('Verify closed file exists in Closed Files section', async () => {
                const filesPage = await FilesPage.getInstance(page);
                await filesPage.closed_files_button.click();
                await expect(filesPage.search_textbox).toBeVisible();

                let targetFileLink = page.locator(filesPage.file_ref_id_cell_selector).filter({ hasText: fileRef });
                await expect(targetFileLink).toBeVisible();
            });

            // ── 10. CLEANUP: Delete file only after all steps pass ───────────
            // Intentionally NOT in afterEach — if the test fails, the file
            // is preserved for manual investigation / debugging.
            await test.step('Cleanup: Delete test file via API', async () => {
                if (apiService && fileRef) {
                    await apiService.deleteFile(fileRef);
                }
            });
        });
    });
}
