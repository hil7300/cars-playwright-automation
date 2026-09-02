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

// ─── TEST DATA & HELPERS ────────────────────────────────────────────────────

const VEHICLE_DATA = {
    contractDate: '03-02-2024',
    initialMileage: '1000',
    updatedMileage: '150000',
    vin: '5TFDY5F14LX945732',
    year: '2020',
    make: 'Toyota', // Note: Case-sensitive based on your previous code
    model: 'Tundra',
    trim: 'SX 5.7L V8',
};

const REPAIRS = [
    { category: 'Mechanical', action: 'Replace brake pads', cost: '500' },
    { category: 'Body', action: 'Fix left bumper dent', cost: '1200' },
    { category: 'Keys', action: 'Replace lost key fob', cost: '250' },
    { category: 'Tires', action: 'Replace front tires', cost: '400' },
    { category: 'Battery', action: 'Install new battery', cost: '150' },
    { category: 'Other', action: 'Detailing and interior cleaning', cost: '100' },
];

/** Extracts an absolute numerical value from a formatted currency string (e.g. "-$54.00" -> 54) */
const parseCurrency = (text: string | null): number => {
    return Math.abs(parseFloat((text || '0').replace(/[^0-9.-]+/g, '')));
};

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

test.describe('Remarketing Valuation Section Flow', () => {
    let apiService: APIServices;
    let fileRef = '';

    test.afterEach(async () => {
        if (fileRef && apiService) {
            console.log(`Cleaning up file: ${fileRef}`);
            await apiService.deleteFile(fileRef).catch((e) => console.error(`Failed to cleanup file: ${e.message}`));
        }
    });

    test('Verify Remarketing features including Black Book Valuations', async ({ page, request, loginAs }) => {
        apiService = await APIServices.create(request);

        let fileHomePage: FileHomePage;
        let assetDetails: AssetDetails;
        let repoDetails: RepoDetails;
        let remarketing: Remarketing;

        // ─── SETUP PHASE ───

        await test.step('Setup: Create file and log in as Admin', async () => {
            const fileDetails = await apiService.createNewAutoAssetFileViaAPI();

            await navigateToLoginPage(page);
            const loginPage = await LoginPage.getInstance(page);
            await expect(loginPage.login_button).toBeVisible();

            await loginAs('basic_admin');
            fileRef = await openFileViaSearchbar(page, fileDetails.accountNumber);
            fileHomePage = await FileHomePage.getInstance(page);
        });

        await test.step('Setup: Fulfill BBV Prerequisites (Contract Date & Vehicle Details)', async () => {
            // 1. Update Contract Date
            await fileHomePage.repoDetailsOption.click();
            repoDetails = await RepoDetails.getInstance(page);

            await expect(repoDetails.contract_date_textbox).toBeVisible();
            await repoDetails.loan_contract_type_radio_button.click();
            await repoDetails.contract_date_textbox.fill(VEHICLE_DATA.contractDate);
            await page.keyboard.press('Tab');
            await repoDetails.contract_save_button.click();
            await page.waitForTimeout(1000);

            // 2. Fill Mileage and Vehicle Details
            await fileHomePage.assetDetailsOption.click();
            assetDetails = await AssetDetails.getInstance(page);

            await expect(assetDetails.asset_mileage_when_loan_was_funded_textbox).toBeVisible();
            await assetDetails.asset_mileage_when_loan_was_funded_textbox.fill(VEHICLE_DATA.initialMileage);
            await assetDetails.asset_VIN_textbox.fill(VEHICLE_DATA.vin);

            await assetDetails.asset_year_dropdown.click();
            await page.getByRole('option', { name: VEHICLE_DATA.year, exact: true }).click();

            await assetDetails.asset_car_make_dropdown.click();
            await page.getByRole('option', { name: VEHICLE_DATA.make, exact: true }).click();

            await assetDetails.asset_car_model_dropdown.click();
            await page.getByRole('option', { name: VEHICLE_DATA.model, exact: true }).click();

            await assetDetails.asset_car_trim_dropdown.click();
            await page.getByRole('option', { name: VEHICLE_DATA.trim, exact: true }).click();

            await assetDetails.asset_details_save_button.click();
            await page.waitForTimeout(1000);

            await page.reload();
            assetDetails = await AssetDetails.getInstance(page);
        });

        await test.step('Setup: Generate Initial Black Book Valuations', async () => {
            await expect(assetDetails.request_BBV_at_assignment_button).toBeVisible();
            await assetDetails.request_BBV_at_assignment_button.click();
            await expect(assetDetails.request_BBV_at_assignment_button).toBeDisabled();

            await assetDetails.asset_current_mileage_textbox.fill(VEHICLE_DATA.updatedMileage);
            await assetDetails.asset_details_save_button.click();
            await page.waitForTimeout(1000);

            await assetDetails.asset_recalculate_Black_book_value_icon.click();

            const recalculatedSection = page
                .locator('.grid.grid-cols-2.gap-4.w-full')
                .filter({ hasText: 'Recalculated Black Book Value' });
            await expect(recalculatedSection).toBeVisible();
            await expect(recalculatedSection).toContainText('Last calculated on');
        });

        // ─── REMARKETING & REPAIRS PHASE ───

        await test.step('Action: Navigate to Remarketing and Request Rough BBV', async () => {
            await fileHomePage.remarketingOption.click();
            remarketing = await Remarketing.getInstance(page);

            await expect(remarketing.request_black_book_value_button).toBeVisible();
            await remarketing.request_black_book_value_button.click();

            await remarketing.requestBlackBookValue('Rough');
            await expect(remarketing.rough_black_book_value_textbox).toBeVisible();
            await page.waitForTimeout(500);
        });

        await test.step('Action & Verification: Add Repairs and Verify Calculation States', async () => {
            // 1. Add all repairs
            for (let i = 0; i < REPAIRS.length; i++) {
                const repair = REPAIRS[i];

                await expect(remarketing.request_repair_add_item_button).toBeVisible();
                await remarketing.request_repair_add_item_button.click();

                await expect(remarketing.request_repair_category_dropdown).toBeVisible();
                await remarketing.request_repair_category_dropdown.click();
                await page.getByRole('option', { name: repair.category, exact: true }).click();

                await expect(remarketing.request_repair_action_textbox.nth(i)).toBeVisible();
                await remarketing.request_repair_action_textbox.nth(i).fill(repair.action);

                await expect(remarketing.request_repair_cost_textbox.nth(i)).toBeVisible();
                await remarketing.request_repair_cost_textbox.nth(i).fill(repair.cost);

                await expect(remarketing.valuation_save_button).toBeVisible();
            }
            await remarketing.valuation_save_button.click();
            await page.waitForTimeout(500);

            // Action Locators
            const approveRepair = page.locator(remarketing.approve_repair_selector);
            const declineRepair = page.locator(remarketing.decline_repair_selector);

            // Math Element Locators
            const netBBVLocator = page
                .locator('.grid.grid-cols-2.gap-4.w-full')
                .filter({ hasText: 'Net Black Book Value' });
            const totalRepairLocator = page.locator('.text-right').filter({ hasText: 'Total' });

            // State Extraction Helpers
            const getRequiredRepairsCost = async () =>
                parseCurrency(await remarketing.required_repairs_and_reconditioning_textbox.inputValue());
            const getNetBBV = async () => parseCurrency(await netBBVLocator.innerText());

            // Grab baselines
            const roughBBVValue = parseCurrency(await remarketing.rough_black_book_value_textbox.inputValue());
            const totalRepairSumUI = parseCurrency(await totalRepairLocator.innerText());
            const expectedSum = REPAIRS.reduce((acc, item) => acc + parseFloat(item.cost), 0);

            // 2. Verify Initial State (All Pending)
            expect(totalRepairSumUI, 'UI Total should match sum of input items').toBe(expectedSum);
            expect(await getRequiredRepairsCost(), 'Initial Required Repairs should be 0').toBe(0);
            expect(await getNetBBV(), 'Initial Net BBV should exactly equal Rough BBV').toBe(roughBBVValue);

            // 3. Test Decline Logic (Required Repairs increases, Net BBV decreases)
            await expect(declineRepair.nth(0)).toBeVisible();
            await declineRepair.nth(0).click();
            await page.waitForTimeout(500); // Allow frontend state to calculate
            const firstItemCost = parseFloat(REPAIRS[0].cost);

            expect(await getRequiredRepairsCost(), 'Required repairs should add the cost of the declined item').toBe(
                firstItemCost
            );
            expect(await getNetBBV(), 'Net BBV should be reduced by the declined item cost').toBe(
                roughBBVValue - firstItemCost
            );

            // 4. Test Approve Logic (Required Repairs and Net BBV should NOT change)
            await expect(approveRepair.nth(1)).toBeVisible();
            await approveRepair.nth(1).click();
            await page.waitForTimeout(500);

            expect(await getRequiredRepairsCost(), 'Required repairs should not change when an item is approved').toBe(
                firstItemCost
            );
            expect(await getNetBBV(), 'Net BBV should not change when an item is approved').toBe(
                roughBBVValue - firstItemCost
            );

            // 5. Final Verification: Decline everything
            for (let i = 1; i < REPAIRS.length; i++) {
                await expect(declineRepair.nth(i)).toBeVisible();
                await declineRepair.nth(i).click();
                await page.waitForTimeout(300);
            }

            // Assert Final Math
            expect(await getRequiredRepairsCost(), 'Final required repairs should equal total of all items').toBe(
                totalRepairSumUI
            );
            expect(await getNetBBV(), 'Final Net BBV should equal Rough BBV minus Total Repairs').toBe(
                roughBBVValue - totalRepairSumUI
            );
        });
    });
});
