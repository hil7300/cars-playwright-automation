import { test, expect } from '../../fixtures';
import { getTodaysDate, openFileViaSearchbar } from '../../helpers';
import { logoutAsCurrentUser, navigateToLoginPage } from '../../navigation-helpers';
import { AssetDetails } from '../../pages/FilePages/AssetDetails';
import { Assignments } from '../../pages/FilePages/Assignments';
import { Documents } from '../../pages/FilePages/Documents';
import { FileHomePage } from '../../pages/FilePages/FileHomePage';
import { FileSidebar } from '../../pages/FilePages/FileSideBar';
import { Notes } from '../../pages/FilePages/Notes';
import { Remarketing } from '../../pages/FilePages/Remarketing';
import { RepoDetails } from '../../pages/FilePages/RepoDetails';
import { FilesPage } from '../../pages/FilesPage';
import { LoginPage } from '../../pages/LoginPage';
import { RemarketingPage } from '../../pages/RemarketingPage';
import { APIServices } from '../../services/apiServices';

// ─── TYPES & INTERFACES ─────────────────────────────────────────────────────

// Industry Standard: Strongly type your known statuses so the compiler catches typos immediately
type RemarketingStatus =
    | 'At Auction'
    | 'Awaiting Appraisals/Photos'
    | 'Awaiting Reserve'
    | 'Repair Requested'
    | 'Awaiting Reserve Approval'
    | 'For Sale'
    | 'Sold - Pending Close';

// ─── TEST DATA & HELPERS ────────────────────────────────────────────────────

const VEHICLE_DATA = {
    contractDate: '03-02-2024',
    initialMileage: '1000',
    updatedMileage: '150000',
    vin: '5TFDY5F14LX945732',
    year: '2020',
    make: 'Toyota',
    model: 'Tundra',
    trim: 'SX 5.7L V8',
} as const; // 'as const' makes these properties strictly read-only

const REPAIRS = [
    { category: 'Mechanical', action: 'Replace brake pads', cost: '500' },
    { category: 'Body', action: 'Fix left bumper dent', cost: '1200' },
    { category: 'Keys', action: 'Replace lost key fob', cost: '250' },
    { category: 'Tires', action: 'Replace front tires', cost: '400' },
    { category: 'Battery', action: 'Install new battery', cost: '150' },
    { category: 'Other', action: 'Detailing and interior cleaning', cost: '100' },
] as const;

const REMARKETING_DATA = {
    conditionCategory: 'Average',
    requestedReservePrice: '15000',
    approvedReservePrice: '14500',
    startPrice: '12000',
    buyNowPrice: '16000',
    redLight: 'Accident Repair',
    salesperson: 'John Doe',
    saleAttempts: '1',
    saleChannel: 'Direct to Dealer',
    saleAmount: '25000',
    saleGST: '1750',
    saleHST: '1750',
    salePST: '1750',
    repairAmount: '500',
} as const;

/** Extracts an absolute numerical value from a formatted currency string (e.g. "-$54.00" -> 54) */
const parseCurrency = (text: string | null): number => {
    return Math.abs(parseFloat((text || '0').replace(/[^0-9.-]+/g, '')));
};

/**
 * Remarketing statuses walked through in dashboard verification (in order).
 * 'Pending Arbitration' is intentionally skipped per test scope.
 */
const REMARKETING_STATUSES: RemarketingStatus[] = [
    'At Auction',
    'Awaiting Appraisals/Photos',
    'Awaiting Reserve',
    'Repair Requested',
    'Awaiting Reserve Approval',
    'For Sale',
    'Sold - Pending Close',
];

/**
 * Cells expected to render on the Remarketing Dashboard for each status.
 * Cell names match the `data-cy` attribute of the column.
 */
const STATUS_EXPECTED_CELLS: Record<RemarketingStatus, string[]> = {
    'At Auction': ['Auction', 'Client', 'VIN / HIN', 'Date at Auction', 'Legal Sale Date', 'Date of Last Activity'],
    'Awaiting Appraisals/Photos': [
        'Auction',
        'Client',
        'VIN / HIN',
        'Legal Sale Date',
        'Date of Last Activity',
        'Condition Report Date',
    ],
    'Awaiting Reserve': [
        'Auction',
        'Client',
        'VIN / HIN',
        'Legal Sale Date',
        'Date of Last Activity',
        'Condition Report Date',
        'Repairs Requested',
    ],
    'Repair Requested': [
        'Auction',
        'Client',
        'VIN / HIN',
        'Legal Sale Date',
        'Date of Last Activity',
        'Condition Report Date',
        'Repairs Requested',
        'Repairs Approved',
        'Approved Date',
        'Updated Condition Report Date',
    ],
    'Awaiting Reserve Approval': [
        'Auction',
        'Client',
        'VIN / HIN',
        'Legal Sale Date',
        'Date of Last Activity',
        'Condition Report Date',
        'Requested Reserve Price',
        'Requested Reserve Price Date',
        'Rough Value',
        'Repairs Approved',
        'Claims History',
    ],
    'For Sale': [
        'Auction',
        'Client',
        'VIN / HIN',
        'Legal Sale Date',
        'Date of Last Activity',
        'Condition Report Date',
        'Requested Reserve Price',
        'Requested Reserve Price Date',
        'Rough Value',
        'Repairs Approved',
        'Claims History',
        'Auction Date',
    ],
    'Sold - Pending Close': [
        'Auction',
        'Client',
        'VIN / HIN',
        'Legal Sale Date',
        'Date of Last Activity',
        'Approved Reserve Price',
        'Revised Approved Reserve Price',
        'Auction Date',
        'Sale Price',
        'Sale Date',
    ],
};

