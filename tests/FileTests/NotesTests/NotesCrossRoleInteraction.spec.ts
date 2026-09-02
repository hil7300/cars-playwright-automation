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

const NOTE_SUBJECT = 'CARS Automation Note Subject';
const REPLY_SUBJECT = `RE: ${NOTE_SUBJECT}`;
const CLIENT_REPLY_CONTENT = 'This is a reply to the admin note from client side through automation';
const SUBCONTRACTOR_NOTE_SUBJECT = 'Note from Subcontractor';
const SUBCONTRACTOR_NOTE_CONTENT = 'This is a note from subcontractor after accepting the assignment';

test.describe('Notes Interaction Flow', () => {
    let apiService: APIServices;
    let fileRef = '';
    let notesCountAfterAdminNote = 0;

    test.afterEach(async () => {
        if (fileRef && apiService) {
            console.log(`Cleaning up file: ${fileRef}`);
            await apiService.deleteFile(fileRef);
        }
    });

    test('Send & Reply Notes between Admin/Subcontractor/Client', async ({ page, request, loginAs }) => {
        test.setTimeout(60000);

        apiService = await APIServices.create(request);

        const loginAndNavigateToNotes = async (role: string) => {
            await loginAs(role);
            const filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.notifications_button).toBeVisible();
            await expect(filesPage.search_textbox).toBeVisible();
            await openFileViaSearchbar(page, fileRef);
            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.notesOption).toBeVisible();
            await fileHomePage.notesOption.click();
            const fileNotesSection = await Notes.getInstance(page);
            await expect(fileNotesSection.add_note_button).toBeVisible();
            return fileNotesSection;
        };

        await test.step('Setup: Create file, log in as Admin, and assign users', async () => {
            const fileDetails = await apiService.createNewAutoAssetFileViaAPI();

            await navigateToLoginPage(page);
            const loginPage = await LoginPage.getInstance(page);
            await expect(loginPage.login_button).toBeVisible();

            await loginAs('basic_admin');
            fileRef = await openFileViaSearchbar(page, fileDetails.accountNumber);

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
            await fileHomePage.assignmentOption.click();

            const assignments = await Assignments.getInstance(page);
            await assignments.assignUsersToAssignedCompany('Auto Admin-Basic', 'Admin');
            await assignments.assignUsersToAssignedCompany(
                ['Auto Dan-Bank3', 'Auto Keren-Bank3', 'Auto Rob-Bank3'],
                'Client'
            );
            await assignments.assignCompanyToFile('Bailiff', 'ABCD | ABC Bailiff Toronto', [
                'Auto Bailiff-Toronto-Two',
                'Auto Bailiff-Toronto',
                'Auto Bailiff-Vancouver',
            ]);
        });

        await test.step('Action: Admin sends a note to the Client', async () => {
            const fileHomePage = await FileHomePage.getInstance(page);
            await fileHomePage.notesOption.click();

            const fileNotesSection = await Notes.getInstance(page);
            await expect(fileNotesSection.add_note_button).toBeVisible();
            await fileNotesSection.add_note_button.click();
            await fileNotesSection.sendNote(['Auto Dan-Bank3', 'Auto Keren-Bank3', 'Auto Rob-Bank3']);

            notesCountAfterAdminNote = await fileNotesSection.getNumberOfNotes();
            await logoutAsCurrentUser(page);
        });

        await test.step('Action: Client replies to the Admin note via Notifications', async () => {
            await loginAs('client');

            const filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.notifications_button).toBeVisible();
            await filesPage.notifications_button.click();

            const messagesPage = await MessagesPage.getInstance(page);
            const messageRow = page.locator(messagesPage.messages_rows_selector).filter({ hasText: fileRef });

            // Verify the admin note appears in new messages
            await expect(messageRow).toBeVisible();
            await expect(messageRow).toContainText(NOTE_SUBJECT);

            // Mark as read and verify it moves out of "New Messages"
            await page.waitForTimeout(500); // Wait for any potential UI updates before marking as read
            await messagesPage.selectOptionFromActionsMenu(messageRow, 'Mark as read');
            await expect(messageRow).toBeHidden();

            // Verify it persists under "All Messages"
            await messagesPage.all_messages.click();
            await expect(messageRow).toBeVisible();

            // Reply to the note
            await messagesPage.selectOptionFromActionsMenu(messageRow, 'Reply message');
            await expect(page.locator(messagesPage.note_modal_selector)).toBeVisible();
            await expect(page.getByRole('textbox', { name: 'Subject' })).toHaveValue(REPLY_SUBJECT);
            await expect(page.getByRole('textbox', { name: 'Content' })).toBeEmpty();

            await page.getByRole('textbox', { name: 'Content' }).fill(CLIENT_REPLY_CONTENT);
            await page.getByRole('button', { name: 'Reply' }).click();
            await expect(page.locator(messagesPage.note_modal_selector)).toBeHidden();

            await logoutAsCurrentUser(page);
        });

        await test.step('Action: Subcontractor accepts assignment and sends a note to Admin', async () => {
            await loginAs('bailiff');

            const filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.notifications_button).toBeVisible();
            await filesPage.notifications_button.click();

            const messagesPage = await MessagesPage.getInstance(page);
            const messageRow = page.locator(messagesPage.messages_rows_selector).filter({ hasText: fileRef });
            await expect(messageRow).toBeVisible();

            // Navigate to the file from the notification
            await messageRow.locator(messagesPage.file_ref_id_cell_selector).click();

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.notesOption).toBeVisible();

            // Accept the assignment before adding a note
            const assignmentSection = await Assignments.getInstance(page);
            await assignmentSection.acceptAssignmentWithoutQuote();

            // Send a note to Admin
            await fileHomePage.notesOption.click();
            const fileNotesSection = await Notes.getInstance(page);
            await expect(fileNotesSection.add_note_button).toBeVisible();
            await fileNotesSection.add_note_button.click();
            await fileNotesSection.sendNote(
                ['Auto Admin-Basic'],
                SUBCONTRACTOR_NOTE_SUBJECT,
                SUBCONTRACTOR_NOTE_CONTENT
            );

            // Verify the original notification is cleared
            await filesPage.notifications_button.click();
            await expect(messageRow).toBeHidden();

            await logoutAsCurrentUser(page);
        });

        await test.step('Verification: Client should NOT see the Subcontractor note', async () => {
            const fileNotesSection = await loginAndNavigateToNotes('client');

            const noteRow = page
                .locator(fileNotesSection.notes_row_selector)
                .filter({ hasText: SUBCONTRACTOR_NOTE_SUBJECT });
            await expect(noteRow).toBeHidden();

            await logoutAsCurrentUser(page);
        });

        await test.step('Action: Admin verifies Subcontractor note and posts it to the Client', async () => {
            const fileNotesSection = await loginAndNavigateToNotes('basic_admin');

            // Admin sees: original note + client reply + subcontractor note = at least 3 new
            const expectedMinNotes = 3;
            const notesCountAfterSubcontractorNote = await fileNotesSection.getNumberOfNotes();
            expect(notesCountAfterSubcontractorNote).toBeGreaterThanOrEqual(
                notesCountAfterAdminNote + expectedMinNotes
            );

            // Verify subcontractor note content and post it to Client
            const noteRow = page
                .locator(fileNotesSection.notes_row_selector)
                .filter({ hasText: SUBCONTRACTOR_NOTE_SUBJECT });
            await expect(noteRow).toBeVisible();
            await expect(noteRow).toContainText(SUBCONTRACTOR_NOTE_CONTENT);

            const postToClientIcon = noteRow.locator(fileNotesSection.post_to_client_icon_selector);
            await expect(postToClientIcon).toBeVisible();
            await postToClientIcon.click();

            await logoutAsCurrentUser(page);
        });

        await test.step('Verification: Client should NOW see the Subcontractor note after Admin posted it', async () => {
            const fileNotesSection = await loginAndNavigateToNotes('client');

            // Client sees: original admin note + client reply + posted subcontractor note
            const expectedClientNotes = 2;
            const notesCountForClient = await fileNotesSection.getNumberOfNotes();
            expect(notesCountForClient).toBeGreaterThanOrEqual(notesCountAfterAdminNote + expectedClientNotes);

            const noteRow = page
                .locator(fileNotesSection.notes_row_selector)
                .filter({ hasText: SUBCONTRACTOR_NOTE_SUBJECT });
            await expect(noteRow).toBeVisible();

            await logoutAsCurrentUser(page);
        });
    });
});
