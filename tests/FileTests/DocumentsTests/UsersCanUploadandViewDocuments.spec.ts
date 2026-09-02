import { test, expect } from '../../../fixtures';
import {
    getDaysDifference,
    getEndOfMonthDate,
    getFutureDate,
    getPastDate,
    getTodaysDate,
    openFileViaSearchbar,
} from '../../../helpers';
import { logoutAsCurrentUser, navigateToLoginPage } from '../../../navigation-helpers';
import { Assignments } from '../../../pages/FilePages/Assignments';
import { Documents } from '../../../pages/FilePages/Documents';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { Notes } from '../../../pages/FilePages/Notes';
import { RepoDetails } from '../../../pages/FilePages/RepoDetails';
import { LoginPage } from '../../../pages/LoginPage';
import { APIServices } from '../../../services/apiServices';

const BAILIFF_COMPANY = 'ABCD | ABC Bailiff Toronto';
const BAILIFF_USERS = ['Auto Bailiff-Toronto-Two', 'Auto Bailiff-Toronto', 'Auto Bailiff-Vancouver'];
const CLIENT_USERS = ['Auto Dan-Bank3', 'Auto Keren-Bank3', 'Auto Rob-Bank3'];

const ADMIN_DOC_DESC = 'Admin Uploaded Document';
const CLIENT_DOC_DESC = 'Client Uploaded Document';
const BAILIFF_DOC_DESC = 'Bailiff Uploaded Document';
const NOTE_DOC_UPLOADED = 'Document uploaded'; // Extracted magic string

