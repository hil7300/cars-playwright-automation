import { test, expect } from '../../../fixtures';
import { openFileViaSearchbar } from '../../../helpers';
import { logoutAsCurrentUser, navigateToLoginPage } from '../../../navigation-helpers';
import { Assignments } from '../../../pages/FilePages/Assignments';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { Notes } from '../../../pages/FilePages/Notes';
import { FilesPage } from '../../../pages/FilesPage';
import { LoginPage } from '../../../pages/LoginPage';
import { SettingsPage } from '../../../pages/SettingsPage';
import { APIServices } from '../../../services/apiServices';

// ─── TEST DATA CONFIGURATION ────────────────────────────────────────────────
const TEMPLATES = {
    admin: { name: 'Auto Admin Template', content: 'This is an auto-generated template for Admin.' },
    client: { name: 'Auto Client Template', content: 'This is an auto-generated template for Client.' },
    bailiff: { name: 'Auto Bailiff Template', content: 'This is an auto-generated template for Bailiff.' },
    allRoles: {
        name: 'Auto All Roles Template',
        content: 'This is an auto-generated template for Admin, Client, and Bailiff.',
    },
};

const TEMPLATE_NAMES = Object.values(TEMPLATES).map((t) => t.name);

test.describe('Verify Note Template Feature and Note Without Recipient', () => {
    let apiService: APIServices;
    let fileRef = '';

    test.afterEach(async () => {
        if (fileRef && apiService) {
            console.log(`Cleaning up file: ${fileRef}`);
            await apiService.deleteFile(fileRef);
        }
    });

    test('Verify Note Template Feature: Create, Enforce RBAC, and Delete Templates', async ({
        page,
        request,
        loginAs,
    }) => {
        test.setTimeout(90000); // Slightly increased timeout to account for pre-test cleanup
        apiService = await APIServices.create(request);

        // Page Objects
        let filesPage: FilesPage;
        let settingsPage: SettingsPage;
        let fileHomePage: FileHomePage;
        let notes: Notes;
        let assignments: Assignments;
        let fileDetails: { accountNumber: string };

        // ─── HELPER: REUSABLE NOTE VERIFICATION FLOW ───
        const verifyNoteVisibilityAndSubmit = async (
            targetTemplate: typeof TEMPLATES.admin,
            hiddenTemplates: string[],
            visibleTemplates: string[],
            sendToUser?: string
        ) => {
            await expect(notes.add_note_button).toBeVisible();
            await notes.add_note_button.click();

            const sendNoteModal = page.locator(notes.note_modal_selector);
            await expect(sendNoteModal).toBeVisible();
            await expect(notes.template_search_by_subject_textbox).toBeVisible();

            // 1. Assert Negative Cases (Hidden Templates)
            for (const hiddenName of hiddenTemplates) {
                await notes.template_search_by_subject_textbox.fill(hiddenName);
                await expect(page.getByRole('heading', { name: hiddenName })).toBeHidden();
            }

            // 2. Assert Positive Cases (Visible Templates)
            for (const visibleName of visibleTemplates) {
                await notes.template_search_by_subject_textbox.fill(visibleName);
                await expect(page.getByRole('heading', { name: visibleName })).toBeVisible();
            }

            // 3. Fill and Select Target Template
            await notes.template_search_by_subject_textbox.fill(targetTemplate.name);
            const templateOption = page.getByRole('heading', { name: targetTemplate.name });
            await expect(templateOption).toBeVisible();
            await templateOption.click();

            // 4. Verify Content was populated
            await expect(notes.subject_textbox).toHaveValue(targetTemplate.name);
            await expect(notes.content_textbox).toHaveValue(targetTemplate.content);

            // 5. Handle "Send To" logic if required by role
            if (sendToUser) {
                await expect(notes.send_note_button).toBeDisabled();
                await expect(notes.send_to_dropdown).toBeVisible();
                await notes.send_to_dropdown.click();

                const option = page.getByRole('option', { name: sendToUser });
                await expect(option).toBeVisible();
                await option.click();
            }

            // 6. Submit Note
            await expect(notes.send_note_button).toBeEnabled();
            await notes.send_note_button.click();
            await expect(sendNoteModal).toBeHidden();

            // 7. Verify Note Row appears in history
            const notesRow = page.locator(notes.notes_row_selector).filter({ hasText: targetTemplate.name });
            await expect(notesRow).toBeVisible();
        };

        // ─── TEST EXECUTION ───
        try {
            await test.step('Setup: Create File, Log in as Super Admin, and navigate to Settings', async () => {
                fileDetails = await apiService.createNewAutoAssetFileViaAPI();

                await navigateToLoginPage(page);
                const loginPage = await LoginPage.getInstance(page);
                await expect(loginPage.login_button).toBeVisible();

                await loginAs('super_admin');

                filesPage = await FilesPage.getInstance(page);
                await expect(filesPage.settings_button).toBeVisible();
                await expect(filesPage.search_textbox).toBeVisible();
                await filesPage.settings_button.click();

                settingsPage = await SettingsPage.getInstance(page);
                await expect(settingsPage.note_templates_tab).toBeVisible();
                await settingsPage.note_templates_tab.click();
            });

            // ─── NEW STEP: PRE-TEST CLEANUP ───
            await test.step('Pre-test Cleanup: Delete existing test templates if they exist', async () => {
                for (const name of TEMPLATE_NAMES) {
                    const templateRows = page.locator(settingsPage.template_row_selector).filter({ hasText: name });
                    let count = await templateRows.count();

                    while (count > 0) {
                        console.log(`Found existing template from previous run: ${name}. Deleting...`);
                        await settingsPage.deleteTemplate(name);

                        // Wait for the specific row to be removed before checking count again
                        await expect(templateRows).toHaveCount(count - 1);
                        count = await templateRows.count();
                    }
                }
            });

            await test.step('Create Note Templates for Admin, Client, Bailiff, and All Roles', async () => {
                await settingsPage.createNoteTemplate(TEMPLATES.admin.name, TEMPLATES.admin.content, 'Admin');
                await settingsPage.createNoteTemplate(TEMPLATES.client.name, TEMPLATES.client.content, 'Client');
                await settingsPage.createNoteTemplate(TEMPLATES.bailiff.name, TEMPLATES.bailiff.content, 'Bailiff');
                await settingsPage.createNoteTemplate(TEMPLATES.allRoles.name, TEMPLATES.allRoles.content, [
                    'Admin',
                    'Client',
                    'Bailiff',
                ]);
            });

            await test.step('Verify all Note Templates are visible in the settings table', async () => {
                for (const name of TEMPLATE_NAMES) {
                    await expect(
                        page.locator(settingsPage.template_row_selector).filter({ hasText: name })
                    ).toBeVisible();
                }
            });

            await test.step('Verify Note Template RBAC for Admin at the file level', async () => {
                await expect(filesPage.files_button).toBeVisible();
                await filesPage.files_button.click();
                fileRef = await openFileViaSearchbar(page, fileDetails.accountNumber);

                fileHomePage = await FileHomePage.getInstance(page);

                // Admin specific prep: Assign Bailiff
                await expect(fileHomePage.assignmentOption).toBeVisible();
                await fileHomePage.assignmentOption.click();
                assignments = await Assignments.getInstance(page);
                await assignments.assignCompanyToFile('Bailiff', 'ABCD | ABC Bailiff Toronto', [
                    'Auto Bailiff-Toronto-Two',
                    'Auto Bailiff-Toronto',
                    'Auto Bailiff-Vancouver',
                ]);

                await expect(fileHomePage.notesOption).toBeVisible();
                await fileHomePage.notesOption.click();
                notes = await Notes.getInstance(page);

                // Admin sends a note WITHOUT specifying a recipient (Broadcast)
                await verifyNoteVisibilityAndSubmit(
                    TEMPLATES.admin, // Target
                    [TEMPLATES.client.name, TEMPLATES.bailiff.name], // Hidden
                    [TEMPLATES.admin.name, TEMPLATES.allRoles.name] // Visible
                );

                await logoutAsCurrentUser(page);
            });

            await test.step('Verify Note Template RBAC for Client at the file level', async () => {
                await navigateToLoginPage(page);
                await loginAs('client');
                await openFileViaSearchbar(page, fileDetails.accountNumber);

                await expect(fileHomePage.notesOption).toBeVisible();
                await fileHomePage.notesOption.click();
                notes = await Notes.getInstance(page);

                // ─── Verify that the Note sent by Admin (Broadcast) IS visible to the Client ───
                const adminNoteRow = page.locator(notes.notes_row_selector).filter({ hasText: TEMPLATES.admin.name });
                await expect(adminNoteRow).toBeVisible();

                await verifyNoteVisibilityAndSubmit(
                    TEMPLATES.client, // Target
                    [TEMPLATES.admin.name, TEMPLATES.bailiff.name], // Hidden
                    [TEMPLATES.client.name, TEMPLATES.allRoles.name], // Visible
                    'Auto Admin-Basic' // Requires Send To
                );

                await logoutAsCurrentUser(page);
            });

            await test.step('Verify Note Template RBAC for Bailiff at the file level', async () => {
                await navigateToLoginPage(page);
                await loginAs('bailiff');
                await openFileViaSearchbar(page, fileDetails.accountNumber);

                // Bailiff specific prep: Accept assignment
                await expect(fileHomePage.assignmentOption).toBeVisible();
                await fileHomePage.assignmentOption.click();
                await assignments.acceptAssignmentWithoutQuote();

                await expect(fileHomePage.notesOption).toBeVisible();
                await fileHomePage.notesOption.click();
                notes = await Notes.getInstance(page);

                await verifyNoteVisibilityAndSubmit(
                    TEMPLATES.bailiff, // Target
                    [TEMPLATES.admin.name, TEMPLATES.client.name], // Hidden
                    [TEMPLATES.bailiff.name, TEMPLATES.allRoles.name], // Visible
                    'Auto Admin-Basic' // Requires Send To
                );
            });
        } finally {
            // ─── GUARANTEED CLEANUP ───
            await test.step('Teardown: Delete Note Templates', async () => {
                await navigateToLoginPage(page);

                let filesPage = await FilesPage.getInstance(page);
                await expect(filesPage.search_textbox).toBeVisible();
                await logoutAsCurrentUser(page);
                let loginPage = await LoginPage.getInstance(page);
                await expect(loginPage.login_button).toBeVisible();
                await loginAs('super_admin');

                // Re-initialize instances in case the test failed before they were created
                filesPage = await FilesPage.getInstance(page);
                await expect(filesPage.settings_button).toBeVisible();
                await expect(filesPage.search_textbox).toBeVisible();
                await filesPage.settings_button.click();

                settingsPage = await SettingsPage.getInstance(page);
                await expect(settingsPage.note_templates_tab).toBeVisible();
                await settingsPage.note_templates_tab.click();
                await page.waitForTimeout(500); // Wait for templates to load

                for (const name of TEMPLATE_NAMES) {
                    await settingsPage
                        .deleteTemplate(name)
                        .catch((e) => console.log(`Could not delete ${name}:`, e.message));
                }
            });
        }
    });
});
