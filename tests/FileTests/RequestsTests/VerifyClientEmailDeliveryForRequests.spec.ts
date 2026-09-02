import { test, expect } from '../../../fixtures';
import { openFileViaSearchbar, extractGoToFileLink } from '../../../helpers';
import { navigateToLoginPage } from '../../../navigation-helpers';
import { Assignments } from '../../../pages/FilePages/Assignments';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { Requests } from '../../../pages/FilePages/Requests';
import { LoginPage } from '../../../pages/LoginPage';
import { APIServices } from '../../../services/apiServices';
import { GmailService, ParsedEmail } from '../../../services/gmailService';

// ─── TEST CONFIGURATION ──────────────────────────────────────────────────────
const TEST_CONFIG = {
    targetEmail: 'carsautomatoion@gmail.com',
    targetUser: 'Email Deliverable User',
    targetCompany: 'Email Deliverable',
    adminRole: 'super_admin',
    timeouts: {
        overallTest: 120000,
        emailPolling: 90000,
        emailInterval: 5000,
    },
};

test.describe('Verify Email Delivery for Requests', () => {
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

    test('Verify Email Delivery and Deep Linking for Requests', async ({ page, request, loginAs }) => {
        test.setTimeout(TEST_CONFIG.timeouts.overallTest);

        apiService = await APIServices.create(request);
        gmailService = await GmailService.create();

        const reasonText = `Automated Request Test ${Date.now()}`;
        let receivedEmail: ParsedEmail;

        await test.step('Setup: Create file, assign user, and navigate to requests', async () => {
            const fileDetails = await apiService.createNewAutoAssetFileViaAPI();

            await navigateToLoginPage(page);
            await LoginPage.getInstance(page);
            await loginAs(TEST_CONFIG.adminRole);

            fileRef = await openFileViaSearchbar(page, fileDetails.accountNumber);
            const fileHomePage = await FileHomePage.getInstance(page);

            await fileHomePage.assignmentOption.click();
            const assignment = await Assignments.getInstance(page);
            await assignment.assignUsersToAssignedCompany(TEST_CONFIG.targetCompany, 'Client');

            await fileHomePage.requestsOption.click();
        });

        await test.step('Action: Create request with notify-by-email', async () => {
            const requests = await Requests.getInstance(page);
            await requests.createRequest({
                requestType: 'Request to Close',
                reason: reasonText,
                notifyByEmail: true,
                sendToUsers: TEST_CONFIG.targetUser,
            });
            await page.waitForTimeout(4000); // wait for the email to be sent
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
            expect(combinedBody, 'Email should contain the request notification text').toContain(
                'A new Request has been made for Reference'
            );
            expect(combinedBody, 'Email should contain the file reference number').toContain(fileRef);
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
