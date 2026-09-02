import { test, expect } from '../../../fixtures';
import { openFileViaSearchbar } from '../../../helpers';
import { logoutAsCurrentUser, navigateToLoginPage } from '../../../navigation-helpers';
import { Assignments } from '../../../pages/FilePages/Assignments';
import { Documents } from '../../../pages/FilePages/Documents';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { Notes } from '../../../pages/FilePages/Notes';
import { RelatedParties } from '../../../pages/FilePages/RelatedParties';
import { FilesPage } from '../../../pages/FilesPage';
import { LoginPage } from '../../../pages/LoginPage';
import { APIServices } from '../../../services/apiServices';

test.describe('Verify Debtor Search for Auto Assets @requires-triggers', () => {
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

    test('Verify Debtor Search for Auto Assets', async ({ page, request, loginAs }) => {
        test.setTimeout(60000); // Set timeout to 1 minute for this test
        apiService = await APIServices.create(request);

        let fileDetails;

        await test.step('Setup: Create file, log in as Admin, and open the file', async () => {
            fileDetails = await apiService.createNewAutoAssetFileViaAPI();

            await navigateToLoginPage(page);
            const loginPage = await LoginPage.getInstance(page);
            await expect(loginPage.login_button).toBeVisible();

            await loginAs('super_admin');
            fileRef = await openFileViaSearchbar(page, fileDetails.accountNumber);

            fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
        });

        await test.step('Action: Navigate to Related Parties and request PPSA search', async () => {
            await expect(fileHomePage.relatedPartiesOption).toBeVisible();
            await fileHomePage.relatedPartiesOption.click();

            relatedParties = await RelatedParties.getInstance(page);
            await expect(relatedParties.add_related_party_button).toBeVisible();

            const primaryDebtorCard = page
                .locator(relatedParties.related_party_card_selector)
                .filter({ hasText: 'Primary' });
            await expect(primaryDebtorCard).toBeVisible();

            const ppsaSearchButton = primaryDebtorCard.locator(relatedParties.request_ppsa_search_button);
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
            await expect(documentRows.first()).toBeVisible();
            const rowCount = await documentRows.count();
            expect(rowCount).toBeGreaterThan(0);
            for (let i = 0; i < rowCount; i++) {
                await expect(documentRows.nth(i)).toContainText('PPSA Debtor Search');
            }
        });
    });
});
