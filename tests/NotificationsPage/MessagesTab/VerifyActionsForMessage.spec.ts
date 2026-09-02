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

const INITIAL_NOTE_SUBJECT = 'Notification Test: Initial Admin Note';
const INITIAL_NOTE_CONTENT = 'This is the first note sent to trigger a notification.';
const CLIENT_REPLY_SUBJECT = `RE: ${INITIAL_NOTE_SUBJECT}`;
const CLIENT_REPLY_CONTENT = 'Client replying to clear the notification badge.';
const ADMIN_REPLY_SUBJECT = `${CLIENT_REPLY_SUBJECT}`;
const ADMIN_REPLY_CONTENT = 'Admin replying from the All Messages tab.';

test.describe('Comprehensive Notifications and Messages Lifecycle', () => {
    let apiService: APIServices;
    let fileRef = '';

    test.afterEach(async () => {
        if (fileRef && apiService) {
            console.log(`Cleaning up file: ${fileRef}`);
            await apiService.deleteFile(fileRef);
        }
    });

    test('Verify badge counts, reply behavior, and bulk read/unread actions', async ({ page, request, loginAs }) => {
        apiService = await APIServices.create(request);
        test.setTimeout(60 * 1000); // Set timeout to 60 seconds for this comprehensive test

        // --- Helper Function to keep code DRY ---
        const clearAllNewMessages = async (messagesPage: MessagesPage) => {
            const noNotesTextbox = page.getByText(`You don't have any notes`);
            await page.waitForTimeout(500); // Wait for any UI updates

            if (!(await noNotesTextbox.isVisible())) {
                await expect(messagesPage.select_all_checkbox).toBeVisible();
                await expect(messagesPage.mark_as_read_for_all).toBeVisible();
                await expect(messagesPage.mark_as_read_for_all).toBeDisabled();

                while (await messagesPage.select_all_checkbox.isVisible()) {
                    await messagesPage.select_all_checkbox.click();
                    await expect(messagesPage.mark_as_read_for_all).toBeEnabled();
                    await messagesPage.mark_as_read_for_all.click();

                    // Verify buttons reset to disabled state after action
                    await expect(messagesPage.mark_as_read_for_all).toBeDisabled();
                    await expect(messagesPage.mark_as_unread_for_all).toBeDisabled();
                    await page.waitForTimeout(500); // Wait for UI to update after marking as read
                }
                await expect(noNotesTextbox).toBeVisible();
            }
        };

        await test.step('Pre-Setup: Client logs in and clears initial notification state', async () => {
            // We do this first so the badge count is strictly '1' when the Admin sends the new note
            await navigateToLoginPage(page);
            await loginAs('client');

            const filesPage = await FilesPage.getInstance(page);
            await page.waitForTimeout(500);
            await expect(filesPage.notifications_button).toBeVisible();
            await expect(filesPage.search_textbox).toBeVisible();
            await filesPage.notifications_button.click();

            const messagesPage = await MessagesPage.getInstance(page);
            await expect(messagesPage.new_messages).toBeVisible();
            await messagesPage.new_messages.click();

            await clearAllNewMessages(messagesPage);
            await logoutAsCurrentUser(page);
        });

        await test.step('Setup: Admin creates file, assigns users, and sends initial note', async () => {
            const fileDetails = await apiService.createNewAutoAssetFileViaAPI();

            await loginAs('basic_admin');
            fileRef = await openFileViaSearchbar(page, fileDetails.accountNumber);

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
            await fileHomePage.assignmentOption.click();

            // Assign Client
            const assignments = await Assignments.getInstance(page);
            await assignments.assignUsersToAssignedCompany(
                ['Auto Dan-Bank3', 'Auto Keren-Bank3', 'Auto Rob-Bank3'],
                'Client'
            );

            // Send initial note to Client
            await fileHomePage.notesOption.click();
            const fileNotesSection = await Notes.getInstance(page);
            await expect(fileNotesSection.add_note_button).toBeVisible();
            await fileNotesSection.add_note_button.click();
            await fileNotesSection.sendNote(
                ['Auto Dan-Bank3', 'Auto Keren-Bank3', 'Auto Rob-Bank3'],
                INITIAL_NOTE_SUBJECT,
                INITIAL_NOTE_CONTENT
            );

            await logoutAsCurrentUser(page);
        });

        await test.step('Action: Client verifies badge, replies to message, and verifies badge clears', async () => {
            await loginAs('client');

            const filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.notifications_button).toBeVisible();
            await filesPage.notifications_button.click();

            const messagesPage = await MessagesPage.getInstance(page);
            const newNoteBadge = page.locator(messagesPage.new_message_counter_selector);

            // Verify badge appears and contains correct count
            await expect(newNoteBadge).toBeVisible();
            await expect(newNoteBadge).toContainText('1');

            await expect(messagesPage.new_messages).toBeVisible();
            await messagesPage.new_messages.click(); // Ensure we are on New Messages

            // Find the specific message row
            const messageRow = page
                .locator(messagesPage.messages_rows_selector)
                .filter({ hasText: INITIAL_NOTE_SUBJECT })
                .first();
            await expect(messageRow).toBeVisible();

            // Reply to the message
            await messagesPage.selectOptionFromActionsMenu(messageRow, 'Reply message');
            await expect(page.locator(messagesPage.note_modal_selector)).toBeVisible();

            await page.getByRole('textbox', { name: 'Content' }).fill(CLIENT_REPLY_CONTENT);
            await page.getByRole('button', { name: 'Reply' }).click();

            // Wait for modal to close
            await expect(page.locator(messagesPage.note_modal_selector)).toBeHidden();

            // Verify the badge disappears after replying
            await expect(newNoteBadge).toBeHidden();
            await expect(page.getByText(`You don't have any notes`)).toBeVisible();

            await logoutAsCurrentUser(page);
        });

        await test.step('Action: Admin verifies reply, marks as read, and replies from All Messages', async () => {
            await loginAs('basic_admin');

            const filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.notifications_button).toBeVisible();
            await filesPage.notifications_button.click();

            const messagesPage = await MessagesPage.getInstance(page);
            await expect(messagesPage.new_messages).toBeVisible();
            await messagesPage.new_messages.click();

            // Verify client reply is in New Messages
            const messageRow = page
                .locator(messagesPage.messages_rows_selector)
                .filter({ hasText: CLIENT_REPLY_SUBJECT })
                .first();
            await expect(messageRow).toBeVisible();
            await page.waitForTimeout(500); // Wait for any UI updates

            // Mark as Read and verify it disappears from New Messages
            await messagesPage.selectOptionFromActionsMenu(messageRow, 'Mark as read');
            await expect(messageRow).toBeHidden();

            // Navigate to All Messages and verify it exists there
            await messagesPage.all_messages.click();
            await expect(messageRow).toBeVisible();

            // Reply from All Messages tab
            await messagesPage.selectOptionFromActionsMenu(messageRow, 'Reply message');
            await expect(page.locator(messagesPage.note_modal_selector)).toBeVisible();
            await page.getByRole('textbox', { name: 'Content' }).fill(ADMIN_REPLY_CONTENT);
            await page.getByRole('button', { name: 'Reply' }).click();
            await expect(page.locator(messagesPage.note_modal_selector)).toBeHidden();

            await logoutAsCurrentUser(page);
        });

        await test.step('Action: Client tests bulk mark as read/unread capabilities', async () => {
            await loginAs('client');

            const filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.notifications_button).toBeVisible();
            await filesPage.notifications_button.click();

            const messagesPage = await MessagesPage.getInstance(page);
            await expect(messagesPage.new_messages).toBeVisible();
            await messagesPage.new_messages.click();

            // Find the Admin's second reply
            const messageRow = page
                .locator(messagesPage.messages_rows_selector)
                .filter({ hasText: ADMIN_REPLY_SUBJECT })
                .first();
            await expect(messageRow).toBeVisible();
            await page.waitForTimeout(500);

            // 1. Mark as Read for All
            await messagesPage.select_all_checkbox.click();
            await expect(messagesPage.mark_as_read_for_all).toBeVisible();
            await messagesPage.mark_as_read_for_all.click();
            await expect(messageRow).toBeHidden();

            // 2. Go to All Messages, find it, and Mark as Unread (Single item action)
            await messagesPage.all_messages.click();
            await expect(messageRow).toBeVisible();
            await messagesPage.selectOptionFromActionsMenu(messageRow, 'Mark as unread');

            // 3. Verify it moved back to New Messages
            await expect(messagesPage.new_messages).toBeVisible();
            await messagesPage.new_messages.click();
            await expect(messageRow).toBeVisible();

            // 4. Mark as Unread for All (from All Messages tab)
            // First mark it read again so we can test the unread bulk action
            await expect(messagesPage.select_all_checkbox).toBeVisible();
            await messagesPage.select_all_checkbox.click();
            await messagesPage.mark_as_read_for_all.click();
            await expect(messageRow).toBeHidden();

            // Go to All Messages, select all, and mark as unread for all
            await messagesPage.all_messages.click();
            await expect(messageRow).toBeVisible();
            await messagesPage.select_all_checkbox.click();
            await expect(messagesPage.mark_as_unread_for_all).toBeVisible();
            await messagesPage.mark_as_unread_for_all.click();

            // Final Verification: It should be back in New Messages
            await messagesPage.new_messages.click();
            await expect(messageRow).toBeVisible();

            await logoutAsCurrentUser(page);
        });
    });
});
