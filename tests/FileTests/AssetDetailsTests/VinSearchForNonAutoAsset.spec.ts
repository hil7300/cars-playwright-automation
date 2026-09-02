import { test, expect } from '../../../fixtures';
import { navigateToLoginPage } from '../../../navigation-helpers';
import { CreateFilePage } from '../../../pages/CreateFilePage';
import { AssetDetails } from '../../../pages/FilePages/AssetDetails';
import { Documents } from '../../../pages/FilePages/Documents';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { RelatedParties } from '../../../pages/FilePages/RelatedParties';
import { FilesPage } from '../../../pages/FilesPage';
import { APIServices } from '../../../services/apiServices';

test.describe('VIN Search for Non-Auto Assets', () => {
    let apiService: APIServices;

    // 1. Declare fileRef in the outer scope so afterEach can access it
    let fileRef = '';

    test.beforeEach(async ({ page, request, loginAs }) => {
        await navigateToLoginPage(page);
        apiService = await APIServices.create(request);
        await loginAs('super_admin');

        const filesPage = await FilesPage.getInstance(page);
        await expect(filesPage.search_textbox).toBeVisible();
        await filesPage.create_file_button.click();
    });

    // 2. Use afterEach to guarantee cleanup, even if the test fails halfway through
    test.afterEach(async () => {
        if (fileRef && apiService) {
            console.log(`Cleaning up file: ${fileRef}`);
            await apiService.deleteFile(fileRef);
        }
    });

    test(`Non Auto VIN Search`, async ({ page }) => {
        test.setTimeout(60000);

        let assetDetails: AssetDetails;
        let fileHomePage: FileHomePage;

        await test.step('Create a new Non-Auto Asset file', async () => {
            const createFilePage = await CreateFilePage.getInstance(page);

            // Execute the creation flow
            const fileDetails = await createFilePage.createNewFile('Bank 3', 'Recreational Vehicle');
            fileRef = fileDetails.refNumber;
        });

        await test.step('Verify BBV and CARFAX buttons are hidden for Non-Auto assets', async () => {
            fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assetDetailsOption).toBeVisible();
            await fileHomePage.assetDetailsOption.click();

            assetDetails = await AssetDetails.getInstance(page);
            await expect(assetDetails.request_VIN_search_button).toBeVisible();
            await expect(assetDetails.request_BBV_at_assignment_button).toBeHidden();
            await expect(assetDetails.request_CARFAX_report_button).toBeHidden();
        });

        await test.step('Validate VIN search fails without primary debtor address', async () => {
            await assetDetails.request_VIN_search_button.click();

            const toastMessage = page.locator(assetDetails.toast_message_selector);
            await expect(toastMessage).toBeVisible();
            await expect(toastMessage).toContainText('Invalid primary debtor');
        });

        await test.step('Update Related Parties with valid Primary Debtor address', async () => {
            await fileHomePage.relatedPartiesOption.click();

            const relatedParties = await RelatedParties.getInstance(page);
            await expect(relatedParties.edit_related_party_icon).toBeVisible();
            await relatedParties.edit_related_party_icon.click();

            await expect(relatedParties.edit_country_dropdown).toBeVisible();
            await relatedParties.edit_country_dropdown.click();
            await page.getByRole('option', { name: 'Canada' }).click();

            await relatedParties.edit_province_dropdown.click();
            await page.getByRole('option', { name: 'British Columbia' }).click();

            await relatedParties.edit_street_1_textbox.fill('123 Test St');
            await relatedParties.edit_city_textbox.fill('Test City');
            await relatedParties.edit_postal_code_textbox.fill('M1P 4V2');
            await relatedParties.save_changes_button.click();
        });

        await test.step('Request VIN Search successfully and verify Complete status', async () => {
            await fileHomePage.assetDetailsOption.click();
            await assetDetails.request_VIN_search_button.click();

            await expect(assetDetails.request_VIN_search_button).toContainText('Pending', { timeout: 5000 });
            await expect(assetDetails.request_VIN_search_button).toBeDisabled();

            await assetDetails.confirmVinSearchCompleted(apiService);
            await expect(assetDetails.request_VIN_search_button).toContainText('Complete', { timeout: 10000 });
        });

        await test.step('Verify documents are generated in the Documents section', async () => {
            await fileHomePage.documentsOption.click();

            const documents = await Documents.getInstance(page);
            await expect(page.locator(documents.documents_table_selector)).toBeVisible();
            await expect(page.locator(documents.document_row_selector)).toHaveCount(2);
        });
    });
});
