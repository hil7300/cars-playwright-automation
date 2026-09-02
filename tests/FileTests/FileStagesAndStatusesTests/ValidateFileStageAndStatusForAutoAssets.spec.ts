import { openFileViaSearchbar } from '../../../helpers';
import { navigateToLoginPage } from '../../../navigation-helpers';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { LoginPage } from '../../../pages/LoginPage';
import { expect, test } from '../../../fixtures';
import { APIServices } from '../../../services/apiServices';
import { FileSidebar } from '../../../pages/FilePages/FileSideBar';

/**
 * TEST DATA CONSTANTS
 * Centralized mapping to easily add new Stages and their corresponding Statuses.
 */
const STAGE_STATUS_MAPPING = {
    Remarketing: [
        'At Auction',
        'Awaiting Appraisals/Photos',
        'Awaiting Reserve',
        'Awaiting Reserve Approval',
        'For Sale',
        'For Sale - Reserve Update Request',
        'Off Site Sale (Sales Channel)',
        'Pending Arbitration',
        'Pending Auction Transfer',
        'Repair Requested',
        'Sold - Pending Close',
        'Transfer to New Auction Requested',
    ],
    Hold: [
        'Awaiting Access for Seizure',
        'Awaiting Client Instruction',
        'Awaiting Lawyer Response',
        'Awaiting Seasonal Access',
        'Awaiting Sheriff Release',
        'Foreign Recovery',
        'Insurance - Claim Pending',
        'Legal - Action',
        'Legal - Dispute',
        'Proceeding With Court Order',
    ],
    Unworthy: ['Awaiting Invoice Approval', 'Security Assessment'],
    'Repo (Bankruptcy)': [
        'Bankrupt - Awaiting Trustee Release',
        'Bankrupt - Debtor Filing',
        'Bankrupt - Filing Proof of Claim',
        'Pending Debtor Contact',
        'Pending Pickup',
        'Pending Transport',
        'Vehicle Worthy',
    ],
    'PQ Repo': [
        'PQ - Notice of Forfeiture',
        'PQ Awaiting NOR Expiry',
        'PQ Demand - Proofing Assignment',
        'PQ Judgement Received',
        'PQ Legal',
        'PQ Pending Seizure - Awaiting Order',
        'PQ Pending Seizure - Order Received',
        'PQ Pending Seizure - Reassess Security',
        'PQ Seized - Storage Pending Judgement',
        'PQ Waiting on Judgement',
    ],
    'Repo (Involuntary)': [
        'Pending Seizure',
        'Pending Vacancy of Unit',
        'Redeem Pending',
        'Redemption Details Requested',
        'Seized - Pending Notice Expiry',
        'Seized - Pending Transport',
        'Skip Tracer Working',
        'Vehicle Not Worthy',
        'Vehicle Worthy',
        'Waiting on Judgement',
    ],
    'Repo (Voluntary)': [
        'Pending Debtor Contact',
        'Pending Pick Up',
        'Pending Transport',
        'Pursuing Voluntary Surrender Agreement',
        'Vehicle Worthy',
    ],
    'Finance Ops': [
        'Arrears Collected Awaiting Funds to Close',
        'Awaiting Invoice Approval',
        'Funds Received',
        'Funds not yet received',
        'No repo request to close',
        'Sold - Awaiting Proceeds to Close',
        'Under Review - Additional Information Required',
        'Under Review - Pending Close',
    ],
};

// ─── DYNAMIC TEST GENERATION ───────────────────────────────────────────────

// Loop through every stage defined in our mapping object to create 7 independent tests
for (const [stage, statuses] of Object.entries(STAGE_STATUS_MAPPING)) {
    test(`Verify File Stage Updates for: ${stage}`, async ({ page, request, loginAs }) => {
        // Extended timeout to accommodate looping through all statuses for this specific stage
        test.setTimeout(120000);

        // 1. SETUP: Create file, Login, Navigate
        let apiService: APIServices;
        let fileRef: string = '';

        await test.step(`Setup: Create file and navigate`, async () => {
            apiService = await APIServices.create(request);
            const fileDetails = await apiService.createNewAutoAssetFileViaAPI();

            await navigateToLoginPage(page);
            const loginPage = await LoginPage.getInstance(page);
            await expect(loginPage.login_button).toBeVisible();

            await loginAs('basic_admin');
            fileRef = await openFileViaSearchbar(page, fileDetails.accountNumber);

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
        });

        const fileSidebar = await FileSidebar.getInstance(page);

        // 2. ACTION & ASSERTION: Loop through statuses for the current Stage
        for (const status of statuses) {
            await test.step(`Verify status update to: "${status}"`, async () => {
                await expect(fileSidebar.file_stage_dropdown).toBeVisible();
                await expect(fileSidebar.file_status_dropdown).toBeVisible();

                // Action: Update Stage and Status
                await fileSidebar.changeFileStageAndStatus(stage, status);

                // Assert: UI reflects the update
                await expect(
                    page.locator(fileSidebar.current_file_stage_container_selector).filter({ hasText: stage })
                ).toBeVisible({ timeout: 5000 });
                await expect(
                    page.locator(fileSidebar.current_file_status_container_selector).filter({ hasText: status })
                ).toBeVisible({ timeout: 5000 });

                // Assert: Audit Log recorded the exact status
                await fileSidebar.audit_log_tab.click();
                const mostRecentAuditEntry = page.locator(fileSidebar.audit_log_entries_selector).first();
                await expect(mostRecentAuditEntry).toContainText(`${status}`);

                // NOTE: If clicking the audit_log_tab hides the stage/status dropdowns,
                // you must navigate back to the main file details tab here so the next loop iteration doesn't fail.
                Example: await fileSidebar.summary_tab.click();
            });
        }

        // 3. CLEANUP: Delete the specific file created for this test
        await test.step('Cleanup: Delete test file via API', async () => {
            if (apiService && fileRef) {
                await apiService.deleteFile(fileRef);
            }
        });
    });
}
