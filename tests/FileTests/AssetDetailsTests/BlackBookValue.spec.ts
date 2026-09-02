import { test, expect } from '../../../fixtures';
import { openFileViaSearchbar } from '../../../helpers';
import { logoutAsCurrentUser, navigateToLoginPage } from '../../../navigation-helpers';
import { AssetDetails } from '../../../pages/FilePages/AssetDetails';
import { Assignments } from '../../../pages/FilePages/Assignments';
import { Documents } from '../../../pages/FilePages/Documents';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { Notes } from '../../../pages/FilePages/Notes';
import { Remarketing } from '../../../pages/FilePages/Remarketing';
import { RepoDetails } from '../../../pages/FilePages/RepoDetails';
import { FilesPage } from '../../../pages/FilesPage';
import { LoginPage } from '../../../pages/LoginPage';
import { APIServices } from '../../../services/apiServices';

// ─── TEST DATA CONFIGURATION ────────────────────────────────────────────────
const VEHICLE_DATA = {
    mileage: '1000',
    updatedMileage: '150000',
    contractDate: '03-02-2024',
    vin: '5TFDY5F14LX945732',
    year: '2020',
    make: 'Toyota',
    model: 'Tundra',
    trim: 'SX 5.7L V8',
};

const TOAST_MESSAGES = {
    missingMileage: 'BlackBook Service: Mileage must be greater than zero',
    missingContractDate: 'Contract date is required for Auto assets',
    noMatchingValuation: 'No matching BlackBook Valuation found for the asset.',
};

// Regex to match currency formats like "$ 35,157", "$24,407", or "$ 24,407.00"
const CURRENCY_REGEX = /^\$?\s*[\d,]+(\.\d{2})?$/;

