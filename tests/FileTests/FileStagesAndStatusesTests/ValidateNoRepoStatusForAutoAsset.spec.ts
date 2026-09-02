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
import { Requests } from '../../../pages/FilePages/Requests';

/**
 * TEST DATA CONSTANTS
 * Centralized mapping of Stages → their valid Statuses.
 * To cover a new stage, add a key-value pair here — the dynamic test
 * generation loop and final closure step will pick it up automatically.
 */
const STAGE_STATUS_MAPPING: Record<string, string[]> = {
    Closed: [
        '2/3 Paid Rule Applies',
        '3rd Party Settlement - Paid to Client',
        'Appraisal Only',
        'Assigned for Market Value Only',
        'Assigned in Error',
        'Bank Pursuing Legal',
        'Bankrupt/Not Delinquent',
        'Bankruptcy - Exemption',
        'Bankruptcy - Exemption - No Equity',
        'Closed for Cause',
        'Customer Refused to Release Security',
        'Deceased',
        'Duplicate File',
        'File Transferred to Another Creditor',
        'Fraud/Customs/C.P.I.C. Police/Interpol',
        'Imperfect Security',
        'Incomplete Documentation',
        'Indian Reserve Denied Access',
        'Insurance Payout - Paid to Client',
        'Loan Paid Out - Paid to Client',
        'Loan Paid Out - Settlement',
        'No Equity',
        'Potential Fraud',
        'Reason Not Given By Client',
        'Redemption completed',
        'Skip',
        'Substitution of Security',
        'Unable to Locate',
        'Unit Inaccessible',
    ],
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

/**
 * Extracts the first integer from a string (e.g. "Closed (12)" → 12).
 * Throws a descriptive error if no digits are found.
 */
const parseCountFromText = (text: string): number => {
    const match = text.match(/\d+/);
    if (!match) {
        throw new Error(`Could not parse a numeric count from text: "${text}"`);
    }
    return parseInt(match[0], 10);
};

/**
 * Iterates every status for a given stage and asserts that the expected
 * modal appears. Reused in Steps 2 and 4 which differ only in the modal
 * expectations applied after the loop body runs.
 */
const attemptClosureForAllStatuses = async (
    fileSidebar: FileSidebar,
    stage: string,
    statuses: string[],
    assertModal: (sidebar: FileSidebar, status: string) => Promise<void>
) => {
    for (const status of statuses) {
        await test.step(`Checking status: "${status}"`, async () => {
            await expect(fileSidebar.file_stage_dropdown).toBeVisible();
            await expect(fileSidebar.file_status_dropdown).toBeVisible();
            await fileSidebar.changeFileStageAndStatus(stage, status);
            await assertModal(fileSidebar, status);
        });
    }
};

// ─── DYNAMIC TEST GENERATION ───────────────────────────────────────────────

for (const [stage, statuses] of Object.entries(STAGE_STATUS_MAPPING)) {
    test.describe(`File Stage Updates: ${stage}`, () => {
        let apiService: APIServices;
        let fileRef: string = '';

        // Cleanup runs even on mid-test failure, preventing leaked files.
        test.afterEach(async () => {
            if (apiService && fileRef) {
                await apiService.deleteFile(fileRef);
            }
        });

        test(`Verify all statuses and file closure for stage: ${stage}`, async ({ page, request, loginAs }) => {
            test.setTimeout(180000);

            let initialClosedCount: number = 0;

            // ── Step 1: SETUP — create file via API, login, navigate ────────
            await test.step('Setup: Create file and navigate to file home', async () => {
                apiService = await APIServices.create(request);
                const fileDetails = await apiService.createNewAutoAssetFileViaAPI();

                await navigateToLoginPage(page);
                const loginPage = await LoginPage.getInstance(page);
                await expect(loginPage.login_button).toBeVisible();
                await loginAs('basic_admin');

                // Capture baseline closed-file count before any mutations
                const filesPage = await FilesPage.getInstance(page);
                const closedFilesText = await filesPage.closed_files_button.innerText();
                initialClosedCount = parseCountFromText(closedFilesText);

                fileRef = await openFileViaSearchbar(page, fileDetails.accountNumber);
                const fileHomePage = await FileHomePage.getInstance(page);
                await expect(fileHomePage.assignmentOption).toBeVisible();
            });

            // ── Step 2: Attempt closure WITHOUT prerequisites ───────────────
            // Assignment and accounting are empty at this point. The system
            // should block closure with an *alert* modal (not a confirmation)
            // for every status in this stage.
            await test.step('Verify alert modal when prerequisites are missing', async () => {
                const fileSidebar = await FileSidebar.getInstance(page);

                await attemptClosureForAllStatuses(fileSidebar, stage, statuses, async (sb) => {
                    await expect(sb.close_file_alert_modal).toBeVisible();
                    await sb.close_file_alert_ok_button.click();
                });
            });

            // ── Step 3: Fill prerequisites — Assignment & Accounting ────────
            await test.step('Fill assignment and accounting data', async () => {
                const fileHomePage = await FileHomePage.getInstance(page);

                // Assign a user to the file
                await fileHomePage.assignmentOption.click();
                const assignments = await Assignments.getInstance(page);
                await assignments.assignUsersToAssignedCompany('Auto Admin-Basic', 'Admin');

                // Populate accounting: arrears, fees, payments, invoice
                await fileHomePage.accountingOption.click();
                const accounting = await Accounting.getInstance(page);
                await expect(accounting.arrears_radio_button).toBeVisible();

                await accounting.addDataToArrearsRedemptionTab();
                await accounting.addFeeEntry();
                await accounting.addCollectedPaymentEntry();
                await accounting.generateInvoice('No Repo & AR');
            });

            // ── Step 4: Attempt closure WITH assignment & accounting but
            //    WITHOUT an approved Request ─────────────────────────────────
            // The system should now show a *confirmation* modal that also
            // contains an alert stating "Requests required to close."
            await test.step('Verify "Requests required" alert after invoice but before request', async () => {
                const fileSidebar = await FileSidebar.getInstance(page);

                await attemptClosureForAllStatuses(fileSidebar, stage, statuses, async (sb) => {
                    await expect(sb.close_file_confirmation_modal).toBeVisible();
                    await expect(sb.close_file_alert_modal).toBeVisible();
                    await expect(sb.close_file_alert_modal).toContainText('Requests required to close.');
                    await expect(sb.close_file_alert_ok_button).toBeVisible();
                    await sb.close_file_alert_ok_button.click();
                });
            });

            // ── Step 5: Create and approve a closing Request ────────────────
            await test.step('Create a closing request and approve it', async () => {
                const fileHomePage = await FileHomePage.getInstance(page);
                await fileHomePage.requestsOption.click();

                const requestsPage = await Requests.getInstance(page);
                await requestsPage.createRequest();
                await expect(requestsPage.send_to_ops_button).toBeVisible();

                await requestsPage.respond_to_request_button.click();
                await expect(requestsPage.reason_for_response_textbox).toBeVisible();
                await requestsPage.reason_for_response_textbox.fill('Approving request to close the file');
                await requestsPage.approve_request_button.click();

                await expect(requestsPage.respond_to_request_button).toBeHidden();
            });

            // ── Step 6: Close the file ──────────────────────────────────────
            // All prerequisites are now met. We close with the *first* status
            // only — the earlier loops already verified that every status
            // surfaces the correct modals; one actual closure is sufficient.
            await test.step(`Close file with stage="${stage}", status="${statuses[0]}"`, async () => {
                const fileSidebar = await FileSidebar.getInstance(page);

                await fileSidebar.changeFileStageAndStatus(stage, statuses[0]);
                await expect(fileSidebar.close_file_confirmation_modal).toBeVisible();
                await expect(fileSidebar.close_file_button).toBeVisible();
                await fileSidebar.close_file_button.click();
            });

            // ── Step 7: Dashboard count reflects the closure ────────────────
            await test.step('Verify closed file count increased on dashboard', async () => {
                const filesPage = await FilesPage.getInstance(page);
                await filesPage.files_button.click();
                await expect(filesPage.search_textbox).toBeVisible();

                // Polling handles UI refresh lag; note that in parallel CI
                // runs another test could also increment this counter — the
                // definitive proof is Step 8's row-level check.
                await expect(async () => {
                    const updatedText = await filesPage.closed_files_button.innerText();
                    const updatedCount = parseCountFromText(updatedText);
                    expect(updatedCount).toBeGreaterThan(initialClosedCount);
                }).toPass({ timeout: 10000 });
            });

            // ── Step 8: Verify the file appears in the Closed Files list ────
            await test.step('Verify closed file exists in Closed Files section', async () => {
                const filesPage = await FilesPage.getInstance(page);
                await filesPage.closed_files_button.click();
                await expect(filesPage.search_textbox).toBeVisible();

                const targetFileLink = page.locator(filesPage.file_ref_id_cell_selector).filter({ hasText: fileRef });
                await expect(targetFileLink).toBeVisible();
            });
        });
    });
}
