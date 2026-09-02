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

// --- CONSTANTS ---
// Extracting magic strings prevents typos and makes future maintenance a breeze
const NOTES = {
    ACKNOWLEDGE: 'Acknowledge Assignment',
    QUOTE_SUBMITTED: 'Bailiff Quote Submitted',
    RESUBMIT_REQUESTED: 'Assignment Quote Rejected - Resubmit Requested',
    DECLINED: 'Assignment Declined',
    ACCEPTED: 'Assignment Accepted',
};

const BAILIFF_COMPANY = 'ABCD | ABC Bailiff Toronto';
const BAILIFF_USERS = ['Auto Bailiff-Toronto-Two', 'Auto Bailiff-Toronto', 'Auto Bailiff-Vancouver'];

test.describe('Admin & Managers Can Accept Bailiff Quotes', () => {
    let apiService: APIServices;
    let fileRef = '';

    // Teardown: This ALWAYS runs, even on failure, keeping the database clean.
    test.afterEach(async () => {
        if (fileRef && apiService) {
            console.log(`Cleaning up file: ${fileRef}`);
            await apiService.deleteFile(fileRef);
        }
    });

    test('Flow: Bailiff quote lifecycle - Submit, Resubmit request, Decline, Re-assign, and Accept', async ({
        page,
        request,
        loginAs,
    }) => {
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
            await assignments.assignCompanyToFile('Bailiff', BAILIFF_COMPANY, BAILIFF_USERS);

            await fileHomePage.notesOption.click();

            const notes = await Notes.getInstance(page);
            await expect(notes.add_note_button).toBeVisible();

            const noteRow = page.locator(notes.notes_row_selector).filter({ hasText: NOTES.ACKNOWLEDGE });
            await expect(noteRow).toBeVisible();

            await logoutAsCurrentUser(page);
        });

        await test.step('Action: Bailiff logs in and submits a multi-service quote', async () => {
            await loginAs('bailiff');

            const filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.notifications_button).toBeVisible();
            await filesPage.notifications_button.click();

            const messagesPage = await MessagesPage.getInstance(page);
            const messageRow = page
                .locator(messagesPage.messages_rows_selector)
                .filter({ hasText: fileRef })
                .filter({ hasText: NOTES.ACKNOWLEDGE });

            await expect(messageRow).toBeVisible();
            await expect(messageRow).toContainText('New file for repo. Please confirm receipt');

            await messageRow.locator(messagesPage.file_ref_id_cell_selector).click();

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
            await fileHomePage.assignmentOption.click();

            const assignments = await Assignments.getInstance(page);
            await expect(assignments.assignment_request_banner).toBeVisible();
            await expect(assignments.assignment_request_accept_with_quote_button).toBeVisible();
            await assignments.assignment_request_accept_with_quote_button.click();

            // Store locators to keep code clean and readable
            const serviceTextbox = page.locator(assignments.quote_service_textbox_selector);
            const amountTextbox = page.locator(assignments.quote_amount_textbox_selector);

            // First service
            await expect(serviceTextbox).toBeVisible();
            await serviceTextbox.fill('Storage and Towing');
            await expect(amountTextbox).toBeVisible();
            await amountTextbox.fill('500');

            // Add second service
            await expect(assignments.add_service_button).toBeVisible();
            await assignments.add_service_button.click();

            await expect(serviceTextbox.nth(1)).toBeVisible();
            await serviceTextbox.nth(1).fill('Additional Service');
            await expect(amountTextbox.nth(1)).toBeVisible();
            await amountTextbox.nth(1).fill('900');

            await assignments.submit_quote_button.click();
            await expect(assignments.add_service_button).toBeHidden();

            const toast = page.locator(assignments.toast_selector);
            await expect(toast).toBeVisible();
            await expect(toast).toContainText('Quote submitted successfully');
            await toast.locator('[aria-label="Close"]').click();

            const approvalPendingBanner = page.locator(assignments.approval_pending_banner_selector);
            await expect(approvalPendingBanner).toBeVisible();
            await expect(approvalPendingBanner).toContainText('ASSIGNMENT APPROVAL PENDING');

            await logoutAsCurrentUser(page);
        });

        await test.step('Action: Admin logs in, reviews quote, and rejects for resubmission', async () => {
            await loginAs('basic_admin');

            const filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.notifications_button).toBeVisible();
            await filesPage.notifications_button.click();

            const messagesPage = await MessagesPage.getInstance(page);
            const messageRow = page
                .locator(messagesPage.messages_rows_selector)
                .filter({ hasText: fileRef })
                .filter({ hasText: NOTES.QUOTE_SUBMITTED });

            await expect(messageRow).toBeVisible();
            await messageRow.locator(messagesPage.file_ref_id_cell_selector).click();

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
            await fileHomePage.assignmentOption.click();

            const assignments = await Assignments.getInstance(page);
            const approvalPendingBanner = page.locator(assignments.approval_pending_banner_selector);
            await expect(approvalPendingBanner).toBeVisible();
            await expect(approvalPendingBanner).toContainText('QUOTE RESPONSE PENDING');
            await approvalPendingBanner.locator(assignments.review_quote_button).click();

            // Verify quote values
            const amountTextbox = page.locator(assignments.quote_amount_textbox_selector);
            await expect(assignments.approve_quote_button).toBeVisible();
            await expect(amountTextbox.nth(0)).toHaveValue('$ 500.00');
            await expect(amountTextbox.nth(1)).toHaveValue('$ 900.00');
            await expect(page.locator('[class="font-bold"]')).toHaveText('$1,400.00');

            // Reject flow
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

            const noteRow = page.locator(notes.notes_row_selector).filter({ hasText: NOTES.RESUBMIT_REQUESTED });
            await expect(noteRow).toBeVisible();

            await logoutAsCurrentUser(page);
        });

        await test.step('Action: Bailiff logs in, checks resubmission notification, and DECLINES assignment', async () => {
            await loginAs('bailiff');

            const filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.notifications_button).toBeVisible();
            await filesPage.notifications_button.click();

            const messagesPage = await MessagesPage.getInstance(page);
            let messageRow = page
                .locator(messagesPage.messages_rows_selector)
                .filter({ hasText: fileRef })
                .filter({ hasText: NOTES.RESUBMIT_REQUESTED });

            await expect(messageRow).toBeVisible();
            await messageRow.locator(messagesPage.file_ref_id_cell_selector).click();

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
            await fileHomePage.assignmentOption.click();

            const assignments = await Assignments.getInstance(page);
            await expect(assignments.assignment_request_banner).toBeVisible();
            await expect(assignments.assignment_request_accept_button).toBeHidden();

            await assignments.assignment_request_decline_button.click();
            await expect(assignments.rejection_reason_textbox).toBeVisible();

            const declineModal = page.locator(assignments.accept_assignment_without_quote_modal_selector);
            await expect(declineModal.getByRole('button', { name: 'Decline' })).toBeVisible();

            // Trigger validation errors
            await declineModal.getByRole('button', { name: 'Decline' }).click();
            await expect(page.getByText('Additional information is required')).toBeVisible();

            await assignments.rejection_reason_textbox.fill('Declining');
            await expect(page.getByText('Additional information must be at least 10 characters')).toBeVisible();

            // Submit valid decline
            await assignments.rejection_reason_textbox.fill('Declining assignment for testing purposes.');
            await declineModal.getByRole('button', { name: 'Decline' }).click();

            const toast = page.locator(assignments.toast_selector);
            await expect(toast).toContainText('Response submitted successfully');
            await toast.locator('[aria-label="Close"]').click();

            // Verify notification generation
            await expect(filesPage.notifications_button).toBeVisible();
            await filesPage.notifications_button.click();
            await messagesPage.all_messages.click();

            messageRow = page
                .locator(messagesPage.messages_rows_selector)
                .filter({ hasText: fileRef })
                .filter({ hasText: NOTES.DECLINED });

            await expect(messageRow).toBeVisible();
            await expect(messageRow).toContainText('ABCD has declined the file assignment.');

            await logoutAsCurrentUser(page);
        });

        await test.step('Action: Admin logs in, verifies declined status, and re-assigns the file', async () => {
            await loginAs('basic_admin');

            const filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.notifications_button).toBeVisible();
            await filesPage.notifications_button.click();

            const messagesPage = await MessagesPage.getInstance(page);
            const messageRow = page
                .locator(messagesPage.messages_rows_selector)
                .filter({ hasText: fileRef })
                .filter({ hasText: NOTES.DECLINED })
                .first();

            await expect(messageRow).toBeVisible();
            await messageRow.locator(messagesPage.file_ref_id_cell_selector).click();

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
            await fileHomePage.assignmentOption.click();

            const assignments = await Assignments.getInstance(page);
            await assignments.assignCompanyToFile('Bailiff', BAILIFF_COMPANY, BAILIFF_USERS);

            await fileHomePage.notesOption.click();
            const notes = await Notes.getInstance(page);
            await expect(notes.add_note_button).toBeVisible();

            // Should be 2 notes now due to re-assignment
            const noteRow = page.locator(notes.notes_row_selector).filter({ hasText: NOTES.ACKNOWLEDGE });
            await expect(noteRow).toHaveCount(2);

            await logoutAsCurrentUser(page);
        });

        await test.step('Action: Bailiff logs in, checks new notification, and ACCEPTS assignment without quote', async () => {
            await loginAs('bailiff');

            const filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.notifications_button).toBeVisible();
            await filesPage.notifications_button.click();

            const messagesPage = await MessagesPage.getInstance(page);
            const messageRow = page
                .locator(messagesPage.messages_rows_selector)
                .filter({ hasText: fileRef })
                .filter({ hasText: NOTES.ACKNOWLEDGE })
                .first();

            await expect(messageRow).toBeVisible();
            await messageRow.locator(messagesPage.file_ref_id_cell_selector).click();

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
            await fileHomePage.assignmentOption.click();

            const assignments = await Assignments.getInstance(page);
            await expect(assignments.assignment_request_banner).toBeVisible();
            await expect(assignments.assignment_request_accept_button).toBeVisible();

            await assignments.acceptAssignmentWithoutQuote();

            // Verify final note was added
            await fileHomePage.notesOption.click();
            const notes = await Notes.getInstance(page);
            await expect(notes.add_note_button).toBeVisible();

            const noteRow = page.locator(notes.notes_row_selector).filter({ hasText: NOTES.ACCEPTED });
            await expect(noteRow).toBeVisible();

            await logoutAsCurrentUser(page);
        });
    });
});