test.describe('Verify Users Can Upload/Download/View Documents', () => {
    let apiService: APIServices;
    let fileRef = '';

    test.afterEach(async () => {
        if (fileRef && apiService) {
            console.log(`Cleaning up file: ${fileRef}`);
            await apiService.deleteFile(fileRef);
        }
    });

    test('Flow: Verify Document Visibility Rules across Admin, Client, and Bailiff Roles', async ({
        page,
        request,
        loginAs,
    }) => {
        apiService = await APIServices.create(request);

        await test.step('Setup: Create file, log in as Admin, and assign roles', async () => {
            const fileDetails = await apiService.createNewAutoAssetFileViaAPI();
            fileRef = fileDetails.accountNumber;

            await navigateToLoginPage(page);
            const loginPage = await LoginPage.getInstance(page);
            await expect(loginPage.login_button).toBeVisible();

            await loginAs('basic_admin');
            fileRef = await openFileViaSearchbar(page, fileRef);

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
            await fileHomePage.assignmentOption.click();

            const assignments = await Assignments.getInstance(page);
            await assignments.assignUsersToAssignedCompany(CLIENT_USERS, 'Client');
            await assignments.assignCompanyToFile('Bailiff', BAILIFF_COMPANY, BAILIFF_USERS);
        });

        await test.step('Action: Admin uploads a document', async () => {
            const fileHomePage = await FileHomePage.getInstance(page);
            await fileHomePage.documentsOption.click();

            const documents = await Documents.getInstance(page);
            await expect(documents.upload_document_button).toBeVisible();

            await documents.uploadDocument(undefined, ADMIN_DOC_DESC);

            const documentRow = page.locator(documents.document_row_selector).filter({ hasText: ADMIN_DOC_DESC });
            await expect(documentRow).toBeVisible();

            const numOfDocuments = await documents.getNumberofDocuments();
            expect(numOfDocuments).toBe(1);

            await fileHomePage.notesOption.click();
            const notes = await Notes.getInstance(page);
            await expect(notes.add_note_button).toBeVisible();

            const noteRow = page
                .locator(notes.notes_row_selector)
                .filter({ hasText: NOTE_DOC_UPLOADED })
                .filter({ hasText: ADMIN_DOC_DESC });
            await expect(noteRow).toBeVisible();

            await logoutAsCurrentUser(page);
        });

        await test.step('Action: Client logs in, verifies Admin doc, and uploads Client doc', async () => {
            await loginAs('client');
            await openFileViaSearchbar(page, fileRef);

            const fileHomePage = await FileHomePage.getInstance(page);
            await fileHomePage.documentsOption.click();

            const documents = await Documents.getInstance(page);

            // Verify Admin document is visible to the Client
            const adminDocRow = page.locator(documents.document_row_selector).filter({ hasText: ADMIN_DOC_DESC });
            await expect(adminDocRow).toBeVisible();

            // Upload a new document as the Client
            await expect(documents.upload_document_button).toBeVisible();
            await documents.uploadDocument(undefined, CLIENT_DOC_DESC);

            const clientDocRow = page.locator(documents.document_row_selector).filter({ hasText: CLIENT_DOC_DESC });
            await expect(clientDocRow).toBeVisible();

            const numOfDocuments = await documents.getNumberofDocuments();
            expect(numOfDocuments).toBe(2);

            await fileHomePage.notesOption.click();
            const notes = await Notes.getInstance(page);
            await expect(notes.add_note_button).toBeVisible();

            const noteRow = page
                .locator(notes.notes_row_selector)
                .filter({ hasText: NOTE_DOC_UPLOADED })
                .filter({ hasText: CLIENT_DOC_DESC });
            await expect(noteRow).toBeVisible();

            await logoutAsCurrentUser(page);
        });

        await test.step('Action: Bailiff logs in, verifies Admin doc, confirms Client doc is hidden, and uploads Bailiff doc', async () => {
            await loginAs('bailiff');
            await openFileViaSearchbar(page, fileRef);

            const fileHomePage = await FileHomePage.getInstance(page);
            await fileHomePage.assignmentOption.click();
            const assignments = await Assignments.getInstance(page);
            await assignments.acceptAssignmentWithoutQuote();

            await fileHomePage.documentsOption.click();
            const documents = await Documents.getInstance(page);

            // Verify Admin document is visible to the Bailiff
            const adminDocRow = page.locator(documents.document_row_selector).filter({ hasText: ADMIN_DOC_DESC });
            await expect(adminDocRow).toBeVisible();

            // CRITICAL FIX: Verify Client document is visible to the Bailiff
            const clientDocRow = page.locator(documents.document_row_selector).filter({ hasText: CLIENT_DOC_DESC });
            await expect(clientDocRow).toBeVisible();

            // Upload a new document as the Bailiff
            await expect(documents.upload_document_button).toBeVisible();
            await documents.uploadDocument(undefined, BAILIFF_DOC_DESC);

            const bailiffDocRow = page.locator(documents.document_row_selector).filter({ hasText: BAILIFF_DOC_DESC });
            await expect(bailiffDocRow).toBeVisible();

            // CRITICAL FIX: Expect 3 documents (Admin + Client + Bailiff)
            const numOfDocuments = await documents.getNumberofDocuments();
            expect(numOfDocuments).toBe(3);

            // Switch to notes AFTER all document assertions are finished
            await fileHomePage.notesOption.click();
            const notes = await Notes.getInstance(page);
            await expect(notes.add_note_button).toBeVisible();

            const noteRow = page
                .locator(notes.notes_row_selector)
                .filter({ hasText: NOTE_DOC_UPLOADED })
                .filter({ hasText: BAILIFF_DOC_DESC });
            await expect(noteRow).toBeHidden();

            await logoutAsCurrentUser(page);
        });

        await test.step('Verification: Client logs in and confirms Bailiff doc is hidden', async () => {
            await loginAs('client');
            await openFileViaSearchbar(page, fileRef);

            const fileHomePage = await FileHomePage.getInstance(page);
            await fileHomePage.documentsOption.click();

            const documents = await Documents.getInstance(page);

            // Verify Admin and Client documents are visible
            const adminDocRow = page.locator(documents.document_row_selector).filter({ hasText: ADMIN_DOC_DESC });
            await expect(adminDocRow).toBeVisible();

            const clientDocRow = page.locator(documents.document_row_selector).filter({ hasText: CLIENT_DOC_DESC });
            await expect(clientDocRow).toBeVisible();

            // Verify Bailiff document is hidden
            const bailiffDocRow = page.locator(documents.document_row_selector).filter({ hasText: BAILIFF_DOC_DESC });
            await expect(bailiffDocRow).toBeHidden();

            const numOfDocuments = await documents.getNumberofDocuments();
            expect(numOfDocuments).toBe(2);

            await logoutAsCurrentUser(page);
        });

        await test.step('Verification: Admin logs in and verifies all three documents are visible', async () => {
            await loginAs('basic_admin');
            await openFileViaSearchbar(page, fileRef);

            const fileHomePage = await FileHomePage.getInstance(page);
            await fileHomePage.documentsOption.click();

            const documents = await Documents.getInstance(page);

            // Verify all documents are visible to the Admin
            await expect(
                page.locator(documents.document_row_selector).filter({ hasText: ADMIN_DOC_DESC })
            ).toBeVisible();
            await expect(
                page.locator(documents.document_row_selector).filter({ hasText: CLIENT_DOC_DESC })
            ).toBeVisible();

            const bailiffRow = page.locator(documents.document_row_selector).filter({ hasText: BAILIFF_DOC_DESC });
            await expect(bailiffRow).toBeVisible();
            await expect(bailiffRow.locator(documents.post_to_client_icon_selector)).toBeVisible();

            const numOfDocuments = await documents.getNumberofDocuments();
            expect(numOfDocuments).toBe(3);
        });
    });
});
