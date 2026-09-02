import { test, expect } from '../../../fixtures';
import { openFileViaSearchbar } from '../../../helpers';
import { logoutAsCurrentUser, navigateToLoginPage } from '../../../navigation-helpers';
import { Assignments } from '../../../pages/FilePages/Assignments';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { Notes } from '../../../pages/FilePages/Notes';
import { FilesPage } from '../../../pages/FilesPage';
import { LoginPage } from '../../../pages/LoginPage';
import { APIServices } from '../../../services/apiServices';

// ─── AI SUMMARIZER TEST DATA ─────────────────────────────────────────────────

const NOTES_DATA = [
    {
        subject: 'Initial Admin Review & Financials',
        content:
            'Account Status: The debtor is currently 90 days past due. Total arrears currently amount to $4,500.25, with an Outstanding Principal loan balance of $32,150.00 and this is really important. Please proceed with standard recovery protocol.',
    },
    {
        subject: 'Bailiff Field Update - Morning Visit',
        content:
            "Bailiff Update: As of this morning at 08:30 AM, our assigned bailiff completed their third field visit to the debtor's primary residence. The vehicle was not located on the premises, but neighbors indicated that the subject usually parks it in a restricted underground parking garage roughly two blocks away. Previous field agent notes indicated reports of minor front-end damage to the bumper and a cracked windshield.",
    },
    {
        subject: 'Action Plan & Approvals',
        content:
            'Next Steps: We have initiated a skip trace to confirm the secondary location and will deploy a spotter tonight between 10:00 PM and 2:00 AM. Approved to escalate the skip tracing budget by an additional $150.00 to cover the specialized underground lot checks. Take note of this additional budget',
    },
];

// The key data points the AI *should* extract from the combined thread, ignoring conversational fluff
const EXPECTED_SUMMARY_KEY_POINTS = [
    'Vendors Identified',
    'Key Points',
    'Important Dates/Deadlines',
    '90 days past due',
    'spotter',
];

// ─── TESTS ──────────────────────────────────────────────────────────────────

test.describe('AI Note Summarization Flow', () => {
    let apiService: APIServices;
    let fileRef = '';

    test.afterEach(async () => {
        if (fileRef && apiService) {
            console.log(`Cleaning up file: ${fileRef}`);
            await apiService.deleteFile(fileRef);
        }
    });

    test('Verify AI successfully extracts key financial and operational data from multiple notes as Admin', async ({
        page,
        request,
        loginAs,
    }) => {
        test.setTimeout(45000); // Extended timeout for multiple notes and AI generation
        apiService = await APIServices.create(request);

        await test.step('Setup: Create file, log in as Admin, and navigate to Notes', async () => {
            const fileDetails = await apiService.createNewAutoAssetFileViaAPI();

            await navigateToLoginPage(page);
            const loginPage = await LoginPage.getInstance(page);
            await expect(loginPage.login_button).toBeVisible();

            await loginAs('super_admin');
            fileRef = await openFileViaSearchbar(page, fileDetails.accountNumber);

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
            await fileHomePage.assignmentOption.click();

            // Assign users (optional for this specific flow, but keeps file state realistic)
            const assignments = await Assignments.getInstance(page);
            await assignments.assignUsersToAssignedCompany('Auto Admin-Basic', 'Admin');
            await assignments.assignCompanyToFile('Bailiff', 'ABCD | ABC Bailiff Toronto', [
                'Auto Bailiff-Toronto-Two',
                'Auto Bailiff-Toronto',
                'Auto Bailiff-Vancouver',
            ]);

            await fileHomePage.notesOption.click();
        });

        await test.step('Action: Admin posts multiple data-rich notes (Financials, Bailiff Updates, Action Plans)', async () => {
            const fileNotesSection = await Notes.getInstance(page);

            for (const note of NOTES_DATA) {
                await expect(fileNotesSection.add_note_button).toBeVisible();
                await fileNotesSection.add_note_button.click();

                await fileNotesSection.sendNote([], note.subject, note.content);

                const noteRow = page.locator(fileNotesSection.notes_row_selector).filter({ hasText: note.subject });
                await expect(noteRow).toBeVisible();
            }
        });

        await test.step('Verification: Admin triggers AI Summarization and validates extracted data', async () => {
            const fileNotesSection = await Notes.getInstance(page);

            await expect(fileNotesSection.summarize_notes_via_ai_button).toBeVisible();
            await fileNotesSection.summarize_notes_via_ai_button.click();

            const loadingText = page.getByText('Generating AI summary...');
            await expect(loadingText).toBeVisible();
            await expect(loadingText).toBeHidden({ timeout: 45000 });

            const summaryContentSection = page.locator(
                '[class="prose max-w-none bg-gray-100 rounded-md p-4 border border-gray-300 max-h-96 overflow-y-auto"]'
            );
            await expect(summaryContentSection).toBeVisible();

            const expectedHeaders = [
                'Overall Status',
                'Action Items',
                'Important Dates/Deadlines',
                'Key Points',
                'Issues/Concerns',
            ];

            for (const header of expectedHeaders) {
                await expect(summaryContentSection).toContainText(header, { timeout: 10000 });
            }

            for (const expectedPoint of EXPECTED_SUMMARY_KEY_POINTS) {
                await expect(summaryContentSection).toContainText(expectedPoint, {
                    timeout: 10000,
                    ignoreCase: true,
                });
            }

            const textContent = await summaryContentSection.innerText();
            const noneIdentifiedCount = (textContent.match(/None identified/g) || []).length;
            expect(noneIdentifiedCount).toBeLessThan(5);
        });
    });
});
