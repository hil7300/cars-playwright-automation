import { test, expect } from '../../../fixtures';
import { openFileViaSearchbar } from '../../../helpers';
import { logoutAsCurrentUser, navigateToLoginPage } from '../../../navigation-helpers';
import { Assignments } from '../../../pages/FilePages/Assignments';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { Notes } from '../../../pages/FilePages/Notes';
import { FilesPage } from '../../../pages/FilesPage';
import { LoginPage } from '../../../pages/LoginPage';
import { MessagesPage } from '../../../pages/MessagesPage';
import { APIServices } from '../../../services/apiServices';

test.describe('Admin & Managers Can Accept Bailiff Quotes', () => {
    let apiService: APIServices;
    let fileRef = '';

    // Teardown: This ALWAYS runs, even on failure.
    test.afterEach(async () => {
        if (fileRef && apiService) {
            console.log(`Cleaning up file: ${fileRef}`);
            await apiService.deleteFile(fileRef);
        }
    });

    test('Flow: Bailiff submits quote, Admin requests resubmit, Bailiff resubmits, Admin rejects and closes, Admin Re-assigns, Bailiff submits, Admin Accepts', async ({
        page,
        request,
        loginAs,
    }) => {
         test.setTimeout(60000);

        apiService = await APIServices.create(request);

        await test.step('Setup: Create file via API, log in as Admin, and assign Bailiff', async () => {
            const fileDetails = await apiService.createNewAutoAssetFileViaAPI();
            fileRef = fileDetails.accountNumber;

            await navigateToLoginPage(page);
            const loginPage = await LoginPage.getInstance(page);
            await expect(loginPage.login_button).toBeVisible();

            await loginAs('basic_admin');

            fileRef = await openFileViaSearchbar(page, fileDetails.accountNumber);

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
            await fileHomePage.assignmentOption.click();

            const assignments = await Assignments.getInstance(page);
            await assignments.assignCompanyToFile(
                'Bailiff',
                'ABCD | ABC Bailiff Toronto',
                ['Auto Bailiff-Toronto-Two', 'Auto Bailiff-Toronto', 'Auto Bailiff-Vancouver'],
                true
            );

            await fileHomePage.notesOption.click();

            const notes = await Notes.getInstance(page);
            await expect(notes.add_note_button).toBeVisible();

            let noteRow = page.locator(notes.notes_row_selector).filter({ hasText: 'Acknowledge Assignment' });
            await expect(noteRow).toBeVisible();

            await logoutAsCurrentUser(page);
        });

        await test.step('Action: Bailiff logs in and submits a quote', async () => {
            await loginAs('bailiff');

            const filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.notifications_button).toBeVisible();
            await filesPage.notifications_button.click();

            const messagesPage = await MessagesPage.getInstance(page);
            let messageRow = page
                .locator(messagesPage.messages_rows_selector)
                .filter({ hasText: fileRef })
                .filter({ hasText: 'Acknowledge Assignment' });

            await expect(messageRow).toBeVisible();
            await expect(messageRow).toContainText(
                'New repo request. Please confirm receipt and provide quote for authorization to proceed.'
            );

            await messageRow.locator(messagesPage.file_ref_id_cell_selector).click();

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
            await fileHomePage.assignmentOption.click();

            const assignments = await Assignments.getInstance(page);
            await expect(assignments.assignment_request_banner).toBeVisible();
            await assignments.submitQuote('Towing and Storage', 500);

            let approvalPendingBanner = page.locator(assignments.approval_pending_banner_selector);
            await expect(approvalPendingBanner).toBeVisible();
            await expect(approvalPendingBanner).toContainText('ASSIGNMENT APPROVAL PENDING');

            await logoutAsCurrentUser(page);
        });

        await test.step('Action: Admin logs in, reviews quote, and requests resubmission', async () => {
            await loginAs('basic_admin');

            const filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.notifications_button).toBeVisible();
            await filesPage.notifications_button.click();

            const messagesPage = await MessagesPage.getInstance(page);
            let messageRow = page
                .locator(messagesPage.messages_rows_selector)
                .filter({ hasText: fileRef })
                .filter({ hasText: 'Bailiff Quote Submitted' });

            await expect(messageRow).toBeVisible();
            await messageRow.locator(messagesPage.file_ref_id_cell_selector).click();

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
            await fileHomePage.assignmentOption.click();

            const assignments = await Assignments.getInstance(page);
            let approvalPendingBanner = page.locator(assignments.approval_pending_banner_selector);
            await expect(approvalPendingBanner).toBeVisible();
            await expect(approvalPendingBanner).toContainText('QUOTE RESPONSE PENDING');
            await approvalPendingBanner.locator(assignments.review_quote_button).click();

            await expect(assignments.approve_quote_button).toBeVisible();
            await assignments.reject_quote_dropdown.click();
            await expect(assignments.reject_and_close_button).toBeVisible();
            await expect(assignments.reject_and_resubmit_button).toBeVisible();
            await assignments.reject_and_resubmit_button.click();

            await expect(assignments.rejection_reason_textbox).toBeVisible();
            await assignments.rejection_reason_textbox.fill(
                'Quote rejected for testing purposes. Please resubmit with updated amount.'
            );
            await assignments.reject_and_resubmit_button.click();

            await fileHomePage.notesOption.click();

            const notes = await Notes.getInstance(page);
            await expect(notes.add_note_button).toBeVisible();

            let noteRow = page
                .locator(notes.notes_row_selector)
                .filter({ hasText: 'Assignment Quote Rejected - Resubmit Requested' });
            await expect(noteRow).toBeVisible();

            await logoutAsCurrentUser(page);
        });

        await test.step('Action: Bailiff logs in, checks notification, and resubmits quote', async () => {
            await loginAs('bailiff');

            const filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.notifications_button).toBeVisible();
            await filesPage.notifications_button.click();

            const messagesPage = await MessagesPage.getInstance(page);
            let messageRow = page
                .locator(messagesPage.messages_rows_selector)
                .filter({ hasText: fileRef })
                .filter({ hasText: 'Assignment Quote Rejected - Resubmit Requested' });

            await expect(messageRow).toBeVisible();
            await messageRow.locator(messagesPage.file_ref_id_cell_selector).click();

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
            await fileHomePage.assignmentOption.click();

            const assignments = await Assignments.getInstance(page);
            await expect(assignments.assignment_request_banner).toBeVisible();

            await assignments.submitQuote('Towing and Storage (Resubmitted)', 450);

            let approvalPendingBanner = page.locator(assignments.approval_pending_banner_selector);
            await expect(approvalPendingBanner).toBeVisible();
            await expect(approvalPendingBanner).toContainText('ASSIGNMENT APPROVAL PENDING');

            await fileHomePage.notesOption.click();
            const notes = await Notes.getInstance(page);
            await expect(notes.add_note_button).toBeHidden();

            let noteRow = page.locator(notes.notes_row_selector).filter({ hasText: 'Bailiff Quote Submitted' });
            await expect(noteRow).toHaveCount(2);

            await logoutAsCurrentUser(page);
        });

        await test.step('Action: Admin logs in, reviews the resubmitted quote, and Rejects & Closes', async () => {
            await loginAs('basic_admin');

            const filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.notifications_button).toBeVisible();
            await filesPage.notifications_button.click();

            const messagesPage = await MessagesPage.getInstance(page);
            let messageRow = page
                .locator(messagesPage.messages_rows_selector)
                .filter({ hasText: fileRef })
                .filter({ hasText: 'Bailiff Quote Submitted' })
                .first();

            await expect(messageRow).toBeVisible();
            await messageRow.locator(messagesPage.file_ref_id_cell_selector).click();

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
            await fileHomePage.assignmentOption.click();

            const assignments = await Assignments.getInstance(page);
            let approvalPendingBanner = page.locator(assignments.approval_pending_banner_selector);
            await expect(approvalPendingBanner).toBeVisible();
            await expect(approvalPendingBanner).toContainText('QUOTE RESPONSE PENDING');
            await approvalPendingBanner.locator(assignments.review_quote_button).click();

            await expect(assignments.approve_quote_button).toBeVisible();
            await assignments.reject_quote_dropdown.click();
            await expect(assignments.reject_and_close_button).toBeVisible();
            await assignments.reject_and_close_button.click();

            await expect(assignments.rejection_reason_textbox).toBeVisible();
            await assignments.rejection_reason_textbox.fill('Final rejection and close for testing purposes.');
            await assignments.reject_and_close_button.click();

            await fileHomePage.notesOption.click();
            const notes = await Notes.getInstance(page);
            await expect(notes.add_note_button).toBeVisible();

            let noteRow = page
                .locator(notes.notes_row_selector)
                .filter({ hasText: 'Assignment Quote Rejected - Assignment Closed' });
            await expect(noteRow).toBeVisible();
        });

        await test.step('Action: Admin re-assigns the file to the Bailiff again', async () => {
            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
            await fileHomePage.assignmentOption.click();

            const assignments = await Assignments.getInstance(page);
            // Re-assign the Bailiff company for a fresh request
            await assignments.assignCompanyToFile(
                'Bailiff',
                'ABCD | ABC Bailiff Toronto',
                ['Auto Bailiff-Toronto-Two', 'Auto Bailiff-Toronto', 'Auto Bailiff-Vancouver'],
                true
            );

            await fileHomePage.notesOption.click();
            const notes = await Notes.getInstance(page);
            await expect(notes.add_note_button).toBeVisible();

            // Verify a new 'Acknowledge Assignment' note was generated (should be 2 total now)
            let noteRow = page.locator(notes.notes_row_selector).filter({ hasText: 'Acknowledge Assignment' });
            await expect(noteRow).toHaveCount(2);

            await logoutAsCurrentUser(page);
        });

        await test.step('Action: Bailiff logs in, checks the NEW notification, and submits quote', async () => {
            await loginAs('bailiff');

            const filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.notifications_button).toBeVisible();
            await filesPage.notifications_button.click();

            const messagesPage = await MessagesPage.getInstance(page);
            // Use .first() to grab the most recent Acknowledge Assignment notification
            let messageRow = page
                .locator(messagesPage.messages_rows_selector)
                .filter({ hasText: fileRef })
                .filter({ hasText: 'Acknowledge Assignment' })
                .first();

            await expect(messageRow).toBeVisible();
            await messageRow.locator(messagesPage.file_ref_id_cell_selector).click();

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
            await fileHomePage.assignmentOption.click();

            const assignments = await Assignments.getInstance(page);
            await expect(assignments.assignment_request_banner).toBeVisible();
            await assignments.submitQuote('Towing and Storage (Final Attempt)', 550);

            let approvalPendingBanner = page.locator(assignments.approval_pending_banner_selector);
            await expect(approvalPendingBanner).toBeVisible();
            await expect(approvalPendingBanner).toContainText('ASSIGNMENT APPROVAL PENDING');

            await logoutAsCurrentUser(page);
        });

        await test.step('Action: Admin logs in, reviews the NEW quote, and ACCEPTS it', async () => {
            await loginAs('basic_admin');

            const filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.notifications_button).toBeVisible();
            await filesPage.notifications_button.click();

            const messagesPage = await MessagesPage.getInstance(page);
            // Grab the newest 'Bailiff Quote Submitted' notification
            let messageRow = page
                .locator(messagesPage.messages_rows_selector)
                .filter({ hasText: fileRef })
                .filter({ hasText: 'Bailiff Quote Submitted' })
                .first();

            await expect(messageRow).toBeVisible();
            await messageRow.locator(messagesPage.file_ref_id_cell_selector).click();

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
            await fileHomePage.assignmentOption.click();

            const assignments = await Assignments.getInstance(page);
            let approvalPendingBanner = page.locator(assignments.approval_pending_banner_selector);
            await expect(approvalPendingBanner).toBeVisible();
            await expect(approvalPendingBanner).toContainText('QUOTE RESPONSE PENDING');
            await approvalPendingBanner.locator(assignments.review_quote_button).click();

            // Accept flow
            await expect(assignments.approve_quote_button).toBeVisible();
            await assignments.approve_quote_button.click();

            // Verify the note for successful acceptance
            await expect(fileHomePage.notesOption).toBeVisible();
            await fileHomePage.notesOption.click();
            const notes = await Notes.getInstance(page);
            await expect(notes.add_note_button).toBeVisible();

            // Note: Update this string to match the exact text your app uses for an accepted quote note
            let noteRow = page.locator(notes.notes_row_selector).filter({ hasText: 'Assignment Quote Approved' });
            await expect(noteRow).toBeVisible();

            await logoutAsCurrentUser(page);
        });
    });
});
