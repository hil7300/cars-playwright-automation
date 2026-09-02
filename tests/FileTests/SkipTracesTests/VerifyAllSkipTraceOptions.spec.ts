import { test, expect } from '../../../fixtures';
import { openFileViaSearchbar } from '../../../helpers';
import { logoutAsCurrentUser, navigateToLoginPage } from '../../../navigation-helpers';
import { Assignments } from '../../../pages/FilePages/Assignments';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { SkipTraces, SkipTraceType } from '../../../pages/FilePages/SkipTraces';
import { LoginPage } from '../../../pages/LoginPage';
import { APIServices } from '../../../services/apiServices';

// ─── TEST DATA ───────────────────────────────────────────────────────────────
const SKIP_TRACE_TYPES: SkipTraceType[] = [
    'POR',
    'POE',
    'Mobile (Phone)',
    'Work (Phone)',
    'Home (Phone)',
    'Other (Phone)',
];

const STATUS_TRANSITIONS = ['New', 'Investigating', 'Ruled Out', 'Confirmed'];

// ─── TEST SUITE ──────────────────────────────────────────────────────────────
test.describe('Verify Skip Trace Flow', () => {
    let apiService: APIServices;
    let fileRef = '';

    test.afterEach(async () => {
        if (fileRef && apiService) {
            console.log(`Cleaning up file: ${fileRef}`);
            await apiService.deleteFile(fileRef).catch((e) => console.error(`Failed to delete file: ${e.message}`));
        }
    });

    test('Verify all options for Skip Trace flow works as expected', async ({ page, request, loginAs }) => {
        test.setTimeout(60000);

        apiService = await APIServices.create(request);
        let skipTraces: SkipTraces;

        await test.step('Setup: Create file, assign users, and clear existing Skip Traces', async () => {
            const fileDetails = await apiService.createNewAutoAssetFileViaAPI();

            await navigateToLoginPage(page);
            const loginPage = await LoginPage.getInstance(page);
            await expect(loginPage.login_button).toBeVisible();

            await loginAs('super_admin');
            fileRef = await openFileViaSearchbar(page, fileDetails.accountNumber);

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
            await fileHomePage.assignmentOption.click();

            const assignments = await Assignments.getInstance(page);
            await assignments.assignUsersToAssignedCompany('Auto Admin-Basic', 'Admin');
            await assignments.assignCompanyToFile('Bailiff', 'ABCD | ABC Bailiff Toronto', [
                'Auto Bailiff-Toronto-Two',
                'Auto Bailiff-Toronto',
                'Auto Bailiff-Vancouver',
            ]);

            await fileHomePage.skipTracesOption.click();
            skipTraces = await SkipTraces.getInstance(page);

            await expect(skipTraces.add_skip_trace_button).toBeVisible();

            // Clear imported skip traces
            const skipTraceRows = page.locator(skipTraces.skip_trace_row_selector);
            let importedCount = await skipTraceRows.count();

            while (importedCount > 0) {
                const firstRow = skipTraceRows.first();
                await firstRow.locator(skipTraces.delete_skip_trace_icon_selector).click();
                await expect(skipTraces.confirm_delete_button).toBeVisible();
                await skipTraces.confirm_delete_button.click();

                await expect(skipTraceRows).toHaveCount(importedCount - 1);
                importedCount = await skipTraceRows.count();
            }
            await expect(skipTraceRows).toHaveCount(0);
        });

        await test.step('Action & Verification: Create all types of Skip Traces', async () => {
            for (const type of SKIP_TRACE_TYPES) {
                await skipTraces.createSkipTrace({ type });

                const skipTraceEntry = page
                    .locator(skipTraces.skip_trace_row_selector)
                    .filter({ hasText: type })
                    .filter({ hasText: 'Manual' });
                await expect(skipTraceEntry, `Expected ${type} skip trace to be visible`).toBeVisible();
            }

            for (const type of SKIP_TRACE_TYPES) {
                const skipTrace = page
                    .locator(skipTraces.skip_trace_row_selector)
                    .filter({ hasText: type })
                    .filter({ hasText: 'Manual' });
                await expect(skipTrace).toHaveCount(1);
            }
        });

        await test.step('Action: Update status iteratively (New > Investigating > Ruled Out > Confirmed)', async () => {
            const skipTraceEntry = page
                .locator(skipTraces.skip_trace_row_selector)
                .filter({ hasText: 'POR' })
                .filter({ hasText: 'Manual' });
            await expect(skipTraceEntry).toBeVisible();

            const editSkipTraceButton = skipTraceEntry.locator(skipTraces.edit_skip_trace_icon_selector);
            await expect(editSkipTraceButton).toBeVisible();
            let previousStatus = '';

            // Data-driven status progression
            for (const status of STATUS_TRANSITIONS) {
                await expect(editSkipTraceButton).toBeVisible();
                await editSkipTraceButton.click();

                await expect(skipTraces.change_status_dropdown).toBeVisible();
                await skipTraces.change_status_dropdown.click();

                const statusOption = page.getByRole('option', { name: status, exact: true });
                await expect(statusOption).toBeVisible();
                await statusOption.click();
                await page.waitForTimeout(250); // Wait for status change to reflect

                await expect(skipTraces.add_note_textbox).toBeVisible();
                await skipTraces.add_note_textbox.fill(`Status changed to ${status}`);
                await skipTraces.skip_trace_save_button.click();

                // Verification
                await expect(skipTraceEntry).toBeVisible();
                await expect(skipTraceEntry).toContainText(status);

                if (previousStatus) {
                    await expect(skipTraceEntry).not.toContainText(previousStatus);
                }
                previousStatus = status;
            }

            // Verify edit is disabled after 'Confirmed'
            await editSkipTraceButton.click();
            await expect(skipTraces.skip_trace_save_button).toBeDisabled();
            await skipTraces.skip_trace_cancel_button.click();
        });

        await test.step('Verification: Client should view read-only Confirmed status', async () => {
            await logoutAsCurrentUser(page);
            await loginAs('client');

            await openFileViaSearchbar(page, fileRef);
            const fileHomePage = await FileHomePage.getInstance(page);
            await fileHomePage.skipTracesOption.click();

            // Re-instantiate POM for new session context
            skipTraces = await SkipTraces.getInstance(page);
            const skipTraceEntry = page
                .locator(skipTraces.skip_trace_row_selector)
                .filter({ hasText: 'POR' })
                .filter({ hasText: 'Manual' });

            await expect(skipTraceEntry).toBeVisible();
            await expect(skipTraceEntry).toContainText('Confirmed');

            // Client restrictions
            await expect(skipTraceEntry.locator(skipTraces.edit_skip_trace_icon_selector)).toBeHidden();
            await expect(skipTraces.add_skip_trace_button).toBeHidden();
        });

        await test.step('Verification: Bailiff should view read-only Confirmed status', async () => {
            await logoutAsCurrentUser(page);
            await loginAs('bailiff');

            await openFileViaSearchbar(page, fileRef);

            const assignments = await Assignments.getInstance(page);
            await assignments.acceptAssignmentWithoutQuote();

            const fileHomePage = await FileHomePage.getInstance(page);
            await fileHomePage.skipTracesOption.click();

            skipTraces = await SkipTraces.getInstance(page);
            const skipTraceEntry = page
                .locator(skipTraces.skip_trace_row_selector)
                .filter({ hasText: 'POR' })
                .filter({ hasText: 'Manual' });

            await expect(skipTraceEntry).toBeVisible();
            await expect(skipTraceEntry).toContainText('Confirmed');

            // Bailiff restrictions
            await expect(skipTraceEntry.locator(skipTraces.edit_skip_trace_icon_selector)).toBeHidden();
            await expect(skipTraces.add_skip_trace_button).toBeHidden();
        });
    });
});
