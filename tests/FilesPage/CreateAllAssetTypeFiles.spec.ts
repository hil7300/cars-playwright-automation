import { test, expect } from '../../fixtures';
import { navigateToLoginPage } from '../../navigation-helpers';
import { CreateFilePage } from '../../pages/CreateFilePage';
import { FilesPage } from '../../pages/FilesPage';
import { APIServices } from '../../services/apiServices';

const assetTypes = [
    'Auto',
    'All-Terrain Vehicle',
    'Marine',
    'Motorcycle',
    'Recreational Vehicle',
    'Trailer',
    'E-Bike',
    'Equipment',
];

test.describe('Create New File - All Asset Types', () => {
    let apiService: APIServices;

    test.beforeEach(async ({ page, request, loginAs }) => {
        await navigateToLoginPage(page);
        apiService = await APIServices.create(request);
        await loginAs('super_admin');

        const filesPage = await FilesPage.getInstance(page);
        await expect(filesPage.search_textbox).toBeVisible();
        await filesPage.create_file_button.click();
    });

    for (const asset of assetTypes) {
        test(`Create a new ${asset} File`, async ({ page }) => {
            const createFilePage = await CreateFilePage.getInstance(page);

            // Execute the creation flow
            const fileDetails = await createFilePage.createNewFile('QA Automation Bank', asset);

            // Assertion to ensure we are on the correct page or reference is generated
            expect(fileDetails.refNumber).not.toBeNull();
            expect(fileDetails.refNumber).toBeTruthy();

            // Cleanup: Delete the created file using API
            await apiService.deleteFile(fileDetails.refNumber);
        });
    }
});