/**
 * Map of dashboard cell name → expected rendered value.
 */
const KNOWN_CELL_VALUES: Record<string, string> = {
    Auction: 'Sales Location Testing Company',
    'VIN / HIN': VEHICLE_DATA.vin,
    'Requested Reserve Price': REMARKETING_DATA.requestedReservePrice,
    'Approved Reserve Price': REMARKETING_DATA.approvedReservePrice,
    'Sale Price': REMARKETING_DATA.saleAmount,
};

const MONETARY_CELLS = new Set(['Requested Reserve Price', 'Approved Reserve Price', 'Sale Price']);

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

test.describe('Remarketing Dashboard Functionality', () => {
    let apiService: APIServices;
    let fileRef = '';

    test.afterEach(async () => {
        if (fileRef && apiService) {
            console.log(`Cleaning up file: ${fileRef}`);
            await apiService.deleteFile(fileRef).catch((e) => console.error(`Failed to cleanup file: ${e.message}`));
        }
    });

    test('Verify Remarketing dashboard', async ({ page, request, loginAs }) => {
        test.setTimeout(90000);
        apiService = await APIServices.create(request);

        // Page Object Instances scoped to the test
        let fileHomePage: FileHomePage;
        let assetDetails: AssetDetails;
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
            await expect(fileHomePage.assignmentOption).toBeVisible();
            await fileHomePage.assignmentOption.click();

            const assignments = await Assignments.getInstance(page);
            await expect(assignments.assign_button).toBeVisible();
            await assignments.assignCompanyToFile('Sales Location', 'Sales Location Testing Company');
        });

        await test.step('Setup: Fulfill BBV Prerequisites (Contract Date & Vehicle Details)', async () => {
            await fileHomePage.repoDetailsOption.click();
            const repoDetails = await RepoDetails.getInstance(page);

            await expect(repoDetails.contract_date_textbox).toBeVisible();
            await repoDetails.loan_contract_type_radio_button.click();
            await repoDetails.contract_date_textbox.fill(VEHICLE_DATA.contractDate);
            await page.keyboard.press('Tab');
            await repoDetails.contract_save_button.click();
            await page.waitForTimeout(750);

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
            await page.waitForTimeout(750);

            await page.reload();
            assetDetails = await AssetDetails.getInstance(page);
        });

        await test.step('Setup: Generate Initial Black Book Valuations', async () => {
            await expect(assetDetails.request_BBV_at_assignment_button).toBeVisible();
            await assetDetails.request_BBV_at_assignment_button.click();
            await expect(assetDetails.request_BBV_at_assignment_button).toBeDisabled();

            await assetDetails.asset_current_mileage_textbox.fill(VEHICLE_DATA.updatedMileage);
            await assetDetails.asset_details_save_button.click();
            await page.waitForTimeout(750);

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

        await test.step('Action: Add Required Repairs and Reconditioning Items', async () => {
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
        });

        await test.step('Action: Fill Condition Report Section', async () => {
            const today = await getTodaysDate();

            await expect(remarketing.condition_report_date_textbox).toBeVisible();
            await remarketing.condition_report_date_textbox.fill(today);
            await page.keyboard.press('Tab');

            await remarketing.condition_category_dropdown.click();
            await page.getByRole('option', { name: REMARKETING_DATA.conditionCategory, exact: true }).click();

            await expect(remarketing.condition_save_button).toBeVisible();
            await remarketing.condition_save_button.click();
            await page.waitForTimeout(500);
        });

        await test.step('Action: Fill Reserve Price Section', async () => {
            await expect(remarketing.requested_reserve_price_textbox).toBeVisible();
            await remarketing.requested_reserve_price_textbox.fill(REMARKETING_DATA.requestedReservePrice);
            await remarketing.approved_reserve_price_textbox.fill(REMARKETING_DATA.approvedReservePrice);
            await remarketing.start_price_textbox.fill(REMARKETING_DATA.startPrice);
            await remarketing.buy_now_price_textbox.fill(REMARKETING_DATA.buyNowPrice);

            await expect(remarketing.reserve_saved_button).toBeVisible();
            await remarketing.reserve_saved_button.click();
            await page.waitForTimeout(500);
        });

        await test.step('Action: Fill Sale Section', async () => {
            const today = await getTodaysDate();

            await expect(remarketing.auction_date_textbox).toBeVisible();
            await remarketing.auction_date_textbox.fill(today);
            await page.keyboard.press('Tab');

            await remarketing.red_light_dropdown.click();
            await page.getByRole('option', { name: REMARKETING_DATA.redLight, exact: true }).click();

            await remarketing.salesperson_textbox.fill(REMARKETING_DATA.salesperson);

            await remarketing.date_sold_textbox.fill(today);
            await page.keyboard.press('Tab');

            await remarketing.legal_sale_date_textbox.fill(today);
            await page.keyboard.press('Tab');

            await remarketing.sale_attempts_dropdown.click();
            await page.getByRole('option', { name: REMARKETING_DATA.saleAttempts, exact: true }).click();

            await remarketing.sale_channel_dropdown.click();
            await page.getByRole('option', { name: REMARKETING_DATA.saleChannel, exact: true }).click();

            await remarketing.sale_amount_textbox.fill(REMARKETING_DATA.saleAmount);
            await remarketing.sale_gst_textbox.fill(REMARKETING_DATA.saleGST);
            await remarketing.sale_hst_textbox.fill(REMARKETING_DATA.saleHST);
            await remarketing.sale_pst_textbox.fill(REMARKETING_DATA.salePST);

            await remarketing.auction_acknowledged_yes_radio_button.check();

            await remarketing.repair_amount_textbox.fill(REMARKETING_DATA.repairAmount);
            await remarketing.approved_repair_date_textbox.fill(today);
            await page.keyboard.press('Tab');

            await expect(remarketing.sale_save_button).toBeEnabled();
            await remarketing.sale_save_button.click();
            await page.waitForTimeout(500);
        });

        // ─── DASHBOARD VERIFICATION PHASE ───

        await test.step(`Action: Transition file to Remarketing stage with initial status '${REMARKETING_STATUSES[0]}'`, async () => {
            const fileSidebar = await FileSidebar.getInstance(page);
            await fileSidebar.changeFileStageAndStatus('Remarketing', REMARKETING_STATUSES[0]);
            await page.waitForTimeout(1000);
        });

        for (let i = 0; i < REMARKETING_STATUSES.length; i++) {
            const currentStatus = REMARKETING_STATUSES[i];
            const nextStatus = REMARKETING_STATUSES[i + 1];

            await test.step(`Verify Remarketing Dashboard renders expected cells for status: '${currentStatus}'`, async () => {
                const filesPage = await FilesPage.getInstance(page);
                await expect(filesPage.remarketing_button).toBeVisible();
                await filesPage.remarketing_button.click();

                const remarketingPage = await RemarketingPage.getInstance(page);
                await remarketingPage.changeStatusTo(currentStatus);

                const fileRow = await remarketingPage.getFileRowByVIN(VEHICLE_DATA.vin);

                // Verify every required cell for this status is rendered, and that
                // cells whose value we control render the expected data.
                for (const cellName of STATUS_EXPECTED_CELLS[currentStatus]) {
                    const cell = fileRow.locator(`[data-cy="${cellName}"]`);
                    await expect(cell, `[${currentStatus}] '${cellName}' cell should be visible`).toBeVisible();

                    const expectedValue = KNOWN_CELL_VALUES[cellName];
                    if (expectedValue === undefined) continue;

                    if (MONETARY_CELLS.has(cellName)) {
                        const cellText = await cell.textContent();
                        expect(
                            parseCurrency(cellText),
                            `[${currentStatus}] '${cellName}' numeric value should equal ${expectedValue}`
                        ).toBe(parseCurrency(expectedValue));
                    } else {
                        await expect(
                            cell,
                            `[${currentStatus}] '${cellName}' should contain '${expectedValue}'`
                        ).toContainText(expectedValue);
                    }
                }
            });

            if (nextStatus) {
                await test.step(`Action: Open file via VIN and transition status to '${nextStatus}'`, async () => {
                    const remarketingPage = await RemarketingPage.getInstance(page);
                    const fileRow = await remarketingPage.getFileRowByVIN(VEHICLE_DATA.vin);
                    await fileRow.locator(remarketingPage.vin_cell_selector).click();

                    // Re-instantiating FileHomePage for the new navigation context
                    const currentFileHomePage = await FileHomePage.getInstance(page);
                    await expect(currentFileHomePage.assignmentOption).toBeVisible();

                    const fileSidebar = await FileSidebar.getInstance(page);
                    await fileSidebar.summary_tab.click();
                    await fileSidebar.changeFileStatus(nextStatus);
                    await fileSidebar.update_button.click();
                    await page.waitForTimeout(500);
                });
            }
        }
    });
});
