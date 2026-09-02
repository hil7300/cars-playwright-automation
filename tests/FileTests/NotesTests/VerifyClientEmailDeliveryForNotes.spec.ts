import { test, expect } from '../../../fixtures';
import { openFileViaSearchbar, extractGoToFileLink } from '../../../helpers';
import { navigateToLoginPage } from '../../../navigation-helpers';
import { Assignments } from '../../../pages/FilePages/Assignments';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { Notes } from '../../../pages/FilePages/Notes';
import { LoginPage } from '../../../pages/LoginPage';
import { APIServices } from '../../../services/apiServices';
import { GmailService, ParsedEmail } from '../../../services/gmailService';

// ─── TEST CONFIGURATION ──────────────────────────────────────────────────────
const TEST_CONFIG = {
    targetEmail: 'carsautomatoion@gmail.com',
    targetCompany: 'Email Deliverable',
    adminRole: 'super_admin',
    timeouts: {
        overallTest: 120000,
        emailPolling: 90000,
        emailInterval: 5000,
    },
};

test.describe('Verify Email Delivery for Notes', () => {
    let apiService: APIServices;
    let gmailService: GmailService;
    let receivedEmailId: string | null = null;
    let fileRef = '';

    test.afterEach(async () => {
        if (receivedEmailId && gmailService) {
            await gmailService.trashMessage(receivedEmailId).catch(console.error);
        }
        if (fileRef && apiService) {
            console.log(`Cleaning up file: ${fileRef}`);
            await apiService.deleteFile(fileRef).catch(console.error);
        }
    });

    test('Verify Email Delivery and Deep Linking for Notes', async ({ page, request, loginAs }) => {
        test.setTimeout(TEST_CONFIG.timeouts.overallTest);

        apiService = await APIServices.create(request);
        gmailService = await GmailService.create();

        let receivedEmail: ParsedEmail;
        const noteContent = `Automated Note Content Payload ${Date.now()}`;

        await test.step('Setup: Create file, assign user, and navigate to notes', async () => {
            const fileDetails = await apiService.createNewAutoAssetFileViaAPI();

            await navigateToLoginPage(page);
            await LoginPage.getInstance(page);
            await loginAs(TEST_CONFIG.adminRole);

            fileRef = await openFileViaSearchbar(page, fileDetails.accountNumber);
            const fileHomePage = await FileHomePage.getInstance(page);

            await fileHomePage.assignmentOption.click();
            const assignment = await Assignments.getInstance(page);
            await assignment.assignUsersToAssignedCompany(TEST_CONFIG.targetCompany, 'Client');

            await fileHomePage.notesOption.click();
        });

        await test.step('Action: Create note with send-email checked', async () => {
            const notes = await Notes.getInstance(page);
            await expect(notes.add_note_button).toBeVisible();
            await notes.add_note_button.click();

            await notes.sendNote(
                TEST_CONFIG.targetCompany,
                `Automated Note Test`,
                noteContent,
                true // sendEmail flag
            );
            await page.waitForTimeout(4000); // wait for the note to be processed and email to be sent
        });

        await test.step('Verification: Validate email delivery and content', async () => {
            receivedEmail = await gmailService.waitForEmail({
                to: TEST_CONFIG.targetEmail,
                subject: 'CARS event notification',
                timeoutMs: TEST_CONFIG.timeouts.emailPolling,
                pollIntervalMs: TEST_CONFIG.timeouts.emailInterval,
            });
            receivedEmailId = receivedEmail.id;

            const combinedBody = `${receivedEmail.textBody}\n${receivedEmail.htmlBody}`;
            expect(combinedBody, 'Email should indicate a new note').toContain(
                `You have a new note on Reference #${fileRef}`
            );
            expect(combinedBody, 'Email should contain the note payload').toContain(noteContent);
        });

        await test.step('Action & Verification: Extract "Go to File" link and navigate', async () => {
            const goToFileLink = extractGoToFileLink(receivedEmail, fileRef);
            expect(goToFileLink, `Failed to extract "Go to File" link for file ${fileRef}`).toBeTruthy();

            await page.goto(goToFileLink as string);

            const fileRefNumeric = fileRef.match(/\d+$/)?.[0] ?? fileRef;
            await expect(page).toHaveURL(new RegExp(fileRefNumeric));

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
        });
    });
});
