import { test, expect } from '../../../fixtures';
import { openFileViaSearchbar } from '../../../helpers';
import { logoutAsCurrentUser, navigateToLoginPage } from '../../../navigation-helpers';
import { CreateFilePage } from '../../../pages/CreateFilePage';
import { Assignments } from '../../../pages/FilePages/Assignments';
import { Documents } from '../../../pages/FilePages/Documents';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { Notes } from '../../../pages/FilePages/Notes';
import { RelatedParties } from '../../../pages/FilePages/RelatedParties';
import { FilesPage } from '../../../pages/FilesPage';
import { LoginPage } from '../../../pages/LoginPage';
import { APIServices } from '../../../services/apiServices';

test.describe('Verify Debtor Search for Non-Auto Assets @requires-triggers', () => {
    let apiService: APIServices;
    let fileRef = '';
    let fileHomePage: FileHomePage;
    let relatedParties: RelatedParties;
    let documents: Documents;

    test.afterEach(async () => {
        if (fileRef && apiService) {
            console.log(`Cleaning up file: ${fileRef}`);
            await apiService.deleteFile(fileRef);
        }
    });

    test('Verify Debtor Search for Non-Auto Assets', async ({ page, request, loginAs }) => {
        test.setTimeout(60000);
        apiService = await APIServices.create(request);

        await test.step('Setup: Create a Non-Auto file via UI and open it', async () => {
            await navigateToLoginPage(page);
            const loginPage = await LoginPage.getInstance(page);
            await expect(loginPage.login_button).toBeVisible();

            await loginAs('super_admin');

            const filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.search_textbox).toBeVisible();
            await filesPage.create_file_button.click();

            const createFilePage = await CreateFilePage.getInstance(page);

            // Execute the creation flow for Non-Auto Asset
            const fileDetails = await createFilePage.createNewFile('QA Automation Bank', 'All-Terrain Vehicle');
            fileRef = fileDetails.refNumber;

            fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
        });

        await test.step('Action: Update debtor address and request PPSA search', async () => {
            await expect(fileHomePage.relatedPartiesOption).toBeVisible();
            await fileHomePage.relatedPartiesOption.click();

            relatedParties = await RelatedParties.getInstance(page);
            await expect(relatedParties.add_related_party_button).toBeVisible();

            const primaryDebtorCard = page
                .locator(relatedParties.related_party_card_selector)
                .filter({ hasText: 'Primary' });
            await expect(primaryDebtorCard).toBeVisible();

            const ppsaSearchButton = primaryDebtorCard.locator(relatedParties.request_ppsa_search_button);
            const editRelatedPartyIcon = primaryDebtorCard.locator(relatedParties.edit_related_party_icon);

            await ppsaSearchButton.click();
            await expect(page.locator(relatedParties.toast_message_selector)).toContainText(
                'Invalid relatedPartyId / missing required relatedParty details'
            );

            // ─── Edit Debtor Address ───
            await expect(editRelatedPartyIcon).toBeVisible();
            await editRelatedPartyIcon.click();
            await expect(relatedParties.edit_street_1_textbox).toBeVisible();

            await relatedParties.edit_street_1_textbox.fill('123 Main St');

            await relatedParties.edit_country_dropdown.click();
            const countryOption = page.locator('.select-country__option').getByText('Canada', { exact: true });
            await expect(countryOption).toBeVisible();
            await countryOption.click();

            await relatedParties.edit_province_dropdown.click();
            const provinceOption = page.locator('.select-state__option').getByText('British Columbia', { exact: true });
            await expect(provinceOption).toBeVisible();
            await provinceOption.click();

            await relatedParties.edit_city_textbox.fill('Vancouver');
            await relatedParties.edit_postal_code_textbox.fill('V5K 0A1');

            await relatedParties.save_changes_button.click();

            // Wait for the edit modal to close so it doesn't intercept our next click
            await expect(relatedParties.edit_street_1_textbox).toBeHidden();

            // ─── Request Search ───
            await expect(ppsaSearchButton).toBeVisible();
            await expect(ppsaSearchButton).toBeEnabled();
            await expect(ppsaSearchButton).not.toContainText('Complete');

            await ppsaSearchButton.click();
            await expect(ppsaSearchButton).toContainText('Pending');
            await expect(ppsaSearchButton).toBeDisabled();
        });

        await test.step('Action: Trigger backend processing and verify completion status', async () => {
            await apiService.triggerPpsaSearchForAsset();
            await page.reload();

            relatedParties = await RelatedParties.getInstance(page);
            await relatedParties.confirmPPSASearchCompleted(apiService);

            const primaryDebtorCard = page
                .locator(relatedParties.related_party_card_selector)
                .filter({ hasText: 'Primary' });
            const ppsaSearchButton = primaryDebtorCard.locator(relatedParties.request_ppsa_search_button);

            await expect(ppsaSearchButton).toContainText('Complete');
        });

        await test.step('Verification: Check that PPSA Debtor Search documents were generated', async () => {
            fileHomePage = await FileHomePage.getInstance(page);
            await fileHomePage.documentsOption.click();

            documents = await Documents.getInstance(page);
            await expect(documents.upload_document_button).toBeVisible();

            const documentRows = page.locator(documents.document_row_selector);
            await expect(documentRows).toHaveCount(2);

            for (let i = 0; i < 2; i++) {
                await expect(documentRows.nth(i)).toContainText('PPSA Debtor Search');
            }
        });
    });
});