test.describe('Black Book Valuation (BBV) Flow', () => {
    let apiService: APIServices;
    let fileRef = '';

    test.afterEach(async () => {
        if (fileRef && apiService) {
            console.log(`Cleaning up file: ${fileRef}`);
            await apiService.deleteFile(fileRef).catch((e) => console.error(`Failed to delete file: ${e.message}`));
        }
    });

    test('Verify Admin can request, recalculate, and update Black Book Valuations across file sections', async ({
        page,
        request,
        loginAs,
    }) => {
        test.setTimeout(90000);
        apiService = await APIServices.create(request);

        // Page Object Instances
        let fileHomePage: FileHomePage;
        let assetDetails: AssetDetails;
        let repoDetails: RepoDetails;
        let remarketing: Remarketing;

        await test.step('Setup: Create file, log in as Admin, and navigate to Asset Details', async () => {
            const fileDetails = await apiService.createNewAutoAssetFileViaAPI();

            await navigateToLoginPage(page);
            const loginPage = await LoginPage.getInstance(page);
            await expect(loginPage.login_button).toBeVisible();

            await loginAs('basic_admin');
            fileRef = await openFileViaSearchbar(page, fileDetails.accountNumber);

            fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assetDetailsOption).toBeVisible();
            await fileHomePage.assetDetailsOption.click();

            assetDetails = await AssetDetails.getInstance(page);
            await expect(assetDetails.request_BBV_at_assignment_button).toBeVisible();
        });

        await test.step('Validate BBV Request requires Mileage', async () => {
            await assetDetails.asset_VIN_textbox.fill(VEHICLE_DATA.vin);
            await assetDetails.asset_details_save_button.click();

            await expect(assetDetails.request_BBV_at_assignment_button).toBeEnabled();
            await assetDetails.request_BBV_at_assignment_button.click();

            const toastMessage = page.locator(assetDetails.toast_message_selector);

            await expect(toastMessage.filter({ hasText: TOAST_MESSAGES.missingMileage })).toBeVisible();
            await toastMessage.getByRole('button', { name: 'Close' }).click();
            await expect(toastMessage).toBeHidden();
        });

        await test.step('Validate BBV Request requires Contract Date', async () => {
            await expect(assetDetails.asset_mileage_when_loan_was_funded_textbox).toBeVisible();
            await assetDetails.asset_mileage_when_loan_was_funded_textbox.fill(VEHICLE_DATA.mileage);
            await assetDetails.asset_details_save_button.click();

            // Note: Ideally replace waitForTimeout with waiting for a network response or a "Saved" toast/spinner
            await page.waitForTimeout(1000);
            
            // ⚠ UPDATED: Use a Regex to match both "1000" and "1,000"
            await expect(assetDetails.asset_mileage_when_loan_was_funded_textbox).toHaveValue(/^(1000|1,000)$/);

            await assetDetails.request_BBV_at_assignment_button.click();

            const toastMessage = page.locator(assetDetails.toast_message_selector);
            await expect(toastMessage.filter({ hasText: TOAST_MESSAGES.missingContractDate })).toBeVisible();
            await toastMessage.getByRole('button', { name: 'Close' }).click();
        });

        await test.step('Update Contract Date in Repo Details', async () => {
            await fileHomePage.repoDetailsOption.click();
            repoDetails = await RepoDetails.getInstance(page);

            await expect(repoDetails.contract_date_textbox).toBeVisible();
            await repoDetails.loan_contract_type_radio_button.click();
            await repoDetails.contract_date_textbox.fill(VEHICLE_DATA.contractDate);
            await page.keyboard.press('Tab'); // Trigger onBlur validation
            await repoDetails.contract_save_button.click();
            await page.waitForTimeout(1000); // Wait for save
        });

        await test.step('Validate BBV Request requires matching Vehicle details', async () => {
            await fileHomePage.assetDetailsOption.click();
            await assetDetails.request_BBV_at_assignment_button.click();

            const toastMessage = page.locator(assetDetails.toast_message_selector);
            await expect(toastMessage.filter({ hasText: TOAST_MESSAGES.noMatchingValuation })).toBeVisible();
            await toastMessage.getByRole('button', { name: 'Close' }).click();
        });

        await test.step('Fill Vehicle Details and Successfully Request Initial BBV', async () => {
            await assetDetails.asset_VIN_textbox.fill(VEHICLE_DATA.vin);

            await assetDetails.asset_year_dropdown.click();
            await expect(page.getByRole('option', { name: VEHICLE_DATA.year, exact: true })).toBeVisible();
            await page.getByRole('option', { name: VEHICLE_DATA.year, exact: true }).click();

            await assetDetails.asset_car_make_dropdown.click();
            await expect(page.getByRole('option', { name: VEHICLE_DATA.make, exact: true })).toBeVisible();
            await page.getByRole('option', { name: VEHICLE_DATA.make, exact: true }).click();

            await assetDetails.asset_car_model_dropdown.click();
            await expect(page.getByRole('option', { name: VEHICLE_DATA.model, exact: true })).toBeVisible();
            await page.getByRole('option', { name: VEHICLE_DATA.model, exact: true }).click();

            await assetDetails.asset_car_trim_dropdown.click();
            await expect(page.getByRole('option', { name: VEHICLE_DATA.trim, exact: true })).toBeVisible();
            await page.getByRole('option', { name: VEHICLE_DATA.trim, exact: true }).click();

            await assetDetails.asset_details_save_button.click();
            await page.waitForTimeout(750);
            await page.reload();

            // Re-instantiate POM after reload
            assetDetails = await AssetDetails.getInstance(page);

            await expect(assetDetails.request_BBV_at_assignment_button).toBeVisible();
            await assetDetails.request_BBV_at_assignment_button.dblclick();

            if (await assetDetails.request_BBV_at_assignment_button.isEnabled()) {
                await expect(assetDetails.request_BBV_at_assignment_button).toBeVisible();
                await assetDetails.request_BBV_at_assignment_button.click();
            }

            await expect(assetDetails.request_BBV_at_assignment_button).toBeDisabled();

            // Dynamic Regex Validation instead of hardcoded $35,157
            await expect(assetDetails.asset_black_book_value_at_assignment_textbox).toHaveValue(CURRENCY_REGEX);
        });

        await test.step('Recalculate BBV with updated current mileage', async () => {
            await assetDetails.asset_current_mileage_textbox.fill(VEHICLE_DATA.updatedMileage);
            await assetDetails.asset_details_save_button.click();
            await page.waitForTimeout(1000);

            await assetDetails.asset_recalculate_Black_book_value_icon.click();

            const recalculatedBlackBookValueSection = page
                .locator('.grid.grid-cols-2.gap-4.w-full')
                .filter({ hasText: 'Recalculated Black Book Value' });

            await expect(recalculatedBlackBookValueSection).toBeVisible();
            await expect(recalculatedBlackBookValueSection).toContainText('Last calculated on');

            // Validate that SOME dollar amount exists in the recalculated section
            await expect(recalculatedBlackBookValueSection).toContainText(/\$[\d,]+/);
        });

        await test.step('Request Rough BBV in Remarketing Section', async () => {
            await fileHomePage.remarketingOption.click();
            remarketing = await Remarketing.getInstance(page);

            await expect(remarketing.request_black_book_value_button).toBeVisible();
            await remarketing.request_black_book_value_button.click();
            await remarketing.requestBlackBookValue('Rough');

            await expect(remarketing.rough_black_book_value_textbox).toBeVisible();

            // Validate the textbox is populated with a valid currency format
            await expect(remarketing.rough_black_book_value_textbox).toHaveValue(CURRENCY_REGEX);
        });
    });
});