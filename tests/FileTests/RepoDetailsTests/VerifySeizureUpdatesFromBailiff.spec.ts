import { test, expect } from '../../../fixtures';
import { openFileViaSearchbar } from '../../../helpers';
import { logoutAsCurrentUser, navigateToLoginPage } from '../../../navigation-helpers';
import { Assignments } from '../../../pages/FilePages/Assignments';
import { Documents } from '../../../pages/FilePages/Documents';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { Notes } from '../../../pages/FilePages/Notes';
import { RepoDetails } from '../../../pages/FilePages/RepoDetails';
import { FilesPage } from '../../../pages/FilesPage';
import { LoginPage } from '../../../pages/LoginPage';
import { APIServices } from '../../../services/apiServices';

test.describe('Notes Interaction Flow', () => {
    let apiService: APIServices;
    let fileRef = '';

    test.afterEach(async () => {
        if (fileRef && apiService) {
            console.log(`Cleaning up file: ${fileRef}`);
            await apiService.deleteFile(fileRef);
        }
    });

    test('Verify Bailiff Users can update seizure in Repo Details section', async ({ page, request, loginAs }) => {
        apiService = await APIServices.create(request);

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

            await logoutAsCurrentUser(page);
        });

        await test.step('Action: Log in as Bailiff and update seizure details', async () => {
            await loginAs('bailiff');
            await openFileViaSearchbar(page, fileRef);

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.repoDetailsOption).toBeVisible();

            const assignments = await Assignments.getInstance(page);
            await assignments.acceptAssignmentWithoutQuote();

            await fileHomePage.repoDetailsOption.click();

            const repoDetails = await RepoDetails.getInstance(page);
            await expect(repoDetails.seizure_address_textbox).toBeVisible();
            await repoDetails.addDataToSeizureDetails();
            await page.waitForTimeout(1500); // Wait for 1 second to ensure the note is registered before saving

            await expect(repoDetails.seizure_notes_textbox).toBeVisible();
            await repoDetails.seizure_notes_textbox.fill('This is a note added during seizure details update.');
            await expect(repoDetails.seizure_save_button).toBeEnabled({ timeout: 5000 });
            await page.waitForTimeout(500);

            await expect(repoDetails.seizure_notes_textbox).toHaveValue(
                'This is a note added during seizure details update.'
            );
            await repoDetails.seizure_save_button.click();

            await repoDetails.uploadSeizurePhotos();
        });

        await test.step('Verification: Ensure pictures uploaded during seizure details update are visible in Documents', async () => {
            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.documentsOption).toBeVisible();
            await fileHomePage.documentsOption.click();

            const documents = await Documents.getInstance(page);

            // Fix: Removed 'await' on the locator itself
            const documentRows = page.locator(documents.document_row_selector);
            await expect(documentRows).toHaveCount(5);
        });

        await test.step('Verification: Ensure seizure details are updated and a Note is created', async () => {
            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.notesOption).toBeVisible();
            await fileHomePage.notesOption.click();

            const notes = await Notes.getInstance(page);
            await expect(notes.add_note_button).toBeVisible();

            // Fix: Removed 'await' on the locators
            const latestNoteText = page.locator(notes.notes_row_selector).first();
            await expect(latestNoteText).toContainText('This is a note added during seizure details update.');
            await expect(latestNoteText).toContainText('Seizure details updated for your review');

            const secondNoteText = page.locator(notes.notes_row_selector).nth(1);
            await expect(secondNoteText).toContainText('Seizure details updated for your review');
            await expect(secondNoteText).toContainText('Seizure Date:');
            await expect(secondNoteText).toContainText('Seizure Address:');
            await expect(secondNoteText).toContainText('Mileage');
            await expect(secondNoteText).toContainText('Number of Keys');

            await logoutAsCurrentUser(page);
        });

        await test.step('Final Verification: Log in as Client and verify updated seizure details in Repo Details is not visible', async () => {
            await loginAs('client');
            await openFileViaSearchbar(page, fileRef);

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.repoDetailsOption).toBeVisible();
            await fileHomePage.notesOption.click();

            const notes = await Notes.getInstance(page);

            // Fix: Filter all rows to ensure the restricted text is absolutely not visible anywhere
            const restrictedNoteText1 = page
                .locator(notes.notes_row_selector)
                .filter({ hasText: 'This is a note added during seizure details update.' });
            const restrictedNoteText2 = page
                .locator(notes.notes_row_selector)
                .filter({ hasText: 'Seizure details updated for your review' });

            await expect(restrictedNoteText1).toBeHidden();
            await expect(restrictedNoteText2).toBeHidden();

            await logoutAsCurrentUser(page);
        });

        await test.step('Verification: Login as Admin and verify updated seizure details note', async () => {
            await loginAs('basic_admin');
            await openFileViaSearchbar(page, fileRef);

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.notesOption).toBeVisible();
            await fileHomePage.notesOption.click();

            const notes = await Notes.getInstance(page);
            await expect(notes.add_note_button).toBeVisible();

            // Fix: Removed 'await' on the locators
            const latestNoteText = page.locator(notes.notes_row_selector).first();
            await expect(latestNoteText).toContainText('This is a note added during seizure details update.');
            await expect(latestNoteText).toContainText('Seizure details updated for your review');

            const secondNoteText = page.locator(notes.notes_row_selector).nth(1);
            await expect(secondNoteText).toContainText('Seizure details updated for your review');
            await expect(secondNoteText).toContainText('Seizure Date:');
            await expect(secondNoteText).toContainText('Seizure Address:');
            await expect(secondNoteText).toContainText('Mileage');
            await expect(secondNoteText).toContainText('Number of Keys');
        });
    });
});
